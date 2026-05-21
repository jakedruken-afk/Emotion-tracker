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
