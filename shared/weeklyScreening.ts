import { format } from "date-fns";
import {
  appetiteChangeDirectionLabels,
  weeklyScreeningFrequencyLabels,
  type WeeklyScreeningRecord,
} from "./contracts";

export type WeeklyScreeningDisposition =
  | "negative"
  | "history"
  | "positive"
  | "urgent";

export function getWeeklyScreeningDisposition(
  screening: Pick<
    WeeklyScreeningRecord,
    | "wishedDead"
    | "familyBetterOffDead"
    | "thoughtsKillingSelf"
    | "everTriedToKillSelf"
    | "attemptTiming"
    | "currentThoughts"
  >,
): WeeklyScreeningDisposition {
  if (screening.currentThoughts === true) {
    return "urgent";
  }

  if (
    screening.wishedDead ||
    screening.familyBetterOffDead ||
    screening.thoughtsKillingSelf
  ) {
    return "positive";
  }

  if (
    screening.everTriedToKillSelf &&
    screening.attemptTiming === "within_year"
  ) {
    return "positive";
  }

  if (screening.everTriedToKillSelf) {
    return "history";
  }

  return "negative";
}

export function getWeeklyScreeningDispositionLabel(
  disposition: WeeklyScreeningDisposition,
) {
  switch (disposition) {
    case "urgent":
      return "Urgent safety review";
    case "positive":
      return "Positive safety screen";
    case "history":
      return "History needs review";
    default:
      return "Negative safety screen";
  }
}

export function getWeeklyScreeningRecommendedAction(
  disposition: WeeklyScreeningDisposition,
) {
  switch (disposition) {
    case "urgent":
      return "Immediate mental health evaluation and do not leave the patient alone.";
    case "positive":
      return "Same-day brief suicide safety assessment and safety planning.";
    case "history":
      return "Review past suicidal behavior and confirm current supports.";
    default:
      return "No urgent suicide follow-up identified from this screen.";
  }
}

export function getWeeklyScreeningPositiveCount(
  screening: Pick<
    WeeklyScreeningRecord,
    | "wishedDead"
    | "familyBetterOffDead"
    | "thoughtsKillingSelf"
    | "everTriedToKillSelf"
    | "depressedHardToFunction"
    | "anxiousOnEdge"
    | "hopeless"
    | "couldNotEnjoyThings"
    | "keepingToSelf"
    | "moreIrritable"
    | "substanceUseMoreThanUsual"
    | "sleepTrouble"
    | "appetiteChange"
  >,
) {
  const values = [
    screening.wishedDead,
    screening.familyBetterOffDead,
    screening.thoughtsKillingSelf,
    screening.everTriedToKillSelf,
    screening.depressedHardToFunction,
    screening.anxiousOnEdge,
    screening.hopeless,
    screening.couldNotEnjoyThings,
    screening.keepingToSelf,
    screening.moreIrritable,
    screening.substanceUseMoreThanUsual,
    screening.sleepTrouble,
    screening.appetiteChange,
  ];

  return values.filter(Boolean).length;
}

export function getWeeklyScreeningSignals(
  screening: Pick<
    WeeklyScreeningRecord,
    | "wishedDead"
    | "familyBetterOffDead"
    | "thoughtsKillingSelf"
    | "thoughtsKillingSelfFrequency"
    | "everTriedToKillSelf"
    | "attemptTiming"
    | "currentThoughts"
    | "depressedHardToFunction"
    | "depressedFrequency"
    | "anxiousOnEdge"
    | "anxiousFrequency"
    | "hopeless"
    | "couldNotEnjoyThings"
    | "keepingToSelf"
    | "moreIrritable"
    | "substanceUseMoreThanUsual"
    | "substanceUseFrequency"
    | "sleepTrouble"
    | "sleepTroubleFrequency"
    | "appetiteChange"
    | "appetiteChangeDirection"
    | "needsHelpStayingSafe"
  >,
) {
  const signals: string[] = [];

  if (screening.currentThoughts) {
    signals.push("Current suicidal thoughts reported");
  }

  if (screening.thoughtsKillingSelf) {
    signals.push(
      screening.thoughtsKillingSelfFrequency
        ? `Recent thoughts about killing self were reported ${weeklyScreeningFrequencyLabels[screening.thoughtsKillingSelfFrequency].toLowerCase()} this week`
        : "Recent thoughts about killing self",
    );
  }

  if (screening.everTriedToKillSelf) {
    signals.push(
      screening.attemptTiming === "within_year"
        ? "Past suicide attempt within the last year"
        : "Past suicide attempt reported",
    );
  }

  if (screening.hopeless && screening.couldNotEnjoyThings) {
    signals.push("Hopelessness and loss of enjoyment reported");
  }

  if (screening.depressedHardToFunction) {
    signals.push(
      screening.depressedFrequency
        ? `Depression affected daily function ${weeklyScreeningFrequencyLabels[screening.depressedFrequency].toLowerCase()} this week`
        : "Depression is affecting daily function",
    );
  }

  if (screening.anxiousOnEdge) {
    signals.push(
      screening.anxiousFrequency
        ? `Anxiety or agitation affected daily function ${weeklyScreeningFrequencyLabels[screening.anxiousFrequency].toLowerCase()} this week`
        : "Anxiety or agitation is affecting daily function",
    );
  }

  if (screening.substanceUseMoreThanUsual) {
    signals.push(
      screening.substanceUseFrequency
        ? `More substance or alcohol use than usual was reported ${weeklyScreeningFrequencyLabels[screening.substanceUseFrequency].toLowerCase()} this week`
        : "More substance or alcohol use than usual",
    );
  }

  if (screening.sleepTrouble) {
    signals.push(
      screening.sleepTroubleFrequency
        ? `Sleep trouble was reported ${weeklyScreeningFrequencyLabels[screening.sleepTroubleFrequency].toLowerCase()} this week`
        : "Sleep trouble reported this week",
    );
  }

  if (screening.appetiteChange) {
    signals.push(
      screening.appetiteChangeDirection
        ? `Appetite changed this week: ${appetiteChangeDirectionLabels[screening.appetiteChangeDirection].toLowerCase()}`
        : "Appetite change reported this week",
    );
  }

  if (screening.needsHelpStayingSafe) {
    signals.push("Patient says they need help staying safe");
  }

  return signals;
}

