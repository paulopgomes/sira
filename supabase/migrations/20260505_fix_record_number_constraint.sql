-- Migration to allow duplicate record_number in different units
-- Drop the global unique constraint on record_number
-- The default name for this constraint is usually patients_record_number_key
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_record_number_key;

-- Add a composite unique constraint on (unit_id, record_number)
-- This ensures that record_number is unique within each unit, 
-- but can be duplicated across different units.
ALTER TABLE patients ADD CONSTRAINT patients_unit_record_number_key UNIQUE (unit_id, record_number);
