-- Migration to allow duplicate CPF and sus_card in different units
-- Drop the global unique constraints
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_cpf_key;
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_sus_card_key;

-- Add composite unique constraints on (unit_id, field)
-- This ensures that these fields are unique within each unit, 
-- but can be duplicated across different units.
ALTER TABLE patients ADD CONSTRAINT patients_unit_cpf_key UNIQUE (unit_id, cpf);
ALTER TABLE patients ADD CONSTRAINT patients_unit_sus_card_key UNIQUE (unit_id, sus_card);
