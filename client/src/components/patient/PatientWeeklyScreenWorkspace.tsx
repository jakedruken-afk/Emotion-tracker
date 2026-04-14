import type { FormEvent, ReactNode } from "react";
import { AlertCircle, ClipboardCheck, Shield } from "lucide-react";
import type {
  AppetiteChangeDirection,
  WeeklyScreeningFrequency,
  WeeklyScreeningAttemptTiming,
  WeeklyScreeningRecord,
} from "@shared/contracts";
import {
  appetiteChangeDirectionLabels,
  weeklyScreeningAttemptTimingLabels,
  weeklyScreeningFrequencyLabels,
} from "@shared/contracts";
import {
  getWeeklyScreeningDisposition,
  getWeeklyScreeningDispositionLabel,
  getWeeklyScreeningFollowUpDetails,
  getWeeklyScreeningRecommendedAction,
  getWeeklyScreeningSignals,
  getWeeklyScreeningStatusText,
} from "@shared/weeklyScreening";
import MetricTile from "../MetricTile";
import { EmptyState, WeeklyScreeningCard } from "./PatientEntryCards";

export type WeeklyScreeningFormState = {
  wishedDead: boolean;
  familyBetterOffDead: boolean;
  thoughtsKillingSelf: boolean;
  thoughtsKillingSelfFrequency: "" | WeeklyScreeningFrequency;
  everTriedToKillSelf: boolean;
  attemptTiming: WeeklyScreeningAttemptTiming;
  currentThoughts: "" | "yes" | "no";
  depressedHardToFunction: boolean;
  depressedFrequency: "" | WeeklyScreeningFrequency;
  anxiousOnEdge: boolean;
  anxiousFrequency: "" | WeeklyScreeningFrequency;
  hopeless: boolean;
  couldNotEnjoyThings: boolean;
  keepingToSelf: boolean;
  moreIrritable: boolean;
  substanceUseMoreThanUsual: boolean;
  substanceUseFrequency: "" | WeeklyScreeningFrequency;
  sleepTrouble: boolean;
  sleepTroubleFrequency: "" | WeeklyScreeningFrequency;
  appetiteChange: boolean;
  appetiteChangeDirection: "" | AppetiteChangeDirection;
  supportPerson: string;
  reasonsForLiving: string;
  copingPlan: string;
  needsHelpStayingSafe: "" | "yes" | "no";
};

