import Link from 'next/link';

// A status page so you can see at a glance what is wired up and what is not.
// It never prints a secret — only whether one is present.
// Moved from / during the Demo Studio cloud smoke test; the call page is now /.

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

export default function Status() {
  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

  return (
    <div className="status-page">
      <main>
        <p className="muted" style={{ margin: '0 0 16px' }}>
          <Link href="/">语音通话测试</Link>
        </p>
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
          <li>
            <div className="row">
              <code>POST /api/session</code>
              <span className="muted">browser call session</span>
            </div>
            <p className="muted" style={{ margin: '8px 0 0' }}>
              Returns a mid-tier <code>relayUrl</code> and a one-time token. The page never
              receives <code>ALEBEX_API_KEY</code>.
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
          Everything it needs is in <code>AGENTS.md</code> (the API) and{' '}
          <code>PROMPTING.md</code> (how to write the agent), which those tools read
          automatically.
        </p>
        <p className="muted">
          Before you write a tool, check whether you need one. Facts that just sit
          there — hours, prices, policies — go in <code>knowledge-base.md</code>, which{' '}
          <code>npm run call</code> sends with the call. No code, no deploy.
        </p>
      </main>
      <style>{`
        .status-page {
          min-height: 100vh;
          margin: -0;
          padding: 48px 16px;
          background: #02080b;
          color: #f4f7fa;
        }
        .status-page main { max-width: 720px; margin: 0 auto; text-align: left; }
        .status-page h1 { font-size: 28px; font-weight: 500; letter-spacing: -0.02em; margin: 0 0 8px; color: #f4f7fa; }
        .status-page h2 { font-size: 14px; font-weight: 500; text-transform: uppercase;
             letter-spacing: 0.08em; color: rgba(244,247,250,.5); margin: 40px 0 12px; }
        .status-page p { color: rgba(244,247,250,.7); margin: 0 0 16px; }
        .status-page code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; }
        .status-page ul { list-style: none; padding: 0; margin: 0; }
        .status-page li { border: 1px solid rgba(255,255,255,.12); border-radius: 10px;
             padding: 14px 16px; margin-bottom: 10px; }
        .status-page .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .status-page .muted { color: rgba(244,247,250,.5); font-size: 14px; }
        .status-page .ok { color: #8edcff; }
        .status-page .missing { color: #ffb07c; }
        .status-page a { color: #8edcff; }
      `}</style>
    </div>
  );
}
