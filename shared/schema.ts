import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  dailyReportTypeOptions,
  emotionOptions,
  medicationAdherenceOptions,
  observationTypeOptions,
  priorityOptions,
  roleOptions,
  sleepQualityOptions,
} from "./contracts";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: roleOptions }).notNull().default("patient"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const emotions = sqliteTable("emotions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: text("patient_id").notNull(),
  emotion: text("emotion", { enum: emotionOptions }).notNull(),
  notes: text("notes"),
  sleepHours: real("sleep_hours"),
  stressLevel: integer("stress_level"),
  cravingLevel: integer("craving_level"),
  substanceUseToday: integer("substance_use_today", { mode: "boolean" }),
  moneyChangedToday: integer("money_changed_today", { mode: "boolean" }),
  medicationAdherence: text("medication_adherence", {
    enum: medicationAdherenceOptions,
  }),
  latitude: real("latitude"),
  longitude: real("longitude"),
  accuracyMeters: real("accuracy_meters"),
  locationCapturedAt: text("location_captured_at"),
  timestamp: text("timestamp").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const observations = sqliteTable("observations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: text("patient_id").notNull(),
  observationType: text("observation_type", {
    enum: observationTypeOptions,
  }).notNull(),
  observation: text("observation").notNull(),
  priority: text("priority", { enum: priorityOptions }).notNull(),
  supportWorkerName: text("support_worker_name").notNull(),
  timestamp: text("timestamp").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const dailyReports = sqliteTable("daily_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: text("patient_id").notNull(),
  reportType: text("report_type", { enum: dailyReportTypeOptions }).notNull(),
  bedTime: text("bed_time"),
  wakeTime: text("wake_time"),
  sleepQuality: text("sleep_quality", { enum: sleepQualityOptions }),
  wakeUps: integer("wake_ups"),
  feltRested: integer("felt_rested", { mode: "boolean" }),
  notes: text("notes"),
  timestamp: text("timestamp").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Emotion = typeof emotions.$inferSelect;
export type InsertEmotionRow = typeof emotions.$inferInsert;
export type Observation = typeof observations.$inferSelect;
export type InsertObservationRow = typeof observations.$inferInsert;
export type DailyReport = typeof dailyReports.$inferSelect;
export type InsertDailyReportRow = typeof dailyReports.$inferInsert;
