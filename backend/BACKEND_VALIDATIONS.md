# Backend Validations

Complete reference of all validation rules enforced in the backend before submitting to the Momentum API. Implemented in `src/validators/transactionValidator.js` using express-validator.

---

## Where Applied

Validations run on `POST /api/transactions` via the `validate` middleware. On failure, the API returns `400` with:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "field": "transaction.transactionReference", "message": "transactionReference must be 1-30 chars: letters, numbers, hyphen" }
  ]
}
```

---

## Transaction

| Field | Rule | Error Message |
|-------|------|---------------|
| `transaction.transactionReference` | Regex `^[A-Za-z0-9-]{1,30}$` | "transactionReference must be 1-30 chars: letters, numbers, hyphen" |
| `transaction.transactionChannel` | Regex `^[A-Za-z0-9\s]+$` | "transactionChannel must contain letters, numbers and spaces only" |
| `transaction.transactionDate` | Valid ISO 8601 date | "transactionDate must be ISO 8601 datetime" |
| `transaction.transactionVerificationCode` | Optional; regex `^[A-Za-z0-9-]{1,30}$` | "transactionVerificationCode invalid" |
| `transaction.transactionSource` | Must equal `EXTERNAL` | "transactionSource must be EXTERNAL" |

---

## Customer

| Field | Rule | Error Message |
|-------|------|---------------|
| `customer.customerType` | Must be `RESIDENT` or `COMPANY` | "customerType must be RESIDENT or COMPANY" |
| `customer.customerSubType` | When `customerType` is RESIDENT: must be `RESIDENT`. When COMPANY: must be one of Incorporation, Limited Company, NA, Partnership, Private, Sole Trader, Trust, C&I, SME | "customerSubType must be RESIDENT when customerType is RESIDENT" / "customerSubType must be one of: ..." |
| `customer.communicationPreference` | Must be `POST` or `EMAIL` | "communicationPreference must be POST or EMAIL" |
| `customer.promotionAllowed` | Must be `true` (boolean, customer consent required) | "Customer consent must be obtained (promotionAllowed must be true)" |

---

## Resident Identity (all optional)

### Passport

| Field | Rule |
|-------|------|
| `documentId` | Optional; regex `^[A-Za-z0-9-]{1,30}$` |
| `documentExpiryDate` | Optional; ISO 8601 |
| `issuingCountry` | Optional; 3 chars |

### Driving License

| Field | Rule |
|-------|------|
| `documentId` | Optional; regex `^[A-Za-z0-9-]{1,30}$` |
| `documentExpiryDate` | Optional; ISO 8601 |
| `issuingState` | Optional; NSW, VIC, QLD, WA, SA, TAS, ACT, NT |

### Medicare

| Field | Rule |
|-------|------|
| `documentId` | Optional; regex `^[A-Za-z0-9-]{1,30}$` |
| `documentNumber` | Optional; regex `^\d{1,30}$` |
| `documentExpiryDate` | Optional; ISO 8601 |

---

## Primary Contact

| Field | Rule | Error Message |
|-------|------|---------------|
| `customer.contacts.primaryContact.firstName` | Regex `^[A-Z][a-zA-Z'-. ]{1,100}$` | "firstName must start with uppercase letter and be 2-101 chars" |
| `customer.contacts.primaryContact.middleName` | Optional; regex `^[a-zA-Z'-. ]{1,100}$` | "middleName invalid" |
| `customer.contacts.primaryContact.lastName` | Regex `^[A-Z][a-zA-Z'-. ]{1,100}$` | "lastName must start with uppercase letter and be 2-101 chars" |
| `customer.contacts.primaryContact.countryOfBirth` | Optional; ISO 3166-1 alpha-3 country code | "countryOfBirth must be a valid ISO 3166-1 alpha-3 country code" |
| `customer.contacts.primaryContact.dateOfBirth` | ISO 8601 Date-Only | "dateOfBirth must be ISO 8601" |
| `customer.contacts.primaryContact.email` | Required; permissive regex `^[a-zA-Z0-9._|%#~`=?&/$^*!}{+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$` | "email must be valid format" |

---

## Secondary Contact

| Field | Rule | Error Message |
|-------|------|---------------|
| `customer.contacts.secondaryContact.salutation` | Required when secondary provided; Mr., Ms., Mrs., Dr., Prof. | "salutation is required when secondary contact is provided" |
| `customer.contacts.secondaryContact.firstName` | Required when secondary provided; `^[A-Z][a-zA-Z'-]{1,100}$` | "firstName must start with uppercase, 2-101 chars" |
| `customer.contacts.secondaryContact.middleName` | Optional; `^[a-zA-Z'-]{1,100}$` | "middleName invalid" |
| `customer.contacts.secondaryContact.lastName` | Required when secondary provided; `^[A-Z][a-zA-Z'-]{1,100}$` | "lastName must start with uppercase, 2-101 chars" |
| `customer.contacts.secondaryContact.countryOfBirth` | Optional; ISO 3166-1 alpha-3 country code | "countryOfBirth must be a valid ISO 3166-1 alpha-3 country code" |
| `customer.contacts.secondaryContact.dateOfBirth` | Required when secondary contact provided; ISO 8601 | "dateOfBirth is required when secondary contact is provided" |
| `customer.contacts.secondaryContact.email` | Optional; permissive email regex | "secondary contact email invalid format" |
| `customer.contacts.secondaryContact.addresses.*.addressType` | Optional; regex `^[A-Za-z]+$` | "addressType must be letters only" |

---

## Address (per address in `addresses` array; at least 1 required for primary)

| Field | Rule | Error Message |
|-------|------|---------------|
| `addressType` | Optional; regex `^[A-Za-z]+$` | "addressType must be letters only" |
| `streetNumber` | Required; regex `^[A-Za-z0-9-]+$` | "streetNumber is required" |
| `streetName` | Required; regex `^[a-zA-Z0-9'.,/()\s-]+$` | "streetName is required" |
| `unitNumber` | Optional; regex `^[a-zA-Z0-9,./&:\s-]+$` | "unitNumber invalid" |
| `suburb` | Required; regex `^[A-Za-z0-9 ]+$` | "suburb is required" |
| `state` | ACT, NT, WA, SA, VIC, NSW | "state must be ACT, NT, WA, SA, VIC, or NSW" |
| `postCode` | Regex `^[0-9]{4}$` | "postCode must be 4 digits" |

---

## Contact Phones (at least 1 required for primary)

| Field | Rule | Error Message |
|-------|------|---------------|
| `contactPhoneType` | WORK, HOME, or MOBILE | "contactPhoneType must be WORK, HOME, or MOBILE" |
| `phone` | Australian phone regex | "phone must be valid Australian number" |

---

## Service

| Field | Rule | Error Message |
|-------|------|---------------|
| `service.serviceType` | Must be `GAS` or `POWER` | "serviceType must be GAS or POWER" |
| `service.serviceSubType` | Must be `TRANSFER` or `MOVE IN` | "serviceSubType must be TRANSFER or MOVE IN" |
| `service.serviceConnectionId` | Regex `^[0-9A-Za-z]+$`; POWER: 10 chars (NMI), GAS: 11 chars (MIRN) | "NMI must be 10 characters for POWER service" / "MIRN must be 11 characters for GAS service" |
| `service.serviceStartDate` | Optional; ISO 8601 | "serviceStartDate must be ISO 8601" |
| `service.serviceMeterId` | Optional; regex `^[a-zA-Z0-9,./&:-]+$` | "serviceMeterId invalid" |

---

## Serviced Address

| Field | Rule | Error Message |
|-------|------|---------------|
| `service.servicedAddress.name` | Optional; regex `^[A-Z][a-zA-Z'-]{1,100}$` | "Property name must start with uppercase, 2-101 chars" |
| `service.servicedAddress.unitType` | Optional; APT, CTGE, DUP, F, FY, HSE, KSK, MB, MSNT, OFF, PTHS, RM, SE, SHED, SHOP, SITE, SL, STU, TNCY, TNHS, U, VLLA, WARD, WE | — |
| `service.servicedAddress.unitNumber` | Optional; regex `^[a-zA-Z0-9,./&:\s-]+$` | "unitNumber invalid" |
| `service.servicedAddress.floorType` | Optional; FLOOR, LEVEL, GROUND | — |
| `service.servicedAddress.floorNumber` | Optional; regex `^[a-zA-Z0-9,./&:\s-]+$` | "floorNumber invalid" |
| `service.servicedAddress.streetNumberSuffix` | Optional; CN, E, EX, LR, N, NE, NW, S, SE, SW, UP, W | — |
| `service.servicedAddress.streetNameSuffix` | Optional; regex `^[A-Za-z- ]+$` | "streetNameSuffix invalid" |
| `service.servicedAddress.streetNumber` | Required; regex `^[A-Za-z0-9-]+$` | "streetNumber is required" / "streetNumber invalid" |
| `service.servicedAddress.streetName` | Required; regex `^[a-zA-Z0-9'.,/()\s-]+$` | "streetName is required" / "streetName invalid" |
| `service.servicedAddress.suburb` | Required; regex `^[A-Za-z0-9 ]+$` | "suburb is required" / "suburb invalid" |
| `service.servicedAddress.state` | ACT, NT, WA, SA, VIC, NSW | "state must be ACT, NT, WA, SA, VIC, or NSW" |
| `service.servicedAddress.postCode` | Regex `^\d{4}$` | "postCode must be 4 digits" |

---

## Service Billing

| Field | Rule | Error Message |
|-------|------|---------------|
| `service.serviceBilling.offerQuoteDate` | ISO 8601 | "offerQuoteDate must be ISO 8601" |
| `service.serviceBilling.serviceOfferCode` | Regex `^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$` (15 or 18 chars) | "serviceOfferCode must be 15 or 18 alphanumeric chars" |
| `service.serviceBilling.contractTermCode` | OPEN, 12MTH, 24MTH, or 36MTH | "contractTermCode must be OPEN, 12MTH, 24MTH, or 36MTH" |
| `service.serviceBilling.paymentMethod` | Direct Debit Via Bank Account or Cheque | "paymentMethod must be Direct Debit Via Bank Account or Cheque" |
| `service.serviceBilling.billCycleCode` | Monthly, Bi-Monthly, or Quarterly | "billCycleCode must be Monthly, Bi-Monthly, or Quarterly" |
| `service.serviceBilling.billDeliveryMethod` | EMAIL or POST | "billDeliveryMethod must be EMAIL or POST" |
