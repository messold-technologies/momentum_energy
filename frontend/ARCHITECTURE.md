# Momentum Portal Frontend — Architecture

## Tech Stack

- **React 18** + TypeScript
- **React Router** — client-side routing
- **React Hook Form** + **Zod** — form state management and validation
- **Axios** — HTTP client
- **Tailwind CSS** — styling
- **Lucide React** — icons
- **Vite** — build tool

---

## File Structure

```
frontend/src/
├── main.tsx                              # Entry point
├── App.tsx                               # Router setup
├── index.css                             # Global styles (Tailwind)
├── lib/
│   ├── api.ts                            # Axios instance + API functions
│   ├── types.ts                          # TypeScript interfaces for the payload
│   └── schemas.ts                        # Zod validation schemas (4 steps)
├── pages/
│   ├── DashboardPage.tsx                 # Landing page (new tx + status lookup)
│   ├── NewTransactionPage.tsx            # Multi-step transaction form
│   └── TransactionDetailPage.tsx         # Transaction status viewer
├── components/
│   ├── layout/
│   │   └── AppLayout.tsx                 # Sidebar + mobile nav + content area
│   ├── form-steps/
│   │   ├── Step1Transaction.tsx          # Step 1: Transaction info
│   │   ├── Step2Customer.tsx             # Step 2: Customer details
│   │   ├── Step3Contact.tsx              # Step 3: Contact info
│   │   └── Step4Service.tsx              # Step 4: Service & billing
│   └── ui/
│       ├── StatusBadge.tsx               # Coloured status pill
│       ├── Stepper.tsx                   # Step progress indicator
│       └── FormField.tsx                 # Reusable form field wrapper
```

---

## Routes

| Path | Page | Description |
|---|---|---|
| `/` | DashboardPage | Landing page — create new transaction or look up status |
| `/transactions/new` | NewTransactionPage | 4-step form to submit a transaction |
| `/transactions/:reference` | TransactionDetailPage | View transaction status from Momentum |

---

## API Calls

Only two API calls to the backend:

| Function | Method | Endpoint | Purpose |
|---|---|---|---|
| `transactionApi.submit(payload)` | POST | `/api/transactions` | Submit a new sales transaction |
| `transactionApi.refreshStatus(id)` | GET | `/api/transactions/:salesTransactionId/status` | Check transaction status |

---

## Payload Structure (matches Momentum API spec)

```
{
  transaction: { ... },
  customer: {
    customerType, customerSubType, communicationPreference, promotionAllowed,
    residentIdentity: { passport, drivingLicense, medicare },
    companyIdentity: { industry, entityName, tradingName, trusteeName, abn, acn },
    contacts: { primaryContact, secondaryContact }
  },
  service: {
    serviceType, serviceSubType, serviceConnectionId, serviceMeterId, serviceStartDate,
    servicedAddress: { streetNumber, streetName, streetTypeCode, suburb, state, postCode, ... },
    serviceBilling: { serviceOfferCode, offerQuoteDate, contractTermCode, paymentMethod, billCycleCode, billDeliveryMethod, concession }
  }
}
```

---

## Transaction Form — 4 Steps

### Step 1: Transaction Info

| Field | API Key | Type | Required | Validation |
|---|---|---|---|---|
| Transaction Reference | `transaction.transactionReference` | text | Yes | `^[A-Za-z0-9\-]{1,30}$` |
| Transaction Channel | `transaction.transactionChannel` | text | Yes | `^[A-Za-z0-9\s]+$` |
| Transaction Date | `transaction.transactionDate` | datetime-local | Yes | ISO 8601 datetime |
| Verification Code | `transaction.transactionVerificationCode` | text | No | `^[A-Za-z0-9\-]{1,30}$` |
| Transaction Source | `transaction.transactionSource` | readonly | Yes | Must be `EXTERNAL` |

### Step 2: Customer Details

| Field | API Key | Type | Required | Validation |
|---|---|---|---|---|
| Customer Type | `customer.customerType` | radio | Yes | `RESIDENT` or `COMPANY` |
| Customer Sub-Type | `customer.customerSubType` | select | No | Enum values |
| Communication Preference | `customer.communicationPreference` | select | Yes | `EMAIL` or `POST` |
| Promotion Consent | `customer.promotionAllowed` | checkbox | Yes | Must be `true` |

**Resident Identity** (`customer.residentIdentity` — at least one document required):

| Document | Fields |
|---|---|
| Passport | `documentId`, `documentNumber` (opt), `documentExpiryDate`, `issuingCountry` |
| Driving License | `documentId`, `documentNumber` (opt), `documentExpiryDate`, `issuingState` |
| Medicare | `documentId`, `documentNumber`, `documentExpiryDate` |

**Company Identity** (`customer.companyIdentity`):

| Field | API Key | Required |
|---|---|---|
| Industry | `companyIdentity.industry` | No |
| Entity Name | `companyIdentity.entityName` | Yes |
| Trading Name | `companyIdentity.tradingName` | Yes |
| Trustee Name | `companyIdentity.trusteeName` | No |
| ABN | `companyIdentity.abn.documentId` | Yes (11 digits) |
| ACN | `companyIdentity.acn.documentId` | No (9 digits) |

### Step 3: Contact Info (`customer.contacts`)

**Primary Contact (required):**

