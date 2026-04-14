import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { format } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ClipboardList,
  Copy,
  Download,
  LogOut,
  MapPin,
  NotebookPen,
  Route,
  Shield,
  UserPlus,
} from "lucide-react";
import {
  dailyReportTypeLabels,
  emotionOptions,
  formatDisplayName,
  getCheckInRichness,
  getEmotionFlags,
  medicationAdherenceLabels,
  observationTypeOptions,
  priorityOptions,
  sleepQualityLabels,
  type AuthUser,
  type DailyReportRecord,
  type EmotionLog,
  type EmotionName,
  type ObservationRecord,
  type ObservationPriority,
  type ObservationType,
  type PatientSummary,
  type WeeklyScreeningRecord,
} from "@shared/contracts";
import {
  getLatestWeeklyScreening,
  getWeeklyScreeningDisposition,
  getWeeklyScreeningDispositionLabel,
  getWeeklyScreeningRecommendedAction,
  getWeeklyScreeningSignals,
  getWeeklyScreeningStatusText,
  isWeeklyScreeningDue,
} from "@shared/weeklyScreening";
import BrandMark from "../components/BrandMark";
import MetricTile from "../components/MetricTile";
import SectionTabs from "../components/SectionTabs";
import { WeeklyScreeningCard } from "../components/patient/PatientEntryCards";
import { useToast } from "../hooks/useToast";
import { apiRequest, getErrorMessage } from "../lib/api";
import {
  buildClinicianSummary,
  buildTrendPoints,
  getReviewSignals,
} from "../lib/clinicianSummary";
import {
  formatClockTime,
  getAverageSleepDuration,
  getAverageSleepQuality,
  getAverageWakeUps,
  getSleepDurationHours,
} from "../lib/dailyReports";
import { buildMapsUrl, formatCoordinates } from "../lib/location";
import {
  getRecommendedCarePathways,
  nlCarePathways,
} from "../lib/nlCarePathways";
import {
  buildPatientRiskSnapshots,
  buildWeeklyPatientReview,
  type PatientRiskSnapshot,
  type RiskLevel,
} from "../lib/riskReview";

const emotionMeta: Record<
  EmotionName,
  {
    emoji: string;
    badgeClass: string;
    statusLabel: string;
  }
> = {
  Happy: {
    emoji: "\u{1F60A}",
    badgeClass: "bg-emerald-100 text-emerald-800",
    statusLabel: "Positive",
  },
  Sad: {
    emoji: "\u{1F622}",
    badgeClass: "bg-sky-100 text-sky-800",
    statusLabel: "Monitor",
  },
  Angry: {
    emoji: "\u{1F620}",
    badgeClass: "bg-rose-100 text-rose-800",
    statusLabel: "Monitor",
  },
  Worried: {
    emoji: "\u{1F630}",
    badgeClass: "bg-amber-100 text-amber-800",
    statusLabel: "Attention",
  },
};

const priorityMeta: Record<ObservationPriority, string> = {
  Low: "bg-sky-100 text-sky-800",
  Medium: "bg-amber-100 text-amber-800",
  High: "bg-orange-100 text-orange-900",
  Critical: "bg-rose-100 text-rose-900",
  Urgent: "bg-rose-100 text-rose-900",
};

const riskMeta: Record<
  RiskLevel,
  {
    badgeClass: string;
    cardClass: string;
  }
> = {
  Low: {
    badgeClass: "bg-emerald-100 text-emerald-800",
    cardClass: "border-emerald-200 bg-emerald-50/70",
  },
  Medium: {
    badgeClass: "bg-amber-100 text-amber-900",
    cardClass: "border-amber-200 bg-amber-50/80",
  },
  High: {
    badgeClass: "bg-orange-100 text-orange-900",
    cardClass: "border-orange-200 bg-orange-50/80",
  },
  Critical: {
    badgeClass: "bg-rose-100 text-rose-900",
    cardClass: "border-rose-200 bg-rose-50/80",
  },
};

type TimeFilter = "7" | "30" | "90" | "all";
type SupportWorkspace =
  | "queue"
  | "overview"
  | "screening"
  | "timeline"
  | "sleep"
  | "notes";

type ObservationFormState = {
  patientId: string;
  observationType: ObservationType;
  observation: string;
  priority: ObservationPriority;
  supportWorkerName: string;
};

type CriticalAlertTarget = {
  title: string;
  summary: string;
  detail: string;
  tab: SupportWorkspace;
  targetId: string;
  timestamp: string;
};

type SupportPageProps = {
  user: AuthUser;
  onLogout: () => void;
};

