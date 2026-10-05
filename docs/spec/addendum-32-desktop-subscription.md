# Addendum 32 — The desktop subscription

> From Ken: *we are switching to 19.99 mo subscription base and 199.99 yearly
> subscription.*

VC Writer has been a one-off purchase since migration 0002. It is two recurring
plans now.

## 1. The audit, a twenty-seventh time

Four of the things a subscription needs were already standing, and the fact
that they were is most of why this change is small.

| What a subscription needs | Where it already was |
| --- | --- |
| A licence that can end | `license_status` has carried **`expired`** since 0002 — a value nothing has ever written |
| A date it ends on | `licenses.expires_at` has been a column since 0002 — nothing has ever written it |
| Somewhere for Stripe to say so | The webhook has handled `customer.subscription.*` since the Writers Room seat |
| A price that recurs | `DisplayPrice.recurring` has been read off Stripe since `pricing.ts` was written |

So **a subscription is not a second kind of entitlement**. It is the licence
this program already has, with its expiry finally written down.

That matters because of what reads it. `decideActivation`, `canDownloadPlatform`,
the download route, the account page and the admin console all ask
`license.status`, so **pointing a lapse at that one field carries it everywhere
with nothing else told**. The whole of the enforcement change is that those two
callers now ask `licenseLive` instead, which reads the status *and* the date.

## 2. What is genuinely new

One column (migration 0066): `licenses.stripe_subscription_id`, unique where it
is not null. A subscription renews every month or every year, and **if each
renewal made an order and a licence a writer would collect twelve serials a
year** — so a renewal finds the licence it already has and moves two fields.
The order records the first payment, as it always did.

## 3. The decisions

**A plan is a word, never a price.** The checkout body takes `monthly` or
`yearly` and has no field for a price id, an amount or an interval, so a client
that decided what it was going to pay has nowhere to put it. The shape is the
permission a fifth time (addendum 07 §12, 16 §10, 26 §14a, 31 §4).

**No price appears anywhere in this repository.** `pricing.ts`'s rule is that
Stripe is where the price lives because Stripe is what charges the customer, so
changing a plan's price is a minute in the dashboard and nothing here moves.
The *saving* on the yearly plan is likewise read — `yearlySaving` over the two
figures — rather than a badge somebody typed and has to remember.

**`past_due` entitles, deliberately.** It means the latest invoice failed and
Stripe is still retrying, which is overwhelmingly an expired card rather than
somebody leaving. Taking the program away on the first failed retry punishes
the commonest and most innocent case, and is what addendum 07 §23 refused for a
room. Everything Stripe says once it has stopped trying — `canceled`, `unpaid`,
`paused` — does not entitle, and **a word this build has never heard of does
not either**, which is `appleState`'s rule on a third shop.

**The date is read as well as the status.** A webhook is a message that may not
arrive: if a cancellation event is lost the stored status still says active
while the paid period has plainly run out, and a date already in hand is a
better answer than a message that never came. **A licence with no expiry never
lapses**, which is every row written before today.

**A subscription says what it is for.** Desktop plans and Writers Room seats
arrive at one webhook as the same events, so the handler routes on metadata
each checkout stamped — a seat says `room_id`, a desktop plan says
`kind: 'desktop'` — and one that says neither (a subscription made by hand in
the dashboard) is **left alone rather than written somewhere**.

**`STRIPE_PRICE_ID_DESKTOP` is gone rather than kept as an older spelling.**
This project usually keeps the old name (`template`/`layout`,
`manuscript`/`serif`), and the reason not to here is that there is no sense in
which a recurring price is the same object: a one-off price in a
`mode: 'subscription'` checkout fails at Stripe with a message about modes that
tells a reader nothing about what to fix. It is `STRIPE_PRICE_ID_MONTHLY` and
`STRIPE_PRICE_ID_YEARLY`, both recurring, both on one product.

## 4. What a lapse actually reaches

**`DESKTOP_LAPSE_PROMISE`**, and it is a *description of what the program
already does* rather than a rule invented here: an activated copy keeps
opening, reading, printing and exporting every project on the disk, because
nothing local has ever asked the server for permission to write a word. What a
lapse stops is **taking a new machine** — `decideActivation` refuses a licence
that is not live — and the parts that ask vc-writer.com for themselves: the
installers, the Final Editor's read, the Writers Room.

That line was not chosen so much as found: it is where the existing gates
already sat. **Moving it is a separate decision and a bigger one**, and if the
desktop should go read-only at a lapse that is a change to the writing surface,
named here rather than half-built.

## 5. The name that was taken, again

`LAPSE_PROMISE` is the Writers Room's. Mine is `DESKTOP_LAPSE_PROMISE`, and
this is the **fourth** time a name already spoken for has forced a new word
here — `origin` taken so a moment is `found`, `Standing` taken so a node's is a
`Situation`, `code` taken so the discount parameter is `discount`.

What is worth keeping is *how it was found*: **the typecheck passed over it.**
A star re-export conflict is a runtime fault, so the domain built, the whole
suite stayed green, and the buying page returned a 500 saying
`conflicting star exports for the name 'LAPSE_PROMISE'`. Only running it found
it.

## 6. What driving caught

Three faults, all of them invisible to the tests and two of them on one card.

- **The price drew at 14px.** `.plan-option span` is two selectors and beats a
  single `.plan-figure` however far down the file it sits, so the one thing on
  the card a reader is looking for was set at the size of the small print.
  Specificity rather than source order (addendum 26 §13), and it took measuring
  the computed size to see, both figures being perfectly legible.
- **`per yearSave 17%`.** The saving was `inline-block` after an inline span,
  so a `margin-top` did nothing and the two ran together as one phrase.
- **The two cards' headings sat 15px apart.** A `<button>` centres its own
  content, so the card with no saving line hung lower than the one with it. The
  platform cards never showed this because both of theirs are the same height.

And one in the wording rather than the layout: *After payment you get your
download* and **Continue to payment** had both survived from the purchase into
a page that now sells a subscription.

## 7. Not built, and named

- **The Stripe half has not been run live** (addendum 31 §8's caveat, for the
  same reason: no key reaches this container). What is proved is everything
  either side of it — the rules, the gates, the routing, the screen, and
  fulfilment against a fake that enforces the same unique constraints Postgres
  does.
- **Nobody is being migrated**, because there is nobody: measured on the live
  project, `orders`, `licenses` and `stripe_webhook_events` are all **empty**.
  Had they not been, the first question of this change would have been what
  happens to a perpetual licence somebody had already bought — and the answer
  would have been addendum 27 §14.1's, that a subscription adds and never takes.
- **No proration or plan switching in the app.** Stripe's Customer Portal does
  both and is already turned on for the room; the account page should link to
  it, which is the next thing to build.
- **The desktop does not go read-only at a lapse** (§4).
- **No trial.** `trialing` entitles, so one is a dashboard setting away, but
  nothing here offers it.
