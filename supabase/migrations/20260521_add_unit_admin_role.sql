-- Migration to allow 'Administrador por Unidade' as a permission role in system_users
ALTER TABLE system_users DROP CONSTRAINT IF EXISTS system_users_permission_check;
ALTER TABLE system_users ADD CONSTRAINT system_users_permission_check CHECK (permission IN ('Administrador', 'Profissional', 'Administrador por Unidade'));
