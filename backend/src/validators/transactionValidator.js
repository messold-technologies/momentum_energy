import { body, validationResult } from 'express-validator';

const isWithin3Days = (value) => {
  const date = new Date(value);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  if (date < threeDaysAgo) throw new Error('Transaction date cannot be more than 3 days in the past');
  return true;
};

const isWithin14Days = (value) => {
  const date = new Date(value);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  if (date < fourteenDaysAgo) throw new Error('Quote date cannot be more than 14 days old');
  return true;
};

const isOver18 = (value) => {
  const dob = new Date(value);
  const eighteenYearsAgo = new Date();
  eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
  if (dob > eighteenYearsAgo) throw new Error('Customer must be 18 years or older');
  return true;
};

const isNotExpired = (value) => {
  const expDate = new Date(value);
  if (expDate < new Date()) throw new Error('Identity document must not be expired');
  return true;
};

const isNotPastDate = (value) => {
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today) throw new Error('Date cannot be in the past');
  return true;
};

const transactionValidationRules = [
  // Transaction
  body('transaction.transactionReference')
    .notEmpty().withMessage('Transaction reference is required')
    .matches(/^[A-Za-z0-9\-]{1,30}$/).withMessage('Max 30 chars: letters, numbers, hyphens only'),
  body('transaction.transactionChannel')
    .notEmpty().withMessage('Transaction channel is required')
    .matches(/^[A-Za-z0-9\s]+$/).withMessage('Letters, numbers, and spaces only'),
  body('transaction.transactionDate').isISO8601().custom(isWithin3Days),
  body('transaction.transactionSource').equals('EXTERNAL').withMessage('Transaction source must be EXTERNAL'),

  // Customer
  body('customer.customerType').isIn(['RESIDENT', 'COMPANY']).withMessage('Customer type must be RESIDENT or COMPANY'),
  body('customer.promotionAllowed').equals('true').withMessage('Customer consent must be obtained'),

  // Resident identity
  body('customer.residentIdentity.passport').optional().custom((value) => {
    if (value?.documentId && !value.documentExpiryDate) throw new Error('Passport expiry date is required');
    if (value?.documentId && !value.issuingCountry) throw new Error('Passport issuing country is required');
    if (value?.documentExpiryDate) isNotExpired(value.documentExpiryDate);
    return true;
  }),
  body('customer.residentIdentity.drivingLicense').optional().custom((value) => {
    if (value?.documentId && !value.documentExpiryDate) throw new Error('Driving license expiry date is required');
    if (value?.documentExpiryDate) isNotExpired(value.documentExpiryDate);
    return true;
  }),
  body('customer.residentIdentity.medicare').optional().custom((value) => {
    if (value?.documentId && !value.documentExpiryDate) throw new Error('Medicare expiry date is required');
    if (value?.documentExpiryDate) isNotExpired(value.documentExpiryDate);
    return true;
  }),

  // Company identity
  body('customer.companyIdentity.abn.documentId').optional().matches(/^\d{11}$/).withMessage('ABN must be 11 digits'),
  body('customer.companyIdentity.acn.documentId').optional().matches(/^\d{9}$/).withMessage('ACN must be 9 digits'),

  // Primary contact
  body('customer.contacts.primaryContact.firstName').notEmpty().withMessage('Primary contact first name required'),
  body('customer.contacts.primaryContact.lastName').notEmpty().withMessage('Primary contact last name required'),
  body('customer.contacts.primaryContact.dateOfBirth').isISO8601().custom(isOver18),
  body('customer.contacts.primaryContact.email').optional().isEmail().withMessage('Primary contact email must be valid'),

  // Service
  body('service.serviceType').isIn(['GAS', 'POWER']).withMessage('Service type must be GAS or POWER'),
  body('service.serviceSubType').isIn(['TRANSFER', 'MOVE IN']).withMessage('Service sub-type must be TRANSFER or MOVE IN'),
  body('service.serviceConnectionId').notEmpty().withMessage('NMI/MIRN is required'),

  // MOVE IN requires start date
  body('service.serviceStartDate').custom((value, { req }) => {
    if (req.body.service?.serviceSubType === 'MOVE IN') {
      if (!value) throw new Error('Service start date is required for MOVE IN');
      isNotPastDate(value);
    }
    return true;
  }),

  // Service billing
  body('service.serviceBilling.serviceOfferCode').notEmpty().withMessage('Offer code is required'),
  body('service.serviceBilling.offerQuoteDate').isISO8601().custom(isWithin14Days),

  body('service.serviceBilling.billCycleCode').custom((value, { req }) => {
    const serviceType = req.body.service?.serviceType;
    if (serviceType === 'GAS' && value !== 'Bi-Monthly') {
      throw new Error('GAS service must use Bi-Monthly bill cycle');
    }
    if (serviceType === 'POWER' && !['Monthly', 'Quarterly'].includes(value)) {
      throw new Error('POWER service must use Monthly or Quarterly bill cycle');
    }
    return true;
  }),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

export { transactionValidationRules, validate };
