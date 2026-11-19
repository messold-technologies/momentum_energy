/**
 * Offer resolution against the imported rate card.
 *
 * The contract this module exists to protect: the price shown to a customer and the
 * serviceOfferCode submitted to Momentum come from the SAME rate card row, so they
 * cannot drift apart. Nothing here derives a headline price from raw rates -- for
 * electricity the headline comes from the precomputed "Default Offer Momentum Cost"
 * column, which includes credits and discounts that the rate columns do not.
 */
import { query } from '../db/connection.js';
import { isFlatRate } from '../utils/rateCardParse.js';

/** Victoria compares against the VDO, other states against the AER's DMO. */
function benchmarkName(state) {
  return String(state).toUpperCase() === 'VIC'
    ? 'Victorian Default Offer'
    : 'Default Market Offer';
}

function comparisonLabel(differencePercent) {
  if (differencePercent === null || differencePercent === undefined) return null;
  const pct = Number(differencePercent);
  const rounded = Math.round(Math.abs(pct) * 100);
  if (rounded === 0) return 'equal to';
  return `${rounded}% ${pct < 0 ? 'less than' : 'more than'}`;
}

function money(v) {
  return v === null || v === undefined ? null : Number(v);
}

export async function getActiveVersion() {
  const { rows } = await query(
    `SELECT id, label, source_file, imported_at, stats
     FROM rate_card_versions WHERE is_active LIMIT 1`
  );
  return rows[0] || null;
}

async function requireActiveVersionId() {
  const v = await getActiveVersion();
  if (!v) {
    const err = new Error('No active rate card. Run: npm run import:ratecard -- <file.xlsx>');
    err.statusCode = 503;
    throw err;
  }
  return v.id;
}

/**
 * Postcode -> distribution network(s).
 * Electricity flags a default where a postcode spans several networks; gas does not, so
 * ambiguous gas postcodes come back with every option and no default for the agent to pick.
 */
export async function getNetworksForPostcode({ energyType, postcode }) {
  const versionId = await requireActiveVersionId();
  const { rows } = await query(
    `SELECT DISTINCT network_name, network_zone, is_default
     FROM postcode_network
     WHERE version_id = $1 AND energy_type = $2 AND postcode = $3
     ORDER BY is_default DESC, network_name`,
    [versionId, energyType, String(postcode).trim()]
  );
  return rows.map((r) => ({
    networkName: r.network_name,
    networkZone: r.network_zone,
    isDefault: r.is_default,
  }));
}

/** NMI / MIRN prefix -> network, so the distributor follows from the connection id. */
export async function getNetworkForConnectionId({ energyType, connectionId }) {
  const versionId = await requireActiveVersionId();
  const id = String(connectionId || '').trim().toUpperCase();
  if (id.length < 2) return null;

  const { rows } = await query(
    `SELECT prefix, network_name
     FROM nmi_prefix_network
     WHERE version_id = $1 AND energy_type = $2 AND upper($3) LIKE prefix || '%'
     ORDER BY length(prefix) DESC
     LIMIT 1`,
    [versionId, energyType, id]
  );
  return rows[0] ? { prefix: rows[0].prefix, networkName: rows[0].network_name } : null;
}

/**
 * Network tariff -> retail tariff code.
 * Electricity needs the site's Tariff_Combination_Key (network tariff + solar), which is
 * NOT derivable from the address -- it comes from NMI standing data or the customer's bill.
 * Gas is fully derivable from network zone + customer type.
 */
