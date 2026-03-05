const { validateTransaction } = require('../src/validators/transactionValidator');

// Minimal valid transaction payload for testing
const validBasePayload = () => ({
  customerType: 'RESIDENT',
  communicationPreference: 'EMAIL',
  primaryContact: {
    salutation: 'Mr',
    firstName: 'John',
    lastName: 'Smith',
    dateOfBirth: '1985-06-15',
    email: 'john.smith@example.com',
    phones: [{ type: 'MOBILE', number: '0412345678' }],
    address: {
      streetNumber: '123',
      streetName: 'Collins',
      streetType: 'Street',
      suburb: 'Melbourne',
      state: 'VIC',
      postcode: '3000',
    },
  },
  identityDocument: {
    type: 'DRIVING_LICENCE',
    licenceNumber: 'DL123456',
    licenceState: 'VIC',
    licenceExpiry: '2028-06-15',
  },
  serviceType: 'POWER',
  serviceSubtype: 'TRANSFER',
  serviceConnectionId: '1234567890123',
  servicedAddress: {
    streetNumber: '456',
    streetName: 'Bourke',
    streetType: 'Street',
    suburb: 'Melbourne',
    state: 'VIC',
    postcode: '3000',
  },
  offerDetails: {
    offerId: 'OFFER-001',
    quoteDate: new Date().toISOString().slice(0, 10), // Today
    planName: 'Basic Power Plan',
    contractTerm: 12,
  },
  billCycleCode: 'MONTHLY',
  billDelivery: 'EMAIL',
  paymentMethod: {
    type: 'CHEQUE',
  },
});

