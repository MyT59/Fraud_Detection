-- Default baseline fraud pattern for the examination revision.
-- Run once against an existing FDS database. The application UI may also be
-- used to create the same configuration.
--
-- The current transaction is included in tx_count, so this triggers on the
-- third transaction for one account inside a five-minute window.
INSERT INTO fraud_patterns (
    pattern_name, service_source, pattern_category, pattern_rules,
    action, risk_score, priority, pattern_source, is_active, is_deleted
)
SELECT
    'Rapid Transaction Velocity',
    'ALL',
    'Transaction Velocity',
    '{"logic":"AND","time_window_minutes":5,"conditions":[{"field":"tx_count","operator":">=","value":3}]}'::jsonb,
    'FLAG', 60, 8, 'MANUAL_CREATE', TRUE, FALSE
WHERE NOT EXISTS (
    SELECT 1
    FROM fraud_patterns
    WHERE pattern_name = 'Rapid Transaction Velocity'
      AND service_source = 'ALL'
      AND is_deleted = FALSE
);
