import { db } from "./db";
import {
  type AppetiteChangeDirection,
  type CarePlanRecord,
  type CrisisLevel,
  type DailyReportRecord,
  type DailyReportType,
  type EmotionName,
  type EmotionRecord,
  type EntryEntityType,
  type EntryRevisionRecord,
  type InsertCarePlan,
  type InsertDailyReport,
  type InsertEmotion,
  type InsertMedication,
  type InsertObservation,
  type InsertWeeklyScreening,
  type MedicationAdherence,
  type MedicationRecord,
  type MissedMedicationReason,
  type ObservationPriority,
  type ObservationRecord,
  type ObservationType,
  type ReliabilityLevel,
  type SleepQuality,
  type UpdateCarePlan,
  type UpdateDailyReport,
  type UpdateEmotion,
  type UpdateMedication,
  type UpdateWeeklyScreening,
  type UserRole,
  type WeeklyScreeningRecord,
  type WeeklyScreeningAttemptTiming,
  type WeeklyScreeningFrequency,
} from "../shared/contracts";

export type User = {
  id: number;
  username: string;
  password: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
};

export type InsertUser = {
  username: string;
  password: string;
  role: UserRole;
  firstName?: string | null;
  lastName?: string | null;
};

export type Emotion = EmotionRecord;
export type InsertEmotionRow = InsertEmotion;
export type UpdateEmotionRow = UpdateEmotion;

export type Observation = ObservationRecord;
export type InsertObservationRow = InsertObservation;

export type DailyReport = DailyReportRecord;
export type InsertDailyReportRow = InsertDailyReport;
export type UpdateDailyReportRow = UpdateDailyReport;

export type WeeklyScreening = WeeklyScreeningRecord;
export type InsertWeeklyScreeningRow = InsertWeeklyScreening;
export type UpdateWeeklyScreeningRow = UpdateWeeklyScreening;

export type Medication = MedicationRecord;
export type InsertMedicationRow = InsertMedication;
export type UpdateMedicationRow = UpdateMedication;

export type CarePlan = CarePlanRecord;
export type InsertCarePlanRow = InsertCarePlan;
export type UpdateCarePlanRow = UpdateCarePlan;

export type EntryRevision = EntryRevisionRecord;

export type PatientEntryPersistenceMeta = {
  crisisLevel: CrisisLevel;
  crisisSummary: string | null;
  reliabilityLevel: ReliabilityLevel;
};

export type PatientEntryUpdateMeta = PatientEntryPersistenceMeta & {
  suspiciousEdit: boolean;
};

export type InsertEntryRevisionRow = {
  entityType: EntryEntityType;
  entityId: number;
  patientId: string;
  actorRole: UserRole;
  actorUsername: string;
  beforeJson: string;
  afterJson: string;
  summary: string | null;
  suspicious: boolean;
};

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  authenticateUser(username: string, password: string): Promise<User | null>;
  createEmotion(emotion: InsertEmotionRow, meta: PatientEntryPersistenceMeta): Promise<Emotion>;
  updateEmotion(id: number, emotion: UpdateEmotionRow, meta: PatientEntryUpdateMeta): Promise<Emotion>;
  getEmotionById(id: number): Promise<Emotion | undefined>;
  getEmotionsByPatientId(patientId: string): Promise<Emotion[]>;
  getAllEmotions(): Promise<Emotion[]>;
  createObservation(observation: InsertObservationRow): Promise<Observation>;
  getObservationsByPatientId(patientId: string): Promise<Observation[]>;
  getAllObservations(): Promise<Observation[]>;
  createDailyReport(
    report: InsertDailyReportRow,
    meta: PatientEntryPersistenceMeta,
  ): Promise<DailyReport>;
  updateDailyReport(
    id: number,
    report: UpdateDailyReportRow,
    meta: PatientEntryUpdateMeta,
  ): Promise<DailyReport>;
  getDailyReportById(id: number): Promise<DailyReport | undefined>;
  getDailyReportsByPatientId(patientId: string): Promise<DailyReport[]>;
  getAllDailyReports(): Promise<DailyReport[]>;
  createWeeklyScreening(
    screening: InsertWeeklyScreeningRow,
    meta: PatientEntryPersistenceMeta,
  ): Promise<WeeklyScreening>;
  updateWeeklyScreening(
    id: number,
    screening: UpdateWeeklyScreeningRow,
    meta: PatientEntryUpdateMeta,
  ): Promise<WeeklyScreening>;
  getWeeklyScreeningById(id: number): Promise<WeeklyScreening | undefined>;
  getWeeklyScreeningsByPatientId(patientId: string): Promise<WeeklyScreening[]>;
  getAllWeeklyScreenings(): Promise<WeeklyScreening[]>;
  createMedication(medication: InsertMedicationRow): Promise<Medication>;
  updateMedication(id: number, medication: UpdateMedicationRow): Promise<Medication>;
  getMedicationsByPatientId(patientId: string): Promise<Medication[]>;
  getAllMedications(): Promise<Medication[]>;
  createCarePlan(carePlan: InsertCarePlanRow): Promise<CarePlan>;
  updateCarePlan(patientId: string, carePlan: UpdateCarePlanRow): Promise<CarePlan>;
  getCarePlanByPatientId(patientId: string): Promise<CarePlan | undefined>;
  createEntryRevision(revision: InsertEntryRevisionRow): Promise<EntryRevision>;
  getEntryRevisionsByPatientId(patientId: string): Promise<EntryRevision[]>;
}

function mapUser(row: Record<string, unknown> | undefined): User | undefined {
  if (!row) {
    return undefined;
  }

  return {
    id: Number(row.id),
    username: String(row.username),
    password: String(row.password),
    role: row.role as UserRole,
    firstName: row.firstName == null ? null : String(row.firstName),
    lastName: row.lastName == null ? null : String(row.lastName),
    createdAt: String(row.createdAt),
  };
}