describe('Transaction Validator', () => {

  describe('Valid payloads', () => {
    test('should accept a valid RESIDENT POWER TRANSFER transaction', () => {
      const { error } = validateTransaction(validBasePayload());
      expect(error).toBeUndefined();
    });

    test('should accept a valid COMPANY transaction', () => {
      const payload = {
        ...validBasePayload(),
        customerType: 'COMPANY',
        company: {
          abn: '12345678901',
          entityName: 'Test Pty Ltd',
          tradingName: 'TestCo',
        },
      };
      delete payload.identityDocument;
      const { error } = validateTransaction(payload);
      expect(error).toBeUndefined();
    });

    test('should accept GAS transaction with BI_MONTHLY cycle', () => {
      const payload = { ...validBasePayload(), serviceType: 'GAS', billCycleCode: 'BI_MONTHLY' };
      const { error } = validateTransaction(payload);
      expect(error).toBeUndefined();
    });

    test('should accept MOVE_IN with future service start date', () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const payload = {
        ...validBasePayload(),
        serviceSubtype: 'MOVE_IN',
        serviceStartDate: tomorrow,
      };
      const { error } = validateTransaction(payload);
      expect(error).toBeUndefined();
    });

    test('should accept NSW driving licence with document number', () => {
      const payload = {
        ...validBasePayload(),
        identityDocument: {
          type: 'DRIVING_LICENCE',
          licenceNumber: 'DL999888',
          licenceState: 'NSW',
          licenceExpiry: '2029-01-01',
          documentNumber: 'DOC12345',
        },
      };
      const { error } = validateTransaction(payload);
      expect(error).toBeUndefined();
    });

    test('should accept PASSPORT identity document', () => {
      const payload = {
        ...validBasePayload(),
        identityDocument: {
          type: 'PASSPORT',
          passportNumber: 'PA123456',
          countryOfBirth: 'Australia',
          passportExpiry: '2030-01-01',
        },
      };
      const { error } = validateTransaction(payload);
      expect(error).toBeUndefined();
    });

    test('should accept MEDICARE card', () => {
      const payload = {
        ...validBasePayload(),
        identityDocument: {
          type: 'MEDICARE',
          medicareNumber: '2123456701',
          medicareRef: '1',
          medicareExpiry: '2028-06',
        },
      };
      const { error } = validateTransaction(payload);
      expect(error).toBeUndefined();
    });

    test('should accept DIRECT_DEBIT payment method', () => {
      const payload = {
        ...validBasePayload(),
        paymentMethod: {
          type: 'DIRECT_DEBIT',
          bankName: 'CBA',
          bsb: '062000',
          accountNumber: '12345678',
          accountName: 'John Smith',
        },
      };
      const { error } = validateTransaction(payload);
      expect(error).toBeUndefined();
    });
  });

  describe('Customer age validation', () => {
    test('should reject customer under 18', () => {
      const payload = validBasePayload();
      payload.primaryContact.dateOfBirth = new Date(Date.now() - 15 * 365.25 * 86400000).toISOString().slice(0, 10);
      const { error } = validateTransaction(payload);
      expect(error).toBeDefined();
      expect(error.details.some(d => d.message.includes('18'))).toBe(true);
    });

    test('should accept customer exactly 18', () => {
      const dob = new Date(Date.now() - 18 * 365.25 * 86400000 - 86400000).toISOString().slice(0, 10);
      const payload = validBasePayload();
      payload.primaryContact.dateOfBirth = dob;
      const { error } = validateTransaction(payload);
      expect(error).toBeUndefined();
    });
  });

  describe('Identity document validation', () => {
    test('should reject RESIDENT without identity document', () => {
      const payload = validBasePayload();
      delete payload.identityDocument;
      const { error } = validateTransaction(payload);
      expect(error).toBeDefined();
    });

    test('should reject NSW licence without document number', () => {
      const payload = {
        ...validBasePayload(),
        identityDocument: {
          type: 'DRIVING_LICENCE',
          licenceNumber: 'DL123',
          licenceState: 'NSW',
          licenceExpiry: '2029-01-01',
          // Missing documentNumber
        },
      };
      const { error } = validateTransaction(payload);
      expect(error).toBeDefined();
    });

    test('should reject COMPANY with identity document', () => {
      const payload = {
        ...validBasePayload(),
        customerType: 'COMPANY',
        company: { abn: '12345678901', entityName: 'Test Co' },
        identityDocument: { type: 'PASSPORT', passportNumber: 'X123', countryOfBirth: 'AU', passportExpiry: '2030-01-01' },
      };
      const { error } = validateTransaction(payload);
      expect(error).toBeDefined();
    });
  });

  describe('Service type and bill cycle validation', () => {
    test('should reject GAS with MONTHLY bill cycle', () => {
      const payload = { ...validBasePayload(), serviceType: 'GAS', billCycleCode: 'MONTHLY' };
      const { error } = validateTransaction(payload);
      expect(error).toBeDefined();
    });

    test('should reject POWER with BI_MONTHLY bill cycle', () => {
      const payload = { ...validBasePayload(), serviceType: 'POWER', billCycleCode: 'BI_MONTHLY' };
      const { error } = validateTransaction(payload);
      expect(error).toBeDefined();
    });
  });

  describe('Offer date validation', () => {
    test('should reject offer quote date older than 14 days', () => {
      const payload = validBasePayload();
      const oldDate = new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10);
      payload.offerDetails.quoteDate = oldDate;
      const { error } = validateTransaction(payload);
      expect(error).toBeDefined();
    });

    test('should accept offer quote date within 14 days', () => {
      const payload = validBasePayload();
      const recentDate = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
      payload.offerDetails.quoteDate = recentDate;
      const { error } = validateTransaction(payload);
      expect(error).toBeUndefined();
    });
  });

  describe('MOVE_IN validation', () => {
    test('should require serviceStartDate for MOVE_IN', () => {
      const payload = { ...validBasePayload(), serviceSubtype: 'MOVE_IN' };
      const { error } = validateTransaction(payload);
      expect(error).toBeDefined();
    });

    test('should reject past service start date', () => {
      const payload = {
        ...validBasePayload(),
        serviceSubtype: 'MOVE_IN',
        serviceStartDate: '2020-01-01',
      };
      const { error } = validateTransaction(payload);
      expect(error).toBeDefined();
    });
  });

  describe('ABN validation', () => {
    test('should reject ABN with wrong length', () => {
      const payload = {
        ...validBasePayload(),
        customerType: 'COMPANY',
        company: { abn: '123456789', entityName: 'Short ABN Co' }, // Only 9 digits
      };
      delete payload.identityDocument;
      const { error } = validateTransaction(payload);
      expect(error).toBeDefined();
    });
  });

  describe('Phone validation', () => {
    test('should reject invalid phone number', () => {
      const payload = validBasePayload();
      payload.primaryContact.phones = [{ type: 'MOBILE', number: '12345' }];
      const { error } = validateTransaction(payload);
      expect(error).toBeDefined();
    });

    test('should reject empty phones array', () => {
      const payload = validBasePayload();
      payload.primaryContact.phones = [];
      const { error } = validateTransaction(payload);
      expect(error).toBeDefined();
    });
  });

  describe('Address validation', () => {
    test('should reject invalid state code', () => {
      const payload = validBasePayload();
      payload.servicedAddress.state = 'INVALID';
      const { error } = validateTransaction(payload);
      expect(error).toBeDefined();
    });

    test('should reject postcode with wrong length', () => {
      const payload = validBasePayload();
      payload.servicedAddress.postcode = '300';
      const { error } = validateTransaction(payload);
      expect(error).toBeDefined();
    });
  });
});