export function getWeeklyScreeningFollowUpDetails(
  screening: Pick<
    WeeklyScreeningRecord,
    | "thoughtsKillingSelf"
    | "thoughtsKillingSelfFrequency"
    | "depressedHardToFunction"
    | "depressedFrequency"
    | "anxiousOnEdge"
    | "anxiousFrequency"
    | "substanceUseMoreThanUsual"
    | "substanceUseFrequency"
    | "sleepTrouble"
    | "sleepTroubleFrequency"
    | "appetiteChange"
    | "appetiteChangeDirection"
  >,
) {
  const details: string[] = [];

  if (screening.thoughtsKillingSelf && screening.thoughtsKillingSelfFrequency) {
    details.push(
      `Thoughts about killing self: ${weeklyScreeningFrequencyLabels[screening.thoughtsKillingSelfFrequency]}`,
    );
  }

  if (screening.depressedHardToFunction && screening.depressedFrequency) {
    details.push(
      `Low mood made daily life hard: ${weeklyScreeningFrequencyLabels[screening.depressedFrequency]}`,
    );
  }

  if (screening.anxiousOnEdge && screening.anxiousFrequency) {
    details.push(
      `Anxiety or agitation made daily life hard: ${weeklyScreeningFrequencyLabels[screening.anxiousFrequency]}`,
    );
  }

  if (screening.substanceUseMoreThanUsual && screening.substanceUseFrequency) {
    details.push(
      `Used more drugs or alcohol than usual: ${weeklyScreeningFrequencyLabels[screening.substanceUseFrequency]}`,
    );
  }

  if (screening.sleepTrouble && screening.sleepTroubleFrequency) {
    details.push(
      `Sleep trouble: ${weeklyScreeningFrequencyLabels[screening.sleepTroubleFrequency]}`,
    );
  }

  if (screening.appetiteChange && screening.appetiteChangeDirection) {
    details.push(
      `Appetite change: ${appetiteChangeDirectionLabels[screening.appetiteChangeDirection]}`,
    );
  }

  return details;
}

export function getLatestWeeklyScreening(
  screenings: WeeklyScreeningRecord[],
) {
  return screenings[0] ?? null;
}

export function isWeeklyScreeningDue(
  screenings: WeeklyScreeningRecord[],
  intervalDays = 7,
) {
  const latest = getLatestWeeklyScreening(screenings);

  if (!latest) {
    return true;
  }

  const latestTime = new Date(latest.timestamp).getTime();
  const threshold = Date.now() - intervalDays * 24 * 60 * 60 * 1000;
  return latestTime < threshold;
}

export function getWeeklyScreeningStatusText(
  screenings: WeeklyScreeningRecord[],
  intervalDays = 7,
) {
  const latest = getLatestWeeklyScreening(screenings);

  if (!latest) {
    return "No weekly screen saved yet.";
  }

  if (isWeeklyScreeningDue(screenings, intervalDays)) {
    return `Last weekly screen was ${format(new Date(latest.timestamp), "MMM d")}. A new one is due.`;
  }

  return `Weekly screen last saved ${format(new Date(latest.timestamp), "MMM d")}.`;
}
