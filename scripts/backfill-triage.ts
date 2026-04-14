import { DatabaseSync } from "node:sqlite";
import { databasePath } from "../server/config";
import {
  SYSTEM_ALERT_AUTHOR,
  evaluatePatientTextForCrisis,
} from "../server/clinicalMonitoring";

const db = new DatabaseSync(databasePath);

type CrisisLevel = "none" | "high" | "critical";

function upsertAlert(patientId: string, level: CrisisLevel, summary: string | null) {
  if (level === "none" || !summary) {
    return false;
  }

  const existing = db
    .prepare(
      `
        SELECT id
        FROM observations
        WHERE patient_id = ?
          AND observation_type = 'Alert'
          AND support_worker_name = ?
          AND observation = ?
        LIMIT 1
      `,
    )
    .get(patientId, SYSTEM_ALERT_AUTHOR, summary) as { id?: number } | undefined;

  if (existing?.id) {
    return false;
  }

  db.prepare(
    `
      INSERT INTO observations (
        patient_id,
        observation_type,
        observation,
        priority,
        support_worker_name,
        timestamp
      )
      VALUES (?, 'Alert', ?, ?, ?, CURRENT_TIMESTAMP)
    `,
  ).run(patientId, summary, level === "critical" ? "Critical" : "High", SYSTEM_ALERT_AUTHOR);

  return true;
}

function backfillEmotions() {
  const rows = db
    .prepare(
      `
        SELECT
          id,
          patient_id AS patientId,
          notes,
          missed_medication_name AS missedMedicationName,
          crisis_level AS crisisLevel,
          crisis_summary AS crisisSummary
        FROM emotions
      `,
    )
    .all() as Array<{
    id: number;
    patientId: string;
    notes: string | null;
    missedMedicationName: string | null;
    crisisLevel: CrisisLevel;
    crisisSummary: string | null;
  }>;

  let updated = 0;
  let alerts = 0;

  for (const row of rows) {
    const evaluation = evaluatePatientTextForCrisis([row.notes, row.missedMedicationName]);
    if (evaluation.level !== row.crisisLevel || evaluation.summary !== row.crisisSummary) {
      db.prepare(
        `
          UPDATE emotions
          SET crisis_level = ?, crisis_summary = ?
          WHERE id = ?
        `,
      ).run(evaluation.level, evaluation.summary, row.id);
      updated += 1;
    }

    if (row.crisisLevel === "none" && upsertAlert(row.patientId, evaluation.level, evaluation.summary)) {
      alerts += 1;
    }
  }

  return { updated, alerts };
}

function backfillDailyReports() {
  const rows = db
    .prepare(
      `
        SELECT
          id,
          patient_id AS patientId,
          notes,
          meals_note AS mealsNote,
          crisis_level AS crisisLevel,
          crisis_summary AS crisisSummary
        FROM daily_reports
      `,
    )
    .all() as Array<{
    id: number;
    patientId: string;
    notes: string | null;
    mealsNote: string | null;
    crisisLevel: CrisisLevel;
    crisisSummary: string | null;
  }>;

  let updated = 0;
  let alerts = 0;

  for (const row of rows) {
    const evaluation = evaluatePatientTextForCrisis([row.notes, row.mealsNote]);
    if (evaluation.level !== row.crisisLevel || evaluation.summary !== row.crisisSummary) {
      db.prepare(
        `
          UPDATE daily_reports
          SET crisis_level = ?, crisis_summary = ?
          WHERE id = ?
        `,
      ).run(evaluation.level, evaluation.summary, row.id);
      updated += 1;
    }

    if (row.crisisLevel === "none" && upsertAlert(row.patientId, evaluation.level, evaluation.summary)) {
      alerts += 1;
    }
  }

  return { updated, alerts };
}

function backfillWeeklyScreenings() {
  const rows = db
    .prepare(
      `
        SELECT
          id,
          patient_id AS patientId,
          support_person AS supportPerson,
          reasons_for_living AS reasonsForLiving,
          coping_plan AS copingPlan,
          current_thoughts AS currentThoughts,
          crisis_level AS crisisLevel,
          crisis_summary AS crisisSummary
        FROM weekly_screenings
      `,
    )
    .all() as Array<{
    id: number;
    patientId: string;
    supportPerson: string | null;
    reasonsForLiving: string | null;
    copingPlan: string | null;
    currentThoughts: number | null;
    crisisLevel: CrisisLevel;
    crisisSummary: string | null;
  }>;

  let updated = 0;
  let alerts = 0;

  for (const row of rows) {
    const textEvaluation = evaluatePatientTextForCrisis([
      row.supportPerson,
      row.reasonsForLiving,
      row.copingPlan,
    ]);
    const level: CrisisLevel =
      row.currentThoughts === 1 ? "critical" : textEvaluation.level;
    const summary =
      row.currentThoughts === 1
        ? "Weekly safety screen shows a current need for immediate safety support."
        : textEvaluation.summary;

    if (level !== row.crisisLevel || summary !== row.crisisSummary) {
      db.prepare(
        `
          UPDATE weekly_screenings
          SET crisis_level = ?, crisis_summary = ?
          WHERE id = ?
        `,
      ).run(level, summary, row.id);
      updated += 1;
    }

    if (row.crisisLevel === "none" && upsertAlert(row.patientId, level, summary)) {
      alerts += 1;
    }
  }

  return { updated, alerts };
}

const emotionResult = backfillEmotions();
const dailyReportResult = backfillDailyReports();
const weeklyScreeningResult = backfillWeeklyScreenings();

console.log(
  JSON.stringify(
    {
      databasePath,
      emotions: emotionResult,
      dailyReports: dailyReportResult,
      weeklyScreenings: weeklyScreeningResult,
    },
    null,
    2,
  ),
);
