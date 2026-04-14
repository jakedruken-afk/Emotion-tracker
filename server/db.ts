import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { demoAccounts } from "../shared/contracts";
import { databasePath, enableDemoSeed } from "./config";
import { hashPassword } from "./password";

const dataDir = path.dirname(databasePath);

fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(databasePath);
db.exec("PRAGMA journal_mode = WAL");

export async function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'patient',
      first_name TEXT,
      last_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS emotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      emotion TEXT NOT NULL,
      notes TEXT,
      sleep_hours REAL,
      stress_level INTEGER,
      craving_level INTEGER,
      substance_use_today INTEGER,
      money_changed_today INTEGER,
      medication_adherence TEXT,
      missed_medication_name TEXT,
      missed_medication_reason TEXT,
      latitude REAL,
      longitude REAL,
      accuracy_meters REAL,
      location_captured_at TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      edit_count INTEGER NOT NULL DEFAULT 0,
      suspicious_edit_count INTEGER NOT NULL DEFAULT 0,
      reliability_level TEXT NOT NULL DEFAULT 'High',
      crisis_level TEXT NOT NULL DEFAULT 'none',
      crisis_summary TEXT,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      observation_type TEXT NOT NULL,
      observation TEXT NOT NULL,
      priority TEXT NOT NULL,
      support_worker_name TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      bed_time TEXT,
      wake_time TEXT,
      sleep_quality TEXT,
      wake_ups INTEGER,
      felt_rested INTEGER,
      meals_count INTEGER,
      meals_note TEXT,
      notes TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      edit_count INTEGER NOT NULL DEFAULT 0,
      suspicious_edit_count INTEGER NOT NULL DEFAULT 0,
      reliability_level TEXT NOT NULL DEFAULT 'High',
      crisis_level TEXT NOT NULL DEFAULT 'none',
      crisis_summary TEXT,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS weekly_screenings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      wished_dead INTEGER NOT NULL,
      family_better_off_dead INTEGER NOT NULL,
      thoughts_killing_self INTEGER NOT NULL,
      thoughts_killing_self_frequency TEXT,
      ever_tried_to_kill_self INTEGER NOT NULL,
      attempt_timing TEXT NOT NULL,
      current_thoughts INTEGER,
      depressed_hard_to_function INTEGER NOT NULL,
      depressed_frequency TEXT,
      anxious_on_edge INTEGER NOT NULL,
      anxious_frequency TEXT,
      hopeless INTEGER NOT NULL,
      could_not_enjoy_things INTEGER NOT NULL,
      keeping_to_self INTEGER NOT NULL,
      more_irritable INTEGER NOT NULL,
      substance_use_more_than_usual INTEGER NOT NULL,
      substance_use_frequency TEXT,
      sleep_trouble INTEGER NOT NULL,
      sleep_trouble_frequency TEXT,
      appetite_change INTEGER NOT NULL,
      appetite_change_direction TEXT,
      support_person TEXT,
      reasons_for_living TEXT,
      coping_plan TEXT,
      needs_help_staying_safe INTEGER,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      edit_count INTEGER NOT NULL DEFAULT 0,
      suspicious_edit_count INTEGER NOT NULL DEFAULT 0,
      reliability_level TEXT NOT NULL DEFAULT 'High',
      crisis_level TEXT NOT NULL DEFAULT 'none',
      crisis_summary TEXT,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      medication_name TEXT NOT NULL,
      dose TEXT,
      schedule TEXT,
      purpose TEXT,
      side_effects TEXT,
      adherence_notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS care_plans (
      patient_id TEXT PRIMARY KEY,
      goals TEXT,
      triggers TEXT,
      warning_signs TEXT,
      what_helps TEXT,
      support_contacts TEXT,
      preferred_follow_up_notes TEXT,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      assigned_staff_user_id INTEGER,
      created_by_user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      accepted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS patient_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      staff_user_id INTEGER NOT NULL,
      created_by_user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(patient_id, staff_user_id)
    );

    CREATE TABLE IF NOT EXISTS consent_records (
      patient_id TEXT PRIMARY KEY,
      mood_tracking INTEGER NOT NULL DEFAULT 0,
      sleep_reports INTEGER NOT NULL DEFAULT 0,
      weekly_screening INTEGER NOT NULL DEFAULT 0,
      gps_tracking INTEGER NOT NULL DEFAULT 0,
      accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      actor_role TEXT,
      actor_username TEXT,
      patient_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS entry_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      patient_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      actor_username TEXT NOT NULL,
      before_json TEXT NOT NULL,
      after_json TEXT NOT NULL,
      summary TEXT,
      suspicious INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureEmotionColumns();
  ensureDailyReportColumns();
  ensureWeeklyScreeningColumns();
  await seedDemoUsers();
}

