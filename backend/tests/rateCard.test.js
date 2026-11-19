const {
  num,
  str,
  bool,
  dateOnly,
  cellValue,
  normalisePlan,
  normaliseCustomerType,
  normaliseEnergyType,
  cdrPlanId,
  collectRates,
  collectPrefixed,
  isFlatRate,
} = require('../src/utils/rateCardParse');

const { __test__ } = require('../src/services/offerService');

describe('rate card parsing', () => {
  describe('cellValue', () => {
    test('unwraps exceljs formula results', () => {
      expect(cellValue({ formula: 'A1*2', result: 42 })).toBe(42);
    });
    test('unwraps hyperlink cells to their text', () => {
      expect(cellValue({ text: 'Fact sheet', hyperlink: 'https://x/y' })).toBe('Fact sheet');
    });
    test('joins rich text runs', () => {
      expect(cellValue({ richText: [{ text: 'Bill ' }, { text: 'Boss' }] })).toBe('Bill Boss');
    });
    test('blank-ish strings become null', () => {
      expect(cellValue('   ')).toBeNull();
      expect(cellValue(null)).toBeNull();
    });
  });

  describe('num', () => {
    // The workbook stores values such as 166.20999999999998 and 0.47630000000000006.
    test('rounds away Excel float artifacts', () => {
      expect(num(166.20999999999998, 2)).toBe(166.21);
      expect(num(0.47630000000000006)).toBe(0.4763);
      expect(num(2.9699999999999998, 2)).toBe(2.97);
    });
    test('strips currency and percent decoration', () => {
      expect(num('$1,285.00', 2)).toBe(1285);
    });
    test('non-numeric and blank become null', () => {
      expect(num('')).toBeNull();
      expect(num('n/a')).toBeNull();
      expect(num(null)).toBeNull();
    });
    test('zero is preserved, not treated as blank', () => {
      expect(num(0)).toBe(0);
    });
  });

  describe('normalisePlan', () => {
    // The rate card writes "Bill Boss Electricity." with a trailing dot; the Offers sheet
    // and the Momentum servicePlanCode enum do not. Unnormalised, every join drops it.
    test('strips the trailing full stop', () => {
      expect(normalisePlan('Bill Boss Electricity.')).toBe('Bill Boss Electricity');
    });
    test('leaves clean names untouched', () => {
      expect(normalisePlan('Suit Yourself Gas')).toBe('Suit Yourself Gas');
    });
    test('collapses internal whitespace', () => {
      expect(normalisePlan('  Warm   Welcome  ')).toBe('Warm Welcome');
    });
    test('both spellings normalise to the same key', () => {
      expect(normalisePlan('Bill Boss Electricity.')).toBe(normalisePlan('Bill Boss Electricity'));
    });
  });

  describe('normaliseCustomerType', () => {
    test('maps the three vocabularies onto one', () => {
      expect(normaliseCustomerType('Residential')).toBe('RESIDENTIAL');
      expect(normaliseCustomerType('Commercial')).toBe('COMMERCIAL');
      expect(normaliseCustomerType('SME only')).toBe('COMMERCIAL');
      expect(normaliseCustomerType('Small business')).toBe('COMMERCIAL');
    });
  });

  describe('normaliseEnergyType', () => {
    test('maps workbook spellings', () => {
      expect(normaliseEnergyType('Electricity')).toBe('ELECTRICITY');
      expect(normaliseEnergyType('Gas')).toBe('GAS');
    });
  });

  describe('cdrPlanId', () => {
    // Victoria publishes via Victorian Energy Compare; everywhere else via Energy Made
    // Easy. The wrong suffix returns a bare 404 from the CDR API.
    test('VIC gets @VEC', () => {
      expect(cdrPlanId('MOM799481MR', 'VIC')).toBe('MOM799481MR@VEC');
    });
    test('other states get @EME', () => {
      expect(cdrPlanId('MOM1162824MRE2', 'NSW')).toBe('MOM1162824MRE2@EME');
      expect(cdrPlanId('MOM1162916MRE2', 'SA')).toBe('MOM1162916MRE2@EME');
      expect(cdrPlanId('MOM1214325MBE1', 'QLD')).toBe('MOM1214325MBE1@EME');
    });
    test('missing code yields null rather than a bare suffix', () => {
      expect(cdrPlanId(null, 'VIC')).toBeNull();
    });
  });

  describe('collectRates', () => {
    const headers = [
      'Peak_Block1_Limit', 'Peak_Block1_Rate', 'Peak_Block2_Rate',
      'Shoulder_Block1_Rate', 'Offpeak_Block1_Rate', 'ControlledLoad1_Block1_Rate',
      'Peak Season 2 Rate 1',
    ];

    test('groups block columns into structured rates', () => {
      const row = {
        Peak_Block1_Limit: 1000,
        Peak_Block1_Rate: 47.63,
        Shoulder_Block1_Rate: 22.55,
        Offpeak_Block1_Rate: 17.6,
      };
      expect(collectRates(row, headers)).toEqual({
        peak: [{ block: 1, limit: 1000, rate: 47.63 }],
        shoulder: [{ block: 1, rate: 22.55 }],
        offpeak: [{ block: 1, rate: 17.6 }],
      });
    });

    test('empty cells are omitted entirely', () => {
      const row = { Peak_Block1_Rate: 25.96, Shoulder_Block1_Rate: '', Offpeak_Block1_Rate: null };
      const out = collectRates(row, headers);
      expect(out).toEqual({ peak: [{ block: 1, rate: 25.96 }] });
      expect(out.shoulder).toBeUndefined();
    });

    test('OffPeak and Offpeak spellings land in one group', () => {
      const out = collectRates(
        { Offpeak_Block1_Rate: 3.08, OffPeak_Block2_Rate: 2.97 },
        ['Offpeak_Block1_Rate', 'OffPeak_Block2_Rate']
      );
      expect(out.offpeak).toEqual([{ block: 1, rate: 3.08 }, { block: 2, rate: 2.97 }]);
    });

    test('returns null when a row carries no rates at all', () => {
      expect(collectRates({}, headers)).toBeNull();
    });
  });

  describe('collectPrefixed', () => {
    test('keeps only populated columns with the prefix', () => {
      const headers = ['Solar_Scheme1_Code', 'Solar_Scheme1_Rate_1', 'Solar_Scheme2_Code'];
      const row = { Solar_Scheme1_Code: 'General Feed-in Tariff', Solar_Scheme1_Rate_1: -0.009, Solar_Scheme2_Code: '' };
      expect(collectPrefixed(row, headers, 'Solar_')).toEqual({
        Solar_Scheme1_Code: 'General Feed-in Tariff',
        Solar_Scheme1_Rate_1: -0.009,
      });
    });
    test('returns null when nothing matches', () => {
      expect(collectPrefixed({}, ['Demand_Flag'], 'Solar_')).toBeNull();
    });
  });

  describe('isFlatRate', () => {
    // Momentum's own site quotes flat-rate tariffs by default, which is what lets an
    // agent see a price before the site's real network tariff is known.
    test('single peak block with no shoulder or offpeak is flat', () => {
      expect(isFlatRate({ peak: [{ block: 1, rate: 25.96 }] })).toBe(true);
    });
    test('time of use is not flat', () => {
      expect(isFlatRate({
        peak: [{ block: 1, rate: 38.28 }],
        shoulder: [{ block: 1, rate: 21.12 }],
        offpeak: [{ block: 1, rate: 16.61 }],
      })).toBe(false);
    });
    test('block tariff is not flat', () => {
      expect(isFlatRate({ peak: [{ block: 1, rate: 3.08 }, { block: 2, rate: 2.97 }] })).toBe(false);
    });
    test('null rates are not flat', () => {
      expect(isFlatRate(null)).toBe(false);
    });
  });

  describe('misc coercion', () => {
    test('bool reads the Default Network flag', () => {
      expect(bool(1)).toBe(true);
      expect(bool('1')).toBe(true);
      expect(bool(0)).toBe(false);
      expect(bool(null)).toBe(false);
    });
    test('dateOnly trims Excel timestamps to a date', () => {
      expect(dateOnly(new Date('2026-11-02T00:00:00Z'))).toBe('2026-11-02');
      expect(dateOnly(null)).toBeNull();
    });
    test('str trims', () => {
      expect(str('  EA010  ')).toBe('EA010');
    });
  });
});

