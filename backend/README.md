# Momentum Energy Portal - Backend

Node.js/Express backend for the Momentum Energy External Channels API integration.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Set up Neon DB
1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project (e.g. `momentum-portal`)
3. Copy the connection string — it looks like:
   ```
   postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Add it to your `.env` as `DATABASE_URL`

### 4. Run migrations
```bash
npm run db:migrate
```

### 5. Start server
```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

## API Endpoints

### Health
- `GET /health` — Basic health check
- `GET /health/detailed` — DB + Momentum auth check

### Transactions
All `/api/transactions` endpoints require `x-api-key` header matching `PORTAL_API_KEY` in `.env`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/transactions` | Submit new transaction to Momentum |
| GET | `/api/transactions` | List all transactions (paginated) |
| GET | `/api/transactions/:reference` | Get by internal ref or Momentum ID |
| GET | `/api/transactions/:salesTransactionId/status` | Refresh status from Momentum |

### Query params for GET /api/transactions
- `page` — page number (default: 1)
- `limit` — results per page (default: 20)
- `status` — filter by status (PENDING, ACCEPTED, FAILED, etc.)
- `serviceType` — filter by GAS or POWER
- `from` / `to` — date range filter (ISO 8601)

## Transaction Statuses
| Status | Meaning |
|--------|---------|
| PENDING_SUBMISSION | Saved to DB, not yet sent to Momentum |
| SUBMISSION_FAILED | Error calling Momentum API |
| PENDING | Submitted to Momentum, being processed |
| ACCEPTED | Successfully provisioned |
| FAILED | Error during provisioning |
| CANCELLED | Cancelled due to incorrect data |
| REJECTED | Rejected by Momentum |
| VALIDATION_FAILED | Failed Momentum's validation |
| ONHOLD | Awaiting information |

## Running Tests
```bash
npm test
```

## Key Validation Rules Enforced
- Transaction date: max 3 days in past
- Quote date: max 14 days old
- Customer must be 18+
- Identity documents must not be expired
- GAS → Bi-Monthly bill cycle only
- POWER → Monthly or Quarterly
- MOVE_IN → service start date required (cannot be past)
- Promotion consent required
- RESIDENT → at least one identity document required

## Project Structure
```
src/
├── config/         # App config + logger
├── db/             # Neon DB pool + migrations
├── middleware/     # Auth, submission window, error handler
├── routes/         # Express route handlers
├── services/       # tokenService, momentumService, transactionService
└── validators/     # express-validator rules + helper utils
tests/              # Jest test suites
```

## Neon DB Notes
- SSL is required for Neon — configured automatically via `ssl: { rejectUnauthorized: false }`
- Free tier includes 0.5GB storage and automatic branching for dev/staging
- Connection pooling via pgbouncer is available on paid plans
