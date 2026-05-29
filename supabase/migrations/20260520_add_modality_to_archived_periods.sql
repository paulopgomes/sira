-- Migration to add modality_id to archived_periods to support archiving by professional modality
ALTER TABLE archived_periods ADD COLUMN IF NOT EXISTS modality_id UUID REFERENCES modalities(id) ON DELETE CASCADE;

-- Update unique constraint to encompass modality_id, allowing independent archiving of different modalities in the same unit
ALTER TABLE archived_periods DROP CONSTRAINT IF EXISTS archived_periods_month_year_unit_id_key;

-- Create the new unique constraint
ALTER TABLE archived_periods ADD CONSTRAINT archived_periods_month_year_unit_id_modality_id_key UNIQUE (month, year, unit_id, modality_id);
