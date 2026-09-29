// A status page so you can see at a glance what is wired up and what is not.
// It never prints a secret — only whether one is present.

export const dynamic = 'force-dynamic';

const REQUIRED = [
  ['ALEBEX_API_KEY', 'in the .env file the console downloads'],
  ['ALEBEX_AGENT_ID', 'you add this line yourself, from your agent in the console'],
  ['ALEBEX_API_URL', 'in the .env file the console downloads'],
  ['ALEBEX_ENGINE_URL', 'in the .env file the console downloads'],
  ['TOOL_SECRET', 'you invent this one'],
  ['PUBLIC_BASE_URL', 'your deployed https URL'],
];

const OPTIONAL = [
  ['TWILIO_ACCOUNT_SID', 'Twilio side quest'],
  ['TWILIO_AUTH_TOKEN', 'Twilio side quest'],
  ['TWILIO_CALLER_ID', 'Twilio side quest'],
];

// A value left at its .env.example placeholder counts as not set — otherwise
// `wt_replace_me` would show up as a working key.
function isSet(name) {
  const v = process.env[name]?.trim();
  return Boolean(v && !v.includes('replace_me') && !v.includes('your-project'));
}

export default function Home() {
  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

  return (
    <main>
      <h1>Your agent&rsquo;s tools are running.</h1>
      <p>
        This page is just a dashboard. The two endpoints below are the parts Alebex
        actually talks to.
      </p>

      <h2>Endpoints</h2>
      <ul>
        <li>
          <div className="row">
            <code>POST /api/tools/check-stock</code>
            <span className="muted">custom tool</span>
          </div>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            Register this address on the console&rsquo;s Tools page and attach it to your agent —
            or send it with a call in <code>scripts/call.mjs</code>.
            <br />
            <code>{base}/api/tools/check-stock</code>
          </p>
        </li>
        <li>
          <div className="row">
            <code>POST /api/alebex/end-of-call</code>
            <span className="muted">webhook</span>
          </div>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            Paste this into Voice Agents in the Alebex console.
            <br />
            <code>{base}/api/alebex/end-of-call</code>
          </p>
        </li>
      </ul>

      <h2>Environment</h2>
      <ul>
        {REQUIRED.map(([name, where]) => (
          <li key={name}>
            <div className="row">
              <code>{name}</code>
              <span className={isSet(name) ? 'ok' : 'missing'}>
                {isSet(name) ? 'set' : 'not set'}
              </span>
            </div>
            <p className="muted" style={{ margin: '4px 0 0' }}>{where}</p>
          </li>
        ))}
      </ul>

      <h2>Optional — phone calls</h2>
      <p className="muted">
        Your agent and your tools work without these. Add them only when you want a
        real phone to ring.
      </p>
      <ul>
        {OPTIONAL.map(([name, where]) => (
          <li key={name}>
            <div className="row">
              <code>{name}</code>
              <span className={isSet(name) ? 'ok' : 'muted'}>
                {isSet(name) ? 'set' : 'not set'}
              </span>
            </div>
            <p className="muted" style={{ margin: '4px 0 0' }}>{where}</p>
          </li>
        ))}
      </ul>

      <h2>Next</h2>
      <p>
        Open this folder in Claude Code or Cursor and ask it to build your agent.
        Everything it needs about the API is in <code>AGENTS.md</code>, which those
        tools read automatically.
      </p>
    </main>
  );
}
