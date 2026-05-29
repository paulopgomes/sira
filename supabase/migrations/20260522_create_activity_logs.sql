-- Migration to create activity_logs table for audit trail
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL, -- 'LOGIN', 'LOGOUT', 'CREATION', 'EDITION', 'DELETION', 'ARCHIVE', 'RESTORE', 'VIEW'
    timestamp TIMESTAMPTZ DEFAULT now(),
    username TEXT NOT NULL,
    user_id UUID,
    ip_device TEXT,
    module TEXT NOT NULL, -- 'usuarios', 'profissionais', 'projetos', 'modalidades', 'unidades', 'pacientes', 'atendimentos', 'relatorio'
    unit_name TEXT, -- Optional unit associated with log
    previous_values JSONB,
    new_values JSONB,
    status TEXT NOT NULL, -- 'Sucesso', 'Falha'
    details TEXT
);

-- Enable RLS and add a permissive policy for testing and system usage
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    EXECUTE 'CREATE POLICY "Allow all activity logs" ON activity_logs FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;