function ensureEmotionColumns() {
  const existingColumns = db
    .prepare("PRAGMA table_info(emotions)")
    .all() as Array<{ name?: string }>;
  const columnNames = new Set(existingColumns.map((column) => column.name));

  if (!columnNames.has("sleep_hours")) {
    db.exec("ALTER TABLE emotions ADD COLUMN sleep_hours REAL");
  }

  if (!columnNames.has("stress_level")) {
    db.exec("ALTER TABLE emotions ADD COLUMN stress_level INTEGER");
  }

  if (!columnNames.has("craving_level")) {
    db.exec("ALTER TABLE emotions ADD COLUMN craving_level INTEGER");
  }

  if (!columnNames.has("substance_use_today")) {
    db.exec("ALTER TABLE emotions ADD COLUMN substance_use_today INTEGER");
  }

  if (!columnNames.has("money_changed_today")) {
    db.exec("ALTER TABLE emotions ADD COLUMN money_changed_today INTEGER");
  }

  if (!columnNames.has("medication_adherence")) {
    db.exec("ALTER TABLE emotions ADD COLUMN medication_adherence TEXT");
  }

  if (!columnNames.has("latitude")) {
    db.exec("ALTER TABLE emotions ADD COLUMN latitude REAL");
  }

  if (!columnNames.has("longitude")) {
    db.exec("ALTER TABLE emotions ADD COLUMN longitude REAL");
  }

  if (!columnNames.has("accuracy_meters")) {
    db.exec("ALTER TABLE emotions ADD COLUMN accuracy_meters REAL");
  }

  if (!columnNames.has("location_captured_at")) {
    db.exec("ALTER TABLE emotions ADD COLUMN location_captured_at TEXT");
  }

  if (!columnNames.has("missed_medication_name")) {
    db.exec("ALTER TABLE emotions ADD COLUMN missed_medication_name TEXT");
  }

  if (!columnNames.has("missed_medication_reason")) {
    db.exec("ALTER TABLE emotions ADD COLUMN missed_medication_reason TEXT");
  }

  if (!columnNames.has("updated_at")) {
    db.exec("ALTER TABLE emotions ADD COLUMN updated_at TEXT");
    db.exec("UPDATE emotions SET updated_at = timestamp WHERE updated_at IS NULL");
  }

  if (!columnNames.has("edit_count")) {
    db.exec("ALTER TABLE emotions ADD COLUMN edit_count INTEGER NOT NULL DEFAULT 0");
  }

  if (!columnNames.has("suspicious_edit_count")) {
    db.exec(
      "ALTER TABLE emotions ADD COLUMN suspicious_edit_count INTEGER NOT NULL DEFAULT 0",
    );
  }

  if (!columnNames.has("reliability_level")) {
    db.exec("ALTER TABLE emotions ADD COLUMN reliability_level TEXT NOT NULL DEFAULT 'High'");
  }

  if (!columnNames.has("crisis_level")) {
    db.exec("ALTER TABLE emotions ADD COLUMN crisis_level TEXT NOT NULL DEFAULT 'none'");
  }

  if (!columnNames.has("crisis_summary")) {
    db.exec("ALTER TABLE emotions ADD COLUMN crisis_summary TEXT");
  }
}

function ensureDailyReportColumns() {
  const existingColumns = db
    .prepare("PRAGMA table_info(daily_reports)")
    .all() as Array<{ name?: string }>;
  const columnNames = new Set(existingColumns.map((column) => column.name));

  if (!columnNames.has("meals_count")) {
    db.exec("ALTER TABLE daily_reports ADD COLUMN meals_count INTEGER");
  }

  if (!columnNames.has("meals_note")) {
    db.exec("ALTER TABLE daily_reports ADD COLUMN meals_note TEXT");
  }

  if (!columnNames.has("updated_at")) {
    db.exec("ALTER TABLE daily_reports ADD COLUMN updated_at TEXT");
    db.exec("UPDATE daily_reports SET updated_at = timestamp WHERE updated_at IS NULL");
  }

  if (!columnNames.has("edit_count")) {
    db.exec("ALTER TABLE daily_reports ADD COLUMN edit_count INTEGER NOT NULL DEFAULT 0");
  }

  if (!columnNames.has("suspicious_edit_count")) {
    db.exec(
      "ALTER TABLE daily_reports ADD COLUMN suspicious_edit_count INTEGER NOT NULL DEFAULT 0",
    );
  }

  if (!columnNames.has("reliability_level")) {
    db.exec(
      "ALTER TABLE daily_reports ADD COLUMN reliability_level TEXT NOT NULL DEFAULT 'High'",
    );
  }

  if (!columnNames.has("crisis_level")) {
    db.exec("ALTER TABLE daily_reports ADD COLUMN crisis_level TEXT NOT NULL DEFAULT 'none'");
  }

  if (!columnNames.has("crisis_summary")) {
    db.exec("ALTER TABLE daily_reports ADD COLUMN crisis_summary TEXT");
  }
}

