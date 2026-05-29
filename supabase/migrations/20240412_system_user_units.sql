-- Migration to add System User Unit Permissions
CREATE TABLE IF NOT EXISTS system_user_units (
    system_user_id UUID REFERENCES system_users(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    PRIMARY KEY (system_user_id, unit_id)
);

-- Enable RLS
ALTER TABLE system_user_units ENABLE ROW LEVEL SECURITY;

-- Create policy
DROP POLICY IF EXISTS "Allow all" ON system_user_units;
CREATE POLICY "Allow all" ON system_user_units FOR ALL USING (true) WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_system_user_units_user ON system_user_units(system_user_id);
