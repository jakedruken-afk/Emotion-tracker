import {
  getCheckInRichness,
  isMissedMedicationAdherence,
  type MedicationAdherence,
  type MissedMedicationReason,
  pilotMetricsSchema,
  type PilotMetrics,
} from "../shared/contracts";
import { db } from "./db";

type Rate = {
  numerator: number;
  denominator: number;
  percent: number;
};

function toRate(numerator: number, denominator: number): Rate {
  if (denominator === 0) {
    return {
      numerator,
      denominator,
      percent: 0,
    };
  }

  return {
    numerator,
    denominator,
    percent: Number(((numerator / denominator) * 100).toFixed(1)),
  };
}

function getAverageMinutes(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(1));
}

function normalizeMedicationAdherence(value: unknown): MedicationAdherence | null {
  switch (value) {
    case "not_prescribed":
    case "took_as_prescribed":
    case "missed_some":
    case "missed_all":
      return value;
    default:
      return null;
  }
}

function normalizeMissedMedicationReason(value: unknown): MissedMedicationReason | null {
  switch (value) {
    case "forgot":
    case "side_effects":
    case "ran_out":
    case "routine_change":
    case "cost":
    case "other":
      return value;
    default:
      return null;
  }
}

function getAllPatientIds() {
  const rows = db
    .prepare(`
      SELECT username
      FROM users
      WHERE role = 'patient'
    `)
    .all() as Array<{ username?: string }>;

  return rows
    .map((row) => String(row.username ?? ""))
    .filter((value) => value.length > 0);
}

