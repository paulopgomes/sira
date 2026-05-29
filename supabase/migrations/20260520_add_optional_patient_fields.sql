-- Migration to add optional fields to patients: admission_date, death_date, phone_1, phone_2, dependency_degree, termination_date
ALTER TABLE patients ADD COLUMN IF NOT EXISTS admission_date DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS death_date DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone_1 TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone_2 TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS dependency_degree TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS termination_date DATE;
