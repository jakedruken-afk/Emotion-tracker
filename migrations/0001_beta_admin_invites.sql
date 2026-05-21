CREATE TABLE IF NOT EXISTS app_admins (
  user_id            INTEGER PRIMARY KEY,
  created_by_user_id INTEGER,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

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
