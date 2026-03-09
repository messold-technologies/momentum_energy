// === Transaction ===

export interface TransactionInfo {
  transactionReference: string;
  transactionChannel: string;
  transactionDate: string;
  transactionVerificationCode?: string;
  transactionSource: 'EXTERNAL';
}

// === Identity Documents ===

export interface PassportIdentity {
  documentId: string;
  documentNumber?: string;
  documentExpiryDate: string;
  issuingCountry: string;
}

export interface DrivingLicenseIdentity {
  documentId: string;
  documentNumber?: string;
  documentExpiryDate: string;
  issuingState: string;
}

export interface MedicareIdentity {
  documentId: string;
  documentNumber: string;
  documentExpiryDate: string;
}

export interface ResidentIdentity {
  passport?: PassportIdentity;
  drivingLicense?: DrivingLicenseIdentity;
  medicare?: MedicareIdentity;
}

export interface CompanyIdentity {
  industry: string;
  entityName: string;
  tradingName: string;
  trusteeName?: string;
  abn: { documentId: string };
  acn?: { documentId: string };
}

// === Customer ===

export interface CustomerInfo {
  customerType: 'RESIDENT' | 'COMPANY';
  customerSubType?: string;
  communicationPreference: 'EMAIL' | 'POST';
  promotionAllowed: boolean; // Must be true for submit (customer consent required)
  residentIdentity?: ResidentIdentity;
  companyIdentity?: CompanyIdentity;
  contacts: ContactInfo;
}

// === Contacts ===

export interface ContactPhone {
  contactPhoneType: 'WORK' | 'HOME' | 'MOBILE';
  phone: string;
}

export interface Address {
  addressType?: string;
  unitNumber?: string;
  streetNumber: string;
  streetName: string;
  suburb: string;
  state: string;
  postCode: string;
}

export interface Contact {
  salutation: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  countryOfBirth?: string;
  dateOfBirth: string;
  email?: string;
  addresses: Address[];
  contactPhones: ContactPhone[];
}

export interface ContactInfo {
  primaryContact: Contact;
  secondaryContact?: Partial<Contact>;
}

// === Service ===

export const UNIT_TYPES = [
  'APT', 'CTGE', 'DUP', 'F', 'FY', 'HSE', 'KSK', 'MB', 'MSNT', 'OFF', 'PTHS',
  'RM', 'SE', 'SHED', 'SHOP', 'SITE', 'SL', 'STU', 'TNCY', 'TNHS', 'U', 'VLLA', 'WARD', 'WE',
] as const;
export const FLOOR_TYPES = ['FLOOR', 'LEVEL', 'GROUND'] as const;
export const STREET_NUMBER_SUFFIXES = ['CN', 'E', 'EX', 'LR', 'N', 'NE', 'NW', 'S', 'SE', 'SW', 'UP', 'W'] as const;

export interface ServicedAddress {
  name?: string;
  unitType?: (typeof UNIT_TYPES)[number];
  unitNumber?: string;
  floorType?: (typeof FLOOR_TYPES)[number];
  floorNumber?: string;
  streetNumberSuffix?: (typeof STREET_NUMBER_SUFFIXES)[number];
  streetNameSuffix?: string;
  streetNumber: string;
  streetName: string;
  streetTypeCode?: string;
  suburb: string;
  state: string;
  postCode: string;
  accessInstructions?: string;
  safetyInstructions?: string;
}

export interface Concession {
  cardType: string;
  cardNumber: string;
  startDate: string;
  endDate: string;
  holderName: string;
}

export interface ServiceBilling {
  offerQuoteDate: string;
  serviceOfferCode: string;
  servicePlanCode?: string;
  contractTermCode: 'OPEN' | '12MTH' | '24MTH' | '36MTH';
  contractDate?: string;
  paymentMethod: 'Direct Debit Via Bank Account' | 'Cheque';
  billCycleCode: string;
  billDeliveryMethod: 'EMAIL' | 'POST';
  concession?: Concession;
}

export interface ServiceInfo {
  serviceType: 'GAS' | 'POWER';
  serviceSubType: 'TRANSFER' | 'MOVE IN';
  serviceConnectionId: string;
  serviceMeterId?: string;
  serviceStartDate?: string;
  estimatedAnnualKwhs?: number;
  lotNumber?: string;
  servicedAddress: ServicedAddress;
  serviceBilling: ServiceBilling;
}

// === Top-Level Payload ===

export interface TransactionPayload {
  transaction: TransactionInfo;
  customer: CustomerInfo;
  service: ServiceInfo;
}

export type TransactionStatus =
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'VALIDATION_FAILED'
  | 'ONHOLD'
  | 'PENDING';