export function buildPilotMetrics(): PilotMetrics {
  const patientIds = getAllPatientIds();
  const patientCount = patientIds.length;

  const consents = db
    .prepare(`
      SELECT
        patient_id AS patientId,
        acknowledge_staffed_hours AS acknowledgeStaffedHours,
        acknowledge_emergency_limits AS acknowledgeEmergencyLimits
      FROM consent_records
    `)
    .all() as Array<{
      patientId?: string;
      acknowledgeStaffedHours?: number;
      acknowledgeEmergencyLimits?: number;
    }>;

  const emotions = db
    .prepare(`
      SELECT
        patient_id AS patientId,
        notes,
        latitude,
        longitude,
        sleep_hours AS sleepHours,
        stress_level AS stressLevel,
        craving_level AS cravingLevel,
        substance_use_today AS substanceUseToday,
        money_changed_today AS moneyChangedToday,
        medication_adherence AS medicationAdherence,
        missed_medication_name AS missedMedicationName,
        missed_medication_reason AS missedMedicationReason,
        edit_count AS editCount,
        suspicious_edit_count AS suspiciousEditCount,
        reliability_level AS reliabilityLevel,
        timestamp
      FROM emotions
    `)
    .all() as Array<Record<string, unknown>>;

  const dailyReports = db
    .prepare(`
      SELECT
        patient_id AS patientId,
        report_type AS reportType,
        bed_time AS bedTime,
        wake_time AS wakeTime,
        sleep_quality AS sleepQuality,
        meals_count AS mealsCount,
        edit_count AS editCount,
        suspicious_edit_count AS suspiciousEditCount,
        reliability_level AS reliabilityLevel,
        timestamp
      FROM daily_reports
    `)
    .all() as Array<Record<string, unknown>>;

  const weeklyScreenings = db
    .prepare(`
      SELECT
        patient_id AS patientId,
        edit_count AS editCount,
        suspicious_edit_count AS suspiciousEditCount,
        reliability_level AS reliabilityLevel,
        timestamp
      FROM weekly_screenings
    `)
    .all() as Array<Record<string, unknown>>;

  const criticalAlerts = db
    .prepare(`
      SELECT
        timestamp,
        acknowledged_at AS acknowledgedAt
      FROM observations
      WHERE priority = 'Critical'
        OR (observation_type = 'Alert' AND priority = 'High')
    `)
    .all() as Array<{ timestamp?: string; acknowledgedAt?: string | null }>;

  const patientIdsWithEmotion = new Set(
    emotions.map((row) => String(row.patientId ?? "")).filter(Boolean),
  );
  const patientIdsWithDailyReport = new Set(
    dailyReports.map((row) => String(row.patientId ?? "")).filter(Boolean),
  );
  const patientIdsWithWeeklyScreen = new Set(
    weeklyScreenings.map((row) => String(row.patientId ?? "")).filter(Boolean),
  );

  const patientIdsWithConsistentData = new Set<string>();
  for (const patientId of patientIds) {
    const days = new Set<string>();

    for (const row of emotions) {
      if (String(row.patientId ?? "") !== patientId || row.timestamp == null) {
        continue;
      }
      days.add(String(row.timestamp).slice(0, 10));
    }

    for (const row of dailyReports) {
      if (String(row.patientId ?? "") !== patientId || row.timestamp == null) {
        continue;
      }
      days.add(String(row.timestamp).slice(0, 10));
    }

    for (const row of weeklyScreenings) {
      if (String(row.patientId ?? "") !== patientId || row.timestamp == null) {
        continue;
      }
      days.add(String(row.timestamp).slice(0, 10));
    }

    if (days.size >= 3) {
      patientIdsWithConsistentData.add(patientId);
    }
  }

  const clinicallyUsableEntries =
    emotions.filter((row) => {
      const richness = getCheckInRichness({
        notes: row.notes == null ? null : String(row.notes),
        latitude: row.latitude == null ? null : Number(row.latitude),
        longitude: row.longitude == null ? null : Number(row.longitude),
        sleepHours: row.sleepHours == null ? null : Number(row.sleepHours),
        stressLevel: row.stressLevel == null ? null : Number(row.stressLevel),
        cravingLevel: row.cravingLevel == null ? null : Number(row.cravingLevel),
        substanceUseToday:
          row.substanceUseToday == null ? null : Boolean(row.substanceUseToday),
        moneyChangedToday:
          row.moneyChangedToday == null ? null : Boolean(row.moneyChangedToday),
        medicationAdherence: normalizeMedicationAdherence(row.medicationAdherence),
        missedMedicationName:
          row.missedMedicationName == null ? null : String(row.missedMedicationName),
        missedMedicationReason: normalizeMissedMedicationReason(row.missedMedicationReason),
      });

      return richness === "Structured" || richness === "Corroborated";
    }).length +
    dailyReports.filter((row) => {
      if (String(row.reportType) === "night") {
        return row.bedTime != null && row.mealsCount != null;
      }

      return row.bedTime != null && row.wakeTime != null && row.sleepQuality != null;
    }).length +
    weeklyScreenings.length;

  const totalEntries = emotions.length + dailyReports.length + weeklyScreenings.length;
  const editedEntries =
    emotions.filter((row) => Number(row.editCount ?? 0) > 0).length +
    dailyReports.filter((row) => Number(row.editCount ?? 0) > 0).length +
    weeklyScreenings.filter((row) => Number(row.editCount ?? 0) > 0).length;
  const suspiciousEntries =
    emotions.filter((row) => Number(row.suspiciousEditCount ?? 0) > 0).length +
    dailyReports.filter((row) => Number(row.suspiciousEditCount ?? 0) > 0).length +
    weeklyScreenings.filter((row) => Number(row.suspiciousEditCount ?? 0) > 0).length;
  const flaggedReliabilityEntries =
    emotions.filter((row) => String(row.reliabilityLevel ?? "High") !== "High").length +
    dailyReports.filter((row) => String(row.reliabilityLevel ?? "High") !== "High").length +
    weeklyScreenings.filter((row) => String(row.reliabilityLevel ?? "High") !== "High").length;

  const missedMedicationEntries = emotions.filter((row) =>
    isMissedMedicationAdherence(normalizeMedicationAdherence(row.medicationAdherence)),
  );
  const missedMedicationDetailEntries = missedMedicationEntries.filter(
    (row) =>
      String(row.missedMedicationName ?? "").trim().length > 0 &&
      String(row.missedMedicationReason ?? "").trim().length > 0,
  );

  const nightReports = dailyReports.filter((row) => String(row.reportType ?? "") === "night");
  const nightReportsWithMeals = nightReports.filter((row) => row.mealsCount != null);

  const acknowledgedCriticalAlerts = criticalAlerts.filter((row) => row.acknowledgedAt != null);
  const acknowledgementMinutes = acknowledgedCriticalAlerts
    .map((row) => {
      const start = row.timestamp ? new Date(String(row.timestamp)).getTime() : Number.NaN;
      const end = row.acknowledgedAt
        ? new Date(String(row.acknowledgedAt)).getTime()
        : Number.NaN;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        return null;
      }

      return (end - start) / 60000;
    })
    .filter((value): value is number => value != null);
  const acknowledgedWithinSla = acknowledgementMinutes.filter((value) => value <= 15).length;

  const metrics = pilotMetricsSchema.parse({
    activationRate: toRate(consents.length, patientCount),
    consentComprehensionRate: toRate(
      consents.filter(
        (row) =>
          Boolean(row.acknowledgeStaffedHours) && Boolean(row.acknowledgeEmergencyLimits),
      ).length,
      patientCount,
    ),
    dailyCheckInCompletionRate: toRate(patientIdsWithEmotion.size, patientCount),
    dailyReportCompletionRate: toRate(patientIdsWithDailyReport.size, patientCount),
    weeklyScreenCompletionRate: toRate(patientIdsWithWeeklyScreen.size, patientCount),
    clinicallyUsableEntryRate: toRate(clinicallyUsableEntries, totalEntries),
    editRate: toRate(editedEntries, totalEntries),
    suspiciousEditRate: toRate(suspiciousEntries, totalEntries),
    reliabilityFlagRate: toRate(flaggedReliabilityEntries, totalEntries),
    missedMedicationDetailCaptureRate: toRate(
      missedMedicationDetailEntries.length,
      missedMedicationEntries.length,
    ),
    mealsCompletenessRate: toRate(nightReportsWithMeals.length, nightReports.length),
    consistencyRate: toRate(patientIdsWithConsistentData.size, patientCount),
    criticalAlertAcknowledgementRate: toRate(
      acknowledgedCriticalAlerts.length,
      criticalAlerts.length,
    ),
    criticalAlertSlaRate: toRate(acknowledgedWithinSla, criticalAlerts.length),
    averageCriticalAlertAcknowledgementMinutes: getAverageMinutes(acknowledgementMinutes),
    averageSubmissionToReviewMinutes: getAverageMinutes(acknowledgementMinutes),
    lastUpdatedAt: new Date().toISOString(),
  });

  return metrics;
}
