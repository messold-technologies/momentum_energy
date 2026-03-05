import { body, validationResult } from 'express-validator';


// Helper to check date is not in the past
const isNotPastDate = (value) => {
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today) throw new Error('Date cannot be in the past');
  return true;
};

// Check transaction date is within 3 days
const isWithin3Days = (value) => {
  const date = new Date(value);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  if (date < threeDaysAgo) throw new Error('Transaction date cannot be more than 3 days in the past');
  return true;
};

// Check quote date is within 14 days
const isWithin14Days = (value) => {
  const date = new Date(value);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  if (date < fourteenDaysAgo) throw new Error('Quote date cannot be more than 14 days old');
  return true;
};

// Check age is 18+
const isOver18 = (value) => {
  const dob = new Date(value);
  const eighteenYearsAgo = new Date();
  eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
  if (dob > eighteenYearsAgo) throw new Error('Customer must be 18 years or older');
  return true;
};

// Check document is not expired
const isNotExpired = (value) => {
  const expDate = new Date(value);
  if (expDate < new Date()) throw new Error('Identity document must not be expired');
  return true;
};

const transactionValidationRules = [
  // Transaction metadata
  body('transaction.transactionReferenceId').notEmpty().withMessage('Transaction reference ID is required'),
  body('transaction.channelName').notEmpty().withMessage('Channel name is required'),
  body('transaction.transactionDate').isISO8601().custom(isWithin3Days),
  body('transaction.source').equals('EXTERNAL').withMessage('Source must be EXTERNAL'),

  // Customer
  body('customer.customerType').isIn(['RESIDENT', 'COMPANY']).withMessage('Customer type must be RESIDENT or COMPANY'),
  body('customer.promotionConsent').equals('true').withMessage('Promotion consent must be accepted'),

  // Resident-specific
  body('customer.passport').optional().custom((value, { req }) => {
    if (value && !value.expiryDate) throw new Error('Passport expiry date is required');
    if (value && !value.countryOfBirth) throw new Error('Passport country of birth is required');
    if (value?.expiryDate) isNotExpired(value.expiryDate);
    return true;
  }),
  body('customer.drivingLicense').optional().custom((value) => {
    if (value && !value.expiryDate) throw new Error('Driving license expiry date is required');
    if (value?.expiryDate) isNotExpired(value.expiryDate);
    return true;
  }),
  body('customer.medicareCard').optional().custom((value) => {
    if (value && !value.expiryDate) throw new Error('Medicare card expiry date is required');
    if (value?.expiryDate) isNotExpired(value.expiryDate);
    return true;
  }),

  // Company-specific
  body('customer.abn').optional().matches(/^\d{11}$/).withMessage('ABN must be 11 digits'),
  body('customer.acn').optional().matches(/^\d{9}$/).withMessage('ACN must be 9 digits'),

  // Primary contact
  body('contacts.primaryContact.firstName').notEmpty().withMessage('Primary contact first name required'),
  body('contacts.primaryContact.lastName').notEmpty().withMessage('Primary contact last name required'),
  body('contacts.primaryContact.dateOfBirth').isISO8601().custom(isOver18),
  body('contacts.primaryContact.email').optional().isEmail().withMessage('Primary contact email must be valid'),

  // Service
  body('service.serviceType').isIn(['GAS', 'POWER']).withMessage('Service type must be GAS or POWER'),
  body('service.serviceSubType').isIn(['TRANSFER', 'MOVE_IN']).withMessage('Service sub-type must be TRANSFER or MOVE_IN'),
  body('service.serviceConnectionId').notEmpty().withMessage('NMI/MIRN is required'),

  // MOVE_IN requires start date
  body('service.serviceStartDate').custom((value, { req }) => {
    if (req.body.service?.serviceSubType === 'MOVE_IN') {
      if (!value) throw new Error('Service start date is required for MOVE IN');
      isNotPastDate(value);
    }
    return true;
  }),

  // Offer
  body('service.offer.offerCode').notEmpty().withMessage('Offer code is required'),
  body('service.offer.quoteDate').isISO8601().custom(isWithin14Days),

  // Bill cycle validation
  body('service.billingDetails.billCycleCode').custom((value, { req }) => {
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
