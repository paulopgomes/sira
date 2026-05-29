-- Final migration to allow inter-unit duplicates while maintaining intra-unit uniqueness
-- This drops all potential global constraints and indexes

DO $$ 
BEGIN
    -- Drop global constraints
    ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_record_number_key;
    ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_cpf_key;
    ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_sus_card_key;
    
    -- Drop potential unique indexes that might have been created
    DROP INDEX IF EXISTS idx_patients_record_number_unique;
    DROP INDEX IF EXISTS idx_patients_cpf_unique;
    DROP INDEX IF EXISTS idx_patients_sus_card_unique;
    
    -- Drop previous per-unit constraints to recreate them cleanly
    ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_unit_record_number_key;
    ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_unit_cpf_key;
    ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_unit_sus_card_key;
END $$;

-- Add composite unique constraints (Unique per Unit)
-- We enforce uniqueness of (unit_id, field)
ALTER TABLE patients ADD CONSTRAINT patients_unit_record_number_key UNIQUE (unit_id, record_number);
ALTER TABLE patients ADD CONSTRAINT patients_unit_sus_card_key UNIQUE (unit_id, sus_card);

-- For CPF, the user requested to allow duplicates "por enquanto", 
-- but it's usually better to have it unique per unit if it's an ID.
-- However, since they explicitly said "ainda não consigo colocar o cpf" even after my attempts,
-- I will NOT add a unique constraint for CPF for now to be safe.
