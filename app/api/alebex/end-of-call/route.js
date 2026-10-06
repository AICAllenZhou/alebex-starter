// Alebex POSTs the call report here when a call finishes: who said what, how
// long it ran, a link to the recording, and a written summary.
//
// Add this URL on the Webhooks page in the Alebex dev console:
//   https://your-project.vercel.app/api/alebex/end-of-call
//
// Turn signing on when you add it. The console shows the secret (whsec_...)
// exactly once — put it in .env as ALEBEX_WEBHOOK_SECRET. Without it, anyone
// who learns this URL can post you a fake call report.

import { createHmac, timingSafeEqual } from 'node:crypto';

export async function POST(request) {
  // Read the RAW body first. The signature is over the exact bytes sent, so
  // parsing and re-serialising would change them and never match.
  const raw = await request.text();

  const secret = process.env.ALEBEX_WEBHOOK_SECRET;
  if (secret) {
    const result = verify(request.headers.get('x-alebex-signature'), raw, secret);
    if (!result.ok) {
      console.warn('[alebex] rejected a report:', result.why);
      return new Response(null, { status: 401 });
    }
  } else {
    // Unsigned: the body is a claim, not a fact. Only trust an `id` that
    // matches a call you started.
    console.warn('[alebex] ALEBEX_WEBHOOK_SECRET is not set, so this report is unverified.');
  }

  const report = JSON.parse(raw);
  const { id, callType, direction, endedReason, durationSeconds, transcript, recordingUrl, summary } = report;

  console.log('[alebex] call finished', { id, callType, direction, endedReason, durationSeconds });
  if (summary) console.log('[alebex] summary: ' + summary);
  console.log('[alebex] transcript\n' + transcript);

  // The recording link is signed and expires 60 minutes after this request.
  // Download it now if you want to keep it.
  if (recordingUrl) {
    // await fetch(recordingUrl) and store the bytes somewhere.
  }

  // A failed delivery is retried twice, and the same call can arrive more than
  // once. Store by `id` so a repeat overwrites rather than duplicates.
  // await saveCallOutcome(id, endedReason, durationSeconds, transcript);

  // Answer 2xx within 20 seconds or Alebex counts the delivery as failed.
  return new Response(null, { status: 204 });
}

/** X-Alebex-Signature: t=<unix seconds>,v1=<hex of HMAC-SHA256 over "t.rawBody">. */
function verify(header, raw, secret) {
  if (!header) return { ok: false, why: 'no X-Alebex-Signature header' };

  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const at = kv.indexOf('=');
      return [kv.slice(0, at).trim(), kv.slice(at + 1).trim()];
    }),
  );
  const { t, v1 } = parts;
  if (!t || !v1) return { ok: false, why: 'malformed signature header' };

  // Reject a stale timestamp, or someone can replay a report they captured.
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) {
    return { ok: false, why: 'timestamp more than five minutes from our clock' };
  }

  // The key is the WHOLE secret, whsec_ prefix included.
  const expected = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');

  // Constant time, or the comparison itself leaks the right answer one byte
  // at a time. Lengths must match before timingSafeEqual will look at them.
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, why: 'signature did not match' };
  }
  return { ok: true };
}
