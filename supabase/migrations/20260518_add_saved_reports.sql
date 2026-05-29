-- Migration to add saved_reports table for custom reports
CREATE TABLE IF NOT EXISTS saved_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    report_type TEXT NOT NULL,
    filters JSONB DEFAULT '{}'::jsonb,
    system_user_id UUID REFERENCES system_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

-- Allow all policy (following the project pattern)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'saved_reports' 
        AND policyname = 'Allow all'
    ) THEN
        CREATE POLICY "Allow all" ON saved_reports FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_saved_reports_user ON saved_reports(system_user_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_type ON saved_reports(report_type);
