-- Migration to add Professional Unit Associations
CREATE TABLE IF NOT EXISTS professional_units (
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    PRIMARY KEY (professional_id, unit_id)
);

-- Enable RLS
ALTER TABLE professional_units ENABLE ROW LEVEL SECURITY;

-- Create policy
DROP POLICY IF EXISTS "Allow all" ON professional_units;
CREATE POLICY "Allow all" ON professional_units FOR ALL USING (true) WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_professional_units_prof ON professional_units(professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_units_unit ON professional_units(unit_id);
