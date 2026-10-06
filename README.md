# Alebex starter

A voice agent you build by talking to your AI coding tool. No prior coding needed.

```bash
npm install
# In the Alebex console (app.alebex.ai/dev), under the Voice API key, press
# ".env file" and save the download into this folder as .env, then add
# one line to it: ALEBEX_AGENT_ID=<the id on your agent's page>.
npm run dev              # http://localhost:3000
```

Open this folder in **Claude Code** or **Cursor** and ask for what you want, for example:

> Read AGENTS.md. I want a voice agent that calls a customer to confirm tomorrow's
> appointment and can look up their booking. Write the tool and tell me what to put
> in the Alebex console.

`AGENTS.md` holds the full Alebex Voice API contract, and `PROMPTING.md` is Alebex's
guide to writing an agent that sounds like a person on the phone. Folder tools read
both automatically, so your AI knows the API and the house style before you say
anything.

## Three places things live

The single most useful thing to get right. Put each thing where it belongs and
most of the work disappears:

| Where | What goes there | Needs code? |
|---|---|---|
| The agent, in the console | Who it is, how it behaves, its voice | No |
| `knowledge-base.md` | Facts that just sit there: hours, prices, policies | No |
| `app/api/tools/...` | Things that change, or that the agent must *do* | Yes |

`npm run call` sends `knowledge-base.md` with the call automatically. Editing that
file is the fastest way to make your agent smarter, and it involves no code at all.
Reach for a tool only when the answer is different every time.

## What's in here

| Path | What it is |
|---|---|
| `AGENTS.md` | The whole Alebex Voice API. Your AI's source of truth. |
| `PROMPTING.md` | How to write the agent's prompt so it sounds human. |
| `knowledge-base.md` | Facts your agent looks up on a call. Edit this first. |
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
accounts cannot place phone calls at all. The second one comes back as a bare
`502` that reads like a server fault; the script spells out what it really means.

To let people call **in**, you do not need this script at all: import your Twilio
number on the Phone Numbers page in the Alebex console and assign an agent to it.

## Never commit

`.env` is git-ignored. Your Alebex key and Twilio token belong there and nowhere
else — not in a commit, not pasted into a chat.
