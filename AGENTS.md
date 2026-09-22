# Working in this repo

You are helping someone who is **not a programmer** build a voice agent on the
Alebex Voice API. This file is the complete API contract — endpoints, request and
response shapes, limits, error codes and two working examples. You do not need to
search the web, and there is no SDK to install.

**Before you write code**

- Ask what the agent should accomplish on the call and who it is talking to. One
  question at a time, in plain language. Do not ask about frameworks or hosting.
- Say which parts live where: the agent's prompt, voice and model are configured in
  the Alebex console at `app.alebex.ai/dev`, not in this repo. This repo holds the
  agent's **tools** (things it can look up or do mid-call) and the **end-of-call
  webhook**.

**What to build here**

- One route per tool under `app/api/tools/<tool-name>/route.js`. Copy the shape of
  `check-stock`: check the `Authorization` header against `TOOL_SECRET`, read
  `body.arguments`, return small JSON with values a person could hear out loud.
- Keep `app/api/alebex/end-of-call/route.js` answering `2xx`.
- Update `scripts/call.mjs` so its `customTools` array declares every tool you add —
  tools are not registered anywhere in advance, they travel with each call.

**Rules that will bite otherwise**

- Tool URLs must be public `https://`. `localhost` will never work; deploy first.
- A tool's `description` is the only text the model reads when deciding to call it.
  Write when to fire it and when not to, not how it works inside.
- Do not use these tool names — the engine reserves them: `end_call`,
  `transfer_call`, `leave_voicemail`, `mark_call_screening`,
  `unmark_call_screening`, `list_available_slots`, `book_appointment`,
  `cancel_appointment`, `reschedule_appointment`, `get_appointments`, or anything
  starting `get_skill_`.
- Never put a real key in code, in a commit, or in your reply. They live in `.env`.
- Phone calls are optional in this workshop and need Twilio plus a paid Alebex
  account. Build and test the tools without them.

Everything below is the Alebex documentation, unchanged.

---

# Alebex Voice API: phone calls integration guide

Place an outbound phone call that an Alebex voice agent conducts, give the agent
HTTPS tools it may call mid-conversation, and receive a report when the call ends.
This file is the whole contract for the phone-call path; you do not need any other
document or an SDK.

## What you have

**An Alebex account with a developer console** at `https://app.alebex.ai/dev`, where
an agent is built (its prompt, voice and model), its **agent id** is copied, and the
end-of-call webhook URL is set.

**An API key**, fetched once with your normal Alebex login token:

```
POST https://api.alebex.ai/api/v1/voice-engine/api-key
Authorization: Bearer <your Alebex token>

200
{ "token": "wt_xxxxxxxxxxxxxxxxxxxxxxxx", "expiresAt": "", "expiresInSeconds": 0 }
```

There is one key per account; calling this again returns the existing key rather
than minting another. It **does not expire**. Keep it server-side: it authorizes
calls billed to your account and is not scoped to one agent. If it leaks, rotate it
(`POST .../voice-engine/api-key/rotate`) and read `previousTokenDeleted` on the
response:

```
200
{ "token": "wt_yyyyyyyyyyyyyyyyyyyyyyyy", "previousTokenDeleted": true }
```

`true` means the old key is gone at the engine and anything still using it stops
working that moment, your own deployed code included. `false` means the replacement
is real but the old key is **still live** and the leak is not closed; rotating again
will not remove it, so contact support.

**A Twilio account** with a phone number on it. Calls are dialed from your Twilio
account, so you pay Twilio for the carrier leg and Alebex bills the agent's minutes.

## Hosts

```
Alebex API, for the key:      https://api.alebex.ai/api/v1
Voice Engine, for calls:      https://api.voice.alebex.ai
```

Every engine request carries the API key as a bearer token:

```
Authorization: Bearer wt_xxxxxxxxxxxxxxxxxxxxxxxx
```

## Place a phone call

