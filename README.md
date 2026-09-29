# Alebex starter

A voice agent you build by talking to your AI coding tool. No prior coding needed.

```bash
npm install
# In the Alebex console (app.alebex.ai/dev), under the Voice API key, press
# ".env file" and save the download into this folder as .env.
npm run dev              # http://localhost:3000
```

Open this folder in **Claude Code** or **Cursor** and ask for what you want, for example:

> Read AGENTS.md. I want a voice agent that calls a customer to confirm tomorrow's
> appointment and can look up their booking. Write the tool and tell me what to put
> in the Alebex console.

`AGENTS.md` holds the full Alebex Voice API contract and both tools read it
automatically — your AI already knows the API before you say anything.

## What's in here

| Path | What it is |
|---|---|
| `AGENTS.md` | The whole Alebex Voice API. Your AI's source of truth. |
| `app/api/tools/check-stock/route.js` | An example custom tool. Rename it, rewrite it. |
| `app/api/alebex/end-of-call/route.js` | Receives the transcript and recording when a call ends. |
| `app/page.js` | A status page showing your endpoint URLs and which env vars are set. |
| `scripts/call.mjs` | Places a real phone call. Optional — needs Twilio. |
| `.env.example` | What the console&rsquo;s downloaded `.env` contains, plus the values you add yourself. |

## Going live

Custom tools must be on a public `https://` URL, so Alebex can only reach them once
you deploy. Push this repo to GitHub, import it at [vercel.com/new](https://vercel.com/new),
add the same environment variables there, then set `PUBLIC_BASE_URL` to the URL Vercel
gives you.

## Optional: make a phone ring

Finish the Twilio side quest in the workshop, put the three `TWILIO_*` values in
`.env`, then:

```bash
npm run call -- +16045551234
```

Trial Twilio accounts can only call numbers you have verified, and trial Alebex
accounts cannot place phone calls at all — the script explains either error if you
hit it.

## Never commit

`.env` is git-ignored. Your Alebex key and Twilio token belong there and nowhere
else — not in a commit, not pasted into a chat.
