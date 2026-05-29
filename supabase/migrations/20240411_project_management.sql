-- Migration to support Strategic Project Management

-- 1. Add new columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS object TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS observations TEXT;

-- 2. Create project_goals table
CREATE TABLE IF NOT EXISTS project_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('monthly', 'total')),
    target_value INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create project_extensions table
CREATE TABLE IF NOT EXISTS project_extensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    previous_end_date DATE NOT NULL,
    new_end_date DATE NOT NULL,
    reason TEXT,
    created_by TEXT, -- Username or ID
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE project_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_extensions ENABLE ROW LEVEL SECURITY;

-- 5. Create policies
DROP POLICY IF EXISTS "Allow all" ON project_goals;
CREATE POLICY "Allow all" ON project_goals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON project_extensions;
CREATE POLICY "Allow all" ON project_extensions FOR ALL USING (true) WITH CHECK (true);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_project_goals_project ON project_goals(project_id);
CREATE INDEX IF NOT EXISTS idx_project_extensions_project ON project_extensions(project_id);