```
POST https://api.voice.alebex.ai/public/call/phone
Authorization: Bearer <API key>
Content-Type: application/json
```

```json
{
  "agentId": "<your agent id>",
  "to": "+15551234567",
  "twilio": {
    "accountSid": "AC...",
    "authToken": "...",
    "phoneNumber": "+15557654321"
  },
  "customTools": [ ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `agentId` | yes | The agent to run, from the console. Must belong to your account. |
| `to` | yes | The number to call, E.164. |
| `twilio.accountSid` | yes | Your Twilio Account SID. |
| `twilio.authToken` | yes | Your Twilio auth token. Sent per call; the engine does not store it. |
| `twilio.phoneNumber` | yes | The caller ID. Must exist on that Twilio account or Twilio rejects the call. |
| `customTools` | no | Up to 8 HTTPS tools the agent may call during this call. See **Custom tools**. |

You send only *which agent* to run. The engine fetches the prompt, voice, model and
limits from your account, so nothing in your code can change what the agent is.

```
200
{ "id": "CA447c49d29c0aacfc15ebe0976874087c", "status": "queued" }
```

`id` is the Twilio call SID. The same value arrives as `id` in your end-of-call
webhook, so store it to match the two up. It does not arrive in tool requests: their
`call.id` is the engine's own id for the call (see **What the engine sends your
endpoint**). `status` is the dial status as Twilio reported it.

### Errors

| Status | Meaning | What to do |
|---|---|---|
| `400` | A custom tool was refused. `detail` names the field, e.g. `customTools[1].name`. | Fix the tool; nothing was dialed. |
| `401` | Missing or invalid bearer token. | Fetch the key again. `SESSION_REVOKED` means it was rotated. |
| `403` | `COMMUNICATIONS_ATTESTATION_REQUIRED`: the account has not accepted the Communications Policy. `PHONE_REQUIRES_PAID_ACCOUNT`: a trial account may not dial a real number. `ACCOUNT_SUSPENDED`: the account cannot place calls. | Accept the policy in the console; upgrade; or contact support. |
| `404` | `AGENT_NOT_FOUND`. `AGENT_NOT_IN_ACCOUNT` means it belongs to another account. | Check the id in the console. |
| `422` | Bad number, or Twilio credentials Twilio would not accept. | Check `to` is E.164 and the caller ID is on the account. |
| `429` | Out of allowance, or at the concurrent-call limit (`at_capacity`). | Top up, or retry with a backoff. |
| `502` | Your agent's configuration could not be loaded. | Retry; if it persists, check the agent in the console. |
| `503` | The engine is at capacity. | Retry with a backoff. |

Refusals carry a machine-readable `code` alongside a message written to be shown to
you, so branch on the code, not the text.

## Custom tools

A tool is one of your HTTPS endpoints described well enough for the model to decide,
mid-conversation, that the caller's request needs it. When it does, the engine speaks
a holding line, POSTs to your URL with arguments extracted from what the caller said,
waits for your response and hands it straight back to the model to phrase for the
phone.

**Tools travel with the call.** Nothing is registered ahead of time, nothing is
cached, and Alebex stores nothing about them. Each call carries its own tools and
they are gone when it ends. Because of that, a different URL or header per call is
simply a different request body: put a task id in the URL path or a header and your
side can route on it.

The same array rides on a browser call's `start_call` frame when your own code opens
the socket: `{"type": "start_call", "agent": {"id": "…"}, "customTools": [...]}`. A
bad entry there comes back as an `error` frame with code `invalid_config`, then the
socket closes with `1008`, the same close code as a bad token, so branch on the
frame's `code`. A page that opens the socket can read the tool `headers` and the API key
on the URL alike, so open the socket from your server, or proxy it, and put a
short-lived per-call token in `headers` rather than a live key. The test call on the
console's Voice Agents page sends the agent id alone, so it never carries tools. The
rest of this guide stays with the phone call.

### The tool object

```json
{
  "name": "check_stock",
  "description": "Check whether a product is in stock at a given store. Call this as soon as the caller asks about availability, sizes, or when something will be back. Do not call it for questions about an order already placed.",
  "url": "https://partner.example.com/voice-tools/check-stock",
  "headers": { "Authorization": "Bearer sk_live_9f3c2b..." },
  "timeoutMs": 8000,
  "parameters": {
    "type": "object",
    "properties": {
      "sku":     { "type": "string",  "description": "Product SKU the caller mentioned" },
      "qty":     { "type": "integer", "description": "How many units they want" },
      "size":    { "type": "string",  "enum": ["S", "M", "L"] },
      "storeId": { "type": "string",  "description": "Leave empty for any store" }
    },
    "required": ["sku"]
  }
}
```

| Field | Required | Rules |
|---|---|---|
| `name` | yes | Letters, digits, underscores and hyphens, 1 to 64 characters, starting with a letter. Unique within the call. Not one of the reserved names below. |
| `description` | yes | 1 to 1024 characters. The only text the model reads when deciding to call you. Write the trigger, not the implementation: name the caller situations that should fire it and the ones that should not. |
| `url` | yes | Absolute `https://` URL on a publicly resolvable host. Private, loopback and link-local addresses are refused. Redirects are not followed, so give the final address. |
| `parameters` | yes | JSON Schema for the arguments, root `type: "object"`. A tool with no arguments still declares `{"type": "object", "properties": {}}`. |
| `headers` | no | Up to 10 static string headers sent on every request. This is where your API key goes. `Host`, `Content-Type` and `Content-Length` are set by the engine and cannot be overridden. |
| `timeoutMs` | no | How long the engine waits for your endpoint. Default 8000, maximum 15000. |