export async function getRetailTariffCodes({
  energyType,
  networkName,
  tariffCombinationKey,
  networkZone,
  customerType,
}) {
  const versionId = await requireActiveVersionId();

  if (energyType === 'GAS') {
    const { rows } = await query(
      `SELECT DISTINCT retail_tariff_code
       FROM tariff_map
       WHERE version_id = $1 AND energy_type = 'GAS'
         AND network_name = $2
         AND ($3::text IS NULL OR network_zone = $3)
         AND ($4::text IS NULL OR customer_type = $4)
       ORDER BY retail_tariff_code`,
      [versionId, networkName, networkZone || null, customerType || null]
    );
    return rows.map((r) => r.retail_tariff_code);
  }

  const { rows } = await query(
    `SELECT DISTINCT retail_tariff_code
     FROM tariff_map
     WHERE version_id = $1 AND energy_type = 'ELECTRICITY'
       AND network_name = $2
       AND ($3::text IS NULL OR tariff_combination_key = $3)
     ORDER BY retail_tariff_code`,
    [versionId, networkName, tariffCombinationKey || null]
  );
  return rows.map((r) => r.retail_tariff_code);
}

/**
 * Network tariffs available on a network, for the agent to pick from the customer's bill.
 *
 * Momentum's API has no address or NMI lookup -- only submit, status and credit check --
 * so the site's network tariff cannot be derived from the address. This at least turns
 * it from free text into a list the agent can search, and shows which retail tariff each
 * one resolves to.
 */
export async function getNetworkTariffOptions({ energyType, networkName }) {
  const versionId = await requireActiveVersionId();

  if (energyType === 'GAS') {
    const { rows } = await query(
      `SELECT DISTINCT network_zone AS key, retail_tariff_code, customer_type
       FROM tariff_map
       WHERE version_id = $1 AND energy_type = 'GAS' AND network_name = $2
         AND network_zone IS NOT NULL
       ORDER BY network_zone`,
      [versionId, networkName]
    );
    return rows.map((r) => ({
      key: r.key,
      retailTariffCode: r.retail_tariff_code,
      customerType: r.customer_type,
      solarApplicable: null,
    }));
  }

  const { rows } = await query(
    `SELECT DISTINCT tariff_combination_key AS key, retail_tariff_code, solar_applicable
     FROM tariff_map
     WHERE version_id = $1 AND energy_type = 'ELECTRICITY' AND network_name = $2
       AND tariff_combination_key IS NOT NULL
     ORDER BY tariff_combination_key`,
    [versionId, networkName]
  );
  return rows.map((r) => ({
    key: r.key,
    retailTariffCode: r.retail_tariff_code,
    customerType: null,
    solarApplicable: r.solar_applicable,
  }));
}

function buildCard(row, { annualUsage } = {}) {
  const rates = row.rates || null;
  const flat = isFlatRate(rates);

  // Headline price: the precomputed, GST-inclusive annual cost. Present for electricity,
  // absent for gas (the gas sheets carry no Default Offer columns).
  const annualCost = money(row.momentum_cost);

  // Optional, clearly-labelled secondary estimate when the caller supplies real usage.
  // Excludes credits and discounts, so it is never the headline.
  let usageEstimate = null;
  if (annualUsage && flat && row.daily_charge !== null) {
    const unitRate = rates?.peak?.[0]?.rate;
    if (unitRate !== undefined && unitRate !== null) {
      usageEstimate = Number(
        ((Number(row.daily_charge) * 365 + Number(annualUsage) * Number(unitRate)) / 100).toFixed(2)
      );
    }
  }

  return {
    offerCode: row.offer_code,
    offerWithRateNumber: row.offer_with_rate_number,
    offerNumber: row.offer_number,
    planCode: row.plan_code,

    energyType: row.energy_type,
    state: row.state,
    networkName: row.network_name,
    networkZone: row.network_zone,
    retailTariffCode: row.retail_tariff_code,
    customerType: row.customer_type,
    tariffCategory: row.tariff_category,
    isFlatRate: flat,

    effectiveStart: row.effective_start,
    effectiveEnd: row.effective_end,

    pricing: {
      currency: 'AUD',
      gstInclusive: true,
      dailyChargeCents: money(row.daily_charge),
      rates,
      annualCost,
      monthlyCost: annualCost === null ? null : Number((annualCost / 12).toFixed(2)),
      // Source of the headline figure, so the UI never mistakes an estimate for a quote.
      basis: annualCost === null ? 'unavailable' : 'rate-card-benchmark',
      benchmark: {
        name: benchmarkName(row.state),
        tariffType: row.benchmark_tariff_type,
        kwh: row.benchmark_kwh,
        cost: money(row.benchmark_cost),
      },
      comparison: {
        differenceDollar: money(row.difference_dollar),
        differencePercent: money(row.difference_percent),
        label: comparisonLabel(row.difference_percent),
      },
      usageEstimate:
        usageEstimate === null
          ? null
          : {
              annualUsage: Number(annualUsage),
              annualCost: usageEstimate,
              monthlyCost: Number((usageEstimate / 12).toFixed(2)),
              excludesCreditsAndDiscounts: true,
            },
    },

    plan: {
      features: row.features || [],
      contractTerm: row.contract_term,
      customerEligibility: row.customer_eligibility,
      terminationFee: row.termination_fee,
      dishonouredPaymentFee: row.dishonoured_payment_fee,
      creditCardPaymentFee: row.credit_card_payment_fee,
      billingOptions: row.billing_options,
      paymentOptions: row.payment_options,
      greenOptions: row.green_options,
      termsAndConditions: row.terms_and_conditions,
      stateAvailability: row.state_availability || [],
      extras: row.extras || {},
    },

    links: {
      factSheetUrl: row.bpid_url,
      cdrPlanCode: row.cdr_plan_code,
      cdrPlanId: row.cdr_plan_id,
    },

    solar: row.solar || null,
    demand: row.demand || null,
  };
}

