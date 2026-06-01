import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock,
  Heart,
  Home,
  LogOut,
  MessageSquarePlus,
  MoonStar,
  Pill,
  Search,
  Shield,
  Users,
} from "lucide-react";
import {
  formatDisplayName,
  medicationAdherenceLabels,
  observationTypeOptions,
  priorityOptions,
  sleepQualityLabels,
  type AuthUser,
  type DailyReportRecord,
  type EmotionLog,
  type ObservationPriority,
  type ObservationRecord,
  type ObservationType,
  type PatientSummary,
  type WeeklyScreeningRecord,
} from "@shared/contracts";
import { getWeeklyScreeningSignals } from "@shared/weeklyScreening";
import { useToast } from "../hooks/useToast";
import { apiRequest, getErrorMessage } from "../lib/api";
import { getSleepDurationHours } from "../lib/dailyReports";
import { buildPatientRiskSnapshot, type PatientRiskSnapshot, type RiskLevel } from "../lib/riskReview";

type SupportMobilePageProps = {
  user: AuthUser;
  onLogout: () => void;
};

type MobileTab = "today" | "patients" | "detail" | "note" | "alerts";
type MobileDetailSection = "overview" | "charts" | "timeline" | "reports" | "safety";

type NoteDraft = {
  patientId: string;
  observationType: ObservationType;
  priority: ObservationPriority;
  observation: string;
};

type MobileAlert = {
  id: string;
  patientId: string;
  title: string;
  detail: string;
  timestamp: string;
  tone: "critical" | "high";
};

type PatientMobileData = {
  logs: EmotionLog[];
  dailyReports: DailyReportRecord[];
  screenings: WeeklyScreeningRecord[];
  observations: ObservationRecord[];
  alerts: MobileAlert[];
};

const mobileTabs: Array<{
  id: Exclude<MobileTab, "detail">;
  label: string;
  icon: typeof Home;
}> = [
  { id: "today", label: "Today", icon: Home },
  { id: "patients", label: "Patients", icon: Users },
  { id: "note", label: "Add Note", icon: MessageSquarePlus },
  { id: "alerts", label: "Alerts", icon: Bell },
];

const mobileDetailSections: Array<{
  id: MobileDetailSection;
  label: string;
}> = [
  { id: "overview", label: "Overview" },
  { id: "charts", label: "Charts" },
  { id: "timeline", label: "Moods" },
  { id: "reports", label: "Reports" },
  { id: "safety", label: "Safety" },
];

const riskBadge: Record<RiskLevel, string> = {
  Low: "bg-emerald-100 text-emerald-800",
  Medium: "bg-amber-100 text-amber-900",
  High: "bg-orange-100 text-orange-900",
  Critical: "bg-rose-100 text-rose-900",
};

const priorityBadge: Record<ObservationPriority, string> = {
  Low: "bg-slate-100 text-slate-700",
  Medium: "bg-amber-100 text-amber-900",
  High: "bg-orange-100 text-orange-900",
  Critical: "bg-rose-100 text-rose-900",
  Urgent: "bg-fuchsia-100 text-fuchsia-900",
};

const noteTemplates = [
  "Quick check-in completed. Patient was engaged and able to talk.",
  "Medication concern discussed. Follow-up needed on missed dose details.",
  "Cravings increased today. Patient identified one support they can contact.",
  "Safety concern mentioned. Escalation pathway should be reviewed.",
];

