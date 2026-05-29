-- Migration to add deleted_at column to patient_evaluations for soft delete functionality
ALTER TABLE patient_evaluations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
