import assert from "node:assert/strict";
import { evaluatePatientTextForCrisis } from "../server/clinicalMonitoring";
import { buildPatientRiskSnapshot } from "../client/src/lib/riskReview";

const now = new Date().toISOString();

function createEmotionLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    patientId: "demo-patient",
    emotion: "Happy",
    notes: null,
    sleepHours: 8,
    stressLevel: 2,
    cravingLevel: 0,
    substanceUseToday: false,
    moneyChangedToday: false,
    medicationAdherence: "took_as_prescribed",
    missedMedicationName: null,
    missedMedicationReason: null,
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    locationCapturedAt: null,
    updatedAt: now,
    editCount: 0,
    suspiciousEditCount: 0,
    reliabilityLevel: "High",
    crisisLevel: "none",
    crisisSummary: null,
    timestamp: now,
    observations: [],
    ...overrides,
  };
}

function runCrisisDetectorChecks() {
  const cases = [
    {
      label: "neutral coping language stays unflagged",
      text: "I feel okay and I want to rest.",
      expected: "none",
    },
    {
      label: "negated self-harm statement stays unflagged",
      text: "I feel stressed and overwhelmed, but I have no plans to hurt myself.",
      expected: "none",
    },
    {
      label: "passive self-harm wording is high",
      text: "I feel like I do not want to be here sometimes.",
      expected: "high",
    },
    {
      label: "existential self-erasure wording is critical",
      text: "i feel like im worthless and dont belong on this earth anymore",
      expected: "critical",
    },
    {
      label: "plain-language not wanting to be on earth is high",
      text: "i dont feel like being on earth anymore",
      expected: "high",
    },
    {
      label: "quoted third-party language stays unflagged",
      text: "My friend said they do not belong on this earth anymore.",
      expected: "none",
    },
  ] as const;

  for (const testCase of cases) {
    const result = evaluatePatientTextForCrisis([testCase.text]);
    assert.equal(result.level, testCase.expected, testCase.label);
  }
}

function runRiskSnapshotChecks() {
  const lowSnapshot = buildPatientRiskSnapshot(
    "low-demo",
    [createEmotionLog()],
    [],
    [],
    [],
  );
  assert.equal(lowSnapshot.riskLevel, "Low", "stable baseline should remain low");

  const mediumSnapshot = buildPatientRiskSnapshot(
    "medium-demo",
    [
      createEmotionLog({
        emotion: "Worried",
        stressLevel: 7,
        sleepHours: 5,
        notes: "Stress has been building.",
      }),
      createEmotionLog({
        id: 2,
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        emotion: "Worried",
        stressLevel: 7,
        sleepHours: 5,
      }),
      createEmotionLog({
        id: 3,
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        emotion: "Sad",
        stressLevel: 6,
        sleepHours: 6,
      }),
      createEmotionLog({
        id: 4,
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        emotion: "Happy",
        stressLevel: 3,
        sleepHours: 8,
      }),
    ],
    [],
    [],
    [],
  );
  assert.equal(
    mediumSnapshot.riskLevel,
    "Medium",
    "multiple meaningful but non-crisis changes should land in medium",
  );

  const highSnapshot = buildPatientRiskSnapshot(
    "high-demo",
    [
      createEmotionLog({
        emotion: "Sad",
        notes: "I feel like I do not want to be here.",
        crisisLevel: "high",
        crisisSummary:
          "Patient text suggests thoughts about self-harm or not wanting to be here.",
      }),
    ],
    [],
    [],
    [],
  );
  assert.equal(highSnapshot.riskLevel, "High", "passive self-harm wording should land in high");

  const criticalSnapshot = buildPatientRiskSnapshot(
    "critical-demo",
    [
      createEmotionLog({
        emotion: "Sad",
        notes: "i feel like im worthless and dont belong on this earth anymore",
        crisisLevel: "critical",
        crisisSummary:
          "Patient text suggests active self-harm intent or an immediate need for safety support.",
      }),
    ],
    [],
    [],
    [],
  );
  assert.equal(
    criticalSnapshot.riskLevel,
    "Critical",
    "critical safety language should land in critical",
  );
}

runCrisisDetectorChecks();
runRiskSnapshotChecks();

console.log("Triage regression checks passed.");
