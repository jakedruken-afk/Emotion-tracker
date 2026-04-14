import { BookHeart, Clock3, MoonStar } from "lucide-react";
import MetricTile from "../MetricTile";
import {
  sleepQualityLabels,
  sleepQualityOptions,
  type DailyReportRecord,
  type SleepQuality,
} from "@shared/contracts";
import {
  formatClockTime,
  getDailyReportStatusText,
} from "../../lib/dailyReports";
import { DailyReportCard, EmptyState } from "./PatientEntryCards";
import type { FormEvent, ReactNode } from "react";

type MorningReportFormState = {
  bedTime: string;
  wakeTime: string;
  sleepQuality: SleepQuality | "";
  wakeUps: string;
  feltRested: "" | "yes" | "no";
  notes: string;
};

type NightReportFormState = {
  bedTime: string;
  mealsCount: string;
  mealsNote: string;
  notes: string;
};

type PatientSleepWorkspaceProps = {
  dailyReports: DailyReportRecord[];
  recentDailyReports: DailyReportRecord[];
  isLoadingDailyReports: boolean;
  morningSavedToday: boolean;
  nightSavedToday: boolean;
  morningDueNow: boolean;
  nightDueNow: boolean;
  latestMorningReport: DailyReportRecord | null;
  latestNightReport: DailyReportRecord | null;
  morningReport: MorningReportFormState;
  nightReport: NightReportFormState;
  isSavingMorningReport: boolean;
  isSavingNightReport: boolean;
  editingMorningReportId: number | null;
  editingNightReportId: number | null;
  onMorningReportChange: (nextValue: MorningReportFormState) => void;
  onNightReportChange: (nextValue: NightReportFormState) => void;
  onMorningReportSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNightReportSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancelMorningEdit: () => void;
  onCancelNightEdit: () => void;
};

