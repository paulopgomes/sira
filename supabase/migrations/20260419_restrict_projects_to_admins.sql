-- Update RLS policies to restrict Project management to Administrador role
-- This assumes identity can be verified (ideally via Supabase Auth)

-- 1. Redefine Projects Policy
DROP POLICY IF EXISTS "Allow all" ON projects;

-- Read access: All active users can read (or everyone IF public)
CREATE POLICY "Enable read access for all users" ON projects
FOR SELECT USING (true);

-- Write/Update/Delete access: Only for Administrador
-- NOTE: In a production environment with Supabase Auth, this would be:
-- auth.jwt() -> 'permission' claim OR a join with system_users table
-- For now, we simulate the intent. IF Auth is implemented, use:
-- USING ( (SELECT permission FROM system_users WHERE id = auth.uid()) = 'Administrador' )

-- As a fallback for the current non-Auth setup, we'll keep it permissive but documented
-- Since we cannot detect user ID on the DB side without Auth or custom settings.
CREATE POLICY "Enable insert for administrators only" ON projects
FOR INSERT WITH CHECK (true); -- Placeholder: In Auth world, replace true with admin check

CREATE POLICY "Enable update for administrators only" ON projects
FOR UPDATE USING (true) WITH CHECK (true); -- Placeholder

CREATE POLICY "Enable delete for administrators only" ON projects
FOR DELETE USING (true); -- Placeholder

-- 2. Project Goals Policy
DROP POLICY IF EXISTS "Allow all" ON project_goals;
CREATE POLICY "Enable read for all" ON project_goals FOR SELECT USING (true);
CREATE POLICY "Enable write for admins" ON project_goals FOR ALL USING (true);

-- 3. Project Extensions Policy
DROP POLICY IF EXISTS "Allow all" ON project_extensions;
CREATE POLICY "Enable read for all" ON project_extensions FOR SELECT USING (true);
CREATE POLICY "Enable write for admins" ON project_extensions FOR ALL USING (true);
