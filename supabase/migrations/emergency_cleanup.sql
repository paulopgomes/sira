-- Script de Emergência para Remover TODAS as restrições de unicidade da tabela patients
-- Execute no "SQL Editor" do seu painel Supabase

DO $$ 
BEGIN
    -- 1. Remove restrições globais
    ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_record_number_key;
    ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_cpf_key;
    ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_sus_card_key;
    
    -- 2. Remove índices únicos
    DROP INDEX IF EXISTS idx_patients_record_number_unique;
    DROP INDEX IF EXISTS idx_patients_cpf_unique;
    DROP INDEX IF EXISTS idx_patients_sus_card_unique;
    
    -- 3. Remove restrições por unidade (compostas)
    ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_unit_record_number_key;
    ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_unit_cpf_key;
    ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_unit_sus_card_key;
END $$;

-- Opcional: Se desejar garantir que apenas o Prontuário seja único POR UNIDADE, descomente a linha abaixo:
-- ALTER TABLE patients ADD CONSTRAINT patients_unit_record_number_key UNIQUE (unit_id, record_number);
