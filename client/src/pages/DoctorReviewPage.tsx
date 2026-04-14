import { format } from "date-fns";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Copy,
  LogOut,
  Pill,
  Printer,
  Save,
} from "lucide-react";
import type {
  AuthUser,
  CarePlanRecord,
  DailyReportRecord,
  EmotionLog,
  EmotionRecord,
  MedicationRecord,
  ObservationRecord,
  WeeklyScreeningRecord,
} from "@shared/contracts";
import { formatDisplayName } from "@shared/contracts";
import {
  getLatestWeeklyScreening,
  getWeeklyScreeningDisposition,
  getWeeklyScreeningDispositionLabel,
} from "@shared/weeklyScreening";
import BrandMark from "../components/BrandMark";
import MetricTile from "../components/MetricTile";
import {
  DailyReportCard,
  EmotionEntryCard,
  WeeklyScreeningCard,
} from "../components/patient/PatientEntryCards";
import { useToast } from "../hooks/useToast";
import { apiRequest, getErrorMessage } from "../lib/api";
import {
  buildDoctorQuestionText,
  buildDoctorQuestions,
  buildDoctorVisitSummary,
} from "../lib/doctorReview";
import {
  getAverageSleepDuration,
  getAverageSleepQuality,
  getAverageWakeUps,
} from "../lib/dailyReports";
import { buildTrendPoints } from "../lib/clinicianSummary";
import {
  buildPatientRiskSnapshot,
  buildWeeklyPatientReview,
} from "../lib/riskReview";

type DoctorReviewPageProps = {
  user: AuthUser;
  onLogout: () => void;
};

type MedicationFormState = {
  medicationName: string;
  dose: string;
  schedule: string;
  purpose: string;
  sideEffects: string;
  adherenceNotes: string;
  isActive: boolean;
};

type CarePlanFormState = {
  goals: string;
  triggers: string;
  warningSigns: string;
  whatHelps: string;
  supportContacts: string;
  preferredFollowUpNotes: string;
};

function createEmptyMedicationForm(): MedicationFormState {
  return {
    medicationName: "",
    dose: "",
    schedule: "",
    purpose: "",
    sideEffects: "",
    adherenceNotes: "",
    isActive: true,
  };
}

function createEmptyCarePlanForm(): CarePlanFormState {
  return {
    goals: "",
    triggers: "",
    warningSigns: "",
    whatHelps: "",
    supportContacts: "",
    preferredFollowUpNotes: "",
  };
}

function createCarePlanForm(carePlan: CarePlanRecord | null): CarePlanFormState {
  return {
    goals: carePlan?.goals ?? "",
    triggers: carePlan?.triggers ?? "",
    warningSigns: carePlan?.warningSigns ?? "",
    whatHelps: carePlan?.whatHelps ?? "",
    supportContacts: carePlan?.supportContacts ?? "",
    preferredFollowUpNotes: carePlan?.preferredFollowUpNotes ?? "",
  };
}

