-- Migration to remove unique constraint for CPF as requested
-- This allows duplicate CPFs across the system or within units
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_unit_cpf_key;
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_cpf_key;
