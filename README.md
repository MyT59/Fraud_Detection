# Fraud Detection System

Last updated: 2026-07-13

Fraud Detection System (FDS) is a full-stack application for monitoring suspicious transactions, applying fraud rules and blacklist checks, generating alerts, supporting post-transaction fraud analyst review, producing reports, and integrating with an unsupervised ML anomaly detection module.

The current fraud decision concept separates prevention and detection:

- `BLOCK`: prevention. The transaction is stopped/rejected.
- `FLAG`: detection. The transaction still succeeds, but it is marked as suspicious and becomes reviewable by a Fraud Analyst.

Manual review is not a transaction-hold action. It is a post-transaction workflow for checking flagged alerts and deciding whether the transaction is truly fraud or safe.

## Main Roles

- `SUPER_ADMIN`: manages admin/user accounts and ML retraining schedules.
- `RISK_MANAGER`: manages rules, blacklist items, fraud patterns, monitoring controls, and reports.
- `FRAUD_ANALYST`: claims alerts, reviews flagged transactions, records decisions, and provides fraud feedback.
- `SYSTEM`: internal/background service role.

## Tech Stack

- Backend: Python, FastAPI, SQLAlchemy, PostgreSQL, JWT auth, APScheduler, ReportLab/OpenPyXL/CSV exporters.
- Frontend: React, React Router, Chart.js, Bootstrap Icons, Axios/fetch API services.
- ML integration: Isolation Forest runtime and retraining metadata managed through backend services.

## Run Locally

Backend:

```powershell
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Frontend:

```powershell
cd frontend
npm install
npm start
```

Local URLs:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`

## Main Documentation

- `docs/FDS_PROJECT_CONTEXT.md`: complete project context.
- `docs/BACKEND_INDIVIDUAL_REPORT.md`: backend-focused individual report, including database and API details.
- `docs/BUSINESS_PROPOSAL_DIAGRAM.md`: editable Mermaid recreation of the business proposal diagram and implementation mapping.
- `backend/app/infrastructure/database/schema.sql`: database schema reference.