function mapEmotion(row: Record<string, unknown> | undefined): Emotion | undefined {
  if (!row) {
    return undefined;
  }

  return {
    id: Number(row.id),
    patientId: String(row.patientId),
    emotion: row.emotion as EmotionName,
    notes: row.notes == null ? null : String(row.notes),
    sleepHours: row.sleepHours == null ? null : Number(row.sleepHours),
    stressLevel: row.stressLevel == null ? null : Number(row.stressLevel),
    cravingLevel: row.cravingLevel == null ? null : Number(row.cravingLevel),
    substanceUseToday:
      row.substanceUseToday == null ? null : Boolean(row.substanceUseToday),
    moneyChangedToday:
      row.moneyChangedToday == null ? null : Boolean(row.moneyChangedToday),
    medicationAdherence:
      row.medicationAdherence == null
        ? null
        : (String(row.medicationAdherence) as MedicationAdherence),
    missedMedicationName:
      row.missedMedicationName == null ? null : String(row.missedMedicationName),
    missedMedicationReason:
      row.missedMedicationReason == null
        ? null
        : (String(row.missedMedicationReason) as MissedMedicationReason),
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    accuracyMeters: row.accuracyMeters == null ? null : Number(row.accuracyMeters),
    locationCapturedAt:
      row.locationCapturedAt == null ? null : String(row.locationCapturedAt),
    updatedAt: String(row.updatedAt ?? row.timestamp),
    editCount: Number(row.editCount ?? 0),
    suspiciousEditCount: Number(row.suspiciousEditCount ?? 0),
    reliabilityLevel: (row.reliabilityLevel ?? "High") as ReliabilityLevel,
    crisisLevel: (row.crisisLevel ?? "none") as CrisisLevel,
    crisisSummary: row.crisisSummary == null ? null : String(row.crisisSummary),
    timestamp: String(row.timestamp),
  };
}

function mapObservation(row: Record<string, unknown> | undefined): Observation | undefined {
  if (!row) {
    return undefined;
  }

  return {
    id: Number(row.id),
    patientId: String(row.patientId),
    observationType: row.observationType as ObservationType,
    observation: String(row.observation),
    priority: row.priority as ObservationPriority,
    supportWorkerName: String(row.supportWorkerName),
    timestamp: String(row.timestamp),
  };
}

function mapDailyReport(row: Record<string, unknown> | undefined): DailyReport | undefined {
  if (!row) {
    return undefined;
  }

  return {
    id: Number(row.id),
    patientId: String(row.patientId),
    reportType: row.reportType as DailyReportType,
    bedTime: row.bedTime == null ? null : String(row.bedTime),
    wakeTime: row.wakeTime == null ? null : String(row.wakeTime),
    sleepQuality:
      row.sleepQuality == null ? null : (String(row.sleepQuality) as SleepQuality),
    wakeUps: row.wakeUps == null ? null : Number(row.wakeUps),
    feltRested: row.feltRested == null ? null : Boolean(row.feltRested),
    mealsCount: row.mealsCount == null ? null : Number(row.mealsCount),
    mealsNote: row.mealsNote == null ? null : String(row.mealsNote),
    notes: row.notes == null ? null : String(row.notes),
    updatedAt: String(row.updatedAt ?? row.timestamp),
    editCount: Number(row.editCount ?? 0),
    suspiciousEditCount: Number(row.suspiciousEditCount ?? 0),
    reliabilityLevel: (row.reliabilityLevel ?? "High") as ReliabilityLevel,
    crisisLevel: (row.crisisLevel ?? "none") as CrisisLevel,
    crisisSummary: row.crisisSummary == null ? null : String(row.crisisSummary),
    timestamp: String(row.timestamp),
  };
}

function mapWeeklyScreening(
  row: Record<string, unknown> | undefined,
): WeeklyScreening | undefined {
  if (!row) {
    return undefined;
  }

  return {
    id: Number(row.id),
    patientId: String(row.patientId),
    wishedDead: Boolean(row.wishedDead),
    familyBetterOffDead: Boolean(row.familyBetterOffDead),
    thoughtsKillingSelf: Boolean(row.thoughtsKillingSelf),
    thoughtsKillingSelfFrequency:
      row.thoughtsKillingSelfFrequency == null
        ? null
        : (String(row.thoughtsKillingSelfFrequency) as WeeklyScreeningFrequency),
    everTriedToKillSelf: Boolean(row.everTriedToKillSelf),
    attemptTiming: row.attemptTiming as WeeklyScreeningAttemptTiming,
    currentThoughts: row.currentThoughts == null ? null : Boolean(row.currentThoughts),
    depressedHardToFunction: Boolean(row.depressedHardToFunction),
    depressedFrequency:
      row.depressedFrequency == null
        ? null
        : (String(row.depressedFrequency) as WeeklyScreeningFrequency),
    anxiousOnEdge: Boolean(row.anxiousOnEdge),
    anxiousFrequency:
      row.anxiousFrequency == null
        ? null
        : (String(row.anxiousFrequency) as WeeklyScreeningFrequency),
    hopeless: Boolean(row.hopeless),
    couldNotEnjoyThings: Boolean(row.couldNotEnjoyThings),
    keepingToSelf: Boolean(row.keepingToSelf),
    moreIrritable: Boolean(row.moreIrritable),
    substanceUseMoreThanUsual: Boolean(row.substanceUseMoreThanUsual),
    substanceUseFrequency:
      row.substanceUseFrequency == null
        ? null
        : (String(row.substanceUseFrequency) as WeeklyScreeningFrequency),
    sleepTrouble: Boolean(row.sleepTrouble),
    sleepTroubleFrequency:
      row.sleepTroubleFrequency == null
        ? null
        : (String(row.sleepTroubleFrequency) as WeeklyScreeningFrequency),
    appetiteChange: Boolean(row.appetiteChange),
    appetiteChangeDirection:
      row.appetiteChangeDirection == null
        ? null
        : (String(row.appetiteChangeDirection) as AppetiteChangeDirection),
    supportPerson: row.supportPerson == null ? null : String(row.supportPerson),
    reasonsForLiving:
      row.reasonsForLiving == null ? null : String(row.reasonsForLiving),
    copingPlan: row.copingPlan == null ? null : String(row.copingPlan),
    needsHelpStayingSafe:
      row.needsHelpStayingSafe == null ? null : Boolean(row.needsHelpStayingSafe),
    updatedAt: String(row.updatedAt ?? row.timestamp),
    editCount: Number(row.editCount ?? 0),
    suspiciousEditCount: Number(row.suspiciousEditCount ?? 0),
    reliabilityLevel: (row.reliabilityLevel ?? "High") as ReliabilityLevel,
    crisisLevel: (row.crisisLevel ?? "none") as CrisisLevel,
    crisisSummary: row.crisisSummary == null ? null : String(row.crisisSummary),
    timestamp: String(row.timestamp),
  };
}

