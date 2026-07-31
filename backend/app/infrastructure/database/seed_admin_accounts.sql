-- Seed akun awal Fraud Detection System (PostgreSQL)
-- Password awal:
--   super.admin@fds.local  -> @Superadmin123
--   risk.manager@fds.local -> @Riskmanager123
--   fraud.analyst@fds.local -> @Fraudanalyst123
--
-- Hash di bawah mengikuti app.core.security.hash_password():
-- SHA-256(password), lalu bcrypt. Ganti password setelah login pertama.

BEGIN;

INSERT INTO public.roles (role_name, description)
VALUES
    ('SUPER_ADMIN', 'Mengelola akun admin dan jadwal retraining ML.'),
    ('RISK_MANAGER', 'Mengelola rule, blacklist, fraud pattern, dan laporan.'),
    ('FRAUD_ANALYST', 'Meninjau alert dan membuat keputusan fraud.')
ON CONFLICT (role_name) DO NOTHING;

WITH new_admins AS (
    INSERT INTO public.admins (
        full_name,
        email,
        phone_number,
        password_hash,
        is_password_temporary,
        role_id,
        department,
        notes,
        is_active,
        is_deleted
    )
    SELECT
        account.full_name,
        account.email,
        account.phone_number,
        account.password_hash,
        TRUE,
        role.id,
        account.department,
        account.notes,
        TRUE,
        FALSE
    FROM (
        VALUES
            (
                'Super Administrator',
                'superadmin@mail.com',
                '081200000001',
                '$2b$12$8ff82hyFtfmXQLlS9YfobOFkw9Hpk8ntiKjXMEp/C4HulnH78KDoS',
                'SUPER_ADMIN',
                'Information Technology',
                'Initial Super Admin account'
            ),
            (
                'Rizky Aditya',
                'rizkyaditya@mail.com',
                '081200000002',
                '$2b$12$1E7X7UhziUDDmmVCNej8Mu9qPpgdEogyHxXj/GMuRmcssUgrs0MoC',
                'RISK_MANAGER',
                'Risk Management',
                'Initial Risk Manager account'
            ),
            (
                'Citra Ramayani',
                'citraramayani@mail.com',
                '081200000003',
                '$2b$12$2OBdJv1Bwqag7TgOP3l3E.NYE31Yy/5fRH6iVoIkdpc686Hs9gVS2',
                'FRAUD_ANALYST',
                'Fraud Operations',
                'Initial Fraud Analyst account'
            )
    ) AS account(full_name, email, phone_number, password_hash, role_name, department, notes)
    JOIN public.roles AS role ON role.role_name = account.role_name
    ON CONFLICT (email) DO NOTHING
    RETURNING id
)
INSERT INTO public.notification_preferences (admin_id)
SELECT id FROM new_admins
ON CONFLICT (admin_id) DO NOTHING;

COMMIT;
