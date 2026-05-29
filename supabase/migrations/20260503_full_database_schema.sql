-- SIRA (Sistema Integrado de Registro de Atendimentos) - Full Consolidated Schema
-- This script contains all tables, relationships, and constraints for the SIRA application.

-- 1. Unidades (Units)
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    cnpj TEXT,
    status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Usuários do Sistema (System Users)
CREATE TABLE IF NOT EXISTS system_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    permission TEXT NOT NULL CHECK (permission IN ('Administrador', 'Profissional')),
    status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Vínculo Usuário-Unidade (Set de permissões)
CREATE TABLE IF NOT EXISTS system_user_units (
    system_user_id UUID REFERENCES system_users(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    PRIMARY KEY (system_user_id, unit_id)
);

-- 4. Projetos (Projects)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    coordinator TEXT,
    start_date DATE,
    end_date DATE,
    object TEXT,
    observations TEXT,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Modalidades (Modalities)
CREATE TABLE IF NOT EXISTS modalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Metas de Projeto (Project Goals)
CREATE TABLE IF NOT EXISTS project_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    modality_id UUID REFERENCES modalities(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('monthly', 'total')),
    target_value INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Prorrogações de Projeto (Project Extensions)
CREATE TABLE IF NOT EXISTS project_extensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    previous_end_date DATE NOT NULL,
    new_end_date DATE NOT NULL,
    reason TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Profissionais (Professionals)
CREATE TABLE IF NOT EXISTS professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    specialty TEXT, -- "Função" no sistema
    registration TEXT UNIQUE NOT NULL,
    cpf TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Vínculos de Profissionais
CREATE TABLE IF NOT EXISTS professional_projects (
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    PRIMARY KEY (professional_id, project_id)
);

CREATE TABLE IF NOT EXISTS professional_modalities (
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    modality_id UUID REFERENCES modalities(id) ON DELETE CASCADE,
    PRIMARY KEY (professional_id, modality_id)
);

CREATE TABLE IF NOT EXISTS professional_units (
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    PRIMARY KEY (professional_id, unit_id)
);

-- 10. Pacientes/Usuários de Atendimento (Patients)
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    record_number TEXT UNIQUE NOT NULL,
    birth_date DATE,
    gender TEXT,
    cpf TEXT UNIQUE,
    sus_card TEXT UNIQUE,
    cid_primary TEXT,
    cid_secondary TEXT,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Atendimentos (Attendance)
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    modality_id UUID REFERENCES modalities(id) ON DELETE CASCADE,
    day INTEGER NOT NULL CHECK (day >= 1 AND day <= 31),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_user_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE modalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_modalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Security Policies (simplified "Allow all" for the current app context)
-- In a real production with Supabase Auth, these would be based on auth.uid() and role checks.
DO $$ 
BEGIN
    EXECUTE 'CREATE POLICY "Allow all" ON units FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all" ON system_users FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all" ON system_user_units FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all" ON projects FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all" ON project_goals FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all" ON project_extensions FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all" ON modalities FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all" ON professionals FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all" ON professional_projects FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all" ON professional_modalities FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all" ON professional_units FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all" ON patients FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Allow all" ON attendance FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;

-- Storage Setup for Logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ 
BEGIN
    CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'images');
    CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'images');
    CREATE POLICY "Public Update" ON storage.objects FOR UPDATE USING (bucket_id = 'images');
    CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING (bucket_id = 'images');
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(year, month, day);
CREATE INDEX IF NOT EXISTS idx_attendance_patient ON attendance(patient_id);
CREATE INDEX IF NOT EXISTS idx_attendance_professional ON attendance(professional_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_patients_record ON patients(record_number);
CREATE INDEX IF NOT EXISTS idx_patients_unit ON patients(unit_id);
CREATE INDEX IF NOT EXISTS idx_projects_unit ON projects(unit_id);
CREATE INDEX IF NOT EXISTS idx_project_goals_project ON project_goals(project_id);
CREATE INDEX IF NOT EXISTS idx_project_goals_modality ON project_goals(modality_id);
CREATE INDEX IF NOT EXISTS idx_professional_units_prof ON professional_units(professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_units_unit ON professional_units(unit_id);
CREATE INDEX IF NOT EXISTS idx_system_user_units_user ON system_user_units(system_user_id);
