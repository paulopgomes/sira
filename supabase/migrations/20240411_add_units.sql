-- Migration to add Units (Unidades) support
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

-- Create policy
DROP POLICY IF EXISTS "Allow all" ON units;
CREATE POLICY "Allow all" ON units FOR ALL USING (true) WITH CHECK (true);

-- Add unit_id to patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units(id) ON DELETE SET NULL;

-- Add unit_id to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_patients_unit ON patients(unit_id);
CREATE INDEX IF NOT EXISTS idx_projects_unit ON projects(unit_id);