function ensureWeeklyScreeningColumns() {
  const existingColumns = db
    .prepare("PRAGMA table_info(weekly_screenings)")
    .all() as Array<{ name?: string }>;
  const columnNames = new Set(existingColumns.map((column) => column.name));

  if (!columnNames.has("thoughts_killing_self_frequency")) {
    db.exec("ALTER TABLE weekly_screenings ADD COLUMN thoughts_killing_self_frequency TEXT");
  }

  if (!columnNames.has("depressed_frequency")) {
    db.exec("ALTER TABLE weekly_screenings ADD COLUMN depressed_frequency TEXT");
  }

  if (!columnNames.has("anxious_frequency")) {
    db.exec("ALTER TABLE weekly_screenings ADD COLUMN anxious_frequency TEXT");
  }

  if (!columnNames.has("substance_use_frequency")) {
    db.exec("ALTER TABLE weekly_screenings ADD COLUMN substance_use_frequency TEXT");
  }

  if (!columnNames.has("sleep_trouble_frequency")) {
    db.exec("ALTER TABLE weekly_screenings ADD COLUMN sleep_trouble_frequency TEXT");
  }

  if (!columnNames.has("appetite_change_direction")) {
    db.exec("ALTER TABLE weekly_screenings ADD COLUMN appetite_change_direction TEXT");
  }

  if (!columnNames.has("updated_at")) {
    db.exec("ALTER TABLE weekly_screenings ADD COLUMN updated_at TEXT");
    db.exec("UPDATE weekly_screenings SET updated_at = timestamp WHERE updated_at IS NULL");
  }

  if (!columnNames.has("edit_count")) {
    db.exec(
      "ALTER TABLE weekly_screenings ADD COLUMN edit_count INTEGER NOT NULL DEFAULT 0",
    );
  }

  if (!columnNames.has("suspicious_edit_count")) {
    db.exec(
      "ALTER TABLE weekly_screenings ADD COLUMN suspicious_edit_count INTEGER NOT NULL DEFAULT 0",
    );
  }

  if (!columnNames.has("reliability_level")) {
    db.exec(
      "ALTER TABLE weekly_screenings ADD COLUMN reliability_level TEXT NOT NULL DEFAULT 'High'",
    );
  }

  if (!columnNames.has("crisis_level")) {
    db.exec(
      "ALTER TABLE weekly_screenings ADD COLUMN crisis_level TEXT NOT NULL DEFAULT 'none'",
    );
  }

  if (!columnNames.has("crisis_summary")) {
    db.exec("ALTER TABLE weekly_screenings ADD COLUMN crisis_summary TEXT");
  }
}

async function seedDemoUsers() {
  if (!enableDemoSeed) {
    return;
  }

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (username, password, role, first_name, last_name)
    VALUES (?, ?, ?, ?, ?)
  `);

  const patientPasswordHash = await hashPassword(demoAccounts.patient.password);
  const supportPasswordHash = await hashPassword(demoAccounts.support.password);

  insertUser.run(
    demoAccounts.patient.username,
    patientPasswordHash,
    demoAccounts.patient.role,
    demoAccounts.patient.firstName,
    demoAccounts.patient.lastName,
  );

  insertUser.run(
    demoAccounts.support.username,
    supportPasswordHash,
    demoAccounts.support.role,
    demoAccounts.support.firstName,
    demoAccounts.support.lastName,
  );

  const patientRow = db
    .prepare("SELECT username FROM users WHERE username = ?")
    .get(demoAccounts.patient.username) as { username?: string } | undefined;
  const supportRow = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(demoAccounts.support.username) as { id?: number } | undefined;

  if (patientRow?.username && supportRow?.id) {
    db.prepare(`
      INSERT OR IGNORE INTO patient_assignments (patient_id, staff_user_id, created_by_user_id)
      VALUES (?, ?, ?)
    `).run(patientRow.username, supportRow.id, supportRow.id);
  }
}