### The schema subset

If you already define tools for an OpenAI or Anthropic model, paste that schema in
unchanged. Accepted keywords: `type` (`object`, `string`, `integer`, `number`,
`boolean`, `array`), `properties` (up to 20 per object, nested up to 3 levels deep),
`required` (must name properties that exist), `description`, `enum` (use it wherever
the set is closed), `items` (arrays of a single declared type).

Refused: `$ref`, `$defs`, `oneOf`, `anyOf`, `allOf`. Inline the definition or split
into separate tools. `spoken_line` is refused as a property name because the engine
adds it itself (see **Latency** below).

### Reserved names

`end_call`, `transfer_call`, `leave_voicemail`, `mark_call_screening`,
`unmark_call_screening`, `list_available_slots`, `book_appointment`,
`cancel_appointment`, `reschedule_appointment`, `get_appointments`, and anything
beginning `get_skill_`. A collision is refused, never renamed or dropped: a renamed
tool means your prompt refers to something that does not exist on the call, and a
dropped one means the agent promises a caller something it can no longer do.

### Limits

| Rule | Limit |
|---|---|
| Tools per call | 8 |
| Tool calls per conversation, across all custom tools | 20 |
| Response body | 8 KB. Larger is refused and reported to the model as a tool error naming the size. |
| URL | `https` only, public host only, no redirects |
| Headers | 10, strings only |
| Description | 1 to 1024 characters |

## What the engine sends your endpoint

Always a POST, always this envelope. Your parameters arrive inside `arguments`
exactly as your schema declared them; everything about the call stays in `call`, so
a new field on the engine's side can never collide with one of yours.

```
POST /voice-tools/check-stock HTTP/1.1
Host: partner.example.com
Authorization: Bearer sk_live_9f3c2b...
Content-Type: application/json

{
  "tool": "check_stock",
  "arguments": { "sku": "A-1024", "qty": 2, "size": "M" },
  "call": {
    "id": "public-9f3c2b1a-4d77-4c19-9f0e-2b88a1c5d310",
    "agentId": "<your agent id>",
    "from": "+16045551234",
    "to": "+17785559876",
    "startedAt": "2026-09-14T18:20:11Z"
  }
}
```