export default function DoctorReviewPage({
  user,
  onLogout,
}: DoctorReviewPageProps) {
  const { patientId = "patient1" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const clinicianName = formatDisplayName(user);

  const [entries, setEntries] = useState<EmotionRecord[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReportRecord[]>([]);
  const [screenings, setScreenings] = useState<WeeklyScreeningRecord[]>([]);
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [medications, setMedications] = useState<MedicationRecord[]>([]);
  const [carePlan, setCarePlan] = useState<CarePlanRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingMedication, setIsSavingMedication] = useState(false);
  const [isSavingCarePlan, setIsSavingCarePlan] = useState(false);
  const [editingMedicationId, setEditingMedicationId] = useState<number | null>(null);
  const [medicationForm, setMedicationForm] = useState<MedicationFormState>(
    createEmptyMedicationForm,
  );
  const [carePlanForm, setCarePlanForm] = useState<CarePlanFormState>(
    createEmptyCarePlanForm,
  );

  const loadDoctorReview = async () => {
    setIsLoading(true);

    try {
      const [
        nextEntries,
        nextDailyReports,
        nextScreenings,
        nextObservations,
        nextMedications,
        nextCarePlan,
      ] = await Promise.all([
        apiRequest<EmotionRecord[]>(`/api/emotions/${encodeURIComponent(patientId)}`),
        apiRequest<DailyReportRecord[]>(
          `/api/daily-reports/${encodeURIComponent(patientId)}`,
        ),
        apiRequest<WeeklyScreeningRecord[]>(
          `/api/weekly-screenings/${encodeURIComponent(patientId)}`,
        ),
        apiRequest<ObservationRecord[]>(
          `/api/observations/${encodeURIComponent(patientId)}`,
        ),
        apiRequest<MedicationRecord[]>(
          `/api/medications/${encodeURIComponent(patientId)}`,
        ),
        apiRequest<CarePlanRecord | null>(
          `/api/care-plan/${encodeURIComponent(patientId)}`,
        ),
      ]);

      setEntries(nextEntries);
      setDailyReports(nextDailyReports);
      setScreenings(nextScreenings);
      setObservations(nextObservations);
      setMedications(nextMedications);
      setCarePlan(nextCarePlan);
      setCarePlanForm(createCarePlanForm(nextCarePlan));
    } catch (error) {
      toast({
        title: "Could not load the doctor review",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDoctorReview();
  }, [patientId]);

  const summaryLogs: EmotionLog[] = entries.map((entry) => ({
    ...entry,
    observations: [],
  }));
  const latestScreening = getLatestWeeklyScreening(screenings);
  const latestDisposition = latestScreening
    ? getWeeklyScreeningDisposition(latestScreening)
    : null;
  const risk = buildPatientRiskSnapshot(
    patientId,
    summaryLogs,
    dailyReports,
    screenings,
    observations,
  );
  const weeklyReview = buildWeeklyPatientReview(
    patientId,
    summaryLogs,
    dailyReports,
    screenings,
    observations,
  );
  const visitSummary = buildDoctorVisitSummary({
    patientId,
    logs: summaryLogs,
    dailyReports,
    screenings,
    observations,
    medications,
    carePlan,
    risk,
  });
  const visitQuestions = buildDoctorQuestions({
    patientId,
    logs: summaryLogs,
    dailyReports,
    screenings,
    observations,
    medications,
    carePlan,
    risk,
  });
  const questionText = buildDoctorQuestionText(visitQuestions);
  const trendPoints = buildTrendPoints(summaryLogs, 7);
  const morningReports = dailyReports.filter((report) => report.reportType === "morning");
  const averageSleepDuration = getAverageSleepDuration(morningReports);
  const averageSleepQuality = getAverageSleepQuality(morningReports);
  const averageWakeUps = getAverageWakeUps(morningReports);
  const activeMedications = medications.filter((medication) => medication.isActive);
  const inactiveMedications = medications.filter((medication) => !medication.isActive);

  const handleBackToSupport = () => {
    navigate(`/support?patient=${encodeURIComponent(patientId)}`);
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(visitSummary);
      toast({
        title: "Visit summary copied",
        description: "The doctor summary is ready to paste into a chart note.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Could not copy the visit summary",
        description: getErrorMessage(error),
        variant: "error",
      });
    }
  };

  const handleCopyQuestions = async () => {
    try {
      await navigator.clipboard.writeText(questionText);
      toast({
        title: "Questions copied",
        description: "The visit questions are ready to paste into a note or checklist.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Could not copy the visit questions",
        description: getErrorMessage(error),
        variant: "error",
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleMedicationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingMedication(true);

    try {
      const medicationPayload = {
        medicationName: medicationForm.medicationName,
        dose: medicationForm.dose,
        schedule: medicationForm.schedule,
        purpose: medicationForm.purpose,
        sideEffects: medicationForm.sideEffects,
        adherenceNotes: medicationForm.adherenceNotes,
        isActive: medicationForm.isActive,
        updatedBy: clinicianName,
      };

      if (editingMedicationId != null) {
        await apiRequest<MedicationRecord>(`/api/medications/${editingMedicationId}`, {
          method: "PATCH",
          data: medicationPayload,
        });
      } else {
        await apiRequest<MedicationRecord>("/api/medications", {
          method: "POST",
          data: {
            patientId,
            ...medicationPayload,
          },
        });
      }

      setMedicationForm(createEmptyMedicationForm());
      setEditingMedicationId(null);
      toast({
        title: editingMedicationId != null ? "Medication updated" : "Medication added",
        description: "The medication list has been saved.",
        variant: "success",
      });
      await loadDoctorReview();
    } catch (error) {
      toast({
        title: "Could not save the medication",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsSavingMedication(false);
    }
  };

  const handleEditMedication = (medication: MedicationRecord) => {
    setEditingMedicationId(medication.id);
    setMedicationForm({
      medicationName: medication.medicationName,
      dose: medication.dose ?? "",
      schedule: medication.schedule ?? "",
      purpose: medication.purpose ?? "",
      sideEffects: medication.sideEffects ?? "",
      adherenceNotes: medication.adherenceNotes ?? "",
      isActive: medication.isActive,
    });
  };

  const handleToggleMedicationActive = async (medication: MedicationRecord) => {
    try {
      await apiRequest<MedicationRecord>(`/api/medications/${medication.id}`, {
        method: "PATCH",
        data: {
          medicationName: medication.medicationName,
          dose: medication.dose,
          schedule: medication.schedule,
          purpose: medication.purpose,
          sideEffects: medication.sideEffects,
          adherenceNotes: medication.adherenceNotes,
          isActive: !medication.isActive,
          updatedBy: clinicianName,
        },
      });

      toast({
        title: medication.isActive ? "Medication marked inactive" : "Medication reactivated",
        description: "The medication status has been updated.",
        variant: "success",
      });

      await loadDoctorReview();
    } catch (error) {
      toast({
        title: "Could not update the medication status",
        description: getErrorMessage(error),
        variant: "error",
      });
    }
  };

  const handleCarePlanSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingCarePlan(true);

    try {
      const carePlanPayload = {
        goals: carePlanForm.goals,
        triggers: carePlanForm.triggers,
        warningSigns: carePlanForm.warningSigns,
        whatHelps: carePlanForm.whatHelps,
        supportContacts: carePlanForm.supportContacts,
        preferredFollowUpNotes: carePlanForm.preferredFollowUpNotes,
        updatedBy: clinicianName,
      };

      if (carePlan) {
        await apiRequest<CarePlanRecord>(`/api/care-plan/${encodeURIComponent(patientId)}`, {
          method: "PATCH",
          data: carePlanPayload,
        });
      } else {
        await apiRequest<CarePlanRecord>("/api/care-plan", {
          method: "POST",
          data: {
            patientId,
            ...carePlanPayload,
          },
        });
      }

      toast({
        title: carePlan ? "Care plan updated" : "Care plan created",
        description: "The clinician care plan has been saved.",
        variant: "success",
      });

      await loadDoctorReview();
    } catch (error) {
      toast({
        title: "Could not save the care plan",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsSavingCarePlan(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-topbar no-print">
        <div className="app-container flex items-center justify-between gap-4 py-4">
          <BrandMark
            variant="compact"
            showTagline={false}
            context="Doctor Review"
            subtitle={`${patientId} | ${clinicianName}`}
          />

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="btn btn-secondary" onClick={handleBackToSupport}>
              <ArrowLeft className="h-4 w-4" />
              Back to Support
            </button>
            <button type="button" className="btn btn-secondary" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              Print Review
            </button>
            <button type="button" className="btn btn-secondary" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="app-container py-6 md:py-8">
        <section className="hero-panel">
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Doctor Review Page</p>
              <h1 className="hero-title text-balance">
                Summary-first clinical review for {patientId}.
              </h1>
              <p className="hero-text">
                This page keeps the visit summary, trends, safety screen, medications, and care
                plan in one cleaner doctor-facing layout.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 no-print">
                <button type="button" className="btn btn-primary" onClick={handleCopySummary}>
                  <Copy className="h-4 w-4" />
                  Copy Visit Summary
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleCopyQuestions}>
                  <ClipboardList className="h-4 w-4" />
                  Copy Questions
                </button>
              </div>
            </div>

            <div className="metric-grid">
              <MetricTile
                label="Risk status"
                value={risk.riskLevel}
                detail={
                  risk.whatChanged.length > 0
                    ? risk.whatChanged.join(" ")
                    : "No major change signal detected."
                }
                tone="coral"
              />
              <MetricTile
                label="Weekly screen"
                value={
                  latestDisposition
                    ? getWeeklyScreeningDispositionLabel(latestDisposition)
                    : "Not started"
                }
                detail={
                  latestScreening
                    ? `Completed ${format(new Date(latestScreening.timestamp), "MMM d, yyyy")}.`
                    : "No weekly safety screen recorded yet."
                }
                tone="gold"
              />
              <MetricTile
                label="Active meds"
                value={activeMedications.length}
                detail={`${inactiveMedications.length} inactive medication${inactiveMedications.length === 1 ? "" : "s"} on record.`}
                tone="mint"
              />
              <MetricTile
                label="Care plan"
                value={carePlan ? "On file" : "Not added"}
                detail={
                  carePlan
                    ? `Updated ${format(new Date(carePlan.updatedAt), "MMM d, yyyy")} by ${carePlan.updatedBy}.`
                    : "Create a clinician-managed plan for goals, triggers, and supports."
                }
                tone="sky"
              />
            </div>
          </div>
        </section>

        <section className="surface-panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <SectionHeader
              eyebrow="10-Second Brief"
              title="What the doctor needs first"
              copy="This keeps the visit-opening answers visible before the deeper history and forms."
            />

            <div className="flex flex-wrap gap-2">
              <span
                className={`badge ${
                  risk.riskLevel === "Critical"
                    ? "bg-rose-100 text-rose-900"
                    : risk.riskLevel === "High"
                      ? "bg-orange-100 text-orange-900"
                      : risk.riskLevel === "Medium"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {risk.riskLevel}
              </span>
              <span className="badge bg-slate-100 text-slate-700">
                Reliability {risk.reliabilityLevel}
              </span>
              {risk.mismatchSummary ? (
                <span className="badge bg-amber-100 text-amber-900">Perspective mismatch</span>
              ) : null}
              {risk.crisisLevel !== "none" ? (
                <span className="badge bg-rose-100 text-rose-900">
                  {risk.crisisLevel === "critical" ? "Critical safety alert" : "Safety alert"}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="timeline-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                What is happening?
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {weeklyReview.keyChanges.length > 0
                  ? weeklyReview.keyChanges.join(" ")
                  : "No major change signal was detected."}
              </p>
            </div>
            <div className="timeline-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                How serious is it?
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {risk.riskLevel} priority.
                {risk.crisisSummary ? ` ${risk.crisisSummary}` : ""}
              </p>
            </div>
            <div className="timeline-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Why is it happening?
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {risk.reasons.length > 0
                  ? risk.reasons.join(" ")
                  : "No major review reason was detected."}
              </p>
            </div>
            <div className="timeline-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                What should the doctor do?
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {risk.suggestedActions.join(" ")}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              {risk.reliabilitySummary}
            </div>
            {risk.mismatchSummary ? (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                {risk.mismatchSummary}
              </div>
            ) : (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                No patient-versus-support mismatch was flagged in the current review.
              </div>
            )}
          </div>
        </section>

        <div className="content-stack">
          <div className="content-grid doctor-review-grid">
            <div className="content-stack">
              <section className="surface-panel">
                <SectionHeader
                  eyebrow="Visit Summary"
                  title="Chart-ready overview"
                  copy="A short summary prepared from mood, sleep, screening, and current clinician-managed information."
                />
                <div className="mt-6 rounded-[28px] border border-slate-200 bg-white px-5 py-5 text-sm leading-7 text-slate-700">
                  {isLoading ? "Loading the visit summary..." : visitSummary}
                </div>
              </section>

              <section className="surface-panel">
                <SectionHeader
                  eyebrow="Questions To Ask Today"
                  title="Follow-up prompts for the visit"
                  copy="These prompts are generated from the same review logic as the support queue, then tuned for the doctor visit."
                />
                <div className="mt-6 space-y-3">
                  {visitQuestions.map((question, index) => (
                    <div key={question} className="timeline-card">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Question {index + 1}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{question}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="surface-panel">
                <SectionHeader
                  eyebrow="Recent Observations"
                  title="Support-worker and clinician notes"
                  copy="Recent observations stay visible here so the visit summary can be cross-checked against direct staff notes."
                />
                <div className="mt-6 space-y-3">
                  {isLoading ? (
                    <EmptyPanel message="Loading recent observations..." />
                  ) : observations.length > 0 ? (
                    observations.slice(0, 6).map((observation) => (
                      <div key={observation.id} className="timeline-card">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge bg-slate-100 text-slate-700">
                            {observation.observationType}
                          </span>
                          <span className="badge bg-amber-100 text-amber-900">
                            {observation.priority}
                          </span>
                          <span className="text-xs text-slate-500">
                            {format(new Date(observation.timestamp), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-900">
                          {observation.supportWorkerName}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {observation.observation}
                        </p>
                      </div>
                    ))
                  ) : (
                    <EmptyPanel message="No clinician or support-worker observations are recorded for this patient yet." />
                  )}
                </div>
              </section>
            </div>

            <div className="content-stack">
              <section className="surface-panel">
                <SectionHeader
                  eyebrow="Current Snapshot"
                  title="Core review points"
                  copy="A quick read on the latest safety screen, weekly review, and care plan status."
                />

                <div className="mt-6 grid gap-4">
                  <SummaryRow label="Risk score" value={String(risk.score)} />
                  <SummaryRow
                    label="Last data seen"
                    value={
                      risk.lastSeenAt
                        ? format(new Date(risk.lastSeenAt), "MMM d, yyyy h:mm a")
                        : "No recent patient data"
                    }
                  />
                  <SummaryRow
                    label="Weekly screen"
                    value={
                      latestDisposition
                        ? getWeeklyScreeningDispositionLabel(latestDisposition)
                        : "Not started"
                    }
                  />
                  <SummaryRow
                    label="Average sleep"
                    value={
                      averageSleepDuration != null
                        ? `${averageSleepDuration.toFixed(1)} h`
                        : "Not enough morning reports"
                    }
                  />
                  <SummaryRow
                    label="Average sleep quality"
                    value={averageSleepQuality ?? "Not enough reports"}
                  />
                  <SummaryRow
                    label="Average wake-ups"
                    value={
                      averageWakeUps != null ? averageWakeUps.toFixed(1) : "Not enough reports"
                    }
                  />
                </div>

                <div className="mt-6">
                  <p className="text-sm font-semibold text-slate-900">Weekly review signals</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {weeklyReview.keyChanges.length > 0 ? (
                      weeklyReview.keyChanges.map((item) => (
                        <span key={item} className="badge bg-sky-100 text-sky-900">
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="badge bg-slate-100 text-slate-700">
                        No weekly change summary yet
                      </span>
                    )}
                  </div>
                </div>
              </section>

              <section className="surface-panel">
                <SectionHeader
                  eyebrow="Latest Weekly Screen"
                  title="Safety and symptom review"
                  copy="The newest structured weekly screen stays close to the summary for same-day review."
                />
                <div className="mt-6">
                  {isLoading ? (
                    <EmptyPanel message="Loading the latest weekly screen..." />
                  ) : latestScreening ? (
                    <WeeklyScreeningCard screening={latestScreening} />
                  ) : (
                    <EmptyPanel message="No weekly safety screen has been recorded yet." />
                  )}
                </div>
              </section>
            </div>
          </div>

          <div className="content-grid doctor-review-grid">
            <section className="surface-panel">
              <SectionHeader
                eyebrow="Mood, Sleep, And Craving Trends"
                title="Recent patterns"
                copy="These small charts and entry cards give a quick visual read before drilling into the timeline."
              />

              <div className="mt-6 grid gap-4">
                <TrendMiniChart
                  title="Sleep"
                  color="#6277d8"
                  maxValue={12}
                  suffix="h"
                  points={trendPoints.map((point) => ({
                    label: point.label,
                    value: point.sleep,
                  }))}
                />
                <TrendMiniChart
                  title="Stress"
                  color="#e15b72"
                  maxValue={10}
                  suffix="/10"
                  points={trendPoints.map((point) => ({
                    label: point.label,
                    value: point.stress,
                  }))}
                />
                <TrendMiniChart
                  title="Cravings"
                  color="#d88a29"
                  maxValue={10}
                  suffix="/10"
                  points={trendPoints.map((point) => ({
                    label: point.label,
                    value: point.cravings,
                  }))}
                />
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900">Recent mood entries</p>
                  {isLoading ? (
                    <EmptyPanel message="Loading mood entries..." />
                  ) : entries.length > 0 ? (
                    entries.slice(0, 4).map((entry) => (
                      <EmotionEntryCard key={entry.id} entry={entry} />
                    ))
                  ) : (
                    <EmptyPanel message="No mood entries have been recorded for this patient yet." />
                  )}
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900">Recent sleep reports</p>
                  {isLoading ? (
                    <EmptyPanel message="Loading sleep reports..." />
                  ) : dailyReports.length > 0 ? (
                    dailyReports.slice(0, 4).map((report) => (
                      <DailyReportCard key={report.id} report={report} />
                    ))
                  ) : (
                    <EmptyPanel message="No sleep reports have been recorded for this patient yet." />
                  )}
                </div>
              </div>
            </section>

            <div className="content-stack">
              <section className="surface-panel">
                <SectionHeader
                  eyebrow="Medication List"
                  title="Clinician-managed medications"
                  copy="Keep active and inactive medications visible for the visit. Editing tools are hidden when printing."
                />

                <form className="mt-6 space-y-4 no-print" onSubmit={handleMedicationSubmit}>
                  <div className="form-grid">
                    <Field label="Medication name" htmlFor="medication-name">
                      <input
                        id="medication-name"
                        className="input"
                        value={medicationForm.medicationName}
                        onChange={(event) =>
                          setMedicationForm((current) => ({
                            ...current,
                            medicationName: event.target.value,
                          }))
                        }
                        placeholder="Example: Sertraline"
                      />
                    </Field>
                    <Field label="Dose" htmlFor="medication-dose">
                      <input
                        id="medication-dose"
                        className="input"
                        value={medicationForm.dose}
                        onChange={(event) =>
                          setMedicationForm((current) => ({
                            ...current,
                            dose: event.target.value,
                          }))
                        }
                        placeholder="Example: 50 mg"
                      />
                    </Field>
                    <Field label="Schedule" htmlFor="medication-schedule">
                      <input
                        id="medication-schedule"
                        className="input"
                        value={medicationForm.schedule}
                        onChange={(event) =>
                          setMedicationForm((current) => ({
                            ...current,
                            schedule: event.target.value,
                          }))
                        }
                        placeholder="Example: Once daily"
                      />
                    </Field>
                    <Field label="Purpose" htmlFor="medication-purpose">
                      <input
                        id="medication-purpose"
                        className="input"
                        value={medicationForm.purpose}
                        onChange={(event) =>
                          setMedicationForm((current) => ({
                            ...current,
                            purpose: event.target.value,
                          }))
                        }
                        placeholder="Example: Depression / anxiety"
                      />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Side effects" htmlFor="medication-side-effects">
                        <textarea
                          id="medication-side-effects"
                          className="input min-h-28 resize-y"
                          value={medicationForm.sideEffects}
                          onChange={(event) =>
                            setMedicationForm((current) => ({
                              ...current,
                              sideEffects: event.target.value,
                            }))
                          }
                          placeholder="Observed or reported side effects"
                        />
                      </Field>
                    </div>
                    <div className="md:col-span-2">
                      <Field label="Adherence notes" htmlFor="medication-adherence-notes">
                        <textarea
                          id="medication-adherence-notes"
                          className="input min-h-28 resize-y"
                          value={medicationForm.adherenceNotes}
                          onChange={(event) =>
                            setMedicationForm((current) => ({
                              ...current,
                              adherenceNotes: event.target.value,
                            }))
                          }
                          placeholder="Clinician note about adherence, missed doses, or refill issues"
                        />
                      </Field>
                    </div>
                  </div>

                  <label className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={medicationForm.isActive}
                      onChange={(event) =>
                        setMedicationForm((current) => ({
                          ...current,
                          isActive: event.target.checked,
                        }))
                      }
                    />
                    Medication is currently active
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSavingMedication}
                    >
                      <Save className="h-4 w-4" />
                      {isSavingMedication
                        ? "Saving..."
                        : editingMedicationId != null
                          ? "Update Medication"
                          : "Add Medication"}
                    </button>
                    {editingMedicationId != null ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditingMedicationId(null);
                          setMedicationForm(createEmptyMedicationForm());
                        }}
                      >
                        Cancel Edit
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="mt-6 space-y-3">
                  <p className="text-sm font-semibold text-slate-900">Active medications</p>
                  {isLoading ? (
                    <EmptyPanel message="Loading medications..." />
                  ) : activeMedications.length > 0 ? (
                    activeMedications.map((medication) => (
                      <MedicationCard
                        key={medication.id}
                        medication={medication}
                        onEdit={handleEditMedication}
                        onToggleActive={handleToggleMedicationActive}
                      />
                    ))
                  ) : (
                    <EmptyPanel message="No active medications have been added yet." />
                  )}
                </div>

                {inactiveMedications.length > 0 ? (
                  <div className="mt-6 space-y-3">
                    <p className="text-sm font-semibold text-slate-900">Inactive medications</p>
                    {inactiveMedications.map((medication) => (
                      <MedicationCard
                        key={medication.id}
                        medication={medication}
                        onEdit={handleEditMedication}
                        onToggleActive={handleToggleMedicationActive}
                      />
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="surface-panel">
                <SectionHeader
                  eyebrow="Care Plan"
                  title="Goals, triggers, and supports"
                  copy="One clinician-managed plan per patient, with editable content hidden when printing."
                />

                <div className="mt-6 space-y-3">
                  <TextDetailCard
                    title="Goals"
                    value={carePlan?.goals ?? null}
                    emptyMessage="No goals have been added yet."
                  />
                  <TextDetailCard
                    title="Triggers"
                    value={carePlan?.triggers ?? null}
                    emptyMessage="No trigger list has been added yet."
                  />
                  <TextDetailCard
                    title="Warning signs"
                    value={carePlan?.warningSigns ?? null}
                    emptyMessage="No warning signs have been added yet."
                  />
                  <TextDetailCard
                    title="What helps"
                    value={carePlan?.whatHelps ?? null}
                    emptyMessage="No helpful strategies have been added yet."
                  />
                  <TextDetailCard
                    title="Support contacts"
                    value={carePlan?.supportContacts ?? null}
                    emptyMessage="No support contacts have been added yet."
                  />
                  <TextDetailCard
                    title="Preferred follow-up notes"
                    value={carePlan?.preferredFollowUpNotes ?? null}
                    emptyMessage="No preferred follow-up notes have been added yet."
                  />
                  <p className="text-xs text-slate-500">
                    {carePlan
                      ? `Last updated by ${carePlan.updatedBy} on ${format(new Date(carePlan.updatedAt), "MMM d, yyyy 'at' h:mm a")}`
                      : "No care plan has been saved yet."}
                  </p>
                </div>

                <form className="mt-6 space-y-4 no-print" onSubmit={handleCarePlanSubmit}>
                  <div className="form-grid-wide">
                    <Field label="Goals" htmlFor="care-plan-goals">
                      <textarea
                        id="care-plan-goals"
                        className="input min-h-28 resize-y"
                        value={carePlanForm.goals}
                        onChange={(event) =>
                          setCarePlanForm((current) => ({
                            ...current,
                            goals: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Triggers" htmlFor="care-plan-triggers">
                      <textarea
                        id="care-plan-triggers"
                        className="input min-h-28 resize-y"
                        value={carePlanForm.triggers}
                        onChange={(event) =>
                          setCarePlanForm((current) => ({
                            ...current,
                            triggers: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Warning signs" htmlFor="care-plan-warning-signs">
                      <textarea
                        id="care-plan-warning-signs"
                        className="input min-h-28 resize-y"
                        value={carePlanForm.warningSigns}
                        onChange={(event) =>
                          setCarePlanForm((current) => ({
                            ...current,
                            warningSigns: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="What helps" htmlFor="care-plan-what-helps">
                      <textarea
                        id="care-plan-what-helps"
                        className="input min-h-28 resize-y"
                        value={carePlanForm.whatHelps}
                        onChange={(event) =>
                          setCarePlanForm((current) => ({
                            ...current,
                            whatHelps: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Support contacts" htmlFor="care-plan-support-contacts">
                      <textarea
                        id="care-plan-support-contacts"
                        className="input min-h-28 resize-y"
                        value={carePlanForm.supportContacts}
                        onChange={(event) =>
                          setCarePlanForm((current) => ({
                            ...current,
                            supportContacts: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field
                      label="Preferred follow-up notes"
                      htmlFor="care-plan-follow-up-notes"
                    >
                      <textarea
                        id="care-plan-follow-up-notes"
                        className="input min-h-28 resize-y"
                        value={carePlanForm.preferredFollowUpNotes}
                        onChange={(event) =>
                          setCarePlanForm((current) => ({
                            ...current,
                            preferredFollowUpNotes: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSavingCarePlan}
                  >
                    <Save className="h-4 w-4" />
                    {isSavingCarePlan
                      ? "Saving..."
                      : carePlan
                        ? "Update Care Plan"
                        : "Create Care Plan"}
                  </button>
                </form>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div>
      <p className="mini-heading">{eyebrow}</p>
      <h2 className="section-title mt-3">{title}</h2>
      <p className="section-copy">{copy}</p>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TextDetailCard({
  title,
  value,
  emptyMessage,
}: {
  title: string;
  value: string | null;
  emptyMessage: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        {value && value.trim().length > 0 ? value : emptyMessage}
      </p>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-6 text-sm text-slate-500">
      {message}
    </div>
  );
}

function MedicationCard({
  medication,
  onEdit,
  onToggleActive,
}: {
  medication: MedicationRecord;
  onEdit: (medication: MedicationRecord) => void;
  onToggleActive: (medication: MedicationRecord) => void;
}) {
  return (
    <div className="timeline-card">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-sky-50 text-sky-700">
            <Pill className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-slate-900">
                {medication.medicationName}
              </p>
              <span
                className={`badge ${
                  medication.isActive
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {medication.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Updated by {medication.updatedBy} on{" "}
              {format(new Date(medication.updatedAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 no-print">
          <button type="button" className="btn btn-secondary" onClick={() => onEdit(medication)}>
            Edit
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onToggleActive(medication)}
          >
            {medication.isActive ? "Mark Inactive" : "Reactivate"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <InfoTile label="Dose" value={medication.dose || "Not recorded"} />
        <InfoTile label="Schedule" value={medication.schedule || "Not recorded"} />
        <InfoTile label="Purpose" value={medication.purpose || "Not recorded"} />
        <InfoTile
          label="Last updated"
          value={format(new Date(medication.updatedAt), "MMM d, yyyy")}
        />
      </div>

      {(medication.sideEffects || medication.adherenceNotes) ? (
        <div className="mt-4 space-y-3">
          {medication.sideEffects ? (
            <TextDetailCard
              title="Side effects"
              value={medication.sideEffects}
              emptyMessage=""
            />
          ) : null}
          {medication.adherenceNotes ? (
            <TextDetailCard
              title="Adherence notes"
              value={medication.adherenceNotes}
              emptyMessage=""
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

type ChartPoint = {
  label: string;
  value: number | null;
};

function TrendMiniChart(_props: {
  title: string;
  color: string;
  maxValue: number;
  suffix: string;
  points: ChartPoint[];
}) {
  const { title, color, maxValue, suffix, points } = _props;
  const width = 320;
  const height = 88;
  const padding = 14;

  const validPoints = points
    .map((point, index) => ({ ...point, index }))
    .filter((point) => point.value != null) as Array<
      ChartPoint & { index: number; value: number }
    >;

  const path = validPoints
    .map((point, pointIndex) => {
      const x =
        validPoints.length === 1
          ? width / 2
          : padding + (point.index / Math.max(points.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - (point.value / maxValue) * (height - padding * 2);
      return `${pointIndex === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="timeline-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">Last {points.length} entries</p>
      </div>

      <div className="mt-4">
        {validPoints.length > 0 ? (
          <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full">
            <line
              x1={padding}
              y1={height - padding}
              x2={width - padding}
              y2={height - padding}
              stroke="#cbd5e1"
              strokeWidth="1"
            />
            <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
            {validPoints.map((point) => {
              const x =
                validPoints.length === 1
                  ? width / 2
                  : padding +
                    (point.index / Math.max(points.length - 1, 1)) * (width - padding * 2);
              const y = height - padding - (point.value / maxValue) * (height - padding * 2);

              return (
                <circle
                  key={`${title}-${point.label}-${point.index}`}
                  cx={x}
                  cy={y}
                  r="4"
                  fill={color}
                />
              );
            })}
          </svg>
        ) : (
          <div className="rounded-[22px] bg-slate-50 px-4 py-6 text-sm text-slate-500">
            No values recorded yet.
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        {points.map((point) => (
          <span key={`${title}-${point.label}`} className="rounded-full bg-slate-100 px-3 py-1">
            {point.label}: {point.value != null ? `${point.value}${suffix}` : "N/A"}
          </span>
        ))}
      </div>
    </div>
  );
}
