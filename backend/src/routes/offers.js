/**
 * Offer catalogue for the agent form.
 *
 * GET /api/offers/version                 active rate card version
 * GET /api/offers/networks                postcode or NMI/MIRN -> distribution network(s)
 * GET /api/offers/tariff-codes            network (+ tariff key / zone) -> retail tariff codes
 * GET /api/offers                         plan cards for a site
 * GET /api/offers/:offerCode              resolve a serviceOfferCode back to its card
 */
import express from 'express';
import { query, validationResult } from 'express-validator';

import logger from '../config/logger.js';
import {
  getActiveVersion,
  getNetworksForPostcode,
  getNetworkForConnectionId,
  getRetailTariffCodes,
  findOffers,
  getOfferByCode,
} from '../services/offerService.js';

const router = express.Router();

const ENERGY_TYPES = ['ELECTRICITY', 'GAS'];
const CUSTOMER_TYPES = ['RESIDENTIAL', 'COMMERCIAL'];

/** Accept the Momentum API's own vocabulary as well as the rate card's. */
function normaliseCustomerTypeParam(v) {
  const s = String(v || '').trim().toUpperCase();
  if (['RESIDENT', 'RESIDENTIAL'].includes(s)) return 'RESIDENTIAL';
  if (['COMPANY', 'COMMERCIAL', 'BUSINESS', 'SME'].includes(s)) return 'COMMERCIAL';
  return s;
}

function normaliseEnergyTypeParam(v) {
  const s = String(v || '').trim().toUpperCase();
  return s === 'POWER' ? 'ELECTRICITY' : s;
}

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

