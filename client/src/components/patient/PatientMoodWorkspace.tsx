import { BookHeart, Clock3, ShieldCheck, Sparkles } from "lucide-react";
import {
  type DailyReportRecord,
  type EmotionName,
  type EmotionRecord,
  type MedicationAdherence,
} from "@shared/contracts";
import type { ReactNode } from "react";
import { getDailyReportStatusText } from "../../lib/dailyReports";
import { EmotionEntryCard, EmptyState } from "./PatientEntryCards";

const emotionMeta: Record<
  EmotionName,
  {
    emoji: string;
    buttonClass: string;
    badgeClass: string;
  }
> = {
  Happy: {
    emoji: "\u{1F60A}",
    buttonClass: "bg-gradient-to-br from-emerald-400 to-teal-500",
    badgeClass: "bg-emerald-100 text-emerald-800",
  },
  Sad: {
    emoji: "\u{1F622}",
    buttonClass: "bg-gradient-to-br from-sky-400 to-cyan-500",
    badgeClass: "bg-sky-100 text-sky-800",
  },
  Angry: {
    emoji: "\u{1F620}",
    buttonClass: "bg-gradient-to-br from-rose-400 to-orange-500",
    badgeClass: "bg-rose-100 text-rose-800",
  },
  Worried: {
    emoji: "\u{1F630}",
    buttonClass: "bg-gradient-to-br from-amber-400 to-orange-400",
    badgeClass: "bg-amber-100 text-amber-800",
  },
};

type MoodWorkspaceProps = {
  emotionOptions: readonly EmotionName[];
  selectedEmotion: EmotionName | null;
  notes: string;
  sleepHours: number;
  stressLevel: number;
  cravingLevel: number;
  substanceUseToday: boolean;
  moneyChangedToday: boolean;
  medicationAdherence: MedicationAdherence;
  medicationAdherenceOptions: readonly MedicationAdherence[];
  medicationAdherenceLabels: Record<MedicationAdherence, string>;
  includeLocation: boolean;
  gpsConsentEnabled: boolean;
  locationFeedback: string | null;
  isSaving: boolean;
  isCapturingLocation: boolean;
  recentEntries: EmotionRecord[];
  isLoadingEntries: boolean;
  morningSavedToday: boolean;
  morningDueNow: boolean;
  nightSavedToday: boolean;
  nightDueNow: boolean;
  dailyReports: DailyReportRecord[];
  onPickEmotion: (emotion: EmotionName) => void;
  onNotesChange: (value: string) => void;
  onSleepHoursChange: (value: number) => void;
  onStressLevelChange: (value: number) => void;
  onCravingLevelChange: (value: number) => void;
  onSubstanceUseTodayChange: (value: boolean) => void;
  onMoneyChangedTodayChange: (value: boolean) => void;
  onMedicationAdherenceChange: (value: MedicationAdherence) => void;
  onIncludeLocationChange: (value: boolean) => void;
  onSubmit: () => void;
  onReset: () => void;
};

