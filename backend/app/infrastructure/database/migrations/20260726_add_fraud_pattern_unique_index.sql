-- Fraud Pattern migration for an EXISTING PostgreSQL database.
--
-- Safe properties:
--   * Does not delete or alter fraud-pattern records.
--   * Stops before the index is created if active duplicate rules already exist.
--   * May be run repeatedly; the index creation is idempotent.
--
-- Run with psql while the application is stopped or in maintenance mode:
--   psql "$DATABASE_URL" -f backend/app/infrastructure/database/migrations/20260726_add_fraud_pattern_unique_index.sql

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.fraud_patterns
        WHERE is_deleted = FALSE
          AND rules_hash IS NOT NULL
        GROUP BY service_source, rules_hash
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION USING
            MESSAGE = 'Migration stopped: active fraud_patterns with the same service_source and rules_hash already exist.',
            HINT = 'Review the duplicate rows with the query below. Keep one pattern and soft-delete or change the others, then rerun this migration.';
    END IF;
END $$;

-- Diagnostic query to run manually only if the migration reports duplicates:
-- SELECT service_source, rules_hash, array_agg(id ORDER BY id) AS pattern_ids,
--        array_agg(pattern_name ORDER BY id) AS pattern_names
-- FROM public.fraud_patterns
-- WHERE is_deleted = FALSE AND rules_hash IS NOT NULL
-- GROUP BY service_source, rules_hash
-- HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fraud_patterns_service_rules_hash_active
    ON public.fraud_patterns (service_source, rules_hash)
    WHERE is_deleted = FALSE AND rules_hash IS NOT NULL;
