-- REMOÇÃO TOTAL E DEFINITIVA DE TODAS AS TRAVAS DE DUPLICIDADE NA TABELA PATIENTS
-- Respeita a Chave Primária (PKEY) para evitar erros de sistema.

DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 1. Remove TODAS as constraints do tipo UNIQUE ('u') da tabela patients (EXCETO PKEY)
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'patients'::regclass 
        AND contype = 'u'
        AND conname NOT LIKE '%_pkey'
    ) LOOP
        EXECUTE 'ALTER TABLE patients DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE';
        RAISE NOTICE 'Constraint drop: %', r.conname;
    END LOOP;

    -- 2. Remove TODOS os índices únicos da tabela patients (EXCETO PKEY)
    FOR r IN (
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'patients' 
        AND indexdef LIKE 'CREATE UNIQUE INDEX%'
        AND indexname NOT LIKE '%_pkey'
    ) LOOP
        EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(r.indexname) || ' CASCADE';
        RAISE NOTICE 'Index drop: %', r.indexname;
    END LOOP;
END $$;

-- 3. Garante que os campos permitam nulos se necessário
ALTER TABLE patients ALTER COLUMN cpf DROP NOT NULL;
ALTER TABLE patients ALTER COLUMN sus_card DROP NOT NULL;

-- OPCIONAL: Se quiser que o número de prontuário seja único PELO MENOS dentro da mesma unidade:
-- ALTER TABLE patients ADD CONSTRAINT patients_unit_record_number_key UNIQUE (unit_id, record_number);
