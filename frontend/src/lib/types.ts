export interface TransactionInfo {
  transactionReferenceId: string;
  channelName: string;
  transactionDate: string;
  transactionVerificationCode?: string;
  source: 'EXTERNAL';
}

export interface PassportIdentity {
  documentId: string;
  expiryDate: string;
  countryOfBirth: string;
}

export interface DrivingLicenseIdentity {
  documentId: string;
  expiryDate: string;
  issuingState: string;
}

export interface MedicareCardIdentity {
  documentId: string;
  referenceNumber: string;
  expiryDate: string;
}

export interface CustomerInfo {
  customerType: 'RESIDENT' | 'COMPANY';
  customerSubType?: string;
  communicationPreference: 'EMAIL' | 'POST';
  promotionConsent: boolean;
  passport?: PassportIdentity;
  drivingLicense?: DrivingLicenseIdentity;
  medicareCard?: MedicareCardIdentity;
  industry?: string;
  entityName?: string;
  tradingName?: string;
  trusteeName?: string;
  abn?: string;
  acn?: string;
}

export interface Phone {
  type: 'WORK' | 'HOME' | 'MOBILE';
  number: string;
}

export interface Address {
  unitNumber?: string;
  streetNumber: string;
  streetName: string;
  suburb: string;
  state: string;
  postcode: string;
}

export interface Contact {
  salutation: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  email?: string;
  address: Address;
  phones: Phone[];
}

export interface ContactInfo {
  primaryContact: Contact;
  secondaryContact?: Partial<Contact>;
}

export interface ServicedAddress {
  streetNumber: string;
  streetName: string;
  unitNumber?: string;
  suburb: string;
  state: string;
  postcode: string;
  accessInstructions?: string;
  safetyInstructions?: string;
}

export interface Offer {
  offerCode: string;
  quoteDate: string;
}

export interface BillingDetails {
  servicePlan?: string;
  contractTerm: 'OPEN' | '12MTH' | '24MTH' | '36MTH';
  contractDate?: string;
  paymentMethod: 'DIRECT_DEBIT' | 'CHEQUE';
  billCycleCode: string;
  billDelivery: 'EMAIL' | 'POST';
}

export interface Concession {
  cardType: string;
  cardNumber: string;
  startDate: string;
  endDate: string;
  holderName: string;
}

export interface ServiceInfo {
  serviceType: 'GAS' | 'POWER';
  serviceSubType: 'TRANSFER' | 'MOVE_IN';
  serviceConnectionId: string;
  serviceStartDate?: string;
  meterId?: string;
  lotNumber?: string;
  servicedAddress: ServicedAddress;
  offer: Offer;
  billingDetails: BillingDetails;
  concession?: Concession;
}

export interface TransactionPayload {
  transaction: TransactionInfo;
  customer: CustomerInfo;
  contacts: ContactInfo;
  service: ServiceInfo;
}

export interface TransactionRecord {
  id: string;
  internal_reference: string;
  sales_transaction_id: string | null;
  status: string;
  service_type: string;
  service_subtype: string;
  channel_name: string;
  customer_type: string;
  customer_name: string;
  customer_email: string;
  service_address: string;
  offer_code: string;
  submission_payload: TransactionPayload;
  momentum_response: Record<string, unknown> | null;
  error_details: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type TransactionStatus =
  | 'PENDING_SUBMISSION'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'VALIDATION_FAILED'
  | 'ONHOLD'
  | 'PENDING'
  | 'SUBMISSION_FAILED';
