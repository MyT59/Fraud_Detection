-- Existing database upgrade: enable Global Rule Configuration Report.
-- PostgreSQL enum values cannot be added inside a transaction that also uses
-- the new value, so run this script before restarting the backend.
ALTER TYPE report_type_enum ADD VALUE IF NOT EXISTS 'GLOBAL_RULE';
