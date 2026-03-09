# Validations Reference

This document catalogues all validations used in the momentum-portal application, across both the frontend (Zod) and backend (express-validator).

---

## Overview

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Zod schemas (`frontend/src/lib/schemas.ts`) | Step-by-step form validation, user feedback |
| **Backend** | express-validator (`backend/src/validators/transactionValidator.js`) | Request validation before API submission |

---

## Frontend Validations (Zod)

### Step 1: Transaction

| Field | Validation | Error Message |
|-------|------------|---------------|
| `transactionReference` | Required, min 1 char | "Transaction reference is required" |
| `transactionReference` | Regex `^[A-Za-z0-9\-]{1,30}$` | "Max 30 chars: letters, numbers, hyphens only" |
| `transactionChannel` | Required, min 1 char | "Transaction channel is required" |
| `transactionChannel` | Regex `^[A-Za-z0-9\s]+$` | "Letters, numbers, and spaces only" |
| `transactionDate` | Required | "Transaction date is required" |
| `transactionVerificationCode` | Optional; if provided: regex `^[A-Za-z0-9\-]{1,30}$` | "Max 30 chars: letters, numbers, hyphens only" |
| `transactionSource` | Must be `EXTERNAL` | (literal, not user-editable) |

### Step 2: Customer

| Field | Validation | Error Message |
|-------|------------|---------------|
| `customerType` | Enum `['RESIDENT', 'COMPANY']` | — |
| `communicationPreference` | Enum `['EMAIL', 'POST']` | — |
| `promotionAllowed` | Must be `true` | "Customer consent must be obtained" |

**Resident Identity (when document provided):**

| Document | Condition | Error Message |
|----------|-----------|---------------|
| Passport | If `documentId` provided — not validated further in Zod (backend checks expiry, issuing country) | — |
| Driving License | If `documentId` provided: `documentExpiryDate` and `issuingState` required | "Expiry date and issuing state are required when driving license is provided" |
| Medicare | If `documentId` provided: `documentNumber` and `documentExpiryDate` required | "Document number and expiry date are required when medicare card is provided" |

**Company Identity:**

| Field | Validation | Error Message |
|-------|------------|---------------|
| `abn.documentId` | Optional; if provided: regex `^\d{11}$` | "ABN must be 11 digits" |
| `acn.documentId` | Optional; if provided: regex `^\d{9}$` | "ACN must be 9 digits" |

**Cross-field (superRefine):**

| Rule | Error Message |
|------|---------------|
| RESIDENT → at least one identity document required | "At least one identity document is required for residential customers" |
| COMPANY → entity name required | "Entity name is required for company customers" |
| COMPANY → trading name required | "Trading name is required for company customers" |
| COMPANY → ABN required | "ABN is required for company customers" |

### Step 3: Contacts (Primary Contact)

| Field | Validation | Error Message |
|-------|------------|---------------|
| `salutation` | Required, min 1 char | "Salutation is required" |
| `firstName` | Required, min 1 char | "First name is required" |
| `lastName` | Required, min 1 char | "Last name is required" |
| `dateOfBirth` | Required | "Date of birth is required" |
| `email` | Optional; if provided: valid email | "Must be a valid email" |
| `addresses` | Min 1 address | "At least one address is required" |
| `contactPhones` | Min 1 phone | "At least one phone number is required" |

**Address (shared schema):**

| Field | Validation | Error Message |
|-------|------------|---------------|
| `streetNumber` | Required, min 1 char | "Street number is required" |
| `streetName` | Required, min 1 char | "Street name is required" |
| `suburb` | Required, min 1 char | "Suburb is required" |
| `state` | Enum `['VIC','NSW','QLD','SA','WA','TAS','NT','ACT']` | "State is required" |
| `postCode` | Regex `^\d{4}$` | "Postcode must be 4 digits" |

**Contact Phone:**

| Field | Validation | Error Message |
|-------|------------|---------------|
| `contactPhoneType` | Enum `['WORK', 'HOME', 'MOBILE']` | — |
| `phone` | Min 8 chars, max 15 chars | "Phone number must be at least 8 digits" |

### Step 4: Service

| Field | Validation | Error Message |
|-------|------------|---------------|
| `serviceType` | Enum `['GAS', 'POWER']` | — |
| `serviceSubType` | Enum `['TRANSFER', 'MOVE IN']` | — |
| `serviceConnectionId` | Required | "NMI/MIRN is required" |
| `servicedAddress.streetNumber` | Required | "Street number is required" |
| `servicedAddress.streetName` | Required | "Street name is required" |
| `servicedAddress.streetTypeCode` | Required | "Street type is required" |
| `servicedAddress.suburb` | Required | "Suburb is required" |
| `servicedAddress.state` | Enum `['VIC','NSW','QLD','SA','WA','TAS','NT','ACT']` | "State is required" |
| `servicedAddress.postCode` | Regex `^\d{4}$` | "Postcode must be 4 digits" |

**Service Billing:**

| Field | Validation | Error Message |
|-------|------------|---------------|
| `offerQuoteDate` | Required | "Quote date is required" |
| `serviceOfferCode` | Required | "Offer code is required" |
| `contractTermCode` | Enum `['OPEN', '12MTH', '24MTH', '36MTH']` | — |
| `paymentMethod` | Enum `['Direct Debit Via Bank Account', 'Cheque']` | — |
| `billCycleCode` | Required | "Bill cycle is required" |
| `billDeliveryMethod` | Enum `['EMAIL', 'POST']` | — |

**Concession (if added):**

