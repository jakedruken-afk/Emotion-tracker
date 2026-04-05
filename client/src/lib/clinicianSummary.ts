import { format } from "date-fns";
import {
  type DailyReportRecord,
  getCheckInRichness,
  getEmotionFlags,
  medicationAdherenceLabels,
  type EmotionLog,
  type WeeklyScreeningRecord,
} from "@shared/contracts";
import {
  getLatestWeeklyScreening,
  getWeeklyScreeningDisposition,
  getWeeklyScreeningDispositionLabel,
  getWeeklyScreeningPositiveCount,
  getWeeklyScreeningSignals,
} from "@shared/weeklyScreening";
import {
  getAverageSleepDuration,
  getAverageSleepQuality,
  getAverageWakeUps,
} from "./dailyReports";

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
) {
  const signals = new Set<string>();

  for (const log of logs) {
    const richness = getCheckInRichness(log);
    const flags = getEmotionFlags(log);

    if (flags.includes("low sleep") && flags.includes("high stress")) {
      signals.add("Repeated low sleep with high stress");
    }

    if (flags.includes("high craving") && flags.includes("reported substance use")) {
      signals.add("High cravings and self-reported substance use on the same day");
    }

    if (flags.includes("money change with high craving")) {
      signals.add("Money-change days line up with stronger cravings");
    }

    if (richness === "Basic" && (log.stressLevel ?? 0) >= 8) {
      signals.add("High-distress entries sometimes arrive with limited detail");
    }

    if (log.medicationAdherence === "missed_all") {
      signals.add("At least one day with all medication missed");
    }
  }

  const poorSleepReports = dailyReports.filter(
    (report) =>
      report.reportType === "morning" &&
      (report.sleepQuality === "very_bad" || report.sleepQuality === "bad"),
  );
  const frequentWakeUpReports = dailyReports.filter(
    (report) => report.reportType === "morning" && (report.wakeUps ?? 0) >= 3,
  );

  if (poorSleepReports.length >= 2) {
    signals.add("Recent morning reports show poor sleep");
  }

  if (frequentWakeUpReports.length >= 1) {
    signals.add("Morning reports show multiple wake-ups overnight");
  }

  const latestScreening = getLatestWeeklyScreening(screenings);
  if (latestScreening) {
    for (const signal of getWeeklyScreeningSignals(latestScreening)) {
      signals.add(signal);
    }

    const disposition = getWeeklyScreeningDisposition(latestScreening);
    if (disposition === "urgent") {
      signals.add("Latest weekly safety screen requires urgent review");
    } else if (disposition === "positive") {
      signals.add("Latest weekly safety screen was positive");
    }
  }

  return Array.from(signals);
}

export function buildClinicianSummary(
  patientId: string,
  logs: EmotionLog[],
  dailyReports: DailyReportRecord[] = [],
  screenings: WeeklyScreeningRecord[] = [],
) {
  if (logs.length === 0 && dailyReports.length === 0 && screenings.length === 0) {
    return `No entries have been recorded yet for ${patientId}.`;
  }

  const last7 = logs.slice(0, 7);
  const lastEntry = last7[0];
  const averageSleep = getAverage(last7.map((log) => log.sleepHours).filter(isNumber));
  const averageStress = getAverage(last7.map((log) => log.stressLevel).filter(isNumber));
  const averageCravings = getAverage(last7.map((log) => log.cravingLevel).filter(isNumber));
  const substanceUseDays = last7.filter((log) => log.substanceUseToday).length;
  const moneyChangeDays = last7.filter((log) => log.moneyChangedToday).length;
  const gpsDays = last7.filter((log) => log.latitude != null && log.longitude != null).length;
  const richnessCounts = countBy(last7.map((log) => getCheckInRichness(log)));
  const commonFlags = topFlags(last7);
  const recentMorningReports = dailyReports
    .filter((report) => report.reportType === "morning")
    .slice(0, 7);
  const lastMorningReport = recentMorningReports[0];
  const averageSleepDuration = getAverageSleepDuration(recentMorningReports);
  const averageWakeUps = getAverageWakeUps(recentMorningReports);
  const averageSleepQuality = getAverageSleepQuality(recentMorningReports);
  const latestScreening = getLatestWeeklyScreening(screenings);

  const parts = [`Patient ${patientId} has ${logs.length} total mood check-ins.`];

  if (last7.length > 0 && lastEntry) {
    parts.push(
      `In the last ${last7.length} entries, average sleep was ${formatAverage(averageSleep, "hours")}, average stress was ${formatAverage(averageStress, "/10")}, and average cravings were ${formatAverage(averageCravings, "/10")}.`,
    );
    parts.push(
      `${substanceUseDays} of the last ${last7.length} entries reported substance use, ${moneyChangeDays} reported a big money change, and ${gpsDays} included GPS.`,
    );
    parts.push(
      `Most recent check-in: ${lastEntry.emotion} on ${format(new Date(lastEntry.timestamp), "MMM d, yyyy 'at' h:mm a")}. Medication status: ${
        lastEntry.medicationAdherence
          ? medicationAdherenceLabels[lastEntry.medicationAdherence]
          : "Not recorded"
      }.`,
    );
  } else {
    parts.push("No mood check-ins have been recorded yet.");
  }

  if (recentMorningReports.length > 0 && lastMorningReport) {
    parts.push(
      `There are ${dailyReports.length} total morning and night sleep reports. Over the last ${recentMorningReports.length} morning reports, average sleep duration was ${formatAverage(averageSleepDuration, " hours")}, average sleep quality was ${averageSleepQuality ?? "not available"}, and average wake-ups were ${formatAverage(averageWakeUps, " per night")}.`,
    );
    parts.push(
      `Most recent morning report was recorded on ${format(new Date(lastMorningReport.timestamp), "MMM d, yyyy 'at' h:mm a")}.`,
    );
  }

  if (latestScreening) {
    const disposition = getWeeklyScreeningDisposition(latestScreening);
    const positiveCount = getWeeklyScreeningPositiveCount(latestScreening);
    const screeningSignals = getWeeklyScreeningSignals(latestScreening).slice(0, 4);

    parts.push(
      `Most recent weekly safety screen was completed on ${format(new Date(latestScreening.timestamp), "MMM d, yyyy 'at' h:mm a")} and was classified as ${getWeeklyScreeningDispositionLabel(disposition).toLowerCase()}. ${positiveCount} symptom or safety items were marked.`,
    );

    if (screeningSignals.length > 0) {
      parts.push(`Screening follow-up points: ${screeningSignals.join(", ")}.`);
    }
  } else {
    parts.push("No weekly safety screen has been completed yet.");
  }

  if (commonFlags.length > 0) {
    parts.push(`Top follow-up themes: ${commonFlags.join(", ")}.`);
  }

  if (last7.length > 0) {
    parts.push(
      `Data richness over the last ${last7.length} entries: ${
        richnessCounts.Corroborated ?? 0
      } corroborated, ${richnessCounts.Structured ?? 0} structured, ${richnessCounts.Basic ?? 0} basic.`,
    );
  }

  return parts.join(" ");
}

function topFlags(logs: EmotionLog[]) {
  const counts = new Map<string, number>();

  for (const log of logs) {
    for (const flag of getEmotionFlags(log)) {
      counts.set(flag, (counts.get(flag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([flag]) => flag);
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}

function isNumber(value: number | null): value is number {
  return value != null;
}

function getAverage(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function formatAverage(value: number | null, suffix: string) {
  return value == null ? "not available" : `${value.toFixed(1)}${suffix}`;
}