describe('offer cards', () => {
  const { comparisonLabel, benchmarkName, buildCard } = __test__;

  describe('comparisonLabel', () => {
    test('matches the wording on Momentum\'s own plan cards', () => {
      expect(comparisonLabel(-0.13)).toBe('13% less than');
      expect(comparisonLabel(-0.1)).toBe('10% less than');
      expect(comparisonLabel(0)).toBe('equal to');
      expect(comparisonLabel(0.25)).toBe('25% more than');
    });
    test('missing difference yields no label', () => {
      expect(comparisonLabel(null)).toBeNull();
    });
  });

  describe('benchmarkName', () => {
    test('VIC compares against the VDO, other states the DMO', () => {
      expect(benchmarkName('VIC')).toBe('Victorian Default Offer');
      expect(benchmarkName('NSW')).toBe('Default Market Offer');
    });
  });

  describe('buildCard', () => {
    // Mirrors the Warm Welcome / Citipower / Residential row, which Momentum's public
    // site shows as "13% less than Victorian Default Offer, $107/month, $1285/year".
    const row = {
      offer_code: 'a44Mp000042WAZYIA4',
      plan_code: 'Warm Welcome',
      energy_type: 'ELECTRICITY',
      state: 'VIC',
      network_name: 'Citipower',
      retail_tariff_code: 'C1R',
      customer_type: 'RESIDENTIAL',
      daily_charge: 113.85,
      rates: { peak: [{ block: 1, rate: 22.99 }] },
      cdr_plan_code: 'MOM799481MR',
      cdr_plan_id: 'MOM799481MR@VEC',
      benchmark_cost: 1481,
      benchmark_kwh: 4000,
      momentum_cost: 1285,
      difference_dollar: -196,
      difference_percent: -0.13,
    };

    test('headline price comes from the precomputed column', () => {
      const card = buildCard(row);
      expect(card.pricing.annualCost).toBe(1285);
      expect(card.pricing.monthlyCost).toBe(107.08);
      expect(card.pricing.basis).toBe('rate-card-benchmark');
      expect(card.pricing.gstInclusive).toBe(true);
    });

    test('comparison badge matches the public site', () => {
      const card = buildCard(row);
      expect(card.pricing.comparison.label).toBe('13% less than');
      expect(card.pricing.benchmark.name).toBe('Victorian Default Offer');
    });

    test('the submit code travels with the price', () => {
      const card = buildCard(row);
      expect(card.offerCode).toBe('a44Mp000042WAZYIA4');
      expect(card.links.cdrPlanId).toBe('MOM799481MR@VEC');
    });

    // Warm Welcome and EV Does It carry identical rates (both compute to $1335/yr), but
    // Momentum shows Warm Welcome at $1285 because a credit is baked into the precomputed
    // cost and not into the rate columns. A derived figure must never be the headline.
    test('usage estimate is secondary and flagged, never the headline', () => {
      const card = buildCard(row, { annualUsage: 4000 });
      expect(card.pricing.annualCost).toBe(1285);
      // (113.85c x 365 + 4000kWh x 22.99c) / 100 = $1335.15, i.e. $50 above the $1285
      // Momentum actually quotes.
      expect(card.pricing.usageEstimate.annualCost).toBe(1335.15);
      expect(card.pricing.usageEstimate.excludesCreditsAndDiscounts).toBe(true);
    });

    test('no usage estimate without an explicit usage figure', () => {
      expect(buildCard(row).pricing.usageEstimate).toBeNull();
    });

    test('gas rows report an unavailable basis rather than a guessed price', () => {
      const gas = {
        ...row,
        energy_type: 'GAS',
        momentum_cost: null,
        benchmark_cost: null,
        difference_percent: null,
      };
      const card = buildCard(gas);
      expect(card.pricing.annualCost).toBeNull();
      expect(card.pricing.monthlyCost).toBeNull();
      expect(card.pricing.basis).toBe('unavailable');
      expect(card.pricing.comparison.label).toBeNull();
    });
  });
});
