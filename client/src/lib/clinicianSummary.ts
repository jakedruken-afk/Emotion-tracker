import { format } from "date-fns";
import type {
  DailyReportRecord,
  EmotionLog,
  ObservationRecord,
  WeeklyScreeningRecord,
} from "@shared/contracts";
import {
  getLatestWeeklyScreening,
  getWeeklyScreeningDisposition,
  getWeeklyScreeningDispositionLabel,
  getWeeklyScreeningSignals,
} from "@shared/weeklyScreening";
import { buildWeeklyPatientReview } from "./riskReview";

export type TrendPoint = {
  label: string;
  sleep: number | null;
  stress: number | null;
  cravings: number | null;
};

export function buildTrendPoints(logs: EmotionLog[], limit = 7): TrendPoint[] {
  return [...logs]
    .slice(0, limit)
    .reverse()
    .map((log) => ({
      label: format(new Date(log.timestamp), "MMM d"),
      sleep: log.sleepHours,
      stress: log.stressLevel,
      cravings: log.cravingLevel,
    }));
}

export function getReviewSignals(
  logs: EmotionLog[],
  dailyReports: DailyReportRecord[] = [],
  screenings: WeeklyScreeningRecord[] = [],
  observations: ObservationRecord[] = [],
) {
  const signals = new Set<string>();

  for (const log of logs) {
    if ((log.sleepHours ?? 24) <= 4 && (log.stressLevel ?? 0) >= 7) {
      signals.add("Short sleep and high stress are showing up together.");
    }

    if ((log.cravingLevel ?? 0) >= 7 && log.substanceUseToday) {
      signals.add("High cravings and substance use were reported on the same day.");
    }

    if (
      log.medicationAdherence === "missed_some" ||
      log.medicationAdherence === "missed_all"
    ) {
      signals.add("Recent check-ins include missed medication.");
    }
  }

  const lowMealReports = dailyReports.filter(
    (report) => report.reportType === "night" && (report.mealsCount ?? 99) <= 1,
  );
  const poorSleepReports = dailyReports.filter(
    (report) =>
      report.reportType === "morning" &&
      (report.sleepQuality === "very_bad" || report.sleepQuality === "bad"),
  );

  if (poorSleepReports.length >= 2) {
    signals.add("Poor sleep quality repeated across recent mornings.");
  }

  if (lowMealReports.length >= 1) {
    signals.add("Meals dropped to one or fewer in a recent night report.");
  }

  const latestScreening = getLatestWeeklyScreening(screenings);
  if (latestScreening) {
    const disposition = getWeeklyScreeningDisposition(latestScreening);

    for (const signal of getWeeklyScreeningSignals(latestScreening)) {
      signals.add(signal);
    }

    if (disposition === "urgent") {
      signals.add("Latest weekly safety screen needs immediate review.");
    } else if (disposition === "positive") {
      signals.add("Latest weekly safety screen shows follow-up needs.");
    }
  }

  if (observations.some((observation) => observation.priority === "Critical")) {
    signals.add("A recent support or system alert is marked Critical.");
  } else if (
    observations.some(
      (observation) =>
        observation.priority === "High" || observation.priority === "Urgent",
    )
  ) {
    signals.add("Recent support notes describe elevated concern.");
  }

  return Array.from(signals);
}

export function buildClinicianSummary(
  patientId: string,
  logs: EmotionLog[],
  dailyReports: DailyReportRecord[] = [],
  screenings: WeeklyScreeningRecord[] = [],
  observations: ObservationRecord[] = [],
) {
  if (
    logs.length === 0 &&
    dailyReports.length === 0 &&
    screenings.length === 0 &&
    observations.length === 0
  ) {
    return [
      "CLINICAL SUMMARY NOTE",
      `Patient: ${patientId}`,
      "Risk: Unknown",
      "What is happening: No patient data is on file.",
      "Why it matters: There is no recent clinical signal to compare.",
      "What to do: Collect a current check-in, sleep report, and weekly safety screen.",
    ].join("\n");
  }

  const weeklyReview = buildWeeklyPatientReview(
    patientId,
    logs,
    dailyReports,
    screenings,
    observations,
  );
  const latestScreening = getLatestWeeklyScreening(screenings);
  const latestObservation = observations[0] ?? null;
  const screeningText = latestScreening
    ? `${getWeeklyScreeningDispositionLabel(
        getWeeklyScreeningDisposition(latestScreening),
      )} on ${format(new Date(latestScreening.timestamp), "MMM d")}.`
    : "No weekly safety screen is on file.";
  const observationText = latestObservation
    ? `${latestObservation.priority} ${latestObservation.observationType.toLowerCase()} note on ${format(
        new Date(latestObservation.timestamp),
        "MMM d",
      )}.`
    : "No recent support note is on file.";

  return [
    "CLINICAL SUMMARY NOTE",
    `Patient: ${patientId}`,
    `Risk: ${weeklyReview.risk.riskLevel}${
      weeklyReview.risk.crisisSummary ? ` | ${weeklyReview.risk.crisisSummary}` : ""
    }`,
    `What is happening: ${
      weeklyReview.keyChanges.length > 0
        ? weeklyReview.keyChanges.join("; ")
        : "No major change signal was detected."
    }`,
    `Why it matters: ${
      weeklyReview.risk.reasons.length > 0
        ? weeklyReview.risk.reasons.join("; ")
        : "No major review reason was detected."
    }`,
    `What to do: ${weeklyReview.suggestedActions.join(" ")}`,
    `Reliability: ${weeklyReview.risk.reliabilityLevel}. ${weeklyReview.risk.reliabilitySummary}${
      weeklyReview.risk.mismatchSummary ? ` ${weeklyReview.risk.mismatchSummary}` : ""
    }`,
    `Latest weekly screen: ${screeningText}`,
    `Latest support input: ${observationText}`,
  ].join("\n");
}
