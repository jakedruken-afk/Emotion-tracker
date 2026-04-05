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
  type AuthUser,
  type ConsentRecord,
  type DailyReportRecord,
  type EmotionName,
  type EmotionRecord,
  type MedicationAdherence,
  type SleepQuality,
  type WeeklyScreeningRecord,
} from "@shared/contracts";
import { useToast } from "../hooks/useToast";
import { apiRequest, getErrorMessage } from "../lib/api";
import { captureCurrentLocation } from "../lib/location";
import PatientWeeklyScreenWorkspace, {
  type WeeklyScreeningFormState,
} from "../components/patient/PatientWeeklyScreenWorkspace";

const patientTabs = [
  {
    id: "mood",
    label: "Mood Check-In",
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
  notes: string;
};

type ConsentFormState = {
  moodTracking: boolean;
  sleepReports: boolean;
  weeklyScreening: boolean;
  gpsTracking: boolean;
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
    notes: "",
  };
}

function createDefaultConsentForm(): ConsentFormState {
  return {
    moodTracking: true,
    sleepReports: true,
    weeklyScreening: true,
    gpsTracking: false,
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
  const [isSavingMorningReport, setIsSavingMorningReport] = useState(false);
  const [isSavingNightReport, setIsSavingNightReport] = useState(false);
  const [isSavingWeeklyScreening, setIsSavingWeeklyScreening] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);
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
            }
          : createDefaultConsentForm(),
      );
    } catch (error) {
      toast({
        title: "Could not load your saved information",
        description: getErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsLoadingEntries(false);
      setIsLoadingDailyReports(false);
      setIsLoadingScreenings(false);
      setIsLoadingConsent(false);
    }
  };

  useEffect(() => {
    void loadPatientData();
  }, [patientId]);

  useEffect(() => {
    if (!consent?.gpsTracking) {
      setIncludeLocation(false);
    }
  }, [consent?.gpsTracking]);

  const resetMoodForm = () => {
    setSelectedEmotion(null);
    setNotes("");
    setSleepHours(8);
    setStressLevel(5);
    setCravingLevel(0);
    setSubstanceUseToday(false);
    setMoneyChangedToday(false);
    setMedicationAdherence("not_prescribed");
    setLocationFeedback(null);
  };

  const handleSubmit = async () => {
    if (!selectedEmotion) {
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

      await apiRequest<EmotionRecord>("/api/emotions", {
        method: "POST",
        data: {
          patientId,
          emotion: selectedEmotion,
          notes,
          sleepHours,
          stressLevel,
          cravingLevel,
          substanceUseToday,
          moneyChangedToday,
          medicationAdherence,
          ...locationPayload,
        },
      });

      resetMoodForm();
      toast({
        title: "Feeling saved",
        description: locationCaptured
          ? "Your latest emotion check-in and location have been recorded."
          : "Your latest emotion check-in has been recorded.",
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

      await loadPatientData();
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
      await apiRequest<DailyReportRecord>("/api/daily-reports", {
        method: "POST",
        data: {
          patientId,
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
          notes: morningReport.notes,
        },
      });

      setMorningReport(createEmptyMorningReport());
      toast({
        title: "Morning report saved",
        description: "Your sleep check-in has been added.",
        variant: "success",
      });
      await loadPatientData();
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

    setIsSavingNightReport(true);

    try {
      await apiRequest<DailyReportRecord>("/api/daily-reports", {
        method: "POST",
        data: {
          patientId,
          reportType: "night",
          bedTime: nightReport.bedTime,
          wakeTime: null,
          sleepQuality: null,
          wakeUps: null,
          feltRested: null,
          notes: nightReport.notes,
        },
      });

      setNightReport(createEmptyNightReport());
      toast({
        title: "Night report saved",
        description: "Tonight's sleep plan has been added.",
        variant: "success",
      });
      await loadPatientData();
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
      const savedScreening = await apiRequest<WeeklyScreeningRecord>("/api/weekly-screenings", {
        method: "POST",
        data: {
          patientId,
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
        },
      });

      const disposition = getWeeklyScreeningDisposition(savedScreening);

      setWeeklyScreening(createEmptyWeeklyScreening());
      toast({
        title:
          disposition === "urgent"
            ? "Weekly screen saved and needs urgent follow-up"
            : "Weekly screen saved",
        description: getWeeklyScreeningDispositionLabel(disposition),
        variant: disposition === "negative" ? "success" : "info",
      });

      await loadPatientData();
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
      !consentForm.weeklyScreening
    ) {
      toast({
        title: "Core consent is required",
        description:
          "Mood tracking, sleep reports, and weekly screening need to be accepted before you can use the patient workspace.",
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
          "Your privacy choices have been recorded. GPS remains optional and can stay off if you prefer.",
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
    consent?.moodTracking && consent?.sleepReports && consent?.weeklyScreening,
  );
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
                  includeLocation={includeLocation}
                  gpsConsentEnabled={Boolean(consent?.gpsTracking)}
                  locationFeedback={locationFeedback}
                  isSaving={isSaving}
                  isCapturingLocation={isCapturingLocation}
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
                  onMorningReportChange={setMorningReport}
                  onNightReportChange={setNightReport}
                  onMorningReportSubmit={handleMorningReportSubmit}
                  onNightReportSubmit={handleNightReportSubmit}
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
                  onChange={setWeeklyScreening}
                  onSubmit={handleWeeklyScreeningSubmit}
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
        what happens between visits. GPS is optional and stays off unless you say yes.
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

        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
          Mood tracking, sleep reports, and weekly safety screens must be accepted to use the
          patient workspace in this pilot. GPS stays optional.
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
