-- ==========================================
-- 0. EXTENSIONS 
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. ENUM TYPES
-- ==========================================
CREATE TYPE blacklist_type_enum AS ENUM ( 
    'USER_ID', 'CUSTOMER_ID', 'ACCOUNT_NUMBER', 'DEVICE_ID', 
    'TERMINAL_ID', 'IP_ADDRESS', 'MERCHANT_ID', 'INVOICE_NUMBER', 
    'RRN', 'PAYMENT_CODE', 'BILLER_ID', 'CUSTOMER_PHONE', 
    'CUSTOMER_EMAIL', 'VIRTUAL_ACCOUNT_NUMBER'
);

CREATE TYPE transaction_status_enum AS ENUM ( 
    'PENDING', 'UNDER_REVIEW', 'SAFE', 'FRAUD'
);

CREATE TYPE alert_status_enum AS ENUM ( 
    'OPEN', 'IN_PROGRESS', 'RESOLVED', 'REOPENED', 'OVERRIDDEN'
);

CREATE TYPE review_decision_enum AS ENUM (
    'SAFE', 'FRAUD'
);

CREATE TYPE report_format_enum AS ENUM (
    'PDF', 'XLSX', 'CSV'
);

CREATE TYPE report_status_enum AS ENUM (
    'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
);

CREATE TYPE report_type_enum AS ENUM (
    'FRAUD_DETECTION', 'TRANSACTION', 'MANUAL_REVIEW', 'ALERT', 'BLACKLIST', 'ACTIVITY_LOG', 'ML_PERFORMANCE'
);

CREATE TYPE pattern_source_enum AS ENUM (
    'MANUAL_CREATE', 'MANUAL_REVIEW', 'RETRAIN_ML', 'AI_DISCOVERY'
);

