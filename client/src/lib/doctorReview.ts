import { format } from "date-fns";
import type {
  CarePlanRecord,
  DailyReportRecord,
  EmotionLog,
  MedicationRecord,
  WeeklyScreeningRecord,
} from "@shared/contracts";
import {
  getLatestWeeklyScreening,
  getWeeklyScreeningDisposition,
} from "@shared/weeklyScreening";
import { buildClinicianSummary, getReviewSignals } from "./clinicianSummary";
import { buildWeeklyPatientReview, type PatientRiskSnapshot } from "./riskReview";

type DoctorReviewInput = {
  patientId: string;
  logs: EmotionLog[];
  dailyReports: DailyReportRecord[];
  screenings: WeeklyScreeningRecord[];
  medications: MedicationRecord[];
  carePlan: CarePlanRecord | null;
  risk: PatientRiskSnapshot;
};

export function buildDoctorVisitSummary(input: DoctorReviewInput) {
  const baseSummary = buildClinicianSummary(
    input.patientId,
    input.logs,
    input.dailyReports,
    input.screenings,
  );
  const activeMedicationCount = input.medications.filter((medication) => medication.isActive).length;
  const carePlanUpdatedText = input.carePlan
    ? `Care plan last updated by ${input.carePlan.updatedBy} on ${format(new Date(input.carePlan.updatedAt), "MMM d, yyyy 'at' h:mm a")}.`
    : "No clinician care plan has been added yet.";

  return `${baseSummary} ${activeMedicationCount} active medication${activeMedicationCount === 1 ? "" : "s"} are listed. ${carePlanUpdatedText}`;
}

export function buildDoctorQuestions(input: DoctorReviewInput) {
  const questions = new Set<string>();
  const reviewSignals = getReviewSignals(input.logs, input.dailyReports, input.screenings);
  const weeklyReview = buildWeeklyPatientReview(
    input.patientId,
    input.logs,
    input.dailyReports,
    input.screenings,
  );
  const latestScreening = getLatestWeeklyScreening(input.screenings);
  const activeMedications = input.medications.filter((medication) => medication.isActive);

  if (latestScreening) {
    const disposition = getWeeklyScreeningDisposition(latestScreening);

    if (disposition === "urgent" || disposition === "positive") {
      questions.add("Ask directly about current safety, suicidal thoughts, and what support is needed today.");
    }

    if (latestScreening.needsHelpStayingSafe) {
      questions.add("Ask what would help the patient stay safe today and whether the current safety plan is enough.");
    }
  } else {
    questions.add("Ask why the weekly safety screen has not been completed and whether it should be done during this visit.");
  }

  if (
    reviewSignals.some((signal) => signal.toLowerCase().includes("sleep")) ||
    input.logs.some((log) => (log.sleepHours ?? 24) <= 4)
  ) {
    questions.add("Ask how sleep has changed, what is waking the patient, and how poor sleep affects daytime functioning.");
  }

  if (
    input.logs.some((log) => (log.cravingLevel ?? 0) >= 7) ||
    input.logs.some((log) => log.substanceUseToday)
  ) {
    questions.add("Ask about cravings, recent substance use, triggers, access, and what happened before the higher-risk days.");
  }

  if (
    input.logs.some(
      (log) =>
        log.medicationAdherence === "missed_some" || log.medicationAdherence === "missed_all",
    ) ||
    activeMedications.length > 0
  ) {
    questions.add("Ask whether medications are being taken as intended, whether side effects are present, and whether refills or changes are needed.");
  }

  if (input.logs.some((log) => log.moneyChangedToday && (log.cravingLevel ?? 0) >= 7)) {
    questions.add("Ask whether money-related events are lining up with cravings, use, or routine changes.");
  }

  if (input.carePlan?.triggers) {
    questions.add("Ask whether the known triggers in the care plan have happened recently and how the patient responded.");
  }

  if (input.carePlan?.goals) {
    questions.add("Ask what progress has been made toward the current care goals since the last review.");
  }

  for (const action of weeklyReview.suggestedActions) {
    questions.add(action);
  }

  if (questions.size === 0) {
    questions.add("Ask what has changed most for the patient since the last visit.");
  }

  return Array.from(questions).slice(0, 6);
}

export function buildDoctorQuestionText(questions: string[]) {
  if (questions.length === 0) {
    return "No specific follow-up questions were generated.";
  }

  return questions.map((question, index) => `${index + 1}. ${question}`).join("\n");
}
