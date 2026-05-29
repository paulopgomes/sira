-- SIRA (Sistema Integrado de Registro de Atendimentos) - Consolidated Schema
-- This file contains the complete database structure, including all recent updates.

-- 1. System Users
CREATE TABLE IF NOT EXISTS system_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    permission TEXT NOT NULL CHECK (permission IN ('Administrador', 'Profissional')),
    status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    coordinator TEXT,
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Modalities
CREATE TABLE IF NOT EXISTS modalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Professionals
CREATE TABLE IF NOT EXISTS professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    specialty TEXT, -- Used as "Função" in the UI
    registration TEXT UNIQUE NOT NULL,
    cpf TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Professional-Project Relationship
CREATE TABLE IF NOT EXISTS professional_projects (
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    PRIMARY KEY (professional_id, project_id)
);

-- 6. Professional-Modality Relationship
CREATE TABLE IF NOT EXISTS professional_modalities (
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    modality_id UUID REFERENCES modalities(id) ON DELETE CASCADE,
    PRIMARY KEY (professional_id, modality_id)
);

-- 7. Patients (Usuários)
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    record_number TEXT UNIQUE NOT NULL, -- Formatted as 000 in UI
    birth_date DATE,
    gender TEXT,
    cpf TEXT UNIQUE,
    sus_card TEXT UNIQUE,
    cid_primary TEXT,
    cid_secondary TEXT,
    status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Attendance
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

-- Enable Row Level Security (RLS)
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE modalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_modalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Create basic policies (Allow all for simplified access control within the app)
DROP POLICY IF EXISTS "Allow all" ON system_users;
CREATE POLICY "Allow all" ON system_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON projects;
CREATE POLICY "Allow all" ON projects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON modalities;
CREATE POLICY "Allow all" ON modalities FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON professionals;
CREATE POLICY "Allow all" ON professionals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON professional_projects;
CREATE POLICY "Allow all" ON professional_projects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON professional_modalities;
CREATE POLICY "Allow all" ON professional_modalities FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON patients;
CREATE POLICY "Allow all" ON patients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all" ON attendance;
CREATE POLICY "Allow all" ON attendance FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(year, month, day);
CREATE INDEX IF NOT EXISTS idx_attendance_patient ON attendance(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_patients_record ON patients(record_number);
