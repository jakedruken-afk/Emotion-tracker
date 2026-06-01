import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildPatientRiskSnapshot } from "../client/src/lib/riskReview";
import {
  buildReliabilityLevel,
  evaluateSuspiciousEdit,
  summarizeRevision,
} from "../server/clinicalMonitoring";
import type {
  DailyReportRecord,
  EmotionLog,
  EmotionRecord,
  ObservationRecord,
  WeeklyScreeningRecord,
} from "../shared/contracts";

// Keep fixtures inside recency windows because the risk review logic uses Date.now().
const baseTime = new Date();
const patientId = "regression-patient";

type StorageModule = typeof import("../server/storage");
type DbModule = typeof import("../server/db");

function hoursAgo(hours: number) {
  return new Date(baseTime.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number, hourOffset = 0) {
  return hoursAgo(days * 24 + hourOffset);
}

function createEmotionRecord(overrides: Partial<EmotionRecord> = {}): EmotionRecord {
  return {
    id: 1,
	    patientId,
	    emotion: "Happy",
	    occurredAt: null,
	    notes: null,
    sleepHours: 8,
    stressLevel: 2,
    cravingLevel: 1,
    substanceUseToday: false,
    substanceUsed: null,
    moneyChangedToday: false,
    medicationAdherence: "took_as_prescribed",
    missedMedicationName: null,
    missedMedicationReason: null,
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    locationCapturedAt: null,
    updatedAt: hoursAgo(0),
    editCount: 0,
    suspiciousEditCount: 0,
    reliabilityLevel: "High",
    crisisLevel: "none",
    crisisSummary: null,
    timestamp: hoursAgo(0),
    ...overrides,
  };
}

function createEmotionLog(overrides: Partial<EmotionLog> = {}): EmotionLog {
  return {
    ...createEmotionRecord(overrides),
    observations: [],
    ...overrides,
  };
}

function createDailyReport(overrides: Partial<DailyReportRecord> = {}): DailyReportRecord {
  const reportType = overrides.reportType ?? "morning";

  return {
    id: 1,
    patientId,
    reportType,
    bedTime: reportType === "night" ? "22:00" : "23:00",
    wakeTime: reportType === "morning" ? "07:00" : null,
    sleepQuality: reportType === "morning" ? "good" : null,
    wakeUps: reportType === "morning" ? 1 : null,
    feltRested: reportType === "morning" ? true : null,
    mealsCount: reportType === "night" ? 3 : null,
    mealsNote: null,
    notes: null,
    updatedAt: hoursAgo(0),
    editCount: 0,
    suspiciousEditCount: 0,
    reliabilityLevel: "High",
    crisisLevel: "none",
    crisisSummary: null,
    timestamp: hoursAgo(0),
    ...overrides,
  };
}

function createWeeklyScreening(
  overrides: Partial<WeeklyScreeningRecord> = {},
): WeeklyScreeningRecord {
  return {
    id: 1,
    patientId,
    wishedDead: false,
    familyBetterOffDead: false,
    thoughtsKillingSelf: false,
    thoughtsKillingSelfFrequency: null,
    everTriedToKillSelf: false,
    attemptTiming: "none",
    currentThoughts: null,
    depressedHardToFunction: false,
    depressedFrequency: null,
    anxiousOnEdge: false,
    anxiousFrequency: null,
    hopeless: false,
    couldNotEnjoyThings: false,
    keepingToSelf: false,
    moreIrritable: false,
    substanceUseMoreThanUsual: false,
    substanceUseFrequency: null,
    sleepTrouble: false,
    sleepTroubleFrequency: null,
    appetiteChange: false,
    appetiteChangeDirection: null,
    supportPerson: null,
    reasonsForLiving: null,
    copingPlan: null,
    needsHelpStayingSafe: null,
    updatedAt: hoursAgo(0),
    editCount: 0,
    suspiciousEditCount: 0,
    reliabilityLevel: "High",
    crisisLevel: "none",
    crisisSummary: null,
    timestamp: hoursAgo(0),
    ...overrides,
  };
}

function createObservation(overrides: Partial<ObservationRecord> = {}): ObservationRecord {
  return {
    id: 1,
    patientId,
    observationType: "Clinical",
    observation: "Routine follow-up completed.",
    priority: "Medium",
    supportWorkerName: "Sarah Smith",
    linkedEntityType: null,
    linkedEntityId: null,
    systemGenerated: false,
    status: "open",
    ownershipNote: null,
    acknowledgedByUserId: null,
    acknowledgedByName: null,
    acknowledgedAt: null,
    timestamp: hoursAgo(0),
    ...overrides,
  };
}

function expectIncludes(values: string[], expected: string, label: string) {
  assert.ok(values.includes(expected), `${label}\nExpected to find: ${expected}\nActual: ${values.join(" | ")}`);
}

function expectTextContains(value: string | null, expected: string, label: string) {
  assert.ok(value?.includes(expected), `${label}\nExpected "${value}" to include "${expected}"`);
}

function runReliabilityHeuristicChecks() {
  assert.equal(buildReliabilityLevel(0, 0, "none"), "High");
  assert.equal(buildReliabilityLevel(1, 0, "none"), "Medium");
  assert.equal(buildReliabilityLevel(0, 0, "watch"), "Medium");
  assert.equal(buildReliabilityLevel(2, 0, "none"), "Low");
  assert.equal(buildReliabilityLevel(1, 1, "none"), "Low");
  assert.equal(buildReliabilityLevel(0, 0, "high"), "Low");

  expectTextContains(
    summarizeRevision("emotion", "patient", true),
    "softened a higher-risk answer",
    "Suspicious emotion edits should get a clinical review summary",
  );
  expectTextContains(
    summarizeRevision("daily_report", "patient", false),
    "Patient updated a daily report",
    "Non-suspicious daily report edits should get a generic revision summary",
  );
}

function runSuspiciousEditChecks() {
  const highRiskEmotion = createEmotionRecord({
    emotion: "Sad",
    stressLevel: 9,
    cravingLevel: 9,
    substanceUseToday: true,
    substanceUsed: "Alcohol",
    medicationAdherence: "missed_all",
    notes: "Used substances and missed every medication dose.",
  });

  assert.equal(
    evaluateSuspiciousEdit("emotion", highRiskEmotion, {
      ...highRiskEmotion,
      substanceUseToday: false,
    }),
    true,
  );
  assert.equal(
    evaluateSuspiciousEdit("emotion", highRiskEmotion, {
      ...highRiskEmotion,
      cravingLevel: 3,
    }),
    true,
  );
  assert.equal(
    evaluateSuspiciousEdit("emotion", highRiskEmotion, {
      ...highRiskEmotion,
      stressLevel: 4,
    }),
    true,
  );
  assert.equal(
    evaluateSuspiciousEdit("emotion", highRiskEmotion, {
      ...highRiskEmotion,
      medicationAdherence: "took_as_prescribed",
      missedMedicationName: null,
      missedMedicationReason: null,
    }),
    true,
  );
  assert.equal(
    evaluateSuspiciousEdit("emotion", highRiskEmotion, {
      ...highRiskEmotion,
      notes: "Clarified the note wording only.",
      stressLevel: 8,
      cravingLevel: 8,
    }),
    false,
  );

  const poorMorning = createDailyReport({
    reportType: "morning",
    wakeUps: 4,
    feltRested: false,
    sleepQuality: "bad",
    bedTime: "22:00",
    wakeTime: "06:00",
  });

  assert.equal(
    evaluateSuspiciousEdit("daily_report", poorMorning, {
      ...poorMorning,
      wakeUps: 1,
    }),
    true,
  );
  assert.equal(
    evaluateSuspiciousEdit("daily_report", poorMorning, {
      ...poorMorning,
      feltRested: true,
    }),
    true,
  );
  assert.equal(
    evaluateSuspiciousEdit("daily_report", poorMorning, {
      ...poorMorning,
      sleepQuality: "good",
    }),
    true,
  );
  assert.equal(
    evaluateSuspiciousEdit(
      "daily_report",
      createDailyReport({
        reportType: "night",
        mealsCount: 1,
        mealsNote: "Forgot to eat.",
      }),
      createDailyReport({
        reportType: "night",
        mealsCount: 3,
        mealsNote: "Actually ate three meals.",
      }),
    ),
    true,
  );
  assert.equal(
    evaluateSuspiciousEdit("daily_report", poorMorning, {
      ...poorMorning,
      bedTime: "22:30",
      wakeTime: "06:30",
    }),
    false,
  );

  const positiveWeeklyScreen = createWeeklyScreening({
    wishedDead: true,
    thoughtsKillingSelf: true,
    currentThoughts: true,
    needsHelpStayingSafe: true,
  });

  assert.equal(
    evaluateSuspiciousEdit("weekly_screening", positiveWeeklyScreen, {
      ...positiveWeeklyScreen,
      currentThoughts: false,
    }),
    true,
  );
  assert.equal(
    evaluateSuspiciousEdit("weekly_screening", positiveWeeklyScreen, {
      ...positiveWeeklyScreen,
      thoughtsKillingSelf: false,
    }),
    true,
  );
  assert.equal(
    evaluateSuspiciousEdit("weekly_screening", positiveWeeklyScreen, {
      ...positiveWeeklyScreen,
      wishedDead: false,
    }),
    true,
  );
  assert.equal(
    evaluateSuspiciousEdit("weekly_screening", positiveWeeklyScreen, {
      ...positiveWeeklyScreen,
      needsHelpStayingSafe: false,
    }),
    true,
  );
  assert.equal(
    evaluateSuspiciousEdit("weekly_screening", positiveWeeklyScreen, {
      ...positiveWeeklyScreen,
      supportPerson: "Mom",
    }),
    false,
  );
}

function runWhatChangedChecks() {
  const moodShiftSnapshot = buildPatientRiskSnapshot(
    "mood-shift",
    [
      createEmotionLog({ id: 1, timestamp: hoursAgo(1), emotion: "Angry" }),
      createEmotionLog({ id: 2, timestamp: hoursAgo(8), emotion: "Angry" }),
      createEmotionLog({ id: 3, timestamp: hoursAgo(16), emotion: "Worried" }),
      createEmotionLog({ id: 4, timestamp: daysAgo(2), emotion: "Happy" }),
      createEmotionLog({ id: 5, timestamp: daysAgo(3), emotion: "Happy" }),
      createEmotionLog({ id: 6, timestamp: daysAgo(4), emotion: "Happy" }),
    ],
    [],
    [],
    [],
  );
  expectIncludes(
    moodShiftSnapshot.whatChanged,
    "Mood pattern shifted toward angry entries.",
    "Worsening dominant mood should be surfaced",
  );

  const stressRiseSnapshot = buildPatientRiskSnapshot(
    "stress-rise",
    [
      createEmotionLog({ id: 1, timestamp: hoursAgo(1), stressLevel: 8 }),
      createEmotionLog({ id: 2, timestamp: hoursAgo(8), stressLevel: 8 }),
      createEmotionLog({ id: 3, timestamp: hoursAgo(16), stressLevel: 8 }),
      createEmotionLog({ id: 4, timestamp: daysAgo(2), stressLevel: 4 }),
      createEmotionLog({ id: 5, timestamp: daysAgo(3), stressLevel: 4 }),
      createEmotionLog({ id: 6, timestamp: daysAgo(4), stressLevel: 4 }),
    ],
    [],
    [],
    [],
  );
  expectIncludes(
    stressRiseSnapshot.whatChanged,
    "Stress rose from 4.0/10 to 8.0/10.",
    "Stress increases of two or more points should be detected",
  );

  const sleepDropSnapshot = buildPatientRiskSnapshot(
    "sleep-drop",
    [],
    [
      createDailyReport({
        id: 1,
        reportType: "morning",
        timestamp: hoursAgo(1),
        bedTime: "23:00",
        wakeTime: "04:00",
        sleepQuality: "okay",
      }),
      createDailyReport({
        id: 2,
        reportType: "morning",
        timestamp: hoursAgo(25),
        bedTime: "23:30",
        wakeTime: "04:30",
        sleepQuality: "okay",
      }),
      createDailyReport({
        id: 3,
        reportType: "morning",
        timestamp: hoursAgo(49),
        bedTime: "00:00",
        wakeTime: "05:00",
        sleepQuality: "okay",
      }),
      createDailyReport({
        id: 4,
        reportType: "morning",
        timestamp: daysAgo(3),
        bedTime: "22:00",
        wakeTime: "07:00",
        sleepQuality: "good",
      }),
      createDailyReport({
        id: 5,
        reportType: "morning",
        timestamp: daysAgo(4),
        bedTime: "22:00",
        wakeTime: "07:00",
        sleepQuality: "good",
      }),
      createDailyReport({
        id: 6,
        reportType: "morning",
        timestamp: daysAgo(5),
        bedTime: "22:00",
        wakeTime: "07:00",
        sleepQuality: "good",
      }),
    ],
    [],
    [],
  );
  expectIncludes(
    sleepDropSnapshot.whatChanged,
    "Average sleep dropped from 9.0 to 5.0 hours.",
    "Meaningful sleep-duration drops should be detected",
  );

  const poorSleepSnapshot = buildPatientRiskSnapshot(
    "poor-sleep-repeat",
    [],
    [
      createDailyReport({
        id: 1,
        reportType: "morning",
        timestamp: hoursAgo(1),
        sleepQuality: "bad",
      }),
      createDailyReport({
        id: 2,
        reportType: "morning",
        timestamp: hoursAgo(25),
        sleepQuality: "very_bad",
      }),
      createDailyReport({
        id: 3,
        reportType: "morning",
        timestamp: hoursAgo(49),
        sleepQuality: "good",
      }),
      createDailyReport({
        id: 4,
        reportType: "morning",
        timestamp: daysAgo(3),
        sleepQuality: "good",
      }),
      createDailyReport({
        id: 5,
        reportType: "morning",
        timestamp: daysAgo(4),
        sleepQuality: "okay",
      }),
      createDailyReport({
        id: 6,
        reportType: "morning",
        timestamp: daysAgo(5),
        sleepQuality: "good",
      }),
    ],
    [],
    [],
  );
  expectIncludes(
    poorSleepSnapshot.whatChanged,
    "Poor sleep quality is repeating across recent mornings.",
    "Repeated bad sleep should be surfaced even when duration is steady",
  );

  const mealsDropSnapshot = buildPatientRiskSnapshot(
    "meals-drop",
    [],
    [
      createDailyReport({
        id: 1,
        reportType: "night",
        timestamp: hoursAgo(1),
        mealsCount: 1,
      }),
      createDailyReport({
        id: 2,
        reportType: "night",
        timestamp: hoursAgo(25),
        mealsCount: 1,
      }),
      createDailyReport({
        id: 3,
        reportType: "night",
        timestamp: hoursAgo(49),
        mealsCount: 1,
      }),
      createDailyReport({
        id: 4,
        reportType: "night",
        timestamp: daysAgo(3),
        mealsCount: 3,
      }),
      createDailyReport({
        id: 5,
        reportType: "night",
        timestamp: daysAgo(4),
        mealsCount: 3,
      }),
      createDailyReport({
        id: 6,
        reportType: "night",
        timestamp: daysAgo(5),
        mealsCount: 3,
      }),
    ],
    [],
    [],
  );
  expectIncludes(
    mealsDropSnapshot.whatChanged,
    "Meals dropped from 3.0 to 1.0 per day.",
    "Meal-count drops should be surfaced",
  );

  const mealDifficultySnapshot = buildPatientRiskSnapshot(
    "meal-difficulty",
    [],
    [
      createDailyReport({
        id: 1,
        reportType: "night",
        timestamp: hoursAgo(1),
        mealsCount: 2,
        mealsNote: "Too stressed to eat lunch.",
      }),
    ],
    [],
    [],
  );
  expectIncludes(
    mealDifficultySnapshot.whatChanged,
    "Recent meal notes suggest eating difficulty.",
    "Meal notes that suggest appetite barriers should be surfaced",
  );

  const missedMedicationSnapshot = buildPatientRiskSnapshot(
    "missed-medication",
    [
      createEmotionLog({
        id: 1,
        timestamp: hoursAgo(1),
        medicationAdherence: "missed_some",
        missedMedicationName: "Sertraline",
        missedMedicationReason: "forgot",
      }),
      createEmotionLog({
        id: 2,
        timestamp: hoursAgo(25),
        medicationAdherence: "missed_some",
        missedMedicationName: "Sertraline",
        missedMedicationReason: "forgot",
      }),
      createEmotionLog({
        id: 3,
        timestamp: hoursAgo(49),
        medicationAdherence: "took_as_prescribed",
      }),
      createEmotionLog({
        id: 4,
        timestamp: daysAgo(3),
        medicationAdherence: "took_as_prescribed",
      }),
      createEmotionLog({
        id: 5,
        timestamp: daysAgo(4),
        medicationAdherence: "took_as_prescribed",
      }),
      createEmotionLog({
        id: 6,
        timestamp: daysAgo(5),
        medicationAdherence: "took_as_prescribed",
      }),
    ],
    [],
    [],
    [],
  );
  expectIncludes(
    missedMedicationSnapshot.whatChanged,
    "Missed medication details appeared in recent check-ins.",
    "New medication adherence concerns should be surfaced",
  );

  const weakChangeSnapshot = buildPatientRiskSnapshot(
    "weak-change",
    [
      createEmotionLog({ id: 1, timestamp: hoursAgo(1), stressLevel: 6 }),
      createEmotionLog({ id: 2, timestamp: hoursAgo(25), stressLevel: 6 }),
      createEmotionLog({ id: 3, timestamp: hoursAgo(49), stressLevel: 6 }),
      createEmotionLog({ id: 4, timestamp: daysAgo(3), stressLevel: 5 }),
      createEmotionLog({ id: 5, timestamp: daysAgo(4), stressLevel: 5 }),
      createEmotionLog({ id: 6, timestamp: daysAgo(5), stressLevel: 5 }),
    ],
    [],
    [],
    [],
  );
  assert.equal(
    weakChangeSnapshot.whatChanged.some((change) => change.startsWith("Stress rose from")),
    false,
    "Small stress changes should stay suppressed",
  );
}

function runMismatchChecks() {
  const supportMismatch = buildPatientRiskSnapshot(
    "support-mismatch",
    [
      createEmotionLog({ id: 1, timestamp: hoursAgo(1), stressLevel: 3, cravingLevel: 1 }),
      createEmotionLog({ id: 2, timestamp: hoursAgo(25), stressLevel: 4, cravingLevel: 2 }),
    ],
    [createDailyReport({ id: 1, reportType: "night", timestamp: hoursAgo(1), mealsCount: 3 })],
    [],
    [
      createObservation({
        id: 1,
        timestamp: hoursAgo(2),
        priority: "High",
        observation: "Patient is withdrawn, not eating, and looks high risk today.",
      }),
    ],
  );
  assert.equal(supportMismatch.mismatchLevel, "high");
  assert.equal(supportMismatch.reliabilityLevel, "Low");
  expectTextContains(
    supportMismatch.mismatchSummary,
    "Support observations describe more deterioration",
    "Severe support concern with stable self-report should flag a high mismatch",
  );
  expectIncludes(
    supportMismatch.suggestedActions,
    "Review the mismatch directly with the patient and support worker.",
    "High mismatch should add a direct review action",
  );

  const patientMismatch = buildPatientRiskSnapshot(
    "patient-mismatch",
    [
      createEmotionLog({ id: 1, timestamp: hoursAgo(1), stressLevel: 9 }),
      createEmotionLog({ id: 2, timestamp: hoursAgo(25), stressLevel: 8 }),
    ],
    [createDailyReport({ id: 1, reportType: "night", timestamp: hoursAgo(1), mealsCount: 1 })],
    [],
    [],
  );
  assert.equal(patientMismatch.mismatchLevel, "watch");
  assert.equal(patientMismatch.reliabilityLevel, "Medium");
  expectTextContains(
    patientMismatch.mismatchSummary,
    "Patient self-report shows deterioration without a matching recent support observation.",
    "Self-report deterioration without recent support notes should flag watch mismatch",
  );

  const alignedConcern = buildPatientRiskSnapshot(
    "aligned-concern",
    [
      createEmotionLog({ id: 1, timestamp: hoursAgo(1), stressLevel: 9 }),
      createEmotionLog({ id: 2, timestamp: hoursAgo(25), stressLevel: 8 }),
    ],
    [createDailyReport({ id: 1, reportType: "night", timestamp: hoursAgo(1), mealsCount: 1 })],
    [],
    [
      createObservation({
        id: 1,
        timestamp: hoursAgo(1),
        priority: "High",
        observation: "Patient is not eating and showing panic.",
      }),
    ],
  );
  assert.equal(alignedConcern.mismatchLevel, "none");
  assert.equal(alignedConcern.reliabilityLevel, "High");

  const calmSnapshot = buildPatientRiskSnapshot(
    "calm-snapshot",
    [createEmotionLog({ id: 1, timestamp: hoursAgo(1), stressLevel: 3, cravingLevel: 1 })],
    [createDailyReport({ id: 1, reportType: "night", timestamp: hoursAgo(1), mealsCount: 3 })],
    [],
    [],
  );
  assert.equal(calmSnapshot.mismatchLevel, "none");
  assert.equal(calmSnapshot.reliabilityLevel, "High");
}

async function runRevisionPersistenceChecks() {
  const tempDatabasePath = path.resolve(
    process.cwd(),
    "tmp",
    `clinical-regression-${process.pid}.db`,
  );
  cleanupDatabaseFiles(tempDatabasePath);

  process.env.DATABASE_PATH = tempDatabasePath;
  process.env.ENABLE_DEMO_SEED = "false";

  const dbModule = (await import("../server/db")) as DbModule;
  const storageModule = (await import("../server/storage")) as StorageModule;
  const { db, initializeDatabase } = dbModule;
  const { storage } = storageModule;

  try {
    await initializeDatabase();

    const storedEmotion = await storage.createEmotion(
      {
        patientId,
        emotion: "Sad",
        notes: "Used substances and missed every medication dose.",
        sleepHours: 4,
        stressLevel: 9,
        cravingLevel: 9,
        substanceUseToday: true,
        substanceUsed: "Alcohol",
        moneyChangedToday: false,
        medicationAdherence: "missed_all",
        missedMedicationName: "Sertraline",
        missedMedicationReason: "side_effects",
      },
      {
        crisisLevel: "none",
        crisisSummary: null,
        reliabilityLevel: "High",
      },
    );

    const emotionUpdate = {
      emotion: "Sad" as const,
      notes: "Clarified the entry after calming down.",
      sleepHours: 7,
      stressLevel: 4,
      cravingLevel: 3,
      substanceUseToday: false,
      substanceUsed: null,
      moneyChangedToday: false,
      medicationAdherence: "took_as_prescribed" as const,
      missedMedicationName: null,
      missedMedicationReason: null,
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      locationCapturedAt: null,
    };
    const previewEmotion = {
      ...storedEmotion,
      ...emotionUpdate,
    };
    const suspiciousEmotion = evaluateSuspiciousEdit(
      "emotion",
      storedEmotion,
      previewEmotion,
    );
    const updatedEmotion = await storage.updateEmotion(storedEmotion.id, emotionUpdate, {
      crisisLevel: "none",
      crisisSummary: null,
      suspiciousEdit: suspiciousEmotion,
      reliabilityLevel: buildReliabilityLevel(
        storedEmotion.editCount + 1,
        storedEmotion.suspiciousEditCount + (suspiciousEmotion ? 1 : 0),
      ),
    });
    await storage.createEntryRevision({
      entityType: "emotion",
      entityId: storedEmotion.id,
      patientId,
      actorRole: "patient",
      actorUsername: patientId,
      beforeJson: JSON.stringify(storedEmotion),
      afterJson: JSON.stringify(updatedEmotion),
      summary: summarizeRevision("emotion", "patient", suspiciousEmotion),
      suspicious: suspiciousEmotion,
    });

    assert.equal(updatedEmotion.editCount, 1);
    assert.equal(updatedEmotion.suspiciousEditCount, 1);
    assert.equal(updatedEmotion.reliabilityLevel, "Low");

    const storedReport = await storage.createDailyReport(
      {
        patientId,
        reportType: "night",
        bedTime: "22:30",
        wakeTime: null,
        sleepQuality: null,
        wakeUps: null,
        feltRested: null,
        mealsCount: 2,
        mealsNote: "Had dinner late.",
        notes: "Routine evening.",
      },
      {
        crisisLevel: "none",
        crisisSummary: null,
        reliabilityLevel: "High",
      },
    );
    const reportUpdate = {
      reportType: "night" as const,
      bedTime: "22:45",
      wakeTime: null,
      sleepQuality: null,
      wakeUps: null,
      feltRested: null,
      mealsCount: 2,
      mealsNote: "Had dinner with staff support.",
      notes: "Routine evening with a clearer note.",
    };
    const suspiciousReport = evaluateSuspiciousEdit("daily_report", storedReport, {
      ...storedReport,
      ...reportUpdate,
    });
    const updatedReport = await storage.updateDailyReport(storedReport.id, reportUpdate, {
      crisisLevel: "none",
      crisisSummary: null,
      suspiciousEdit: suspiciousReport,
      reliabilityLevel: buildReliabilityLevel(
        storedReport.editCount + 1,
        storedReport.suspiciousEditCount + (suspiciousReport ? 1 : 0),
      ),
    });
    await storage.createEntryRevision({
      entityType: "daily_report",
      entityId: storedReport.id,
      patientId,
      actorRole: "patient",
      actorUsername: patientId,
      beforeJson: JSON.stringify(storedReport),
      afterJson: JSON.stringify(updatedReport),
      summary: summarizeRevision("daily_report", "patient", suspiciousReport),
      suspicious: suspiciousReport,
    });

    assert.equal(updatedReport.editCount, 1);
    assert.equal(updatedReport.suspiciousEditCount, 0);
    assert.equal(updatedReport.reliabilityLevel, "Medium");

    const storedScreening = await storage.createWeeklyScreening(
      {
        patientId,
        wishedDead: true,
        familyBetterOffDead: false,
        thoughtsKillingSelf: true,
        thoughtsKillingSelfFrequency: "some_days",
        everTriedToKillSelf: false,
        attemptTiming: "none",
        currentThoughts: true,
        depressedHardToFunction: true,
        depressedFrequency: "most_days",
        anxiousOnEdge: true,
        anxiousFrequency: "some_days",
        hopeless: true,
        couldNotEnjoyThings: true,
        keepingToSelf: true,
        moreIrritable: false,
        substanceUseMoreThanUsual: false,
        substanceUseFrequency: null,
        sleepTrouble: true,
        sleepTroubleFrequency: "some_days",
        appetiteChange: true,
        appetiteChangeDirection: "less_than_usual",
        supportPerson: "Mom",
        reasonsForLiving: "My family.",
        copingPlan: "Call support.",
        needsHelpStayingSafe: true,
      },
      {
        crisisLevel: "critical",
        crisisSummary: "Weekly safety screen shows a current need for immediate safety support.",
        reliabilityLevel: "High",
      },
    );
    const screeningUpdate = {
      wishedDead: false,
      familyBetterOffDead: false,
      thoughtsKillingSelf: false,
      thoughtsKillingSelfFrequency: null,
      everTriedToKillSelf: false,
      attemptTiming: "none" as const,
      currentThoughts: false,
      depressedHardToFunction: false,
      depressedFrequency: null,
      anxiousOnEdge: false,
      anxiousFrequency: null,
      hopeless: false,
      couldNotEnjoyThings: false,
      keepingToSelf: false,
      moreIrritable: false,
      substanceUseMoreThanUsual: false,
      substanceUseFrequency: null,
      sleepTrouble: false,
      sleepTroubleFrequency: null,
      appetiteChange: false,
      appetiteChangeDirection: null,
      supportPerson: "Mom",
      reasonsForLiving: "My family.",
      copingPlan: "Call support.",
      needsHelpStayingSafe: false,
    };
    const previewScreening = {
      ...storedScreening,
      ...screeningUpdate,
      crisisLevel: "none" as const,
      crisisSummary: null,
    };
    const suspiciousScreening = evaluateSuspiciousEdit(
      "weekly_screening",
      storedScreening,
      previewScreening,
    );
    const updatedScreening = await storage.updateWeeklyScreening(
      storedScreening.id,
      screeningUpdate,
      {
        crisisLevel: "none",
        crisisSummary: null,
        suspiciousEdit: suspiciousScreening,
        reliabilityLevel: buildReliabilityLevel(
          storedScreening.editCount + 1,
          storedScreening.suspiciousEditCount + (suspiciousScreening ? 1 : 0),
        ),
      },
    );
    await storage.createEntryRevision({
      entityType: "weekly_screening",
      entityId: storedScreening.id,
      patientId,
      actorRole: "patient",
      actorUsername: patientId,
      beforeJson: JSON.stringify(storedScreening),
      afterJson: JSON.stringify(updatedScreening),
      summary: summarizeRevision("weekly_screening", "patient", suspiciousScreening),
      suspicious: suspiciousScreening,
    });

    assert.equal(updatedScreening.editCount, 1);
    assert.equal(updatedScreening.suspiciousEditCount, 1);
    assert.equal(updatedScreening.reliabilityLevel, "Low");

    const revisions = await storage.getEntryRevisionsByPatientId(patientId);
    assert.equal(revisions.length, 3);
    assert.equal(revisions[0]?.entityType, "weekly_screening");

    const emotionRevision = revisions.find((revision) => revision.entityType === "emotion");
    const dailyRevision = revisions.find((revision) => revision.entityType === "daily_report");
    const weeklyRevision = revisions.find(
      (revision) => revision.entityType === "weekly_screening",
    );

    assert.ok(emotionRevision, "Emotion revisions should be stored");
    assert.ok(dailyRevision, "Daily report revisions should be stored");
    assert.ok(weeklyRevision, "Weekly screening revisions should be stored");
    assert.equal(emotionRevision?.suspicious, true);
    assert.equal(dailyRevision?.suspicious, false);
    assert.equal(weeklyRevision?.suspicious, true);
    expectTextContains(
      emotionRevision?.summary ?? null,
      "softened a higher-risk answer",
      "Suspicious emotion revisions should store a review-oriented summary",
    );
    expectTextContains(
      dailyRevision?.summary ?? null,
      "updated a daily report",
      "Non-suspicious daily report revisions should keep the generic summary",
    );

    const emotionBefore = JSON.parse(emotionRevision!.beforeJson) as EmotionRecord;
    const emotionAfter = JSON.parse(emotionRevision!.afterJson) as EmotionRecord;
    assert.equal(emotionBefore.substanceUseToday, true);
    assert.equal(emotionAfter.substanceUseToday, false);
    assert.equal(emotionAfter.reliabilityLevel, "Low");

    const weeklyBefore = JSON.parse(weeklyRevision!.beforeJson) as WeeklyScreeningRecord;
    const weeklyAfter = JSON.parse(weeklyRevision!.afterJson) as WeeklyScreeningRecord;
    assert.equal(weeklyBefore.currentThoughts, true);
    assert.equal(weeklyAfter.currentThoughts, false);
    assert.equal(weeklyAfter.suspiciousEditCount, 1);
  } finally {
    db.close();
    cleanupDatabaseFiles(tempDatabasePath);
  }
}

function cleanupDatabaseFiles(databasePath: string) {
  for (const suffix of ["", "-shm", "-wal"]) {
    fs.rmSync(`${databasePath}${suffix}`, { force: true });
  }
}

async function main() {
  runReliabilityHeuristicChecks();
  runSuspiciousEditChecks();
  runWhatChangedChecks();
  runMismatchChecks();
  await runRevisionPersistenceChecks();

  console.log("Clinical monitoring regression checks passed.");
}

await main();
