// Place a real phone call with your agent.
//
//   npm run call -- +16045551234
//
// OPTIONAL. Needs the Twilio side quest finished. Your agent and your tools
// work without this script; it is only how you make a phone actually ring.
//
// Reads .env (Node 20.6+ loads it with --env-file; we read it by hand so this
// works on any recent Node).

import { readFileSync } from 'node:fs';

loadEnv();

const to = process.argv[2];
if (!to || !to.startsWith('+')) {
  console.error('Usage: npm run call -- +16045551234   (E.164: plus sign, country code, digits)');
  process.exit(1);
}

const required = ['ALEBEX_API_KEY', 'ALEBEX_AGENT_ID', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_CALLER_ID'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing in .env: ${missing.join(', ')}`);
  console.error('The Twilio values come from the optional Twilio side quest.');
  process.exit(1);
}

const base = process.env.PUBLIC_BASE_URL;
const toolSecret = process.env.TOOL_SECRET;

// Tools travel with the call. Nothing is registered ahead of time, so this
// array is the only place your agent learns the tool exists. Alebex must be
// able to reach the URL, so it has to be your deployed site, not localhost.
const customTools = base && base.startsWith('https://') && !base.includes('your-project')
  ? [
      {
        name: 'check_stock',
        description:
          'Check whether a product is in stock. Call this as soon as the caller asks about ' +
          'availability, sizes, or when something will be back. Do not call it for questions ' +
          'about an order that was already placed.',
        url: `${base}/api/tools/check-stock`,
        headers: { Authorization: `Bearer ${toolSecret}` },
        timeoutMs: 8000,
        parameters: {
          type: 'object',
          properties: {
            sku: { type: 'string', description: 'Product SKU the caller mentioned' },
            qty: { type: 'integer', description: 'How many units they want' },
            size: { type: 'string', enum: ['S', 'M', 'L'] },
          },
          required: ['sku'],
        },
      },
    ]
  : [];

if (customTools.length === 0) {
  console.warn('PUBLIC_BASE_URL is not set to your deployed https site, so this call carries no tools.\n');
}

// Two ways a call gets its tools. If you leave customTools out, the call uses
// whatever tools are attached to the agent in the console (the easy route).
// If you send the array, the call uses exactly that array and the attached
// ones are set aside — so an EMPTY array would silently strip them. Only send
// it when there is something in it.
const engine = (process.env.ALEBEX_ENGINE_URL || 'https://api.voice.alebex.ai').replace(/\/$/, '');
const payload = {
  agentId: process.env.ALEBEX_AGENT_ID,
  to,
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_CALLER_ID,
  },
  ...(customTools.length > 0 ? { customTools } : {}),
};

const res = await fetch(`${engine}/public/call/phone`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.ALEBEX_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

const body = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error(`\nCall refused (${res.status}): ${body.code ?? ''} ${body.detail ?? body.message ?? ''}`);
  console.error(explain(res.status, body.code) + '\n');
  process.exit(1);
}

console.log(`\nCalling ${to} — your phone should ring in a few seconds.`);
console.log(`Twilio call SID: ${body.id}   status: ${body.status}\n`);

function explain(status, code) {
  if (code === 'PHONE_REQUIRES_PAID_ACCOUNT') return 'Your Alebex account is still on trial. Trial accounts cannot dial real numbers.';
  if (code === 'COMMUNICATIONS_ATTESTATION_REQUIRED') return 'Accept the Communications Policy in the Alebex console, then try again.';
  if (code === 'AGENT_NOT_FOUND' || code === 'AGENT_NOT_IN_ACCOUNT') return 'Check ALEBEX_AGENT_ID against the id in your console.';
  if (status === 400) return 'One of the tools sent with the call was refused. `detail` names the exact field. Nothing was dialled.';
  if (status === 401) return 'Your ALEBEX_API_KEY is wrong or was rotated. Fetch it again from the console.';
  if (status === 422) return 'Twilio rejected this. Check that `to` is E.164 and that TWILIO_CALLER_ID is a Voice number on that Twilio account. On a trial Twilio account the number you are calling must be verified first.';
  if (status === 429) return 'Out of allowance, or too many calls at once. Wait and retry.';
  if (status === 503) return 'Alebex is busy. Wait and retry.';
  return 'See the error table in AGENTS.md.';
}

function loadEnv() {
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    console.error('No .env file found. In the Alebex console, under the Voice API key, press ".env file" and save the download into this folder as .env.');
    process.exit(1);
  }
}
