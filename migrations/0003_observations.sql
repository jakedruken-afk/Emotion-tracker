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
