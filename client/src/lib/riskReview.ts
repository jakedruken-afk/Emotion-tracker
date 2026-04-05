import { format } from "date-fns";
import {
  type DailyReportRecord,
  type EmotionLog,
  type EmotionName,
  type WeeklyScreeningRecord,
} from "@shared/contracts";
import {
  getLatestWeeklyScreening,
  getWeeklyScreeningDisposition,
  getWeeklyScreeningSignals,
} from "@shared/weeklyScreening";
import {
  getAverageSleepDuration,
  getAverageSleepQuality,
  getAverageWakeUps,
} from "./dailyReports";

export type RiskLevel = "Low" | "Medium" | "High" | "Urgent";

export type PatientRiskSnapshot = {
  patientId: string;
  score: number;
  riskLevel: RiskLevel;
  dominantEmotion: EmotionName | null;
  lastSeenAt: string | null;
  reasons: string[];
  suggestedActions: string[];
  summary: string;
};

export type WeeklyPatientReview = {
  patientId: string;
  risk: PatientRiskSnapshot;
  keyChanges: string[];
  suggestedActions: string[];
  dataGaps: string[];
  plainText: string;
};

export function buildPatientRiskSnapshots(
  logs: EmotionLog[],
  dailyReports: DailyReportRecord[],
  screenings: WeeklyScreeningRecord[] = [],
) {
  const patientIds = Array.from(
    new Set([
      ...logs.map((log) => log.patientId),
      ...dailyReports.map((report) => report.patientId),
      ...screenings.map((screening) => screening.patientId),
    ]),
  );

  return patientIds
    .map((patientId) =>
      buildPatientRiskSnapshot(
        patientId,
        logs.filter((log) => log.patientId === patientId),
        dailyReports.filter((report) => report.patientId === patientId),
        screenings.filter((screening) => screening.patientId === patientId),
      ),
    )
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return toTimestamp(right.lastSeenAt) - toTimestamp(left.lastSeenAt);
    });
}