| Field | API Key | Required | Validation |
|---|---|---|---|
| Salutation | `primaryContact.salutation` | Yes | `Mr.`, `Ms.`, `Mrs.`, `Dr.`, `Prof.` |
| First Name | `primaryContact.firstName` | Yes | Non-empty |
| Middle Name | `primaryContact.middleName` | No | — |
| Last Name | `primaryContact.lastName` | Yes | Non-empty |
| Country of Birth | `primaryContact.countryOfBirth` | No | — |
| Date of Birth | `primaryContact.dateOfBirth` | Yes | Non-empty |
| Email | `primaryContact.email` | No | Valid email or empty |
| Address | `primaryContact.addresses[0]` | Yes | Array with `streetNumber`, `streetName`, `suburb`, `state`, `postCode` |
| Phones | `primaryContact.contactPhones[]` | Yes | Array with `contactPhoneType` + `phone` (8-15 chars) |

**Secondary Contact** (optional): Same fields as primary, all optional.

### Step 4: Service & Billing

**Service:**

| Field | API Key | Required | Validation |
|---|---|---|---|
| Service Type | `service.serviceType` | Yes | `GAS` or `POWER` |
| Service Sub-Type | `service.serviceSubType` | Yes | `TRANSFER` or `MOVE IN` |
| Connection ID | `service.serviceConnectionId` | Yes | NMI (POWER) or MIRN (GAS) |
| Service Start Date | `service.serviceStartDate` | If MOVE IN | Required for Move In |
| Service Meter ID | `service.serviceMeterId` | No | — |
| Lot Number | `service.lotNumber` | No | — |

**Service Address** (`service.servicedAddress`):

| Field | API Key | Required |
|---|---|---|
| Street Number | `servicedAddress.streetNumber` | Yes |
| Street Name | `servicedAddress.streetName` | Yes |
| Street Type | `servicedAddress.streetTypeCode` | Yes (ST, AVE, RD, etc.) |
| Suburb | `servicedAddress.suburb` | Yes |
| State | `servicedAddress.state` | Yes |
| Post Code | `servicedAddress.postCode` | Yes (4 digits) |
| Access Instructions | `servicedAddress.accessInstructions` | No |
| Safety Instructions | `servicedAddress.safetyInstructions` | No |

**Service Billing** (`service.serviceBilling`):

| Field | API Key | Required | Validation |
|---|---|---|---|
| Offer Code | `serviceBilling.serviceOfferCode` | Yes | Non-empty |
| Quote Date | `serviceBilling.offerQuoteDate` | Yes | ISO 8601, within 14 days |
| Service Plan Code | `serviceBilling.servicePlanCode` | No | — |
| Contract Term | `serviceBilling.contractTermCode` | Yes | `OPEN`, `12MTH`, `24MTH`, `36MTH` |
| Contract Date | `serviceBilling.contractDate` | No | — |
| Payment Method | `serviceBilling.paymentMethod` | Yes | `Direct Debit Via Bank Account` or `Cheque` |
| Bill Cycle | `serviceBilling.billCycleCode` | Yes | GAS: `Bi-Monthly`. POWER: `Monthly` or `Quarterly` |
| Bill Delivery | `serviceBilling.billDeliveryMethod` | Yes | `EMAIL` or `POST` |

**Concession** (`serviceBilling.concession` — optional):

| Field | Required |
|---|---|
| `cardType` | If added |
| `cardNumber` | If added |
| `startDate` | If added |
| `endDate` | If added |
| `holderName` | If added |

---

## Cross-Field Validation Rules (Zod superRefine)

| Rule | Step | Error |
|---|---|---|
| Residential customers must provide at least one identity document | Step 2 | "At least one identity document is required for residential customers" |
| Company customers must provide entity name | Step 2 | "Entity name is required for company customers" |
| Company customers must provide trading name | Step 2 | "Trading name is required for company customers" |
| Company customers must provide ABN | Step 2 | "ABN is required for company customers" |
| MOVE IN service sub-type requires a start date | Step 4 | "Service start date is required for Move In" |
| GAS service must use Bi-Monthly bill cycle | Step 4 | "GAS service must use Bi-Monthly bill cycle" |
| POWER service must use Monthly or Quarterly bill cycle | Step 4 | "POWER service must use Monthly or Quarterly bill cycle" |

---

## Backend Validation (express-validator)

| Rule | Error |
|---|---|
| `transaction.transactionReference` regex `^[A-Za-z0-9\-]{1,30}$` | "Max 30 chars: letters, numbers, hyphens only" |
| `transaction.transactionChannel` regex `^[A-Za-z0-9\s]+$` | "Letters, numbers, and spaces only" |
| `transaction.transactionDate` within 3 days | "Transaction date cannot be more than 3 days in the past" |
| `customer.contacts.primaryContact.dateOfBirth` must be 18+ | "Customer must be 18 years or older" |
| `service.serviceBilling.offerQuoteDate` within 14 days | "Quote date cannot be more than 14 days old" |
| Identity document expiry dates must not be in the past | "Identity document must not be expired" |

---

## Features

- **Draft auto-save** — form data saved to `localStorage` every second, restored on page load
- **Step-by-step validation** — each step validated independently before advancing
- **Payload cleanup** — irrelevant fields stripped before submission (e.g. company fields removed for residential, transactionDate converted to full ISO datetime)
- **Success/error result screen** — shows Momentum `salesTransactionId` with link to view status
- **Status lookup** — enter a `salesTransactionId` on the dashboard to check current status from Momentum
