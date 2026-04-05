import {
  dailyReportTypeLabels,
  type DailyReportType,
  sleepQualityLabels,
  type DailyReportRecord,
  type SleepQuality,
} from "@shared/contracts";

const sleepQualityScores: Record<SleepQuality, number> = {
  very_bad: 1,
  bad: 2,
  okay: 3,
  good: 4,
  very_good: 5,
};

export function formatClockTime(value: string | null | undefined) {
  if (!value) {
    return "Not recorded";
  }

  const [hourText, minuteText] = value.split(":");
  const hours = Number(hourText);
  const minutes = Number(minuteText);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return value;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function getSleepDurationHours(
  bedTime: string | null | undefined,
  wakeTime: string | null | undefined,
) {
  if (!bedTime || !wakeTime) {
    return null;
  }

  const bedtimeMinutes = parseTimeToMinutes(bedTime);
  const wakeMinutes = parseTimeToMinutes(wakeTime);

  if (bedtimeMinutes == null || wakeMinutes == null) {
    return null;
  }

  let minutesAsleep = wakeMinutes - bedtimeMinutes;

  if (minutesAsleep <= 0) {
    minutesAsleep += 24 * 60;
  }

  return minutesAsleep / 60;
}

export function getAverageSleepDuration(reports: DailyReportRecord[]) {
  const durations = reports
    .filter((report) => report.reportType === "morning")
    .map((report) => getSleepDurationHours(report.bedTime, report.wakeTime))
    .filter((value): value is number => value != null);

  if (durations.length === 0) {
    return null;
  }

  return durations.reduce((total, value) => total + value, 0) / durations.length;
}

export function getAverageWakeUps(reports: DailyReportRecord[]) {
  const wakeUps = reports
    .map((report) => report.wakeUps)
    .filter((value): value is number => value != null);

  if (wakeUps.length === 0) {
    return null;
  }

  return wakeUps.reduce((total, value) => total + value, 0) / wakeUps.length;
}

export function getAverageSleepQuality(reports: DailyReportRecord[]) {
  const qualityScores = reports
    .map((report) =>
      report.sleepQuality == null ? null : sleepQualityScores[report.sleepQuality],
    )
    .filter((value): value is number => value != null);

  if (qualityScores.length === 0) {
    return null;
  }

  const averageScore =
    qualityScores.reduce((total, value) => total + value, 0) / qualityScores.length;

  return getClosestSleepQualityLabel(averageScore);
}

export function getLatestDailyReportByType(
  reports: DailyReportRecord[],
  reportType: DailyReportType,
) {
  return reports.find((report) => report.reportType === reportType) ?? null;
}

export function hasDailyReportToday(
  reports: DailyReportRecord[],
  reportType: DailyReportType,
  now = new Date(),
) {
  const report = getLatestDailyReportByType(reports, reportType);

  if (!report) {
    return false;
  }

  return isSameCalendarDay(new Date(report.timestamp), now);
}

export function getDailyReportStatusText(
  reports: DailyReportRecord[],
  reportType: DailyReportType,
  now = new Date(),
) {
  const label = dailyReportTypeLabels[reportType];
  const latestReport = getLatestDailyReportByType(reports, reportType);

  if (!latestReport) {
    return `No ${label.toLowerCase()} has been saved yet.`;
  }

  if (isSameCalendarDay(new Date(latestReport.timestamp), now)) {
    return `${label} saved today at ${new Date(latestReport.timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}.`;
  }

  return `Last ${label.toLowerCase()} was saved on ${new Date(latestReport.timestamp).toLocaleDateString()}.`;
}

function parseTimeToMinutes(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hours = Number(hourText);
  const minutes = Number(minuteText);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function getClosestSleepQualityLabel(score: number) {
  const closestQuality = Object.entries(sleepQualityScores).reduce<{
    quality: SleepQuality;
    difference: number;
  }>(
    (closest, [quality, qualityScore]) => {
      const difference = Math.abs(qualityScore - score);

      if (difference < closest.difference) {
        return {
          quality: quality as SleepQuality,
          difference,
        };
      }

      return closest;
    },
    {
      quality: "okay",
      difference: Number.POSITIVE_INFINITY,
    },
  );

  return sleepQualityLabels[closestQuality.quality];
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}
