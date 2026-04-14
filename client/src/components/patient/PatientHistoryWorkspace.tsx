import { BookHeart, Heart, MoonStar, Shield } from "lucide-react";
import type {
  DailyReportRecord,
  EmotionRecord,
  WeeklyScreeningRecord,
} from "@shared/contracts";
import {
  DailyReportCard,
  EmotionEntryCard,
  EmptyState,
  WeeklyScreeningCard,
} from "./PatientEntryCards";

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
  return (
    <div className="content-grid">
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
            entries.map((entry) => (
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
            dailyReports.map((report) => (
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
            screenings.map((screening) => (
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
