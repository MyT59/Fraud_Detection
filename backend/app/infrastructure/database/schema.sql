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
    'PENDING', 'REVIEW', 'SAFE', 'FRAUD'
);

CREATE TYPE alert_status_enum AS ENUM (
    'OPEN', 'IN_PROGRESS', 'RESOLVED'
);

CREATE TYPE review_decision_enum AS ENUM (
    'SAFE', 'FRAUD'
);

-- ==========================================
-- 2. ROLES, ADMINS, SESSIONS & PREFERENCES
-- ==========================================
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE admins (
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

    CONSTRAINT fk_admin_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
    CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE user_sessions (
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

    CONSTRAINT fk_session_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE TABLE notification_preferences (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER UNIQUE NOT NULL,
    fraud_alerts_enabled BOOLEAN DEFAULT TRUE,
    push_notifications_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notif_prefs_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

-- ==========================================
-- 3. LOGS & BLACKLIST
-- ==========================================
CREATE TABLE activity_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_id INTEGER,
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(100),
    target_id VARCHAR(100),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_activity_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE blacklist_items (
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

    CONSTRAINT fk_blacklist_admin FOREIGN KEY (added_by) REFERENCES admins(id) ON DELETE SET NULL,
    CONSTRAINT uq_blacklist_type_value_service UNIQUE (type, value, service_scope),
    CONSTRAINT chk_value_not_empty CHECK (value <> '')
);

-- ==========================================
-- 4. ML OPS: DATASETS & MODELS
-- ==========================================
CREATE TABLE ml_datasets (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    checksum_sha256 CHAR(64) UNIQUE NOT NULL, 
    file_size_bytes BIGINT,
    row_count INTEGER,
    uploaded_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    is_used_for_training BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ml_models (
    id SERIAL PRIMARY KEY,
    version_name VARCHAR(100) UNIQUE NOT NULL,
    target_service VARCHAR(100) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- ==========================================
-- 5. ML RETRAIN MODULE TABLES
-- ==========================================
CREATE TABLE retrain_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cron_expr VARCHAR(100) NOT NULL,
    domain VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    last_run_status VARCHAR(20),
    created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE retrain_history (
    id SERIAL PRIMARY KEY,
    schedule_id UUID REFERENCES retrain_schedules(id) ON DELETE SET NULL,
    dataset_id INTEGER REFERENCES ml_datasets(id) ON DELETE SET NULL,
    model_id INTEGER REFERENCES ml_models(id) ON DELETE SET NULL,
    execution_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    trigger_source VARCHAR(50),
    triggered_by INTEGER REFERENCES admins(id) ON DELETE SET NULL, 
    status VARCHAR(20),
    anomalies_found INTEGER,
    new_patterns_count INTEGER,
    trigger_metadata JSONB DEFAULT '{}',
    log_details JSONB,
    model_version VARCHAR(50)

    CONSTRAINT fk_retrain_history_dataset FOREIGN KEY (dataset_id) REFERENCES ml_datasets(id) ON DELETE SET NULL
);

-- ==========================================
-- 6. RULES & PATTERNS
-- ==========================================
CREATE TABLE global_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_key VARCHAR(100) UNIQUE NOT NULL,
    rule_group VARCHAR(50),
    service_scope VARCHAR(50) DEFAULT 'ALL',
    condition_field VARCHAR(100),
    operator VARCHAR(20),
    threshold_value VARCHAR(100),
    rule_config JSONB,
    action VARCHAR(20) NOT NULL,
    severity VARCHAR(20) DEFAULT 'MEDIUM',
    priority INTEGER DEFAULT 0,
    description TEXT,
    hit_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_global_rules_admin FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE fraud_patterns (
    id SERIAL PRIMARY KEY,
    pattern_name VARCHAR(100) NOT NULL,
    service_source VARCHAR(50) DEFAULT 'ALL',
    pattern_category VARCHAR(100),
    pattern_rules JSONB NOT NULL,
    rules_hash TEXT,
    accuracy_score FLOAT,
    false_positive_rate FLOAT,
    risk_score INTEGER DEFAULT 50,
    priority INTEGER DEFAULT 1,
    hit_count INTEGER DEFAULT 0,
    true_positive INTEGER DEFAULT 0,
    false_positive INTEGER DEFAULT 0,
    action VARCHAR(20) DEFAULT 'FLAG',
    created_by INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pattern_admin FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL,
    CONSTRAINT chk_action_valid CHECK (action IN ('FLAG', 'REVIEW', 'BLOCK'))
);

-- ==========================================
-- 7. TRANSACTIONS
-- ==========================================
CREATE TABLE transactions_feed (
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
    anomaly_score FLOAT,
    risk_score FLOAT,
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

-- ==========================================
-- 8. ALERTS & REVIEWS
-- ==========================================
CREATE TABLE fraud_alerts (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(150),
    message TEXT,
    status alert_status_enum DEFAULT 'OPEN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by INTEGER,
    priority FLOAT,

    CONSTRAINT fk_alert_transaction FOREIGN KEY (transaction_id) REFERENCES transactions_feed(id) ON DELETE CASCADE,
    CONSTRAINT fk_alert_resolved_by FOREIGN KEY (resolved_by) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE manual_reviews (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    alert_id BIGINT,
    reviewer_id INTEGER,
    decision review_decision_enum NOT NULL,
    review_note TEXT,
    previous_status VARCHAR(50),
    final_status transaction_status_enum NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_review_transaction FOREIGN KEY (transaction_id) REFERENCES transactions_feed(id) ON DELETE CASCADE,
    CONSTRAINT fk_review_admin FOREIGN KEY (reviewer_id) REFERENCES admins(id) ON DELETE SET NULL,
    CONSTRAINT fk_review_alert FOREIGN KEY (alert_id) REFERENCES fraud_alerts(id) ON DELETE CASCADE,
    CONSTRAINT uq_review_alert UNIQUE (alert_id)
);

-- ==========================================
-- 9. INDEXES (Optimized)
-- ==========================================
-- Transactions & Alerts
CREATE INDEX idx_transactions_transaction_time ON transactions_feed(transaction_time);
CREATE INDEX idx_transactions_user ON transactions_feed(user_account_id);
CREATE INDEX idx_transactions_status ON transactions_feed(final_status);
CREATE INDEX idx_trx_final_status ON transactions_feed(final_status);
CREATE INDEX idx_trx_service_time ON transactions_feed(service_source, transaction_time DESC);
CREATE INDEX idx_manual_reviews_alert_id ON manual_reviews(alert_id);
CREATE INDEX idx_alerts_transaction_id ON fraud_alerts(transaction_id);
CREATE INDEX idx_alerts_status ON fraud_alerts(status);
CREATE INDEX idx_manual_reviews_transaction_id ON manual_reviews(transaction_id);
CREATE INDEX idx_trx_original_id ON transactions_feed(original_trx_id);

-- Activity Logs (Audit Trail)
CREATE INDEX idx_activity_logs_target ON activity_logs(target_type, target_id);
CREATE INDEX idx_activity_logs_time ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_admin ON activity_logs(admin_id);

-- JSONB GIN Indexes
CREATE INDEX idx_trx_pattern_ids ON transactions_feed USING GIN (violation_pattern_ids);
CREATE INDEX idx_trx_rule_ids ON transactions_feed USING GIN (violation_rule_ids);
CREATE INDEX idx_trx_score_breakdown ON transactions_feed USING GIN (score_breakdown);
CREATE INDEX idx_fraud_patterns_rules ON fraud_patterns USING GIN (pattern_rules);

-- Lookups & Conditions
CREATE INDEX idx_blacklist_value ON blacklist_items(value);
CREATE INDEX idx_blacklist_lookup ON blacklist_items (type, value, service_scope) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_fraud_patterns_service ON fraud_patterns(service_source);
CREATE INDEX IF NOT EXISTS idx_fraud_patterns_active ON fraud_patterns(is_active);
CREATE INDEX idx_rules_hash ON fraud_patterns(rules_hash);
CREATE INDEX idx_active_sessions ON user_sessions(admin_id, access_token) WHERE is_active = TRUE;

-- Dataset & Retrain Indexes
CREATE INDEX idx_retrain_schedule_active ON retrain_schedules(is_active);
CREATE INDEX idx_retrain_history_time ON retrain_history(execution_time DESC);
CREATE INDEX idx_ml_datasets_lookup ON ml_datasets(domain, created_at DESC);
CREATE INDEX idx_retrain_history_model_id ON retrain_history(model_id);
CREATE INDEX idx_retrain_history_dataset_id ON retrain_history(dataset_id);
CREATE INDEX idx_retrain_schedule_active ON retrain_schedules(is_active);
CREATE INDEX idx_retrain_history_time ON retrain_history(execution_time DESC);

-- ==========================================
-- 10. POST-INSTALLATION CLEANUP
-- ==========================================
-- Ensure only one active model per service
UPDATE ml_models
SET is_active = false
WHERE id NOT IN (
    SELECT DISTINCT ON (target_service) id
    FROM ml_models
    ORDER BY target_service, created_at DESC
);