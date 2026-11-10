import { randomBytes } from 'crypto';

/**
 * Start a browser voice session.
 *
 * Returns { relayUrl, token }. The token is one-time and valid for 60 seconds.
 * The page connects to relayUrl with that token and never receives ALEBEX_API_KEY.
 *
 * When RELAY_URL is unset, this is a stub: it returns a mock relay URL so the
 * frontend can drive states locally. When RELAY_URL is set, the token is minted
 * here and the relay URL is passed through; attaching the Agent ID, knowledge
 * base, and API key to the upstream session is the relay / server's job.
 */
export async function POST() {
  const token = randomBytes(24).toString('hex');
  const relayUrl = process.env.RELAY_URL?.trim();

  if (!relayUrl) {
    return Response.json({
      relayUrl: 'mock://session',
      token,
      mode: 'mock',
      expiresInSeconds: 60,
    });
  }

  // TODO: register `token` with the mid-tier relay (60s, single use) and have
  // the relay open the Alebex socket with ALEBEX_API_KEY, agent id, and the
  // knowledge base. Do not expose the API key on this response or via NEXT_PUBLIC_*.
  return Response.json({
    relayUrl,
    token,
    mode: 'relay',
    expiresInSeconds: 60,
  });
}