| Field | Validation |
|-------|------------|
| `cardType` | Min 1 char |
| `cardNumber` | Min 1 char |
| `startDate` | Min 1 char |
| `endDate` | Min 1 char |
| `holderName` | Min 1 char |

**Cross-field (superRefine):**

| Rule | Error Message |
|------|---------------|
| MOVE IN → service start date required | "Service start date is required for Move In" |
| GAS → bill cycle must be `Bi-Monthly` | "GAS service must use Bi-Monthly bill cycle" |
| POWER → bill cycle must be `Monthly` or `Quarterly` | "POWER service must use Monthly or Quarterly bill cycle" |

---

## Backend Validations (express-validator)

### Transaction

| Field | Validation | Error Message |
|-------|------------|---------------|
| `transaction.transactionReference` | Required | "Transaction reference is required" |
| `transaction.transactionReference` | Regex `^[A-Za-z0-9\-]{1,30}$` | "Max 30 chars: letters, numbers, hyphens only" |
| `transaction.transactionChannel` | Required | "Transaction channel is required" |
| `transaction.transactionChannel` | Regex `^[A-Za-z0-9\s]+$` | "Letters, numbers, and spaces only" |
| `transaction.transactionDate` | ISO 8601, within 3 days of today | "Transaction date cannot be more than 3 days in the past" |
| `transaction.transactionSource` | Must equal `EXTERNAL` | "Transaction source must be EXTERNAL" |

### Customer

| Field | Validation | Error Message |
|-------|------------|---------------|
| `customer.customerType` | In `['RESIDENT', 'COMPANY']` | "Customer type must be RESIDENT or COMPANY" |
| `customer.promotionAllowed` | Must equal `'true'` (string) | "Customer consent must be obtained" |

**Resident Identity (when document provided):**

| Document | Condition | Error Message |
|----------|-----------|---------------|
| Passport | If `documentId`: expiry and issuing country required; expiry must not be past | "Passport expiry date is required", "Passport issuing country is required", "Identity document must not be expired" |
| Driving License | If `documentId`: expiry required; expiry must not be past | "Driving license expiry date is required", "Identity document must not be expired" |
| Medicare | If `documentId`: expiry required; expiry must not be past | "Medicare expiry date is required", "Identity document must not be expired" |

**Company Identity:**

| Field | Validation | Error Message |
|-------|------------|---------------|
| `companyIdentity.abn.documentId` | Optional; regex `^\d{11}$` | "ABN must be 11 digits" |
| `companyIdentity.acn.documentId` | Optional; regex `^\d{9}$` | "ACN must be 9 digits" |

**Primary Contact:**

| Field | Validation | Error Message |
|-------|------------|---------------|
| `primaryContact.firstName` | Required | "Primary contact first name required" |
| `primaryContact.lastName` | Required | "Primary contact last name required" |
| `primaryContact.dateOfBirth` | ISO 8601, must be 18+ years ago | "Customer must be 18 years or older" |
| `primaryContact.email` | Optional; valid email | "Primary contact email must be valid" |

### Service

| Field | Validation | Error Message |
|-------|------------|---------------|
| `service.serviceType` | In `['GAS', 'POWER']` | "Service type must be GAS or POWER" |
| `service.serviceSubType` | In `['TRANSFER', 'MOVE IN']` | "Service sub-type must be TRANSFER or MOVE IN" |
| `service.serviceConnectionId` | Required | "NMI/MIRN is required" |
| `service.serviceStartDate` | If MOVE IN: required, must not be in the past | "Service start date is required for MOVE IN", "Date cannot be in the past" |

**Service Billing:**

| Field | Validation | Error Message |
|-------|------------|---------------|
| `service.serviceBilling.serviceOfferCode` | Required | "Offer code is required" |
| `service.serviceBilling.offerQuoteDate` | ISO 8601, within 14 days of today | "Quote date cannot be more than 14 days old" |
| `service.serviceBilling.billCycleCode` | GAS → `Bi-Monthly`; POWER → `Monthly` or `Quarterly` | "GAS service must use Bi-Monthly bill cycle", "POWER service must use Monthly or Quarterly bill cycle" |

---

## Custom Validation Helpers (Backend)

| Helper | Purpose |
|--------|---------|
| `isWithin3Days` | Ensures transaction date is not more than 3 days in the past |
| `isWithin14Days` | Ensures quote date is not more than 14 days old |
| `isOver18` | Ensures date of birth indicates customer is 18 years or older |
| `isNotExpired` | Ensures identity document expiry date is not in the past |
| `isNotPastDate` | Ensures date (e.g. service start) is not in the past |

---

## Validation Comparison

| Area | Frontend | Backend |
|------|----------|---------|
| **Transaction** | Basic required + format | Same + date within 3 days |
| **Customer type & consent** | Yes | Yes |
| **Resident identity** | At least one doc; doc-specific rules for DL/Medicare | Doc-specific rules; expiry/issuing country for passport; no "at least one" check |
| **Company identity** | Entity name, trading name, ABN required; ABN/ACN format | ABN/ACN format only; no required entity/trading name |
| **Primary contact** | Salutation, names, DOB, email, addresses, phones | First/last name, DOB 18+, email |
| **Addresses/Phones** | Full validation | Not validated |
| **Service & billing** | Full + bill cycle vs service type | NMI, offer code, quote date, bill cycle rules |
| **Serviced address** | Full | Not validated |
| **Concession** | All fields if added | Not validated |

The backend focuses on critical business rules (dates, document expiry, age, bill cycles) and format checks. The frontend enforces broader structural and UX validations.
