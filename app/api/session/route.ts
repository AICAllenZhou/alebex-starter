import { randomBytes } from 'crypto';

/**
 * Start a browser voice session.
 *
 * Returns { relayUrl, token }. The token is one-time and valid for 60 seconds.
 * The page connects to relayUrl with that token and never receives ALEBEX_API_KEY
 * or the Agent ID.
 *
 * When RELAY_URL is unset, this is a stub: it returns a mock relay URL so the
 * frontend can drive states locally. When RELAY_URL is set, the token is minted
 * here and the relay URL is passed through; attaching the Agent ID, knowledge
 * base, and API key to the upstream session is the relay / server's job.
 */
const TEST_AGENT_ID = '068203e3-6e6b-46fd-8d17-fabd1c7ed575';

function sessionAgentId(): string {
  const fromEnv = process.env.ALEBEX_AGENT_ID?.trim();
  if (fromEnv && !fromEnv.includes('replace_me')) return fromEnv;
  return TEST_AGENT_ID;
}

export async function POST() {
  const token = randomBytes(24).toString('hex');
  const relayUrl = process.env.RELAY_URL?.trim();
  // Server-side only: used when the relay opens the Alebex session. Never
  // returned to the browser and never exposed as a NEXT_PUBLIC_ variable.
  const agentId = sessionAgentId();
  void agentId;

  if (!relayUrl) {
    return Response.json({
      relayUrl: 'mock://session',
      token,
      mode: 'mock',
      expiresInSeconds: 60,
    });
  }

  // TODO: register `token` with the mid-tier relay (60s, single use) and have
  // the relay open the Alebex socket with ALEBEX_API_KEY, agentId, and the
  // knowledge base. Do not expose the API key or agentId on this response.
  return Response.json({
    relayUrl,
    token,
    mode: 'relay',
    expiresInSeconds: 60,
  });
}
