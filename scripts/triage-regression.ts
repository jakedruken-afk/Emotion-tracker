import assert from "node:assert/strict";
import { evaluatePatientTextForCrisis } from "../server/clinicalMonitoring";
import { buildPatientRiskSnapshot } from "../client/src/lib/riskReview";
import type {
  DailyReportRecord,
  EmotionLog,
  WeeklyScreeningRecord,
} from "../shared/contracts";

const now = new Date().toISOString();

function createEmotionLog(overrides: Partial<EmotionLog> = {}): EmotionLog {
  return {
    id: 1,
	    patientId: "demo-patient",
	    emotion: "Happy",
	    occurredAt: null,
	    notes: null,
    sleepHours: 8,
    stressLevel: 2,
    cravingLevel: 0,
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
    updatedAt: now,
    editCount: 0,
    suspiciousEditCount: 0,
    reliabilityLevel: "High",
    crisisLevel: "none",
    crisisSummary: null,
    timestamp: now,
    observations: [],
    ...overrides,
  };
}

function createDailyReport(
  overrides: Partial<DailyReportRecord> = {},
): DailyReportRecord {
  return {
    id: 1,
    patientId: "demo-patient",
    reportType: "morning",
    bedTime: "23:00",
    wakeTime: "07:00",
    sleepQuality: "good",
    wakeUps: 0,
    feltRested: true,
    mealsCount: null,
    mealsNote: null,
    notes: null,
    updatedAt: now,
    editCount: 0,
    suspiciousEditCount: 0,
    reliabilityLevel: "High",
    crisisLevel: "none",
    crisisSummary: null,
    timestamp: now,
    ...overrides,
  };
}

function createWeeklyScreening(
  overrides: Partial<WeeklyScreeningRecord> = {},
): WeeklyScreeningRecord {
  return {
    id: 1,
    patientId: "demo-patient",
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
    updatedAt: now,
    editCount: 0,
    suspiciousEditCount: 0,
    reliabilityLevel: "High",
    crisisLevel: "none",
    crisisSummary: null,
    timestamp: now,
    ...overrides,
  };
}

function runCrisisDetectorChecks() {
  const cases = [
    {
      label: "neutral coping language stays unflagged",
      text: "I feel okay and I want to rest.",
      expected: "none",
    },
    {
      label: "negated self-harm statement stays unflagged",
      text: "I feel stressed and overwhelmed, but I have no plans to hurt myself.",
      expected: "none",
    },
    {
      label: "passive self-harm wording is high",
      text: "I feel like I do not want to be here sometimes.",
      expected: "high",
    },
    {
      label: "existential self-erasure wording is critical",
      text: "i feel like im worthless and dont belong on this earth anymore",
      expected: "critical",
    },
    {
      label: "plain-language not wanting to be on earth is high",
      text: "i dont feel like being on earth anymore",
      expected: "high",
    },
    {
      label: "emergency mental health crisis response is critical",
      text: "Emergency mental health crisis was called twice.",
      expected: "critical",
    },
    {
      label: "crisis team home response is critical",
      text: "The crisis team came to my house twice this week.",
      expected: "critical",
    },
    {
      label: "negated crisis call stays unflagged",
      text: "I did not call the crisis line today.",
      expected: "none",
    },
    {
      label: "quoted third-party language stays unflagged",
      text: "My friend said they do not belong on this earth anymore.",
      expected: "none",
    },
  ] as const;

  for (const testCase of cases) {
    const result = evaluatePatientTextForCrisis([testCase.text]);
    assert.equal(result.level, testCase.expected, testCase.label);
  }
}

