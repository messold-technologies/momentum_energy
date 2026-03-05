# Momentum Portal Backend — Architecture

## File Structure

```
backend/
├── .env / .env.example
├── package.json
├── ecosystem.config.cjs
└── src/
    ├── server.js                          # Entry point — Express app setup
    ├── config/
    │   ├── index.js                       # Central config from env vars
    │   └── logger.js                      # Winston logger
    ├── middleware/
    │   └── errorHandler.js                # Global error handler
    ├── routes/
    │   ├── health.js                      # Health check endpoints
    │   └── transactions.js                # Submit + check status (proxy to Momentum)
    ├── services/
    │   ├── tokenService.js                # OAuth token fetch + caching
    │   └── momentumService.js             # HTTP calls to Momentum API
    └── validators/
        └── transactionValidator.js        # express-validator rules
```

---

## High-Level Flow

```
┌──────────┐       ┌──────────────────┐       ┌─────────────────────┐
│          │       │                  │       │                     │
│ Frontend │──────▶│  Express Backend │──────▶│  Momentum Energy    │
│ (React)  │ HTTP  │  (pass-through)  │ HTTPS │  API (Sandbox/Prod) │
│          │◀──────│                  │◀──────│                     │
└──────────┘       └──────────────────┘       └─────────────────────┘
```

No database. The backend is a pass-through proxy that:
1. Validates the request
2. Authenticates with Momentum via OAuth
3. Forwards the request and returns the response

---

## Middleware Pipeline

```
Request
  │
  ├─ 1. helmet()              → Security headers
  ├─ 2. cors()                → CORS (allowed origins from config)
  ├─ 3. express.json()        → Parse JSON body (1MB limit)
  ├─ 4. morgan()              → HTTP request logging
  ├─ 5. rateLimit()           → 100 req / 15 min (only on /api/*)
  │
  ├─ 6. Routes
  │     ├─ /health/*
  │     └─ /api/transactions/*
  │
  ├─ 7. 404 handler           → Route not found
  └─ 8. errorHandler()        → Global error handler (last)
```

---

## API Endpoints

### `POST /api/transactions` — Submit a transaction

```
Client
  │
  ▼
transactionValidationRules   →  Validate request body
  │
  ▼
validate                     →  Return 400 if validation fails
  │
  ▼
momentumService
  .submitSalesTransaction()
  │
  ├─ tokenService.getAccessToken()               →  Get/refresh OAuth token
  └─ POST /echannels/v1/sales-transactions       →  Forward to Momentum
```

**Response:** `201` with Momentum's response (`salesTransactionId`, `transactionStatus`, etc.)

---

### `GET /api/transactions/:salesTransactionId/status` — Check status

```
Client
  │
  ▼
momentumService
  .getSalesTransactionStatus()
  │
  ├─ tokenService.getAccessToken()
  └─ GET /echannels/v1/sales-transactions/:id    →  Query Momentum
```

**Response:** `200` with `transactionStatus` and full details

---

### `GET /health` — Basic health check

Returns `ok` + timestamp + environment

### `GET /health/detailed` — Detailed health check

Tests Momentum API connectivity by attempting to get an OAuth token

---

## Request Payload Structure (Momentum API spec)

```json
{
  "transaction": {
    "transactionReference": "TEST001",
    "transactionChannel": "Residential Connections",
    "transactionDate": "2024-11-10T11:18:25Z",
    "transactionVerificationCode": "0403157861",
    "transactionSource": "EXTERNAL"
  },
  "customer": {
    "customerType": "RESIDENT",
    "customerSubType": "OWNER_OCCUPIER",
    "communicationPreference": "EMAIL",
    "promotionAllowed": true,
    "residentIdentity": {
      "passport": { "documentId": "", "documentExpiryDate": "", "issuingCountry": "" },
      "drivingLicense": { "documentId": "", "documentExpiryDate": "", "issuingState": "" },
      "medicare": { "documentId": "", "documentNumber": "", "documentExpiryDate": "" }
    },
    "companyIdentity": {
      "industry": "", "entityName": "", "tradingName": "", "trusteeName": "",
      "abn": { "documentId": "" }, "acn": { "documentId": "" }
    },
    "contacts": {
      "primaryContact": {
        "salutation": "Mr.", "firstName": "", "lastName": "",
        "dateOfBirth": "", "email": "",
        "addresses": [{ "streetNumber": "", "streetName": "", "suburb": "", "state": "", "postCode": "" }],
        "contactPhones": [{ "contactPhoneType": "MOBILE", "phone": "" }]
      }
    }
  },
  "service": {
    "serviceType": "POWER",
    "serviceSubType": "TRANSFER",
    "serviceConnectionId": "",
    "serviceMeterId": "",
    "servicedAddress": {
      "streetNumber": "", "streetName": "", "streetTypeCode": "ST",
      "suburb": "", "state": "", "postCode": ""
    },
    "serviceBilling": {
      "serviceOfferCode": "", "offerQuoteDate": "",
      "contractTermCode": "OPEN",
      "paymentMethod": "Direct Debit Via Bank Account",
      "billCycleCode": "Monthly",
      "billDeliveryMethod": "EMAIL"
    }
  }
}
```

---

## Backend Validation Rules

| Field | Validation |
|---|---|
| `transaction.transactionReference` | Required, `^[A-Za-z0-9\-]{1,30}$` |
| `transaction.transactionChannel` | Required, `^[A-Za-z0-9\s]+$` |
| `transaction.transactionDate` | ISO 8601, within 3 days |
| `transaction.transactionSource` | Must be `EXTERNAL` |
| `customer.promotionAllowed` | Must be `true` |
| `customer.contacts.primaryContact.dateOfBirth` | ISO 8601, age 18+ |
| `service.serviceSubType` | `TRANSFER` or `MOVE IN` |
| `service.serviceStartDate` | Required if `MOVE IN` |
| `service.serviceBilling.offerQuoteDate` | ISO 8601, within 14 days |
| `service.serviceBilling.billCycleCode` | GAS: `Bi-Monthly`. POWER: `Monthly` or `Quarterly` |
| Identity doc expiry dates | Must not be in the past |
| ABN | 11 digits |
| ACN | 9 digits |

---

## Authentication with Momentum API

```
tokenService                         Momentum /oauth/token
  │                                        │
  ├─ Check in-memory cache                 │
  │   └─ Valid? → return cached token      │
  │                                        │
  ├─ Expired/missing? ─── POST ──────────▶ │
  │   body:                                │
  │     grant_type=client_credentials      │
  │     client_id=<MOMENTUM_CLIENT_ID>     │
  │     client_secret=<MOMENTUM_CLIENT_SECRET>
  │     scope=https://graph.microsoft.com/.default
  │                                        │
  │ ◀──── { access_token, expires_in } ────┤
  │                                        │
  └─ Cache token (auto-renew 60s before expiry)
```

All Momentum API calls include: `Authorization: Bearer <token>`

On 401 → clear cache, get fresh token, retry once.

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | No (default 3000) | HTTP port |
| `NODE_ENV` | No (default development) | Environment |
| `MOMENTUM_BASE_URL` | No (has default) | Momentum API base URL |
| `MOMENTUM_AUTH_URL` | No (has default) | OAuth token endpoint |
| `MOMENTUM_CLIENT_ID` | **Yes** | OAuth client ID |
| `MOMENTUM_CLIENT_SECRET` | **Yes** | OAuth client secret |
| `ALLOWED_ORIGINS` | No (default localhost:5173) | CORS allowed origins |
