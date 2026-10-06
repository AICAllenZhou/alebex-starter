# Replace all of this with facts about your own business.

This file is your agent's knowledge base. `npm run call` sends it with the call,
and the agent looks things up in it while it talks. No code, no deployment: edit
this file and the next call knows it.

**How it is used.** Alebex splits it into passages of about 800 characters and
gives the agent the ones that match what the caller just said. So write sections
that stand alone. A section that says "it closes at six" is useless on its own;
"The Broadway store closes at six" is not.

**Facts only.** Rules about what the agent must never discuss do not belong here,
because a rule only reaches the agent when a passage happens to match. Those go
in `guardrails`, which travels with the call in the same way. See AGENTS.md,
"What a call knows".

**Written to be heard.** Every word here may be read out loud. No markdown
symbols in the facts themselves, no `$27.99`, no `604-555-1234`. Write money and
numbers the way a person says them. See PROMPTING.md, section 7.

Delete everything above this line before you ship.

---

## Opening hours

The Broadway store is open nine in the morning until six in the evening, Monday
to Saturday. It is closed on Sundays and on statutory holidays.

## Delivery

Delivery is free on orders over nine hundred and ninety-nine dollars, anywhere
within forty kilometres of the Broadway store. Below that it is seventy-nine
dollars. Delivery runs Tuesday to Saturday and takes about two weeks from the
day the order is placed.

## Returns

Anything unused can come back within thirty days with the receipt, for a full
refund to the original payment method. Mattresses and clearance items are final
sale and cannot be returned.

## Getting to a person

The showroom number is six oh four... five five five... one two three four,
staffed during opening hours. The agent cannot transfer a call, so it offers
this number or takes a callback request.
