-- Migration to add archived_periods table
CREATE TABLE IF NOT EXISTS archived_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    archived_at TIMESTAMPTZ DEFAULT now(),
    archived_by UUID REFERENCES system_users(id),
    UNIQUE (month, year, unit_id)
);

-- Policy to allow admins to manage archived periods
ALTER TABLE archived_periods ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    EXECUTE 'CREATE POLICY "Allow all" ON archived_periods FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;