-- ==========================================
-- 2. ROLES, ADMINS, SESSIONS & PREFERENCES
-- ==========================================
CREATE TABLE public.roles ( 
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE public.admins ( 
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL,
    department VARCHAR(100),
    created_by INTEGER,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_password_temporary BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by INTEGER,

    CONSTRAINT fk_admin_role FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT,
    CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES public.admins(id) ON DELETE SET NULL,
    CONSTRAINT fk_deleted_by_admin FOREIGN KEY (deleted_by) REFERENCES public.admins(id) ON DELETE SET NULL
);

CREATE TABLE public.user_sessions ( 
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    device VARCHAR(100) DEFAULT 'Unknown Device',
    browser VARCHAR(50) DEFAULT 'Unknown',
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT fk_session_admin FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON DELETE CASCADE
);

CREATE TABLE public.notification_preferences ( 
    id SERIAL PRIMARY KEY,
    admin_id INTEGER UNIQUE NOT NULL,
    fraud_alerts_enabled BOOLEAN DEFAULT TRUE,
    push_notifications_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notif_prefs_admin FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON DELETE CASCADE
);

-- ==========================================
-- 3. LOGS & BLACKLIST
-- ==========================================
CREATE TABLE public.activity_logs ( 
    id BIGSERIAL PRIMARY KEY,
    admin_id INTEGER,
    action_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(100),
    target_id VARCHAR(100),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_id INTEGER,
    module_source VARCHAR(50) DEFAULT 'SYSTEM',
    severity VARCHAR(20) DEFAULT 'INFO',
    ip_address VARCHAR(50),
    device VARCHAR(100),
    browser VARCHAR(100),

    CONSTRAINT fk_activity_admin FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON DELETE SET NULL, 
    CONSTRAINT fk_activity_session FOREIGN KEY (session_id) REFERENCES public.user_sessions(id) ON DELETE SET NULL
);

CREATE TABLE public.blacklist_items ( 
    id SERIAL PRIMARY KEY,
    value VARCHAR(255) NOT NULL,
    type blacklist_type_enum NOT NULL,
    service_scope VARCHAR(50) DEFAULT 'ALL',
    reason TEXT NOT NULL,
    added_by INTEGER,
    source VARCHAR(20) DEFAULT 'MANUAL',
    hit_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING',
    is_active BOOLEAN DEFAULT TRUE,
    review_note TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
    CONSTRAINT fk_blacklist_admin FOREIGN KEY (added_by) REFERENCES public.admins(id) ON DELETE SET NULL, 
    CONSTRAINT uq_blacklist_type_value_service UNIQUE (type, value, service_scope),
    CONSTRAINT chk_value_not_empty CHECK (value <> '')
);

-- ==========================================
-- 4. ML OPS: DATASETS & MODELS
-- ==========================================
CREATE TABLE public.ml_datasets ( 
    id SERIAL PRIMARY KEY,
    domain VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    checksum_sha256 CHAR(64) UNIQUE NOT NULL, 
    file_size_bytes BIGINT,
    row_count INTEGER,
    uploaded_by INTEGER,
    is_used_for_training BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ml_datasets_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.admins(id) ON DELETE SET NULL
);

CREATE TABLE public.ml_models ( 
    id SERIAL PRIMARY KEY,
    version_name VARCHAR(100) UNIQUE NOT NULL,
    target_service VARCHAR(100) NOT NULL,
    file_path TEXT NOT NULL,
    metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- ==========================================
-- 5. ML RETRAIN MODULE TABLES
-- ==========================================
CREATE TABLE public.retrain_schedules ( 
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cron_expr VARCHAR(100) NOT NULL,
    domain VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    last_run_status VARCHAR(20),
    created_by INTEGER, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT retrain_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admins(id) ON DELETE SET NULL
);

CREATE TABLE public.retrain_history (
    id SERIAL PRIMARY KEY,
    schedule_id UUID,
    dataset_id INTEGER,
    model_id INTEGER,
    execution_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    trigger_source VARCHAR(50),
    triggered_by INTEGER, 
    status VARCHAR(20),
    anomalies_found INTEGER,
    new_patterns_count INTEGER,
    trigger_metadata JSONB DEFAULT '{}'::jsonb,
    log_details JSONB,
    model_version VARCHAR(50),

    CONSTRAINT retrain_history_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.retrain_schedules(id) ON DELETE SET NULL,
    CONSTRAINT retrain_history_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.ml_models(id) ON DELETE SET NULL,
    CONSTRAINT retrain_history_triggered_by_fkey FOREIGN KEY (triggered_by) REFERENCES public.admins(id) ON DELETE SET NULL,
    CONSTRAINT fk_retrain_history_dataset FOREIGN KEY (dataset_id) REFERENCES public.ml_datasets(id) ON DELETE SET NULL
);

-- ==========================================
-- 6. RULES & PATTERNS
-- ==========================================
CREATE TABLE public.global_rules ( 
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_key VARCHAR(100) UNIQUE NOT NULL,
    rule_group VARCHAR(50),
    hit_count INTEGER DEFAULT 0,
    service_scope VARCHAR(50) DEFAULT 'ALL',
    condition_field VARCHAR(100),
    operator VARCHAR(20),
    threshold_value VARCHAR(100),
    rule_config JSONB,
    action VARCHAR(20) NOT NULL,
    severity VARCHAR(20) DEFAULT 'MEDIUM',
    priority INTEGER DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_global_rules_admin FOREIGN KEY (created_by) REFERENCES public.admins(id) ON DELETE SET NULL
);

CREATE TABLE public.fraud_patterns (
    id SERIAL PRIMARY KEY,
    pattern_name VARCHAR(100) NOT NULL,
    service_source VARCHAR(50) DEFAULT 'ALL',
    pattern_category VARCHAR(100),
    pattern_rules JSONB NOT NULL,
    rules_hash TEXT,
    accuracy_score DOUBLE PRECISION,
    false_positive_rate DOUBLE PRECISION,
    risk_score INTEGER DEFAULT 50,
    priority INTEGER DEFAULT 1,
    hit_count INTEGER DEFAULT 0,
    true_positive INTEGER DEFAULT 0,
    false_positive INTEGER DEFAULT 0,
    action VARCHAR(20) DEFAULT 'FLAG',
    created_by INTEGER,
    is_active BOOLEAN DEFAULT TRUE, 
    disabled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    pattern_source pattern_source_enum NOT NULL DEFAULT 'MANUAL_CREATE', 

    CONSTRAINT fk_pattern_admin FOREIGN KEY (created_by) REFERENCES public.admins(id) ON DELETE SET NULL,
    CONSTRAINT chk_action_valid CHECK (action IN ('FLAG', 'REVIEW', 'BLOCK'))
);

-- ==========================================
-- 7. TRANSACTIONS & SERVICES
-- ==========================================
CREATE TABLE public.transactions_feed ( 
    id BIGSERIAL PRIMARY KEY,
    original_trx_id VARCHAR(100) NOT NULL,
    service_source VARCHAR(50) NOT NULL,
    user_account_id VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    transaction_time TIMESTAMP WITH TIME ZONE NOT NULL,
    transaction_status VARCHAR(100),
    terminal_id VARCHAR(100),
    account_number VARCHAR(100),
    merchant_id VARCHAR(100),
    ip_address VARCHAR(50),
    city VARCHAR(50),
    country VARCHAR(50),
    transaction_details JSONB,
    anomaly_score DOUBLE PRECISION,
    risk_score DOUBLE PRECISION, 
    risk_level VARCHAR(50),
    is_flagged_ml BOOLEAN DEFAULT FALSE,
    violation_reason TEXT,
    violation_rule_ids JSONB DEFAULT '[]'::jsonb,
    violation_pattern_ids JSONB DEFAULT '[]'::jsonb,
    score_breakdown JSONB DEFAULT '{}'::jsonb,
    final_status transaction_status_enum DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_source_original_trx UNIQUE (service_source, original_trx_id)
);

CREATE TABLE public.invoice_transactions (
    id BIGSERIAL PRIMARY KEY,
    no_invoice VARCHAR(50) NOT NULL,
    tanggal_tagihan TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    tanggal_pembayaran TIMESTAMP WITHOUT TIME ZONE,
    customer_id VARCHAR(50) NOT NULL,
    nama_customer VARCHAR(100) NOT NULL,
    sof VARCHAR(50),
    total_tagihan DECIMAL(15,2) NOT NULL,
    biaya_admin DECIMAL(15,2) DEFAULT 0,
    payment_amount DECIMAL(15,2), 
    utc_reference VARCHAR(100),
    kode_pembayaran VARCHAR(50),
    status_tagihan VARCHAR(30),
    status_akhir VARCHAR(30),
    tanggal_rekon TIMESTAMP WITHOUT TIME ZONE,
    keterangan TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.switching_logs ( 
    id BIGSERIAL PRIMARY KEY,
    rrn VARCHAR(30) NOT NULL,
    timestamp_db TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    mti VARCHAR(10),
    msg_raw TEXT,
    stan VARCHAR(20),
    terminal_id VARCHAR(50),
    merchant_id VARCHAR(50),
    processing_code VARCHAR(20),
    msg_type VARCHAR(20),
    response_code VARCHAR(20),
    account_number VARCHAR(50),
    dest_account_number VARCHAR(50),
    customer_ref_number VARCHAR(50),
    amount DECIMAL(15,2) NOT NULL,
    issuer_bank VARCHAR(50),
    dest_bank_code VARCHAR(50),
    acquirer_code VARCHAR(50),
    issuer_account_number VARCHAR(50),
    de7 VARCHAR(20),
    de12 VARCHAR(20),
    de13 VARCHAR(20),
    fep_id VARCHAR(50),
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- 8. ALERTS & REVIEWS
-- ==========================================
CREATE TABLE public.fraud_alerts ( 
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(150),
    message TEXT,
    status alert_status_enum DEFAULT 'OPEN',
    is_escalated BOOLEAN DEFAULT FALSE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by INTEGER,
    priority DOUBLE PRECISION,
    claimed_by INTEGER,
    claimed_at TIMESTAMP WITH TIME ZONE, 
    version_id INTEGER DEFAULT 1 NOT NULL,

    CONSTRAINT fk_alert_transaction FOREIGN KEY (transaction_id) REFERENCES public.transactions_feed(id) ON DELETE CASCADE,
    CONSTRAINT fk_alert_resolved_by FOREIGN KEY (resolved_by) REFERENCES public.admins(id) ON DELETE SET NULL,
    CONSTRAINT fraud_alerts_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES public.admins(id) ON DELETE SET NULL
);

CREATE TABLE public.manual_reviews ( 
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    alert_id BIGINT,
    reviewer_id INTEGER,
    reviewer_name VARCHAR(150), 
    decision review_decision_enum NOT NULL,
    review_note TEXT,
    previous_status VARCHAR(50),
    final_status transaction_status_enum NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    review_started_at TIMESTAMP WITH TIME ZONE,
    review_completed_at TIMESTAMP WITH TIME ZONE,
    transaction_snapshot JSONB,
    decision_confidence VARCHAR(20),
    version_id INTEGER DEFAULT 1 NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL, 
    deleted_by INTEGER,
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_overridden BOOLEAN DEFAULT FALSE NOT NULL,
    overridden_by INTEGER,
    overridden_at TIMESTAMP WITH TIME ZONE,
    override_reason TEXT,

    CONSTRAINT fk_review_transaction FOREIGN KEY (transaction_id) REFERENCES public.transactions_feed(id) ON DELETE CASCADE,
    CONSTRAINT fk_review_admin FOREIGN KEY (reviewer_id) REFERENCES public.admins(id) ON DELETE SET NULL,
    CONSTRAINT fk_review_alert FOREIGN KEY (alert_id) REFERENCES public.fraud_alerts(id) ON DELETE CASCADE,
    CONSTRAINT manual_reviews_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.admins(id) ON DELETE SET NULL,
    CONSTRAINT manual_reviews_overridden_by_fkey FOREIGN KEY (overridden_by) REFERENCES public.admins(id) ON DELETE SET NULL,
    CONSTRAINT uq_review_alert UNIQUE (alert_id) 
);

-- ==========================================
-- 9. ML FEEDBACK & RETRAINING LOGS
-- ==========================================
CREATE TABLE public.ml_feedback_logs ( 
    id BIGSERIAL PRIMARY KEY,
    review_id BIGINT,                   
    transaction_id BIGINT NOT NULL,       
    original_trx_id VARCHAR(100) NOT NULL,
    service_source VARCHAR(50) NOT NULL,
    user_account_id VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    transaction_time TIMESTAMP WITH TIME ZONE NOT NULL, 
    transaction_status VARCHAR(100),
    terminal_id VARCHAR(100),
    account_number VARCHAR(100),
    merchant_id VARCHAR(100),
    ip_address VARCHAR(50),
    city VARCHAR(50),
    country VARCHAR(50),
    transaction_details JSONB,
    anomaly_score DOUBLE PRECISION,
    risk_score DOUBLE PRECISION,
    risk_level VARCHAR(50),
    score_breakdown JSONB DEFAULT '{}'::jsonb,
    is_flagged_ml BOOLEAN DEFAULT FALSE,
    violation_reason TEXT,
    violation_rule_ids JSONB DEFAULT '[]'::jsonb,
    violation_pattern_ids JSONB DEFAULT '[]'::jsonb,
    is_used_for_training BOOLEAN DEFAULT FALSE, 
    analyst_decision VARCHAR(20) NOT NULL,    
    decision_confidence VARCHAR(20),          
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_feedback_review FOREIGN KEY (review_id) REFERENCES public.manual_reviews(id) ON DELETE CASCADE,
    CONSTRAINT fk_feedback_transaction FOREIGN KEY (transaction_id) REFERENCES public.transactions_feed(id) ON DELETE CASCADE
);

-- ==========================================
-- 10. REPORTS
-- ==========================================
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_name VARCHAR(255) NOT NULL,
    report_type report_type_enum NOT NULL,
    format report_format_enum NOT NULL,
    date_from TIMESTAMP WITH TIME ZONE NOT NULL,
    date_to TIMESTAMP WITH TIME ZONE NOT NULL,
    generated_by INTEGER,
    status report_status_enum DEFAULT 'PENDING' NOT NULL,
    file_path TEXT,
    total_records INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    filter_criteria JSONB,

    CONSTRAINT reports_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.admins(id) ON DELETE SET NULL
);

-- ==========================================
-- 11. INDEXES (Optimized & Deduplicated)
-- ==========================================

-- ------------------------------------------
-- 11.1 Transactions Feed Indexes
-- ------------------------------------------
CREATE INDEX idx_transactions_transaction_time ON transactions_feed(transaction_time); [cite: 45]
CREATE INDEX idx_transactions_user ON transactions_feed(user_account_id); [cite: 46]
CREATE INDEX idx_trx_final_status ON transactions_feed(final_status); [cite: 46]
CREATE INDEX idx_trx_service_time ON transactions_feed(service_source, transaction_time DESC); [cite: 46]
CREATE INDEX idx_trx_original_id ON transactions_feed(original_trx_id); [cite: 47]

-- Velocity Indexes (Sangat krusial untuk FDS)
CREATE INDEX idx_trx_ip_time ON transactions_feed (ip_address, transaction_time DESC); [cite: 47]
CREATE INDEX idx_trx_merchant_time ON transactions_feed (merchant_id, transaction_time DESC); [cite: 48]
CREATE INDEX idx_trx_terminal_time ON transactions_feed (terminal_id, transaction_time DESC); [cite: 48]
CREATE INDEX idx_trx_user_time ON transactions_feed (user_account_id, transaction_time DESC); [cite: 49]
CREATE INDEX idx_trx_account_time ON transactions_feed (account_number, transaction_time DESC); [cite: 49]

-- Risk & Flagging (Dashboard Optimization)
CREATE INDEX idx_trx_risk_score ON transactions_feed (risk_score DESC); [cite: 50]
CREATE INDEX idx_trx_risk_level ON transactions_feed (risk_level); [cite: 50]
CREATE INDEX IF NOT EXISTS idx_transactions_flagged ON transactions_feed (is_flagged_ml); [cite: 51]

-- Partial Index (Hanya index transaksi yang menggantung untuk hemat storage)
CREATE INDEX idx_trx_pending_review ON transactions_feed (final_status) WHERE final_status IN ('PENDING', 'UNDER_REVIEW'); [cite: 51]

-- JSONB GIN Indexes
CREATE INDEX idx_trx_pattern_ids ON transactions_feed USING GIN (violation_pattern_ids); [cite: 52]
CREATE INDEX idx_trx_rule_ids ON transactions_feed USING GIN (violation_rule_ids); [cite: 52]
CREATE INDEX idx_trx_score_breakdown ON transactions_feed USING GIN (score_breakdown); [cite: 53]

-- ------------------------------------------
-- 11.2 Alerts & Reviews Indexes
-- ------------------------------------------
CREATE INDEX idx_alerts_transaction_id ON fraud_alerts(transaction_id); [cite: 53]
CREATE INDEX idx_alerts_status ON fraud_alerts(status); [cite: 54]

-- Workflow & Dashboard Alerts
CREATE INDEX idx_alerts_workflow ON fraud_alerts (status, claimed_by); [cite: 54]
CREATE INDEX idx_alerts_priority_time ON fraud_alerts (priority DESC, created_at DESC); [cite: 55]
CREATE INDEX idx_alerts_escalated ON fraud_alerts (is_escalated) WHERE is_escalated = TRUE; [cite: 55]

-- Manual Reviews
CREATE INDEX idx_manual_reviews_transaction_id ON manual_reviews(transaction_id); [cite: 56]
CREATE INDEX IF NOT EXISTS idx_manual_reviews_alert_id ON manual_reviews (alert_id); [cite: 56]
CREATE INDEX IF NOT EXISTS idx_manual_reviews_reviewer_name ON manual_reviews (reviewer_name); [cite: 57]

-- Partial Index (Audit QA Override)
CREATE INDEX idx_reviews_overridden ON manual_reviews (is_overridden) WHERE is_overridden = TRUE; [cite: 57]

-- ------------------------------------------
-- 11.3 Rules & Blacklist Indexes
-- ------------------------------------------
CREATE INDEX idx_blacklist_value ON blacklist_items(value); [cite: 58]
CREATE INDEX idx_blacklist_lookup ON blacklist_items (type, value, service_scope) WHERE is_active = TRUE; [cite: 59]

CREATE INDEX IF NOT EXISTS idx_fraud_patterns_service ON fraud_patterns(service_source); [cite: 59]
CREATE INDEX IF NOT EXISTS idx_fraud_patterns_active ON fraud_patterns(is_active); [cite: 60]
CREATE INDEX idx_rules_hash ON fraud_patterns(rules_hash); [cite: 60]
CREATE INDEX idx_fraud_patterns_rules ON fraud_patterns USING GIN (pattern_rules); [cite: 61]

-- Partial Index (Caching Rule Aktif)
CREATE INDEX idx_global_rules_active ON global_rules (is_active) WHERE is_active = TRUE; [cite: 61]

-- ------------------------------------------
-- 11.4 Application & Auth Indexes
-- ------------------------------------------
CREATE INDEX IF NOT EXISTS idx_admins_soft_delete ON admins(is_deleted); [cite: 62]
CREATE INDEX idx_active_sessions ON user_sessions(admin_id, access_token) WHERE is_active = TRUE; [cite: 63]
CREATE INDEX idx_sessions_access_token ON user_sessions (access_token); [cite: 63]
CREATE INDEX idx_sessions_refresh_token ON user_sessions (refresh_token); [cite: 64]

-- ------------------------------------------
-- 11.5 External System Logs Indexes (Invoice & Switching)
-- ------------------------------------------
CREATE INDEX idx_invoice_customer ON invoice_transactions(customer_id); [cite: 64]
CREATE INDEX idx_invoice_no_invoice ON invoice_transactions(no_invoice); [cite: 65]
CREATE INDEX idx_invoice_time ON invoice_transactions(tanggal_pembayaran); [cite: 65]
CREATE INDEX idx_invoice_status ON invoice_transactions(status_akhir); [cite: 65]
CREATE INDEX idx_invoice_amount ON invoice_transactions(total_tagihan); [cite: 65]
CREATE INDEX idx_invoice_ip ON invoice_transactions(ip_address); [cite: 66]
CREATE INDEX idx_invoice_customer_time ON invoice_transactions(customer_id, tanggal_pembayaran); [cite: 66]
CREATE INDEX idx_invoice_processed ON invoice_transactions(processed_at); [cite: 66]

CREATE INDEX idx_switching_rrn ON switching_logs(rrn); [cite: 67]
CREATE INDEX idx_switching_account ON switching_logs(account_number); [cite: 67]
CREATE INDEX idx_switching_customer ON switching_logs(customer_ref_number); [cite: 67]
CREATE INDEX idx_switching_terminal ON switching_logs(terminal_id); [cite: 67]
CREATE INDEX idx_switching_merchant ON switching_logs(merchant_id); [cite: 68]
CREATE INDEX idx_switching_time ON switching_logs(timestamp_db); [cite: 68]
CREATE INDEX idx_switching_amount ON switching_logs(amount); [cite: 68]
CREATE INDEX idx_switching_ip ON switching_logs(ip_address); [cite: 68]
CREATE INDEX idx_switching_account_time ON switching_logs(account_number, timestamp_db); [cite: 69]
CREATE INDEX idx_switching_customer_time ON switching_logs(customer_ref_number, timestamp_db); [cite: 69]
CREATE INDEX idx_switching_processed ON switching_logs(processed_at); [cite: 69]

-- ------------------------------------------
-- 11.6 ML Datasets, Models & Feedback Indexes
-- ------------------------------------------
CREATE INDEX idx_retrain_schedule_active ON retrain_schedules(is_active); [cite: 70]
CREATE INDEX idx_retrain_history_time ON retrain_history(execution_time DESC); [cite: 70]
CREATE INDEX idx_ml_datasets_lookup ON ml_datasets(domain, created_at DESC); [cite: 71]
CREATE INDEX idx_retrain_history_model_id ON retrain_history(model_id); [cite: 71]
CREATE INDEX idx_retrain_history_dataset_id ON retrain_history(dataset_id); [cite: 71]
CREATE INDEX IF NOT EXISTS idx_ml_models_metrics ON ml_models USING GIN (metrics); [cite: 72]

CREATE INDEX idx_ml_feedback_review_id ON ml_feedback_logs(review_id); [cite: 72]
CREATE INDEX idx_ml_feedback_trx_id ON ml_feedback_logs(transaction_id); [cite: 73]
CREATE INDEX idx_ml_feedback_created_time ON ml_feedback_logs(created_at DESC); [cite: 73]

-- ------------------------------------------
-- 11.7 Audit / Activity Logs & Reports Indexes
-- ------------------------------------------
CREATE INDEX idx_activity_logs_target ON activity_logs(target_type, target_id); [cite: 74]
CREATE INDEX idx_activity_logs_time ON activity_logs(created_at DESC); [cite: 75]
CREATE INDEX idx_activity_logs_admin ON activity_logs(admin_id); [cite: 75]
CREATE INDEX IF NOT EXISTS idx_activity_logs_severity ON activity_logs(severity); [cite: 75]
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module_source); [cite: 76]
CREATE INDEX IF NOT EXISTS idx_activity_logs_session ON activity_logs(session_id); [cite: 76]

CREATE INDEX idx_reports_created_at ON reports (created_at DESC); [cite: 77]
CREATE INDEX idx_reports_status ON reports (status); [cite: 77]

-- ==========================================
-- 12. POST-INSTALLATION CLEANUP
-- ==========================================
-- Memastikan hanya ada satu model aktif per service target
UPDATE ml_models
SET is_active = false
WHERE id NOT IN (
    SELECT DISTINCT ON (target_service) id
    FROM ml_models
    ORDER BY target_service, created_at DESC
); [cite: 78]