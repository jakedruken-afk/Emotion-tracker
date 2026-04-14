import type {
  CrisisLevel,
  DailyReportRecord,
  EmotionLog,
  EmotionName,
  ObservationRecord,
  ReliabilityLevel,
  WeeklyScreeningRecord,
} from "@shared/contracts";
import {
  getLatestWeeklyScreening,
  getWeeklyScreeningDisposition,
  getWeeklyScreeningSignals,
} from "@shared/weeklyScreening";
import {
  getAverageSleepDuration,
  getAverageWakeUps,
} from "./dailyReports";

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export type PatientRiskSnapshot = {
  patientId: string;
  score: number;
  riskLevel: RiskLevel;
  dominantEmotion: EmotionName | null;
  lastSeenAt: string | null;
  reasons: string[];
  suggestedActions: string[];
  summary: string;
  whatChanged: string[];
  crisisLevel: CrisisLevel;
  crisisSummary: string | null;
  reliabilityLevel: ReliabilityLevel;
  reliabilitySummary: string;
  mismatchLevel: "none" | "watch" | "high";
  mismatchSummary: string | null;
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
  screenings: WeeklyScreeningRecord[],
  observations: ObservationRecord[] = [],
) {
  const patientIds = Array.from(
    new Set([
      ...logs.map((log) => log.patientId),
      ...dailyReports.map((report) => report.patientId),
      ...screenings.map((screening) => screening.patientId),
      ...observations.map((observation) => observation.patientId),
    ]),
  );

  return patientIds
    .map((patientId) =>
      buildPatientRiskSnapshot(
        patientId,
        logs.filter((log) => log.patientId === patientId),
        dailyReports.filter((report) => report.patientId === patientId),
        screenings.filter((screening) => screening.patientId === patientId),
        observations.filter((observation) => observation.patientId === patientId),
      ),
    )
    .sort((left, right) => {
      const riskOrder = getRiskRank(right.riskLevel) - getRiskRank(left.riskLevel);
      if (riskOrder !== 0) {
        return riskOrder;
      }

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
  screenings: WeeklyScreeningRecord[],
  observations: ObservationRecord[] = [],
): PatientRiskSnapshot {
  const recentLogs = logs.slice(0, 3);
  const previousLogs = logs.slice(3, 10);
  const morningReports = dailyReports.filter((report) => report.reportType === "morning");
  const nightReports = dailyReports.filter((report) => report.reportType === "night");
  const recentMorningReports = morningReports.slice(0, 3);
  const previousMorningReports = morningReports.slice(3, 10);
  const recentNightReports = nightReports.slice(0, 3);
  const previousNightReports = nightReports.slice(3, 10);
  const recentObservations = observations.filter((observation) =>
    isWithinDays(observation.timestamp, 7),
  );
  const latestScreening = getLatestWeeklyScreening(screenings);
  const whatChanged = buildWhatChanged(
    recentLogs,
    previousLogs,
    recentMorningReports,
    previousMorningReports,
    recentNightReports,
    previousNightReports,
  );
  const reasons: string[] = [...whatChanged];
  const suggestedActions: string[] = [];
  let score = 0;

  const dominantEmotion = getDominantEmotion(recentLogs.length > 0 ? recentLogs : logs);
  const crisisSignals = [
    ...recentLogs.map((log) => ({ level: log.crisisLevel, summary: log.crisisSummary })),
    ...dailyReports.slice(0, 5).map((report) => ({
      level: report.crisisLevel,
      summary: report.crisisSummary,
    })),
    ...screenings.slice(0, 3).map((screening) => ({
      level: screening.crisisLevel,
      summary: screening.crisisSummary,
    })),
  ];
  const crisisLevel = crisisSignals.some((signal) => signal.level === "critical")
    ? "critical"
    : crisisSignals.some((signal) => signal.level === "high")
      ? "high"
      : "none";
  const crisisSummary =
    crisisSignals.find((signal) => signal.level === "critical")?.summary ??
    crisisSignals.find((signal) => signal.level === "high")?.summary ??
    null;

  if (crisisLevel === "critical") {
    score += 10;
    reasons.unshift("Critical safety language was detected in a recent patient entry");
    suggestedActions.push("Immediate safety review and same-day clinical assessment.");
  } else if (crisisLevel === "high") {
    score += 6;
    reasons.unshift("Recent patient text suggests thoughts about self-harm or not wanting to be here");
    suggestedActions.push("Review safety today and confirm whether follow-up is needed within 24 hours.");
  }

  if (latestScreening) {
    const disposition = getWeeklyScreeningDisposition(latestScreening);

    if (disposition === "urgent") {
      score += 8;
      reasons.unshift("Latest weekly screen requires critical safety review");
      suggestedActions.push("Complete an immediate safety review and update the safety plan.");
    } else if (disposition === "positive") {
      score += 4;
      reasons.push("Latest weekly screen was positive");
      suggestedActions.push("Review safety concerns and arrange follow-up within 48 hours.");
    } else if (disposition === "history") {
      score += 2;
      reasons.push("Past serious self-harm history needs review");
    }

    for (const signal of getWeeklyScreeningSignals(latestScreening).slice(0, 2)) {
      reasons.push(signal);
    }
  }

  if (whatChanged.length >= 2) {
    score += 2;
    reasons.push("Multiple clinically meaningful changes were detected this week");
  } else if (whatChanged.length === 1) {
    score += 1;
  }

  if (recentLogs.some((log) => (log.stressLevel ?? 0) >= 8)) {
    score += 2;
  }

  if (recentLogs.some((log) => log.medicationAdherence === "missed_all")) {
    score += 2;
    reasons.push("All medication was missed on at least one recent day");
    suggestedActions.push("Ask about medication access, side effects, and refill barriers.");
  } else if (recentLogs.some((log) => log.medicationAdherence === "missed_some")) {
    score += 1;
  }

  if (recentLogs.some((log) => log.substanceUseToday)) {
    score += 2;
    reasons.push("Recent self-report includes substance use");
    suggestedActions.push("Review substance use, triggers, and same-day supports.");
  }

  if (recentMorningReports.some((report) => (report.wakeUps ?? 0) >= 3)) {
    score += 1;
  }

  if (recentNightReports.some((report) => (report.mealsCount ?? 99) <= 1)) {
    score += 2;
    reasons.push("Meals have dropped to one or fewer per day");
    suggestedActions.push("Review appetite, nausea, routine barriers, and nutrition support.");
  }

  if (recentObservations.some((observation) => isHighPriorityObservation(observation))) {
    score += 2;
    reasons.push("Recent support observation adds clinically relevant concern");
  }

  const mismatch = buildPerspectiveMismatch(
    recentLogs,
    recentMorningReports,
    recentNightReports,
    latestScreening,
    recentObservations,
  );
  if (mismatch.level === "high") {
    score += 3;
    reasons.push(mismatch.summary ?? "Patient and support inputs describe different levels of concern");
    suggestedActions.push("Review the mismatch directly with the patient and support worker.");
  } else if (mismatch.level === "watch") {
    score += 1;
  }

  const reliability = buildReliability(logs, dailyReports, screenings, mismatch.level);
  const lastSeenAt = getLastSeenAt(logs, dailyReports, screenings, observations);

  if (lastSeenAt == null) {
    reasons.push("No patient data recorded yet");
  }

  if (whatChanged.length === 0 && lastSeenAt != null && isWithinDays(lastSeenAt, 7)) {
    reasons.push("No major change signal was detected this week");
  }

  if (morningReports.length === 0) {
    suggestedActions.push("Encourage a morning sleep report so sleep changes are easier to review.");
  }

  if (latestScreening == null) {
    suggestedActions.push("Ask the patient to complete a current weekly safety screen.");
    reasons.push("No weekly safety screen is on file");
    score += 1;
  }

  const riskLevel = getRiskLevel(score, crisisLevel);
  suggestedActions.unshift(getDefaultAction(riskLevel));

  return {
    patientId,
    score,
    riskLevel,
    dominantEmotion,
    lastSeenAt,
    reasons: dedupe(reasons).slice(0, 5),
    suggestedActions: dedupe(suggestedActions).slice(0, 4),
    summary: buildRiskSummary(patientId, riskLevel, whatChanged, dedupe(reasons), suggestedActions),
    whatChanged,
    crisisLevel,
    crisisSummary,
    reliabilityLevel: reliability.level,
    reliabilitySummary: reliability.summary,
    mismatchLevel: mismatch.level,
    mismatchSummary: mismatch.summary,
  };
}

export function buildWeeklyPatientReview(
  patientId: string,
  logs: EmotionLog[],
  dailyReports: DailyReportRecord[],
  screenings: WeeklyScreeningRecord[],
  observations: ObservationRecord[] = [],
): WeeklyPatientReview {
  const risk = buildPatientRiskSnapshot(patientId, logs, dailyReports, screenings, observations);
  const dataGaps: string[] = [];

  if (logs.length === 0) {
    dataGaps.push("No recent patient check-ins are on file.");
  }

  if (!dailyReports.some((report) => report.reportType === "morning")) {
    dataGaps.push("No morning sleep reports are on file.");
  }

  if (!dailyReports.some((report) => report.reportType === "night")) {
    dataGaps.push("No night routine or meals reports are on file.");
  }

  if (screenings.length === 0) {
    dataGaps.push("No weekly safety screen is on file.");
  }

  const plainTextSections = [
    `10-second summary for ${patientId}`,
    `What is happening: ${risk.whatChanged.length > 0 ? risk.whatChanged.join("; ") : "No major change signal detected."}`,
    `How serious is it: ${risk.riskLevel} priority${risk.crisisSummary ? ` with a safety alert. ${risk.crisisSummary}` : "."}`,
    `Why it matters: ${risk.reasons.length > 0 ? risk.reasons.join("; ") : "No major review reason was detected."}`,
    `What to do: ${risk.suggestedActions.join(" ")}`,
    `Reliability: ${risk.reliabilityLevel}. ${risk.reliabilitySummary}${risk.mismatchSummary ? ` ${risk.mismatchSummary}` : ""}`,
    `Data gaps: ${dataGaps.length > 0 ? dataGaps.join(" ") : "No major data gaps detected."}`,
  ];

  return {
    patientId,
    risk,
    keyChanges: risk.whatChanged,
    suggestedActions: risk.suggestedActions,
    dataGaps,
    plainText: plainTextSections.join("\n\n"),
  };
}

function buildWhatChanged(
  recentLogs: EmotionLog[],
  previousLogs: EmotionLog[],
  recentMorningReports: DailyReportRecord[],
  previousMorningReports: DailyReportRecord[],
  recentNightReports: DailyReportRecord[],
  previousNightReports: DailyReportRecord[],
) {
  const changes: string[] = [];
  const recentStress = average(recentLogs.map((log) => log.stressLevel).filter(isNumber));
  const previousStress = average(previousLogs.map((log) => log.stressLevel).filter(isNumber));
  const recentSleep = getAverageSleepDuration(recentMorningReports);
  const previousSleep = getAverageSleepDuration(previousMorningReports);
  const recentWakeUps = getAverageWakeUps(recentMorningReports);
  const previousWakeUps = getAverageWakeUps(previousMorningReports);
  const recentMeals = average(recentNightReports.map((report) => report.mealsCount).filter(isNumber));
  const previousMeals = average(
    previousNightReports.map((report) => report.mealsCount).filter(isNumber),
  );
  const recentMood = getDominantEmotion(recentLogs);
  const previousMood = getDominantEmotion(previousLogs);

  if (
    recentMood &&
    previousMood &&
    getMoodSeverity(recentMood) > getMoodSeverity(previousMood)
  ) {
    changes.push(`Mood pattern shifted toward ${recentMood.toLowerCase()} entries.`);
  }

  if (
    recentStress != null &&
    previousStress != null &&
    recentStress - previousStress >= 2 &&
    recentLogs.length >= 2
  ) {
    changes.push(`Stress rose from ${previousStress.toFixed(1)}/10 to ${recentStress.toFixed(1)}/10.`);
  }

  if (recentSleep != null && previousSleep != null && previousSleep - recentSleep >= 2) {
    changes.push(
      `Average sleep dropped from ${previousSleep.toFixed(1)} to ${recentSleep.toFixed(1)} hours.`,
    );
  } else if (
    recentMorningReports.filter((report) =>
      report.sleepQuality === "bad" || report.sleepQuality === "very_bad",
    ).length >= 2 &&
    previousMorningReports.filter((report) =>
      report.sleepQuality === "bad" || report.sleepQuality === "very_bad",
    ).length < 2
  ) {
    changes.push("Poor sleep quality is repeating across recent mornings.");
  }

  if (
    recentWakeUps != null &&
    previousWakeUps != null &&
    recentWakeUps - previousWakeUps >= 2
  ) {
    changes.push("Overnight wake-ups increased meaningfully.");
  }

  if (recentMeals != null && previousMeals != null && previousMeals - recentMeals >= 1) {
    changes.push(`Meals dropped from ${previousMeals.toFixed(1)} to ${recentMeals.toFixed(1)} per day.`);
  }

  if (
    recentNightReports.some((report) =>
      /(appetite|nausea|couldn'?t eat|forgot to eat|too stressed to eat)/i.test(
        `${report.mealsNote ?? ""} ${report.notes ?? ""}`,
      ),
    )
  ) {
    changes.push("Recent meal notes suggest eating difficulty.");
  }

  if (
    recentLogs.some(
      (log) =>
        log.medicationAdherence === "missed_some" || log.medicationAdherence === "missed_all",
    ) &&
    previousLogs.every(
      (log) =>
        log.medicationAdherence !== "missed_some" && log.medicationAdherence !== "missed_all",
    )
  ) {
    changes.push("Missed medication details appeared in recent check-ins.");
  }

  return dedupe(changes).slice(0, 4);
}

function buildPerspectiveMismatch(
  recentLogs: EmotionLog[],
  recentMorningReports: DailyReportRecord[],
  recentNightReports: DailyReportRecord[],
  latestScreening: WeeklyScreeningRecord | null,
  recentObservations: ObservationRecord[],
) {
  if (recentObservations.length === 0) {
    if (
      recentLogs.some((log) => log.crisisLevel !== "none") ||
      recentNightReports.some((report) => (report.mealsCount ?? 99) <= 1) ||
      latestScreening?.currentThoughts
    ) {
      return {
        level: "watch" as const,
        summary:
          "Patient self-report shows deterioration without a matching recent support observation.",
      };
    }

    return { level: "none" as const, summary: null };
  }

  const supportConcernText = recentObservations
    .map((observation) => `${observation.observationType} ${observation.observation}`.toLowerCase())
    .join(" ");
  const patientLooksStable =
    recentLogs.every((log) => (log.stressLevel ?? 0) <= 5) &&
    recentLogs.every((log) => (log.cravingLevel ?? 0) <= 4) &&
    recentNightReports.every((report) => (report.mealsCount ?? 3) >= 2) &&
    latestScreening?.currentThoughts !== true;

  const supportSignalsSevere =
    recentObservations.some((observation) => isHighPriorityObservation(observation)) ||
    /(not sleeping|not eating|unsafe|self-harm|harming|withdrawn|deteriorat|panic|high risk)/i.test(
      supportConcernText,
    );

  if (supportSignalsSevere && patientLooksStable) {
    return {
      level: "high" as const,
      summary:
        "Support observations describe more deterioration than the patient self-report reflects.",
    };
  }

  const patientSignalsHigh =
    recentLogs.some((log) => (log.stressLevel ?? 0) >= 8) ||
    recentNightReports.some((report) => (report.mealsCount ?? 99) <= 1) ||
    latestScreening?.currentThoughts === true;

  if (patientSignalsHigh && !supportSignalsSevere) {
    return {
      level: "watch" as const,
      summary:
        "Patient self-report worsened without a matching level of concern in recent support notes.",
    };
  }

  return { level: "none" as const, summary: null };
}

function buildReliability(
  logs: EmotionLog[],
  dailyReports: DailyReportRecord[],
  screenings: WeeklyScreeningRecord[],
  mismatchLevel: "none" | "watch" | "high",
) {
  const recentRecords = [
    ...logs.slice(0, 5),
    ...dailyReports.slice(0, 5),
    ...screenings.slice(0, 3),
  ];
  const editCount = recentRecords.reduce((total, record) => total + record.editCount, 0);
  const suspiciousEditCount = recentRecords.reduce(
    (total, record) => total + record.suspiciousEditCount,
    0,
  );
  const level = getReliabilityLevel(editCount, suspiciousEditCount, mismatchLevel);

  return {
    level,
    summary:
      level === "Low"
        ? "Multiple or suspicious edits reduce confidence in the current snapshot."
        : level === "Medium"
          ? "Recent edits or a mild perspective mismatch mean the latest data should be confirmed."
          : "Recent entries are consistent and have no meaningful edit concern.",
  };
}

function getReliabilityLevel(
  editCount: number,
  suspiciousEditCount: number,
  mismatchLevel: "none" | "watch" | "high",
): ReliabilityLevel {
  if (suspiciousEditCount > 0 || editCount >= 2 || mismatchLevel === "high") {
    return "Low";
  }

  if (editCount > 0 || mismatchLevel === "watch") {
    return "Medium";
  }

  return "High";
}

function getRiskLevel(score: number, crisisLevel: CrisisLevel): RiskLevel {
  if (crisisLevel === "critical" || score >= 10) {
    return "Critical";
  }

  if (crisisLevel === "high" || score >= 6) {
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
  whatChanged: string[],
  reasons: string[],
  suggestedActions: string[],
) {
  const changeText =
    whatChanged.length > 0 ? whatChanged.join(" ") : "No major change signal was detected.";
  const reasonText =
    reasons.length > 0 ? reasons.slice(0, 2).join(" ") : "No major review reason was detected.";

  return `${patientId} is ${riskLevel.toLowerCase()} priority. ${changeText} ${reasonText} Next step: ${suggestedActions[0] ?? "Continue routine monitoring."}`;
}

function getDefaultAction(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case "Critical":
      return "Arrange immediate same-day safety review.";
    case "High":
      return "Review the patient within 24-48 hours.";
    case "Medium":
      return "Schedule a focused follow-up and confirm the main change drivers.";
    default:
      return "Continue routine monitoring and confirm no new concerns.";
  }
}

function getRiskRank(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case "Critical":
      return 4;
    case "High":
      return 3;
    case "Medium":
      return 2;
    default:
      return 1;
  }
}

function getLastSeenAt(
  logs: EmotionLog[],
  dailyReports: DailyReportRecord[],
  screenings: WeeklyScreeningRecord[],
  observations: ObservationRecord[],
) {
  return [
    logs[0]?.timestamp ?? null,
    dailyReports[0]?.timestamp ?? null,
    screenings[0]?.timestamp ?? null,
    observations[0]?.timestamp ?? null,
  ]
    .filter((value): value is string => value != null)
    .sort((left, right) => toTimestamp(right) - toTimestamp(left))[0] ?? null;
}

function getDominantEmotion(logs: EmotionLog[]) {
  const counts = logs.reduce<Record<EmotionName, number>>(
    (accumulator, log) => {
      accumulator[log.emotion] = (accumulator[log.emotion] ?? 0) + 1;
      return accumulator;
    },
    { Happy: 0, Sad: 0, Angry: 0, Worried: 0 },
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

function getMoodSeverity(emotion: EmotionName) {
  switch (emotion) {
    case "Happy":
      return 0;
    case "Sad":
      return 1;
    case "Worried":
      return 2;
    case "Angry":
      return 3;
    default:
      return 0;
  }
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function isNumber(value: number | null): value is number {
  return value != null;
}

function toTimestamp(value: string | null) {
  return value == null ? 0 : new Date(value).getTime();
}

function dedupe(values: string[]) {
  return Array.from(new Set(values));
}

function isWithinDays(timestamp: string, days: number) {
  return Date.now() - new Date(timestamp).getTime() <= days * 24 * 60 * 60 * 1000;
}

function isHighPriorityObservation(observation: ObservationRecord) {
  return observation.priority === "High" || observation.priority === "Critical" || observation.priority === "Urgent";
}