export default function PatientSleepWorkspace({
  dailyReports,
  recentDailyReports,
  isLoadingDailyReports,
  morningSavedToday,
  nightSavedToday,
  morningDueNow,
  nightDueNow,
  latestMorningReport,
  latestNightReport,
  morningReport,
  nightReport,
  isSavingMorningReport,
  isSavingNightReport,
  editingMorningReportId,
  editingNightReportId,
  onMorningReportChange,
  onNightReportChange,
  onMorningReportSubmit,
  onNightReportSubmit,
  onCancelMorningEdit,
  onCancelNightEdit,
}: PatientSleepWorkspaceProps) {
  const now = new Date();

  return (
    <div className="content-stack">
      <section className="hero-panel">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Sleep Reports</p>
            <h3 className="hero-title text-balance">
              Morning and night forms are separated so sleep tracking feels easier.
            </h3>
            <p className="hero-text">
              Use the morning form after waking up and the night form before bed. The reminder cards below show what is already done today.
            </p>
          </div>

          <div className="metric-grid">
            <MetricTile
              label="Morning status"
              value={morningSavedToday ? "Done" : morningDueNow ? "Needed" : "Later"}
              detail={getDailyReportStatusText(dailyReports, "morning", now)}
              tone="gold"
            />
            <MetricTile
              label="Night status"
              value={nightSavedToday ? "Done" : nightDueNow ? "Needed" : "Later"}
              detail={getDailyReportStatusText(dailyReports, "night", now)}
              tone="plum"
            />
            <MetricTile
              label="Last wake time"
              value={latestMorningReport?.wakeTime ? formatClockTime(latestMorningReport.wakeTime) : "N/A"}
              detail="Pulled from your most recent morning report."
              tone="sky"
            />
            <MetricTile
              label="Last bedtime"
              value={latestNightReport?.bedTime ? formatClockTime(latestNightReport.bedTime) : "N/A"}
              detail="Pulled from your most recent night report."
              tone="mint"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <form className="surface-panel" onSubmit={onMorningReportSubmit}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mini-heading">Morning Report</p>
              <h3 className="section-title mt-3">
                {editingMorningReportId != null
                  ? "Update how last night went."
                  : "Tell us how last night went."}
              </h3>
              <p className="section-copy">
                Keep it simple: sleep time, wake time, quality, and whether you feel rested.
              </p>
            </div>
            <div className="hidden h-14 w-14 items-center justify-center rounded-[22px] bg-amber-100 text-amber-600 md:flex">
              <Clock3 className="h-7 w-7" />
            </div>
          </div>

          <div className="form-grid mt-6">
            <Field label="What time did you go to sleep?" htmlFor="morning-bedtime">
              <input
                id="morning-bedtime"
                type="time"
                className="input"
                value={morningReport.bedTime}
                onChange={(event) =>
                  onMorningReportChange({
                    ...morningReport,
                    bedTime: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="What time did you wake up?" htmlFor="morning-waketime">
              <input
                id="morning-waketime"
                type="time"
                className="input"
                value={morningReport.wakeTime}
                onChange={(event) =>
                  onMorningReportChange({
                    ...morningReport,
                    wakeTime: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="How did you sleep?" htmlFor="morning-sleep-quality">
              <select
                id="morning-sleep-quality"
                className="input"
                value={morningReport.sleepQuality}
                onChange={(event) =>
                  onMorningReportChange({
                    ...morningReport,
                    sleepQuality: event.target.value as SleepQuality | "",
                  })
                }
              >
                <option value="">Choose one</option>
                {sleepQualityOptions.map((option) => (
                  <option key={option} value={option}>
                    {sleepQualityLabels[option]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="How many times did you wake up?" htmlFor="morning-wakeups">
              <input
                id="morning-wakeups"
                type="number"
                min="0"
                max="20"
                className="input"
                value={morningReport.wakeUps}
                onChange={(event) =>
                  onMorningReportChange({
                    ...morningReport,
                    wakeUps: event.target.value,
                  })
                }
                placeholder="0"
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Do you feel rested this morning?" htmlFor="morning-rested">
                <select
                  id="morning-rested"
                  className="input"
                  value={morningReport.feltRested}
                  onChange={(event) =>
                    onMorningReportChange({
                      ...morningReport,
                      feltRested: event.target.value as MorningReportFormState["feltRested"],
                    })
                  }
                >
                  <option value="">Choose one</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Sleep notes (optional)" htmlFor="morning-notes">
                <textarea
                  id="morning-notes"
                  className="input min-h-28 resize-y"
                  maxLength={300}
                  value={morningReport.notes}
                  onChange={(event) =>
                    onMorningReportChange({
                      ...morningReport,
                      notes: event.target.value,
                    })
                  }
                  placeholder="Anything about last night you want us to know?"
                />
              </Field>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isSavingMorningReport}
            >
              {isSavingMorningReport
                ? "Saving..."
                : editingMorningReportId != null
                  ? "Update Morning Report"
                  : "Save Morning Report"}
            </button>
            {editingMorningReportId != null ? (
              <button type="button" className="btn btn-secondary w-full" onClick={onCancelMorningEdit}>
                Cancel Morning Edit
              </button>
            ) : null}
          </div>
        </form>

        <form className="surface-panel" onSubmit={onNightReportSubmit}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mini-heading">Night Report</p>
              <h3 className="section-title mt-3">
                {editingNightReportId != null
                  ? "Update tonight&apos;s routine report."
                  : "Set up tonight&apos;s sleep plan."}
              </h3>
              <p className="section-copy">
                Add your bedtime, meals today, and anything that may make sleep or eating hard tonight.
              </p>
            </div>
            <div className="hidden h-14 w-14 items-center justify-center rounded-[22px] bg-indigo-100 text-indigo-600 md:flex">
              <MoonStar className="h-7 w-7" />
            </div>
          </div>

          <div className="form-grid-wide mt-6">
            <Field label="What time are you going to sleep tonight?" htmlFor="night-bedtime">
              <input
                id="night-bedtime"
                type="time"
                className="input"
                value={nightReport.bedTime}
                onChange={(event) =>
                  onNightReportChange({
                    ...nightReport,
                    bedTime: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="How many meals did you have today?" htmlFor="night-meals-count">
              <input
                id="night-meals-count"
                type="number"
                min="0"
                max="12"
                className="input"
                value={nightReport.mealsCount}
                onChange={(event) =>
                  onNightReportChange({
                    ...nightReport,
                    mealsCount: event.target.value,
                  })
                }
                placeholder="0"
              />
            </Field>

            <Field label="Bedtime notes (optional)" htmlFor="night-notes">
              <textarea
                id="night-notes"
                className="input min-h-32 resize-y"
                maxLength={300}
                value={nightReport.notes}
                onChange={(event) =>
                  onNightReportChange({
                    ...nightReport,
                    notes: event.target.value,
                  })
                }
                placeholder="Anything that may make sleep hard tonight?"
              />
            </Field>

            <Field label="Meals note (optional)" htmlFor="night-meals-note">
              <textarea
                id="night-meals-note"
                className="input min-h-32 resize-y"
                maxLength={500}
                value={nightReport.mealsNote}
                onChange={(event) =>
                  onNightReportChange({
                    ...nightReport,
                    mealsNote: event.target.value,
                  })
                }
                placeholder="Anything that affected eating today?"
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isSavingNightReport}
            >
              {isSavingNightReport
                ? "Saving..."
                : editingNightReportId != null
                  ? "Update Night Report"
                  : "Save Night Report"}
            </button>
            {editingNightReportId != null ? (
              <button type="button" className="btn btn-secondary w-full" onClick={onCancelNightEdit}>
                Cancel Night Edit
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <section className="surface-panel">
        <div className="flex items-center gap-3">
          <BookHeart className="h-5 w-5 text-sky-500" />
          <div>
            <h3 className="section-title text-lg">Recent sleep reports</h3>
            <p className="section-copy">Your latest morning and night sleep history.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {isLoadingDailyReports ? (
            <EmptyState message="Loading your daily reports..." />
          ) : recentDailyReports.length > 0 ? (
            recentDailyReports.map((report) => <DailyReportCard key={report.id} report={report} />)
          ) : (
            <EmptyState message="No daily reports yet. Your morning and night reports will appear here." />
          )}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}