export function buildPatientRiskSnapshot(
  patientId: string,
  logs: EmotionLog[],
  dailyReports: DailyReportRecord[],
  screenings: WeeklyScreeningRecord[] = [],
): PatientRiskSnapshot {
  const recentLogs = takeRecent(logs, 7);
  const recentMorningReports = takeRecent(
    dailyReports.filter((report) => report.reportType === "morning"),
    7,
  );
  const recentNightReports = takeRecent(
    dailyReports.filter((report) => report.reportType === "night"),
    7,
  );
  const reasons: string[] = [];
  const suggestedActions: string[] = [];
  let score = 0;

  const latestScreening = getLatestWeeklyScreening(screenings);
  const lastSeenAt = getLastSeenAt(logs, dailyReports, screenings);
  const lastLog = recentLogs[0];
  const dominantEmotion = getDominantEmotion(recentLogs);

  if (lastSeenAt == null) {
    reasons.push("No patient data recorded yet");
    suggestedActions.push("Confirm whether the patient has been onboarded and trained on check-ins.");
    return finalizeRisk(patientId, score, dominantEmotion, lastSeenAt, reasons, suggestedActions);
  }

  const daysSinceLastSeen = getDaysSince(lastSeenAt);
  if (daysSinceLastSeen >= 3) {
    score += 2;
    reasons.push(`No new patient entry for ${daysSinceLastSeen} days`);
    suggestedActions.push("Check engagement and confirm whether outreach is needed.");
  }

  if (lastLog && (lastLog.emotion === "Worried" || lastLog.emotion === "Angry")) {
    score += 2;
    reasons.push(`Most recent mood was ${lastLog.emotion.toLowerCase()}`);
  }

  if (recentLogs.some((log) => (log.sleepHours ?? 24) <= 4)) {
    score += 2;
    reasons.push("Very low sleep was reported");
    suggestedActions.push("Review sleep disruption and what happened before the low-sleep days.");
  }

  if (recentLogs.filter((log) => (log.stressLevel ?? 0) >= 8).length >= 2) {
    score += 2;
    reasons.push("High stress repeated across recent check-ins");
  }

  if (recentLogs.some((log) => (log.cravingLevel ?? 0) >= 8)) {
    score += 2;
    reasons.push("Strong cravings were reported");
    suggestedActions.push("Ask about triggers, substance access, and current coping supports.");
  }

  if (recentLogs.some((log) => log.substanceUseToday)) {
    score += 3;
    reasons.push("Recent substance use was self-reported");
    suggestedActions.push("Review immediate risks, withdrawal concerns, and same-day support options.");
  }

  if (recentLogs.some((log) => log.medicationAdherence === "missed_all")) {
    score += 2;
    reasons.push("At least one day with all medication missed");
    suggestedActions.push("Check medication access, side effects, and whether a refill or follow-up is needed.");
  } else if (recentLogs.some((log) => log.medicationAdherence === "missed_some")) {
    score += 1;
    reasons.push("Medication doses were missed");
  }

  if (
    recentLogs.some(
      (log) => log.moneyChangedToday && (log.cravingLevel ?? 0) >= 7,
    )
  ) {
    score += 1;
    reasons.push("Big money-change days lined up with higher cravings");
  }

  if (
    recentMorningReports.some(
      (report) => report.sleepQuality === "bad" || report.sleepQuality === "very_bad",
    )
  ) {
    score += 2;
    reasons.push("Morning reports show poor sleep quality");
  }

  if (recentMorningReports.some((report) => (report.wakeUps ?? 0) >= 3)) {
    score += 1;
    reasons.push("Multiple overnight wake-ups were reported");
  }

  if (recentMorningReports.some((report) => report.feltRested === false)) {
    score += 1;
    reasons.push("Morning reports say the patient did not feel rested");
  }

  if (recentMorningReports.length === 0) {
    score += 1;
    reasons.push("No morning sleep report was saved this week");
    suggestedActions.push("Encourage the patient to use the morning report so sleep patterns are easier to follow.");
  }

  if (recentNightReports.length === 0) {
    score += 1;
    reasons.push("No night report was saved this week");
  }

  if (
    recentLogs.some((log) => (log.cravingLevel ?? 0) >= 8) &&
    recentLogs.some((log) => log.substanceUseToday) &&
    recentMorningReports.some((report) => report.sleepQuality === "very_bad")
  ) {
    score += 2;
    reasons.push("Cravings, substance use, and very poor sleep all appeared in the same week");
    suggestedActions.push("Consider same-day review or rapid follow-up if the patient is deteriorating.");
  }

  if (latestScreening) {
    const screeningDisposition = getWeeklyScreeningDisposition(latestScreening);

    if (screeningDisposition === "urgent") {
      score += 8;
      reasons.push("Latest weekly safety screen reported current suicidal thoughts");
      suggestedActions.push("Treat as urgent safety concern and arrange immediate mental health evaluation.");
    } else if (screeningDisposition === "positive") {
      score += 4;
      reasons.push("Latest weekly safety screen was positive");
      suggestedActions.push("Complete a same-day brief suicide safety assessment and update the safety plan.");
    } else if (screeningDisposition === "history") {
      score += 2;
      reasons.push("Past suicide attempt history was reported on the weekly screen");
      suggestedActions.push("Review past suicide attempt history and confirm supports and means safety.");
    }

    for (const signal of getWeeklyScreeningSignals(latestScreening).slice(0, 3)) {
      reasons.push(signal);
    }
  } else {
    score += 1;
    reasons.push("No weekly safety screen has been completed yet");
    suggestedActions.push("Ask the patient to complete the weekly safety screen.");
  }

  return finalizeRisk(patientId, score, dominantEmotion, lastSeenAt, reasons, suggestedActions);
}

