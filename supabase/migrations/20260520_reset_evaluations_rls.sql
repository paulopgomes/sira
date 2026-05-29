-- Migration to reset Row Level Security (RLS) on patient_evaluations table
-- Restores the standard permissive policy for application-level control

-- 1. Ensure RLS is enabled
ALTER TABLE patient_evaluations ENABLE ROW LEVEL SECURITY;

-- 2. Drop any conflicting or restrictive policies
DROP POLICY IF EXISTS "Allow all" ON patient_evaluations;
DROP POLICY IF EXISTS "Select policy with privacy" ON patient_evaluations;
DROP POLICY IF EXISTS "All standard writes" ON patient_evaluations;

-- 3. Recreate the permissive "Allow all" policy so that client-side security / custom sessions function correctly
CREATE POLICY "Allow all" ON patient_evaluations FOR ALL USING (true) WITH CHECK (true);
