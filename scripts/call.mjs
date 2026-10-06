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

const envFileFound = loadEnv();

const to = process.argv[2];
if (!to || !to.startsWith('+')) {
  console.error('Usage: npm run call -- +16045551234   (E.164: plus sign, country code, digits)');
  process.exit(1);
}

const required = ['ALEBEX_API_KEY', 'ALEBEX_AGENT_ID', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_CALLER_ID'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing: ${missing.join(', ')}`);
  if (!envFileFound) {
    console.error('\nThere is no .env in this folder. In the Alebex console, under the Voice');
    console.error('API key, press ".env file" and save the download here as .env, then add one');
    console.error('line to it: ALEBEX_AGENT_ID=<the id on your agent\'s page>.');
  }
  console.error('\nThe three TWILIO_ values come from the optional Twilio side quest.');
  process.exit(1);
}

const base = process.env.PUBLIC_BASE_URL;
const toolSecret = process.env.TOOL_SECRET;

// ---------------------------------------------------------------------------
// What this call KNOWS. Facts that just sit there — your hours, your prices,
// your policies — belong here, not in a tool. This is plain text, up to
// 100,000 characters, and it needs no code and no deployment: edit
// knowledge-base.md and the next call knows it.
// ---------------------------------------------------------------------------
const knowledgeBase = readIfPresent('../knowledge-base.md');

// ---------------------------------------------------------------------------
// What this call CAN DO. A tool is for things that change, or that the agent
// must do rather than know. Alebex has to reach the URL, so it has to be your
// deployed site, not localhost.
// ---------------------------------------------------------------------------
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
if (knowledgeBase) {
  console.log(`Sending knowledge-base.md with this call (${knowledgeBase.length} characters).\n`);
}

// Two ways a call gets its tools. If you leave customTools out, the call uses
// whatever tools are attached to the agent in the console (the easy route).
// If you send the array, the call uses exactly that array and the attached
// ones are set aside — so an EMPTY array would silently strip them. Only send
// it when there is something in it. The same applies to every optional field.
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
  ...(knowledgeBase ? { knowledgeBase } : {}),
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
  // A refused call carries no error code, only `detail`. Branch on the status.
  const detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail ?? body);
  console.error(`\nCall refused (${res.status}): ${detail}`);
  console.error(explain(res.status) + '\n');
  process.exit(1);
}

// `id` is the call's own id. It is what arrives as `id` in your end-of-call
// webhook and as `call.id` in every tool request, so it is the one to store.
// `providerCallId` is the Twilio SID, for your Twilio records only.
console.log(`\nCalling ${to} — your phone should ring in a few seconds.`);
console.log(`Call id:        ${body.id}   status: ${body.status}`);
if (body.providerCallId) console.log(`Twilio call SID: ${body.providerCallId}`);
console.log();

function explain(status) {
  if (status === 400) return 'A field was refused: a tool, the knowledge base, a guardrail, the number or the Twilio details. The detail above names it. Nothing was dialled.';
  if (status === 401) return 'No Authorization header, or it was not in the form "Bearer <key>".';
  if (status === 403) return 'Your ALEBEX_API_KEY is not live. It may have been rotated; download the .env file from the console again.';
  if (status === 422) return 'Twilio rejected this. Check that `to` is E.164 and that TWILIO_CALLER_ID is a Voice number on that Twilio account. On a trial Twilio account the number you are calling must be verified first.';
  if (status === 429) return 'Out of talk time or balance, or too many calls at once. Wait and retry.';
  if (status === 500) return 'Twilio would not take the dial. Check the Account SID, auth token and caller ID.';
  if (status === 502) return 'This reads like a fault on their side, but it is almost always your account:\n  - the Alebex account is still on trial and cannot dial a real number\n  - the Communications Policy has not been accepted in the console\n  - ALEBEX_AGENT_ID is not an agent in this account\n  - the account is suspended, or a usage limit was reached\nCheck the agent id first, then the console.';
  if (status === 503) return 'Alebex is at capacity. Wait and retry.';
  return 'See the error table in AGENTS.md, under "Place an outbound call".';
}

function readIfPresent(relativePath) {
  try {
    const text = readFileSync(new URL(relativePath, import.meta.url), 'utf8').trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

// Returns false when there is no .env. Not fatal on its own: the variables may
// already be in the environment, which is how a deployed host supplies them.
function loadEnv() {
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return true;
  } catch {
    return false;
  }
}
