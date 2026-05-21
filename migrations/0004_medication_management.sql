ALTER TABLE medications ADD COLUMN purpose TEXT;
ALTER TABLE medications ADD COLUMN side_effects TEXT;
ALTER TABLE medications ADD COLUMN adherence_notes TEXT;
ALTER TABLE medications ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE medications ADD COLUMN updated_by TEXT;
ALTER TABLE medications ADD COLUMN updated_at TEXT;

UPDATE medications
SET updated_by = COALESCE(updated_by, 'Unknown'),
    updated_at = COALESCE(updated_at, created_at);

CREATE INDEX IF NOT EXISTS idx_medications_active ON medications(patient_id, is_active, updated_at);