export function buildWeeklyPatientReview(
  patientId: string,
  logs: EmotionLog[],
  dailyReports: DailyReportRecord[],
  screenings: WeeklyScreeningRecord[] = [],
): WeeklyPatientReview {
  const recentLogs = takeRecent(logs, 7);
  const recentReports = takeRecent(dailyReports, 7);
  const recentScreenings = takeRecent(screenings, 7);
  const recentMorningReports = recentReports.filter((report) => report.reportType === "morning");
  const risk = buildPatientRiskSnapshot(patientId, logs, dailyReports, screenings);
  const averageStress = average(
    recentLogs.map((log) => log.stressLevel).filter(isNumber),
  );
  const averageCravings = average(
    recentLogs.map((log) => log.cravingLevel).filter(isNumber),
  );
  const averageSleepDuration = getAverageSleepDuration(recentMorningReports);
  const averageWakeUps = getAverageWakeUps(recentMorningReports);
  const averageSleepQuality = getAverageSleepQuality(recentMorningReports);
  const substanceUseDays = recentLogs.filter((log) => log.substanceUseToday).length;
  const keyChanges: string[] = [];
  const dataGaps: string[] = [];

  if (recentLogs.length === 0) {
    dataGaps.push("No mood check-ins were recorded in the last week.");
  } else {
    keyChanges.push(
      `${recentLogs.length} mood check-ins were recorded this week, with ${risk.dominantEmotion?.toLowerCase() ?? "no clear"} mood pattern showing most often.`,
    );
  }

  if (averageStress != null) {
    keyChanges.push(`Average stress was ${averageStress.toFixed(1)}/10.`);
  }

  if (averageCravings != null) {
    keyChanges.push(`Average cravings were ${averageCravings.toFixed(1)}/10.`);
  }

  if (substanceUseDays > 0) {
    keyChanges.push(`${substanceUseDays} recent check-in(s) reported substance use.`);
  }

  if (averageSleepDuration != null) {
    keyChanges.push(`Average sleep from morning reports was ${averageSleepDuration.toFixed(1)} hours.`);
  } else if (recentMorningReports.length === 0) {
    dataGaps.push("No morning sleep reports were saved this week.");
  }

  if (averageSleepQuality != null) {
    keyChanges.push(`Average sleep quality was ${averageSleepQuality.toLowerCase()}.`);
  }

  if (averageWakeUps != null && averageWakeUps >= 2) {
    keyChanges.push(`Average overnight wake-ups were ${averageWakeUps.toFixed(1)} per night.`);
  }

  if (recentReports.length === 0) {
    dataGaps.push("No daily sleep reports were saved this week.");
  }

  if (recentScreenings.length === 0) {
    dataGaps.push("No weekly safety screen was completed in the last week.");
  } else {
    const latestScreening = recentScreenings[0];
    const screeningDisposition = getWeeklyScreeningDisposition(latestScreening);
    keyChanges.push(
      `Latest weekly safety screen was ${screeningDisposition.replace("_", " ")} on ${format(new Date(latestScreening.timestamp), "MMM d")}.`,
    );
  }

  if (recentLogs.length > 0 && recentLogs.every((log) => (log.notes ?? "").trim().length < 10)) {
    dataGaps.push("Recent mood entries have very little note detail.");
  }

  if (!recentLogs.some((log) => log.latitude != null && log.longitude != null)) {
    dataGaps.push("No GPS-supported mood entry was recorded this week.");
  }

  const plainTextSections = [
    `Weekly review for ${patientId}`,
    `Risk level: ${risk.riskLevel} (score ${risk.score}).`,
    `Why flagged: ${risk.reasons.length > 0 ? risk.reasons.join("; ") : "No major review signal was detected."}`,
    `Key changes: ${keyChanges.length > 0 ? keyChanges.join(" ") : "No strong pattern change could be summarized from this week's data."}`,
    `Suggested actions: ${risk.suggestedActions.length > 0 ? risk.suggestedActions.join(" ") : "Continue routine monitoring and document any clinical concern."}`,
    `Data gaps: ${dataGaps.length > 0 ? dataGaps.join(" ") : "No major data gap was detected this week."}`,
  ];

  return {
    patientId,
    risk,
    keyChanges,
    suggestedActions: risk.suggestedActions,
    dataGaps,
    plainText: plainTextSections.join("\n\n"),
  };
}