- **`call.id` is the engine's own id, not the Twilio SID.** `POST /public/call/phone`
  returned the Twilio call SID and the end-of-call webhook carries that same SID;
  `call.id` matches neither, so it cannot find the record you stored at dial time.
  For that, put your task id in the tool's URL or a header when you place the call,
  as both working examples do.
- **Optional properties may be absent.** The model fills what the caller said and
  nothing more. Treat every non-required key as missing until proven otherwise.
- **One attempt, no retries, no redirects.** If the request fails, the model is told
  and adapts on the line.
- **Not idempotent by the engine.** The model can legitimately call the same tool
  twice in one turn. If your endpoint books, charges or sends, key it on `call.id`,
  which holds for the life of the call, plus your own arguments.
- **The wait is call time.** The caller stays on the line while your endpoint works,
  and those seconds are metered like any other. Aim to answer well under the timeout.

### What you send back

Any `2xx` with a JSON body. It is handed to the model verbatim: no fixed shape, no
field of ours to include. What you return is what the agent knows. A `text/plain`
body is accepted as the whole result.

```
200 OK
{ "inStock": true, "available": 6, "store": "Broadway & Main", "readyIn": "20 minutes" }

200 OK
{ "inStock": false, "reason": "SKU A-1024 is discontinued", "alternatives": ["A-1099", "A-1100"] }

400 Bad Request
{ "error": "That store is closed on Sundays" }
```

Write values a person could hear: `"readyIn": "20 minutes"` reaches the caller
intact; `"ready_ts": 1789458000` becomes whatever the model guesses it means. Keep it
under 2 KB.

### When it goes wrong

| Condition | What the model receives | What the caller hears |
|---|---|---|
| Timeout | An error naming your tool and the timeout | The agent apologizes and offers another route; the call continues |
| `4xx` / `5xx` | The status code and the first part of your body | Same. A readable `4xx` like `{"error": "That store is closed on Sundays"}` gives the agent something useful to say |
| Body over 8 KB | An error naming the size; none of the body | Same |
| Non-JSON body | The raw text | Whatever the model can make of it |
| Connection refused | An error naming your tool | The agent moves on |

A failing tool never drops a call and is never surfaced to the caller as a system
message.

### Latency

Every tool silently gains one extra argument, `spoken_line`, that the model fills
with a sentence to say out loud. It arrives at the head of the argument stream, so
the caller is already hearing "Let me check that for you" while your parameters are
still being written. It is stripped before the request reaches you and never appears
in `arguments`. A fast endpoint mostly buys a shorter pause rather than none at all,
and a slow one is survivable.

## The end-of-call webhook

Set the URL under **Voice Agents** in the developer console. It must be `https`;
the report carries the full transcript. When a call finishes, the engine POSTs:

```json
{
  "id": "CA447c49d29c0aacfc15ebe0976874087c",
  "callType": "phone",
  "startedAt": "2026-08-31T10:30:00.000Z",
  "endedAt": "2026-08-31T10:34:12.000Z",
  "endedReason": "customer-ended-call",
  "durationSeconds": 252,
  "transcript": "Agent: Hi, how can I help?\nYou: I need to reschedule.",
  "recordingUrl": "https://recordings.alebex.ai/.../mixed.wav?X-Amz-Expires=3600&..."
}
```

| Field | Type | Meaning |
|---|---|---|
| `id` | string | The call. The Twilio call SID for a phone call, the same value `POST /public/call/phone` returned. Match on this to recognize a repeat. |
| `callType` | string | `phone` or `browser`. |
| `startedAt`, `endedAt` | string | ISO-8601. |
| `endedReason` | string | `customer-ended-call`, `assistant-ended-call`, `voicemail`, `customer-did-not-answer`, `customer-busy`, `technical-error`, `call-canceled`. |
| `durationSeconds` | number | Billable talk time; your invoice is computed from it. |
| `transcript` | string | Both sides, in order, prefixed `Agent:` and `You:`. |
| `recordingUrl` | string or null | Presigned, valid for 60 minutes from when the report was sent. Download it on arrival. `null` (never missing) if the call was under half a second or the upload failed. Mono WAV, 8 kHz for a phone call. |

