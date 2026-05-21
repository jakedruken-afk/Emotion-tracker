import {
  demoModeStatusSchema,
  demoScenarioSchema,
  formatDisplayName,
  type AuthUser,
  type DemoModeStatus,
  type DemoScenario,
  type DemoScenarioId,
} from "../shared/contracts";
import { db } from "./db";
import { enableDemoSeed } from "./config";
import { hashPassword } from "./password";
import { SYSTEM_ALERT_AUTHOR } from "./clinicalMonitoring";

const demoPassword = "demo123";

const demoScenarios: DemoScenario[] = [
  {
    id: "stable-low-risk",
    name: "Stable low-risk patient",
    description: "Synthetic patient with steady check-ins, meals, and no urgent flags.",
    focus: "Low-risk baseline with current consent and reliable routine data.",
    patientCount: 1,
    syntheticOnly: true,
  },
  {
    id: "worsening-routine",
    name: "Worsening sleep and meals",
    description: "Synthetic patient showing short-term deterioration in sleep, meals, and stress.",
    focus: "Change detection, medium/high triage, and suggested follow-up wording.",
    patientCount: 1,
    syntheticOnly: true,
  },
  {
    id: "missed-med-details",
    name: "Missed medication details",
    description: "Synthetic patient with missed doses, captured reason, and reliability context.",
    focus: "Medication detail capture and usable clinician summary output.",
    patientCount: 1,
    syntheticOnly: true,
  },
  {
    id: "perspective-mismatch",
    name: "Support mismatch",
    description: "Synthetic patient whose self-report conflicts with support-worker observations.",
    focus: "Mismatch detection, reliability downgrades, and support notes.",
    patientCount: 1,
    syntheticOnly: true,
  },
  {
    id: "critical-crisis-alert",
    name: "Critical crisis alert",
    description: "Synthetic patient with critical free-text language, alert ownership needs, and revision history.",
    focus: "Critical alert routing, acknowledgement, and doctor-review jump targets.",
    patientCount: 1,
    syntheticOnly: true,
  },
];

function isoHoursAgo(hoursAgo: number) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

function getScenarioById(id: DemoScenarioId) {
  return demoScenarios.find((scenario) => scenario.id === id) ?? null;
}

function clearExistingDemoData() {
  const demoPatientIds = db
    .prepare(`
      SELECT username
      FROM users
      WHERE role = 'patient'
        AND username LIKE 'demo-%'
    `)
    .all() as Array<{ username?: string }>;

  for (const row of demoPatientIds) {
    const patientId = String(row.username ?? "");
    if (patientId.length === 0) {
      continue;
    }

    db.prepare("DELETE FROM emotions WHERE patient_id = ?").run(patientId);
    db.prepare("DELETE FROM daily_reports WHERE patient_id = ?").run(patientId);
    db.prepare("DELETE FROM weekly_screenings WHERE patient_id = ?").run(patientId);
    db.prepare("DELETE FROM observations WHERE patient_id = ?").run(patientId);
    db.prepare("DELETE FROM medications WHERE patient_id = ?").run(patientId);
    db.prepare("DELETE FROM care_plans WHERE patient_id = ?").run(patientId);
    db.prepare("DELETE FROM consent_records WHERE patient_id = ?").run(patientId);
    db.prepare("DELETE FROM entry_revisions WHERE patient_id = ?").run(patientId);
    db.prepare("DELETE FROM patient_assignments WHERE patient_id = ?").run(patientId);
    db.prepare("DELETE FROM audit_logs WHERE patient_id = ?").run(patientId);
  }

  db.prepare("DELETE FROM users WHERE role = 'patient' AND username LIKE 'demo-%'").run();
}

