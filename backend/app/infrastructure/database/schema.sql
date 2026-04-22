-- Enum untuk blacklist type
CREATE TYPE blacklist_type_enum AS ENUM (
    'USER_ID',
    'CUSTOMER_ID',
    'ACCOUNT_NUMBER',
    'DEVICE_ID',
    'TERMINAL_ID',
    'IP_ADDRESS',
    'MERCHANT_ID',
    'INVOICE_NUMBER',
    'RRN',
    'PAYMENT_CODE'
    'BILLER_ID',
    'CUSTOMER_PHONE',
    'CUSTOMER_EMAIL',
    'VIRTUAL_ACCOUNT_NUMBER'
);

-- Enum untuk final status transaksi
CREATE TYPE transaction_status_enum AS ENUM (
    'PENDING',
    'REVIEW',
    'SAFE',
    'FRAUD'
);

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_admin_role
        FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE RESTRICT
);

CREATE TABLE activity_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_id INTEGER,
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(100),
    target_id VARCHAR(100),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_activity_admin
        FOREIGN KEY (admin_id)
        REFERENCES admins(id)
        ON DELETE SET NULL
);

CREATE TABLE blacklist_items (
    id SERIAL PRIMARY KEY,
    value VARCHAR(100) NOT NULL,
    type blacklist_type_enum NOT NULL,
    service_scope VARCHAR(50) DEFAULT 'ALL',
    reason TEXT NOT NULL,
    added_by INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_blacklist_admin
        FOREIGN KEY (added_by)
        REFERENCES admins(id)
        ON DELETE SET NULL,

    CONSTRAINT uq_blacklist_type_value_service
        UNIQUE (type, value, service_scope)
);

CREATE TABLE global_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_key VARCHAR(100) UNIQUE NOT NULL,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_global_rules_admin
        FOREIGN KEY (created_by)
        REFERENCES admins(id)
        ON DELETE SET NULL
);

CREATE TABLE ml_models (
    id SERIAL PRIMARY KEY,
    version_name VARCHAR(100) NOT NULL,
    target_service VARCHAR(100) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    accuracy_score FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE fraud_patterns (
    id SERIAL PRIMARY KEY,
    pattern_name VARCHAR(100) NOT NULL,
    service_source VARCHAR(50) DEFAULT 'ALL',
    pattern_type VARCHAR(100),
    pattern_rules JSONB NOT NULL,
    accuracy_score FLOAT,
    false_positive_rate FLOAT,
    created_by INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pattern_admin
        FOREIGN KEY (created_by)
        REFERENCES admins(id)
        ON DELETE SET NULL
);

CREATE TABLE transactions_feed (
    id BIGSERIAL PRIMARY KEY,
    original_trx_id VARCHAR(100) NOT NULL,
    service_source VARCHAR(50) NOT NULL,
    user_account_id VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    transaction_time TIMESTAMP NOT NULL,
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
    violation_rule_id INTEGER,
    violation_pattern_id INTEGER,
    final_status transaction_status_enum DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_source_original_trx
        UNIQUE (service_source, original_trx_id),

    CONSTRAINT fk_violation_rule
        FOREIGN KEY (violation_rule_id)
        REFERENCES global_rules(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_violation_pattern
        FOREIGN KEY (violation_pattern_id)
        REFERENCES fraud_patterns(id)
        ON DELETE SET NULL
);

CREATE TABLE fraud_alerts (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(150),
    message TEXT,
    status VARCHAR(30) DEFAULT 'UNREAD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by INTEGER,

    CONSTRAINT fk_alert_transaction
        FOREIGN KEY (transaction_id)
        REFERENCES transactions_feed(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_alert_resolved_by
        FOREIGN KEY (resolved_by)
        REFERENCES admins(id)
        ON DELETE SET NULL
);

CREATE TABLE manual_reviews (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    reviewer_id INTEGER,
    decision VARCHAR(50) NOT NULL,
    review_note TEXT,
    previous_status VARCHAR(50),
    final_status transaction_status_enum NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_review_transaction
        FOREIGN KEY (transaction_id)
        REFERENCES transactions_feed(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_review_admin
        FOREIGN KEY (reviewer_id)
        REFERENCES admins(id)
        ON DELETE SET NULL
);

-- Query cepat untuk dashboard
CREATE INDEX idx_transactions_transaction_time
    ON transactions_feed(transaction_time);

-- Query fraud
CREATE INDEX idx_transactions_flagged
    ON transactions_feed(is_flagged_ml);

-- Query user
CREATE INDEX idx_transactions_user
    ON transactions_feed(user_account_id);

-- Blacklist lookup cepat
CREATE INDEX idx_blacklist_value
    ON blacklist_items(value);

-- ML filtering
CREATE INDEX idx_transactions_status
    ON transactions_feed(final_status);
