import type {
  CrisisLevel,
  DailyReportRecord,
  EmotionRecord,
  EntryEntityType,
  ReliabilityLevel,
  UserRole,
  WeeklyScreeningRecord,
} from "../shared/contracts";

export const SYSTEM_ALERT_AUTHOR = "L.A.M.B Crisis Monitor";

export type CrisisEvaluation = {
  level: CrisisLevel;
  summary: string | null;
  evidence: string[];
};

const criticalPatterns = [
  /\b(i am|i'm|im|i feel|feel) (not safe|unsafe)\b/,
  /\b(can'?t|cannot) keep myself safe\b/,
  /\b(plan|planning|going|want|wanted|wants) to (end my life|hurt myself|self-harm|self harm|overdose|kill myself)\b/,
  /\b(going to|plan to) (overdose|hurt myself|end it|kill myself)\b/,
  /\bneed help staying safe right now\b/,
  /\bi(?: feel like)?(?: [a-z']+){0,4} (don'?t|do not|didn'?t|did not) belong on (this )?(earth|world)( anymore)?\b/,
  /\bi(?: feel like)?(?: [a-z']+){0,4} (shouldn'?t|should not) be here( anymore)?\b/,
  /\bi (want|wish) (to )?(die|be dead|not exist|disappear forever)\b/,
  /\bi wish i (was|were) dead\b/,
  /\bi (don'?t|do not) deserve to live\b/,
];

const passivePatterns = [
  /\b(don'?t|do not|didn'?t|did not) want to be here\b/,
  /\bwish(?:ed)? (i|they) (wasn'?t|weren'?t) here\b/,
  /\bfeel(?:ing)? like i (don'?t|do not|didn'?t|did not) want to be here\b/,
  /\bthoughts? about harming myself\b/,
  /\bwant to disappear\b/,
  /\brather not wake up\b/,
  /\beveryone would be better off without me\b/,
];

const historicalOrQuotedContext = [
  /\b(last year|months ago|years ago|in the past|used to|used to have)\b/,
  /\b(screen|question|form) asked\b/,
  /\b(my friend|someone else|another person|client|patient) said\b/,
  /\bden(y|ied|ying)\b/,
  /\bnot having\b/,
  /\bno current\b/,
  /\bsafe plan\b/,
  /\bcoping plan\b/,
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
}

export function evaluatePatientTextForCrisis(texts: Array<string | null | undefined>) {
  const evidence: string[] = [];
  let level: CrisisLevel = "none";

  for (const rawValue of texts) {
    const normalized = normalizeText(rawValue ?? "");
    if (normalized.length === 0) {
      continue;
    }

    const hasHistoricalContext = historicalOrQuotedContext.some((pattern) =>
      pattern.test(normalized),
    );

    if (!hasHistoricalContext) {
      for (const pattern of criticalPatterns) {
        if (pattern.test(normalized)) {
          level = "critical";
          evidence.push("Text suggests active self-harm intent or inability to stay safe.");
          break;
        }
      }
    }

    if (level !== "critical") {
      for (const pattern of passivePatterns) {
        if (pattern.test(normalized)) {
          level = "high";
          evidence.push("Text suggests thoughts about self-harm or not wanting to be here.");
          break;
        }
      }
    }

    if (level === "critical") {
      break;
    }
  }

  return {
    level,
    evidence: Array.from(new Set(evidence)),
    summary:
      level === "critical"
        ? "Patient text suggests active self-harm intent or an immediate need for safety support."
        : level === "high"
          ? "Patient text suggests thoughts about self-harm or not wanting to be here."
          : null,
  } satisfies CrisisEvaluation;
}

export function buildReliabilityLevel(
  editCount: number,
  suspiciousEditCount: number,
  mismatchLevel: "none" | "watch" | "high" = "none",
): ReliabilityLevel {
  if (suspiciousEditCount > 0 || editCount >= 2 || mismatchLevel === "high") {
    return "Low";
  }

  if (editCount === 1 || mismatchLevel === "watch") {
    return "Medium";
  }

  return "High";
}

export function summarizeRevision(
  entityType: EntryEntityType,
  actorRole: UserRole,
  suspicious: boolean,
) {
  const subject =
    entityType === "emotion"
      ? "check-in"
      : entityType === "daily_report"
        ? "daily report"
        : "weekly screen";

  if (suspicious) {
    return `Patient ${subject} edit softened a higher-risk answer and should be reviewed.`;
  }

  return `${actorRole === "patient" ? "Patient" : "Support worker"} updated a ${subject}.`;
}

export function evaluateSuspiciousEdit(
  entityType: EntryEntityType,
  beforeValue: EmotionRecord | DailyReportRecord | WeeklyScreeningRecord,
  afterValue: EmotionRecord | DailyReportRecord | WeeklyScreeningRecord,
) {
  if (entityType === "emotion") {
    const before = beforeValue as EmotionRecord;
    const after = afterValue as EmotionRecord;

    if (before.substanceUseToday && !after.substanceUseToday) {
      return true;
    }

    if ((before.cravingLevel ?? 0) >= 8 && (after.cravingLevel ?? 10) <= 4) {
      return true;
    }

    if ((before.stressLevel ?? 0) >= 8 && (after.stressLevel ?? 10) <= 4) {
      return true;
    }

    if (
      (before.medicationAdherence === "missed_some" ||
        before.medicationAdherence === "missed_all") &&
      after.medicationAdherence === "took_as_prescribed"
    ) {
      return true;
    }

    return false;
  }

  if (entityType === "daily_report") {
    const before = beforeValue as DailyReportRecord;
    const after = afterValue as DailyReportRecord;

    if ((before.wakeUps ?? 0) >= 3 && (after.wakeUps ?? 10) <= 1) {
      return true;
    }

    if (before.feltRested === false && after.feltRested === true) {
      return true;
    }

    if ((before.mealsCount ?? 99) <= 1 && (after.mealsCount ?? 0) >= 3) {
      return true;
    }

    if (
      (before.sleepQuality === "very_bad" || before.sleepQuality === "bad") &&
      (after.sleepQuality === "good" || after.sleepQuality === "very_good")
    ) {
      return true;
    }

    return false;
  }

  const before = beforeValue as WeeklyScreeningRecord;
  const after = afterValue as WeeklyScreeningRecord;

  return Boolean(
    (before.currentThoughts && !after.currentThoughts) ||
      (before.thoughtsKillingSelf && !after.thoughtsKillingSelf) ||
      (before.wishedDead && !after.wishedDead) ||
      (before.familyBetterOffDead && !after.familyBetterOffDead) ||
      (before.needsHelpStayingSafe && !after.needsHelpStayingSafe),
  );
}
