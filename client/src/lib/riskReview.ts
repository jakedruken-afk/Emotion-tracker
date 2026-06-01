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
  getSleepDurationHours,
} from "./dailyReports";

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";
export type RiskConfidence = "High" | "Medium" | "Low";

export type RiskSnapshotOptions = {
  asOf?: string | Date;
};

export type EarlyWarningIndex = {
  acute72hScore: number;
  trend7dScore: number;
  overallPriority: RiskLevel;
  confidence: RiskConfidence;
  reasons: string[];
  recommendedAction: string;
  calculatedAsOf: string;
  lastCheckInGapDays: number | null;
  deteriorationWatch: boolean;
  emergencyFollowUpEvents: EmergencyFollowUpEvent[];
};

export type EmergencyFollowUpEvent = {
  id: string;
  source: "Mood check-in" | "Sleep or meals report" | "Support observation";
  summary: string;
  eventAt: string;
  recordedAt: string;
  linkedEntityType: "emotion" | "daily_report" | "observation";
  linkedEntityId: number;
};

export type PatientRiskSnapshot = {
  patientId: string;
  score: number;
  riskLevel: RiskLevel;
  acute72hScore: number;
  trend7dScore: number;
  overallPriority: RiskLevel;
  confidence: RiskConfidence;
  calculatedAsOf: string;
  recommendedAction: string;
  dominantEmotion: EmotionName | null;
  lastSeenAt: string | null;
  lastCheckInGapDays: number | null;
  deteriorationWatch: boolean;
  emergencyFollowUpEvents: EmergencyFollowUpEvent[];
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
  options: RiskSnapshotOptions = {},
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
        options,
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
  options: RiskSnapshotOptions = {},
): PatientRiskSnapshot {
  const asOfDate = normalizeAsOfDate(options.asOf);
  const calculatedAsOf = asOfDate.toISOString();
  const sortedLogs = filterAndSortAtOrBefore(logs, asOfDate);
  const sortedDailyReports = filterAndSortAtOrBefore(dailyReports, asOfDate);
  const sortedScreenings = filterAndSortAtOrBefore(screenings, asOfDate);
  const sortedObservations = filterAndSortAtOrBefore(observations, asOfDate);
  const recentLogs = sortedLogs.slice(0, 3);
  const previousLogs = sortedLogs.slice(3, 10);
  const morningReports = sortedDailyReports.filter((report) => report.reportType === "morning");
  const nightReports = sortedDailyReports.filter((report) => report.reportType === "night");
  const recentMorningReports = morningReports.slice(0, 3);
  const previousMorningReports = morningReports.slice(3, 10);
  const recentNightReports = nightReports.slice(0, 3);
  const previousNightReports = nightReports.slice(3, 10);
  const recentObservations = sortedObservations.filter((observation) =>
    isWithinDays(observation.timestamp, 7, asOfDate),
  );
  const latestScreening = getLatestWeeklyScreening(sortedScreenings);
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

  const dominantEmotion = getDominantEmotion(recentLogs.length > 0 ? recentLogs : sortedLogs);
  const crisisSignals = [
    ...recentLogs.map((log) => ({ level: log.crisisLevel, summary: log.crisisSummary })),
    ...sortedDailyReports.slice(0, 5).map((report) => ({
      level: report.crisisLevel,
      summary: report.crisisSummary,
    })),
    ...sortedScreenings.slice(0, 3).map((screening) => ({
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

  const earlyWarning = buildEarlyWarningIndex(
    sortedLogs,
    sortedDailyReports,
    sortedScreenings,
    sortedObservations,
    asOfDate,
    crisisLevel,
  );
  const earlyWarningScore =
    earlyWarning.overallPriority === "Critical"
      ? 10
      : Math.min(9, Math.ceil(Math.max(earlyWarning.acute72hScore, earlyWarning.trend7dScore) / 10));
  score = Math.max(score, earlyWarningScore);
  reasons.push(...earlyWarning.reasons);
  suggestedActions.push(earlyWarning.recommendedAction);

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

  const reliability = buildReliability(sortedLogs, sortedDailyReports, sortedScreenings, mismatch.level);
  const lastSeenAt = getLastSeenAt(sortedLogs, sortedDailyReports, sortedScreenings, sortedObservations);

  if (lastSeenAt == null) {
    reasons.push("No patient data recorded yet");
  }

  if (whatChanged.length === 0 && earlyWarning.reasons.length === 0 && lastSeenAt != null && isWithinDays(lastSeenAt, 7, asOfDate)) {
    reasons.push("No major warning signal was detected this week");
  }

  if (morningReports.length === 0) {
    suggestedActions.push("Encourage a morning sleep report so sleep changes are easier to review.");
  }

  if (latestScreening == null) {
    suggestedActions.push("Ask the patient to complete a current weekly safety screen.");
    reasons.push("No weekly safety screen is on file");
    score += 1;
  }

  const riskLevel = getHigherRiskLevel(getRiskLevel(score, crisisLevel), earlyWarning.overallPriority);
  suggestedActions.unshift(getDefaultAction(riskLevel));
  if (earlyWarning.deteriorationWatch) {
    whatChanged.unshift("Deterioration Watch: check-ins stopped after concerning warning signs.");
  }

  return {
    patientId,
    score,
    riskLevel,
    acute72hScore: earlyWarning.acute72hScore,
    trend7dScore: earlyWarning.trend7dScore,
    overallPriority: riskLevel,
    confidence: earlyWarning.confidence,
    calculatedAsOf,
    recommendedAction: earlyWarning.recommendedAction,
    dominantEmotion,
    lastSeenAt,
    lastCheckInGapDays: earlyWarning.lastCheckInGapDays,
    deteriorationWatch: earlyWarning.deteriorationWatch,
    emergencyFollowUpEvents: earlyWarning.emergencyFollowUpEvents,
    reasons: dedupe(reasons).slice(0, 12),
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
    `What is happening: ${risk.whatChanged.length > 0 ? risk.whatChanged.join("; ") : "No major warning signal detected."}`,
    `How serious is it: ${risk.riskLevel} priority. 72-hour score ${risk.acute72hScore}/100. 7-day trend score ${risk.trend7dScore}/100.${risk.crisisSummary ? ` Safety alert: ${risk.crisisSummary}` : ""}`,
    `Why it matters: ${risk.reasons.length > 0 ? risk.reasons.join("; ") : "No major review reason was detected."}`,
    `What to do: ${risk.suggestedActions.join(" ")}`,
    `Confidence: ${risk.confidence}.${risk.lastCheckInGapDays != null ? ` Last check-in gap is about ${Math.floor(risk.lastCheckInGapDays)} day(s).` : ""}`,
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

function buildEarlyWarningIndex(
  logs: EmotionLog[],
  dailyReports: DailyReportRecord[],
  screenings: WeeklyScreeningRecord[],
  observations: ObservationRecord[],
  asOfDate: Date,
  crisisLevel: CrisisLevel,
): EarlyWarningIndex {
  const reasons: string[] = [];
  let acute72hScore = 0;
  let trend7dScore = 0;
  let minimumPriority: RiskLevel = "Low";
  let hardGatePriority: RiskLevel | null = null;

  const logs7d = filterWithinDays(logs, 7, asOfDate);
  const baselineLogs = filterBetweenDays(logs, 7, 30, asOfDate);
  const routineReports = filterWithinDays(dailyReports, 10, asOfDate);
  const observations7d = filterWithinDays(observations, 7, asOfDate);
  const latestScreening = screenings[0] ?? null;
  const latestScreeningAgeDays = latestScreening
    ? getAgeInDays(latestScreening.timestamp, asOfDate)
    : null;

  const addSignal = (
    reason: string,
    acutePoints: number,
    trendPoints: number,
    priorityFloor: RiskLevel = "Low",
  ) => {
    reasons.push(reason);
    acute72hScore += acutePoints;
    trend7dScore += trendPoints;
    minimumPriority = getHigherRiskLevel(minimumPriority, priorityFloor);
  };

  if (crisisLevel === "critical") {
    hardGatePriority = "Critical";
    addSignal("Critical safety language was detected before this review point.", 100, 100, "Critical");
  } else if (crisisLevel === "high") {
    addSignal("Recent safety language needs same-day review.", 65, 65, "High");
  }

  if (
    latestScreening &&
    latestScreeningAgeDays != null &&
    latestScreeningAgeDays <= 30
  ) {
    const disposition = getWeeklyScreeningDisposition(latestScreening);
    const screeningSignals = getWeeklyScreeningSignals(latestScreening);

    if (latestScreening.currentThoughts || latestScreening.needsHelpStayingSafe) {
      hardGatePriority = "Critical";
      addSignal("Weekly screen says immediate safety support may be needed.", 100, 100, "Critical");
    } else if (disposition === "positive") {
      addSignal("Latest weekly safety screen was positive.", 32, 40, "High");
    } else if (disposition === "history") {
      addSignal("Weekly screen includes past serious self-harm history.", 8, 18, "Medium");
    }

    if (latestScreening.everTriedToKillSelf && latestScreening.attemptTiming === "within_year") {
      addSignal("Past serious self-harm attempt was reported within the last year.", 12, 28, "High");
    }

    if (latestScreening.hopeless || latestScreening.couldNotEnjoyThings) {
      addSignal("Weekly screen includes hopelessness or loss of enjoyment.", 8, 14, "Medium");
    }

    if (latestScreening.depressedHardToFunction || latestScreening.anxiousOnEdge) {
      addSignal("Weekly screen shows mood or anxiety affecting daily function.", 6, 12, "Medium");
    }

    if (latestScreening.substanceUseMoreThanUsual) {
      addSignal("Weekly screen shows more substance or alcohol use than usual.", 8, 14, "Medium");
    }

    if (latestScreening.sleepTrouble || latestScreening.appetiteChange) {
      addSignal("Weekly screen shows sleep or appetite disruption.", 6, 12, "Medium");
    }

    if (screeningSignals.length >= 5) {
      addSignal("Weekly screen contains several deterioration signals at once.", 8, 18, "High");
    }
  }

  const emergencyFollowUpEvents = collectEmergencyFollowUpEvents(
    logs,
    dailyReports,
    observations,
    asOfDate,
  );
  if (emergencyFollowUpEvents.length > 0) {
    hardGatePriority = "Critical";
    addSignal(
      "Patient or support text reports emergency mental-health or crisis-response involvement.",
      100,
      100,
      "Critical",
    );
  }

  const zeroMealReports = routineReports.filter(
    (report) => report.reportType === "night" && (report.mealsCount ?? 99) <= 0,
  );
  const lowMealReports = routineReports.filter(
    (report) => report.reportType === "night" && (report.mealsCount ?? 99) <= 1,
  );
  const poorSleepReports = routineReports.filter(
    (report) =>
      report.reportType === "morning" &&
      (report.sleepQuality === "bad" ||
        report.sleepQuality === "very_bad" ||
        report.feltRested === false ||
        (report.wakeUps ?? 0) >= 3),
  );
  const veryShortSleepReports = routineReports.filter((report) => {
    if (report.reportType !== "morning") {
      return false;
    }

    const duration = getSleepDurationHours(report.bedTime, report.wakeTime);
    return duration != null && duration <= 4;
  });

  if (zeroMealReports.length >= 2) {
    const zeroMealReason = "Repeated night reports show 0 meals.";
    addSignal(zeroMealReason, 16, 26, "High");
    promoteReason(reasons, zeroMealReason);
  } else if (lowMealReports.length > 0) {
    addSignal("Recent night report shows one or fewer meals.", 8, 14, "Medium");
  }

  if (poorSleepReports.length >= 2 || veryShortSleepReports.length > 0) {
    addSignal("Sleep or rest disruption is repeating in recent reports.", 10, 18, "Medium");
  } else if (poorSleepReports.length === 1) {
    addSignal("Recent sleep report shows poor rest or frequent wakeups.", 6, 10, "Medium");
  }

  const missedMedicationLogs = logs7d.filter(
    (log) => log.medicationAdherence === "missed_some" || log.medicationAdherence === "missed_all",
  );
  if (missedMedicationLogs.some((log) => log.medicationAdherence === "missed_all")) {
    addSignal("Recent check-in says all medication was missed.", 14, 18, "High");
  } else if (missedMedicationLogs.length > 0) {
    addSignal("Recent check-in includes missed medication.", 8, 12, "Medium");
  }

  const substanceUseLogs = logs7d.filter((log) => log.substanceUseToday);
  if (substanceUseLogs.length >= 2) {
    addSignal("Substance use appears in multiple recent check-ins.", 14, 18, "High");
  } else if (substanceUseLogs.length === 1) {
    addSignal("Recent check-in includes substance use.", 8, 12, "Medium");
  }

  const highCravingLogs = logs7d.filter((log) => (log.cravingLevel ?? 0) >= 7);
  const highStressLogs = logs7d.filter((log) => (log.stressLevel ?? 0) >= 8);
  if (highCravingLogs.length >= 2) {
    addSignal("High cravings are repeating across recent check-ins.", 16, 20, "High");
  } else if (highCravingLogs.length === 1) {
    addSignal("Recent craving level is high.", 10, 12, "Medium");
  }

  if (highStressLogs.length >= 2) {
    addSignal("High stress is repeating across recent check-ins.", 14, 18, "High");
  } else if (highStressLogs.length === 1) {
    addSignal("Recent stress level is high.", 8, 10, "Medium");
  }

  const recentStress = average(logs7d.map((log) => log.stressLevel).filter(isNumber));
  const baselineStress = average(baselineLogs.map((log) => log.stressLevel).filter(isNumber));
  const recentCraving = average(logs7d.map((log) => log.cravingLevel).filter(isNumber));
  const baselineCraving = average(baselineLogs.map((log) => log.cravingLevel).filter(isNumber));
  if (recentStress != null && baselineStress != null && recentStress - baselineStress >= 2) {
    addSignal("Stress is rising compared with the patient's prior baseline.", 8, 16, "Medium");
  }

  if (recentCraving != null && baselineCraving != null && recentCraving - baselineCraving >= 2) {
    addSignal("Cravings are rising compared with the patient's prior baseline.", 8, 16, "Medium");
  }

  const negativeMoodLogs = logs7d.filter((log) => getMoodSeverity(log.emotion) >= 1);
  const recentMoodSeverity = average(logs7d.map((log) => getMoodSeverity(log.emotion)));
  const baselineMoodSeverity = average(baselineLogs.map((log) => getMoodSeverity(log.emotion)));
  if (negativeMoodLogs.length >= 3) {
    addSignal("Negative mood entries are repeating across the week.", 8, 14, "Medium");
  }

  if (
    recentMoodSeverity != null &&
    baselineMoodSeverity != null &&
    recentMoodSeverity - baselineMoodSeverity >= 1
  ) {
    addSignal("Mood severity is worse than the patient's prior baseline.", 6, 12, "Medium");
  }

  if (observations7d.some((observation) => observation.priority === "Critical" || observation.priority === "Urgent")) {
    hardGatePriority = "Critical";
    addSignal("Recent support observation is urgent or critical.", 100, 100, "Critical");
  } else if (observations7d.some((observation) => observation.priority === "High")) {
    addSignal("Recent support observation is marked high priority.", 18, 22, "High");
  }

  const lastSeenAt = getLastSeenAt(logs, dailyReports, screenings, observations);
  const lastCheckInGapDays = lastSeenAt ? getAgeInDays(lastSeenAt, asOfDate) : null;
  const hasMeaningfulConcern =
    reasons.length > 0 ||
    latestScreening?.wishedDead === true ||
    latestScreening?.familyBetterOffDead === true ||
    latestScreening?.everTriedToKillSelf === true ||
    lowMealReports.length > 0 ||
    missedMedicationLogs.length > 0 ||
    substanceUseLogs.length > 0;
  const deteriorationWatch =
    lastCheckInGapDays != null && lastCheckInGapDays >= 2 && hasMeaningfulConcern;

  if (deteriorationWatch) {
    const deteriorationReason =
      `Deterioration Watch: no patient check-in for ${formatGapDays(lastCheckInGapDays)} after concerning warning signs.`;
    addSignal(
      deteriorationReason,
      10,
      18,
      lastCheckInGapDays >= 3 ? "High" : "Medium",
    );
    promoteReason(reasons, deteriorationReason);
  }

  if (latestScreening == null) {
    reasons.push("No weekly safety screen is on file, so confidence is lower.");
  }

  acute72hScore = clampScore(acute72hScore);
  trend7dScore = clampScore(trend7dScore);

  const scorePriority = getEarlyWarningPriority(
    acute72hScore,
    trend7dScore,
    crisisLevel,
  );
  const overallPriority = hardGatePriority
    ? getHigherRiskLevel(scorePriority, hardGatePriority)
    : getHigherRiskLevel(scorePriority, minimumPriority);
  const confidence = getEarlyWarningConfidence(
    logs,
    dailyReports,
    screenings,
    lastCheckInGapDays,
  );
  const recommendedAction = getEarlyWarningAction(
    overallPriority,
    deteriorationWatch,
    confidence,
  );

  return {
    acute72hScore,
    trend7dScore,
    overallPriority,
    confidence,
    reasons: dedupe(reasons).slice(0, 12),
    recommendedAction,
    calculatedAsOf: asOfDate.toISOString(),
    lastCheckInGapDays,
    deteriorationWatch,
    emergencyFollowUpEvents,
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

function collectEmergencyFollowUpEvents(
  logs: EmotionLog[],
  dailyReports: DailyReportRecord[],
  observations: ObservationRecord[],
  asOfDate: Date,
): EmergencyFollowUpEvent[] {
  const recentLogs = filterWithinDays(logs, 30, asOfDate);
  const recentReports = filterWithinDays(dailyReports, 30, asOfDate);
  const recentObservations = filterWithinDays(observations, 30, asOfDate);

  return [
    ...recentLogs
      .filter((log) => hasEmergencyInterventionText(log.notes))
      .flatMap((log) =>
        buildEmergencyFollowUpEventsFromText({
          text: log.notes,
          fallbackEventAt: log.occurredAt ?? log.timestamp,
          recordedAt: log.timestamp,
          source: "Mood check-in",
          summary:
            "Emergency mental-health or crisis-response involvement was mentioned in a mood check-in.",
          linkedEntityType: "emotion",
          linkedEntityId: log.id,
        }),
      ),
    ...recentReports
      .filter((report) => hasEmergencyInterventionText(report.notes, report.mealsNote))
      .flatMap((report) =>
        buildEmergencyFollowUpEventsFromText({
          text: `${report.notes ?? ""} ${report.mealsNote ?? ""}`,
          fallbackEventAt: report.timestamp,
          recordedAt: report.timestamp,
          source: "Sleep or meals report",
          summary:
            "Emergency mental-health or crisis-response involvement was mentioned in a sleep or meals report.",
          linkedEntityType: "daily_report",
          linkedEntityId: report.id,
        }),
      ),
    ...recentObservations
      .filter((observation) => hasEmergencyInterventionText(observation.observation))
      .flatMap((observation) =>
        buildEmergencyFollowUpEventsFromText({
          text: observation.observation,
          fallbackEventAt: observation.timestamp,
          recordedAt: observation.timestamp,
          source: "Support observation",
          summary:
            "Emergency mental-health or crisis-response involvement was mentioned in a support observation.",
          linkedEntityType: "observation",
          linkedEntityId: observation.id,
        }),
      ),
  ].sort((left, right) => toTimestamp(right.eventAt) - toTimestamp(left.eventAt));
}

function buildEmergencyFollowUpEventsFromText(input: {
  text: string | null | undefined;
  fallbackEventAt: string;
  recordedAt: string;
  source: EmergencyFollowUpEvent["source"];
  summary: string;
  linkedEntityType: EmergencyFollowUpEvent["linkedEntityType"];
  linkedEntityId: number;
}): EmergencyFollowUpEvent[] {
  const resolvedEvents = resolveEmergencyEventTimes(input.text, input.fallbackEventAt);

  if (resolvedEvents.length === 0) {
    return [
      {
        id: `${input.linkedEntityType}:${input.linkedEntityId}`,
        source: input.source,
        summary: input.summary,
        eventAt: input.fallbackEventAt,
        recordedAt: input.recordedAt,
        linkedEntityType: input.linkedEntityType,
        linkedEntityId: input.linkedEntityId,
      },
    ];
  }

  return resolvedEvents.map((event, index) => ({
    id: `${input.linkedEntityType}:${input.linkedEntityId}:event:${index + 1}`,
    source: input.source,
    summary: event.summary ?? input.summary,
    eventAt: event.eventAt,
    recordedAt: input.recordedAt,
    linkedEntityType: input.linkedEntityType,
    linkedEntityId: input.linkedEntityId,
  }));
}

function resolveEmergencyEventTimes(
  text: string | null | undefined,
  fallbackEventAt: string,
) {
  const normalized = normalizeReviewText(text ?? "");
  const referenceDate = new Date(fallbackEventAt);
  if (normalized.length === 0 || !Number.isFinite(referenceDate.getTime())) {
    return [];
  }

  const events: Array<{ eventAt: string; summary: string | null }> = [];
  const detectedSpans: Array<{ start: number; end: number }> = [];

  for (const match of normalized.matchAll(relativeEventPattern)) {
    const dayText = match.groups?.day;
    const timeText = match.groups?.time;
    if (!dayText || !timeText || match.index == null) {
      continue;
    }

    const eventDate = resolveRelativeEventDate(dayText, referenceDate);
    const time = parseEventTime(timeText, normalized, match.index);
    if (!eventDate || !time) {
      continue;
    }

    events.push({
      eventAt: combineDateAndTime(eventDate, time.hour, time.minute).toISOString(),
      summary: `Emergency mental-health or crisis-response involvement reported for ${dayText} around ${time.label}.`,
    });
    detectedSpans.push({ start: match.index, end: match.index + match[0].length });
  }

  for (const match of normalized.matchAll(timeThenRelativeEventPattern)) {
    const timeText = match.groups?.time;
    const dayText = match.groups?.day;
    if (!dayText || !timeText || match.index == null) {
      continue;
    }

    const matchEnd = match.index + match[0].length;
    if (
      detectedSpans.some((span) =>
        rangesOverlap(span.start, span.end, match.index!, matchEnd),
      )
    ) {
      continue;
    }

    const eventDate = resolveRelativeEventDate(dayText, referenceDate);
    const time = parseEventTime(timeText, normalized, match.index);
    if (!eventDate || !time) {
      continue;
    }

    events.push({
      eventAt: combineDateAndTime(eventDate, time.hour, time.minute).toISOString(),
      summary: `Emergency mental-health or crisis-response involvement reported for ${dayText} around ${time.label}.`,
    });
  }

  return dedupeEmergencyEvents(events);
}

const relativeEventPattern =
  /\b(?<day>yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:morning|afternoon|evening|night))?(?:\s+(?:at|around|about))?\s+(?<time>\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?(?:\s*[-–]\s*\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?)?)(?!\s+(?:on\s+)?(?:yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday))/g;

const timeThenRelativeEventPattern =
  /\b(?<time>\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?(?:\s*[-–]\s*\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?)?)\s+(?:on\s+)?(?<day>yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:morning|afternoon|evening|night))?\b/g;

function resolveRelativeEventDate(dayText: string, referenceDate: Date) {
  const normalizedDay = dayText.toLowerCase();
  const date = new Date(referenceDate);
  date.setHours(0, 0, 0, 0);

  if (normalizedDay === "today") {
    return date;
  }

  if (normalizedDay === "yesterday") {
    date.setDate(date.getDate() - 1);
    return date;
  }

  const targetDay = weekdayToNumber(normalizedDay);
  if (targetDay == null) {
    return null;
  }

  const currentDay = date.getDay();
  let daysBack = currentDay - targetDay;
  if (daysBack <= 0) {
    daysBack += 7;
  }

  date.setDate(date.getDate() - daysBack);
  return date;
}

function weekdayToNumber(dayText: string) {
  switch (dayText) {
    case "sunday":
      return 0;
    case "monday":
      return 1;
    case "tuesday":
      return 2;
    case "wednesday":
      return 3;
    case "thursday":
      return 4;
    case "friday":
      return 5;
    case "saturday":
      return 6;
    default:
      return null;
  }
}

function parseEventTime(
  timeText: string,
  fullText: string,
  matchIndex: number,
) {
  const firstTime = timeText.split(/[-–]/)[0]?.trim();
  if (!firstTime) {
    return null;
  }

  const match = firstTime.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) {
    return null;
  }

  const hourNumber = Number(match[1]);
  const minuteNumber = match[2] ? Number(match[2]) : 0;
  const explicitPeriod = match[3] as "am" | "pm" | undefined;
  const nearbyText = fullText.slice(
    Math.max(0, matchIndex - 30),
    matchIndex + timeText.length + 30,
  );
  const inferredPeriod = explicitPeriod ?? inferEventTimePeriod(nearbyText);

  if (
    !Number.isInteger(hourNumber) ||
    !Number.isInteger(minuteNumber) ||
    hourNumber < 1 ||
    hourNumber > 12 ||
    minuteNumber < 0 ||
    minuteNumber > 59
  ) {
    return null;
  }

  let hour = hourNumber;
  if (inferredPeriod === "pm" && hour < 12) {
    hour += 12;
  }

  if (inferredPeriod === "am" && hour === 12) {
    hour = 0;
  }

  return {
    hour,
    minute: minuteNumber,
    label: `${hourNumber}:${String(minuteNumber).padStart(2, "0")} ${inferredPeriod?.toUpperCase() ?? ""}`.trim(),
  };
}

function inferEventTimePeriod(text: string): "am" | "pm" | null {
  if (/\b(am|morning)\b/.test(text)) {
    return "am";
  }

  if (/\b(pm|afternoon|evening|night|tonight)\b/.test(text)) {
    return "pm";
  }

  return null;
}

function combineDateAndTime(date: Date, hour: number, minute: number) {
  const combined = new Date(date);
  combined.setHours(hour, minute, 0, 0);
  return combined;
}

function rangesOverlap(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function dedupeEmergencyEvents(
  events: Array<{ eventAt: string; summary: string | null }>,
) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = event.eventAt;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
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
  if (crisisLevel === "critical") {
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

function getEarlyWarningPriority(
  acute72hScore: number,
  trend7dScore: number,
  crisisLevel: CrisisLevel,
): RiskLevel {
  if (crisisLevel === "critical") {
    return "Critical";
  }

  if (crisisLevel === "high" || acute72hScore >= 55 || trend7dScore >= 55) {
    return "High";
  }

  if (acute72hScore >= 35 || trend7dScore >= 35) {
    return "Medium";
  }

  return "Low";
}

function getEarlyWarningConfidence(
  logs: EmotionLog[],
  dailyReports: DailyReportRecord[],
  screenings: WeeklyScreeningRecord[],
  lastCheckInGapDays: number | null,
): RiskConfidence {
  const totalRecords = logs.length + dailyReports.length + screenings.length;

  if (totalRecords === 0) {
    return "Low";
  }

  if (lastCheckInGapDays == null || lastCheckInGapDays >= 3) {
    return "Low";
  }

  if (lastCheckInGapDays >= 2 || totalRecords < 3 || screenings.length === 0) {
    return "Medium";
  }

  return "High";
}

function getEarlyWarningAction(
  riskLevel: RiskLevel,
  deteriorationWatch: boolean,
  confidence: RiskConfidence,
) {
  if (riskLevel === "Critical") {
    return "Complete immediate same-day safety review and document the response.";
  }

  if (deteriorationWatch) {
    return "Contact the patient or support person because check-ins stopped after warning signs.";
  }

  if (riskLevel === "High") {
    return "Review within 24 hours and focus on the strongest deterioration signals.";
  }

  if (riskLevel === "Medium") {
    return "Schedule a focused follow-up and confirm whether symptoms are worsening.";
  }

  if (confidence === "Low") {
    return "Collect current check-in data before treating the snapshot as reassuring.";
  }

  return "Continue routine monitoring and confirm no new concerns.";
}

function getHigherRiskLevel(left: RiskLevel, right: RiskLevel): RiskLevel {
  return getRiskRank(right) > getRiskRank(left) ? right : left;
}

function buildRiskSummary(
  patientId: string,
  riskLevel: RiskLevel,
  whatChanged: string[],
  reasons: string[],
  suggestedActions: string[],
) {
  const changeText =
    whatChanged.length > 0 ? whatChanged.join(" ") : "No major warning signal was detected.";
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

function normalizeAsOfDate(asOf: string | Date | undefined) {
  if (asOf instanceof Date && Number.isFinite(asOf.getTime())) {
    return asOf;
  }

  if (typeof asOf === "string") {
    const parsed = new Date(asOf);
    if (Number.isFinite(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function filterAndSortAtOrBefore<T extends { timestamp: string }>(
  records: T[],
  asOfDate: Date,
) {
  const asOfTime = asOfDate.getTime();

  return records
    .filter((record) => toTimestamp(record.timestamp) <= asOfTime)
    .sort((left, right) => toTimestamp(right.timestamp) - toTimestamp(left.timestamp));
}

function filterWithinDays<T extends { timestamp: string }>(
  records: T[],
  days: number,
  asOfDate: Date,
) {
  return records.filter((record) => isWithinDays(record.timestamp, days, asOfDate));
}

function filterBetweenDays<T extends { timestamp: string }>(
  records: T[],
  minimumDays: number,
  maximumDays: number,
  asOfDate: Date,
) {
  return records.filter((record) => {
    const ageDays = getAgeInDays(record.timestamp, asOfDate);
    return ageDays >= minimumDays && ageDays <= maximumDays;
  });
}

function getAgeInDays(timestamp: string, asOfDate: Date) {
  return Math.max(0, (asOfDate.getTime() - toTimestamp(timestamp)) / (24 * 60 * 60 * 1000));
}

function formatGapDays(days: number) {
  if (days < 2) {
    return "less than 2 days";
  }

  if (days < 3) {
    return "about 2 days";
  }

  return `${Math.floor(days)} days`;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function promoteReason(reasons: string[], reason: string) {
  const reasonIndex = reasons.lastIndexOf(reason);
  if (reasonIndex > 0) {
    reasons.splice(reasonIndex, 1);
    reasons.unshift(reason);
  }
}

function hasEmergencyInterventionText(...values: Array<string | null | undefined>) {
  const normalized = normalizeReviewText(values.join(" "));
  if (normalized.length === 0) {
    return false;
  }

  if (isNegatedEmergencyIntervention(normalized)) {
    return false;
  }

  return emergencyInterventionReviewPatterns.some((pattern) => pattern.test(normalized));
}

function isNegatedEmergencyIntervention(value: string) {
  return negatedEmergencyInterventionReviewPatterns.some((pattern) => pattern.test(value));
}

function normalizeReviewText(value: string) {
  return value.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
}

const emergencyInterventionReviewPatterns = [
  /\b(crisis|mental health crisis|mobile crisis|crisis team|crisis response|crisis worker)\b.{0,80}\b(called|contacted|phoned|sent|dispatched|came|arrived|attended|visited|went to|showed up)\b/,
  /\b(called|contacted|phoned|sent|dispatched)\b.{0,80}\b(crisis|mental health crisis|mobile crisis|crisis team|crisis response|crisis worker)\b/,
  /\b(911|9-1-1|emergency services|ems|paramedic|paramedics|ambulance|police|rcmp)\b.{0,80}\b(called|contacted|phoned|sent|dispatched|came|arrived|attended|visited|went to|showed up)\b/,
  /\b(called|contacted|phoned|sent|dispatched)\b.{0,80}\b(911|9-1-1|emergency services|ems|paramedic|paramedics|ambulance|police|rcmp)\b/,
  /\b(wellness|welfare) check\b/,
];

const negatedEmergencyInterventionReviewPatterns = [
  /\b(didn'?t|did not|never|wasn'?t|was not|weren'?t|were not|no one)\b.{0,40}\b(call|called|contact|contacted|phone|phoned|send|sent|dispatch|dispatched|come|came|arrive|arrived)\b.{0,80}\b(crisis|911|9-1-1|emergency|ems|paramedic|ambulance|police|rcmp|wellness|welfare)\b/,
  /\b(crisis|911|9-1-1|emergency|ems|paramedic|ambulance|police|rcmp|wellness|welfare)\b.{0,80}\b(wasn'?t|was not|weren'?t|were not|never|not)\b.{0,40}\b(called|contacted|phoned|sent|dispatched|needed)\b/,
];

function dedupe(values: string[]) {
  return Array.from(new Set(values));
}

function isWithinDays(timestamp: string, days: number, asOfDate: Date) {
  const ageMs = asOfDate.getTime() - toTimestamp(timestamp);
  return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
}

function isHighPriorityObservation(observation: ObservationRecord) {
  return observation.priority === "High" || observation.priority === "Critical" || observation.priority === "Urgent";
}
