import { format } from "date-fns";
import { Activity, BarChart3, BookHeart, Heart, MoonStar, Pill, Shield, TrendingUp } from "lucide-react";
import type {
  DailyReportRecord,
  EmotionRecord,
  SleepQuality,
  WeeklyScreeningRecord,
} from "@shared/contracts";
import type { ReactNode } from "react";
import {
  DailyReportCard,
  EmotionEntryCard,
  EmptyState,
  WeeklyScreeningCard,
} from "./PatientEntryCards";
import { getSleepDurationHours } from "../../lib/dailyReports";
import { getWeeklyScreeningSignals } from "@shared/weeklyScreening";

type PatientHistoryWorkspaceProps = {
  entries: EmotionRecord[];
  dailyReports: DailyReportRecord[];
  screenings: WeeklyScreeningRecord[];
  isLoadingEntries: boolean;
  isLoadingDailyReports: boolean;
  isLoadingScreenings: boolean;
  onEditEntry: (entry: EmotionRecord) => void;
  onEditDailyReport: (report: DailyReportRecord) => void;
  onEditScreening: (screening: WeeklyScreeningRecord) => void;
};

export default function PatientHistoryWorkspace({
  entries,
  dailyReports,
  screenings,
  isLoadingEntries,
  isLoadingDailyReports,
  isLoadingScreenings,
  onEditEntry,
  onEditDailyReport,
  onEditScreening,
}: PatientHistoryWorkspaceProps) {
  const moodPoints = buildMoodTrend(entries);
  const sleepPoints = buildSleepTrend(entries, dailyReports);
  const stressPoints = buildNumberTrend(entries, "stressLevel", "Stress");
  const cravingPoints = buildNumberTrend(entries, "cravingLevel", "Cravings");
  const substancePoints = buildSubstanceTrend(entries);
  const medicationPoints = buildMedicationTrend(entries);
  const mealPoints = buildMealTrend(dailyReports);
  const weeklySignalPoints = buildWeeklySignalTrend(screenings);

  return (
    <div className="content-grid">
      <section className="surface-panel xl:col-span-2">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-teal-600" />
          <div>
            <h3 className="section-title text-lg">Your dashboard</h3>
            <p className="section-copy">Recent patterns from your saved mood, sleep, meal, medication, substance, and weekly screen entries.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <TrendPanel
            title="Mood pattern"
            detail={moodPoints.length > 0 ? `${moodPoints.length} recent mood entries` : "No mood trend yet"}
            icon={<Heart className="h-4 w-4" />}
          >
            <LineTrend points={moodPoints} min={1} max={4} emptyMessage="Save mood check-ins to see this chart." />
          </TrendPanel>

          <TrendPanel
            title="Sleep hours"
            detail={sleepPoints.length > 0 ? `${sleepPoints.length} sleep data points` : "No sleep trend yet"}
            icon={<MoonStar className="h-4 w-4" />}
          >
            <LineTrend points={sleepPoints} min={0} max={12} emptyMessage="Save sleep reports or check-ins to see this chart." valueSuffix="h" />
          </TrendPanel>

          <TrendPanel
            title="Stress"
            detail={stressPoints.length > 0 ? "0 to 10 scale" : "No stress trend yet"}
            icon={<TrendingUp className="h-4 w-4" />}
          >
            <LineTrend points={stressPoints} min={0} max={10} emptyMessage="Save check-ins to see stress over time." />
          </TrendPanel>

          <TrendPanel
            title="Cravings"
            detail={cravingPoints.length > 0 ? "0 to 10 scale" : "No craving trend yet"}
            icon={<Activity className="h-4 w-4" />}
          >
            <LineTrend points={cravingPoints} min={0} max={10} emptyMessage="Save check-ins to see cravings over time." />
          </TrendPanel>

          <TrendPanel
            title="Substance use"
            detail={substancePoints.some((point) => point.value > 0) ? "Reported days are highlighted" : "No reported use in this range"}
            icon={<Shield className="h-4 w-4" />}
          >
            <BarTrend points={substancePoints} max={1} emptyMessage="Substance-use answers will appear here." yesNo />
          </TrendPanel>

          <TrendPanel
            title="Medication"
            detail="0 none, 1 missed some, 2 missed all"
            icon={<Pill className="h-4 w-4" />}
          >
            <BarTrend points={medicationPoints} max={2} emptyMessage="Medication answers will appear here." />
          </TrendPanel>

          <TrendPanel
            title="Meals"
            detail={mealPoints.length > 0 ? "Night report meal count" : "No meal trend yet"}
            icon={<BookHeart className="h-4 w-4" />}
          >
            <BarTrend points={mealPoints} max={6} emptyMessage="Night report meal counts will appear here." />
          </TrendPanel>

          <TrendPanel
            title="Weekly screen signals"
            detail={weeklySignalPoints.length > 0 ? "Number of follow-up signals" : "No weekly screen trend yet"}
            icon={<Shield className="h-4 w-4" />}
          >
            <BarTrend points={weeklySignalPoints} max={8} emptyMessage="Weekly screen signals will appear here." />
          </TrendPanel>
        </div>
      </section>

      <section className="surface-panel">
        <div className="flex items-center gap-3">
          <Heart className="h-5 w-5 text-rose-500" />
          <div>
            <h3 className="section-title text-lg">Mood history</h3>
            <p className="section-copy">Your recent emotion check-ins and follow-up details.</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {isLoadingEntries ? (
            <EmptyState message="Loading your recent entries..." />
          ) : entries.length > 0 ? (
            entries.slice(0, 8).map((entry) => (
              <div key={entry.id} className="space-y-3">
                <EmotionEntryCard entry={entry} />
                <button type="button" className="btn btn-secondary w-full" onClick={() => onEditEntry(entry)}>
                  Edit This Check-In
                </button>
              </div>
            ))
          ) : (
            <EmptyState message="No mood entries yet. Save your first mood check-in to build your history." />
          )}
        </div>
      </section>

      <div className="content-stack">
        <section className="surface-panel">
          <div className="flex items-center gap-3">
            <MoonStar className="h-5 w-5 text-indigo-500" />
            <div>
              <h3 className="section-title text-lg">Sleep history</h3>
              <p className="section-copy">Your recent morning and night report timeline.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
          {isLoadingDailyReports ? (
            <EmptyState message="Loading your sleep reports..." />
          ) : dailyReports.length > 0 ? (
            dailyReports.slice(0, 8).map((report) => (
              <div key={report.id} className="space-y-3">
                <DailyReportCard report={report} />
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={() => onEditDailyReport(report)}
                >
                  Edit This Report
                </button>
              </div>
            ))
          ) : (
            <EmptyState message="No sleep reports yet. Save a morning or night report to build your history." />
          )}
          </div>
        </section>

        <section className="surface-panel">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-sky-600" />
            <div>
              <h3 className="section-title text-lg">Weekly screening history</h3>
              <p className="section-copy">Your recent weekly safety and symptom screens.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
          {isLoadingScreenings ? (
            <EmptyState message="Loading your weekly screens..." />
          ) : screenings.length > 0 ? (
            screenings.slice(0, 8).map((screening) => (
              <div key={screening.id} className="space-y-3">
                <WeeklyScreeningCard screening={screening} />
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={() => onEditScreening(screening)}
                >
                  Edit This Weekly Screen
                </button>
              </div>
            ))
          ) : (
            <EmptyState message="No weekly safety screens yet. Save one to build your weekly screening history." />
          )}
          </div>
        </section>

        <section className="surface-panel">
          <div className="flex items-center gap-3">
            <BookHeart className="h-5 w-5 text-sky-500" />
            <div>
              <h3 className="section-title text-lg">What this history helps with</h3>
              <p className="section-copy">Your care team can compare mood and routine over time.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              Mood entries help show emotional changes across days and weeks.
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              Morning and night sleep reports help explain routine changes around the same time.
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              Weekly safety screens help show when thoughts, hopelessness, or support needs change.
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              When both are filled out, staff can spot patterns faster before the next visit.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

type ChartPoint = {
  id: string;
  date: Date;
  label: string;
  value: number;
  description?: string;
};

const moodScores: Record<EmotionRecord["emotion"], number> = {
  Angry: 1,
  Sad: 2,
  Worried: 3,
  Happy: 4,
};

const sleepQualityScores: Record<SleepQuality, number> = {
  very_bad: 2,
  bad: 4,
  okay: 6,
  good: 8,
  very_good: 10,
};

function buildMoodTrend(entries: EmotionRecord[]) {
  return recentPoints(
    entries.map((entry) => ({
      id: `mood-${entry.id}`,
      date: entryDate(entry),
      label: chartDate(entryDate(entry)),
      value: moodScores[entry.emotion],
      description: entry.emotion,
    })),
  );
}

function buildSleepTrend(entries: EmotionRecord[], reports: DailyReportRecord[]) {
  const entryPoints = entries
    .filter((entry) => entry.sleepHours != null)
    .map((entry) => ({
      id: `sleep-entry-${entry.id}`,
      date: entryDate(entry),
      label: chartDate(entryDate(entry)),
      value: Number(entry.sleepHours),
      description: "Check-in sleep hours",
    }));

  const reportPoints = reports.flatMap((report) => {
    const duration = getSleepDurationHours(report.bedTime, report.wakeTime);
    const qualityFallback = report.sleepQuality ? sleepQualityScores[report.sleepQuality] : null;
    const value = duration ?? qualityFallback;

    if (value == null) {
      return [];
    }

    return [
      {
        id: `sleep-report-${report.id}`,
        date: new Date(report.timestamp),
        label: chartDate(new Date(report.timestamp)),
        value,
        description: duration == null ? "Sleep quality score" : "Morning report sleep hours",
      },
    ];
  });

  return recentPoints([...entryPoints, ...reportPoints]);
}

function buildNumberTrend(
  entries: EmotionRecord[],
  key: "stressLevel" | "cravingLevel",
  description: string,
) {
  return recentPoints(
    entries
      .filter((entry) => entry[key] != null)
      .map((entry) => ({
        id: `${key}-${entry.id}`,
        date: entryDate(entry),
        label: chartDate(entryDate(entry)),
        value: Number(entry[key]),
        description,
      })),
  );
}

function buildSubstanceTrend(entries: EmotionRecord[]) {
  return recentPoints(
    entries
      .filter((entry) => entry.substanceUseToday != null)
      .map((entry) => ({
        id: `substance-${entry.id}`,
        date: entryDate(entry),
        label: chartDate(entryDate(entry)),
        value: entry.substanceUseToday ? 1 : 0,
        description: entry.substanceUseToday
          ? entry.substanceUsed
            ? `Used: ${entry.substanceUsed}`
            : "Used: yes"
          : "No use reported",
      })),
  );
}

function buildMedicationTrend(entries: EmotionRecord[]) {
  return recentPoints(
    entries
      .filter((entry) => entry.medicationAdherence != null)
      .map((entry) => {
        const value =
          entry.medicationAdherence === "missed_all"
            ? 2
            : entry.medicationAdherence === "missed_some"
              ? 1
              : 0;

        return {
          id: `medication-${entry.id}`,
          date: entryDate(entry),
          label: chartDate(entryDate(entry)),
          value,
          description:
            entry.missedMedicationName && value > 0
              ? `Missed: ${entry.missedMedicationName}`
              : entry.medicationAdherence?.replaceAll("_", " "),
        };
      }),
  );
}

function buildMealTrend(reports: DailyReportRecord[]) {
  return recentPoints(
    reports
      .filter((report) => report.mealsCount != null)
      .map((report) => ({
        id: `meals-${report.id}`,
        date: new Date(report.timestamp),
        label: chartDate(new Date(report.timestamp)),
        value: Number(report.mealsCount),
        description: `${report.mealsCount} meal${report.mealsCount === 1 ? "" : "s"}`,
      })),
  );
}

function buildWeeklySignalTrend(screenings: WeeklyScreeningRecord[]) {
  return recentPoints(
    screenings.map((screening) => ({
      id: `screening-${screening.id}`,
      date: new Date(screening.timestamp),
      label: chartDate(new Date(screening.timestamp)),
      value: getWeeklyScreeningSignals(screening).length,
      description: `${getWeeklyScreeningSignals(screening).length} follow-up signal(s)`,
    })),
  );
}

function recentPoints(points: ChartPoint[], limit = 14) {
  return points
    .filter((point) => !Number.isNaN(point.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-limit);
}

function entryDate(entry: EmotionRecord) {
  return new Date(entry.occurredAt ?? entry.timestamp);
}

function chartDate(date: Date) {
  return Number.isNaN(date.getTime()) ? "Unknown" : format(date, "MMM d");
}

function TrendPanel({
  title,
  detail,
  icon,
  children,
}: {
  title: string;
  detail: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-teal-700">
          {icon}
        </div>
      </div>
      {children}
    </div>
  );
}

function LineTrend({
  points,
  min,
  max,
  emptyMessage,
  valueSuffix = "",
}: {
  points: ChartPoint[];
  min: number;
  max: number;
  emptyMessage: string;
  valueSuffix?: string;
}) {
  if (points.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  const width = 320;
  const height = 120;
  const padding = 18;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const range = Math.max(1, max - min);
  const coordinates = points.map((point, index) => {
    const x = padding + (points.length === 1 ? usableWidth / 2 : (index / (points.length - 1)) * usableWidth);
    const y = padding + (1 - (Math.min(max, Math.max(min, point.value)) - min) / range) * usableHeight;
    return { ...point, x, y };
  });
  const path = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const latest = points[points.length - 1];

  return (
    <div className="mt-4">
      <svg className="h-32 w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${latest.description ?? "Latest"} ${latest.value}${valueSuffix}`}>
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#dbeafe" strokeWidth="1" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#dbeafe" strokeWidth="1" />
        <path d={path} fill="none" stroke="#2f959c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map((point) => (
          <circle key={point.id} cx={point.x} cy={point.y} r="4.5" fill="#fff" stroke="#2f959c" strokeWidth="3">
            <title>{`${point.label}: ${point.description ?? point.value}${valueSuffix}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{points[0].label}</span>
        <span className="font-semibold text-slate-700">
          Latest: {latest.description ?? `${latest.value}${valueSuffix}`}
        </span>
        <span>{latest.label}</span>
      </div>
    </div>
  );
}

function BarTrend({
  points,
  max,
  emptyMessage,
  yesNo = false,
}: {
  points: ChartPoint[];
  max: number;
  emptyMessage: string;
  yesNo?: boolean;
}) {
  if (points.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="mt-4">
      <div className="flex h-32 items-end gap-2 rounded-[18px] border border-slate-100 bg-slate-50 px-3 py-3">
        {points.map((point) => {
          const height = Math.max(8, (Math.min(max, point.value) / Math.max(1, max)) * 96);
          return (
            <div key={point.id} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                className={`w-full rounded-t-[10px] ${point.value > 0 ? "bg-teal-500" : "bg-slate-300"}`}
                style={{ height }}
                title={`${point.label}: ${point.description ?? point.value}`}
              />
              <span className="max-w-full truncate text-[10px] text-slate-500">{point.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{points[0].label}</span>
        <span className="font-semibold text-slate-700">
          Latest: {yesNo ? (points[points.length - 1].value > 0 ? "Yes" : "No") : points[points.length - 1].description ?? points[points.length - 1].value}
        </span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}
