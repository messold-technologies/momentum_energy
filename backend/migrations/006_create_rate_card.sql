-- Rate card reference data, imported from Momentum's "All Channel Master Template" workbook.
--
-- Versioned on purpose: each import inserts a new rate_card_versions row and a fresh set of
-- child rows. Old versions are never deleted, because a submitted sale references an
-- offer_code (serviceOfferCode) that must stay resolvable for audit long after Momentum
-- issues a replacement rate card.
--
-- Money is stored as NUMERIC, never float: the source cells contain values such as
-- 166.20999999999998 and 0.47630000000000006.
--
-- Rates are imported from the "(c)" sheets, so all rate/charge columns are in CENTS and are
-- GST-INCLUSIVE. The Default Offer benchmark/cost columns are annual DOLLARS, GST-inclusive.

CREATE TABLE IF NOT EXISTS rate_card_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(200) NOT NULL,
  source_file TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  stats JSONB,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one active version at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_card_versions_active
  ON rate_card_versions (is_active) WHERE is_active;


-- Plan-level marketing content, from the "Offers" sheet (7 rows).
-- plan_code matches the Momentum API servicePlanCode enum.
CREATE TABLE IF NOT EXISTS offer_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES rate_card_versions(id) ON DELETE CASCADE,
  plan_code VARCHAR(100) NOT NULL,
  energy_type VARCHAR(20) NOT NULL,
  provider_id VARCHAR(100),
  offer_number VARCHAR(50),
  state_availability TEXT[],
  customer_type VARCHAR(50),
  customer_eligibility VARCHAR(100),
  contract_term VARCHAR(50),
  features JSONB,
  termination_fee TEXT,
  dishonoured_payment_fee TEXT,
  credit_card_payment_fee TEXT,
  billing_options TEXT,
  payment_options TEXT,
  green_options TEXT,
  terms_and_conditions TEXT,
  extras JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_offer_plans_version_plan
  ON offer_plans (version_id, plan_code, energy_type);


-- One row per sellable offer. offer_code IS the serviceOfferCode submitted to Momentum.
CREATE TABLE IF NOT EXISTS offer_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES rate_card_versions(id) ON DELETE CASCADE,

  offer_code VARCHAR(20) NOT NULL,              -- Offer_With_Rate_ID, e.g. a44Mp00004KKoNRIA1
  offer_with_rate_number VARCHAR(50),           -- OWR-322875
  offer_number VARCHAR(50),                     -- PRC-1642
  plan_code VARCHAR(100) NOT NULL,              -- normalised Offer Display Name
  price_item_name VARCHAR(150),

  energy_type VARCHAR(20) NOT NULL,             -- ELECTRICITY | GAS
  state VARCHAR(10) NOT NULL,
  network_name VARCHAR(100) NOT NULL,
  network_zone VARCHAR(50),                     -- gas only
  retail_tariff_code VARCHAR(50) NOT NULL,
  customer_type VARCHAR(20) NOT NULL,           -- RESIDENTIAL | COMMERCIAL

  effective_start DATE,
  effective_end DATE,

  daily_charge NUMERIC(12, 4),                  -- cents/day, incl GST
  rates JSONB,                                  -- { peak: [{block,limit,rate}], shoulder, offpeak, controlledLoad1, ... }
  solar JSONB,
  demand JSONB,

  cdr_plan_code VARCHAR(50),                    -- "Code" column, e.g. MOM1162824MRE2
  cdr_plan_id VARCHAR(60),                      -- derived: + @VEC (VIC) or @EME
  bpid_url TEXT,

  benchmark_tariff_type TEXT,
  benchmark_kwh INTEGER,
  benchmark_cost NUMERIC(12, 2),                -- annual $, incl GST
  momentum_cost NUMERIC(12, 2),                 -- annual $, incl GST (includes credits/discounts)
  difference_dollar NUMERIC(12, 2),
  difference_percent NUMERIC(8, 4),
  tariff_category VARCHAR(30)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_offer_rates_version_code
  ON offer_rates (version_id, offer_code);

-- The resolver lookup.
CREATE INDEX IF NOT EXISTS idx_offer_rates_lookup
  ON offer_rates (version_id, energy_type, network_name, customer_type, retail_tariff_code);

-- Reverse lookup for audit: which row produced a serviceOfferCode on a past submission.
CREATE INDEX IF NOT EXISTS idx_offer_rates_offer_code
  ON offer_rates (offer_code);

CREATE INDEX IF NOT EXISTS idx_offer_rates_cdr_plan_id
  ON offer_rates (cdr_plan_id);


-- Postcode -> distribution network. Electricity carries a default flag for postcodes
-- spanning more than one network; gas does not (24 ambiguous postcodes need agent choice).
CREATE TABLE IF NOT EXISTS postcode_network (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES rate_card_versions(id) ON DELETE CASCADE,
  energy_type VARCHAR(20) NOT NULL,
  postcode VARCHAR(10) NOT NULL,
  network_name VARCHAR(100) NOT NULL,
  network_zone VARCHAR(50),
  is_default BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_postcode_network_lookup
  ON postcode_network (version_id, energy_type, postcode);


-- Network tariff -> retail tariff code.
-- Electricity keys on tariff_combination_key (the site's network tariff + solar flag).
-- Gas keys on network_zone + customer_type, so gas is fully derivable from postcode.
CREATE TABLE IF NOT EXISTS tariff_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES rate_card_versions(id) ON DELETE CASCADE,
  energy_type VARCHAR(20) NOT NULL,
  network_name VARCHAR(100) NOT NULL,
  tariff_combination_key VARCHAR(100),
  network_zone VARCHAR(50),
  customer_type VARCHAR(20),
  retail_tariff_code VARCHAR(50) NOT NULL,
  solar_applicable BOOLEAN,
  solar_scheme VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_tariff_map_elec
  ON tariff_map (version_id, energy_type, network_name, tariff_combination_key);

CREATE INDEX IF NOT EXISTS idx_tariff_map_gas
  ON tariff_map (version_id, energy_type, network_name, network_zone, customer_type);


-- NMI/MIRN prefix -> network, so the distributor can be derived from the connection id
-- the agent already enters.
CREATE TABLE IF NOT EXISTS nmi_prefix_network (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES rate_card_versions(id) ON DELETE CASCADE,
  prefix VARCHAR(10) NOT NULL,
  energy_type VARCHAR(20) NOT NULL,
  network_name VARCHAR(100) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nmi_prefix_network_lookup
  ON nmi_prefix_network (version_id, prefix);