const OFFER_SELECT = `
  SELECT r.*,
         p.features, p.contract_term, p.customer_eligibility, p.termination_fee,
         p.dishonoured_payment_fee, p.credit_card_payment_fee, p.billing_options,
         p.payment_options, p.green_options, p.terms_and_conditions,
         p.state_availability, p.extras
  FROM offer_rates r
  LEFT JOIN offer_plans p
    ON p.version_id = r.version_id
   AND p.plan_code = r.plan_code
   AND p.energy_type = r.energy_type
`;

/**
 * Offers sellable at a site. Narrowed by network + customer type, and by retail tariff
 * code when known. Without a tariff code the result spans every tariff on that network,
 * so callers that intend to submit must pass one (or use flatRateOnly for display).
 */
export async function findOffers({
  energyType,
  networkName,
  networkZone,
  customerType,
  retailTariffCode,
  planCode,
  flatRateOnly = false,
  asAt,
  annualUsage,
}) {
  const versionId = await requireActiveVersionId();
  const onDate = asAt || new Date().toISOString().slice(0, 10);

  const { rows } = await query(
    `${OFFER_SELECT}
     WHERE r.version_id = $1
       AND r.energy_type = $2
       AND r.network_name = $3
       AND r.customer_type = $4
       AND ($5::text IS NULL OR r.retail_tariff_code = $5)
       AND ($6::text IS NULL OR r.network_zone = $6)
       AND ($7::text IS NULL OR r.plan_code = $7)
       AND (r.effective_start IS NULL OR r.effective_start <= $8::date)
       AND (r.effective_end IS NULL OR r.effective_end >= $8::date)
     ORDER BY r.momentum_cost NULLS LAST, r.plan_code, r.retail_tariff_code`,
    [
      versionId,
      energyType,
      networkName,
      customerType,
      retailTariffCode || null,
      networkZone || null,
      planCode || null,
      onDate,
    ]
  );

  const cards = rows.map((r) => buildCard(r, { annualUsage }));
  return flatRateOnly ? cards.filter((c) => c.isFlatRate) : cards;
}

/**
 * Resolve a single offer code back to its card. Searches every version, not just the
 * active one, so a code on a historical submission stays explainable after a new rate
 * card lands.
 */
export async function getOfferByCode(offerCode) {
  const { rows } = await query(
    `${OFFER_SELECT}
     WHERE r.offer_code = $1
     ORDER BY r.version_id DESC
     LIMIT 1`,
    [offerCode]
  );
  if (!rows[0]) return null;
  return buildCard(rows[0]);
}

export const __test__ = { comparisonLabel, benchmarkName, buildCard };