export default function SupportPage({ user, onLogout }: SupportPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const supportWorkerName = formatDisplayName(user);
  const [activeTab, setActiveTab] = useState<SupportWorkspace>("queue");
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [logs, setLogs] = useState<EmotionLog[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReportRecord[]>([]);
  const [screenings, setScreenings] = useState<WeeklyScreeningRecord[]>([]);
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emotionFilter, setEmotionFilter] = useState<EmotionName | "all">("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("30");
  const [selectedPatientId, setSelectedPatientId] = useState(
    searchParams.get("patient") ?? "patient1",
  );
  const [form, setForm] = useState<ObservationFormState>({
    patientId: "patient1",
    observationType: "Clinical",
    observation: "",
    priority: "Medium",
    supportWorkerName,
  });
  const [showCriticalAlert, setShowCriticalAlert] = useState(false);
  const [pendingScrollTargetId, setPendingScrollTargetId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadDashboard = async () => {
    setIsLoadingLogs(true);

    try {
      const [nextPatients, nextLogs, nextDailyReports, nextScreenings, nextObservations] =
        await Promise.all([
        apiRequest<PatientSummary[]>("/api/patients"),
        apiRequest<EmotionLog[]>("/api/logs"),
        apiRequest<DailyReportRecord[]>("/api/daily-reports"),
        apiRequest<WeeklyScreeningRecord[]>("/api/weekly-screenings"),
          apiRequest<ObservationRecord[]>("/api/observations"),
        ]);
      setPatients(nextPatients);
      setLogs(nextLogs);
      setDailyReports(nextDailyReports);
      setScreenings(nextScreenings);
      setObservations(nextObservations);
    } catch (error) {
      toast({
        title: "Could not load the patient dashboard",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    const requestedPatientId = searchParams.get("patient");
    if (requestedPatientId && requestedPatientId !== selectedPatientId) {
      setSelectedPatientId(requestedPatientId);
      setForm((current) => ({ ...current, patientId: requestedPatientId }));
    }
  }, [searchParams, selectedPatientId]);

  const patientIds = Array.from(
    new Set([
      ...patients.map((patient) => patient.username),
      ...logs.map((log) => log.patientId),
      ...dailyReports.map((report) => report.patientId),
      ...screenings.map((screening) => screening.patientId),
      ...observations.map((observation) => observation.patientId),
    ]),
  ).sort();
  const patientNameById = new Map(
    patients.map((patient) => [
      patient.username,
      `${formatDisplayName(patient)} (${patient.username})`,
    ]),
  );

  const isWithinTimeRange = (timestamp: string) => {
    if (timeFilter === "all") {
      return true;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(timeFilter));
    return new Date(timestamp) >= cutoff;
  };

  const filteredLogs = logs.filter((log) => {
    if (emotionFilter !== "all" && log.emotion !== emotionFilter) {
      return false;
    }

    return isWithinTimeRange(log.timestamp);
  });

  const selectedPatientAllLogs = logs.filter((log) => log.patientId === selectedPatientId);
  const selectedPatientLogs = filteredLogs.filter((log) => log.patientId === selectedPatientId);
  const selectedPatientAllDailyReports = dailyReports.filter(
    (report) => report.patientId === selectedPatientId,
  );
  const selectedPatientAllScreenings = screenings.filter(
    (screening) => screening.patientId === selectedPatientId,
  );
  const selectedPatientAllObservations = observations.filter(
    (observation) => observation.patientId === selectedPatientId,
  );
  const selectedPatientDailyReports = dailyReports.filter(
    (report) => report.patientId === selectedPatientId && isWithinTimeRange(report.timestamp),
  );
  const selectedPatientScreenings = screenings.filter(
    (screening) =>
      screening.patientId === selectedPatientId && isWithinTimeRange(screening.timestamp),
  );
  const selectedPatientObservations = observations.filter(
    (observation) =>
      observation.patientId === selectedPatientId && isWithinTimeRange(observation.timestamp),
  );
  const selectedPatientMorningReports = selectedPatientDailyReports.filter(
    (report) => report.reportType === "morning",
  );
  const selectedPatientNightReports = selectedPatientDailyReports.filter(
    (report) => report.reportType === "night",
  );
  const lastEntry = selectedPatientLogs[0] ?? null;
  const lastMorningReport = selectedPatientMorningReports[0] ?? null;
  const lastNightReport = selectedPatientNightReports[0] ?? null;
  const dominantEmotion = selectedPatientLogs.reduce(
    (current, log) => {
      current[log.emotion] = (current[log.emotion] ?? 0) + 1;
      return current;
    },
    {} as Record<EmotionName, number>,
  );

  let dominantEmotionLabel = "None";
  let dominantEmotionCount = 0;

  for (const emotion of emotionOptions) {
    const count = dominantEmotion[emotion] ?? 0;
    if (count > dominantEmotionCount) {
      dominantEmotionLabel = emotion;
      dominantEmotionCount = count;
    }
  }

  const totalObservations = selectedPatientLogs.reduce(
    (count, log) => count + log.observations.length,
    0,
  );
  const entriesWithLocation = selectedPatientLogs.filter(
    (log) => log.latitude != null && log.longitude != null,
  ).length;
  const corroboratedEntries = selectedPatientLogs.filter(
    (log) => getCheckInRichness(log) === "Corroborated",
  ).length;
  const structuredEntries = selectedPatientLogs.filter(
    (log) => getCheckInRichness(log) === "Structured",
  ).length;
  const averageSleepHours = getAverage(
    selectedPatientLogs.map((log) => log.sleepHours).filter(isNumber),
  );
  const averageStressLevel = getAverage(
    selectedPatientLogs.map((log) => log.stressLevel).filter(isNumber),
  );
  const averageCravingLevel = getAverage(
    selectedPatientLogs.map((log) => log.cravingLevel).filter(isNumber),
  );
  const latestScreening = getLatestWeeklyScreening(selectedPatientAllScreenings);
  const screeningDisposition = latestScreening
    ? getWeeklyScreeningDisposition(latestScreening)
    : null;
  const screeningSignals = latestScreening
    ? getWeeklyScreeningSignals(latestScreening)
    : [];
  const screeningDue = isWeeklyScreeningDue(selectedPatientAllScreenings);
  const screeningReviewAction = screeningDisposition
    ? getWeeklyScreeningRecommendedAction(screeningDisposition)
    : "Ask the patient to complete the weekly safety screen so the care team has a current baseline.";
  const substanceUseDays = selectedPatientLogs.filter((log) => log.substanceUseToday).length;
  const moneyChangeDays = selectedPatientLogs.filter((log) => log.moneyChangedToday).length;
  const adherenceConcernDays = selectedPatientLogs.filter(
    (log) =>
      log.medicationAdherence === "missed_some" || log.medicationAdherence === "missed_all",
  ).length;
  const trendPoints = buildTrendPoints(selectedPatientLogs, 7);
  const reviewSignals = getReviewSignals(
    selectedPatientLogs,
    selectedPatientDailyReports,
    selectedPatientScreenings,
    selectedPatientObservations,
  );
  const clinicianSummary = buildClinicianSummary(
    selectedPatientId,
    selectedPatientAllLogs,
    selectedPatientAllDailyReports,
    selectedPatientAllScreenings,
    selectedPatientAllObservations,
  );
  const averageSleepDuration = getAverageSleepDuration(selectedPatientMorningReports);
  const averageSleepQuality = getAverageSleepQuality(selectedPatientMorningReports);
  const averageWakeUps = getAverageWakeUps(selectedPatientMorningReports);
  const patientRiskSnapshots = buildPatientRiskSnapshots(
    logs,
    dailyReports,
    screenings,
    observations,
  );
  const selectedPatientRisk =
    patientRiskSnapshots.find((snapshot) => snapshot.patientId === selectedPatientId) ?? null;
  const weeklyReview = buildWeeklyPatientReview(
    selectedPatientId,
    selectedPatientAllLogs,
    selectedPatientAllDailyReports,
    selectedPatientAllScreenings,
    selectedPatientAllObservations,
  );
  const screeningActions = Array.from(
    new Set([screeningReviewAction, ...weeklyReview.suggestedActions]),
  );
  const focusRisk = selectedPatientRisk ?? weeklyReview.risk;
  const criticalPatients = patientRiskSnapshots.filter(
    (snapshot) => snapshot.riskLevel === "Critical",
  ).length;
  const highPatients = patientRiskSnapshots.filter(
    (snapshot) => snapshot.riskLevel === "High",
  ).length;
  const recommendedCarePathways = getRecommendedCarePathways(focusRisk.riskLevel);
  const criticalAlert = getSupportCriticalAlert(
    selectedPatientAllLogs,
    selectedPatientAllDailyReports,
    selectedPatientAllScreenings,
  );
  const selectedPatientFlags = Array.from(
    new Set(selectedPatientLogs.flatMap((log) => getEmotionFlags(log))),
  );
  const sleepTrendPoints = selectedPatientMorningReports
    .slice(0, 7)
    .reverse()
    .map((report) => ({
      label: format(new Date(report.timestamp), "MMM d"),
      value: getSleepDurationHours(report.bedTime, report.wakeTime),
    }));
  const wakeUpTrendPoints = selectedPatientMorningReports
    .slice(0, 7)
    .reverse()
    .map((report) => ({
      label: format(new Date(report.timestamp), "MMM d"),
      value: report.wakeUps ?? null,
    }));
  const positiveOrUrgentScreenCount = selectedPatientScreenings.filter((screening) => {
    const disposition = getWeeklyScreeningDisposition(screening);
    return disposition === "positive" || disposition === "urgent";
  }).length;

  useEffect(() => {
    if (patientIds.length > 0 && !patientIds.includes(selectedPatientId)) {
      setSelectedPatientId(patientIds[0]);
      setForm((current) => ({ ...current, patientId: patientIds[0] }));
      setSearchParams({ patient: patientIds[0] }, { replace: true });
    }
  }, [patientIds, selectedPatientId, setSearchParams]);

  useEffect(() => {
    setShowCriticalAlert(Boolean(criticalAlert));
  }, [selectedPatientId, criticalAlert?.targetId]);

  useEffect(() => {
    if (!pendingScrollTargetId) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const target = document.getElementById(pendingScrollTargetId);
      if (!target) {
        return;
      }

      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setPendingScrollTargetId(null);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    pendingScrollTargetId,
    activeTab,
    timeFilter,
    emotionFilter,
    selectedPatientLogs.length,
    selectedPatientDailyReports.length,
    selectedPatientScreenings.length,
  ]);

  const handleFormChange =
    (field: keyof ObservationFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setForm((current) => {
        if (field === "observationType") {
          return { ...current, observationType: value as ObservationType };
        }

        if (field === "priority") {
          return { ...current, priority: value as ObservationPriority };
        }

        return { ...current, [field]: value };
      });

      if (field === "patientId") {
        setSelectedPatientId(value);
      }
    };

  const selectPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
    setForm((current) => ({ ...current, patientId }));
    setSearchParams({ patient: patientId }, { replace: true });
  };

  const handleOpenDoctorReview = () => {
    navigate(`/doctor/${encodeURIComponent(selectedPatientId)}`);
  };

  const handleOpenCriticalAlert = () => {
    if (!criticalAlert) {
      return;
    }

    setShowCriticalAlert(false);
    setTimeFilter("all");
    setEmotionFilter("all");
    setActiveTab(criticalAlert.tab);
    setPendingScrollTargetId(criticalAlert.targetId);
  };

  const handleOpenAccessManagement = () => {
    navigate("/support/access");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await apiRequest("/api/observations", {
        method: "POST",
        data: form,
      });

      toast({
        title: "Observation added",
        description: "The note has been saved to the local database.",
        variant: "success",
      });

      setForm((current) => ({
        ...current,
        observationType: "Clinical",
        observation: "",
        priority: "Medium",
      }));

      await loadDashboard();
      setActiveTab("timeline");
    } catch (error) {
      toast({
        title: "Could not save observation",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    if (logs.length === 0 && dailyReports.length === 0 && screenings.length === 0) {
      toast({
        title: "Nothing to export",
        description: "Patient information will be exportable after entries exist.",
        variant: "info",
      });
      return;
    }

    const exportPayload = {
      emotionLogs: filteredLogs,
      dailyReports: dailyReports.filter((report) => isWithinTimeRange(report.timestamp)),
      weeklyScreenings: screenings.filter((screening) =>
        isWithinTimeRange(screening.timestamp),
      ),
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "emotion-tracker-logs.json";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(clinicianSummary);
      toast({
        title: "Summary copied",
        description: "The clinician summary is ready to paste into a note or email draft.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Could not copy summary",
        description: getErrorMessage(error),
        variant: "error",
      });
    }
  };

  const handleCopyWeeklyReview = async () => {
    try {
      await navigator.clipboard.writeText(weeklyReview.plainText);
      toast({
        title: "Weekly review copied",
        description: "The weekly review is ready to paste into a chart note or email draft.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Could not copy weekly review",
        description: getErrorMessage(error),
        variant: "error",
      });
    }
  };

  const handleDownloadWeeklyReview = () => {
    const blob = new Blob([weeklyReview.plainText], {
      type: "text/plain;charset=utf-8",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedPatientId}-weekly-review.txt`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const supportTabs = [
    {
      id: "queue",
      label: "Priority Queue",
      description: "Ranked follow-up view",
      badge: criticalPatients > 0 ? criticalPatients : patientRiskSnapshots.length,
    },
    {
      id: "screening",
      label: "Safety Review",
      description: "Weekly screening and follow-up",
      badge:
        screeningDisposition === "urgent"
          ? "Critical"
          : screeningDisposition === "positive"
            ? "Alert"
            : screeningDue
              ? "Due"
              : selectedPatientScreenings.length || undefined,
    },
    {
      id: "timeline",
      label: "Mood Timeline",
      description: "Check-ins and observations",
      badge: selectedPatientLogs.length,
    },
    {
      id: "sleep",
      label: "Sleep Reports",
      description: "Morning and night history",
      badge: selectedPatientDailyReports.length,
    },
    {
      id: "notes",
      label: "Notes & Pathways",
      description: "Observation tools",
    },
  ];

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-container flex items-center justify-between gap-4 py-4">
          <BrandMark
            variant="compact"
            showTagline={false}
            context="Support Dashboard"
            subtitle={supportWorkerName}
          />

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="btn btn-secondary" onClick={handleOpenAccessManagement}>
              <UserPlus className="h-4 w-4" />
              Manage Access
            </button>
            <button type="button" className="btn btn-secondary" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="app-container py-6 md:py-8">
        {showCriticalAlert && criticalAlert ? (
          <CriticalAlertOverlay
            patientId={selectedPatientId}
            alert={criticalAlert}
            onOpen={handleOpenCriticalAlert}
            onDismiss={() => setShowCriticalAlert(false)}
          />
        ) : null}

        <section className="hero-panel">
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Care Team Workspace</p>
              <h2 className="hero-title text-balance">
                A calmer dashboard for triage, review, and documentation.
              </h2>
              <p className="hero-text">
                Keep one patient in focus, move between queue, safety screens, logs, sleep, and
                notes, then jump into the separate doctor page when you need the full review.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" className="btn btn-primary" onClick={handleOpenDoctorReview}>
                  <Route className="h-4 w-4" />
                  Open Doctor Review
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleExport}>
                  <ClipboardList className="h-4 w-4" />
                  Export JSON
                </button>
              </div>
            </div>

            <div className="metric-grid">
              <MetricTile
                label="Patients tracked"
                value={patientRiskSnapshots.length}
                detail={`${criticalPatients} critical and ${highPatients} high priority right now.`}
                tone="sky"
              />
              <MetricTile
                label="Patient in focus"
                value={selectedPatientId}
                detail={focusRisk.summary}
                tone="coral"
              />
              <MetricTile
                label="Risk status"
                value={focusRisk.riskLevel}
                detail={
                  focusRisk.lastSeenAt
                    ? formatLastSeen(focusRisk.lastSeenAt)
                    : "No recent patient data recorded yet."
                }
                tone="gold"
              />
              <MetricTile
                label="Data in view"
                value={`${selectedPatientLogs.length} logs`}
                detail={`${selectedPatientDailyReports.length} sleep reports and ${selectedPatientScreenings.length} weekly screens in ${getTimeFilterLabel(timeFilter)}.`}
                tone="mint"
              />
            </div>
          </div>
        </section>

        <section className="surface-panel mt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="mini-heading">Focus Controls</p>
              <h3 className="section-title mt-3">Choose the patient and trim the noise.</h3>
              <p className="section-copy">
                Filters stay at the top so you can change scope once, then move through the tabs.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={`badge ${riskMeta[focusRisk.riskLevel].badgeClass}`}>
                {focusRisk.riskLevel} priority
              </span>
              <span className="badge bg-slate-100 text-slate-700">
                {emotionFilter === "all" ? "All emotions" : emotionFilter}
              </span>
            </div>
          </div>

          <div className="form-grid mt-6">
            <div>
              <label className="label" htmlFor="patient-filter">
                Patient focus
              </label>
              <select
                id="patient-filter"
                className="input"
                value={selectedPatientId}
                onChange={(event) => selectPatient(event.target.value)}
              >
                {(patientIds.length > 0 ? patientIds : ["patient1"]).map((patientId) => (
                  <option key={patientId} value={patientId}>
                    {patientNameById.get(patientId) ?? patientId}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="time-filter">
                Time range
              </label>
              <select
                id="time-filter"
                className="input"
                value={timeFilter}
                onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="label" htmlFor="emotion-filter">
                Emotion filter
              </label>
              <select
                id="emotion-filter"
                className="input"
                value={emotionFilter}
                onChange={(event) => setEmotionFilter(event.target.value as EmotionName | "all")}
              >
                <option value="all">All emotions</option>
                {emotionOptions.map((emotion) => (
                  <option key={emotion} value={emotion}>
                    {emotion}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <SectionTabs
          tabs={supportTabs}
          value={activeTab}
          onChange={(nextValue) => setActiveTab(nextValue as SupportWorkspace)}
        />

        <div className="content-stack">
          {activeTab === "queue" ? (
            <div className="content-grid">
              <section className="surface-panel">
                    <SectionHeader
                      eyebrow="Priority Queue"
                      title="See who needs review first."
                      copy="Patients are ranked from recent risk signals across mood, sleep, weekly screening, medication, and substance-use data."
                    />

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {patientRiskSnapshots.length > 0 ? (
                    patientRiskSnapshots.map((snapshot) => (
                      <QueueCard
                        key={snapshot.patientId}
                        snapshot={snapshot}
                        selected={snapshot.patientId === selectedPatientId}
                        onSelect={() => selectPatient(snapshot.patientId)}
                      />
                    ))
                  ) : (
                    <EmptyPanel
                      className="lg:col-span-2"
                      message="No patients have recorded data yet, so the priority queue is empty."
                    />
                  )}
                </div>
              </section>

              <div className="content-stack">
                <section className="surface-panel">
                  <SectionHeader
                    eyebrow="Patient Focus"
                    title={`${selectedPatientId} at a glance`}
                    copy={focusRisk.summary}
                  />

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className={`badge ${riskMeta[focusRisk.riskLevel].badgeClass}`}>
                      {focusRisk.riskLevel}
                    </span>
                    <span className="badge bg-slate-100 text-slate-700">
                      Score {focusRisk.score}
                    </span>
                    <span className="badge bg-white text-slate-700">
                      Dominant mood: {focusRisk.dominantEmotion ?? "None"}
                    </span>
                    <span className="badge bg-slate-100 text-slate-700">
                      Reliability: {focusRisk.reliabilityLevel}
                    </span>
                    {focusRisk.mismatchSummary ? (
                      <span className="badge bg-amber-100 text-amber-900">
                        Perspective mismatch
                      </span>
                    ) : null}
                    {focusRisk.crisisLevel !== "none" ? (
                      <span className="badge bg-rose-100 text-rose-900">
                        {focusRisk.crisisLevel === "critical" ? "Critical safety alert" : "Safety alert"}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-4">
                    <div className="timeline-card">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        What is happening?
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {focusRisk.whatChanged.length > 0
                          ? focusRisk.whatChanged.join(" ")
                          : "No major change signal was detected this week."}
                      </p>
                    </div>
                    <div className="timeline-card">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        How serious is it?
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {focusRisk.riskLevel} priority.
                        {focusRisk.crisisSummary ? ` ${focusRisk.crisisSummary}` : ""}
                      </p>
                    </div>
                    <div className="timeline-card">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Why is it happening?
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {focusRisk.reasons.length > 0
                          ? focusRisk.reasons.join(" ")
                          : "No major review reason was detected yet."}
                      </p>
                    </div>
                    <div className="timeline-card">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        What should the doctor do?
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {focusRisk.suggestedActions.join(" ")}
                      </p>
                    </div>
                    {focusRisk.mismatchSummary ? (
                      <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                        {focusRisk.mismatchSummary}
                      </div>
                    ) : null}
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      {focusRisk.reliabilitySummary}
                    </div>
                  </div>
                </section>

                <section className="surface-panel">
                  <SectionHeader
                    eyebrow="Suggested Actions"
                    title="Move from ranking into follow-up."
                    copy="The app keeps the next reasonable step visible instead of burying it lower on the page."
                  />

                  <div className="mt-5 flex flex-wrap gap-2">
                    {weeklyReview.suggestedActions.length > 0 ? (
                      weeklyReview.suggestedActions.map((action) => (
                        <span key={action} className="badge bg-sky-100 text-sky-900">
                          {action}
                        </span>
                      ))
                    ) : (
                      <span className="badge bg-slate-100 text-slate-700">
                        Continue routine monitoring
                      </span>
                    )}
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleOpenDoctorReview}
                    >
                      <Route className="h-4 w-4" />
                      Open Doctor Review
                    </button>
                  </div>

                  {criticalAlert ? (
                    <CriticalAlertCallout
                      className="mt-6"
                      patientId={selectedPatientId}
                      alert={criticalAlert}
                      onOpen={handleOpenCriticalAlert}
                    />
                  ) : null}

                  <div className="mt-6">
                    <p className="text-sm font-semibold text-slate-900">
                      Recommended care links
                    </p>
                    <div className="mt-3 grid gap-3">
                      {recommendedCarePathways.slice(0, 3).map((pathway) => (
                        <a
                          key={pathway.id}
                          href={pathway.href}
                          target={pathway.kind === "website" ? "_blank" : undefined}
                          rel={pathway.kind === "website" ? "noreferrer" : undefined}
                          className="selection-card bg-white"
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-sky-50 text-sky-700">
                            <Route className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{pathway.label}</p>
                            <p className="mt-1 text-sm text-slate-600">{pathway.description}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {activeTab === "overview" ? (
            <div className="content-grid">
              <div className="content-stack">
                <section className="surface-panel">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <SectionHeader
                      eyebrow="Clinician Snapshot"
                      title={`Prepared summary for ${selectedPatientId}`}
                      copy="A compressed handoff view for a doctor, nurse practitioner, or support worker."
                    />
                    <button type="button" className="btn btn-secondary" onClick={handleCopySummary}>
                      <Copy className="h-4 w-4" />
                      Copy Summary
                    </button>
                  </div>

                  <div className="mt-6 whitespace-pre-line rounded-[28px] border border-slate-200 bg-white px-5 py-5 text-sm leading-7 text-slate-700">
                    {clinicianSummary}
                  </div>

                  <div className="mt-5">
                    <p className="text-sm font-semibold text-slate-900">Review signals</p>
                    {reviewSignals.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {reviewSignals.map((signal) => (
                          <span key={signal} className="badge bg-amber-100 text-amber-900">
                            {signal}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        No repeated review signals were detected in the current view.
                      </p>
                    )}
                  </div>
                </section>

                <section className="surface-panel">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <SectionHeader
                      eyebrow="Weekly Review"
                      title={`One-week handoff for ${selectedPatientId}`}
                      copy="Keep the important changes, actions, and data gaps grouped together."
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleCopyWeeklyReview}
                      >
                        <Copy className="h-4 w-4" />
                        Copy Review
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleDownloadWeeklyReview}
                      >
                        <Download className="h-4 w-4" />
                        Download TXT
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 rounded-[28px] border border-slate-200 bg-white px-5 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Current risk status</p>
                        <p className="mt-1 text-sm text-slate-600">{focusRisk.summary}</p>
                      </div>
                      <span className={`badge ${riskMeta[focusRisk.riskLevel].badgeClass}`}>
                        {focusRisk.riskLevel}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-5 lg:grid-cols-3">
                    <ReviewColumn
                      title="Key changes"
                      emptyMessage="There is not enough weekly data yet to summarize key changes."
                      items={weeklyReview.keyChanges}
                      className="bg-white"
                    />
                    <ReviewColumn
                      title="Suggested next steps"
                      emptyMessage="Continue routine follow-up and keep collecting daily data."
                      items={weeklyReview.suggestedActions}
                      asBadges
                      className="bg-white"
                    />
                    <ReviewColumn
                      title="Data gaps"
                      emptyMessage="No major data gap was detected in the last week."
                      items={weeklyReview.dataGaps}
                      className="bg-amber-50 border-amber-200"
                    />
                  </div>
                </section>
              </div>

              <div className="content-stack">
                <section className="surface-panel">
                  <SectionHeader
                    eyebrow="Patient Metrics"
                    title="Quick numbers for the current scope"
                    copy={`Using ${getTimeFilterLabel(timeFilter)} with ${emotionFilter === "all" ? "all emotions" : `${emotionFilter.toLowerCase()} entries`}.`}
                  />

                  <div className="metric-grid mt-6">
                    <MetricTile
                      label="Dominant mood"
                      value={dominantEmotionLabel}
                      detail={
                        dominantEmotionCount > 0
                          ? `${dominantEmotionCount} matching check-ins in range.`
                          : "No mood pattern yet."
                      }
                      tone="plum"
                    />
                    <MetricTile
                      label="Average stress"
                      value={
                        averageStressLevel != null
                          ? `${averageStressLevel.toFixed(1)}/10`
                          : "N/A"
                      }
                      detail="Pulled from mood check-ins in the current view."
                      tone="coral"
                    />
                    <MetricTile
                      label="Average cravings"
                      value={
                        averageCravingLevel != null
                          ? `${averageCravingLevel.toFixed(1)}/10`
                          : "N/A"
                      }
                      detail="Useful when lining up mood, money change, and use."
                      tone="gold"
                    />
                    <MetricTile
                      label="Average sleep"
                      value={
                        averageSleepDuration != null
                          ? `${averageSleepDuration.toFixed(1)} h`
                          : averageSleepHours != null
                            ? `${averageSleepHours.toFixed(1)} h`
                            : "N/A"
                      }
                      detail="Prefers morning reports when they exist."
                      tone="mint"
                    />
                  </div>
                </section>

                <section className="surface-panel">
                  <SectionHeader
                    eyebrow="Trend View"
                    title="Small charts for fast scanning"
                    copy="Use these to see whether sleep, stress, or cravings are moving in the wrong direction."
                  />

                  <div className="mt-6 grid gap-4">
                    <TrendMiniChart
                      title="Sleep Trend"
                      color="#7c3aed"
                      maxValue={12}
                      suffix="h"
                      points={trendPoints.map((point) => ({
                        label: point.label,
                        value: point.sleep,
                      }))}
                    />
                    <TrendMiniChart
                      title="Stress Trend"
                      color="#e11d48"
                      maxValue={10}
                      suffix="/10"
                      points={trendPoints.map((point) => ({
                        label: point.label,
                        value: point.stress,
                      }))}
                    />
                    <TrendMiniChart
                      title="Craving Trend"
                      color="#d97706"
                      maxValue={10}
                      suffix="/10"
                      points={trendPoints.map((point) => ({
                        label: point.label,
                        value: point.cravings,
                      }))}
                    />
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {activeTab === "screening" ? (
            <div className="content-grid">
              <section className="surface-panel">
                <SectionHeader
                  eyebrow="Weekly Safety Review"
                  title={`Latest weekly screen for ${selectedPatientId}`}
                  copy="Keep the newest safety screen, follow-up action, and recent history together so the care team can react faster."
                />

                <div className="mt-6">
                  {isLoadingLogs ? (
                    <EmptyPanel message="Loading the latest weekly screen..." />
                  ) : latestScreening ? (
                    <div id={`support-screening-${latestScreening.id}`}>
                      <WeeklyScreeningCard screening={latestScreening} />
                    </div>
                  ) : (
                    <EmptyPanel message="No weekly safety screen has been completed for this patient yet." />
                  )}
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  <ReviewColumn
                    title="Top screening signals"
                    emptyMessage="No extra weekly screening signals were flagged on the latest screen."
                    items={screeningSignals}
                    asBadges
                    className="bg-white"
                  />
                  <ReviewColumn
                    title="Suggested follow-up"
                    emptyMessage="Continue routine monitoring and keep the weekly screen current."
                    items={screeningActions}
                    asBadges
                    className="bg-white"
                  />
                </div>

                <section className="mt-6 rounded-[28px] border border-slate-200 bg-white px-5 py-5">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-sky-600" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Recent screening history</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Use this to see whether the screen is new, overdue, or repeating the same concerns.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {isLoadingLogs ? (
                      <EmptyPanel message="Loading patient screening data..." />
                    ) : selectedPatientScreenings.length > 0 ? (
                      selectedPatientScreenings.slice(0, 4).map((screening) => (
                        <div key={screening.id} id={`support-screening-${screening.id}`}>
                          <WeeklyScreeningCard
                            screening={screening}
                            compact={screening.id !== latestScreening?.id}
                          />
                        </div>
                      ))
                    ) : (
                      <EmptyPanel message="No weekly screens match the current time range for this patient." />
                    )}
                  </div>
                </section>
              </section>

              <div className="content-stack">
                <section className="surface-panel">
                  <SectionHeader
                    eyebrow="Safety Status"
                    title="Read the weekly screen at a glance"
                    copy="These tiles keep the status, due date, and follow-up direction visible while you work."
                  />

                  <div className="metric-grid mt-6">
                    <MetricTile
                      label="Weekly status"
                      value={screeningDue ? "Due" : "Current"}
                      detail={getWeeklyScreeningStatusText(selectedPatientAllScreenings)}
                      tone="gold"
                    />
                    <MetricTile
                      label="Latest result"
                      value={
                        screeningDisposition
                          ? getWeeklyScreeningDispositionLabel(screeningDisposition)
                          : "Not started"
                      }
                      detail={screeningReviewAction}
                      tone="coral"
                    />
                    <MetricTile
                      label="Screens in view"
                      value={selectedPatientScreenings.length}
                      detail={`${positiveOrUrgentScreenCount} positive or urgent screens in ${getTimeFilterLabel(timeFilter)}.`}
                      tone="sky"
                    />
                    <MetricTile
                      label="Current thoughts"
                      value={
                        latestScreening?.currentThoughts == null
                          ? "N/A"
                          : latestScreening.currentThoughts
                            ? "Yes"
                            : "No"
                      }
                      detail="Pulled from the latest weekly screen."
                      tone="mint"
                    />
                  </div>
                </section>

                <section className="surface-panel">
                  <SectionHeader
                    eyebrow="Support Factors"
                    title="Protective details from the latest screen"
                    copy="These details help staff move from risk review into concrete follow-up questions."
                  />

                  {latestScreening ? (
                    <div className="mt-5 space-y-3">
                      <DetailTile
                        label="Support person"
                        value={latestScreening.supportPerson || "Not recorded"}
                      />
                      <DetailTile
                        label="Needs help staying safe"
                        value={
                          latestScreening.needsHelpStayingSafe == null
                            ? "Not answered"
                            : latestScreening.needsHelpStayingSafe
                              ? "Yes"
                              : "No"
                        }
                      />
                      <TextDetailCard
                        title="Reasons for living"
                        value={latestScreening.reasonsForLiving}
                        emptyMessage="No reasons for living were written on the latest screen."
                      />
                      <TextDetailCard
                        title="Safety plan or coping ideas"
                        value={latestScreening.copingPlan}
                        emptyMessage="No coping plan was written on the latest screen."
                      />
                    </div>
                  ) : isLoadingLogs ? (
                    <EmptyPanel message="Loading protective factors from the latest weekly screen..." />
                  ) : (
                    <EmptyPanel message="Protective factors will appear here after the first weekly screen is completed." />
                  )}
                </section>

                <section className="surface-panel">
                  <SectionHeader
                    eyebrow="Screening Notes"
                    title="How to use this data"
                    copy="This weekly screen is a structured follow-up tool, not a diagnosis. Pair it with interview, observation, and the rest of the timeline."
                  />

                  <div className="mt-5 space-y-3">
                    <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                      Positive or urgent results should move into a same-day safety review rather than sitting as raw data.
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      Weekly screens are strongest when reviewed beside sleep disruption, cravings, substance use, missed meds, and staff observations.
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {activeTab === "timeline" ? (
            <div className="content-grid">
              <section className="surface-panel">
                <SectionHeader
                  eyebrow="Mood Timeline"
                  title={`Recent check-ins for ${selectedPatientId}`}
                  copy="Mood entries, supporting data, GPS snapshots, and linked observations stay together here."
                />

                <div className="mt-6 space-y-4">
                  {isLoadingLogs ? (
                    <EmptyPanel message="Loading patient logs..." />
                  ) : selectedPatientLogs.length > 0 ? (
                    selectedPatientLogs.map((log) => (
                      <div key={log.id} id={`support-log-${log.id}`}>
                        <EmotionLogCard log={log} onSelectPatient={selectPatient} />
                      </div>
                    ))
                  ) : (
                    <EmptyPanel message="No emotion logs match the current filters for this patient yet." />
                  )}
                </div>
              </section>

              <div className="content-stack">
                <section className="surface-panel">
                  <SectionHeader
                    eyebrow="What Stands Out"
                    title="Timeline summary"
                    copy="These totals help you understand how much detail is behind the current patient view."
                  />

                  <div className="metric-grid mt-6">
                    <MetricTile
                      label="Observations"
                      value={totalObservations}
                      detail="Notes linked directly to the entries currently shown."
                      tone="sky"
                    />
                    <MetricTile
                      label="GPS-supported"
                      value={entriesWithLocation}
                      detail="Entries that included a saved location snapshot."
                      tone="gold"
                    />
                    <MetricTile
                      label="Structured"
                      value={structuredEntries}
                      detail="Entries with added context beyond just the emotion."
                      tone="mint"
                    />
                    <MetricTile
                      label="Corroborated"
                      value={corroboratedEntries}
                      detail="Entries with stronger supporting detail like GPS."
                      tone="plum"
                    />
                  </div>
                </section>

                <section className="surface-panel">
                  <SectionHeader
                    eyebrow="Pattern Clues"
                    title="Flags in the current timeline"
                    copy="These are neutral prompts for follow-up, not conclusions."
                  />

                  <div className="mt-5 flex flex-wrap gap-2">
                    {selectedPatientFlags.length > 0 ? (
                      selectedPatientFlags.map((flag) => (
                        <span key={flag} className="badge bg-amber-100 text-amber-900">
                          {flag}
                        </span>
                      ))
                    ) : (
                      <span className="badge bg-slate-100 text-slate-700">
                        No log-specific flags in the current range
                      </span>
                    )}
                  </div>

                  <div className="mt-6 space-y-3">
                    <SummaryRow label="Substance-use days" value={String(substanceUseDays)} />
                    <SummaryRow label="Big money-change days" value={String(moneyChangeDays)} />
                    <SummaryRow
                      label="Medication concern days"
                      value={String(adherenceConcernDays)}
                    />
                    <SummaryRow
                      label="Last mood entry"
                      value={lastEntry ? format(new Date(lastEntry.timestamp), "MMM d, h:mm a") : "None"}
                    />
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {activeTab === "sleep" ? (
            <div className="content-grid">
              <section className="surface-panel">
                <SectionHeader
                  eyebrow="Sleep Reports"
                  title={`Morning and night reports for ${selectedPatientId}`}
                  copy="Use this section to compare reported sleep routine with the emotional timeline."
                />

                <div className="mt-6 space-y-3">
                  {selectedPatientDailyReports.length > 0 ? (
                    selectedPatientDailyReports.slice(0, 8).map((report) => (
                      <div key={report.id} id={`support-report-${report.id}`}>
                        <SleepReportCard report={report} />
                      </div>
                    ))
                  ) : (
                    <EmptyPanel message="No daily sleep reports are recorded in the selected time range." />
                  )}
                </div>
              </section>

              <div className="content-stack">
                <section className="surface-panel">
                  <SectionHeader
                    eyebrow="Sleep Summary"
                    title="Routine details in one place"
                    copy="Morning reports tend to be the strongest source for sleep duration, quality, and wake-ups."
                  />

                  <div className="metric-grid mt-6">
                    <MetricTile
                      label="Reports in range"
                      value={selectedPatientDailyReports.length}
                      detail={`${selectedPatientMorningReports.length} morning and ${selectedPatientNightReports.length} night reports.`}
                      tone="sky"
                    />
                    <MetricTile
                      label="Average duration"
                      value={
                        averageSleepDuration != null
                          ? `${averageSleepDuration.toFixed(1)} h`
                          : "N/A"
                      }
                      detail="Calculated from morning sleep and wake times."
                      tone="plum"
                    />
                    <MetricTile
                      label="Average quality"
                      value={averageSleepQuality ?? "N/A"}
                      detail="The most common morning sleep experience."
                      tone="gold"
                    />
                    <MetricTile
                      label="Average wake-ups"
                      value={averageWakeUps != null ? averageWakeUps.toFixed(1) : "N/A"}
                      detail="Only from morning reports that included the number."
                      tone="mint"
                    />
                  </div>

                  <div className="mt-6 space-y-3">
                    <SummaryRow
                      label="Last morning report"
                      value={
                        lastMorningReport
                          ? format(new Date(lastMorningReport.timestamp), "MMM d, h:mm a")
                          : "None"
                      }
                    />
                    <SummaryRow
                      label="Last night report"
                      value={
                        lastNightReport
                          ? format(new Date(lastNightReport.timestamp), "MMM d, h:mm a")
                          : "None"
                      }
                    />
                  </div>
                </section>

                <section className="surface-panel">
                  <SectionHeader
                    eyebrow="Sleep Trends"
                    title="Small charts for duration and wake-ups"
                    copy="These help explain when sleep disruption starts showing up alongside mood changes."
                  />

                  <div className="mt-6 grid gap-4">
                    <TrendMiniChart
                      title="Sleep Duration"
                      color="#7c3aed"
                      maxValue={12}
                      suffix="h"
                      points={sleepTrendPoints}
                    />
                    <TrendMiniChart
                      title="Night Wake-Ups"
                      color="#f59e0b"
                      maxValue={10}
                      suffix=""
                      points={wakeUpTrendPoints}
                    />
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {activeTab === "notes" ? (
            <div className="content-grid">
              <section className="surface-panel">
                <SectionHeader
                  eyebrow="Add Observation"
                  title={`Save a note for ${selectedPatientId}`}
                  copy="Use the observation form for professional notes, follow-up details, and quick documentation."
                />

                <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label className="label" htmlFor="patient-id">
                      Patient ID
                    </label>
                    <input
                      id="patient-id"
                      className="input"
                      list="patient-id-options"
                      value={form.patientId}
                      onChange={handleFormChange("patientId")}
                      placeholder="Enter patient ID"
                    />
                    <datalist id="patient-id-options">
                      {patientIds.map((patientId) => (
                        <option key={patientId} value={patientId} />
                      ))}
                    </datalist>
                  </div>

                  <div className="form-grid">
                    <div>
                      <label className="label" htmlFor="observation-type">
                        Observation type
                      </label>
                      <select
                        id="observation-type"
                        className="input"
                        value={form.observationType}
                        onChange={handleFormChange("observationType")}
                      >
                        {observationTypeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label" htmlFor="priority">
                        Priority
                      </label>
                      <select
                        id="priority"
                        className="input"
                        value={form.priority}
                        onChange={handleFormChange("priority")}
                      >
                        {priorityOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="label" htmlFor="observation">
                      Observation details
                    </label>
                    <textarea
                      id="observation"
                      className="input min-h-40 resize-y"
                      value={form.observation}
                      onChange={handleFormChange("observation")}
                      placeholder="Enter your professional note..."
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="support-worker-name">
                      Support worker name
                    </label>
                    <input
                      id="support-worker-name"
                      className="input"
                      value={form.supportWorkerName}
                      onChange={handleFormChange("supportWorkerName")}
                      placeholder="Enter your name"
                    />
                  </div>

                  <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
                    <NotebookPen className="h-4 w-4" />
                    {isSubmitting ? "Saving..." : "Save Observation"}
                  </button>
                </form>
              </section>

              <div className="content-stack">
                <section className="surface-panel">
                  <SectionHeader
                    eyebrow="Doctor Handoff"
                    title="Open the full doctor review page"
                    copy="Use the separate doctor page for the summary-first packet, visit questions, medications, and care plan."
                  />

                  <div className="mt-6 grid gap-3">
                    <button
                      type="button"
                      className="btn btn-primary w-full"
                      onClick={handleOpenDoctorReview}
                    >
                      <Route className="h-4 w-4" />
                      Open doctor review page
                    </button>
                    <button type="button" className="btn btn-secondary w-full" onClick={handleExport}>
                      <ClipboardList className="h-4 w-4" />
                      Export filtered JSON
                    </button>
                  </div>
                </section>

                <section className="surface-panel">
                  <SectionHeader
                    eyebrow="NL Care Pathways"
                    title="Recommended local supports"
                    copy="These links change with the current patient risk level so the most relevant options stay close."
                  />

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className={`badge ${riskMeta[focusRisk.riskLevel].badgeClass}`}>
                      {focusRisk.riskLevel} priority
                    </span>
                    <span className="badge bg-slate-100 text-slate-700">
                      {selectedPatientId}
                    </span>
                  </div>

                  <div className="mt-6 grid gap-4">
                    {recommendedCarePathways.map((pathway) => (
                      <div key={pathway.id} className="timeline-card">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-900">{pathway.label}</p>
                              <span className="badge bg-slate-100 text-slate-700">
                                {pathway.kind === "call"
                                  ? "Call"
                                  : pathway.kind === "email"
                                    ? "Email"
                                    : "Website"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">
                              {pathway.description}
                            </p>
                          </div>

                          <a
                            href={pathway.href}
                            target={pathway.kind === "website" ? "_blank" : undefined}
                            rel={pathway.kind === "website" ? "noreferrer" : undefined}
                            className="btn btn-secondary whitespace-nowrap"
                          >
                            {pathway.kind === "call"
                              ? "Open Call Link"
                              : pathway.kind === "email"
                                ? "Open Email"
                                : "Open Website"}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    <p className="text-sm font-semibold text-slate-900">All saved care options</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {nlCarePathways.map((pathway) => (
                        <a
                          key={`all-${pathway.id}`}
                          href={pathway.href}
                          target={pathway.kind === "website" ? "_blank" : undefined}
                          rel={pathway.kind === "website" ? "noreferrer" : undefined}
                          className="badge bg-sky-100 text-sky-900"
                        >
                          {pathway.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : null}
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
      <h3 className="section-title mt-3">{title}</h3>
      <p className="section-copy">{copy}</p>
    </div>
  );
}

function CriticalAlertOverlay({
  patientId,
  alert,
  onOpen,
  onDismiss,
}: {
  patientId: string;
  alert: CriticalAlertTarget;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-4 py-10">
      <div className="w-full max-w-3xl rounded-[32px] border border-rose-200 bg-white p-6 shadow-2xl">
        <p className="mini-heading text-rose-700">Critical Alert</p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-950">
          {patientId} needs immediate review.
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-700">{alert.summary}</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">{alert.detail}</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-rose-700">
          Click below to jump straight to the triggering entry.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" className="btn btn-primary flex-1" onClick={onOpen}>
            Open Critical Alert
          </button>
          <button type="button" className="btn btn-secondary flex-1" onClick={onDismiss}>
            Dismiss For Now
          </button>
        </div>
      </div>
    </div>
  );
}

function CriticalAlertCallout({
  patientId,
  alert,
  onOpen,
  className = "",
}: {
  patientId: string;
  alert: CriticalAlertTarget;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`w-full rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-5 text-left shadow-sm transition hover:border-rose-300 hover:bg-rose-100 ${className}`}
      onClick={onOpen}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-700">
        Critical Alert
      </p>
      <h3 className="mt-3 text-2xl font-semibold text-rose-950">
        {patientId} requires immediate attention.
      </h3>
      <p className="mt-3 text-sm leading-6 text-rose-900">{alert.summary}</p>
      <p className="mt-2 text-sm leading-6 text-rose-800">{alert.detail}</p>
      <p className="mt-4 text-sm font-semibold text-rose-900">Click to open the triggering entry.</p>
    </button>
  );
}

function getSupportCriticalAlert(
  logs: EmotionLog[],
  dailyReports: DailyReportRecord[],
  screenings: WeeklyScreeningRecord[],
): CriticalAlertTarget | null {
  const candidates: Array<CriticalAlertTarget & { sortTime: number }> = [];

  for (const log of logs) {
    if (log.crisisLevel !== "critical") {
      continue;
    }

    candidates.push({
      title: "Critical Alert",
      summary: log.crisisSummary ?? "A patient check-in includes critical safety language.",
      detail: `Triggered by a ${log.emotion.toLowerCase()} check-in recorded on ${format(
        new Date(log.timestamp),
        "MMM d, yyyy 'at' h:mm a",
      )}.`,
      tab: "timeline",
      targetId: `support-log-${log.id}`,
      timestamp: log.timestamp,
      sortTime: new Date(log.timestamp).getTime(),
    });
  }

  for (const report of dailyReports) {
    if (report.crisisLevel !== "critical") {
      continue;
    }

    candidates.push({
      title: "Critical Alert",
      summary: report.crisisSummary ?? "A sleep or meals report includes critical safety language.",
      detail: `Triggered by a ${report.reportType} report recorded on ${format(
        new Date(report.timestamp),
        "MMM d, yyyy 'at' h:mm a",
      )}.`,
      tab: report.reportType === "night" ? "sleep" : "sleep",
      targetId: `support-report-${report.id}`,
      timestamp: report.timestamp,
      sortTime: new Date(report.timestamp).getTime(),
    });
  }

  for (const screening of screenings) {
    if (screening.crisisLevel !== "critical") {
      continue;
    }

    candidates.push({
      title: "Critical Alert",
      summary:
        screening.crisisSummary ??
        "The weekly screen shows a current need for immediate safety support.",
      detail: `Triggered by a weekly screen recorded on ${format(
        new Date(screening.timestamp),
        "MMM d, yyyy 'at' h:mm a",
      )}.`,
      tab: "screening",
      targetId: `support-screening-${screening.id}`,
      timestamp: screening.timestamp,
      sortTime: new Date(screening.timestamp).getTime(),
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((left, right) => right.sortTime - left.sortTime)[0];
}

function isNumber(value: number | null): value is number {
  return value != null;
}

function getAverage(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function formatLastSeen(timestamp: string) {
  return `Last patient data: ${format(new Date(timestamp), "MMM d, yyyy 'at' h:mm a")}.`;
}

function getTimeFilterLabel(timeFilter: TimeFilter) {
  if (timeFilter === "all") {
    return "all time";
  }

  return `the last ${timeFilter} days`;
}

function QueueCard({
  snapshot,
  selected,
  onSelect,
}: {
  snapshot: PatientRiskSnapshot;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`selection-card w-full ${riskMeta[snapshot.riskLevel].cardClass} ${
        selected ? "ring-2 ring-sky-500" : "ring-0"
      }`}
      onClick={onSelect}
    >
      <div className="w-full">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">{snapshot.patientId}</p>
            <p className="mt-1 text-sm text-slate-600">
              {snapshot.dominantEmotion
                ? `Recent dominant mood: ${snapshot.dominantEmotion}`
                : "No dominant mood yet"}
            </p>
          </div>
          <div className="text-right">
            <span className={`badge ${riskMeta[snapshot.riskLevel].badgeClass}`}>
              {snapshot.riskLevel}
            </span>
            <p className="mt-2 text-sm font-semibold text-slate-700">Score {snapshot.score}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {snapshot.whatChanged.length > 0 ? (
            snapshot.whatChanged.slice(0, 2).map((reason) => (
              <span key={`${snapshot.patientId}-${reason}`} className="badge bg-white/85 text-slate-700">
                {reason}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">No major review reason detected.</span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="badge bg-white/85 text-slate-700">
            Reliability {snapshot.reliabilityLevel}
          </span>
          {snapshot.mismatchSummary ? (
            <span className="badge bg-amber-100 text-amber-900">Mismatch flagged</span>
          ) : null}
          {snapshot.crisisLevel !== "none" ? (
            <span className="badge bg-rose-100 text-rose-900">
              {snapshot.crisisLevel === "critical" ? "Critical alert" : "Safety alert"}
            </span>
          ) : null}
        </div>

        <p className="mt-4 text-sm text-slate-700">
          {snapshot.suggestedActions[0] ?? "Continue routine monitoring."}
        </p>

        <p className="mt-4 text-xs text-slate-500">
          {snapshot.lastSeenAt
            ? `Last seen ${format(new Date(snapshot.lastSeenAt), "MMM d, yyyy 'at' h:mm a")}`
            : "No entries recorded yet"}
        </p>
      </div>
    </button>
  );
}

function EmotionLogCard({
  log,
  onSelectPatient,
}: {
  log: EmotionLog;
  onSelectPatient: (patientId: string) => void;
}) {
  return (
    <article className="timeline-card">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          <div className="text-4xl">{emotionMeta[log.emotion].emoji}</div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-lg font-semibold text-slate-900">{log.emotion}</h4>
              <span className={`badge ${emotionMeta[log.emotion].badgeClass}`}>
                {emotionMeta[log.emotion].statusLabel}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {format(new Date(log.timestamp), "MMM d, yyyy 'at' h:mm a")}
            </p>
            <p className="mt-1 text-sm text-slate-500">Patient ID: {log.patientId}</p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onSelectPatient(log.patientId)}
        >
          <NotebookPen className="h-4 w-4" />
          Focus Patient
        </button>
      </div>

      {log.notes ? (
        <p className="mt-4 rounded-[22px] bg-slate-50 px-4 py-4 text-sm text-slate-700">
          {log.notes}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <DetailTile label="Data richness" value={getCheckInRichness(log)} />
        <DetailTile
          label="Sleep"
          value={log.sleepHours != null ? `${log.sleepHours} hours` : "Not recorded"}
        />
        <DetailTile
          label="Stress"
          value={log.stressLevel != null ? `${log.stressLevel}/10` : "Not recorded"}
        />
        <DetailTile
          label="Cravings"
          value={log.cravingLevel != null ? `${log.cravingLevel}/10` : "Not recorded"}
        />
        <DetailTile
          label="Substance use today"
          value={
            log.substanceUseToday != null
              ? log.substanceUseToday
                ? "Yes"
                : "No"
              : "Not recorded"
          }
        />
        <DetailTile
          label="Medication"
          value={
            log.medicationAdherence != null
              ? medicationAdherenceLabels[log.medicationAdherence]
              : "Not recorded"
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="badge bg-slate-100 text-slate-700">
          Big money change:{" "}
          {log.moneyChangedToday != null ? (log.moneyChangedToday ? "Yes" : "No") : "Not recorded"}
        </span>
        {getEmotionFlags(log).map((flag) => (
          <span key={flag} className="badge bg-amber-100 text-amber-900">
            {flag}
          </span>
        ))}
      </div>

      {log.latitude != null && log.longitude != null ? (
        <div className="mt-4 rounded-[24px] border border-amber-100 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <div className="flex flex-wrap items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className="font-semibold">GPS captured</span>
            <span>{formatCoordinates(log.latitude, log.longitude)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-amber-800">
            {log.accuracyMeters != null ? (
              <span>Accuracy +/- {Math.round(log.accuracyMeters)} m</span>
            ) : null}
            {log.locationCapturedAt ? (
              <span>
                {format(new Date(log.locationCapturedAt), "MMM d, yyyy 'at' h:mm a")}
              </span>
            ) : null}
            <a
              href={buildMapsUrl(log.latitude, log.longitude)}
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline"
            >
              Open map
            </a>
          </div>
        </div>
      ) : null}

      {log.observations.length > 0 ? (
        <div className="mt-4 rounded-[24px] border border-sky-100 bg-sky-50 p-4">
          <p className="text-sm font-semibold text-sky-900">Existing observations</p>
          <div className="mt-3 space-y-3">
            {log.observations.map((observation) => (
              <div
                key={observation.id}
                className="rounded-[22px] border border-sky-100 bg-white px-4 py-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {observation.supportWorkerName}
                  </p>
                  <span className={`badge ${priorityMeta[observation.priority]}`}>
                    {observation.priority}
                  </span>
                  <span className="badge bg-slate-100 text-slate-700">
                    {observation.observationType}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{observation.observation}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {format(new Date(observation.timestamp), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function SleepReportCard({ report }: { report: DailyReportRecord }) {
  const sleepDuration = getSleepDurationHours(report.bedTime, report.wakeTime);

  return (
    <div className="timeline-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge bg-slate-100 text-slate-700">
          {dailyReportTypeLabels[report.reportType]}
        </span>
        <span className="text-xs text-slate-500">
          {format(new Date(report.timestamp), "MMM d, yyyy 'at' h:mm a")}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {report.bedTime ? (
          <span className="badge bg-indigo-50 text-indigo-800">
            Bedtime {formatClockTime(report.bedTime)}
          </span>
        ) : null}
        {report.wakeTime ? (
          <span className="badge bg-sky-50 text-sky-800">
            Wake time {formatClockTime(report.wakeTime)}
          </span>
        ) : null}
        {sleepDuration != null ? (
          <span className="badge bg-violet-50 text-violet-800">
            Duration {sleepDuration.toFixed(1)} h
          </span>
        ) : null}
        {report.sleepQuality ? (
          <span className="badge bg-emerald-50 text-emerald-800">
            Sleep quality {sleepQualityLabels[report.sleepQuality]}
          </span>
        ) : null}
        {report.wakeUps != null ? (
          <span className="badge bg-amber-50 text-amber-800">
            Wake-ups {report.wakeUps}
          </span>
        ) : null}
        {report.feltRested != null ? (
          <span className="badge bg-rose-50 text-rose-800">
            Rested: {report.feltRested ? "Yes" : "No"}
          </span>
        ) : null}
      </div>

      {report.notes ? <p className="mt-3 text-sm text-slate-700">{report.notes}</p> : null}
    </div>
  );
}

function ReviewColumn({
  title,
  items,
  emptyMessage,
  asBadges = false,
  className = "bg-white",
}: {
  title: string;
  items: string[];
  emptyMessage: string;
  asBadges?: boolean;
  className?: string;
}) {
  const classes = `rounded-[28px] border px-4 py-4 ${className}`;

  return (
    <div className={classes}>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {items.length > 0 ? (
        asBadges ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {items.map((item) => (
              <span key={item} className="badge bg-sky-100 text-sky-900">
                {item}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <div key={item} className="rounded-[22px] bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {item}
              </div>
            ))}
          </div>
        )
      ) : (
        <p className="mt-3 text-sm text-slate-500">{emptyMessage}</p>
      )}
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
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

function EmptyPanel({
  message,
  className = "",
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-6 text-sm text-slate-500 ${className}`}
    >
      {message}
    </div>
  );
}

type ChartPoint = {
  label: string;
  value: number | null;
};

function TrendMiniChart({
  title,
  color,
  maxValue,
  suffix,
  points,
}: {
  title: string;
  color: string;
  maxValue: number;
  suffix: string;
  points: ChartPoint[];
}) {
  const width = 320;
  const height = 88;
  const padding = 14;

  const validPoints = points
    .map((point, index) => ({ ...point, index }))
    .filter((point) => point.value != null) as Array<ChartPoint & { index: number; value: number }>;

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
