import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  HeartPulse,
  History,
  MoonStar,
  Settings,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

export type PatientTutorialTab = "mood" | "sleep" | "screening" | "history" | "settings";

type TutorialStep = {
  eyebrow: string;
  title: string;
  body: string;
  detail: string;
  tab: PatientTutorialTab;
  actionLabel: string;
  Icon: LucideIcon;
};

const tutorialSteps: TutorialStep[] = [
  {
    eyebrow: "Start Here",
    title: "Use Daily Check-In when your mood or routine changes.",
    body: "Pick how you feel, add the simple details, and save it for your care team to review.",
    detail:
      "Short entries are enough. A few clear words are better than waiting until everything feels perfect.",
    tab: "mood",
    actionLabel: "Open Daily Check-In",
    Icon: HeartPulse,
  },
  {
    eyebrow: "Morning And Night",
    title: "Sleep Reports are split into two small forms.",
    body: "Use the morning report after waking up and the night report before bed.",
    detail:
      "The app shows whether each report is done today, so you do not have to remember where you left off.",
    tab: "sleep",
    actionLabel: "Open Sleep Reports",
    Icon: MoonStar,
  },
  {
    eyebrow: "Weekly Safety",
    title: "The Weekly Screen helps staff notice bigger changes.",
    body: "Answer it once a week, especially if safety, hopelessness, sleep, anxiety, or substance use changes.",
    detail:
      "This is not an emergency service. If there is immediate danger, contact emergency services or go to the nearest emergency department.",
    tab: "screening",
    actionLabel: "Open Weekly Screen",
    Icon: ShieldCheck,
  },
  {
    eyebrow: "Review",
    title: "History shows what you have already sent.",
    body: "You can look back at recent mood entries, sleep reports, and weekly screens.",
    detail:
      "If something was entered wrong, use the edit buttons so the care team can see the correction trail.",
    tab: "history",
    actionLabel: "Open History",
    Icon: History,
  },
  {
    eyebrow: "Help Anytime",
    title: "Settings keeps help, comfort options, and privacy reminders together.",
    body: "Come back here if you forget how the app works or want a calmer display.",
    detail:
      "You can relaunch this tutorial from Settings or from the top of the patient workspace.",
    tab: "settings",
    actionLabel: "Open Settings",
    Icon: Settings,
  },
];

type PatientTutorialOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: PatientTutorialTab) => void;
};

export default function PatientTutorialOverlay({
  isOpen,
  onClose,
  onSelectTab,
}: PatientTutorialOverlayProps) {
  const [activeStep, setActiveStep] = useState(0);

  if (!isOpen) {
    return null;
  }

  const step = tutorialSteps[activeStep] ?? tutorialSteps[0];
  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === tutorialSteps.length - 1;

  function handleOpenSection() {
    onSelectTab(step.tab);
    setActiveStep(0);
    onClose();
  }

  function handleClose() {
    setActiveStep(0);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="patient-tutorial-title"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-teal-50 text-teal-700">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <p className="mini-heading">L.A.M.B Tutorial</p>
              <p className="text-sm font-semibold text-slate-700">
                Step {activeStep + 1} of {tutorialSteps.length}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary h-11 w-11 shrink-0 px-0"
            onClick={handleClose}
            aria-label="Close tutorial"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-sky-50 text-sky-700">
              <step.Icon className="h-7 w-7" />
            </span>

            <div className="min-w-0">
              <p className="eyebrow">{step.eyebrow}</p>
              <h2 id="patient-tutorial-title" className="section-title mt-3 text-2xl">
                {step.title}
              </h2>
              <p className="hero-text">{step.body}</p>
              <div className="mt-5 rounded-[22px] border border-teal-100 bg-teal-50 px-4 py-4 text-sm leading-6 text-slate-700">
                {step.detail}
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-2" aria-label="Tutorial progress">
            {tutorialSteps.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={`h-2 flex-1 rounded-full ${
                  index === activeStep ? "bg-teal-600" : "bg-slate-200"
                }`}
                onClick={() => setActiveStep(index)}
                aria-label={`Go to tutorial step ${index + 1}`}
              />
            ))}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveStep((current) => Math.max(current - 1, 0))}
                disabled={isFirstStep}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setActiveStep((current) => Math.min(current + 1, tutorialSteps.length - 1))
                }
                disabled={isLastStep}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Done For Now
              </button>
              <button type="button" className="btn btn-primary" onClick={handleOpenSection}>
                {step.actionLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
