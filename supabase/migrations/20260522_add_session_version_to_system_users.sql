-- Migration to add session_version to system_users to allow force logout of all devices / logins
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS session_version INTEGER DEFAULT 1;
