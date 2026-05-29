-- Migration to add patient_evaluations table
CREATE TABLE IF NOT EXISTS patient_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    system_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE patient_evaluations ENABLE ROW LEVEL SECURITY;

-- Allow all policy (following the project pattern)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'patient_evaluations' 
        AND policyname = 'Allow all'
    ) THEN
        CREATE POLICY "Allow all" ON patient_evaluations FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_patient_evaluations_patient ON patient_evaluations(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_evaluations_unit ON patient_evaluations(unit_id);
CREATE INDEX IF NOT EXISTS idx_patient_evaluations_date ON patient_evaluations(date);
CREATE INDEX IF NOT EXISTS idx_patient_evaluations_user ON patient_evaluations(system_user_id);
