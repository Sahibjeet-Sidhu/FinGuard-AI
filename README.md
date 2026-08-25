# FinGuard AI — Enterprise Fraud Monitoring Platform

> A full-stack AI-assisted fraud monitoring and transaction risk analysis platform designed for financial institution workflows.

This project simulates how a financial institution might monitor suspicious transactions, assign fraud investigation cases, track audit logs, and use AI-assisted explanations to support analyst decision-making. It was built to demonstrate full-stack development, secure authentication, role-based access control, data analytics, explainable risk scoring, and enterprise-style software design.

---

## Overview

FinGuard AI is an internal fraud intelligence dashboard built for fraud analysts and compliance teams. It allows analysts to review flagged transactions, manage fraud cases, and analyze risk trends through an enterprise-grade UI.

---

## Features

| Feature | Description |
|---------|-------------|
| **Transaction Monitoring** | Real-time table of all transactions with search, filters, pagination, and risk badges |
| **Risk Scoring Engine** | Deterministic rule-based engine scoring each transaction 0–100 across 8+ risk signals |
| **AI Explanation Generator** | Plain-English analyst-style explanations for every flagged transaction |
| **Fraud Case Management** | Full case lifecycle: create, assign, update status, add notes, generate summaries |
| **Role-Based Access Control** | Admin and Analyst roles with JWT authentication and protected routes |
| **Risk Analytics Dashboard** | Recharts visualizations: flagged-by-day, risk-by-category, high-risk merchants, volume-by-hour |
| **Audit Logging** | Immutable log of all user actions for compliance and traceability |
| **AI Case Summary** | Generates professional investigation summaries for each fraud case |

---

## Tech Stack

**Frontend**
- React 18, Vite, React Router v6
- Recharts (data visualization)
- Axios (API client)
- Plain CSS with CSS custom properties

**Backend**
- Node.js, Express.js
- better-sqlite3 (embedded database, zero setup)
- JWT (jsonwebtoken) + bcryptjs
- Morgan (request logging)

**Testing**
- Jest + Supertest
- 25 tests across auth, transactions, and risk scoring

---

## Architecture

```mermaid
graph TD
    A[React Dashboard<br/>Vite + React Router] -->|REST API / JSON| B[Express.js REST API<br/>Node.js]
    B --> C[(SQLite Database<br/>better-sqlite3)]
    B --> D[Risk Scoring Service<br/>riskScoringService.js]
    B --> E[AI Explanation Service<br/>aiExplanationService.js]
    B --> F[Audit Logging Service<br/>auditService.js]
    D -->|score + factors| B
    E -->|explanation text| B
    F -->|write audit log| C
```

---

## Project Structure

```
FinGuard-AI/
├── client/                     # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/         # ProtectedRoute, AdminRoute
│   │   │   └── layout/         # Sidebar, AppLayout
│   │   ├── context/            # AuthContext (JWT state)
│   │   ├── pages/              # LoginPage, Dashboard, Transactions, Cases, Analytics, Audit
│   │   ├── services/           # api.js (Axios client + all API calls)
│   │   └── utils/              # formatters.js
│   ├── package.json
│   └── vite.config.js
│
├── server/                     # Node.js + Express backend
│   ├── src/
│   │   ├── controllers/        # authController, transactionController, caseController, analyticsController, auditController
│   │   ├── database/           # db.js, schema.js, seed.js
│   │   ├── middleware/         # auth.js (JWT), errorHandler.js
│   │   ├── routes/             # auth, transactions, cases, analytics, audit, users
│   │   └── services/           # riskScoringService.js, aiExplanationService.js, auditService.js
│   ├── tests/                  # Jest + Supertest tests
│   │   ├── auth.test.js
│   │   ├── transactions.test.js
│   │   └── riskScoring.test.js
│   ├── data/                   # SQLite database (auto-created)
│   ├── .env
│   ├── .env.example
│   └── package.json
│
└── README.md
```

---

## Database Schema

```sql
users           -- id, name, email, password_hash, role, created_at
customers       -- id, name, email, usual_location, average_transaction_amount
accounts        -- id, customer_id, account_number, account_type, balance
transactions    -- id, customer_id, account_id, amount, merchant, category, location,
                --   transaction_type, transaction_time, risk_score, risk_level, flagged, explanation
fraud_cases     -- id, transaction_id, assigned_to, status, priority, summary, resolution
case_notes      -- id, case_id, user_id, note, created_at
audit_logs      -- id, user_id, user_name, action, entity_type, entity_id, old_value, new_value
```

---

## Risk Scoring Logic

The risk scoring engine (`server/src/services/riskScoringService.js`) is **deterministic and explainable** — no randomness. Each rule contributes a fixed point value:

| Risk Signal | Points |
|-------------|--------|
| Amount is 3–5× customer average | +25 |
| Amount is 5×+ customer average | +40 |
| Transaction at unusual hour (00:00–05:00 UTC) | +20 |
| New/unfamiliar transaction location | +25 |
| International or out-of-province location | +20 |
| Suspicious merchant category (crypto, gambling, wire_transfer) | +20 |
| High transaction velocity (3+ txns in 60 min) | +30 |
| Large cash withdrawal (≥$5,000) | +15 |
| Round-number amount (structuring indicator) | +10 |

**Risk Levels:**
- 0–30: `low` — Normal transaction
- 31–60: `medium` — Worth reviewing
- 61–80: `high` — Likely fraud, open a case
- 81–100: `critical` — Immediate investigation required

---

## AI Explanation Feature