export default function PatientMoodWorkspace({
  emotionOptions,
  selectedEmotion,
  notes,
  sleepHours,
  stressLevel,
  cravingLevel,
  substanceUseToday,
  moneyChangedToday,
  medicationAdherence,
  medicationAdherenceOptions,
  medicationAdherenceLabels,
  includeLocation,
  gpsConsentEnabled,
  locationFeedback,
  isSaving,
  isCapturingLocation,
  recentEntries,
  isLoadingEntries,
  morningSavedToday,
  morningDueNow,
  nightSavedToday,
  nightDueNow,
  dailyReports,
  onPickEmotion,
  onNotesChange,
  onSleepHoursChange,
  onStressLevelChange,
  onCravingLevelChange,
  onSubstanceUseTodayChange,
  onMoneyChangedTodayChange,
  onMedicationAdherenceChange,
  onIncludeLocationChange,
  onSubmit,
  onReset,
}: MoodWorkspaceProps) {
  return (
    <div className="content-grid">
      <section className="surface-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mini-heading">Mood Check-In</p>
            <h3 className="section-title mt-3">How are you feeling right now?</h3>
            <p className="section-copy">
              Pick the emotion that fits best, then add a few details if you want to give your care team more context.
            </p>
          </div>
          <div className="hidden h-16 w-16 items-center justify-center rounded-[24px] bg-gradient-to-br from-rose-100 to-orange-100 text-rose-500 md:flex">
            <Sparkles className="h-8 w-8" />
          </div>
        </div>

        {!selectedEmotion ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {emotionOptions.map((emotion) => (
              <button
                key={emotion}
                type="button"
                className={`rounded-[28px] px-6 py-6 text-left text-white shadow-lg transition hover:-translate-y-1 ${emotionMeta[emotion].buttonClass}`}
                onClick={() => onPickEmotion(emotion)}
                disabled={isSaving}
              >
                <div className="text-4xl">{emotionMeta[emotion].emoji}</div>
                <div className="mt-4 text-2xl font-bold">{emotion}</div>
                <p className="mt-2 text-sm text-white/85">Tap to start this check-in</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-6 soft-panel">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-5xl">{emotionMeta[selectedEmotion].emoji}</p>
                <h4 className="mt-3 text-2xl font-bold text-slate-900">
                  You selected {selectedEmotion}
                </h4>
              </div>
              <span className={`badge ${emotionMeta[selectedEmotion].badgeClass}`}>
                {selectedEmotion}
              </span>
            </div>

            <div className="mt-6">
              <label className="label" htmlFor="notes">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                className="input min-h-32 resize-y"
                maxLength={500}
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                placeholder="Tell us what is on your mind..."
              />
              <p className="mt-2 text-right text-xs text-slate-500">{notes.length}/500</p>
            </div>

            <div className="mt-6 warm-panel">
              <p className="mini-heading">Extra Details</p>
              <p className="section-copy mt-3">
                These answers help your care team compare patterns over time.
              </p>

              <div className="form-grid mt-5">
                <Field label="Sleep last night (hours)" htmlFor="sleep-hours">
                  <input
                    id="sleep-hours"
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    className="input"
                    value={sleepHours}
                    onChange={(event) => onSleepHoursChange(Number(event.target.value))}
                  />
                </Field>

                <Field label="Medication today" htmlFor="medication-adherence">
                  <select
                    id="medication-adherence"
                    className="input"
                    value={medicationAdherence}
                    onChange={(event) =>
                      onMedicationAdherenceChange(event.target.value as MedicationAdherence)
                    }
                  >
                    {medicationAdherenceOptions.map((option) => (
                      <option key={option} value={option}>
                        {medicationAdherenceLabels[option]}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="md:col-span-2">
                  <label className="label" htmlFor="stress-level">
                    Stress level: {stressLevel}/10
                  </label>
                  <input
                    id="stress-level"
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    className="w-full accent-sky-600"
                    value={stressLevel}
                    onChange={(event) => onStressLevelChange(Number(event.target.value))}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="label" htmlFor="craving-level">
                    Craving level: {cravingLevel}/10
                  </label>
                  <input
                    id="craving-level"
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    className="w-full accent-amber-500"
                    value={cravingLevel}
                    onChange={(event) => onCravingLevelChange(Number(event.target.value))}
                  />
                </div>

                <Field label="Used substances today?" htmlFor="substance-use-today">
                  <select
                    id="substance-use-today"
                    className="input"
                    value={substanceUseToday ? "yes" : "no"}
                    onChange={(event) => onSubstanceUseTodayChange(event.target.value === "yes")}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>

                <Field
                  label="Did you get or spend a lot of money today?"
                  htmlFor="money-changed-today"
                  caption="Example: payday, benefits, rent, or a big purchase."
                >
                  <select
                    id="money-changed-today"
                    className="input"
                    value={moneyChangedToday ? "yes" : "no"}
                    onChange={(event) =>
                      onMoneyChangedTodayChange(event.target.value === "yes")
                    }
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
              </div>
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                checked={includeLocation}
                onChange={(event) => onIncludeLocationChange(event.target.checked)}
                disabled={isSaving || !gpsConsentEnabled}
              />
              <span>
                <span className="block font-semibold text-slate-900">
                  Include my current GPS location
                </span>
                <span className="mt-1 block text-slate-500">
                  {gpsConsentEnabled
                    ? "This uses your device location once when you save this mood check-in."
                    : "GPS is turned off until you give separate location consent."}
                </span>
              </span>
            </label>

            {locationFeedback ? (
              <div className="mt-4 rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                {locationFeedback}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={onSubmit}
                disabled={isSaving || isCapturingLocation}
              >
                {isCapturingLocation
                  ? "Capturing GPS..."
                  : isSaving
                    ? "Saving..."
                    : "Save My Feeling"}
              </button>
              <button
                type="button"
                className="btn btn-secondary flex-1"
                onClick={onReset}
                disabled={isSaving || isCapturingLocation}
              >
                Choose a Different Emotion
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="content-stack">
        <section className="surface-panel">
          <div className="flex items-center gap-3">
            <Clock3 className="h-5 w-5 text-amber-500" />
            <div>
              <h3 className="section-title text-lg">Today&apos;s reminders</h3>
              <p className="section-copy">Small steps to keep your routine complete.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <ReminderCard
              title="Morning report"
              status={morningSavedToday ? "done" : morningDueNow ? "needed" : "later"}
              detail={getDailyReportStatusText(dailyReports, "morning", new Date())}
            />
            <ReminderCard
              title="Night report"
              status={nightSavedToday ? "done" : nightDueNow ? "needed" : "later"}
              detail={getDailyReportStatusText(dailyReports, "night", new Date())}
            />
          </div>
        </section>

        <section className="surface-panel">
          <div className="flex items-center gap-3">
            <BookHeart className="h-5 w-5 text-sky-500" />
            <div>
              <h3 className="section-title text-lg">Recent check-ins</h3>
              <p className="section-copy">Your latest saved mood history.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {isLoadingEntries ? (
              <EmptyState message="Loading your recent entries..." />
            ) : recentEntries.length > 0 ? (
              recentEntries.slice(0, 3).map((entry) => (
                <EmotionEntryCard key={entry.id} entry={entry} compact />
              ))
            ) : (
              <EmptyState message="No mood entries yet. Your saved feelings will appear here." />
            )}
          </div>
        </section>

        <div className="accent-banner">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5" />
            <p>
              Your entries stay on this device&apos;s local database and help your care team notice patterns over time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReminderCard({
  title,
  status,
  detail,
}: {
  title: string;
  status: "done" | "needed" | "later";
  detail: string;
}) {
  const badgeClass =
    status === "done"
      ? "bg-emerald-100 text-emerald-800"
      : status === "needed"
        ? "bg-amber-100 text-amber-900"
        : "bg-slate-100 text-slate-700";
  const label = status === "done" ? "Done" : status === "needed" ? "Needed" : "Later";

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        <span className={`badge ${badgeClass}`}>{label}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  caption,
  children,
}: {
  label: string;
  htmlFor: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {caption ? <p className="mt-2 text-xs text-slate-500">{caption}</p> : null}
    </div>
  );
}