function mapMedication(row: Record<string, unknown> | undefined): Medication | undefined {
  if (!row) {
    return undefined;
  }

  return {
    id: Number(row.id),
    patientId: String(row.patientId),
    medicationName: String(row.medicationName),
    dose: row.dose == null ? null : String(row.dose),
    schedule: row.schedule == null ? null : String(row.schedule),
    purpose: row.purpose == null ? null : String(row.purpose),
    sideEffects: row.sideEffects == null ? null : String(row.sideEffects),
    adherenceNotes:
      row.adherenceNotes == null ? null : String(row.adherenceNotes),
    isActive: Boolean(row.isActive),
    updatedBy: String(row.updatedBy),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function mapCarePlan(row: Record<string, unknown> | undefined): CarePlan | undefined {
  if (!row) {
    return undefined;
  }

  return {
    patientId: String(row.patientId),
    goals: row.goals == null ? null : String(row.goals),
    triggers: row.triggers == null ? null : String(row.triggers),
    warningSigns: row.warningSigns == null ? null : String(row.warningSigns),
    whatHelps: row.whatHelps == null ? null : String(row.whatHelps),
    supportContacts:
      row.supportContacts == null ? null : String(row.supportContacts),
    preferredFollowUpNotes:
      row.preferredFollowUpNotes == null
        ? null
        : String(row.preferredFollowUpNotes),
    updatedBy: String(row.updatedBy),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function mapEntryRevision(row: Record<string, unknown> | undefined): EntryRevision | undefined {
  if (!row) {
    return undefined;
  }

  return {
    id: Number(row.id),
    entityType: row.entityType as EntryEntityType,
    entityId: Number(row.entityId),
    patientId: String(row.patientId),
    actorRole: row.actorRole as UserRole,
    actorUsername: String(row.actorUsername),
    beforeJson: String(row.beforeJson),
    afterJson: String(row.afterJson),
    summary: row.summary == null ? null : String(row.summary),
    suspicious: Boolean(row.suspicious),
    timestamp: String(row.timestamp),
  };
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number) {
    const result = db
      .prepare(`
        SELECT
          id,
          username,
          password,
          role,
          first_name AS firstName,
          last_name AS lastName,
          created_at AS createdAt
        FROM users
        WHERE id = ?
      `)
      .get(id) as Record<string, unknown> | undefined;

    return mapUser(result);
  }

  async getUserByUsername(username: string) {
    const result = db
      .prepare(`
        SELECT
          id,
          username,
          password,
          role,
          first_name AS firstName,
          last_name AS lastName,
          created_at AS createdAt
        FROM users
        WHERE username = ?
      `)
      .get(username) as Record<string, unknown> | undefined;

    return mapUser(result);
  }

  async createUser(user: InsertUser) {
    const insertResult = db
      .prepare(`
        INSERT INTO users (username, password, role, first_name, last_name)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        user.username,
        user.password,
        user.role,
        user.firstName ?? null,
        user.lastName ?? null,
      );

    const createdUser = await this.getUser(Number(insertResult.lastInsertRowid));

    if (!createdUser) {
      throw new Error("Failed to create user");
    }

    return createdUser;
  }

  async authenticateUser(username: string, password: string) {
    const user = await this.getUserByUsername(username);

    if (!user || user.password !== password) {
      return null;
    }

    return user;
  }

  async createEmotion(emotion: InsertEmotionRow, meta: PatientEntryPersistenceMeta) {
    const insertResult = db
      .prepare(`
        INSERT INTO emotions (
          patient_id,
          emotion,
          notes,
          sleep_hours,
          stress_level,
          craving_level,
          substance_use_today,
          money_changed_today,
          medication_adherence,
          missed_medication_name,
          missed_medication_reason,
          latitude,
          longitude,
          accuracy_meters,
          location_captured_at,
          updated_at,
          edit_count,
          suspicious_edit_count,
          reliability_level,
          crisis_level,
          crisis_summary
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0, 0, ?, ?, ?)
      `)
      .run(
        emotion.patientId,
        emotion.emotion,
        emotion.notes ?? null,
        emotion.sleepHours,
        emotion.stressLevel,
        emotion.cravingLevel,
        emotion.substanceUseToday ? 1 : 0,
        emotion.moneyChangedToday ? 1 : 0,
        emotion.medicationAdherence,
        emotion.missedMedicationName ?? null,
        emotion.missedMedicationReason ?? null,
        emotion.latitude ?? null,
        emotion.longitude ?? null,
        emotion.accuracyMeters ?? null,
        emotion.locationCapturedAt ?? null,
        meta.reliabilityLevel,
        meta.crisisLevel,
        meta.crisisSummary,
      );

    const createdEmotion = await this.getEmotionById(Number(insertResult.lastInsertRowid));

    if (!createdEmotion) {
      throw new Error("Failed to create emotion");
    }

    return createdEmotion;
  }

  async updateEmotion(id: number, emotion: UpdateEmotionRow, meta: PatientEntryUpdateMeta) {
    const updateResult = db
      .prepare(`
        UPDATE emotions
        SET
          emotion = ?,
          notes = ?,
          sleep_hours = ?,
          stress_level = ?,
          craving_level = ?,
          substance_use_today = ?,
          money_changed_today = ?,
          medication_adherence = ?,
          missed_medication_name = ?,
          missed_medication_reason = ?,
          latitude = ?,
          longitude = ?,
          accuracy_meters = ?,
          location_captured_at = ?,
          updated_at = CURRENT_TIMESTAMP,
          edit_count = edit_count + 1,
          suspicious_edit_count = suspicious_edit_count + ?,
          reliability_level = ?,
          crisis_level = ?,
          crisis_summary = ?
        WHERE id = ?
      `)
      .run(
        emotion.emotion,
        emotion.notes ?? null,
        emotion.sleepHours,
        emotion.stressLevel,
        emotion.cravingLevel,
        emotion.substanceUseToday ? 1 : 0,
        emotion.moneyChangedToday ? 1 : 0,
        emotion.medicationAdherence,
        emotion.missedMedicationName ?? null,
        emotion.missedMedicationReason ?? null,
        emotion.latitude ?? null,
        emotion.longitude ?? null,
        emotion.accuracyMeters ?? null,
        emotion.locationCapturedAt ?? null,
        meta.suspiciousEdit ? 1 : 0,
        meta.reliabilityLevel,
        meta.crisisLevel,
        meta.crisisSummary,
        id,
      );

    if (updateResult.changes === 0) {
      throw new Error("Emotion entry not found");
    }

    const updatedEmotion = await this.getEmotionById(id);
    if (!updatedEmotion) {
      throw new Error("Failed to update emotion entry");
    }

    return updatedEmotion;
  }

  async getEmotionById(id: number) {
    const row = db
      .prepare(`
        SELECT
          id,
          patient_id AS patientId,
          emotion,
          notes,
          sleep_hours AS sleepHours,
          stress_level AS stressLevel,
          craving_level AS cravingLevel,
          substance_use_today AS substanceUseToday,
          money_changed_today AS moneyChangedToday,
          medication_adherence AS medicationAdherence,
          missed_medication_name AS missedMedicationName,
          missed_medication_reason AS missedMedicationReason,
          latitude,
          longitude,
          accuracy_meters AS accuracyMeters,
          location_captured_at AS locationCapturedAt,
          updated_at AS updatedAt,
          edit_count AS editCount,
          suspicious_edit_count AS suspiciousEditCount,
          reliability_level AS reliabilityLevel,
          crisis_level AS crisisLevel,
          crisis_summary AS crisisSummary,
          timestamp
        FROM emotions
        WHERE id = ?
      `)
      .get(id) as Record<string, unknown> | undefined;

    return mapEmotion(row);
  }

  async getEmotionsByPatientId(patientId: string) {
    const rows = db
      .prepare(`
        SELECT
          id,
          patient_id AS patientId,
          emotion,
          notes,
          sleep_hours AS sleepHours,
          stress_level AS stressLevel,
          craving_level AS cravingLevel,
          substance_use_today AS substanceUseToday,
          money_changed_today AS moneyChangedToday,
          medication_adherence AS medicationAdherence,
          missed_medication_name AS missedMedicationName,
          missed_medication_reason AS missedMedicationReason,
          latitude,
          longitude,
          accuracy_meters AS accuracyMeters,
          location_captured_at AS locationCapturedAt,
          updated_at AS updatedAt,
          edit_count AS editCount,
          suspicious_edit_count AS suspiciousEditCount,
          reliability_level AS reliabilityLevel,
          crisis_level AS crisisLevel,
          crisis_summary AS crisisSummary,
          timestamp
        FROM emotions
        WHERE patient_id = ?
        ORDER BY timestamp DESC, id DESC
      `)
      .all(patientId) as Record<string, unknown>[];

    return rows
      .map((row) => mapEmotion(row))
      .filter((row): row is Emotion => row !== undefined);
  }

  async getAllEmotions() {
    const rows = db
      .prepare(`
        SELECT
          id,
          patient_id AS patientId,
          emotion,
          notes,
          sleep_hours AS sleepHours,
          stress_level AS stressLevel,
          craving_level AS cravingLevel,
          substance_use_today AS substanceUseToday,
          money_changed_today AS moneyChangedToday,
          medication_adherence AS medicationAdherence,
          missed_medication_name AS missedMedicationName,
          missed_medication_reason AS missedMedicationReason,
          latitude,
          longitude,
          accuracy_meters AS accuracyMeters,
          location_captured_at AS locationCapturedAt,
          updated_at AS updatedAt,
          edit_count AS editCount,
          suspicious_edit_count AS suspiciousEditCount,
          reliability_level AS reliabilityLevel,
          crisis_level AS crisisLevel,
          crisis_summary AS crisisSummary,
          timestamp
        FROM emotions
        ORDER BY timestamp DESC, id DESC
      `)
      .all() as Record<string, unknown>[];

    return rows
      .map((row) => mapEmotion(row))
      .filter((row): row is Emotion => row !== undefined);
  }

  async createObservation(observation: InsertObservationRow) {
    const insertResult = db
      .prepare(`
        INSERT INTO observations (
          patient_id,
          observation_type,
          observation,
          priority,
          support_worker_name
        )
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        observation.patientId,
        observation.observationType,
        observation.observation,
        observation.priority,
        observation.supportWorkerName,
      );

    const row = db
      .prepare(`
        SELECT
          id,
          patient_id AS patientId,
          observation_type AS observationType,
          observation,
          priority,
          support_worker_name AS supportWorkerName,
          timestamp
        FROM observations
        WHERE id = ?
      `)
      .get(Number(insertResult.lastInsertRowid)) as Record<string, unknown> | undefined;

    const createdObservation = mapObservation(row);

    if (!createdObservation) {
      throw new Error("Failed to create observation");
    }

    return createdObservation;
  }

  async createDailyReport(report: InsertDailyReportRow, meta: PatientEntryPersistenceMeta) {
    const insertResult = db
      .prepare(`
        INSERT INTO daily_reports (
          patient_id,
          report_type,
          bed_time,
          wake_time,
          sleep_quality,
          wake_ups,
          felt_rested,
          meals_count,
          meals_note,
          notes,
          updated_at,
          edit_count,
          suspicious_edit_count,
          reliability_level,
          crisis_level,
          crisis_summary
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0, 0, ?, ?, ?)
      `)
      .run(
        report.patientId,
        report.reportType,
        report.bedTime ?? null,
        report.wakeTime ?? null,
        report.sleepQuality ?? null,
        report.wakeUps ?? null,
        report.feltRested == null ? null : report.feltRested ? 1 : 0,
        report.mealsCount ?? null,
        report.mealsNote ?? null,
        report.notes ?? null,
        meta.reliabilityLevel,
        meta.crisisLevel,
        meta.crisisSummary,
      );

    const createdReport = await this.getDailyReportById(Number(insertResult.lastInsertRowid));

    if (!createdReport) {
      throw new Error("Failed to create daily report");
    }

    return createdReport;
  }

  async updateDailyReport(id: number, report: UpdateDailyReportRow, meta: PatientEntryUpdateMeta) {
    const updateResult = db
      .prepare(`
        UPDATE daily_reports
        SET
          report_type = ?,
          bed_time = ?,
          wake_time = ?,
          sleep_quality = ?,
          wake_ups = ?,
          felt_rested = ?,
          meals_count = ?,
          meals_note = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP,
          edit_count = edit_count + 1,
          suspicious_edit_count = suspicious_edit_count + ?,
          reliability_level = ?,
          crisis_level = ?,
          crisis_summary = ?
        WHERE id = ?
      `)
      .run(
        report.reportType,
        report.bedTime ?? null,
        report.wakeTime ?? null,
        report.sleepQuality ?? null,
        report.wakeUps ?? null,
        report.feltRested == null ? null : report.feltRested ? 1 : 0,
        report.mealsCount ?? null,
        report.mealsNote ?? null,
        report.notes ?? null,
        meta.suspiciousEdit ? 1 : 0,
        meta.reliabilityLevel,
        meta.crisisLevel,
        meta.crisisSummary,
        id,
      );

    if (updateResult.changes === 0) {
      throw new Error("Daily report not found");
    }

    const updatedReport = await this.getDailyReportById(id);
    if (!updatedReport) {
      throw new Error("Failed to update daily report");
    }

    return updatedReport;
  }

  async getObservationsByPatientId(patientId: string) {
    const rows = db
      .prepare(`
        SELECT
          id,
          patient_id AS patientId,
          observation_type AS observationType,
          observation,
          priority,
          support_worker_name AS supportWorkerName,
          timestamp
        FROM observations
        WHERE patient_id = ?
        ORDER BY timestamp DESC, id DESC
      `)
      .all(patientId) as Record<string, unknown>[];

    return rows
      .map((row) => mapObservation(row))
      .filter((row): row is Observation => row !== undefined);
  }

  async getAllObservations() {
    const rows = db
      .prepare(`
        SELECT
          id,
          patient_id AS patientId,
          observation_type AS observationType,
          observation,
          priority,
          support_worker_name AS supportWorkerName,
          timestamp
        FROM observations
        ORDER BY timestamp DESC, id DESC
      `)
      .all() as Record<string, unknown>[];

    return rows
      .map((row) => mapObservation(row))
      .filter((row): row is Observation => row !== undefined);
  }

  async getDailyReportById(id: number) {
    const row = db
      .prepare(`
        SELECT
          id,
          patient_id AS patientId,
          report_type AS reportType,
          bed_time AS bedTime,
          wake_time AS wakeTime,
          sleep_quality AS sleepQuality,
          wake_ups AS wakeUps,
          felt_rested AS feltRested,
          meals_count AS mealsCount,
          meals_note AS mealsNote,
          notes,
          updated_at AS updatedAt,
          edit_count AS editCount,
          suspicious_edit_count AS suspiciousEditCount,
          reliability_level AS reliabilityLevel,
          crisis_level AS crisisLevel,
          crisis_summary AS crisisSummary,
          timestamp
        FROM daily_reports
        WHERE id = ?
      `)
      .get(id) as Record<string, unknown> | undefined;

    return mapDailyReport(row);
  }

  async getDailyReportsByPatientId(patientId: string) {
    const rows = db
      .prepare(`
        SELECT
          id,
          patient_id AS patientId,
          report_type AS reportType,
          bed_time AS bedTime,
          wake_time AS wakeTime,
          sleep_quality AS sleepQuality,
          wake_ups AS wakeUps,
          felt_rested AS feltRested,
          meals_count AS mealsCount,
          meals_note AS mealsNote,
          notes,
          updated_at AS updatedAt,
          edit_count AS editCount,
          suspicious_edit_count AS suspiciousEditCount,
          reliability_level AS reliabilityLevel,
          crisis_level AS crisisLevel,
          crisis_summary AS crisisSummary,
          timestamp
        FROM daily_reports
        WHERE patient_id = ?
        ORDER BY timestamp DESC, id DESC
      `)
      .all(patientId) as Record<string, unknown>[];

    return rows
      .map((row) => mapDailyReport(row))
      .filter((row): row is DailyReport => row !== undefined);
  }

  async getAllDailyReports() {
    const rows = db
      .prepare(`
        SELECT
          id,
          patient_id AS patientId,
          report_type AS reportType,
          bed_time AS bedTime,
          wake_time AS wakeTime,
          sleep_quality AS sleepQuality,
          wake_ups AS wakeUps,
          felt_rested AS feltRested,
          meals_count AS mealsCount,
          meals_note AS mealsNote,
          notes,
          updated_at AS updatedAt,
          edit_count AS editCount,
          suspicious_edit_count AS suspiciousEditCount,
          reliability_level AS reliabilityLevel,
          crisis_level AS crisisLevel,
          crisis_summary AS crisisSummary,
          timestamp
        FROM daily_reports
        ORDER BY timestamp DESC, id DESC
      `)
      .all() as Record<string, unknown>[];

    return rows
      .map((row) => mapDailyReport(row))
      .filter((row): row is DailyReport => row !== undefined);
  }

  async createWeeklyScreening(
    screening: InsertWeeklyScreeningRow,
    meta: PatientEntryPersistenceMeta,
  ) {
    const insertResult = db
      .prepare(`
        INSERT INTO weekly_screenings (
          patient_id,
          wished_dead,
          family_better_off_dead,
          thoughts_killing_self,
          thoughts_killing_self_frequency,
          ever_tried_to_kill_self,
          attempt_timing,
          current_thoughts,
          depressed_hard_to_function,
          depressed_frequency,
          anxious_on_edge,
          anxious_frequency,
          hopeless,
          could_not_enjoy_things,
          keeping_to_self,
          more_irritable,
          substance_use_more_than_usual,
          substance_use_frequency,
          sleep_trouble,
          sleep_trouble_frequency,
          appetite_change,
          appetite_change_direction,
          support_person,
          reasons_for_living,
          coping_plan,
          needs_help_staying_safe,
          updated_at,
          edit_count,
          suspicious_edit_count,
          reliability_level,
          crisis_level,
          crisis_summary
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0, 0, ?, ?, ?)
      `)
      .run(
        screening.patientId,
        screening.wishedDead ? 1 : 0,
        screening.familyBetterOffDead ? 1 : 0,
        screening.thoughtsKillingSelf ? 1 : 0,
        screening.thoughtsKillingSelfFrequency ?? null,
        screening.everTriedToKillSelf ? 1 : 0,
        screening.attemptTiming,
        screening.currentThoughts == null ? null : screening.currentThoughts ? 1 : 0,
        screening.depressedHardToFunction ? 1 : 0,
        screening.depressedFrequency ?? null,
        screening.anxiousOnEdge ? 1 : 0,
        screening.anxiousFrequency ?? null,
        screening.hopeless ? 1 : 0,
        screening.couldNotEnjoyThings ? 1 : 0,
        screening.keepingToSelf ? 1 : 0,
        screening.moreIrritable ? 1 : 0,
        screening.substanceUseMoreThanUsual ? 1 : 0,
        screening.substanceUseFrequency ?? null,
        screening.sleepTrouble ? 1 : 0,
        screening.sleepTroubleFrequency ?? null,
        screening.appetiteChange ? 1 : 0,
        screening.appetiteChangeDirection ?? null,
        screening.supportPerson ?? null,
        screening.reasonsForLiving ?? null,
        screening.copingPlan ?? null,
        screening.needsHelpStayingSafe == null
          ? null
          : screening.needsHelpStayingSafe
            ? 1
            : 0,
        meta.reliabilityLevel,
        meta.crisisLevel,
        meta.crisisSummary,
      );

    const createdScreening = await this.getWeeklyScreeningById(
      Number(insertResult.lastInsertRowid),
    );

    if (!createdScreening) {
      throw new Error("Failed to create weekly screening");
    }

    return createdScreening;
  }

  async updateWeeklyScreening(
    id: number,
    screening: UpdateWeeklyScreeningRow,
    meta: PatientEntryUpdateMeta,
  ) {
    const updateResult = db
      .prepare(`
        UPDATE weekly_screenings
        SET
          wished_dead = ?,
          family_better_off_dead = ?,
          thoughts_killing_self = ?,
          thoughts_killing_self_frequency = ?,
          ever_tried_to_kill_self = ?,
          attempt_timing = ?,
          current_thoughts = ?,
          depressed_hard_to_function = ?,
          depressed_frequency = ?,
          anxious_on_edge = ?,
          anxious_frequency = ?,
          hopeless = ?,
          could_not_enjoy_things = ?,
          keeping_to_self = ?,
          more_irritable = ?,
          substance_use_more_than_usual = ?,
          substance_use_frequency = ?,
          sleep_trouble = ?,
          sleep_trouble_frequency = ?,
          appetite_change = ?,
          appetite_change_direction = ?,
          support_person = ?,
          reasons_for_living = ?,
          coping_plan = ?,
          needs_help_staying_safe = ?,
          updated_at = CURRENT_TIMESTAMP,
          edit_count = edit_count + 1,
          suspicious_edit_count = suspicious_edit_count + ?,
          reliability_level = ?,
          crisis_level = ?,
          crisis_summary = ?
        WHERE id = ?
      `)
      .run(
        screening.wishedDead ? 1 : 0,
        screening.familyBetterOffDead ? 1 : 0,
        screening.thoughtsKillingSelf ? 1 : 0,
        screening.thoughtsKillingSelfFrequency ?? null,
        screening.everTriedToKillSelf ? 1 : 0,
        screening.attemptTiming,
        screening.currentThoughts == null ? null : screening.currentThoughts ? 1 : 0,
        screening.depressedHardToFunction ? 1 : 0,
        screening.depressedFrequency ?? null,
        screening.anxiousOnEdge ? 1 : 0,
        screening.anxiousFrequency ?? null,
        screening.hopeless ? 1 : 0,
        screening.couldNotEnjoyThings ? 1 : 0,
        screening.keepingToSelf ? 1 : 0,
        screening.moreIrritable ? 1 : 0,
        screening.substanceUseMoreThanUsual ? 1 : 0,
        screening.substanceUseFrequency ?? null,
        screening.sleepTrouble ? 1 : 0,
        screening.sleepTroubleFrequency ?? null,
        screening.appetiteChange ? 1 : 0,
        screening.appetiteChangeDirection ?? null,
        screening.supportPerson ?? null,
        screening.reasonsForLiving ?? null,
        screening.copingPlan ?? null,
        screening.needsHelpStayingSafe == null
          ? null
          : screening.needsHelpStayingSafe
            ? 1
            : 0,
        meta.suspiciousEdit ? 1 : 0,
        meta.reliabilityLevel,
        meta.crisisLevel,
        meta.crisisSummary,
        id,
      );

    if (updateResult.changes === 0) {
      throw new Error("Weekly screening not found");
    }

    const updatedScreening = await this.getWeeklyScreeningById(id);
    if (!updatedScreening) {
      throw new Error("Failed to update weekly screening");
    }

    return updatedScreening;
  }

  async getWeeklyScreeningById(id: number) {
    const row = db
      .prepare(`
        SELECT
          id,
          patient_id AS patientId,
          wished_dead AS wishedDead,
          family_better_off_dead AS familyBetterOffDead,
          thoughts_killing_self AS thoughtsKillingSelf,
          thoughts_killing_self_frequency AS thoughtsKillingSelfFrequency,
          ever_tried_to_kill_self AS everTriedToKillSelf,
          attempt_timing AS attemptTiming,
          current_thoughts AS currentThoughts,
          depressed_hard_to_function AS depressedHardToFunction,
          depressed_frequency AS depressedFrequency,
          anxious_on_edge AS anxiousOnEdge,
          anxious_frequency AS anxiousFrequency,
          hopeless,
          could_not_enjoy_things AS couldNotEnjoyThings,
          keeping_to_self AS keepingToSelf,
          more_irritable AS moreIrritable,
          substance_use_more_than_usual AS substanceUseMoreThanUsual,
          substance_use_frequency AS substanceUseFrequency,
          sleep_trouble AS sleepTrouble,
          sleep_trouble_frequency AS sleepTroubleFrequency,
          appetite_change AS appetiteChange,
          appetite_change_direction AS appetiteChangeDirection,
          support_person AS supportPerson,
          reasons_for_living AS reasonsForLiving,
          coping_plan AS copingPlan,
          needs_help_staying_safe AS needsHelpStayingSafe,
          updated_at AS updatedAt,
          edit_count AS editCount,
          suspicious_edit_count AS suspiciousEditCount,
          reliability_level AS reliabilityLevel,
          crisis_level AS crisisLevel,
          crisis_summary AS crisisSummary,
          timestamp
        FROM weekly_screenings
        WHERE id = ?
      `)
      .get(id) as Record<string, unknown> | undefined;

    return mapWeeklyScreening(row);
  }

  async getWeeklyScreeningsByPatientId(patientId: string) {
    const rows = db
      .prepare(`
        SELECT
          id,
          patient_id AS patientId,
          wished_dead AS wishedDead,
          family_better_off_dead AS familyBetterOffDead,
          thoughts_killing_self AS thoughtsKillingSelf,
          thoughts_killing_self_frequency AS thoughtsKillingSelfFrequency,
          ever_tried_to_kill_self AS everTriedToKillSelf,
          attempt_timing AS attemptTiming,
          current_thoughts AS currentThoughts,
          depressed_hard_to_function AS depressedHardToFunction,
          depressed_frequency AS depressedFrequency,
          anxious_on_edge AS anxiousOnEdge,
          anxious_frequency AS anxiousFrequency,
          hopeless,
          could_not_enjoy_things AS couldNotEnjoyThings,
          keeping_to_self AS keepingToSelf,
          more_irritable AS moreIrritable,
          substance_use_more_than_usual AS substanceUseMoreThanUsual,
          substance_use_frequency AS substanceUseFrequency,
          sleep_trouble AS sleepTrouble,
          sleep_trouble_frequency AS sleepTroubleFrequency,
          appetite_change AS appetiteChange,
          appetite_change_direction AS appetiteChangeDirection,
          support_person AS supportPerson,
          reasons_for_living AS reasonsForLiving,
          coping_plan AS copingPlan,
          needs_help_staying_safe AS needsHelpStayingSafe,
          updated_at AS updatedAt,
          edit_count AS editCount,
          suspicious_edit_count AS suspiciousEditCount,
          reliability_level AS reliabilityLevel,
          crisis_level AS crisisLevel,
          crisis_summary AS crisisSummary,
          timestamp
        FROM weekly_screenings
        WHERE patient_id = ?
        ORDER BY timestamp DESC, id DESC
      `)
      .all(patientId) as Record<string, unknown>[];

    return rows
      .map((row) => mapWeeklyScreening(row))
      .filter((row): row is WeeklyScreening => row !== undefined);
  }

  async getAllWeeklyScreenings() {
    const rows = db
      .prepare(`
        SELECT
          id,
          patient_id AS patientId,
          wished_dead AS wishedDead,
          family_better_off_dead AS familyBetterOffDead,
          thoughts_killing_self AS thoughtsKillingSelf,
          thoughts_killing_self_frequency AS thoughtsKillingSelfFrequency,
          ever_tried_to_kill_self AS everTriedToKillSelf,
          attempt_timing AS attemptTiming,
          current_thoughts AS currentThoughts,
          depressed_hard_to_function AS depressedHardToFunction,
          depressed_frequency AS depressedFrequency,
          anxious_on_edge AS anxiousOnEdge,
          anxious_frequency AS anxiousFrequency,
          hopeless,
          could_not_enjoy_things AS couldNotEnjoyThings,
          keeping_to_self AS keepingToSelf,
          more_irritable AS moreIrritable,
          substance_use_more_than_usual AS substanceUseMoreThanUsual,
          substance_use_frequency AS substanceUseFrequency,
          sleep_trouble AS sleepTrouble,
          sleep_trouble_frequency AS sleepTroubleFrequency,
          appetite_change AS appetiteChange,
          appetite_change_direction AS appetiteChangeDirection,
          support_person AS supportPerson,
          reasons_for_living AS reasonsForLiving,
          coping_plan AS copingPlan,
          needs_help_staying_safe AS needsHelpStayingSafe,
          updated_at AS updatedAt,
          edit_count AS editCount,
          suspicious_edit_count AS suspiciousEditCount,
          reliability_level AS reliabilityLevel,
          crisis_level AS crisisLevel,
          crisis_summary AS crisisSummary,
          timestamp
        FROM weekly_screenings
        ORDER BY timestamp DESC, id DESC
      `)
      .all() as Record<string, unknown>[];

    return rows
      .map((row) => mapWeeklyScreening(row))
      .filter((row): row is WeeklyScreening => row !== undefined);
  }

  async createMedication(medication: InsertMedicationRow) {
    const insertResult = db
      .prepare(`
        INSERT INTO medications (
          patient_id,
          medication_name,
          dose,
          schedule,
          purpose,
          side_effects,
          adherence_notes,
          is_active,
          updated_by,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .run(
        medication.patientId,
        medication.medicationName,
        medication.dose ?? null,
        medication.schedule ?? null,
        medication.purpose ?? null,
        medication.sideEffects ?? null,
        medication.adherenceNotes ?? null,
        medication.isActive ? 1 : 0,
        medication.updatedBy,
      );

    const row = db
      .prepare(`
        SELECT
          id,
          patient_id AS patientId,
          medication_name AS medicationName,
          dose,
          schedule,
          purpose,
          side_effects AS sideEffects,
          adherence_notes AS adherenceNotes,
          is_active AS isActive,
          updated_by AS updatedBy,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM medications
        WHERE id = ?
      `)
      .get(Number(insertResult.lastInsertRowid)) as Record<string, unknown> | undefined;

    const createdMedication = mapMedication(row);

    if (!createdMedication) {
      throw new Error("Failed to create medication");
    }

    return createdMedication;
  }

  async updateMedication(id: number, medication: UpdateMedicationRow) {
    const updateResult = db
      .prepare(`
        UPDATE medications
        SET
          medication_name = ?,
          dose = ?,
          schedule = ?,
          purpose = ?,
          side_effects = ?,
          adherence_notes = ?,
          is_active = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(
        medication.medicationName,
        medication.dose ?? null,
        medication.schedule ?? null,
        medication.purpose ?? null,
        medication.sideEffects ?? null,
        medication.adherenceNotes ?? null,
        medication.isActive ? 1 : 0,
        medication.updatedBy,
        id,
      );

    if (updateResult.changes === 0) {
      throw new Error("Medication not found");
    }

    const row = db
      .prepare(`
        SELECT
          id,
          patient_id AS patientId,
          medication_name AS medicationName,
          dose,
          schedule,
          purpose,
          side_effects AS sideEffects,
          adherence_notes AS adherenceNotes,
          is_active AS isActive,
          updated_by AS updatedBy,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM medications
        WHERE id = ?
      `)
      .get(id) as Record<string, unknown> | undefined;

    const updatedMedication = mapMedication(row);

    if (!updatedMedication) {
      throw new Error("Failed to update medication");
    }

    return updatedMedication;
  }

  async getMedicationsByPatientId(patientId: string) {
    const rows = db
      .prepare(`
        SELECT
          id,
          patient_id AS patientId,
          medication_name AS medicationName,
          dose,
          schedule,
          purpose,
          side_effects AS sideEffects,
          adherence_notes AS adherenceNotes,
          is_active AS isActive,
          updated_by AS updatedBy,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM medications
        WHERE patient_id = ?
        ORDER BY is_active DESC, updated_at DESC, id DESC
      `)
      .all(patientId) as Record<string, unknown>[];

    return rows
      .map((row) => mapMedication(row))
      .filter((row): row is Medication => row !== undefined);
  }

  async getAllMedications() {
    const rows = db
      .prepare(`
        SELECT
          id,
          patient_id AS patientId,
          medication_name AS medicationName,
          dose,
          schedule,
          purpose,
          side_effects AS sideEffects,
          adherence_notes AS adherenceNotes,
          is_active AS isActive,
          updated_by AS updatedBy,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM medications
        ORDER BY patient_id ASC, is_active DESC, updated_at DESC, id DESC
      `)
      .all() as Record<string, unknown>[];

    return rows
      .map((row) => mapMedication(row))
      .filter((row): row is Medication => row !== undefined);
  }

  async createCarePlan(carePlan: InsertCarePlanRow) {
    const insertResult = db
      .prepare(`
        INSERT INTO care_plans (
          patient_id,
          goals,
          triggers,
          warning_signs,
          what_helps,
          support_contacts,
          preferred_follow_up_notes,
          updated_by,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .run(
        carePlan.patientId,
        carePlan.goals ?? null,
        carePlan.triggers ?? null,
        carePlan.warningSigns ?? null,
        carePlan.whatHelps ?? null,
        carePlan.supportContacts ?? null,
        carePlan.preferredFollowUpNotes ?? null,
        carePlan.updatedBy,
      );

    if (insertResult.changes === 0) {
      throw new Error("Failed to create care plan");
    }

    const createdCarePlan = await this.getCarePlanByPatientId(carePlan.patientId);

    if (!createdCarePlan) {
      throw new Error("Failed to create care plan");
    }

    return createdCarePlan;
  }

  async updateCarePlan(patientId: string, carePlan: UpdateCarePlanRow) {
    const updateResult = db
      .prepare(`
        UPDATE care_plans
        SET
          goals = ?,
          triggers = ?,
          warning_signs = ?,
          what_helps = ?,
          support_contacts = ?,
          preferred_follow_up_notes = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE patient_id = ?
      `)
      .run(
        carePlan.goals ?? null,
        carePlan.triggers ?? null,
        carePlan.warningSigns ?? null,
        carePlan.whatHelps ?? null,
        carePlan.supportContacts ?? null,
        carePlan.preferredFollowUpNotes ?? null,
        carePlan.updatedBy,
        patientId,
      );

    if (updateResult.changes === 0) {
      throw new Error("Care plan not found");
    }

    const updatedCarePlan = await this.getCarePlanByPatientId(patientId);

    if (!updatedCarePlan) {
      throw new Error("Failed to update care plan");
    }

    return updatedCarePlan;
  }

  async getCarePlanByPatientId(patientId: string) {
    const row = db
      .prepare(`
        SELECT
          patient_id AS patientId,
          goals,
          triggers,
          warning_signs AS warningSigns,
          what_helps AS whatHelps,
          support_contacts AS supportContacts,
          preferred_follow_up_notes AS preferredFollowUpNotes,
          updated_by AS updatedBy,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM care_plans
        WHERE patient_id = ?
      `)
      .get(patientId) as Record<string, unknown> | undefined;

    return mapCarePlan(row);
  }

  async createEntryRevision(revision: InsertEntryRevisionRow) {
    const insertResult = db
      .prepare(`
        INSERT INTO entry_revisions (
          entity_type,
          entity_id,
          patient_id,
          actor_role,
          actor_username,
          before_json,
          after_json,
          summary,
          suspicious
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        revision.entityType,
        revision.entityId,
        revision.patientId,
        revision.actorRole,
        revision.actorUsername,
        revision.beforeJson,
        revision.afterJson,
        revision.summary ?? null,
        revision.suspicious ? 1 : 0,
      );

    const row = db
      .prepare(`
        SELECT
          id,
          entity_type AS entityType,
          entity_id AS entityId,
          patient_id AS patientId,
          actor_role AS actorRole,
          actor_username AS actorUsername,
          before_json AS beforeJson,
          after_json AS afterJson,
          summary,
          suspicious,
          timestamp
        FROM entry_revisions
        WHERE id = ?
      `)
      .get(Number(insertResult.lastInsertRowid)) as Record<string, unknown> | undefined;

    const createdRevision = mapEntryRevision(row);
    if (!createdRevision) {
      throw new Error("Failed to create entry revision");
    }

    return createdRevision;
  }

  async getEntryRevisionsByPatientId(patientId: string) {
    const rows = db
      .prepare(`
        SELECT
          id,
          entity_type AS entityType,
          entity_id AS entityId,
          patient_id AS patientId,
          actor_role AS actorRole,
          actor_username AS actorUsername,
          before_json AS beforeJson,
          after_json AS afterJson,
          summary,
          suspicious,
          timestamp
        FROM entry_revisions
        WHERE patient_id = ?
        ORDER BY timestamp DESC, id DESC
      `)
      .all(patientId) as Record<string, unknown>[];

    return rows
      .map((row) => mapEntryRevision(row))
      .filter((row): row is EntryRevision => row !== undefined);
  }
}

export const storage = new DatabaseStorage();