`server/src/services/aiExplanationService.js` generates analyst-readable explanations using triggered risk factors:

> *"This transaction was flagged because the amount is significantly higher than the customer's historical average spending (6.5x above baseline), the transaction occurred during off-hours when the customer is not typically active, and the originating location has not been previously associated with this account."*

**LLM Integration Ready:** The service is structured so an LLM (Claude, GPT-4, etc.) can be dropped in by replacing the rule-based generator with an API call. Integration points are marked with `// TODO: LLM integration point` comments.

---

## Screenshots

> *Screenshots would be added here for a production README. Run the app locally to see the full UI.*

- Login Page with demo credential tiles
- Transaction Monitoring with risk score bars and badges
- Transaction Detail with AI explanation panel
- Fraud Case lifecycle management
- Analytics dashboard with 6 Recharts visualizations
- Audit Logs table (admin only)

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@finguard.ca` | `Admin@1234` |
| **Analyst** | `sarah.chen@finguard.ca` | `Analyst@1234` |
| **Analyst** | `marcus.w@finguard.ca` | `Analyst@1234` |

---

## Setup Instructions

### Prerequisites
- Node.js v18+
- npm v9+

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/FinGuard-AI.git
cd FinGuard-AI
```

### 2. Set up the backend

```bash
cd server
npm install

# Create environment file
cp .env.example .env
# Edit .env if needed (defaults work for local development)

# Initialize and seed the database
npm run seed

# Start the development server
npm run dev
```

The API will run at `http://localhost:3001`

### 3. Set up the frontend

```bash
cd ../client
npm install
npm run dev
```

The app will open at `http://localhost:5173`

### 4. Run backend tests

```bash
cd server
npm test
```

### Environment Variables

**server/.env**

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Express server port |
| `JWT_SECRET` | *(set this)* | Secret key for JWT signing |
| `JWT_EXPIRES_IN` | `8h` | JWT token lifetime |
| `CLIENT_URL` | `http://localhost:5173` | CORS allowed origin |
| `NODE_ENV` | `development` | Environment mode |

---

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register new user |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | JWT | Get current user |

### Transactions
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/transactions` | JWT | List transactions (paginated, filterable) |
| GET | `/api/transactions/:id` | JWT | Transaction detail |
| POST | `/api/transactions/:id/recalculate-risk` | JWT | Re-run risk scoring |

### Fraud Cases
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/cases` | JWT | List cases (filterable) |
| GET | `/api/cases/:id` | JWT | Case detail with notes |
| POST | `/api/cases` | JWT | Create case from transaction |
| PUT | `/api/cases/:id/status` | JWT | Update case status |
| PUT | `/api/cases/:id/assign` | Admin | Assign to analyst |
| POST | `/api/cases/:id/notes` | JWT | Add investigation note |
| POST | `/api/cases/:id/generate-summary` | JWT | Generate AI summary |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/summary` | Summary KPI cards |
| GET | `/api/analytics/risk-levels` | Transactions by risk level |
| GET | `/api/analytics/flagged-by-day` | Flagged transaction trend |
| GET | `/api/analytics/cases-by-status` | Case distribution |
| GET | `/api/analytics/high-risk-merchants` | Top flagged merchants |
| GET | `/api/analytics/volume-by-hour` | Hourly transaction pattern |
| GET | `/api/analytics/avg-risk-by-category` | Risk by category |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/audit-logs` | Admin | Full audit trail |
| GET | `/api/users/analysts` | JWT | List available analysts |

---

## Testing

```bash
cd server && npm test
```

**25 tests across 3 test suites:**

- `auth.test.js` — Login, registration, protected routes, duplicate detection
- `riskScoring.test.js` — All 8 risk rules, score capping, risk level thresholds
- `transactions.test.js` — Pagination, authentication enforcement, filters

---

## Future Improvements

- [ ] Real LLM integration (Claude API / OpenAI) for explanation generation
- [ ] WebSocket real-time alerts when new critical transactions are detected
- [ ] Batch transaction ingestion via CSV/JSON file upload
- [ ] ML-based risk scoring model to complement rule-based engine
- [ ] Export fraud cases and audit logs to PDF/CSV
- [ ] Two-factor authentication for analyst accounts
- [ ] Email/SMS alerting for critical-risk transactions
- [ ] Docker + docker-compose for production deployment

---

## Resume Bullet Examples

- **Built a full-stack AI-assisted fraud monitoring platform** using React, Node.js, Express, and SQLite, enabling analysts to review flagged transactions, manage fraud cases, and analyze risk trends across a dashboard with 6 interactive Recharts visualizations.

- **Developed an explainable risk scoring engine** that deterministically evaluated transaction amount anomalies, geographic displacement, merchant category risk, transaction velocity, and customer behavioral baselines to score transactions 0–100 and generate plain-English analyst explanations.

- **Implemented JWT authentication, role-based access control, bcrypt password hashing, protected routes, and a full audit logging system** to simulate the security and compliance controls used in production financial applications.

- **Designed and built a fraud case management system** with full lifecycle support: case creation from flagged transactions, analyst assignment, status transitions, investigation notes, AI-generated case summaries, and resolution tracking.

- **Wrote 25 backend tests using Jest and Supertest**, covering authentication flows, risk scoring rule validation, and transaction API filtering — achieving full coverage of business logic and API contract enforcement.

- **Architected a clean REST API** with controllers, services, middleware, and route separation following enterprise Node.js conventions, with SQL aggregation queries powering all analytics endpoints.

---

## License

MIT — Built as a portfolio project. All data is synthetic and does not represent real financial information.