export default function SupportMobilePage({
  user,
  onLogout,
}: SupportMobilePageProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const supportWorkerName = formatDisplayName(user);
  const [activeTab, setActiveTab] = useState<MobileTab>("today");
  const [detailSection, setDetailSection] = useState<MobileDetailSection>("overview");
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [logs, setLogs] = useState<EmotionLog[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReportRecord[]>([]);
  const [screenings, setScreenings] = useState<WeeklyScreeningRecord[]>([]);
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [draft, setDraft] = useState<NoteDraft>({
    patientId: "",
    observationType: "Clinical",
    priority: "Medium",
    observation: "",
  });
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadMobileWorkspace() {
      setIsLoading(true);

      try {
        const [
          nextPatients,
          nextLogs,
          nextDailyReports,
          nextScreenings,
          nextObservations,
        ] = await Promise.all([
          apiRequest<PatientSummary[]>("/api/patients"),
          apiRequest<EmotionLog[]>("/api/logs"),
          apiRequest<DailyReportRecord[]>("/api/daily-reports"),
          apiRequest<WeeklyScreeningRecord[]>("/api/weekly-screenings"),
          apiRequest<ObservationRecord[]>("/api/observations"),
        ]);

        if (!isMounted) {
          return;
        }

        setPatients(nextPatients);
        setLogs(nextLogs);
        setDailyReports(nextDailyReports);
        setScreenings(nextScreenings);
        setObservations(nextObservations);
      } catch (error) {
        if (isMounted) {
          toast({
            title: "Could not load support workspace",
            description: getErrorMessage(error),
            variant: "error",
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadMobileWorkspace();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const patientIds = useMemo(() => {
    return Array.from(
      new Set([
        ...patients.map((patient) => patient.username),
        ...logs.map((log) => log.patientId),
        ...dailyReports.map((report) => report.patientId),
        ...screenings.map((screening) => screening.patientId),
        ...observations.map((observation) => observation.patientId),
      ]),
    ).sort();
  }, [dailyReports, logs, observations, patients, screenings]);

  const patientNameById = useMemo(() => {
    return new Map(
      patients.map((patient) => [patient.username, formatDisplayName(patient)]),
    );
  }, [patients]);

  useEffect(() => {
    if (selectedPatientId || patientIds.length === 0) {
      return;
    }

    const firstPatientId = patientIds[0];
    setSelectedPatientId(firstPatientId);
    setDraft((current) => ({ ...current, patientId: firstPatientId }));
  }, [patientIds, selectedPatientId]);

  const riskSnapshots = useMemo(() => {
    return patientIds
      .map((patientId) =>
        buildPatientRiskSnapshot(
          patientId,
          logs.filter((log) => log.patientId === patientId),
          dailyReports.filter((report) => report.patientId === patientId),
          screenings.filter((screening) => screening.patientId === patientId),
          observations.filter((observation) => observation.patientId === patientId),
        ),
      )
      .sort((left, right) => {
        const riskDelta = riskRank(right.riskLevel) - riskRank(left.riskLevel);
        if (riskDelta !== 0) {
          return riskDelta;
        }

        return toTime(right.lastSeenAt) - toTime(left.lastSeenAt);
      });
  }, [dailyReports, logs, observations, patientIds, screenings]);

  const selectedRisk =
    riskSnapshots.find((snapshot) => snapshot.patientId === selectedPatientId) ??
    riskSnapshots[0] ??
    null;
  const selectedPatientName = selectedPatientId
    ? patientNameById.get(selectedPatientId) ?? selectedPatientId
    : "No patient selected";
  const filteredSnapshots = riskSnapshots.filter((snapshot) => {
    const patientName = patientNameById.get(snapshot.patientId) ?? snapshot.patientId;
    const haystack = `${patientName} ${snapshot.patientId}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });
  const criticalSnapshots = riskSnapshots.filter(
    (snapshot) => snapshot.riskLevel === "Critical",
  );
  const highSnapshots = riskSnapshots.filter((snapshot) => snapshot.riskLevel === "High");
  const alertList = buildMobileAlerts(riskSnapshots, observations, logs);
  const recentSnapshots = riskSnapshots.slice(0, 6);
  const selectedPatientData = buildPatientMobileData(
    selectedPatientId,
    logs,
    dailyReports,
    screenings,
    observations,
    alertList,
  );

  const selectPatient = (patientId: string, nextTab: MobileTab = activeTab) => {
    setSelectedPatientId(patientId);
    setDraft((current) => ({ ...current, patientId }));
    setActiveTab(nextTab);
    if (nextTab === "detail") {
      setDetailSection("overview");
    }
  };

  const handleNoteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draft.patientId || !draft.observation.trim()) {
      toast({
        title: "Add a patient and note first",
        description: "Choose a patient and write the note before saving.",
        variant: "error",
      });
      return;
    }

    setIsSubmittingNote(true);

    try {
      const createdObservation = await apiRequest<ObservationRecord>("/api/observations", {
        method: "POST",
        data: {
          ...draft,
          observation: draft.observation.trim(),
          supportWorkerName,
        },
      });

      setObservations((current) => [createdObservation, ...current]);
      setDraft((current) => ({
        ...current,
        observationType: "Clinical",
        observation: "",
        priority: "Medium",
      }));
      setSelectedPatientId(createdObservation.patientId);
      setActiveTab("detail");
      setDetailSection("safety");

      toast({
        title: "Observation saved",
        description: "The note is now visible in the patient record.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Could not save observation",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsSubmittingNote(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
              Support Workspace
            </p>
            <h1 className="text-lg font-semibold">Support workspace</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              onClick={() => navigate("/support/desktop")}
            >
              Desktop
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
              aria-label="Sign out"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {activeTab !== "detail" ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{selectedPatientName}</p>
              <p className="truncate text-xs text-slate-500">
                {selectedRisk
                  ? `${selectedRisk.riskLevel} priority · ${selectedRisk.lastSeenAt ? formatLastSeen(selectedRisk.lastSeenAt) : "No recent data"}`
                  : "Select a patient to start"}
              </p>
            </div>
            <button
              type="button"
              className="rounded-full bg-teal-600 px-3 py-2 text-xs font-semibold text-white"
              onClick={() => setActiveTab("note")}
            >
              Note
            </button>
          </div>
        </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-lg px-4 py-4">
        {isLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-8 text-center">
            <p className="text-sm font-semibold text-slate-700">Loading support workspace...</p>
          </div>
        ) : null}

        {!isLoading && activeTab === "today" ? (
          <TodayPanel
            criticalCount={criticalSnapshots.length}
            highCount={highSnapshots.length}
            alertList={alertList}
            snapshots={recentSnapshots}
            patientNameById={patientNameById}
            onSelectPatient={selectPatient}
            onTabChange={setActiveTab}
          />
        ) : null}

        {!isLoading && activeTab === "patients" ? (
          <PatientsPanel
            search={search}
            onSearch={setSearch}
            snapshots={filteredSnapshots}
            patientNameById={patientNameById}
            onSelectPatient={selectPatient}
          />
        ) : null}

        {!isLoading && activeTab === "detail" && selectedRisk ? (
          <PatientDetailPanel
            snapshot={selectedRisk}
            patientName={selectedPatientName}
            patientData={selectedPatientData}
            activeSection={detailSection}
            onSectionChange={setDetailSection}
            onBack={() => setActiveTab("patients")}
            onAddNote={() => setActiveTab("note")}
          />
        ) : null}

        {!isLoading && activeTab === "note" ? (
          <NotePanel
            draft={draft}
            patients={patientIds}
            patientNameById={patientNameById}
            supportWorkerName={supportWorkerName}
            isSubmitting={isSubmittingNote}
            onDraftChange={setDraft}
            onSubmit={handleNoteSubmit}
          />
        ) : null}

        {!isLoading && activeTab === "alerts" ? (
          <AlertsPanel
            alerts={alertList}
            patientNameById={patientNameById}
            onSelectPatient={selectPatient}
          />
        ) : null}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
          {mobileTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id || (activeTab === "detail" && tab.id === "patients");
            return (
              <button
                key={tab.id}
                type="button"
                className={`flex min-h-14 flex-col items-center justify-center rounded-2xl text-[11px] font-semibold ${
                  isActive
                    ? "bg-teal-600 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="mb-1 h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function TodayPanel({
  criticalCount,
  highCount,
  alertList,
  snapshots,
  patientNameById,
  onSelectPatient,
  onTabChange,
}: {
  criticalCount: number;
  highCount: number;
  alertList: MobileAlert[];
  snapshots: PatientRiskSnapshot[];
  patientNameById: Map<string, string>;
  onSelectPatient: (patientId: string, tab?: MobileTab) => void;
  onTabChange: (tab: MobileTab) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <CompactStat
          label="Critical"
          value={criticalCount}
          className="border-rose-200 bg-rose-50 text-rose-950"
        />
        <CompactStat
          label="High"
          value={highCount}
          className="border-orange-200 bg-orange-50 text-orange-950"
        />
      </div>

      <section className="rounded-3xl border border-rose-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">
              First look
            </p>
            <h2 className="mt-1 text-xl font-semibold">Needs action</h2>
          </div>
          <button
            type="button"
            className="rounded-full bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-900"
            onClick={() => onTabChange("alerts")}
          >
            View all
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {alertList.slice(0, 3).map((alert) => (
            <button
              key={alert.id}
              type="button"
              className="w-full rounded-2xl border border-rose-100 bg-rose-50 px-3 py-3 text-left"
              onClick={() => onSelectPatient(alert.patientId, "detail")}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-rose-950">
                    {patientNameById.get(alert.patientId) ?? alert.patientId}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-rose-900">{alert.title}</p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-rose-700" />
              </div>
            </button>
          ))}
          {alertList.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
              No critical alerts are active right now.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Quick notes
            </p>
            <h2 className="mt-1 text-xl font-semibold">Recent patients</h2>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold"
            onClick={() => onTabChange("patients")}
          >
            Search
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {snapshots.map((snapshot) => (
            <PatientQuickCard
              key={snapshot.patientId}
              snapshot={snapshot}
              patientName={patientNameById.get(snapshot.patientId) ?? snapshot.patientId}
              onSelectPatient={onSelectPatient}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function PatientsPanel({
  search,
  onSearch,
  snapshots,
  patientNameById,
  onSelectPatient,
}: {
  search: string;
  onSearch: (value: string) => void;
  snapshots: PatientRiskSnapshot[];
  patientNameById: Map<string, string>;
  onSelectPatient: (patientId: string, tab?: MobileTab) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          className="w-full bg-transparent text-sm outline-none"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search patient name or code"
        />
      </label>
      {snapshots.map((snapshot) => (
        <PatientQuickCard
          key={snapshot.patientId}
          snapshot={snapshot}
          patientName={patientNameById.get(snapshot.patientId) ?? snapshot.patientId}
          onSelectPatient={onSelectPatient}
        />
      ))}
      {snapshots.length === 0 ? (
        <p className="rounded-3xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600">
          No matching patients.
        </p>
      ) : null}
    </div>
  );
}

function PatientDetailPanel({
  snapshot,
  patientName,
  patientData,
  activeSection,
  onSectionChange,
  onBack,
  onAddNote,
}: {
  snapshot: PatientRiskSnapshot;
  patientName: string;
  patientData: PatientMobileData;
  activeSection: MobileDetailSection;
  onSectionChange: (section: MobileDetailSection) => void;
  onBack: () => void;
  onAddNote: () => void;
}) {
  const latestLog = patientData.logs[0] ?? null;
  const latestDailyReport = patientData.dailyReports[0] ?? null;
  const latestScreening = patientData.screenings[0] ?? null;
  const latestObservation = patientData.observations[0] ?? null;
  const screeningSignals = latestScreening ? getWeeklyScreeningSignals(latestScreening) : [];
  const moodPoints = buildMobileMoodPoints(patientData.logs);
  const stressPoints = buildMobileNumberPoints(patientData.logs, "stressLevel", "Stress");
  const cravingPoints = buildMobileNumberPoints(patientData.logs, "cravingLevel", "Cravings");
  const sleepPoints = buildMobileSleepPoints(patientData.logs, patientData.dailyReports);
  const mealPoints = buildMobileMealPoints(patientData.dailyReports);
  const medicationPoints = buildMobileMedicationPoints(patientData.logs);
  const substancePoints = buildMobileSubstancePoints(patientData.logs);

  return (
    <div className="space-y-3">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-700"
            aria-label="Back to patients"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-semibold">{patientName}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{snapshot.patientId}</p>
          </div>
          <span className={`badge ${riskBadge[snapshot.riskLevel]}`}>
            {snapshot.riskLevel}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-700">
          {snapshot.summary}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniMetric label="72h" value={`${snapshot.acute72hScore}`} detail="acute" />
          <MiniMetric label="7d" value={`${snapshot.trend7dScore}`} detail="trend" />
          <MiniMetric label="Confidence" value={snapshot.confidence} detail="data" />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white"
            onClick={onAddNote}
          >
            Add Note
          </button>
          <button
            type="button"
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
            onClick={() => onSectionChange("charts")}
          >
            View Charts
          </button>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {mobileDetailSections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${
              activeSection === section.id
                ? "bg-slate-950 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => onSectionChange(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === "overview" ? (
        <div className="space-y-3">
          <section className="rounded-3xl border border-rose-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-700" />
              <h2 className="text-base font-semibold">Why this priority</h2>
            </div>
            <div className="mt-3 space-y-2">
              {snapshot.reasons.slice(0, 5).map((reason) => (
                <p
                  key={reason}
                  className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm leading-5 text-rose-950"
                >
                  {reason}
                </p>
              ))}
              {snapshot.reasons.length === 0 ? (
                <CompactEmpty message="No priority reasons have been generated yet." />
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-600" />
              <h2 className="text-base font-semibold">Latest activity</h2>
            </div>
            <div className="mt-3 space-y-2">
              <DetailRow
                label="Last check-in"
                value={snapshot.lastSeenAt ? formatLastSeen(snapshot.lastSeenAt) : "No data"}
              />
              <DetailRow
                label="Latest mood"
                value={latestLog ? `${latestLog.emotion} · stress ${latestLog.stressLevel ?? "N/A"}/10` : "No mood log"}
              />
              <DetailRow
                label="Latest report"
                value={
                  latestDailyReport
                    ? `${latestDailyReport.reportType} · ${formatLastSeen(latestDailyReport.timestamp)}`
                    : "No daily report"
                }
              />
              <DetailRow
                label="Latest observation"
                value={
                  latestObservation
                    ? `${latestObservation.priority} · ${latestObservation.observationType}`
                    : "No support note"
                }
              />
            </div>
          </section>

          {patientData.alerts.length > 0 ? (
            <section className="rounded-3xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-800">
                Active alerts
              </p>
              <div className="mt-3 space-y-2">
                {patientData.alerts.slice(0, 3).map((alert) => (
                  <p key={alert.id} className="rounded-2xl bg-white px-3 py-3 text-sm leading-5 text-rose-950">
                    <span className="font-semibold">{alert.title}</span>
                    <br />
                    {alert.detail}
                  </p>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {activeSection === "charts" ? (
        <div className="grid gap-3">
          <MobileChartCard title="Mood" detail="1 angry, 4 happy" icon={<Heart className="h-4 w-4" />}>
            <MobileLineChart points={moodPoints} min={1} max={4} emptyMessage="No mood entries yet." />
          </MobileChartCard>
          <MobileChartCard title="Stress" detail="0 to 10 scale" icon={<Activity className="h-4 w-4" />}>
            <MobileLineChart points={stressPoints} min={0} max={10} emptyMessage="No stress data yet." />
          </MobileChartCard>
          <MobileChartCard title="Cravings" detail="0 to 10 scale" icon={<BarChart3 className="h-4 w-4" />}>
            <MobileLineChart points={cravingPoints} min={0} max={10} emptyMessage="No craving data yet." />
          </MobileChartCard>
          <MobileChartCard title="Sleep" detail="Hours or quality score" icon={<MoonStar className="h-4 w-4" />}>
            <MobileLineChart points={sleepPoints} min={0} max={12} valueSuffix="h" emptyMessage="No sleep data yet." />
          </MobileChartCard>
          <MobileChartCard title="Meals" detail="Night report meal count" icon={<ClipboardList className="h-4 w-4" />}>
            <MobileBarChart points={mealPoints} max={6} emptyMessage="No meal reports yet." />
          </MobileChartCard>
          <MobileChartCard title="Medication" detail="0 ok, 1 missed some, 2 missed all" icon={<Pill className="h-4 w-4" />}>
            <MobileBarChart points={medicationPoints} max={2} emptyMessage="No medication answers yet." />
          </MobileChartCard>
          <MobileChartCard title="Substance use" detail="Reported yes/no answers" icon={<Shield className="h-4 w-4" />}>
            <MobileBarChart points={substancePoints} max={1} emptyMessage="No substance-use answers yet." yesNo />
          </MobileChartCard>
        </div>
      ) : null}

      {activeSection === "timeline" ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-600" />
            <h2 className="text-base font-semibold">Mood timeline</h2>
          </div>
          <div className="mt-3 space-y-3">
            {patientData.logs.slice(0, 8).map((log) => (
              <MobileMoodCard key={log.id} log={log} />
            ))}
            {patientData.logs.length === 0 ? (
              <CompactEmpty message="No mood check-ins are recorded for this patient yet." />
            ) : null}
          </div>
        </section>
      ) : null}

      {activeSection === "reports" ? (
        <div className="space-y-3">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <MoonStar className="h-4 w-4 text-indigo-600" />
              <h2 className="text-base font-semibold">Morning and night reports</h2>
            </div>
            <div className="mt-3 space-y-3">
              {patientData.dailyReports.slice(0, 8).map((report) => (
                <MobileDailyReportCard key={report.id} report={report} />
              ))}
              {patientData.dailyReports.length === 0 ? (
                <CompactEmpty message="No morning or night reports are recorded yet." />
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-sky-600" />
              <h2 className="text-base font-semibold">Weekly screens</h2>
            </div>
            <div className="mt-3 space-y-3">
              {patientData.screenings.slice(0, 4).map((screening) => (
                <MobileWeeklyScreenCard key={screening.id} screening={screening} />
              ))}
              {patientData.screenings.length === 0 ? (
                <CompactEmpty message="No weekly screens are recorded yet." />
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {activeSection === "safety" ? (
        <div className="space-y-3">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-sky-700" />
              <h2 className="text-base font-semibold">Safety and follow-up</h2>
            </div>
            <div className="mt-3 space-y-2">
              <DetailRow label="Recommended action" value={snapshot.recommendedAction} />
              <DetailRow
                label="Last check-in gap"
                value={`${snapshot.lastCheckInGapDays} day${snapshot.lastCheckInGapDays === 1 ? "" : "s"}`}
              />
              <DetailRow
                label="Deterioration watch"
                value={snapshot.deteriorationWatch ? "Active" : "Not active"}
              />
              <DetailRow
                label="Safety screen signals"
                value={screeningSignals.length > 0 ? `${screeningSignals.length} signal(s)` : "None on latest screen"}
              />
            </div>
          </section>

          {snapshot.emergencyFollowUpEvents.length > 0 ? (
            <section className="rounded-3xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-800">
                Emergency follow-up events
              </p>
              <div className="mt-3 space-y-2">
                {snapshot.emergencyFollowUpEvents.map((event) => (
                  <p key={event.id} className="rounded-2xl bg-white px-3 py-3 text-sm leading-5 text-rose-950">
                    <span className="font-semibold">
                      {format(new Date(event.eventAt), "MMM d, h:mm a")}
                    </span>
                    <br />
                    {event.summary}
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Support observations
            </p>
            <div className="mt-3 space-y-3">
              {patientData.observations.slice(0, 6).map((observation) => (
                <MobileObservationCard key={observation.id} observation={observation} />
              ))}
              {patientData.observations.length === 0 ? (
                <CompactEmpty message="No support observations are recorded yet." />
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function NotePanel({
  draft,
  patients,
  patientNameById,
  supportWorkerName,
  isSubmitting,
  onDraftChange,
  onSubmit,
}: {
  draft: NoteDraft;
  patients: string[];
  patientNameById: Map<string, string>;
  supportWorkerName: string;
  isSubmitting: boolean;
  onDraftChange: (draft: NoteDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
          Fast note
        </p>
        <h2 className="mt-1 text-xl font-semibold">Write and move on</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Saving as {supportWorkerName}. Notes are added to the patient record.
        </p>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Patient
          </span>
          <select
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold"
            value={draft.patientId}
            onChange={(event) => onDraftChange({ ...draft, patientId: event.target.value })}
          >
            {patients.map((patientId) => (
              <option key={patientId} value={patientId}>
                {patientNameById.get(patientId) ?? patientId}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Type
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
              value={draft.observationType}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  observationType: event.target.value as ObservationType,
                })
              }
            >
              {observationTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Priority
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
              value={draft.priority}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  priority: event.target.value as ObservationPriority,
                })
              }
            >
              {priorityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {noteTemplates.map((template) => (
            <button
              key={template}
              type="button"
              className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
              onClick={() => onDraftChange({ ...draft, observation: template })}
            >
              {template.split(".")[0]}
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Note
          </span>
          <textarea
            className="mt-2 min-h-36 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-base leading-6 outline-none focus:border-teal-500"
            value={draft.observation}
            onChange={(event) => onDraftChange({ ...draft, observation: event.target.value })}
            placeholder="Type the quick note here..."
          />
        </label>

        <button
          type="submit"
          className="mt-4 w-full rounded-2xl bg-teal-600 px-4 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting || patients.length === 0}
        >
          {isSubmitting ? "Saving Note..." : "Save Note"}
        </button>
      </section>
    </form>
  );
}

function AlertsPanel({
  alerts,
  patientNameById,
  onSelectPatient,
}: {
  alerts: MobileAlert[];
  patientNameById: Map<string, string>;
  onSelectPatient: (patientId: string, tab?: MobileTab) => void;
}) {
  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <button
          key={alert.id}
          type="button"
          className={`w-full rounded-3xl border px-4 py-4 text-left shadow-sm ${
            alert.tone === "critical"
              ? "border-rose-200 bg-rose-50"
              : "border-orange-200 bg-orange-50"
          }`}
          onClick={() => onSelectPatient(alert.patientId, "detail")}
        >
          <div className="flex items-start gap-3">
            <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white">
              <AlertTriangle className="h-4 w-4 text-rose-700" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {patientNameById.get(alert.patientId) ?? alert.patientId}
              </p>
              <p className="mt-1 text-sm leading-6">{alert.title}</p>
              <p className="mt-1 text-xs text-slate-600">{alert.detail}</p>
            </div>
          </div>
        </button>
      ))}
      {alerts.length === 0 ? (
        <p className="rounded-3xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600">
          No alerts need action right now.
        </p>
      ) : null}
    </div>
  );
}

function PatientQuickCard({
  snapshot,
  patientName,
  onSelectPatient,
}: {
  snapshot: PatientRiskSnapshot;
  patientName: string;
  onSelectPatient: (patientId: string, tab?: MobileTab) => void;
}) {
  const topReason = snapshot.reasons[0] ?? snapshot.whatChanged[0] ?? "No major reason detected.";

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{patientName}</p>
          <p className="mt-1 text-xs text-slate-500">{snapshot.patientId}</p>
        </div>
        <span className={`badge ${riskBadge[snapshot.riskLevel]}`}>{snapshot.riskLevel}</span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-700">{topReason}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {snapshot.lastSeenAt ? formatLastSeen(snapshot.lastSeenAt) : "No recent data"}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-full bg-teal-600 px-3 py-2 text-xs font-semibold text-white"
            onClick={() => onSelectPatient(snapshot.patientId, "note")}
          >
            Note
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
            onClick={() => onSelectPatient(snapshot.patientId, "detail")}
          >
            Details
          </button>
        </div>
      </div>
    </article>
  );
}

function CompactStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={`rounded-3xl border px-4 py-4 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em]">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-base font-semibold text-slate-950">{value}</p>
      <p className="text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="max-w-[58%] text-right text-sm font-semibold leading-5 text-slate-900">
        {value}
      </p>
    </div>
  );
}

function CompactEmpty({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm leading-6 text-slate-600">
      {message}
    </p>
  );
}

function MobileChartCard({
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
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          {icon}
        </div>
      </div>
      {children}
    </section>
  );
}

function MobileMoodCard({ log }: { log: EmotionLog }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{log.emotion}</p>
          <p className="mt-1 text-xs text-slate-500">{formatEntryTime(log)}</p>
        </div>
        <span className={`badge ${log.crisisLevel === "critical" ? "bg-rose-100 text-rose-900" : "bg-slate-100 text-slate-700"}`}>
          Stress {log.stressLevel ?? "N/A"}/10
        </span>
      </div>
      {log.notes ? (
        <p className="mt-3 text-sm leading-6 text-slate-700">{log.notes}</p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <span className="rounded-xl bg-white px-2 py-2">
          Craving {log.cravingLevel ?? "N/A"}/10
        </span>
        <span className="rounded-xl bg-white px-2 py-2">
          Sleep {log.sleepHours ?? "N/A"}h
        </span>
        <span className="rounded-xl bg-white px-2 py-2">
          Substance {log.substanceUseToday ? log.substanceUsed ?? "Yes" : "No"}
        </span>
        <span className="rounded-xl bg-white px-2 py-2">
          Meds {log.medicationAdherence ? medicationAdherenceLabels[log.medicationAdherence] : "N/A"}
        </span>
      </div>
      {log.missedMedicationName ? (
        <p className="mt-2 rounded-xl bg-amber-50 px-2 py-2 text-xs font-semibold text-amber-900">
          Missed: {log.missedMedicationName}
        </p>
      ) : null}
      {log.observations.length > 0 ? (
        <p className="mt-2 text-xs font-semibold text-sky-700">
          {log.observations.length} linked support note{log.observations.length === 1 ? "" : "s"}
        </p>
      ) : null}
    </article>
  );
}

function MobileDailyReportCard({ report }: { report: DailyReportRecord }) {
  const duration = getSleepDurationHours(report.bedTime, report.wakeTime);

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold capitalize text-slate-950">
            {report.reportType} report
          </p>
          <p className="mt-1 text-xs text-slate-500">{formatLastSeen(report.timestamp)}</p>
        </div>
        <span className="badge bg-indigo-100 text-indigo-900">
          {duration != null ? `${duration.toFixed(1)}h` : report.sleepQuality ? sleepQualityLabels[report.sleepQuality] : "Report"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <span className="rounded-xl bg-white px-2 py-2">Bed {report.bedTime ?? "N/A"}</span>
        <span className="rounded-xl bg-white px-2 py-2">Wake {report.wakeTime ?? "N/A"}</span>
        <span className="rounded-xl bg-white px-2 py-2">
          Wake-ups {report.wakeUps ?? "N/A"}
        </span>
        <span className="rounded-xl bg-white px-2 py-2">
          Meals {report.mealsCount ?? "N/A"}
        </span>
      </div>
      {report.notes || report.mealsNote ? (
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {report.notes ?? report.mealsNote}
        </p>
      ) : null}
    </article>
  );
}

function MobileWeeklyScreenCard({ screening }: { screening: WeeklyScreeningRecord }) {
  const signals = getWeeklyScreeningSignals(screening);

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">Weekly safety screen</p>
          <p className="mt-1 text-xs text-slate-500">{formatLastSeen(screening.timestamp)}</p>
        </div>
        <span className={`badge ${signals.length > 0 ? "bg-rose-100 text-rose-900" : "bg-emerald-100 text-emerald-800"}`}>
          {signals.length} signal{signals.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {signals.slice(0, 5).map((signal) => (
          <span key={signal} className="badge bg-white text-slate-700">
            {signal}
          </span>
        ))}
        {signals.length === 0 ? (
          <span className="badge bg-white text-slate-700">No follow-up signals</span>
        ) : null}
      </div>
    </article>
  );
}

function MobileObservationCard({ observation }: { observation: ObservationRecord }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">
            {observation.observationType}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {formatLastSeen(observation.timestamp)} · {observation.supportWorkerName}
          </p>
        </div>
        <span className={`badge ${priorityBadge[observation.priority]}`}>
          {observation.priority}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">{observation.observation}</p>
      {observation.status === "acknowledged" ? (
        <p className="mt-2 text-xs font-semibold text-teal-700">
          Acknowledged{observation.acknowledgedByName ? ` by ${observation.acknowledgedByName}` : ""}
        </p>
      ) : null}
    </article>
  );
}

type MobileChartPoint = {
  id: string;
  date: Date;
  label: string;
  value: number;
  description?: string;
};

const mobileMoodScores: Record<EmotionLog["emotion"], number> = {
  Angry: 1,
  Sad: 2,
  Worried: 3,
  Happy: 4,
};

const mobileSleepQualityScores = {
  very_bad: 2,
  bad: 4,
  okay: 6,
  good: 8,
  very_good: 10,
} as const;

function MobileLineChart({
  points,
  min,
  max,
  emptyMessage,
  valueSuffix = "",
}: {
  points: MobileChartPoint[];
  min: number;
  max: number;
  emptyMessage: string;
  valueSuffix?: string;
}) {
  if (points.length === 0) {
    return <CompactEmpty message={emptyMessage} />;
  }

  const width = 300;
  const height = 110;
  const padding = 16;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const range = Math.max(1, max - min);
  const coordinates = points.map((point, index) => {
    const x = padding + (points.length === 1 ? usableWidth / 2 : (index / (points.length - 1)) * usableWidth);
    const y = padding + (1 - (Math.min(max, Math.max(min, point.value)) - min) / range) * usableHeight;
    return { ...point, x, y };
  });
  const path = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const latest = points[points.length - 1];

  return (
    <div className="mt-4">
      <svg
        className="h-28 w-full overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${latest.description ?? "Latest"} ${latest.value}${valueSuffix}`}
      >
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#e2e8f0" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" />
        <path d={path} fill="none" stroke="#0f9f94" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map((point) => (
          <circle key={point.id} cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#0f9f94" strokeWidth="3">
            <title>{`${point.label}: ${point.description ?? `${point.value}${valueSuffix}`}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>{points[0].label}</span>
        <span className="max-w-[52%] truncate font-semibold text-slate-700">
          {latest.description ?? `${latest.value}${valueSuffix}`}
        </span>
        <span>{latest.label}</span>
      </div>
    </div>
  );
}

function MobileBarChart({
  points,
  max,
  emptyMessage,
  yesNo = false,
}: {
  points: MobileChartPoint[];
  max: number;
  emptyMessage: string;
  yesNo?: boolean;
}) {
  if (points.length === 0) {
    return <CompactEmpty message={emptyMessage} />;
  }

  const latest = points[points.length - 1];

  return (
    <div className="mt-4">
      <div className="flex h-28 items-end gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
        {points.map((point) => {
          const height = Math.max(8, (Math.min(max, point.value) / Math.max(1, max)) * 82);
          return (
            <div key={point.id} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                className={`w-full rounded-t-lg ${point.value > 0 ? "bg-teal-500" : "bg-slate-300"}`}
                style={{ height }}
                title={`${point.label}: ${point.description ?? point.value}`}
              />
              <span className="max-w-full truncate text-[10px] text-slate-500">{point.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>{points[0].label}</span>
        <span className="max-w-[52%] truncate font-semibold text-slate-700">
          {yesNo ? (latest.value > 0 ? "Yes" : "No") : latest.description ?? latest.value}
        </span>
        <span>{latest.label}</span>
      </div>
    </div>
  );
}

function buildPatientMobileData(
  patientId: string,
  logs: EmotionLog[],
  dailyReports: DailyReportRecord[],
  screenings: WeeklyScreeningRecord[],
  observations: ObservationRecord[],
  alerts: MobileAlert[],
): PatientMobileData {
  return {
    logs: sortNewest(logs.filter((log) => log.patientId === patientId), (log) => log.occurredAt ?? log.timestamp),
    dailyReports: sortNewest(dailyReports.filter((report) => report.patientId === patientId), (report) => report.timestamp),
    screenings: sortNewest(screenings.filter((screening) => screening.patientId === patientId), (screening) => screening.timestamp),
    observations: sortNewest(observations.filter((observation) => observation.patientId === patientId), (observation) => observation.timestamp),
    alerts: sortNewest(alerts.filter((alert) => alert.patientId === patientId), (alert) => alert.timestamp),
  };
}

function buildMobileMoodPoints(logs: EmotionLog[]) {
  return recentMobilePoints(
    logs.map((log) => ({
      id: `mood-${log.id}`,
      date: entryDate(log),
      label: chartDate(entryDate(log)),
      value: mobileMoodScores[log.emotion],
      description: log.emotion,
    })),
  );
}

function buildMobileNumberPoints(
  logs: EmotionLog[],
  key: "stressLevel" | "cravingLevel",
  description: string,
) {
  return recentMobilePoints(
    logs
      .filter((log) => log[key] != null)
      .map((log) => ({
        id: `${key}-${log.id}`,
        date: entryDate(log),
        label: chartDate(entryDate(log)),
        value: Number(log[key]),
        description,
      })),
  );
}

function buildMobileSleepPoints(logs: EmotionLog[], reports: DailyReportRecord[]) {
  const logPoints = logs
    .filter((log) => log.sleepHours != null)
    .map((log) => ({
      id: `sleep-log-${log.id}`,
      date: entryDate(log),
      label: chartDate(entryDate(log)),
      value: Number(log.sleepHours),
      description: `${log.sleepHours}h check-in`,
    }));
  const reportPoints = reports.flatMap((report) => {
    const duration = getSleepDurationHours(report.bedTime, report.wakeTime);
    const qualityFallback = report.sleepQuality ? mobileSleepQualityScores[report.sleepQuality] : null;
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
        description: duration == null ? sleepQualityLabels[report.sleepQuality!] : `${duration.toFixed(1)}h report`,
      },
    ];
  });

  return recentMobilePoints([...logPoints, ...reportPoints]);
}

function buildMobileMealPoints(reports: DailyReportRecord[]) {
  return recentMobilePoints(
    reports
      .filter((report) => report.mealsCount != null)
      .map((report) => ({
        id: `meal-${report.id}`,
        date: new Date(report.timestamp),
        label: chartDate(new Date(report.timestamp)),
        value: Number(report.mealsCount),
        description: `${report.mealsCount} meal${report.mealsCount === 1 ? "" : "s"}`,
      })),
  );
}

function buildMobileMedicationPoints(logs: EmotionLog[]) {
  return recentMobilePoints(
    logs
      .filter((log) => log.medicationAdherence != null)
      .map((log) => {
        const value =
          log.medicationAdherence === "missed_all"
            ? 2
            : log.medicationAdherence === "missed_some"
              ? 1
              : 0;

        return {
          id: `medication-${log.id}`,
          date: entryDate(log),
          label: chartDate(entryDate(log)),
          value,
          description:
            value > 0 && log.missedMedicationName
              ? `Missed: ${log.missedMedicationName}`
              : medicationAdherenceLabels[log.medicationAdherence!],
        };
      }),
  );
}

function buildMobileSubstancePoints(logs: EmotionLog[]) {
  return recentMobilePoints(
    logs
      .filter((log) => log.substanceUseToday != null)
      .map((log) => ({
        id: `substance-${log.id}`,
        date: entryDate(log),
        label: chartDate(entryDate(log)),
        value: log.substanceUseToday ? 1 : 0,
        description: log.substanceUseToday
          ? log.substanceUsed
            ? `Used: ${log.substanceUsed}`
            : "Used: yes"
          : "No use reported",
      })),
  );
}

function recentMobilePoints(points: MobileChartPoint[], limit = 10) {
  return points
    .filter((point) => !Number.isNaN(point.date.getTime()))
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .slice(-limit);
}

function sortNewest<T>(items: T[], getTimestamp: (item: T) => string | null | undefined) {
  return [...items].sort((left, right) => toTime(getTimestamp(right) ?? null) - toTime(getTimestamp(left) ?? null));
}

function entryDate(log: EmotionLog) {
  return new Date(log.occurredAt ?? log.timestamp);
}

function formatEntryTime(log: EmotionLog) {
  return format(entryDate(log), "MMM d, h:mm a");
}

function chartDate(date: Date) {
  return Number.isNaN(date.getTime()) ? "Unknown" : format(date, "MMM d");
}

function buildMobileAlerts(
  snapshots: PatientRiskSnapshot[],
  observations: ObservationRecord[],
  logs: EmotionLog[],
): MobileAlert[] {
  const alerts: MobileAlert[] = [];

  for (const snapshot of snapshots) {
    if (snapshot.riskLevel === "Critical") {
      alerts.push({
        id: `risk-${snapshot.patientId}`,
        patientId: snapshot.patientId,
        title: "Critical risk needs review",
        detail: snapshot.reasons[0] ?? snapshot.summary,
        timestamp: snapshot.lastSeenAt ?? snapshot.calculatedAsOf,
        tone: "critical",
      });
    }

    for (const event of snapshot.emergencyFollowUpEvents.slice(0, 2)) {
      alerts.push({
        id: event.id,
        patientId: snapshot.patientId,
        title: "Emergency response follow-up",
        detail: `${format(new Date(event.eventAt), "MMM d 'at' h:mm a")} · ${event.source}`,
        timestamp: event.eventAt,
        tone: "critical",
      });
    }
  }

  for (const observation of observations) {
    if (observation.status === "acknowledged") {
      continue;
    }

    if (observation.priority === "Critical" || observation.priority === "Urgent") {
      alerts.push({
        id: `observation-${observation.id}`,
        patientId: observation.patientId,
        title: `${observation.priority} ${observation.observationType.toLowerCase()} note`,
        detail: observation.observation,
        timestamp: observation.timestamp,
        tone: "critical",
      });
    }
  }

  for (const log of logs) {
    if (log.crisisLevel === "critical") {
      alerts.push({
        id: `log-${log.id}`,
        patientId: log.patientId,
        title: "Critical mood check-in",
        detail: log.crisisSummary ?? `${log.emotion} mood · stress ${log.stressLevel}/10`,
        timestamp: log.timestamp,
        tone: "critical",
      });
    }
  }

  return alerts
    .sort((left, right) => toTime(right.timestamp) - toTime(left.timestamp))
    .slice(0, 20);
}

function riskRank(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case "Critical":
      return 4;
    case "High":
      return 3;
    case "Medium":
      return 2;
    case "Low":
      return 1;
  }
}

function formatLastSeen(timestamp: string) {
  return format(new Date(timestamp), "MMM d, h:mm a");
}

function toTime(timestamp: string | null) {
  return timestamp ? new Date(timestamp).getTime() : 0;
}
