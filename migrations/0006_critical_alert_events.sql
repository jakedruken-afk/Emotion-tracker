CREATE TABLE IF NOT EXISTS critical_alert_events (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_key           TEXT    NOT NULL,
  patient_id          INTEGER NOT NULL,
  user_id             INTEGER NOT NULL,
  observation_id      INTEGER,
  linked_entity_type  TEXT,
  linked_entity_id    INTEGER,
  action              TEXT    NOT NULL CHECK(action IN ('viewed','opened','dismissed','snoozed','acknowledged')),
  note                TEXT,
  snoozed_until       TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (patient_id)     REFERENCES patients(id),
  FOREIGN KEY (user_id)        REFERENCES users(id),
  FOREIGN KEY (observation_id) REFERENCES observations(id)
);

CREATE INDEX IF NOT EXISTS idx_critical_alert_events_user_alert
  ON critical_alert_events(user_id, alert_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_critical_alert_events_patient_id
  ON critical_alert_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_critical_alert_events_observation_id
  ON critical_alert_events(observation_id);

INSERT INTO critical_alert_events (
  alert_key,
  patient_id,
  user_id,
  observation_id,
  linked_entity_type,
  linked_entity_id,
  action,
  note,
  created_at
)
SELECT
  'observation:' || observations.id,
  observations.patient_id,
  observations.acknowledged_by_user_id,
  observations.id,
  COALESCE(observations.linked_entity_type, 'observation'),
  COALESCE(observations.linked_entity_id, observations.id),
  'acknowledged',
  observations.ownership_note,
  COALESCE(observations.acknowledged_at, datetime('now'))
FROM observations
WHERE observations.acknowledged_by_user_id IS NOT NULL
  AND observations.acknowledged_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM critical_alert_events
    WHERE critical_alert_events.observation_id = observations.id
      AND critical_alert_events.action = 'acknowledged'
  );
