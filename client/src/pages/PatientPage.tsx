import { useEffect, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { LogOut } from "lucide-react";
import {
  getDailyReportStatusText,
  getLatestDailyReportByType,
  hasDailyReportToday,
} from "../lib/dailyReports";
import BrandMark from "../components/BrandMark";
import MetricTile from "../components/MetricTile";
import SectionTabs from "../components/SectionTabs";
import PatientHistoryWorkspace from "../components/patient/PatientHistoryWorkspace";
import PatientMoodWorkspace from "../components/patient/PatientMoodWorkspace";
import PatientSleepWorkspace from "../components/patient/PatientSleepWorkspace";
import {
  getLatestWeeklyScreening,
  getWeeklyScreeningDisposition,
  getWeeklyScreeningDispositionLabel,
  getWeeklyScreeningStatusText,
  isWeeklyScreeningDue,
} from "@shared/weeklyScreening";
import {
  emotionOptions,
  formatDisplayName,
  medicationAdherenceLabels,
  medicationAdherenceOptions,
  missedMedicationReasonLabels,
  missedMedicationReasonOptions,
  type AuthUser,
  type ConsentRecord,
  type DailyReportRecord,
  type EmotionName,
  type EmotionRecord,
  type MedicationAdherence,
  type MissedMedicationReason,
  type SleepQuality,
  type WeeklyScreeningRecord,
} from "@shared/contracts";
import { useToast } from "../hooks/useToast";
import { apiRequest, getErrorMessage, isNetworkError } from "../lib/api";
import { captureCurrentLocation } from "../lib/location";
import {
  clearPatientDraft,
  enqueuePatientSyncItem,
  loadPatientDraft,
  loadPatientSubmissionReceipts,
  loadPatientSyncQueue,
  markPatientQueueRetry,
  removePatientSyncQueueItem,
  savePatientDraft,
  upsertPatientSubmissionReceipt,
  type PatientSubmissionReceipt,
} from "../lib/patientSync";
import PatientWeeklyScreenWorkspace, {
  type WeeklyScreeningFormState,
} from "../components/patient/PatientWeeklyScreenWorkspace";

const patientTabs = [
  {
    id: "mood",
    label: "Daily Check-In",
    description: "Record how you feel right now",
  },
  {
    id: "sleep",
    label: "Sleep Reports",
    description: "Morning and night tracking",
  },
  {
    id: "screening",
    label: "Weekly Screen",
    description: "Safety and symptom review",
  },
  {
    id: "history",
    label: "History",
    description: "See recent mood and sleep entries",
  },
] as const;

type PatientWorkspace = (typeof patientTabs)[number]["id"];

type PatientPageProps = {
  user: AuthUser;
  onLogout: () => void;
};

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

type ConsentFormState = {
  moodTracking: boolean;
  sleepReports: boolean;
  weeklyScreening: boolean;
  gpsTracking: boolean;
  acknowledgeStaffedHours: boolean;
  acknowledgeEmergencyLimits: boolean;
};

type PatientSafetyNotice = {
  title: string;
  detail: string;
  tone: "neutral" | "warning";
};

function createEmptyMorningReport(): MorningReportFormState {
  return {
    bedTime: "",
    wakeTime: "",
    sleepQuality: "",
    wakeUps: "",
    feltRested: "",
    notes: "",
  };
}

function createEmptyNightReport(): NightReportFormState {
  return {
    bedTime: "",
    mealsCount: "",
    mealsNote: "",
    notes: "",
  };
}

function createDefaultConsentForm(): ConsentFormState {
  return {
    moodTracking: true,
    sleepReports: true,
    weeklyScreening: true,
    gpsTracking: false,
    acknowledgeStaffedHours: false,
    acknowledgeEmergencyLimits: false,
  };
}

function createEmptyWeeklyScreening(): WeeklyScreeningFormState {
  return {
    wishedDead: false,
    familyBetterOffDead: false,
    thoughtsKillingSelf: false,
    thoughtsKillingSelfFrequency: "",
    everTriedToKillSelf: false,
    attemptTiming: "none",
    currentThoughts: "",
    depressedHardToFunction: false,
    depressedFrequency: "",
    anxiousOnEdge: false,
    anxiousFrequency: "",
    hopeless: false,
    couldNotEnjoyThings: false,
    keepingToSelf: false,
    moreIrritable: false,
    substanceUseMoreThanUsual: false,
    substanceUseFrequency: "",
    sleepTrouble: false,
    sleepTroubleFrequency: "",
    appetiteChange: false,
    appetiteChangeDirection: "",
    supportPerson: "",
    reasonsForLiving: "",
    copingPlan: "",
    needsHelpStayingSafe: "",
  };
}

function createWeeklyScreeningForm(
  screening: WeeklyScreeningRecord,
): WeeklyScreeningFormState {
  return {
    wishedDead: screening.wishedDead,
    familyBetterOffDead: screening.familyBetterOffDead,
    thoughtsKillingSelf: screening.thoughtsKillingSelf,
    thoughtsKillingSelfFrequency: screening.thoughtsKillingSelfFrequency ?? "",
    everTriedToKillSelf: screening.everTriedToKillSelf,
    attemptTiming: screening.attemptTiming,
    currentThoughts:
      screening.currentThoughts == null ? "" : screening.currentThoughts ? "yes" : "no",
    depressedHardToFunction: screening.depressedHardToFunction,
    depressedFrequency: screening.depressedFrequency ?? "",
    anxiousOnEdge: screening.anxiousOnEdge,
    anxiousFrequency: screening.anxiousFrequency ?? "",
    hopeless: screening.hopeless,
    couldNotEnjoyThings: screening.couldNotEnjoyThings,
    keepingToSelf: screening.keepingToSelf,
    moreIrritable: screening.moreIrritable,
    substanceUseMoreThanUsual: screening.substanceUseMoreThanUsual,
    substanceUseFrequency: screening.substanceUseFrequency ?? "",
    sleepTrouble: screening.sleepTrouble,
    sleepTroubleFrequency: screening.sleepTroubleFrequency ?? "",
    appetiteChange: screening.appetiteChange,
    appetiteChangeDirection: screening.appetiteChangeDirection ?? "",
    supportPerson: screening.supportPerson ?? "",
    reasonsForLiving: screening.reasonsForLiving ?? "",
    copingPlan: screening.copingPlan ?? "",
    needsHelpStayingSafe:
      screening.needsHelpStayingSafe == null
        ? ""
        : screening.needsHelpStayingSafe
          ? "yes"
          : "no",
  };
}

function hasMoodDraftData(input: {
  selectedEmotion: EmotionName | null;
  notes: string;
  missedMedicationName: string;
  missedMedicationReason: MissedMedicationReason | "";
  includeLocation: boolean;
  editingEmotionId: number | null;
  medicationAdherence: MedicationAdherence;
  sleepHours: number;
  stressLevel: number;
  cravingLevel: number;
  substanceUseToday: boolean;
  moneyChangedToday: boolean;
}) {
  return (
    input.editingEmotionId != null ||
    input.selectedEmotion != null ||
    input.notes.trim().length > 0 ||
    input.missedMedicationName.trim().length > 0 ||
    input.missedMedicationReason !== "" ||
    input.includeLocation ||
    input.medicationAdherence !== "not_prescribed" ||
    input.sleepHours !== 8 ||
    input.stressLevel !== 5 ||
    input.cravingLevel !== 0 ||
    input.substanceUseToday ||
    input.moneyChangedToday
  );
}

function hasMorningDraftData(report: MorningReportFormState, editingId: number | null) {
  return (
    editingId != null ||
    report.bedTime.length > 0 ||
    report.wakeTime.length > 0 ||
    report.sleepQuality !== "" ||
    report.wakeUps.length > 0 ||
    report.feltRested !== "" ||
    report.notes.trim().length > 0
  );
}

function hasNightDraftData(report: NightReportFormState, editingId: number | null) {
  return (
    editingId != null ||
    report.bedTime.length > 0 ||
    report.mealsCount.length > 0 ||
    report.mealsNote.trim().length > 0 ||
    report.notes.trim().length > 0
  );
}

function hasWeeklyDraftData(form: WeeklyScreeningFormState, editingId: number | null) {
  return (
    editingId != null ||
    form.wishedDead ||
    form.familyBetterOffDead ||
    form.thoughtsKillingSelf ||
    form.thoughtsKillingSelfFrequency !== "" ||
    form.everTriedToKillSelf ||
    form.attemptTiming !== "none" ||
    form.currentThoughts !== "" ||
    form.depressedHardToFunction ||
    form.depressedFrequency !== "" ||
    form.anxiousOnEdge ||
    form.anxiousFrequency !== "" ||
    form.hopeless ||
    form.couldNotEnjoyThings ||
    form.keepingToSelf ||
    form.moreIrritable ||
    form.substanceUseMoreThanUsual ||
    form.substanceUseFrequency !== "" ||
    form.sleepTrouble ||
    form.sleepTroubleFrequency !== "" ||
    form.appetiteChange ||
    form.appetiteChangeDirection !== "" ||
    form.supportPerson.trim().length > 0 ||
    form.reasonsForLiving.trim().length > 0 ||
    form.copingPlan.trim().length > 0 ||
    form.needsHelpStayingSafe !== ""
  );
}

function buildSafetyNotice(
  crisisLevel: "none" | "high" | "critical",
  queued: boolean,
  summary?: string | null,
): PatientSafetyNotice | null {
  if (queued) {
    return {
      title:
        crisisLevel === "none"
          ? "Saved on this phone"
          : "Saved on this phone, not yet sent to staff",
      detail:
        crisisLevel === "none"
          ? "This entry is queued and will retry when your connection returns."
          : `${summary ?? "Your entry includes safety-related language."} L.A.M.B is not 24/7 emergency monitoring. If you are in immediate danger, call emergency services or go to the nearest emergency department now.`,
      tone: crisisLevel === "none" ? "neutral" : "warning",
    };
  }

  if (crisisLevel === "none") {
    return null;
  }

  return {
    title: "Safety-related entry sent",
    detail: `${summary ?? "Your entry was sent to the care team."} This pilot is only monitored during set staffed hours. If you feel unsafe right now, contact emergency services or go to the nearest emergency department.`,
    tone: "warning",
  };
}

function getClientCrisisLevelHint(...values: Array<string | null | undefined>) {
  const normalizedText = values
    .filter((value): value is string => value != null && value.trim().length > 0)
    .join(" ")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ");

  if (normalizedText.length === 0) {
    return "none" as const;
  }

  if (
    /dont belong on this earth|do not belong on this earth|want to die|end my life|kill myself|cant keep myself safe|can t keep myself safe/.test(
      normalizedText,
    )
  ) {
    return "critical" as const;
  }

  if (
    /dont want to be here|do not want to be here|harm myself|worthless|better off without me|not be here anymore/.test(
      normalizedText,
    )
  ) {
    return "high" as const;
  }

  return "none" as const;
}

export default function PatientPage({ user, onLogout }: PatientPageProps) {
  const patientId = user.username;
  const [activeTab, setActiveTab] = useState<PatientWorkspace>("mood");
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionName | null>(null);
  const [notes, setNotes] = useState("");
  const [sleepHours, setSleepHours] = useState(8);
  const [stressLevel, setStressLevel] = useState(5);
  const [cravingLevel, setCravingLevel] = useState(0);
  const [substanceUseToday, setSubstanceUseToday] = useState(false);
  const [moneyChangedToday, setMoneyChangedToday] = useState(false);
  const [medicationAdherence, setMedicationAdherence] =
    useState<MedicationAdherence>("not_prescribed");
  const [missedMedicationName, setMissedMedicationName] = useState("");
  const [missedMedicationReason, setMissedMedicationReason] =
    useState<MissedMedicationReason | "">("");
  const [includeLocation, setIncludeLocation] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState<string | null>(null);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [consentForm, setConsentForm] = useState<ConsentFormState>(createDefaultConsentForm);
  const [entries, setEntries] = useState<EmotionRecord[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReportRecord[]>([]);
  const [screenings, setScreenings] = useState<WeeklyScreeningRecord[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [isLoadingDailyReports, setIsLoadingDailyReports] = useState(true);
  const [isLoadingScreenings, setIsLoadingScreenings] = useState(true);
  const [isLoadingConsent, setIsLoadingConsent] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [morningReport, setMorningReport] = useState<MorningReportFormState>(
    createEmptyMorningReport,
  );
  const [nightReport, setNightReport] = useState<NightReportFormState>(createEmptyNightReport);
  const [weeklyScreening, setWeeklyScreening] = useState<WeeklyScreeningFormState>(
    createEmptyWeeklyScreening,
  );
  const [editingEmotionId, setEditingEmotionId] = useState<number | null>(null);
  const [editingMorningReportId, setEditingMorningReportId] = useState<number | null>(null);
  const [editingNightReportId, setEditingNightReportId] = useState<number | null>(null);
  const [editingWeeklyScreeningId, setEditingWeeklyScreeningId] = useState<number | null>(null);
  const [isSavingMorningReport, setIsSavingMorningReport] = useState(false);
  const [isSavingNightReport, setIsSavingNightReport] = useState(false);
  const [isSavingWeeklyScreening, setIsSavingWeeklyScreening] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncReceipts, setSyncReceipts] = useState<PatientSubmissionReceipt[]>([]);
  const [patientSafetyNotice, setPatientSafetyNotice] = useState<PatientSafetyNotice | null>(
    null,
  );
  const { toast } = useToast();

  const loadPatientData = async () => {
    setIsLoadingEntries(true);
    setIsLoadingDailyReports(true);
    setIsLoadingScreenings(true);
    setIsLoadingConsent(true);

    try {
      const [nextEntries, nextReports, nextScreenings, nextConsent] = await Promise.all([
        apiRequest<EmotionRecord[]>(`/api/emotions/${encodeURIComponent(patientId)}`),
        apiRequest<DailyReportRecord[]>(
          `/api/daily-reports/${encodeURIComponent(patientId)}`,
        ),
        apiRequest<WeeklyScreeningRecord[]>(
          `/api/weekly-screenings/${encodeURIComponent(patientId)}`,
        ),
        apiRequest<ConsentRecord | null>("/api/consent/me"),
      ]);

      setEntries(nextEntries);
      setDailyReports(nextReports);
      setScreenings(nextScreenings);
      setConsent(nextConsent);
      setConsentForm(
        nextConsent
          ? {
              moodTracking: nextConsent.moodTracking,
              sleepReports: nextConsent.sleepReports,
              weeklyScreening: nextConsent.weeklyScreening,
              gpsTracking: nextConsent.gpsTracking,
              acknowledgeStaffedHours: nextConsent.acknowledgeStaffedHours,
              acknowledgeEmergencyLimits: nextConsent.acknowledgeEmergencyLimits,
            }
          : createDefaultConsentForm(),
      );
    } catch (error) {
      if (isNetworkError(error)) {
        setSyncError("You are offline. Saved drafts and queued items stay on this phone.");
        refreshSyncState();
      } else {
        toast({
          title: "Could not load your saved information",
          description: getErrorMessage(error),
          variant: "error",
        });
      }
    } finally {
      setIsLoadingEntries(false);
      setIsLoadingDailyReports(false);
      setIsLoadingScreenings(false);
      setIsLoadingConsent(false);
    }
  };

  const refreshSyncState = () => {
    setSyncReceipts(loadPatientSubmissionReceipts(patientId));
  };

  const processSyncQueue = async () => {
    if (isSyncingQueue || !isOnline) {
      return;
    }

    const queue = loadPatientSyncQueue(patientId);
    if (queue.length === 0) {
      refreshSyncState();
      return;
    }

    setIsSyncingQueue(true);

    try {
      let syncedAnyItem = false;

      for (const item of queue) {
        try {
          const response = await apiRequest<
            | EmotionRecord
            | DailyReportRecord
            | WeeklyScreeningRecord
          >(item.url, {
            method: item.method,
            data: item.data,
          });

          removePatientSyncQueueItem(patientId, item.id);
          upsertPatientSubmissionReceipt(patientId, {
            id: item.id,
            label: item.label,
            status: "synced",
            detail:
              response.crisisLevel === "none"
                ? "Sent to the care team."
                : "Sent to the care team with a safety follow-up warning.",
          });
          setLastSyncedAt(new Date().toISOString());
          setPatientSafetyNotice(
            buildSafetyNotice(response.crisisLevel, false, response.crisisSummary),
          );
          syncedAnyItem = true;
        } catch (error) {
          if (isNetworkError(error)) {
            markPatientQueueRetry(patientId, item.id, item.retryCount + 1);
            setSyncError("Connection lost while retrying saved entries.");
            break;
          }

          removePatientSyncQueueItem(patientId, item.id);
          upsertPatientSubmissionReceipt(patientId, {
            id: item.id,
            label: item.label,
            status: "failed",
            detail: getErrorMessage(error),
          });
          setSyncError(getErrorMessage(error));
        }
      }

      if (syncedAnyItem) {
        await loadPatientData();
      }
    } finally {
      setSyncReceipts(loadPatientSubmissionReceipts(patientId));
      setIsSyncingQueue(false);
    }
  };

  const submitPatientRequest = async <
    TResponse extends { crisisLevel: "none" | "high" | "critical"; crisisSummary: string | null },
  >(
    input: {
      label: string;
      url: string;
      method: "POST" | "PATCH";
      data: unknown;
      crisisLevelHint: "none" | "high" | "critical";
    },
  ) => {
    try {
      const response = await apiRequest<TResponse>(input.url, {
        method: input.method,
        data: input.data,
      });

      const receiptId = `${input.method}-${Date.now()}`;
      upsertPatientSubmissionReceipt(patientId, {
        id: receiptId,
        label: input.label,
        status: "synced",
        detail:
          response.crisisLevel === "none"
            ? "Sent to the care team."
            : "Sent to the care team with a safety follow-up warning.",
      });
      refreshSyncState();
      setLastSyncedAt(new Date().toISOString());
      setSyncError(null);
      setPatientSafetyNotice(
        buildSafetyNotice(response.crisisLevel, false, response.crisisSummary),
      );
      return {
        queued: false,
        response,
      };
    } catch (error) {
      if (!isNetworkError(error)) {
        throw error;
      }

      const queuedItem = enqueuePatientSyncItem(patientId, {
        label: input.label,
        url: input.url,
        method: input.method,
        data: input.data,
        crisisLevel: input.crisisLevelHint,
      });

      upsertPatientSubmissionReceipt(patientId, {
        id: queuedItem.id,
        label: input.label,
        status: "queued",
        detail:
          input.crisisLevelHint === "none"
            ? "Saved on this phone and waiting for connection."
            : "Saved on this phone, but it has not reached staff yet.",
      });
      setPatientSafetyNotice(buildSafetyNotice(input.crisisLevelHint, true));
      setSyncError("You are offline. This entry is stored on this phone and will retry.");
      refreshSyncState();

      return {
        queued: true,
        queueItemId: queuedItem.id,
      };
    }
  };

  useEffect(() => {
    void loadPatientData();
  }, [patientId]);

  useEffect(() => {
    refreshSyncState();

    const moodDraft = loadPatientDraft<{
      selectedEmotion: EmotionName | null;
      notes: string;
      sleepHours: number;
      stressLevel: number;
      cravingLevel: number;
      substanceUseToday: boolean;
      moneyChangedToday: boolean;
      medicationAdherence: MedicationAdherence;
      missedMedicationName: string;
      missedMedicationReason: MissedMedicationReason | "";
      includeLocation: boolean;
      editingEmotionId: number | null;
    }>(patientId, "mood");
    if (moodDraft?.value) {
      setSelectedEmotion(moodDraft.value.selectedEmotion);
      setNotes(moodDraft.value.notes);
      setSleepHours(moodDraft.value.sleepHours);
      setStressLevel(moodDraft.value.stressLevel);
      setCravingLevel(moodDraft.value.cravingLevel);
      setSubstanceUseToday(moodDraft.value.substanceUseToday);
      setMoneyChangedToday(moodDraft.value.moneyChangedToday);
      setMedicationAdherence(moodDraft.value.medicationAdherence);
      setMissedMedicationName(moodDraft.value.missedMedicationName);
      setMissedMedicationReason(moodDraft.value.missedMedicationReason);
      setIncludeLocation(moodDraft.value.includeLocation);
      setEditingEmotionId(moodDraft.value.editingEmotionId);
    }

    const morningDraft = loadPatientDraft<{
      report: MorningReportFormState;
      editingId: number | null;
    }>(patientId, "morning");
    if (morningDraft?.value) {
      setMorningReport(morningDraft.value.report);
      setEditingMorningReportId(morningDraft.value.editingId);
    }

    const nightDraft = loadPatientDraft<{
      report: NightReportFormState;
      editingId: number | null;
    }>(patientId, "night");
    if (nightDraft?.value) {
      setNightReport(nightDraft.value.report);
      setEditingNightReportId(nightDraft.value.editingId);
    }

    const weeklyDraft = loadPatientDraft<{
      form: WeeklyScreeningFormState;
      editingId: number | null;
    }>(patientId, "weekly");
    if (weeklyDraft?.value) {
      setWeeklyScreening(weeklyDraft.value.form);
      setEditingWeeklyScreeningId(weeklyDraft.value.editingId);
    }
  }, [patientId]);

  useEffect(() => {
    const handleOnlineStateChange = () => {
      setIsOnline(window.navigator.onLine);
    };

    window.addEventListener("online", handleOnlineStateChange);
    window.addEventListener("offline", handleOnlineStateChange);

    return () => {
      window.removeEventListener("online", handleOnlineStateChange);
      window.removeEventListener("offline", handleOnlineStateChange);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      void processSyncQueue();
    }
  }, [isOnline, patientId]);

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void processSyncQueue();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [isOnline, patientId, isSyncingQueue]);

  useEffect(() => {
    if (
      hasMoodDraftData({
        selectedEmotion,
        notes,
        missedMedicationName,
        missedMedicationReason,
        includeLocation,
        editingEmotionId,
        medicationAdherence,
        sleepHours,
        stressLevel,
        cravingLevel,
        substanceUseToday,
        moneyChangedToday,
      })
    ) {
      savePatientDraft(patientId, "mood", {
        selectedEmotion,
        notes,
        sleepHours,
        stressLevel,
        cravingLevel,
        substanceUseToday,
        moneyChangedToday,
        medicationAdherence,
        missedMedicationName,
        missedMedicationReason,
        includeLocation,
        editingEmotionId,
      });
      return;
    }

    clearPatientDraft(patientId, "mood");
  }, [
    patientId,
    selectedEmotion,
    notes,
    sleepHours,
    stressLevel,
    cravingLevel,
    substanceUseToday,
    moneyChangedToday,
    medicationAdherence,
    missedMedicationName,
    missedMedicationReason,
    includeLocation,
    editingEmotionId,
  ]);

  useEffect(() => {
    if (hasMorningDraftData(morningReport, editingMorningReportId)) {
      savePatientDraft(patientId, "morning", {
        report: morningReport,
        editingId: editingMorningReportId,
      });
      return;
    }

    clearPatientDraft(patientId, "morning");
  }, [patientId, morningReport, editingMorningReportId]);

  useEffect(() => {
    if (hasNightDraftData(nightReport, editingNightReportId)) {
      savePatientDraft(patientId, "night", {
        report: nightReport,
        editingId: editingNightReportId,
      });
      return;
    }

    clearPatientDraft(patientId, "night");
  }, [patientId, nightReport, editingNightReportId]);

  useEffect(() => {
    if (hasWeeklyDraftData(weeklyScreening, editingWeeklyScreeningId)) {
      savePatientDraft(patientId, "weekly", {
        form: weeklyScreening,
        editingId: editingWeeklyScreeningId,
      });
      return;
    }

    clearPatientDraft(patientId, "weekly");
  }, [patientId, weeklyScreening, editingWeeklyScreeningId]);

  useEffect(() => {
    if (!consent?.gpsTracking) {
      setIncludeLocation(false);
    }
  }, [consent?.gpsTracking]);

  const resetMoodForm = () => {
    setEditingEmotionId(null);
    setSelectedEmotion(null);
    setNotes("");
    setSleepHours(8);
    setStressLevel(5);
    setCravingLevel(0);
    setSubstanceUseToday(false);
    setMoneyChangedToday(false);
    setMedicationAdherence("not_prescribed");
    setMissedMedicationName("");
    setMissedMedicationReason("");
    setLocationFeedback(null);
  };

  const resetMorningReportForm = () => {
    setEditingMorningReportId(null);
    setMorningReport(createEmptyMorningReport());
  };

  const resetNightReportForm = () => {
    setEditingNightReportId(null);
    setNightReport(createEmptyNightReport());
  };

  const resetWeeklyScreeningForm = () => {
    setEditingWeeklyScreeningId(null);
    setWeeklyScreening(createEmptyWeeklyScreening());
  };

  const handleSubmit = async () => {
    if (!selectedEmotion) {
      return;
    }

    if (
      medicationAdherence === "missed_some" &&
      (missedMedicationName.trim().length === 0 || missedMedicationReason === "")
    ) {
      toast({
        title: "Add the missed medication details",
        description:
          "When you choose 'Missed some', please tell us which medication was missed and why.",
        variant: "info",
      });
      return;
    }

    setIsSaving(true);

    try {
      let locationPayload = {};
      let locationCaptureError: string | null = null;
      let locationCaptured = false;

      if (includeLocation) {
        setIsCapturingLocation(true);
        setLocationFeedback("Requesting your current location...");

        try {
          locationPayload = await captureCurrentLocation();
          locationCaptured = true;
          setLocationFeedback("Current location will be attached to this check-in.");
        } catch (error) {
          locationCaptureError = getErrorMessage(error);
          setLocationFeedback(`${locationCaptureError} This check-in will still be saved without GPS.`);
        } finally {
          setIsCapturingLocation(false);
        }
      } else {
        setLocationFeedback(null);
      }

      const method = editingEmotionId != null ? "PATCH" : "POST";
      const url =
        editingEmotionId != null ? `/api/emotions/${editingEmotionId}` : "/api/emotions";
      const payload = {
        ...(editingEmotionId == null ? { patientId } : {}),
        emotion: selectedEmotion,
        notes,
        sleepHours,
        stressLevel,
        cravingLevel,
        substanceUseToday,
        moneyChangedToday,
        medicationAdherence,
        missedMedicationName:
          medicationAdherence === "missed_some" ? missedMedicationName : null,
        missedMedicationReason:
          medicationAdherence === "missed_some" ? missedMedicationReason || null : null,
        ...locationPayload,
      };
      const submissionResult = await submitPatientRequest<EmotionRecord>({
        label: editingEmotionId != null ? "Daily check-in update" : "Daily check-in",
        url,
        method,
        data: payload,
        crisisLevelHint: getClientCrisisLevelHint(notes, missedMedicationName),
      });

      const wasEditing = editingEmotionId != null;

      resetMoodForm();
      clearPatientDraft(patientId, "mood");
      toast({
        title: submissionResult.queued
          ? "Check-in saved on this phone"
          : wasEditing
            ? "Check-in updated"
            : "Feeling saved",
        description: submissionResult.queued
          ? "Your check-in will retry automatically when the connection comes back."
          : locationCaptured
            ? wasEditing
              ? "Your updated check-in and location have been recorded."
              : "Your latest check-in and location have been recorded."
            : wasEditing
              ? "Your check-in changes have been saved."
              : "Your latest check-in has been recorded.",
        variant: "success",
      });

      if (includeLocation && !locationCaptured) {
        toast({
          title: "Saved without GPS",
          description:
            locationCaptureError ??
            "Location could not be captured, so the mood entry was saved without it.",
          variant: "info",
        });
      }

      if (!submissionResult.queued) {
        await loadPatientData();
      } else {
        refreshSyncState();
      }
      setActiveTab("history");
    } catch (error) {
      toast({
        title: "Could not save your check-in",
        description: getErrorMessage(error),
        variant: "error",
      });
      setLocationFeedback(null);
    } finally {
      setIsCapturingLocation(false);
      setIsSaving(false);
    }
  };

  const handleMorningReportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!morningReport.bedTime || !morningReport.wakeTime || !morningReport.sleepQuality) {
      toast({
        title: "Please finish the morning report",
        description: "Add sleep time, wake time, and how you slept before saving.",
        variant: "info",
      });
      return;
    }

    setIsSavingMorningReport(true);

    try {
      const wasEditing = editingMorningReportId != null;
      const submissionResult = await submitPatientRequest<DailyReportRecord>({
        label: wasEditing ? "Morning report update" : "Morning report",
        url: wasEditing ? `/api/daily-reports/${editingMorningReportId}` : "/api/daily-reports",
        method: wasEditing ? "PATCH" : "POST",
        data: {
          ...(wasEditing ? {} : { patientId }),
          reportType: "morning",
          bedTime: morningReport.bedTime,
          wakeTime: morningReport.wakeTime,
          sleepQuality: morningReport.sleepQuality,
          wakeUps:
            morningReport.wakeUps.trim().length > 0 ? Number(morningReport.wakeUps) : null,
          feltRested:
            morningReport.feltRested === ""
              ? null
              : morningReport.feltRested === "yes",
          mealsCount: null,
          mealsNote: null,
          notes: morningReport.notes,
        },
        crisisLevelHint: getClientCrisisLevelHint(morningReport.notes),
      });

      resetMorningReportForm();
      clearPatientDraft(patientId, "morning");
      toast({
        title: submissionResult.queued
          ? "Morning report saved on this phone"
          : wasEditing
            ? "Morning report updated"
            : "Morning report saved",
        description: submissionResult.queued
          ? "This report will retry automatically when your connection returns."
          : wasEditing
            ? "Your morning report changes have been saved."
            : "Your sleep check-in has been added.",
        variant: "success",
      });
      if (!submissionResult.queued) {
        await loadPatientData();
      } else {
        refreshSyncState();
      }
    } catch (error) {
      toast({
        title: "Could not save the morning report",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsSavingMorningReport(false);
    }
  };

  const handleNightReportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!nightReport.bedTime) {
      toast({
        title: "Please add your bedtime",
        description: "Enter the time you are going to sleep before saving the night report.",
        variant: "info",
      });
      return;
    }

    if (nightReport.mealsCount.trim().length === 0) {
      toast({
        title: "Please add your meals",
        description: "Enter how many meals you had today before saving the night report.",
        variant: "info",
      });
      return;
    }

    setIsSavingNightReport(true);

    try {
      const wasEditing = editingNightReportId != null;
      const submissionResult = await submitPatientRequest<DailyReportRecord>({
        label: wasEditing ? "Night report update" : "Night report",
        url: wasEditing ? `/api/daily-reports/${editingNightReportId}` : "/api/daily-reports",
        method: wasEditing ? "PATCH" : "POST",
        data: {
          ...(wasEditing ? {} : { patientId }),
          reportType: "night",
          bedTime: nightReport.bedTime,
          wakeTime: null,
          sleepQuality: null,
          wakeUps: null,
          feltRested: null,
          mealsCount: Number(nightReport.mealsCount),
          mealsNote: nightReport.mealsNote,
          notes: nightReport.notes,
        },
        crisisLevelHint: getClientCrisisLevelHint(nightReport.notes, nightReport.mealsNote),
      });

      resetNightReportForm();
      clearPatientDraft(patientId, "night");
      toast({
        title: submissionResult.queued
          ? "Night report saved on this phone"
          : wasEditing
            ? "Night report updated"
            : "Night report saved",
        description: submissionResult.queued
          ? "This report will retry automatically when your connection returns."
          : wasEditing
            ? "Your night report changes have been saved."
            : "Tonight's sleep plan has been added.",
        variant: "success",
      });
      if (!submissionResult.queued) {
        await loadPatientData();
      } else {
        refreshSyncState();
      }
    } catch (error) {
      toast({
        title: "Could not save the night report",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsSavingNightReport(false);
    }
  };

  const handleWeeklyScreeningSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingWeeklyScreening(true);

    try {
      const wasEditing = editingWeeklyScreeningId != null;
      const screeningPayload = {
        ...(wasEditing ? {} : { patientId }),
        wishedDead: weeklyScreening.wishedDead,
        familyBetterOffDead: weeklyScreening.familyBetterOffDead,
        thoughtsKillingSelf: weeklyScreening.thoughtsKillingSelf,
        thoughtsKillingSelfFrequency:
          weeklyScreening.thoughtsKillingSelfFrequency === ""
            ? null
            : weeklyScreening.thoughtsKillingSelfFrequency,
        everTriedToKillSelf: weeklyScreening.everTriedToKillSelf,
        attemptTiming: weeklyScreening.everTriedToKillSelf
          ? weeklyScreening.attemptTiming
          : "none",
        currentThoughts:
          weeklyScreening.currentThoughts === ""
            ? null
            : weeklyScreening.currentThoughts === "yes",
        depressedHardToFunction: weeklyScreening.depressedHardToFunction,
        depressedFrequency:
          weeklyScreening.depressedFrequency === ""
            ? null
            : weeklyScreening.depressedFrequency,
        anxiousOnEdge: weeklyScreening.anxiousOnEdge,
        anxiousFrequency:
          weeklyScreening.anxiousFrequency === ""
            ? null
            : weeklyScreening.anxiousFrequency,
        hopeless: weeklyScreening.hopeless,
        couldNotEnjoyThings: weeklyScreening.couldNotEnjoyThings,
        keepingToSelf: weeklyScreening.keepingToSelf,
        moreIrritable: weeklyScreening.moreIrritable,
        substanceUseMoreThanUsual: weeklyScreening.substanceUseMoreThanUsual,
        substanceUseFrequency:
          weeklyScreening.substanceUseFrequency === ""
            ? null
            : weeklyScreening.substanceUseFrequency,
        sleepTrouble: weeklyScreening.sleepTrouble,
        sleepTroubleFrequency:
          weeklyScreening.sleepTroubleFrequency === ""
            ? null
            : weeklyScreening.sleepTroubleFrequency,
        appetiteChange: weeklyScreening.appetiteChange,
        appetiteChangeDirection:
          weeklyScreening.appetiteChangeDirection === ""
            ? null
            : weeklyScreening.appetiteChangeDirection,
        supportPerson: weeklyScreening.supportPerson,
        reasonsForLiving: weeklyScreening.reasonsForLiving,
        copingPlan: weeklyScreening.copingPlan,
        needsHelpStayingSafe:
          weeklyScreening.needsHelpStayingSafe === ""
            ? null
            : weeklyScreening.needsHelpStayingSafe === "yes",
      };
      const submissionResult = await submitPatientRequest<WeeklyScreeningRecord>({
        label: wasEditing ? "Weekly screen update" : "Weekly screen",
        url:
          wasEditing
            ? `/api/weekly-screenings/${editingWeeklyScreeningId}`
            : "/api/weekly-screenings",
        method: wasEditing ? "PATCH" : "POST",
        data: screeningPayload,
        crisisLevelHint:
          weeklyScreening.currentThoughts === "yes"
            ? "critical"
            : getClientCrisisLevelHint(
                weeklyScreening.reasonsForLiving,
                weeklyScreening.copingPlan,
              ),
      });

      const savedScreening =
        submissionResult.queued && latestScreening
          ? latestScreening
          : submissionResult.response ?? latestScreening;

      const disposition = savedScreening
        ? getWeeklyScreeningDisposition(savedScreening)
        : "positive";

      resetWeeklyScreeningForm();
      clearPatientDraft(patientId, "weekly");
      toast({
        title: submissionResult.queued
          ? "Weekly screen saved on this phone"
          : disposition === "urgent"
            ? wasEditing
              ? "Weekly screen updated and needs urgent follow-up"
              : "Weekly screen saved and needs urgent follow-up"
            : wasEditing
              ? "Weekly screen updated"
              : "Weekly screen saved",
        description: submissionResult.queued
          ? "This weekly screen will retry automatically when your connection returns."
          : savedScreening
            ? getWeeklyScreeningDispositionLabel(disposition)
            : "Your weekly screen was saved.",
        variant: disposition === "negative" ? "success" : "info",
      });

      if (!submissionResult.queued) {
        await loadPatientData();
      } else {
        refreshSyncState();
      }
    } catch (error) {
      toast({
        title: "Could not save the weekly screen",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsSavingWeeklyScreening(false);
    }
  };

  const handleConsentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !consentForm.moodTracking ||
      !consentForm.sleepReports ||
      !consentForm.weeklyScreening ||
      !consentForm.acknowledgeStaffedHours ||
      !consentForm.acknowledgeEmergencyLimits
    ) {
      toast({
        title: "Core consent is required",
        description:
          "Before you can use the patient workspace, please accept the core tracking consent and acknowledge the pilot's staffed-hours and emergency limits.",
        variant: "info",
      });
      return;
    }

    setIsSavingConsent(true);

    try {
      const savedConsent = await apiRequest<ConsentRecord>("/api/consent/me", {
        method: "PUT",
        data: consentForm,
      });
      setConsent(savedConsent);
      toast({
        title: "Consent saved",
        description:
          "Your privacy choices and pilot-safety acknowledgements have been recorded. GPS remains optional and can stay off if you prefer.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Could not save your consent choices",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsSavingConsent(false);
    }
  };

  const handleEditEntry = (entry: EmotionRecord) => {
    setEditingEmotionId(entry.id);
    setSelectedEmotion(entry.emotion);
    setNotes(entry.notes ?? "");
    setSleepHours(entry.sleepHours ?? 8);
    setStressLevel(entry.stressLevel ?? 5);
    setCravingLevel(entry.cravingLevel ?? 0);
    setSubstanceUseToday(entry.substanceUseToday ?? false);
    setMoneyChangedToday(entry.moneyChangedToday ?? false);
    setMedicationAdherence(entry.medicationAdherence ?? "not_prescribed");
    setMissedMedicationName(entry.missedMedicationName ?? "");
    setMissedMedicationReason(entry.missedMedicationReason ?? "");
    setIncludeLocation(Boolean(entry.latitude != null && entry.longitude != null));
    setLocationFeedback(
      entry.latitude != null && entry.longitude != null
        ? "This saved check-in already includes GPS. Saving again will refresh it if GPS is still enabled."
        : null,
    );
    setActiveTab("mood");
  };

  const handleEditDailyReport = (report: DailyReportRecord) => {
    if (report.reportType === "morning") {
      setEditingMorningReportId(report.id);
      setMorningReport({
        bedTime: report.bedTime ?? "",
        wakeTime: report.wakeTime ?? "",
        sleepQuality: report.sleepQuality ?? "",
        wakeUps: report.wakeUps == null ? "" : String(report.wakeUps),
        feltRested:
          report.feltRested == null ? "" : report.feltRested ? "yes" : "no",
        notes: report.notes ?? "",
      });
      setEditingNightReportId(null);
      setActiveTab("sleep");
      return;
    }

    setEditingNightReportId(report.id);
    setNightReport({
      bedTime: report.bedTime ?? "",
      mealsCount: report.mealsCount == null ? "" : String(report.mealsCount),
      mealsNote: report.mealsNote ?? "",
      notes: report.notes ?? "",
    });
    setEditingMorningReportId(null);
    setActiveTab("sleep");
  };

  const handleEditScreening = (screening: WeeklyScreeningRecord) => {
    setEditingWeeklyScreeningId(screening.id);
    setWeeklyScreening(createWeeklyScreeningForm(screening));
    setActiveTab("screening");
  };

  const latestEntry = entries[0];
  const latestMorningReport = getLatestDailyReportByType(dailyReports, "morning");
  const latestNightReport = getLatestDailyReportByType(dailyReports, "night");
  const latestScreening = getLatestWeeklyScreening(screenings);
  const morningSavedToday = hasDailyReportToday(dailyReports, "morning");
  const nightSavedToday = hasDailyReportToday(dailyReports, "night");
  const screeningDue = isWeeklyScreeningDue(screenings);
  const currentHour = new Date().getHours();
  const morningDueNow = !morningSavedToday && currentHour >= 8;
  const nightDueNow = !nightSavedToday && currentHour >= 18;
  const latestScreeningLabel = latestScreening
    ? getWeeklyScreeningDispositionLabel(getWeeklyScreeningDisposition(latestScreening))
    : "Not started";
  const hasRequiredConsent = Boolean(
    consent?.moodTracking &&
      consent?.sleepReports &&
      consent?.weeklyScreening &&
      consent?.acknowledgeStaffedHours &&
      consent?.acknowledgeEmergencyLimits,
  );
  const pendingSyncCount = loadPatientSyncQueue(patientId).length;
  const nextStepLabel = screeningDue
    ? "Weekly screen"
    : morningDueNow
      ? "Morning report"
      : nightDueNow
        ? "Night report"
        : selectedEmotion
          ? "Finish mood check-in"
          : "All set";
  const nextStepDetail = screeningDue
    ? getWeeklyScreeningStatusText(screenings)
    : morningDueNow
      ? "Save today's sleep details."
      : nightDueNow
      ? "Add your bedtime plan for tonight."
      : selectedEmotion
        ? `You're partway through a ${selectedEmotion.toLowerCase()} mood entry.`
        : "You can check in again whenever something changes.";

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-container flex items-center justify-between gap-4 py-4">
          <BrandMark
            variant="compact"
            showTagline={false}
            context="Patient Workspace"
            subtitle={`Welcome, ${formatDisplayName(user)}`}
          />

          <button type="button" className="btn btn-secondary" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </header>

      <main className="app-container py-6 md:py-8">
        {isLoadingConsent ? (
          <section className="panel mx-auto max-w-3xl p-8 md:p-10">
            <p className="mini-heading">Preparing your workspace</p>
            <h2 className="hero-title mt-4">Checking your privacy settings...</h2>
            <p className="hero-text mt-4">
              L.A.M.B is loading your consent record before showing the patient tools.
            </p>
          </section>
        ) : !hasRequiredConsent ? (
          <PatientConsentGate
            consentForm={consentForm}
            isSavingConsent={isSavingConsent}
            onChange={setConsentForm}
            onSubmit={handleConsentSubmit}
          />
        ) : (
          <>
            <section className="hero-panel">
              <div className="hero-grid">
                <div className="hero-copy">
                  <p className="eyebrow">Daily Care Tracking</p>
                  <h2 className="hero-title text-balance">
                    One calm place to check in, track sleep, complete weekly screens, and keep your care team updated.
                  </h2>
                  <p className="hero-text">
                    This layout is built to feel simpler on phones and clearer on larger screens. Pick the task you want to work on, then focus on one section at a time.
                  </p>
                </div>

                <div className="metric-grid">
                  <MetricTile
                    label="Mood entries"
                    value={entries.length}
                    detail={
                      latestEntry
                        ? `Last mood: ${latestEntry.emotion} on ${format(new Date(latestEntry.timestamp), "MMM d")}`
                        : "No mood check-ins yet."
                    }
                    tone="coral"
                  />
                  <MetricTile
                    label="Sleep reports"
                    value={dailyReports.length}
                    detail={getDailyReportStatusText(dailyReports, "morning")}
                    tone="sky"
                  />
                  <MetricTile
                    label="Weekly screen"
                    value={screeningDue ? "Due" : "Current"}
                    detail={
                      latestScreening
                        ? latestScreeningLabel
                        : "Your first weekly screen helps staff track changes week to week."
                    }
                    tone="mint"
                  />
                  <MetricTile
                    label="Next step"
                    value={nextStepLabel}
                    detail={nextStepDetail}
                    tone="gold"
                  />
                </div>
              </div>

              <SectionTabs
                tabs={patientTabs.map((tab) => ({
                  ...tab,
                  badge:
                    tab.id === "screening"
                      ? screeningDue
                        ? "Due"
                        : screenings.length > 0
                          ? screenings.length
                          : undefined
                      : tab.id === "history"
                        ? entries.length + dailyReports.length + screenings.length
                        : undefined,
                }))}
                value={activeTab}
                onChange={(nextValue) => setActiveTab(nextValue as PatientWorkspace)}
              />

              <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="mini-heading">Sync Status</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">
                        {isOnline ? "Connected" : "Offline"}
                      </h3>
                    </div>
                    <span
                      className={`badge ${
                        isOnline ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {pendingSyncCount > 0 ? `${pendingSyncCount} waiting` : "Up to date"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {syncError
                      ? syncError
                      : pendingSyncCount > 0
                        ? "Recent entries are saved on this phone and will retry automatically."
                        : lastSyncedAt
                          ? `Last sync ${format(new Date(lastSyncedAt), "MMM d, yyyy 'at' h:mm a")}.`
                          : "New entries send right away when your connection is available."}
                  </p>

                  <div className="mt-4 space-y-2">
                    {syncReceipts.length > 0 ? (
                      syncReceipts.slice(0, 3).map((receipt) => (
                        <div
                          key={receipt.id}
                          className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">{receipt.label}</p>
                            <span
                              className={`badge ${
                                receipt.status === "synced"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : receipt.status === "queued"
                                    ? "bg-amber-100 text-amber-900"
                                    : receipt.status === "failed"
                                      ? "bg-rose-100 text-rose-900"
                                      : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {receipt.status}
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-600">{receipt.detail}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                        Recent submission receipts will appear here after you save an entry.
                      </div>
                    )}
                  </div>
                </section>

                <section
                  className={`rounded-[28px] border px-5 py-5 shadow-sm ${
                    patientSafetyNotice?.tone === "warning"
                      ? "border-amber-200 bg-amber-50"
                      : "border-sky-200 bg-sky-50"
                  }`}
                >
                  <p
                    className={`mini-heading ${
                      patientSafetyNotice?.tone === "warning"
                        ? "text-amber-800"
                        : "text-sky-700"
                    }`}
                  >
                    Pilot Boundaries
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {patientSafetyNotice?.title ?? "This pilot is not 24/7 monitored."}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {patientSafetyNotice?.detail ??
                      "Entries help your care team see changes between visits, but urgent danger still needs direct emergency help. Use this tool during the pilot's staffed workflow, not as an emergency-response service."}
                  </p>
                </section>
              </div>
            </section>

            <div className="content-stack">
              {activeTab === "mood" ? (
                <PatientMoodWorkspace
                  emotionOptions={emotionOptions}
                  selectedEmotion={selectedEmotion}
                  notes={notes}
                  sleepHours={sleepHours}
                  stressLevel={stressLevel}
                  cravingLevel={cravingLevel}
                  substanceUseToday={substanceUseToday}
                  moneyChangedToday={moneyChangedToday}
                  medicationAdherence={medicationAdherence}
                  medicationAdherenceOptions={medicationAdherenceOptions}
                  medicationAdherenceLabels={medicationAdherenceLabels}
                  missedMedicationName={missedMedicationName}
                  missedMedicationReason={missedMedicationReason}
                  missedMedicationReasonOptions={missedMedicationReasonOptions}
                  missedMedicationReasonLabels={missedMedicationReasonLabels}
                  includeLocation={includeLocation}
                  gpsConsentEnabled={Boolean(consent?.gpsTracking)}
                  locationFeedback={locationFeedback}
                  isSaving={isSaving}
                  isCapturingLocation={isCapturingLocation}
                  editingEntryId={editingEmotionId}
                  recentEntries={entries.slice(0, 6)}
                  isLoadingEntries={isLoadingEntries}
                  morningSavedToday={morningSavedToday}
                  morningDueNow={morningDueNow}
                  nightSavedToday={nightSavedToday}
                  nightDueNow={nightDueNow}
                  dailyReports={dailyReports}
                  onPickEmotion={setSelectedEmotion}
                  onNotesChange={setNotes}
                  onSleepHoursChange={setSleepHours}
                  onStressLevelChange={setStressLevel}
                  onCravingLevelChange={setCravingLevel}
                  onSubstanceUseTodayChange={setSubstanceUseToday}
                  onMoneyChangedTodayChange={setMoneyChangedToday}
                  onMedicationAdherenceChange={setMedicationAdherence}
                  onMissedMedicationNameChange={setMissedMedicationName}
                  onMissedMedicationReasonChange={setMissedMedicationReason}
                  onIncludeLocationChange={setIncludeLocation}
                  onSubmit={handleSubmit}
                  onReset={resetMoodForm}
                />
              ) : null}

              {activeTab === "sleep" ? (
                <PatientSleepWorkspace
                  dailyReports={dailyReports}
                  recentDailyReports={dailyReports.slice(0, 6)}
                  isLoadingDailyReports={isLoadingDailyReports}
                  morningSavedToday={morningSavedToday}
                  nightSavedToday={nightSavedToday}
                  morningDueNow={morningDueNow}
                  nightDueNow={nightDueNow}
                  latestMorningReport={latestMorningReport}
                  latestNightReport={latestNightReport}
                  morningReport={morningReport}
                  nightReport={nightReport}
                  isSavingMorningReport={isSavingMorningReport}
                  isSavingNightReport={isSavingNightReport}
                  editingMorningReportId={editingMorningReportId}
                  editingNightReportId={editingNightReportId}
                  onMorningReportChange={setMorningReport}
                  onNightReportChange={setNightReport}
                  onMorningReportSubmit={handleMorningReportSubmit}
                  onNightReportSubmit={handleNightReportSubmit}
                  onCancelMorningEdit={resetMorningReportForm}
                  onCancelNightEdit={resetNightReportForm}
                />
              ) : null}

              {activeTab === "screening" ? (
                <PatientWeeklyScreenWorkspace
                  screenings={screenings}
                  latestScreening={latestScreening}
                  screeningDue={screeningDue}
                  form={weeklyScreening}
                  isSaving={isSavingWeeklyScreening}
                  isLoading={isLoadingScreenings}
                  editingScreeningId={editingWeeklyScreeningId}
                  onChange={setWeeklyScreening}
                  onSubmit={handleWeeklyScreeningSubmit}
                  onCancelEdit={resetWeeklyScreeningForm}
                />
              ) : null}

              {activeTab === "history" ? (
                <PatientHistoryWorkspace
                  entries={entries.slice(0, 8)}
                  dailyReports={dailyReports.slice(0, 8)}
                  screenings={screenings.slice(0, 8)}
                  isLoadingEntries={isLoadingEntries}
                  isLoadingDailyReports={isLoadingDailyReports}
                  isLoadingScreenings={isLoadingScreenings}
                  onEditEntry={handleEditEntry}
                  onEditDailyReport={handleEditDailyReport}
                  onEditScreening={handleEditScreening}
                />
              ) : null}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function PatientConsentGate({
  consentForm,
  isSavingConsent,
  onChange,
  onSubmit,
}: {
  consentForm: ConsentFormState;
  isSavingConsent: boolean;
  onChange: (nextValue: ConsentFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="panel mx-auto max-w-4xl p-8 md:p-10">
      <p className="mini-heading">Privacy And Consent</p>
      <h2 className="hero-title mt-4">Review your privacy choices before using L.A.M.B.</h2>
      <p className="hero-text mt-4">
        This pilot tracks mood, sleep, and weekly safety screens to help your care team see
        what happens between visits. GPS is optional and stays off unless you say yes. L.A.M.B
        is not 24/7 emergency monitoring.
      </p>

      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <ConsentCheckbox
          title="Mood tracking"
          description="Allows you to save mood check-ins and notes for your care team."
          checked={consentForm.moodTracking}
          onChange={(checked) => onChange({ ...consentForm, moodTracking: checked })}
        />
        <ConsentCheckbox
          title="Sleep reports"
          description="Allows you to save morning and night sleep reports."
          checked={consentForm.sleepReports}
          onChange={(checked) => onChange({ ...consentForm, sleepReports: checked })}
        />
        <ConsentCheckbox
          title="Weekly safety screens"
          description="Allows you to complete the weekly screening questions used for follow-up."
          checked={consentForm.weeklyScreening}
          onChange={(checked) => onChange({ ...consentForm, weeklyScreening: checked })}
        />
        <ConsentCheckbox
          title="Optional GPS snapshots"
          description="Allows one-time location capture only when you choose to attach it to a mood entry."
          checked={consentForm.gpsTracking}
          onChange={(checked) => onChange({ ...consentForm, gpsTracking: checked })}
        />
        <ConsentCheckbox
          title="I understand the staffed-hours limit"
          description="I understand this pilot is reviewed during staffed workflows and may not be watched immediately after every submission."
          checked={consentForm.acknowledgeStaffedHours}
          onChange={(checked) =>
            onChange({ ...consentForm, acknowledgeStaffedHours: checked })
          }
        />
        <ConsentCheckbox
          title="I understand this is not emergency care"
          description="If I am in immediate danger or need urgent help, I will contact emergency services or go to the nearest emergency department instead of waiting on the app."
          checked={consentForm.acknowledgeEmergencyLimits}
          onChange={(checked) =>
            onChange({ ...consentForm, acknowledgeEmergencyLimits: checked })
          }
        />

        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
          Mood tracking, sleep reports, weekly safety screens, and the two pilot-safety
          acknowledgements must be accepted before you can use this workspace. GPS stays optional.
        </div>

        <button type="submit" className="btn btn-primary" disabled={isSavingConsent}>
          {isSavingConsent ? "Saving your choices..." : "Save Consent And Continue"}
        </button>
      </form>
    </section>
  );
}

function ConsentCheckbox({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block font-semibold text-slate-900">{title}</span>
        <span className="mt-1 block leading-6 text-slate-500">{description}</span>
      </span>
    </label>
  );
}
