/**
 * Normalise 1st Energy account create payloads before POST /v2/accounts.
 * Ensures organisation.* matches OpenAPI (integer ids, date-only GST, nested type objects).
 */

function toPositiveInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function toDateOnly(value) {
  if (value === null || value === undefined) return value;
  const s = String(value);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s;
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {Record<string, unknown>}
 */
export function sanitizeFirstEnergyAccountPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  const out = structuredClone(payload);

  if (out.property_type !== 'COMPANY') {
    delete out.organisation;
    return out;
  }

  const org = out.organisation;
  if (!org || typeof org !== 'object') return out;

  const organisationTypeId = toPositiveInt(org.organisation_type_id);
  if (organisationTypeId !== null) {
    org.organisation_type_id = organisationTypeId;
    org.organisationType = { id: organisationTypeId };
  } else {
    delete org.organisation_type_id;
    org.organisationType = {};
  }

  const industryTypeId = toPositiveInt(org.industry_type_id);
  if (industryTypeId !== null) {
    org.industry_type_id = industryTypeId;
    org.industryType = { id: industryTypeId };
  } else {
    delete org.industry_type_id;
    org.industryType = {};
  }

  if (org.gst_registered_at) {
    org.gst_registered_at = toDateOnly(org.gst_registered_at);
  }

  return out;
}