router.get('/version', async (_req, res, next) => {
  try {
    const version = await getActiveVersion();
    if (!version) {
      return res.status(503).json({
        success: false,
        error: 'No active rate card. Run: npm run import:ratecard -- <file.xlsx>',
      });
    }
    res.json({
      success: true,
      data: {
        id: version.id,
        label: version.label,
        sourceFile: version.source_file,
        importedAt: version.imported_at,
        stats: version.stats,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get(
  '/networks',
  [
    query('energyType').customSanitizer(normaliseEnergyTypeParam).isIn(ENERGY_TYPES)
      .withMessage(`energyType must be one of ${ENERGY_TYPES.join(', ')}`),
    query('postcode').optional().matches(/^\d{4}$/).withMessage('postcode must be 4 digits'),
    query('connectionId').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    const { energyType, postcode, connectionId } = req.query;
    if (!postcode && !connectionId) {
      return res.status(400).json({
        success: false,
        error: 'Provide postcode or connectionId (NMI/MIRN)',
      });
    }

    try {
      const byConnection = connectionId
        ? await getNetworkForConnectionId({ energyType, connectionId })
        : null;
      const byPostcode = postcode
        ? await getNetworksForPostcode({ energyType, postcode })
        : [];

      // A postcode spanning several networks is resolved by the default flag for
      // electricity. Gas carries no default, so the agent must choose.
      const requiresSelection =
        !byConnection && byPostcode.length > 1 && !byPostcode.some((n) => n.isDefault);

      res.json({
        success: true,
        data: {
          fromConnectionId: byConnection,
          networks: byPostcode,
          defaultNetwork:
            byConnection?.networkName
            ?? byPostcode.find((n) => n.isDefault)?.networkName
            ?? (byPostcode.length === 1 ? byPostcode[0].networkName : null),
          requiresSelection,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/tariff-codes',
  [
    query('energyType').customSanitizer(normaliseEnergyTypeParam).isIn(ENERGY_TYPES),
    query('networkName').isString().notEmpty(),
    query('tariffCombinationKey').optional().isString(),
    query('networkZone').optional().isString(),
    query('customerType').optional().customSanitizer(normaliseCustomerTypeParam).isIn(CUSTOMER_TYPES),
  ],
  validate,
  async (req, res, next) => {
    try {
      const codes = await getRetailTariffCodes({
        energyType: req.query.energyType,
        networkName: req.query.networkName,
        tariffCombinationKey: req.query.tariffCombinationKey,
        networkZone: req.query.networkZone,
        customerType: req.query.customerType,
      });
      res.json({ success: true, data: { retailTariffCodes: codes } });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/',
  [
    query('energyType').customSanitizer(normaliseEnergyTypeParam).isIn(ENERGY_TYPES)
      .withMessage(`energyType must be one of ${ENERGY_TYPES.join(', ')}`),
    query('customerType').customSanitizer(normaliseCustomerTypeParam).isIn(CUSTOMER_TYPES)
      .withMessage(`customerType must be one of ${CUSTOMER_TYPES.join(', ')}`),
    query('postcode').optional().matches(/^\d{4}$/).withMessage('postcode must be 4 digits'),
    query('networkName').optional().isString(),
    query('networkZone').optional().isString(),
    query('connectionId').optional().isString(),
    query('retailTariffCode').optional().isString(),
    query('tariffCombinationKey').optional().isString(),
    query('planCode').optional().isString(),
    query('annualUsage').optional().isFloat({ min: 0 }).toFloat(),
    query('flatRateOnly').optional().isBoolean().toBoolean(),
    query('hasEV').optional().isBoolean().toBoolean(),
  ],
  validate,
  async (req, res, next) => {
    const {
      energyType,
      customerType,
      postcode,
      networkZone,
      connectionId,
      retailTariffCode,
      tariffCombinationKey,
      planCode,
      annualUsage,
      hasEV,
    } = req.query;

    try {
      // Resolve the network: explicit > NMI prefix > postcode default.
      let networkName = req.query.networkName || null;
      let resolvedVia = networkName ? 'explicit' : null;

      if (!networkName && connectionId) {
        const hit = await getNetworkForConnectionId({ energyType, connectionId });
        if (hit) {
          networkName = hit.networkName;
          resolvedVia = 'connectionId';
        }
      }

      let postcodeNetworks = [];
      if (!networkName && postcode) {
        postcodeNetworks = await getNetworksForPostcode({ energyType, postcode });
        const def = postcodeNetworks.find((n) => n.isDefault) || (postcodeNetworks.length === 1 ? postcodeNetworks[0] : null);
        if (def) {
          networkName = def.networkName;
          resolvedVia = 'postcodeDefault';
        }
      }

      if (!networkName) {
        return res.status(409).json({
          success: false,
          error: postcodeNetworks.length
            ? 'Postcode maps to multiple networks with no default. Select a network.'
            : 'Could not resolve a distribution network. Provide networkName, connectionId or a known postcode.',
          data: { networks: postcodeNetworks },
        });
      }

      // Gas zone follows from the postcode when not supplied.
      let zone = networkZone || null;
      if (!zone && energyType === 'GAS' && postcode) {
        if (!postcodeNetworks.length) {
          postcodeNetworks = await getNetworksForPostcode({ energyType, postcode });
        }
        zone = postcodeNetworks.find((n) => n.networkName === networkName)?.networkZone || null;
      }

      // Narrow to one tariff where possible. Electricity needs the site's network tariff,
      // which the address cannot supply; without it we fall back to flat-rate rows for
      // display, the same simplification Momentum's own site makes.
      let tariffCode = retailTariffCode || null;
      if (!tariffCode && (tariffCombinationKey || energyType === 'GAS')) {
        const codes = await getRetailTariffCodes({
          energyType,
          networkName,
          tariffCombinationKey,
          networkZone: zone,
          customerType,
        });
        if (codes.length === 1) [tariffCode] = codes;
      }

      const indicativeOnly = !tariffCode;

      let offers = await findOffers({
        energyType,
        networkName,
        networkZone: zone,
        customerType,
        retailTariffCode: tariffCode,
        planCode,
        flatRateOnly: req.query.flatRateOnly ?? indicativeOnly,
        annualUsage,
      });

      // "I have an electric vehicle" surfaces the EV plan; otherwise it stays hidden,
      // matching how Momentum gates it on their own site.
      if (hasEV === false || hasEV === undefined) {
        offers = offers.filter((o) => !/^EV Does It/i.test(o.planCode));
      }

      res.json({
        success: true,
        data: {
          resolved: {
            energyType,
            customerType,
            networkName,
            networkZone: zone,
            retailTariffCode: tariffCode,
            resolvedVia,
          },
          // True when no retail tariff code was known, so prices are the flat-rate
          // benchmark figures and the submitted offer code must be re-resolved once the
          // site's real network tariff is established.
          indicativeOnly,
          count: offers.length,
          offers,
        },
      });
    } catch (err) {
      if (err.statusCode === 503) {
        return res.status(503).json({ success: false, error: err.message });
      }
      logger.error('Offer lookup failed', { error: err.message });
      next(err);
    }
  }
);

router.get('/:offerCode', async (req, res, next) => {
  const { offerCode } = req.params;
  if (!/^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(offerCode)) {
    return res.status(400).json({ success: false, error: 'Invalid offer code format' });
  }
  try {
    const offer = await getOfferByCode(offerCode);
    if (!offer) {
      return res.status(404).json({ success: false, error: 'Offer code not found in any rate card version' });
    }
    res.json({ success: true, data: offer });
  } catch (err) {
    next(err);
  }
});

export default router;