async function createDemoPatient(actor: AuthUser, username: string, firstName: string) {
  const passwordHash = await hashPassword(demoPassword);

  const insertResult = db
    .prepare(`
      INSERT INTO users (username, password, role, first_name, last_name)
      VALUES (?, ?, 'patient', ?, 'Demo')
    `)
    .run(username, passwordHash, firstName);

  const userId = Number(insertResult.lastInsertRowid);

  db.prepare(`
    INSERT INTO patient_assignments (patient_id, staff_user_id, created_by_user_id)
    VALUES (?, ?, ?)
  `).run(username, actor.id, actor.id);

  db.prepare(`
    INSERT INTO consent_records (
      patient_id,
      mood_tracking,
      sleep_reports,
      weekly_screening,
      gps_tracking,
      acknowledge_staffed_hours,
      acknowledge_emergency_limits,
      accepted_at,
      updated_at
    )
    VALUES (?, 1, 1, 1, 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(username);

  return { userId, patientId: username };
}

function insertEmotionRecord(input: {
  patientId: string;
  timestamp: string;
  emotion: string;
  notes: string | null;
  sleepHours: number | null;
  stressLevel: number | null;
  cravingLevel: number | null;
  substanceUseToday: boolean;
  moneyChangedToday: boolean;
  medicationAdherence: string;
  missedMedicationName?: string | null;
  missedMedicationReason?: string | null;
  reliabilityLevel?: string;
  crisisLevel?: string;
  crisisSummary?: string | null;
  editCount?: number;
  suspiciousEditCount?: number;
}) {
  const result = db
    .prepare(`
      INSERT INTO emotions (
        patient_id,
        emotion,
        notes,
        sleep_hours,
        stress_level,
        craving_level,
        substance_use_today,
        money_changed_today,
        medication_adherence,
        missed_medication_name,
        missed_medication_reason,
        updated_at,
        edit_count,
        suspicious_edit_count,
        reliability_level,
        crisis_level,
        crisis_summary,
        timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      input.patientId,
      input.emotion,
      input.notes,
      input.sleepHours,
      input.stressLevel,
      input.cravingLevel,
      input.substanceUseToday ? 1 : 0,
      input.moneyChangedToday ? 1 : 0,
      input.medicationAdherence,
      input.missedMedicationName ?? null,
      input.missedMedicationReason ?? null,
      input.timestamp,
      input.editCount ?? 0,
      input.suspiciousEditCount ?? 0,
      input.reliabilityLevel ?? "High",
      input.crisisLevel ?? "none",
      input.crisisSummary ?? null,
      input.timestamp,
    );

  return Number(result.lastInsertRowid);
}

function insertDailyReportRecord(input: {
  patientId: string;
  timestamp: string;
  reportType: "morning" | "night";
  bedTime: string | null;
  wakeTime: string | null;
  sleepQuality: string | null;
  wakeUps: number | null;
  feltRested: boolean | null;
  mealsCount: number | null;
  mealsNote: string | null;
  notes: string | null;
  reliabilityLevel?: string;
}) {
  const result = db
    .prepare(`
      INSERT INTO daily_reports (
        patient_id,
        report_type,
        bed_time,
        wake_time,
        sleep_quality,
        wake_ups,
        felt_rested,
        meals_count,
        meals_note,
        notes,
        updated_at,
        reliability_level,
        timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      input.patientId,
      input.reportType,
      input.bedTime,
      input.wakeTime,
      input.sleepQuality,
      input.wakeUps,
      input.feltRested == null ? null : input.feltRested ? 1 : 0,
      input.mealsCount,
      input.mealsNote,
      input.notes,
      input.timestamp,
      input.reliabilityLevel ?? "High",
      input.timestamp,
    );

  return Number(result.lastInsertRowid);
}

function insertWeeklyScreeningRecord(input: {
  patientId: string;
  timestamp: string;
  currentThoughts: boolean | null;
  thoughtsKillingSelf: boolean;
  thoughtsKillingSelfFrequency?: string | null;
  depressedHardToFunction: boolean;
  depressedFrequency?: string | null;
  anxiousOnEdge: boolean;
  anxiousFrequency?: string | null;
  hopeless: boolean;
  keepingToSelf: boolean;
  moreIrritable: boolean;
  sleepTrouble: boolean;
  sleepTroubleFrequency?: string | null;
  appetiteChange: boolean;
  appetiteChangeDirection?: string | null;
  supportPerson?: string | null;
  reasonsForLiving?: string | null;
  copingPlan?: string | null;
  needsHelpStayingSafe?: boolean | null;
  crisisLevel?: string;
  crisisSummary?: string | null;
  reliabilityLevel?: string;
}) {
  const result = db
    .prepare(`
      INSERT INTO weekly_screenings (
        patient_id,
        wished_dead,
        family_better_off_dead,
        thoughts_killing_self,
        thoughts_killing_self_frequency,
        ever_tried_to_kill_self,
        attempt_timing,
        current_thoughts,
        depressed_hard_to_function,
        depressed_frequency,
        anxious_on_edge,
        anxious_frequency,
        hopeless,
        could_not_enjoy_things,
        keeping_to_self,
        more_irritable,
        substance_use_more_than_usual,
        substance_use_frequency,
        sleep_trouble,
        sleep_trouble_frequency,
        appetite_change,
        appetite_change_direction,
        support_person,
        reasons_for_living,
        coping_plan,
        needs_help_staying_safe,
        updated_at,
        reliability_level,
        crisis_level,
        crisis_summary,
        timestamp
      )
      VALUES (?, 0, 0, ?, ?, 0, 'none', ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      input.patientId,
      input.thoughtsKillingSelf ? 1 : 0,
      input.thoughtsKillingSelfFrequency ?? null,
      input.currentThoughts == null ? null : input.currentThoughts ? 1 : 0,
      input.depressedHardToFunction ? 1 : 0,
      input.depressedFrequency ?? null,
      input.anxiousOnEdge ? 1 : 0,
      input.anxiousFrequency ?? null,
      input.hopeless ? 1 : 0,
      input.keepingToSelf ? 1 : 0,
      input.moreIrritable ? 1 : 0,
      input.sleepTrouble ? 1 : 0,
      input.sleepTroubleFrequency ?? null,
      input.appetiteChange ? 1 : 0,
      input.appetiteChangeDirection ?? null,
      input.supportPerson ?? null,
      input.reasonsForLiving ?? null,
      input.copingPlan ?? null,
      input.needsHelpStayingSafe == null ? null : input.needsHelpStayingSafe ? 1 : 0,
      input.timestamp,
      input.reliabilityLevel ?? "High",
      input.crisisLevel ?? "none",
      input.crisisSummary ?? null,
      input.timestamp,
    );

  return Number(result.lastInsertRowid);
}

function insertObservationRecord(input: {
  patientId: string;
  timestamp: string;
  observationType: string;
  observation: string;
  priority: string;
  supportWorkerName: string;
  linkedEntityType?: string | null;
  linkedEntityId?: number | null;
  systemGenerated?: boolean;
  status?: "open" | "acknowledged";
  ownershipNote?: string | null;
  acknowledgedByUserId?: number | null;
  acknowledgedByName?: string | null;
  acknowledgedAt?: string | null;
}) {
  const result = db
    .prepare(`
      INSERT INTO observations (
        patient_id,
        observation_type,
        observation,
        priority,
        support_worker_name,
        status,
        ownership_note,
        acknowledged_by_user_id,
        acknowledged_by_name,
        acknowledged_at,
        linked_entity_type,
        linked_entity_id,
        system_generated,
        timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      input.patientId,
      input.observationType,
      input.observation,
      input.priority,
      input.supportWorkerName,
      input.status ?? "open",
      input.ownershipNote ?? null,
      input.acknowledgedByUserId ?? null,
      input.acknowledgedByName ?? null,
      input.acknowledgedAt ?? null,
      input.linkedEntityType ?? null,
      input.linkedEntityId ?? null,
      input.systemGenerated ? 1 : 0,
      input.timestamp,
    );

  return Number(result.lastInsertRowid);
}

function insertRevisionRecord(input: {
  patientId: string;
  entityType: "emotion" | "daily_report" | "weekly_screening";
  entityId: number;
  actorUsername: string;
  beforeJson: string;
  afterJson: string;
  summary: string;
  suspicious: boolean;
  timestamp: string;
}) {
  db.prepare(`
    INSERT INTO entry_revisions (
      entity_type,
      entity_id,
      patient_id,
      actor_role,
      actor_username,
      before_json,
      after_json,
      summary,
      suspicious,
      timestamp
    )
    VALUES (?, ?, ?, 'patient', ?, ?, ?, ?, ?, ?)
  `).run(
    input.entityType,
    input.entityId,
    input.patientId,
    input.actorUsername,
    input.beforeJson,
    input.afterJson,
    input.summary,
    input.suspicious ? 1 : 0,
    input.timestamp,
  );
}

function setActiveScenario(scenarioId: DemoScenarioId | null) {
  db.prepare(`
    UPDATE demo_mode_state
    SET
      active_scenario_id = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(scenarioId);
}

function seedStableLowRisk(actor: AuthUser) {
  const patientId = "demo-stable";
  const supportWorkerName = formatDisplayName(actor);
  const happyEntryId = insertEmotionRecord({
    patientId,
    timestamp: isoHoursAgo(48),
    emotion: "Happy",
    notes: "Spent time with family and felt steady most of the day.",
    sleepHours: 7.5,
    stressLevel: 2,
    cravingLevel: 0,
    substanceUseToday: false,
    moneyChangedToday: false,
    medicationAdherence: "took_as_prescribed",
  });

  insertEmotionRecord({
    patientId,
    timestamp: isoHoursAgo(12),
    emotion: "Happy",
    notes: "Routine stayed stable. No major change from the last visit.",
    sleepHours: 8,
    stressLevel: 2,
    cravingLevel: 0,
    substanceUseToday: false,
    moneyChangedToday: false,
    medicationAdherence: "took_as_prescribed",
  });

  insertDailyReportRecord({
    patientId,
    timestamp: isoHoursAgo(10),
    reportType: "morning",
    bedTime: "22:30",
    wakeTime: "06:45",
    sleepQuality: "good",
    wakeUps: 1,
    feltRested: true,
    mealsCount: null,
    mealsNote: null,
    notes: "Slept through most of the night.",
  });

  insertDailyReportRecord({
    patientId,
    timestamp: isoHoursAgo(2),
    reportType: "night",
    bedTime: "22:15",
    wakeTime: null,
    sleepQuality: null,
    wakeUps: null,
    feltRested: null,
    mealsCount: 3,
    mealsNote: "Regular appetite today.",
    notes: "Planning for a normal bedtime.",
  });

  insertObservationRecord({
    patientId,
    timestamp: isoHoursAgo(6),
    observationType: "Progress",
    observation: "Synthetic support note: routine stable and no urgent outreach needed.",
    priority: "Low",
    supportWorkerName,
    linkedEntityType: "emotion",
    linkedEntityId: happyEntryId,
  });
}

function seedWorseningRoutine(actor: AuthUser) {
  const patientId = "demo-routine";
  const supportWorkerName = formatDisplayName(actor);

  insertEmotionRecord({
    patientId,
    timestamp: isoHoursAgo(120),
    emotion: "Worried",
    notes: "Sleep and eating were okay earlier in the week.",
    sleepHours: 6.5,
    stressLevel: 4,
    cravingLevel: 1,
    substanceUseToday: false,
    moneyChangedToday: false,
    medicationAdherence: "took_as_prescribed",
  });

  insertEmotionRecord({
    patientId,
    timestamp: isoHoursAgo(36),
    emotion: "Sad",
    notes: "Stress has been climbing and I have not felt like eating much.",
    sleepHours: 4,
    stressLevel: 7,
    cravingLevel: 3,
    substanceUseToday: false,
    moneyChangedToday: false,
    medicationAdherence: "took_as_prescribed",
  });

  insertEmotionRecord({
    patientId,
    timestamp: isoHoursAgo(8),
    emotion: "Worried",
    notes: "Only slept a few hours again and had one meal today.",
    sleepHours: 3,
    stressLevel: 8,
    cravingLevel: 2,
    substanceUseToday: false,
    moneyChangedToday: false,
    medicationAdherence: "took_as_prescribed",
  });

  insertDailyReportRecord({
    patientId,
    timestamp: isoHoursAgo(30),
    reportType: "morning",
    bedTime: "01:30",
    wakeTime: "05:00",
    sleepQuality: "bad",
    wakeUps: 3,
    feltRested: false,
    mealsCount: null,
    mealsNote: null,
    notes: "Frequent waking overnight.",
  });

  insertDailyReportRecord({
    patientId,
    timestamp: isoHoursAgo(4),
    reportType: "night",
    bedTime: "01:45",
    wakeTime: null,
    sleepQuality: null,
    wakeUps: null,
    feltRested: null,
    mealsCount: 1,
    mealsNote: "Skipped lunch and supper.",
    notes: "Still restless and not hungry.",
  });

  insertObservationRecord({
    patientId,
    timestamp: isoHoursAgo(3),
    observationType: "Clinical",
    observation: "Synthetic support note: worsening routine with poor sleep and reduced meals over the last two days.",
    priority: "High",
    supportWorkerName,
  });
}

function seedMissedMedication(actor: AuthUser) {
  const patientId = "demo-med";
  const supportWorkerName = formatDisplayName(actor);
  const entryId = insertEmotionRecord({
    patientId,
    timestamp: isoHoursAgo(5),
    emotion: "Worried",
    notes: "Missed doses after running out over the weekend.",
    sleepHours: 5.5,
    stressLevel: 6,
    cravingLevel: 1,
    substanceUseToday: false,
    moneyChangedToday: true,
    medicationAdherence: "missed_some",
    missedMedicationName: "Sertraline",
    missedMedicationReason: "ran_out",
    reliabilityLevel: "Medium",
    editCount: 1,
  });

  insertObservationRecord({
    patientId,
    timestamp: isoHoursAgo(2),
    observationType: "Recommendation",
    observation: "Synthetic follow-up: confirm refill access, side effects, and transportation to the pharmacy.",
    priority: "Medium",
    supportWorkerName,
    linkedEntityType: "emotion",
    linkedEntityId: entryId,
  });

  insertRevisionRecord({
    patientId,
    entityType: "emotion",
    entityId: entryId,
    actorUsername: patientId,
    beforeJson: JSON.stringify({
      medicationAdherence: "missed_some",
      missedMedicationName: null,
      missedMedicationReason: null,
    }),
    afterJson: JSON.stringify({
      medicationAdherence: "missed_some",
      missedMedicationName: "Sertraline",
      missedMedicationReason: "ran_out",
    }),
    summary: "Synthetic revision: patient added missed-medication details.",
    suspicious: false,
    timestamp: isoHoursAgo(1),
  });
}

function seedMismatch(actor: AuthUser) {
  const patientId = "demo-mismatch";
  const supportWorkerName = formatDisplayName(actor);

  insertEmotionRecord({
    patientId,
    timestamp: isoHoursAgo(6),
    emotion: "Happy",
    notes: "Feeling okay and not seeing a big issue today.",
    sleepHours: 7,
    stressLevel: 3,
    cravingLevel: 0,
    substanceUseToday: false,
    moneyChangedToday: false,
    medicationAdherence: "took_as_prescribed",
    reliabilityLevel: "Medium",
  });

  insertDailyReportRecord({
    patientId,
    timestamp: isoHoursAgo(4),
    reportType: "night",
    bedTime: "23:30",
    wakeTime: null,
    sleepQuality: null,
    wakeUps: null,
    feltRested: null,
    mealsCount: 1,
    mealsNote: "Skipped most meals while saying things were fine.",
    notes: "Stayed in room most of the day.",
    reliabilityLevel: "Medium",
  });

  insertObservationRecord({
    patientId,
    timestamp: isoHoursAgo(2),
    observationType: "Behavioral",
    observation: "Synthetic support note: appeared withdrawn, declined group activity, and staff observed low food intake despite reassuring self-report.",
    priority: "High",
    supportWorkerName,
  });
}

function seedCriticalAlert(actor: AuthUser) {
  const patientId = "demo-crisis";
  const supportWorkerName = formatDisplayName(actor);
  const timestamp = isoHoursAgo(1);

  const entryId = insertEmotionRecord({
    patientId,
    timestamp,
    emotion: "Sad",
    notes: "I feel like I do not belong on this earth anymore.",
    sleepHours: 2.5,
    stressLevel: 9,
    cravingLevel: 0,
    substanceUseToday: false,
    moneyChangedToday: false,
    medicationAdherence: "missed_some",
    missedMedicationName: "Quetiapine",
    missedMedicationReason: "side_effects",
    reliabilityLevel: "Low",
    crisisLevel: "critical",
    crisisSummary: "Free-text check-in suggests a current need for immediate safety review.",
    editCount: 2,
    suspiciousEditCount: 1,
  });

  insertObservationRecord({
    patientId,
    timestamp,
    observationType: "Alert",
    observation: "Free-text check-in suggests a current need for immediate safety review.",
    priority: "Critical",
    supportWorkerName: SYSTEM_ALERT_AUTHOR,
    linkedEntityType: "emotion",
    linkedEntityId: entryId,
    systemGenerated: true,
    status: "open",
  });

  insertWeeklyScreeningRecord({
    patientId,
    timestamp: isoHoursAgo(12),
    currentThoughts: false,
    thoughtsKillingSelf: true,
    thoughtsKillingSelfFrequency: "most_days",
    depressedHardToFunction: true,
    depressedFrequency: "most_days",
    anxiousOnEdge: true,
    anxiousFrequency: "some_days",
    hopeless: true,
    keepingToSelf: true,
    moreIrritable: false,
    sleepTrouble: true,
    sleepTroubleFrequency: "most_days",
    appetiteChange: true,
    appetiteChangeDirection: "less_than_usual",
    supportPerson: "Aunt Mary",
    reasonsForLiving: "Wants to stay connected to younger siblings.",
    copingPlan: "Call Aunt Mary and leave the apartment.",
    needsHelpStayingSafe: true,
    crisisLevel: "high",
    crisisSummary: "Weekly screen shows current safety concern that needs same-day follow-up.",
    reliabilityLevel: "Low",
  });

  insertRevisionRecord({
    patientId,
    entityType: "emotion",
    entityId: entryId,
    actorUsername: patientId,
    beforeJson: JSON.stringify({
      notes: "I feel awful.",
      crisisLevel: "high",
    }),
    afterJson: JSON.stringify({
      notes: "I feel like I do not belong on this earth anymore.",
      crisisLevel: "critical",
    }),
    summary: "Synthetic revision: language worsened and was flagged as a critical alert.",
    suspicious: true,
    timestamp: isoHoursAgo(0.5),
  });

  insertObservationRecord({
    patientId,
    timestamp: isoHoursAgo(0.25),
    observationType: "Clinical",
    observation: "Synthetic follow-up note: support worker has not yet acknowledged ownership of the critical alert.",
    priority: "High",
    supportWorkerName,
  });
}

export function getDemoModeStatus(): DemoModeStatus {
  const activeScenarioRow = db
    .prepare(`
      SELECT active_scenario_id AS activeScenarioId
      FROM demo_mode_state
      WHERE id = 1
    `)
    .get() as { activeScenarioId?: string | null } | undefined;

  return demoModeStatusSchema.parse({
    enabled: enableDemoSeed,
    syntheticOnly: true,
    activeScenarioId:
      activeScenarioRow?.activeScenarioId == null
        ? null
        : String(activeScenarioRow.activeScenarioId),
    scenarios: demoScenarios.map((scenario) => demoScenarioSchema.parse(scenario)),
  });
}

export async function resetDemoScenario(actor: AuthUser, scenarioId: DemoScenarioId) {
  if (!enableDemoSeed) {
    throw new Error("Synthetic demo mode is disabled in this environment.");
  }

  const scenario = getScenarioById(scenarioId);
  if (!scenario) {
    throw new Error("Demo scenario not found.");
  }

  clearExistingDemoData();

  switch (scenarioId) {
    case "stable-low-risk":
      await createDemoPatient(actor, "demo-stable", "Stable");
      seedStableLowRisk(actor);
      break;
    case "worsening-routine":
      await createDemoPatient(actor, "demo-routine", "Routine");
      seedWorseningRoutine(actor);
      break;
    case "missed-med-details":
      await createDemoPatient(actor, "demo-med", "Medication");
      seedMissedMedication(actor);
      break;
    case "perspective-mismatch":
      await createDemoPatient(actor, "demo-mismatch", "Mismatch");
      seedMismatch(actor);
      break;
    case "critical-crisis-alert":
      await createDemoPatient(actor, "demo-crisis", "Critical");
      seedCriticalAlert(actor);
      break;
    default:
      throw new Error("Unsupported demo scenario.");
  }

  setActiveScenario(scenarioId);
  return getDemoModeStatus();
}
