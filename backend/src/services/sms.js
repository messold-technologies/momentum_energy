/**
 * Sending the consent link to a customer by SMS, through Twilio.
 *
 * Talks to Twilio's REST API with axios rather than pulling in their SDK: one HTTP call
 * with basic auth, and nothing the SDK does for us is worth the dependency here.
 *
 * Two things this is careful about:
 *   - the consent link is a credential. It is never written to a log, so failures are
 *     reported with the sale id and a masked number and nothing else.
 *   - sending costs money and the endpoint is reachable by anyone holding a channel
 *     password, so the caller counts sends per sale and refuses past a limit.
 */
import axios from 'axios';

import config from '../config/index.js';
import logger from '../config/logger.js';

export class SmsError extends Error {
  constructor(message, { status = 400, code = null } = {}) {
    super(message);
    this.name = 'SmsError';
    this.status = status;
    this.code = code;
  }
}

/** False when the environment has no Twilio credentials; the UI hides the button. */
export function isSmsConfigured() {
  const { accountSid, authToken, from, messagingServiceSid } = config.twilio;
  return Boolean(accountSid && authToken && (from || messagingServiceSid));
}

/**
 * To E.164. Australian numbers are written a dozen ways -- 0400 123 456, 0400123456,
 * 61400123456, +61 400 123 456 -- and all of them mean the same phone.
 *
 * A number already in international form is passed through, so a customer with an
 * overseas mobile still works. Anything else is refused rather than guessed at: a wrong
 * guess sends a stranger someone's consent link.
 */
export function normalisePhone(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  // Keep a leading +, drop spaces, brackets and dashes.
  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (plus) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;

  // 0400123456 -> +61400123456
  if (digits.length === 10 && digits.startsWith('0')) return `+61${digits.slice(1)}`;
  // 61400123456 -> +61400123456
  if (digits.length === 11 && digits.startsWith('61')) return `+${digits}`;
  // 400123456, missing the trunk zero
  if (digits.length === 9 && digits.startsWith('4')) return `+61${digits}`;

  return null;
}

/** True for an Australian mobile. Landlines accept no SMS, so the caller can warn. */
export function isMobile(e164) {
  return /^\+614\d{8}$/.test(String(e164 ?? '')) || !String(e164 ?? '').startsWith('+61');
}

/** 0400123456 -> +6140****456, for logs and for showing the agent what was used. */
export function maskPhone(e164) {
  const s = String(e164 ?? '');
  if (s.length < 7) return '***';
  return `${s.slice(0, 6)}****${s.slice(-3)}`;
}

/**
 * The text the customer receives. Deliberately short: the link alone is about 105
 * characters, so there is little room before a second segment is billed, and a second
 * segment on every sale adds up.
 *
 * Naming the password format is safe -- the page explains it to whoever opens it, so
 * this tells an interceptor nothing the link would not -- and it saves a call from a
 * customer who gets the page and does not know what it wants.
 */
export function consentSmsBody(url) {
  return `Utility Hub: please confirm your Momentum Energy sign-up here: ${url} Open it with your postcode followed by the day of your birthday.`;
}

/**
 * One message. Returns Twilio's message sid and status, or throws SmsError with
 * something worth putting in front of an agent.
 */
export async function sendSms({ to, body }) {
  if (!isSmsConfigured()) {
    throw new SmsError('SMS is not configured on this environment.', { status: 503 });
  }

  const { accountSid, authToken, from, messagingServiceSid } = config.twilio;

  const form = new URLSearchParams({ To: to, Body: body });
  // A messaging service picks the sender for you and handles AU sender rules; a bare
  // from number is the simpler setup. Prefer the service when both are present.
  if (messagingServiceSid) form.set('MessagingServiceSid', messagingServiceSid);
  else form.set('From', from);

  try {
    const { data } = await axios.post(
      `${config.twilio.baseUrl}/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      form.toString(),
      {
        auth: { username: accountSid, password: authToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      }
    );
    return { sid: data.sid, status: data.status };
  } catch (err) {
    const status = err.response?.status;
    const twilioCode = err.response?.data?.code ?? null;
    const twilioMessage = err.response?.data?.message ?? null;

    // Logged without the body, because the body carries the consent link.
    logger.error('Twilio send failed', {
      to: maskPhone(to),
      httpStatus: status ?? null,
      twilioCode,
      twilioMessage,
    });

    if (status === 401 || status === 403) {
      throw new SmsError('SMS credentials were rejected. Check the Twilio settings.', {
        status: 502,
        code: twilioCode,
      });
    }
    // 21211 invalid To, 21614 not a mobile, 21408 region not enabled on the account.
    if (twilioCode === 21211 || twilioCode === 21614) {
      throw new SmsError('That phone number cannot receive SMS.', { status: 400, code: twilioCode });
    }
    if (twilioCode === 21408) {
      throw new SmsError(
        'This Twilio account is not enabled for that country. Enable it in Twilio and try again.',
        { status: 502, code: twilioCode }
      );
    }
    if (err.code === 'ECONNABORTED') {
      throw new SmsError('The SMS provider timed out. Try again.', { status: 504 });
    }
    throw new SmsError(
      twilioMessage ? `SMS provider rejected the message: ${twilioMessage}` : 'Could not send the SMS.',
      { status: 502, code: twilioCode }
    );
  }
}
