-- Script de Atualização para adicionar colunas faltantes
-- Execute este código no SQL Editor do Supabase para corrigir o erro de colunas não encontradas.

-- 1. Atualização da tabela de Projetos
ALTER TABLE projects ADD COLUMN IF NOT EXISTS coordinator TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date DATE;

-- 2. Atualização da tabela de Modalidades
ALTER TABLE modalities ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Atualização da tabela de Usuários (Patients)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS cid_primary TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS cid_secondary TEXT;

-- 4. Garantir que CPF e SUS sejam únicos (opcional, mas recomendado)
-- Nota: Isso pode falhar se já houver dados duplicados.
-- ALTER TABLE patients ADD CONSTRAINT patients_cpf_key UNIQUE (cpf);
-- ALTER TABLE patients ADD CONSTRAINT patients_sus_card_key UNIQUE (sus_card);

-- 5. Recarregar o cache do PostgREST (Schema Cache)
-- O Supabase faz isso automaticamente após alterações de DDL, 
-- mas se o erro persistir, tente recarregar a página do painel do Supabase.