Answer `2xx`. Delivery is best-effort and not retried, so match on `id` and treat a
repeat as the same call. There is no authentication header on this request; verify
it against a call you started by its `id`.

## Working example: Node

Places a call with one tool, serves the tool, and receives the report. Express 4+.

```js
import express from "express";

const ALEBEX_API_KEY = process.env.ALEBEX_API_KEY;          // wt_...
const AGENT_ID       = process.env.ALEBEX_AGENT_ID;
const PUBLIC_BASE    = "https://partner.example.com";        // reachable by the engine

// 1. Your tool endpoint. The engine POSTs here mid-call.
const app = express();
app.use("/voice-tools", express.json({ limit: "64kb" }));
app.use("/alebex", express.json({ limit: "2mb" }));          // the report carries the whole transcript

app.post("/voice-tools/check-stock", (req, res) => {
  if (req.get("authorization") !== `Bearer ${process.env.TOOL_SECRET}`) {
    return res.status(401).json({ error: "bad tool credential" });
  }
  const { arguments: args } = req.body;                // args.sku, args.qty?, args.size?
  const taskId = req.get("x-task-id");                 // yours, set at dial time; body.call.id is the engine's id, not the SID
  const stock = lookUpStock(args.sku, args.size);      // your own code
  // Key side effects on call.id + arguments: the model may call twice in one turn.
  res.json(stock
    ? { inStock: true, available: stock.count, readyIn: "20 minutes" }
    : { inStock: false, reason: `SKU ${args.sku} is not carried` });
});

// 2. Your end-of-call webhook. Set this URL under Voice Agents in the console.
app.post("/alebex/end-of-call", (req, res) => {
  const { id, endedReason, durationSeconds, transcript, recordingUrl } = req.body;
  if (recordingUrl) fetchAndStore(recordingUrl);       // the link expires in 60 minutes
  saveCallOutcome(id, endedReason, durationSeconds, transcript);
  res.sendStatus(204);
});

app.listen(8080);

// 3. Place a call. Runs server-side; the body carries your Twilio secret.
export async function callLead(to, taskId) {
  const res = await fetch("https://api.voice.alebex.ai/public/call/phone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ALEBEX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agentId: AGENT_ID,
      to,
      twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        phoneNumber: process.env.TWILIO_CALLER_ID,
      },
      customTools: [
        {
          name: "check_stock",
          description:
            "Check whether a product is in stock at a given store. Call this as soon as the caller " +
            "asks about availability, sizes, or when something will be back. Do not call it for " +
            "questions about an order already placed.",
          // A per-call URL or header: this call's task id, so your side can route on it.
          url: `${PUBLIC_BASE}/voice-tools/check-stock?task=${encodeURIComponent(taskId)}`,
          headers: { Authorization: `Bearer ${process.env.TOOL_SECRET}`, "X-Task-Id": taskId },
          timeoutMs: 8000,
          parameters: {
            type: "object",
            properties: {
              sku:  { type: "string",  description: "Product SKU the caller mentioned" },
              qty:  { type: "integer", description: "How many units they want" },
              size: { type: "string",  enum: ["S", "M", "L"] },
            },
            required: ["sku"],
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // 400: body.detail names the refused tool field. 429: back off and retry.
    throw new Error(`call refused: ${res.status} ${body.detail ?? body.message ?? ""}`);
  }
  const { id, status } = await res.json();
  rememberCall(id, taskId);                             // the Twilio SID: also in the webhook, never in a tool request
  return { id, status };
}
```

## Working example: Python