function finalizeRisk(
  patientId: string,
  score: number,
  dominantEmotion: EmotionName | null,
  lastSeenAt: string | null,
  reasons: string[],
  suggestedActions: string[],
): PatientRiskSnapshot {
  const dedupedReasons = dedupe(reasons).slice(0, 4);
  const dedupedActions = dedupe(suggestedActions).slice(0, 4);
  const riskLevel = getRiskLevel(score, dedupedReasons);

  return {
    patientId,
    score,
    riskLevel,
    dominantEmotion,
    lastSeenAt,
    reasons: dedupedReasons,
    suggestedActions: dedupedActions,
    summary: buildRiskSummary(patientId, riskLevel, dedupedReasons, lastSeenAt),
  };
}

function getRiskLevel(score: number, reasons: string[]): RiskLevel {
  const hasSevereCompoundRisk = reasons.some((reason) =>
    reason.includes("Cravings, substance use, and very poor sleep"),
  );

  if (score >= 9 || hasSevereCompoundRisk) {
    return "Urgent";
  }

  if (score >= 6) {
    return "High";
  }

  if (score >= 3) {
    return "Medium";
  }

  return "Low";
}

function buildRiskSummary(
  patientId: string,
  riskLevel: RiskLevel,
  reasons: string[],
  lastSeenAt: string | null,
) {
  const lastSeenText = lastSeenAt
    ? `Last patient data was recorded on ${format(new Date(lastSeenAt), "MMM d, yyyy 'at' h:mm a")}.`
    : "No patient data has been recorded yet.";
  const reasonText =
    reasons.length > 0 ? reasons.join(", ") : "No strong review reason was detected.";

  return `${patientId} is currently ${riskLevel.toLowerCase()} priority. ${reasonText}. ${lastSeenText}`;
}

function takeRecent<T extends { timestamp: string }>(rows: T[], days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return rows.filter((row) => new Date(row.timestamp) >= cutoff);
}

function getLastSeenAt(
  logs: EmotionLog[],
  dailyReports: DailyReportRecord[],
  screenings: WeeklyScreeningRecord[] = [],
) {
  const latestLog = logs[0]?.timestamp ?? null;
  const latestReport = dailyReports[0]?.timestamp ?? null;
  const latestScreening = screenings[0]?.timestamp ?? null;

  return [latestLog, latestReport, latestScreening]
    .filter((value): value is string => value != null)
    .sort((left, right) => toTimestamp(right) - toTimestamp(left))[0] ?? null;
}

function getDaysSince(timestamp: string) {
  const elapsed = Date.now() - new Date(timestamp).getTime();
  return Math.max(0, Math.floor(elapsed / (1000 * 60 * 60 * 24)));
}

function getDominantEmotion(logs: EmotionLog[]) {
  const counts = logs.reduce<Record<EmotionName, number>>(
    (accumulator, log) => {
      accumulator[log.emotion] = (accumulator[log.emotion] ?? 0) + 1;
      return accumulator;
    },
    {
      Happy: 0,
      Sad: 0,
      Angry: 0,
      Worried: 0,
    },
  );

  let winner: EmotionName | null = null;
  let winningCount = 0;

  for (const [emotion, count] of Object.entries(counts)) {
    if (count > winningCount) {
      winner = emotion as EmotionName;
      winningCount = count;
    }
  }

  return winner;
}

function dedupe(values: string[]) {
  return Array.from(new Set(values));
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function toTimestamp(value: string | null) {
  return value == null ? 0 : new Date(value).getTime();
}

function isNumber(value: number | null): value is number {
  return value != null;
}