type PatientWeeklyScreenWorkspaceProps = {
  screenings: WeeklyScreeningRecord[];
  latestScreening: WeeklyScreeningRecord | null;
  screeningDue: boolean;
  form: WeeklyScreeningFormState;
  isSaving: boolean;
  isLoading: boolean;
  editingScreeningId: number | null;
  onChange: (nextValue: WeeklyScreeningFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
};

export default function PatientWeeklyScreenWorkspace({
  screenings,
  latestScreening,
  screeningDue,
  form,
  isSaving,
  isLoading,
  editingScreeningId,
  onChange,
  onSubmit,
  onCancelEdit,
}: PatientWeeklyScreenWorkspaceProps) {
  const latestDisposition = latestScreening
    ? getWeeklyScreeningDisposition(latestScreening)
    : null;
  const latestSignals = latestScreening
    ? getWeeklyScreeningSignals(latestScreening)
    : [];
  const latestFollowUpDetails = latestScreening
    ? getWeeklyScreeningFollowUpDetails(latestScreening)
    : [];

  return (
    <div className="content-grid">
      <section className="surface-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mini-heading">Weekly Screening</p>
            <h3 className="section-title mt-3">
              {editingScreeningId != null
                ? "Update the weekly safety and symptom check."
                : "One weekly safety and symptom check."}
            </h3>
            <p className="section-copy">
              This screen helps your care team notice changes that may need follow-up before the next visit.
            </p>
          </div>
          <div className="hidden h-16 w-16 items-center justify-center rounded-[24px] bg-sky-50 text-sky-600 md:flex">
            <ClipboardCheck className="h-8 w-8" />
          </div>
        </div>

        <div className="metric-grid mt-6">
          <MetricTile
            label="Weekly status"
            value={screeningDue ? "Due" : "Current"}
            detail={getWeeklyScreeningStatusText(screenings)}
            tone="sky"
          />
          <MetricTile
            label="Latest screen"
            value={
              latestDisposition
                ? getWeeklyScreeningDispositionLabel(latestDisposition)
                : "Not started"
            }
            detail={
              latestScreening
                ? getWeeklyScreeningRecommendedAction(latestDisposition!)
                : "Your first weekly screen will help staff understand how the week is going."
            }
            tone="gold"
          />
        </div>

        <form className="mt-6 space-y-6" onSubmit={onSubmit}>
          <div className="warm-panel">
            <p className="mini-heading">Safety Questions</p>
            <div className="mt-5 form-grid">
              <YesNoField
                label="In the past few weeks, have you felt like you did not want to be here?"
                value={form.wishedDead}
                onChange={(value) => onChange({ ...form, wishedDead: value })}
              />
              <YesNoField
                label="In the past few weeks, have you felt other people might be better off without you?"
                value={form.familyBetterOffDead}
                onChange={(value) => onChange({ ...form, familyBetterOffDead: value })}
              />
              <YesNoField
                label="In the past week, have you had thoughts about harming yourself?"
                value={form.thoughtsKillingSelf}
                onChange={(value) =>
                  onChange({
                    ...form,
                    thoughtsKillingSelf: value,
                    thoughtsKillingSelfFrequency: value
                      ? form.thoughtsKillingSelfFrequency
                      : "",
                  })
                }
              />
              {form.thoughtsKillingSelf ? (
                <div className="md:col-span-2">
                  <SelectField
                    label="If yes, how often did this happen this week?"
                    value={form.thoughtsKillingSelfFrequency}
                    placeholder="Choose how often"
                    options={weeklyScreeningFrequencyLabels}
                    onChange={(value) =>
                      onChange({
                        ...form,
                        thoughtsKillingSelfFrequency: value as WeeklyScreeningFormState["thoughtsKillingSelfFrequency"],
                      })
                    }
                  />
                </div>
              ) : null}
              <YesNoField
                label="Have you ever tried to kill yourself?"
                value={form.everTriedToKillSelf}
                onChange={(value) =>
                  onChange({
                    ...form,
                    everTriedToKillSelf: value,
                    attemptTiming: value ? form.attemptTiming : "none",
                  })
                }
              />
              <div className="md:col-span-2">
                <Field label="If you have ever tried, when was the most recent time?">
                  <select
                    className="input"
                    value={form.attemptTiming}
                    onChange={(event) =>
                      onChange({
                        ...form,
                        attemptTiming: event.target.value as WeeklyScreeningAttemptTiming,
                      })
                    }
                    disabled={!form.everTriedToKillSelf}
                  >
                    {Object.entries(weeklyScreeningAttemptTimingLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {form.wishedDead ||
              form.familyBetterOffDead ||
              form.thoughtsKillingSelf ||
              form.everTriedToKillSelf ? (
                <div className="md:col-span-2">
                  <Field label="Are you having thoughts about harming yourself right now?">
                    <select
                      className="input"
                      value={form.currentThoughts}
                      onChange={(event) =>
                        onChange({
                          ...form,
                          currentThoughts: event.target.value as WeeklyScreeningFormState["currentThoughts"],
                        })
                      }
                    >
                      <option value="">Choose one</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </Field>
                </div>
              ) : null}
            </div>
          </div>

          <div className="soft-panel">
            <p className="mini-heading">This Week</p>
            <div className="mt-5 form-grid">
              <YesNoField
                label="Have you felt so sad or depressed it was hard to do things?"
                value={form.depressedHardToFunction}
                onChange={(value) =>
                  onChange({
                    ...form,
                    depressedHardToFunction: value,
                    depressedFrequency: value ? form.depressedFrequency : "",
                  })
                }
              />
              {form.depressedHardToFunction ? (
                <SelectField
                  label="If yes, how often did low mood make daily life hard this week?"
                  value={form.depressedFrequency}
                  placeholder="Choose how often"
                  options={weeklyScreeningFrequencyLabels}
                  onChange={(value) =>
                    onChange({
                      ...form,
                      depressedFrequency: value as WeeklyScreeningFormState["depressedFrequency"],
                    })
                  }
                />
              ) : null}
              <YesNoField
                label="Have you felt so worried or on-edge it was hard to do things?"
                value={form.anxiousOnEdge}
                onChange={(value) =>
                  onChange({
                    ...form,
                    anxiousOnEdge: value,
                    anxiousFrequency: value ? form.anxiousFrequency : "",
                  })
                }
              />
              {form.anxiousOnEdge ? (
                <SelectField
                  label="If yes, how often did anxiety make daily life hard this week?"
                  value={form.anxiousFrequency}
                  placeholder="Choose how often"
                  options={weeklyScreeningFrequencyLabels}
                  onChange={(value) =>
                    onChange({
                      ...form,
                      anxiousFrequency: value as WeeklyScreeningFormState["anxiousFrequency"],
                    })
                  }
                />
              ) : null}
              <YesNoField
                label="Have you felt hopeless?"
                value={form.hopeless}
                onChange={(value) => onChange({ ...form, hopeless: value })}
              />
              <YesNoField
                label="Have you felt like you could not enjoy the things that usually help?"
                value={form.couldNotEnjoyThings}
                onChange={(value) => onChange({ ...form, couldNotEnjoyThings: value })}
              />
              <YesNoField
                label="Have you been keeping to yourself more than usual?"
                value={form.keepingToSelf}
                onChange={(value) => onChange({ ...form, keepingToSelf: value })}
              />
              <YesNoField
                label="Have you been more irritable than usual?"
                value={form.moreIrritable}
                onChange={(value) => onChange({ ...form, moreIrritable: value })}
              />
              <YesNoField
                label="Have you used more drugs or alcohol than usual?"
                value={form.substanceUseMoreThanUsual}
                onChange={(value) =>
                  onChange({
                    ...form,
                    substanceUseMoreThanUsual: value,
                    substanceUseFrequency: value ? form.substanceUseFrequency : "",
                  })
                }
              />
              {form.substanceUseMoreThanUsual ? (
                <SelectField
                  label="If yes, how often was it more than usual this week?"
                  value={form.substanceUseFrequency}
                  placeholder="Choose how often"
                  options={weeklyScreeningFrequencyLabels}
                  onChange={(value) =>
                    onChange({
                      ...form,
                      substanceUseFrequency: value as WeeklyScreeningFormState["substanceUseFrequency"],
                    })
                  }
                />
              ) : null}
              <YesNoField
                label="Have you had trouble with sleep this week?"
                value={form.sleepTrouble}
                onChange={(value) =>
                  onChange({
                    ...form,
                    sleepTrouble: value,
                    sleepTroubleFrequency: value ? form.sleepTroubleFrequency : "",
                  })
                }
              />
              {form.sleepTrouble ? (
                <SelectField
                  label="If yes, how often did sleep trouble happen this week?"
                  value={form.sleepTroubleFrequency}
                  placeholder="Choose how often"
                  options={weeklyScreeningFrequencyLabels}
                  onChange={(value) =>
                    onChange({
                      ...form,
                      sleepTroubleFrequency: value as WeeklyScreeningFormState["sleepTroubleFrequency"],
                    })
                  }
                />
              ) : null}
              <YesNoField
                label="Have you noticed an appetite change this week?"
                value={form.appetiteChange}
                onChange={(value) =>
                  onChange({
                    ...form,
                    appetiteChange: value,
                    appetiteChangeDirection: value ? form.appetiteChangeDirection : "",
                  })
                }
              />
              {form.appetiteChange ? (
                <SelectField
                  label="If yes, what changed most?"
                  value={form.appetiteChangeDirection}
                  placeholder="Choose one"
                  options={appetiteChangeDirectionLabels}
                  onChange={(value) =>
                    onChange({
                      ...form,
                      appetiteChangeDirection: value as WeeklyScreeningFormState["appetiteChangeDirection"],
                    })
                  }
                />
              ) : null}
            </div>
          </div>

          <div className="soft-panel">
            <p className="mini-heading">Supports</p>
            <div className="mt-5 form-grid">
              <div className="md:col-span-2">
                <Field label="Trusted person you can talk to (optional)">
                  <input
                    className="input"
                    value={form.supportPerson}
                    onChange={(event) =>
                      onChange({ ...form, supportPerson: event.target.value })
                    }
                    placeholder="Name or relationship"
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="What are some reasons you want to stay safe or keep going? (optional)">
                  <textarea
                    className="input min-h-28 resize-y"
                    value={form.reasonsForLiving}
                    onChange={(event) =>
                      onChange({ ...form, reasonsForLiving: event.target.value })
                    }
                    placeholder="Family, faith, goals, pets, responsibilities, or anything else that keeps you going"
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="What helps you stay safe? (optional)">
                  <textarea
                    className="input min-h-28 resize-y"
                    value={form.copingPlan}
                    onChange={(event) =>
                      onChange({ ...form, copingPlan: event.target.value })
                    }
                    placeholder="People to call, places to go, or steps that help"
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Do you think you need help to keep yourself safe right now?">
                  <select
                    className="input"
                    value={form.needsHelpStayingSafe}
                    onChange={(event) =>
                      onChange({
                        ...form,
                        needsHelpStayingSafe:
                          event.target.value as WeeklyScreeningFormState["needsHelpStayingSafe"],
                      })
                    }
                  >
                    <option value="">Choose one</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </Field>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button type="submit" className="btn btn-primary w-full" disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : editingScreeningId != null
                  ? "Update Weekly Screen"
                  : "Save Weekly Screen"}
            </button>
            {editingScreeningId != null ? (
              <button type="button" className="btn btn-secondary w-full" onClick={onCancelEdit}>
                Cancel Weekly Screen Edit
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <div className="content-stack">
        <section className="surface-panel">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-sky-600" />
            <div>
              <h3 className="section-title text-lg">Latest weekly screen</h3>
              <p className="section-copy">The newest weekly safety result for you.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {latestScreening ? (
              <WeeklyScreeningCard screening={latestScreening} />
            ) : (
              <EmptyState message="No weekly safety screen saved yet." />
            )}
          </div>
        </section>

        <section className="surface-panel">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500" />
            <div>
              <h3 className="section-title text-lg">What happens if you answer yes?</h3>
              <p className="section-copy">
                A positive screen helps staff know that follow-up is needed. If you are in immediate danger, call emergency services right away.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              If you report current thoughts about harming yourself, staff should treat that as immediate follow-up.
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              Positive answers may lead to a same-day safety assessment, a safety plan, and a faster follow-up.
            </div>
          </div>

          {latestSignals.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {latestSignals.slice(0, 5).map((signal) => (
                <span key={signal} className="badge bg-amber-100 text-amber-900">
                  {signal}
                </span>
              ))}
            </div>
          ) : null}

          {latestFollowUpDetails.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {latestFollowUpDetails.map((detail) => (
                <span key={detail} className="badge bg-sky-100 text-sky-900">
                  {detail}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="surface-panel">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-5 w-5 text-sky-500" />
            <div>
              <h3 className="section-title text-lg">Recent weekly screens</h3>
              <p className="section-copy">Your last few weekly screens stay here for reference.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {isLoading ? (
              <EmptyState message="Loading your weekly screens..." />
            ) : screenings.length > 0 ? (
              screenings.slice(0, 3).map((screening) => (
                <WeeklyScreeningCard key={screening.id} screening={screening} compact />
              ))
            ) : (
              <EmptyState message="Your weekly screens will appear here after you save one." />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SelectField<TValue extends string>({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: TValue | "";
  placeholder: string;
  options: Record<TValue, string>;
  onChange: (value: TValue | "") => void;
}) {
  return (
    <Field label={label}>
      <select
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value as TValue | "")}
      >
        <option value="">{placeholder}</option>
        {Object.entries(options).map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {String(optionLabel)}
          </option>
        ))}
      </select>
    </Field>
  );
}

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Field label={label}>
      <select
        className="input"
        value={value ? "yes" : "no"}
        onChange={(event) => onChange(event.target.value === "yes")}
      >
        <option value="no">No</option>
        <option value="yes">Yes</option>
      </select>
    </Field>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