Flask for the endpoints, `requests` for the call.

```python
import os, requests
from urllib.parse import quote
from flask import Flask, request, jsonify

ALEBEX_API_KEY = os.environ["ALEBEX_API_KEY"]            # wt_...
AGENT_ID       = os.environ["ALEBEX_AGENT_ID"]
PUBLIC_BASE    = "https://partner.example.com"

app = Flask(__name__)

@app.post("/voice-tools/check-stock")
def check_stock():
    if request.headers.get("Authorization") != f"Bearer {os.environ['TOOL_SECRET']}":
        return jsonify(error="bad tool credential"), 401
    body = request.get_json(force=True)
    args = body["arguments"]
    task_id = request.args.get("task")                       # yours, set at dial time; body["call"]["id"] is the engine's id, not the SID
    stock = look_up_stock(args["sku"], args.get("size"))    # your own code
    if stock is None:
        return jsonify(inStock=False, reason=f"SKU {args['sku']} is not carried")
    return jsonify(inStock=True, available=stock.count, readyIn="20 minutes")

@app.post("/alebex/end-of-call")
def end_of_call():
    report = request.get_json(force=True)
    if report.get("recordingUrl"):
        fetch_and_store(report["recordingUrl"])              # expires in 60 minutes
    save_call_outcome(report["id"], report["endedReason"], report["durationSeconds"], report["transcript"])
    return "", 204

def call_lead(to: str, task_id: str) -> dict:
    res = requests.post(
        "https://api.voice.alebex.ai/public/call/phone",
        headers={"Authorization": f"Bearer {ALEBEX_API_KEY}"},
        json={
            "agentId": AGENT_ID,
            "to": to,
            "twilio": {
                "accountSid": os.environ["TWILIO_ACCOUNT_SID"],
                "authToken": os.environ["TWILIO_AUTH_TOKEN"],
                "phoneNumber": os.environ["TWILIO_CALLER_ID"],
            },
            "customTools": [{
                "name": "check_stock",
                "description": ("Check whether a product is in stock at a given store. Call this as soon "
                                "as the caller asks about availability, sizes, or when something will be "
                                "back. Do not call it for questions about an order already placed."),
                "url": f"{PUBLIC_BASE}/voice-tools/check-stock?task={quote(task_id)}",
                "headers": {"Authorization": f"Bearer {os.environ['TOOL_SECRET']}", "X-Task-Id": task_id},
                "timeoutMs": 8000,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sku":  {"type": "string",  "description": "Product SKU the caller mentioned"},
                        "qty":  {"type": "integer", "description": "How many units they want"},
                        "size": {"type": "string",  "enum": ["S", "M", "L"]},
                    },
                    "required": ["sku"],
                },
            }],
        },
        timeout=30,
    )
    if res.status_code == 400:
        raise ValueError(f"tool refused: {res.json().get('detail')}")   # names the field
    res.raise_for_status()
    return res.json()                                        # {"id": "CA...", "status": "queued"}
```

## Checklist before you ship

- The API key and the Twilio auth token live on your server, never in a browser or a
  repository.
- A rotation after a leak counts as done only when `previousTokenDeleted` came back
  `true`.
- Your tool URLs are `https://` on a public host and answer within your `timeoutMs`;
  the caller is listening while they run.
- Tool responses are small JSON with values a person could hear, and under 8 KB.
- Side-effecting tools are keyed on `call.id` plus arguments; the model may call twice.
- Tool requests reach your own records through the task id you put in the URL or a
  header at dial time; `call.id` is the engine's id, not the Twilio SID.
- Tool names avoid the reserved list and are unique within the call.
- Your webhook answers `2xx`, downloads `recordingUrl` on arrival, and treats a
  repeated `id` as the same call.
- `400` responses are read: `detail` says exactly which tool field was refused, and
  nothing was dialed.
- `429` and `503` are retried with a backoff, not in a tight loop.
