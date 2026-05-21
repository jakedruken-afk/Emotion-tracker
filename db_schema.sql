-- ============================================================
-- L.A.M.B. - Clinical Monitoring Database Schema
-- Target: Cloudflare D1 (SQLite)
-- Compliance: PHIPA / PIPEDA
--   - PHI encrypted at rest by Cloudflare D1
--   - All data in transit uses TLS through Workers
--   - Create the D1 database with Canadian/Canadian-proximate
--     residency requirements in mind, for example --location=enam
--   - Full audit trail via log_edits and access_log tables
--   - Role-based access enforced at the application layer
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT    NOT NULL UNIQUE,
  hashed_password TEXT    NOT NULL,
  name            TEXT    NOT NULL,
  role            TEXT    NOT NULL CHECK(role IN ('patient','doctor','support_worker')),
  patient_code    TEXT    UNIQUE,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_patient_code ON users(patient_code) WHERE patient_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS app_admins (
  user_id            INTEGER PRIMARY KEY,
  created_by_user_id INTEGER,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS patients (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL,
  doctor_id           INTEGER NOT NULL,
  support_worker_id   INTEGER,
  consent_given       INTEGER NOT NULL DEFAULT 0,
  consent_date        TEXT,
  last_visit_at       TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (doctor_id) REFERENCES users(id),
  FOREIGN KEY (support_worker_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_doctor_id ON patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_support_worker_id ON patients(support_worker_id);

CREATE TABLE IF NOT EXISTS invites (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash          TEXT    NOT NULL UNIQUE,
  email               TEXT    NOT NULL,
  name                TEXT    NOT NULL,
  role                TEXT    NOT NULL CHECK(role IN ('patient','doctor','support_worker')),
  doctor_id           INTEGER,
  support_worker_id   INTEGER,
  created_by_user_id  INTEGER NOT NULL,
  accepted_by_user_id INTEGER,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at          TEXT    NOT NULL,
  accepted_at         TEXT,
  FOREIGN KEY (doctor_id) REFERENCES users(id),
  FOREIGN KEY (support_worker_id) REFERENCES users(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (accepted_by_user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_token_hash ON invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_created_by ON invites(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_invites_assignments ON invites(doctor_id, support_worker_id);

CREATE TABLE IF NOT EXISTS logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id  INTEGER NOT NULL,
  source      TEXT    NOT NULL CHECK(source IN ('patient','support_worker')),
  type        TEXT    NOT NULL CHECK(type IN ('mood','stress','sleep','meal','medication','substance','weekly_check')),
  value       TEXT    NOT NULL,
  note        TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE INDEX IF NOT EXISTS idx_logs_patient_id ON logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_patient_type ON logs(patient_id, type, created_at);
CREATE INDEX IF NOT EXISTS idx_logs_patient_source ON logs(patient_id, source, created_at);

CREATE TABLE IF NOT EXISTS log_edits (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  log_id            INTEGER NOT NULL,
  old_value         TEXT    NOT NULL,
  new_value         TEXT    NOT NULL,
  edited_by_user_id INTEGER NOT NULL,
  edited_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (log_id) REFERENCES logs(id),
  FOREIGN KEY (edited_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_log_edits_log_id ON log_edits(log_id);

CREATE TABLE IF NOT EXISTS medications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id      INTEGER NOT NULL,
  name            TEXT    NOT NULL,
  dosage          TEXT    NOT NULL,
  frequency       TEXT    NOT NULL,
  start_date      TEXT    NOT NULL,
  end_date        TEXT,
  purpose         TEXT,
  side_effects    TEXT,
  adherence_notes TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  updated_by      TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE INDEX IF NOT EXISTS idx_medications_patient_id ON medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_medications_active ON medications(patient_id, is_active, updated_at);

CREATE TABLE IF NOT EXISTS medication_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  medication_id   INTEGER NOT NULL,
  log_id          INTEGER,
  taken           INTEGER NOT NULL DEFAULT 0,
  missed_reason   TEXT,
  logged_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (medication_id) REFERENCES medications(id),
  FOREIGN KEY (log_id) REFERENCES logs(id)
);

CREATE INDEX IF NOT EXISTS idx_medication_logs_medication_id ON medication_logs(medication_id);

CREATE TABLE IF NOT EXISTS substance_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id  INTEGER NOT NULL,
  substance   TEXT    NOT NULL CHECK(substance IN ('cocaine','cannabis','alcohol','nicotine','other')),
  amount      TEXT,
  frequency   TEXT,
  log_id      INTEGER,
  logged_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (log_id) REFERENCES logs(id)
);

CREATE INDEX IF NOT EXISTS idx_substance_logs_patient_id ON substance_logs(patient_id);

CREATE TABLE IF NOT EXISTS meal_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id  INTEGER NOT NULL,
  meal_type   TEXT    NOT NULL CHECK(meal_type IN ('breakfast','lunch','dinner','snack')),
  description TEXT,
  skipped     INTEGER NOT NULL DEFAULT 0,
  log_id      INTEGER,
  logged_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (log_id) REFERENCES logs(id)
);

CREATE INDEX IF NOT EXISTS idx_meal_logs_patient_id ON meal_logs(patient_id);

CREATE TABLE IF NOT EXISTS daily_reports (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id               INTEGER NOT NULL,
  client_patient_id        TEXT,
  report_type              TEXT    NOT NULL CHECK(report_type IN ('morning','night')),
  bed_time                 TEXT,
  wake_time                TEXT,
  sleep_quality            TEXT,
  wake_ups                 INTEGER,
  felt_rested              INTEGER,
  meals_count              INTEGER,
  meals_note               TEXT,
  notes                    TEXT,
  updated_at               TEXT    NOT NULL DEFAULT (datetime('now')),
  edit_count               INTEGER NOT NULL DEFAULT 0,
  suspicious_edit_count    INTEGER NOT NULL DEFAULT 0,
  reliability_level        TEXT    NOT NULL DEFAULT 'High',
  crisis_level             TEXT    NOT NULL DEFAULT 'none',
  crisis_summary           TEXT,
  legacy_log_id            INTEGER UNIQUE,
  created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (legacy_log_id) REFERENCES logs(id)
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_patient_id ON daily_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_created_at ON daily_reports(created_at);

CREATE TABLE IF NOT EXISTS weekly_screenings (
  id                              INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id                      INTEGER NOT NULL,
  client_patient_id               TEXT,
  wished_dead                     INTEGER NOT NULL DEFAULT 0,
  family_better_off_dead          INTEGER NOT NULL DEFAULT 0,
  thoughts_killing_self           INTEGER NOT NULL DEFAULT 0,
  thoughts_killing_self_frequency TEXT,
  ever_tried_to_kill_self         INTEGER NOT NULL DEFAULT 0,
  attempt_timing                  TEXT    NOT NULL DEFAULT 'none',
  current_thoughts                INTEGER,
  depressed_hard_to_function      INTEGER NOT NULL DEFAULT 0,
  depressed_frequency             TEXT,
  anxious_on_edge                 INTEGER NOT NULL DEFAULT 0,
  anxious_frequency               TEXT,
  hopeless                        INTEGER NOT NULL DEFAULT 0,
  could_not_enjoy_things          INTEGER NOT NULL DEFAULT 0,
  keeping_to_self                 INTEGER NOT NULL DEFAULT 0,
  more_irritable                  INTEGER NOT NULL DEFAULT 0,
  substance_use_more_than_usual   INTEGER NOT NULL DEFAULT 0,
  substance_use_frequency         TEXT,
  sleep_trouble                   INTEGER NOT NULL DEFAULT 0,
  sleep_trouble_frequency         TEXT,
  appetite_change                 INTEGER NOT NULL DEFAULT 0,
  appetite_change_direction       TEXT,
  support_person                  TEXT,
  reasons_for_living              TEXT,
  coping_plan                     TEXT,
  needs_help_staying_safe         INTEGER,
  updated_at                      TEXT    NOT NULL DEFAULT (datetime('now')),
  edit_count                      INTEGER NOT NULL DEFAULT 0,
  suspicious_edit_count           INTEGER NOT NULL DEFAULT 0,
  reliability_level               TEXT    NOT NULL DEFAULT 'High',
  crisis_level                    TEXT    NOT NULL DEFAULT 'none',
  crisis_summary                  TEXT,
  legacy_log_id                   INTEGER UNIQUE,
  created_at                      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (legacy_log_id) REFERENCES logs(id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_screenings_patient_id ON weekly_screenings(patient_id);
CREATE INDEX IF NOT EXISTS idx_weekly_screenings_created_at ON weekly_screenings(created_at);

CREATE TABLE IF NOT EXISTS observations (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id               INTEGER NOT NULL,
  client_patient_id        TEXT,
  observation_type         TEXT    NOT NULL CHECK(observation_type IN ('Clinical','Behavioral','Progress','Recommendation','Alert')),
  observation              TEXT    NOT NULL,
  priority                 TEXT    NOT NULL CHECK(priority IN ('Low','Medium','High','Critical','Urgent')),
  support_worker_name      TEXT    NOT NULL,
  linked_entity_type       TEXT,
  linked_entity_id         INTEGER,
  system_generated         INTEGER NOT NULL DEFAULT 0,
  status                   TEXT    NOT NULL DEFAULT 'open' CHECK(status IN ('open','acknowledged')),
  ownership_note           TEXT,
  acknowledged_by_user_id  INTEGER,
  acknowledged_by_name     TEXT,
  acknowledged_at          TEXT,
  created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (acknowledged_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_observations_patient_id ON observations(patient_id);
CREATE INDEX IF NOT EXISTS idx_observations_linked ON observations(linked_entity_type, linked_entity_id);
CREATE INDEX IF NOT EXISTS idx_observations_status ON observations(status);
CREATE INDEX IF NOT EXISTS idx_observations_created_at ON observations(created_at);

CREATE TABLE IF NOT EXISTS care_plans (
  patient_id                  INTEGER PRIMARY KEY,
  client_patient_id           TEXT,
  goals                       TEXT,
  triggers                    TEXT,
  warning_signs               TEXT,
  what_helps                  TEXT,
  support_contacts            TEXT,
  preferred_follow_up_notes   TEXT,
  updated_by                  TEXT NOT NULL,
  created_at                  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS risk_scores (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id    INTEGER NOT NULL,
  score         REAL    NOT NULL,
  level         TEXT    NOT NULL CHECK(level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  factors       TEXT,
  calculated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE INDEX IF NOT EXISTS idx_risk_scores_patient_id ON risk_scores(patient_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_calculated ON risk_scores(patient_id, calculated_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id   INTEGER NOT NULL,
  type         TEXT    NOT NULL CHECK(type IN ('crisis','mismatch')),
  message      TEXT    NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE INDEX IF NOT EXISTS idx_alerts_patient_id ON alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);

CREATE TABLE IF NOT EXISTS access_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  patient_id  INTEGER,
  action      TEXT    NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  accessed_at TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE INDEX IF NOT EXISTS idx_access_log_user_id ON access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_access_log_patient_id ON access_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_access_log_accessed ON access_log(accessed_at);