function runRiskSnapshotChecks() {
  const lowSnapshot = buildPatientRiskSnapshot(
    "low-demo",
    [createEmotionLog()],
    [],
    [],
    [],
  );
  assert.equal(lowSnapshot.riskLevel, "Low", "stable baseline should remain low");

  const mediumSnapshot = buildPatientRiskSnapshot(
    "medium-demo",
    [
      createEmotionLog({
        emotion: "Worried",
        stressLevel: 7,
        sleepHours: 5,
        notes: "Stress has been building.",
      }),
      createEmotionLog({
        id: 2,
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        emotion: "Worried",
        stressLevel: 7,
        sleepHours: 5,
      }),
      createEmotionLog({
        id: 3,
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        emotion: "Sad",
        stressLevel: 6,
        sleepHours: 6,
      }),
      createEmotionLog({
        id: 4,
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        emotion: "Happy",
        stressLevel: 3,
        sleepHours: 8,
      }),
    ],
    [],
    [],
    [],
  );
  assert.equal(
    mediumSnapshot.riskLevel,
    "Medium",
    "multiple meaningful but non-crisis changes should land in medium",
  );

  const highSnapshot = buildPatientRiskSnapshot(
    "high-demo",
    [
      createEmotionLog({
        emotion: "Sad",
        notes: "I feel like I do not want to be here.",
        crisisLevel: "high",
        crisisSummary:
          "Patient text suggests thoughts about self-harm or not wanting to be here.",
      }),
    ],
    [],
    [],
    [],
  );
  assert.equal(highSnapshot.riskLevel, "High", "passive self-harm wording should land in high");

  const criticalSnapshot = buildPatientRiskSnapshot(
    "critical-demo",
    [
      createEmotionLog({
        emotion: "Sad",
        notes: "i feel like im worthless and dont belong on this earth anymore",
        crisisLevel: "critical",
        crisisSummary:
          "Patient text suggests active self-harm intent or an immediate need for safety support.",
      }),
    ],
    [],
    [],
    [],
  );
  assert.equal(
    criticalSnapshot.riskLevel,
    "Critical",
    "critical safety language should land in critical",
  );

  const emergencyResponseSnapshot = buildPatientRiskSnapshot(
    "emergency-response-demo",
    [
      createEmotionLog({
        patientId: "emergency-response-demo",
        notes: "Emergency mental health crisis was called twice.",
        crisisLevel: "none",
        crisisSummary: null,
      }),
    ],
    [],
    [],
    [],
  );
  assert.equal(
    emergencyResponseSnapshot.riskLevel,
    "Critical",
    "emergency response wording should become critical even if older stored crisis metadata is none",
  );
  assert.ok(
    emergencyResponseSnapshot.reasons.some((reason) =>
      reason.toLowerCase().includes("emergency mental-health"),
    ),
    "emergency response wording should appear in the priority reasons",
  );
  assert.equal(
    emergencyResponseSnapshot.emergencyFollowUpEvents.length,
    1,
    "emergency response wording should create a dated follow-up event",
  );
  assert.equal(
    emergencyResponseSnapshot.emergencyFollowUpEvents[0]?.source,
    "Mood check-in",
    "emergency response follow-up should keep the source for appointments",
  );

  const relativeEmergencyResponseSnapshot = buildPatientRiskSnapshot(
    "relative-emergency-response-demo",
    [
      createEmotionLog({
        patientId: "relative-emergency-response-demo",
        notes:
          "Emergency mental health crisis unit was called. Happened 9:30-10 on Saturday night and yesterday 7pm.",
        occurredAt: "2026-06-01T11:53:00.000Z",
        timestamp: "2026-06-01T12:58:36.000Z",
        crisisLevel: "none",
        crisisSummary: null,
      }),
    ],
    [],
    [],
    [],
    { asOf: "2026-06-01T13:00:00.000Z" },
  );
  assert.equal(
    relativeEmergencyResponseSnapshot.emergencyFollowUpEvents.length,
    2,
    "relative emergency wording should create two dated follow-up events",
  );
  assert.deepEqual(
    relativeEmergencyResponseSnapshot.emergencyFollowUpEvents.map((event) => event.eventAt),
    [
      new Date(2026, 4, 31, 19, 0, 0, 0).toISOString(),
      new Date(2026, 4, 30, 21, 30, 0, 0).toISOString(),
    ],
    "Saturday night and yesterday 7pm should resolve against the mood log date in local time",
  );

  const preCrisisCutoff = "2026-06-01T12:57:59.000Z";
  const postCrisisAngryEntry = createEmotionLog({
    id: 99,
    patientId: "pre-crisis-demo",
    emotion: "Angry",
    stressLevel: 9,
    sleepHours: 8,
    timestamp: "2026-06-01T12:58:36.000Z",
  });
  const preCrisisSnapshot = buildPatientRiskSnapshot(
    "pre-crisis-demo",
    [
      postCrisisAngryEntry,
      createEmotionLog({
        id: 4,
        patientId: "pre-crisis-demo",
        emotion: "Happy",
        stressLevel: 5,
        sleepHours: 13,
        medicationAdherence: "not_prescribed",
        timestamp: "2026-05-26T18:11:17.000Z",
      }),
      createEmotionLog({
        id: 3,
        patientId: "pre-crisis-demo",
        emotion: "Happy",
        stressLevel: 3,
        sleepHours: 9,
        timestamp: "2026-05-25T13:00:54.000Z",
      }),
      createEmotionLog({
        id: 2,
        patientId: "pre-crisis-demo",
        emotion: "Happy",
        stressLevel: 1,
        sleepHours: 9,
        medicationAdherence: "missed_some",
        missedMedicationName: "morning medication",
        missedMedicationReason: "forgot",
        timestamp: "2026-05-24T12:33:07.000Z",
      }),
    ],
    [
      createDailyReport({
        id: 4,
        patientId: "pre-crisis-demo",
        reportType: "night",
        bedTime: "21:30",
        wakeTime: null,
        sleepQuality: null,
        wakeUps: null,
        feltRested: null,
        mealsCount: 0,
        mealsNote: "No meals today.",
        timestamp: "2026-05-26T18:14:27.000Z",
      }),
      createDailyReport({
        id: 3,
        patientId: "pre-crisis-demo",
        reportType: "morning",
        bedTime: "21:30",
        wakeTime: "12:30",
        sleepQuality: "okay",
        wakeUps: 3,
        feltRested: false,
        timestamp: "2026-05-26T18:13:34.000Z",
      }),
      createDailyReport({
        id: 2,
        patientId: "pre-crisis-demo",
        reportType: "night",
        bedTime: "23:30",
        wakeTime: null,
        sleepQuality: null,
        wakeUps: null,
        feltRested: null,
        mealsCount: 0,
        mealsNote: "No meals today.",
        timestamp: "2026-05-24T12:48:43.000Z",
      }),
      createDailyReport({
        id: 1,
        patientId: "pre-crisis-demo",
        reportType: "morning",
        bedTime: "23:30",
        wakeTime: "09:05",
        sleepQuality: "good",
        wakeUps: 1,
        feltRested: true,
        timestamp: "2026-05-24T12:46:42.000Z",
      }),
    ],
    [
      createWeeklyScreening({
        id: 1,
        patientId: "pre-crisis-demo",
        wishedDead: true,
        familyBetterOffDead: true,
        thoughtsKillingSelf: false,
        everTriedToKillSelf: true,
        attemptTiming: "within_year",
        currentThoughts: false,
        depressedHardToFunction: true,
        depressedFrequency: "some_days",
        anxiousOnEdge: true,
        anxiousFrequency: "most_days",
        hopeless: true,
        couldNotEnjoyThings: true,
        substanceUseMoreThanUsual: true,
        substanceUseFrequency: "some_days",
        sleepTrouble: true,
        sleepTroubleFrequency: "some_days",
        appetiteChange: true,
        appetiteChangeDirection: "up_and_down",
        needsHelpStayingSafe: false,
        timestamp: "2026-05-24T12:43:49.000Z",
      }),
    ],
    [],
    { asOf: preCrisisCutoff },
  );
  assert.equal(
    preCrisisSnapshot.riskLevel,
    "High",
    "pre-crisis weekly safety, routine disruption, and silence should land in high before post-crisis mood entry",
  );
  assert.equal(
    preCrisisSnapshot.dominantEmotion,
    "Happy",
    "post-crisis angry mood entry should be excluded by the as-of cutoff",
  );
  assert.equal(
    preCrisisSnapshot.deteriorationWatch,
    true,
    "silence after concerning signals should create a deterioration watch",
  );
  assert.ok(
    preCrisisSnapshot.reasons.some((reason) =>
      reason.toLowerCase().includes("weekly safety screen"),
    ),
    "pre-crisis reasons should include the weekly safety screen",
  );
  assert.ok(
    preCrisisSnapshot.reasons.some((reason) =>
      reason.toLowerCase().includes("0 meals"),
    ),
    "pre-crisis reasons should include repeated zero-meal reports",
  );
  assert.ok(
    preCrisisSnapshot.reasons.some((reason) =>
      reason.toLowerCase().includes("deterioration watch"),
    ),
    "pre-crisis reasons should include silence after warning signs",
  );
  assert.ok(
    preCrisisSnapshot.confidence === "Low" || preCrisisSnapshot.confidence === "Medium",
    "silence before the crisis should lower confidence",
  );
}

runCrisisDetectorChecks();
runRiskSnapshotChecks();

console.log("Triage regression checks passed.");
