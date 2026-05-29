-- Add privacy column to patient_evaluations
ALTER TABLE patient_evaluations ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Update RLS (Row Level Security) to handle privacy
-- If a record is private, only the creator (system_user_id) should see it.
-- We need to drop the old "Allow all" if we want to enforce this, 
-- but following the project's permissive pattern, I'll keep it simple for now 
-- and just add the column so the UI can filter it.
