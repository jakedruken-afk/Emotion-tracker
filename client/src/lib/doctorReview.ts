import { format } from "date-fns";
import type {
  CarePlanRecord,
  DailyReportRecord,
  EmotionLog,
  MedicationRecord,
  ObservationRecord,
  WeeklyScreeningRecord,
} from "@shared/contracts";
import { buildClinicianSummary, getReviewSignals } from "./clinicianSummary";
import { buildWeeklyPatientReview, type PatientRiskSnapshot } from "./riskReview";

type DoctorReviewInput = {
  patientId: string;
  logs: EmotionLog[];
  dailyReports: DailyReportRecord[];
  screenings: WeeklyScreeningRecord[];
  observations: ObservationRecord[];
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
    input.observations,
  );
  const activeMedications = input.medications.filter((medication) => medication.isActive);
  const carePlanText = input.carePlan
    ? `Care plan updated by ${input.carePlan.updatedBy} on ${format(
        new Date(input.carePlan.updatedAt),
        "MMM d, yyyy 'at' h:mm a",
      )}.`
    : "No clinician care plan is on file.";
  const medicationText =
    activeMedications.length > 0
      ? `${activeMedications.length} active medication${
          activeMedications.length === 1 ? "" : "s"
        } are listed.`
      : "No active medications are listed.";

  return `${baseSummary} ${medicationText} ${carePlanText}`;
}

export function buildDoctorQuestions(input: DoctorReviewInput) {
  const questions = new Set<string>();
  const weeklyReview = buildWeeklyPatientReview(
    input.patientId,
    input.logs,
    input.dailyReports,
    input.screenings,
    input.observations,
  );
  const reviewSignals = getReviewSignals(
    input.logs,
    input.dailyReports,
    input.screenings,
    input.observations,
  );
  const activeMedications = input.medications.filter((medication) => medication.isActive);

  if (input.risk.crisisLevel === "critical") {
    questions.add("Ask directly about current safety, intent, means, and what immediate support is needed today.");
  } else if (input.risk.crisisLevel === "high") {
    questions.add("Ask whether the patient feels safe today and what changed around the recent safety language.");
  }

  if (input.risk.whatChanged.some((change) => change.toLowerCase().includes("stress"))) {
    questions.add("Ask what drove the recent stress increase and whether it has changed function, routine, or risk.");
  }

  if (
    input.risk.whatChanged.some(
      (change) => change.toLowerCase().includes("sleep") || change.toLowerCase().includes("wake"),
    )
  ) {
    questions.add("Ask how sleep has changed, what is breaking sleep, and whether poor sleep is worsening symptoms during the day.");
  }

  if (input.risk.whatChanged.some((change) => change.toLowerCase().includes("meal"))) {
    questions.add("Ask what is getting in the way of eating regularly and whether appetite, nausea, stress, or substance use is involved.");
  }

  if (
    input.logs.some(
      (log) =>
        log.medicationAdherence === "missed_some" || log.medicationAdherence === "missed_all",
    ) ||
    activeMedications.length > 0
  ) {
    questions.add("Ask whether medications are being taken as intended, which doses are being missed, and whether side effects, cost, or access are barriers.");
  }

  if (input.risk.mismatchLevel !== "none") {
    questions.add("Ask about the difference between patient self-report and recent support observations so the current picture can be clarified.");
  }

  if (input.carePlan?.goals) {
    questions.add("Ask what progress has been made toward the current care-plan goals since the last review.");
  }

  for (const signal of reviewSignals.slice(0, 2)) {
    questions.add(`Clarify this recent signal: ${signal}`);
  }

  for (const action of weeklyReview.suggestedActions) {
    questions.add(action);
  }

  if (questions.size === 0) {
    questions.add("Ask what has changed most since the last visit and what the patient needs help with next.");
  }

  return Array.from(questions).slice(0, 6);
}

export function buildDoctorQuestionText(questions: string[]) {
  if (questions.length === 0) {
    return "No specific follow-up questions were generated.";
  }

  return questions.map((question, index) => `${index + 1}. ${question}`).join("\n");
}
