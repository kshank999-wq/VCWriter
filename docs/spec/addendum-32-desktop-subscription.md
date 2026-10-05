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
already sat, and §4 said moving it was a separate and bigger decision, named
rather than half-built. **Ken made it the same day** — *make the lapse
read-only on the desktop* — so §8 is that change, and the sentence above is
the corrected one: what a lapse now stops is **changing** a project.

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
- **No trial.** `trialing` entitles, so one is a dashboard setting away, but
  nothing here offers it.

## 8. Read-only at a lapse

> From Ken: *make the lapse read-only on the desktop.*

This overrules §4, which had named it as the bigger decision and left it
unbuilt. The build is small and the **design is the whole of it**, because a
program that will not take a writer's keystroke is one keystroke away from
being the worst thing anybody has ever used.

### 8.1 One place to refuse

Every change to the document in this program is a pure function of the
document, and every one goes through the same `update` — which is the fact
addendum 02 §6c's undo rests on, and this is that fact pointed the other way.
So `useProject` takes a `writable` and refuses there. There are some hundreds
of `project.update(…)` calls in the renderer and **not one of them needed to
know this exists**, which is also what makes it total: an act built next month
is refused the day it is written.

The satellite needs its own, and it is not a duplicate. `useLinkedProject`
applies a mutation **locally before proposing it**, because typing must never
wait for another window — so a popped-out room that did not know would take a
paragraph, draw it, and have it wiped by the next document the hub sent. **A
writer watching their words vanish is worse than one told they cannot type
them.** The standing is a fact about the *machine*, so every window asks the
machine for itself rather than asking the workspace: addendum 29 §2's rule from
the other end, where a room may not write the *file* because the workspace owns
the path.

Two things are deliberately **not** guarded. The **flush** is not, so writing
already in hand still reaches the disk — losing the last few seconds of
somebody's sentence to a webhook that arrived mid-paragraph is the one failure
this feature must never cause. And **`replace`** is not, a cloud merge having
nowhere else to land.

Undo and redo *are* refused, and read `canUndo`/`canRedo` as false: nothing can
be changed, so there is nothing to take back.

### 8.2 A record, not a live answer

The desktop has never held a licence standing — it activates once and every
feature that reaches vc-writer.com asks per call, which is exactly why §4 could
say a lapse touched nothing local. Read-only cannot work that way: **a writer
on a train must not be refused their own manuscript because the machine could
not ask.** So `GET /api/licenses/standing` answers with a status and a date,
`license-check.ts` writes it down with the day it was given, and the renderer
reads it with the domain's `writingStanding`.

The route says nothing about what a lapse *means* — the status and the date are
facts and the rule is the domain's, in one place, so the desktop and anything
built later cannot disagree (addendum 07 §14's reason). It needs no admin
client and no new policy: a customer has read their own licence rows since
migration 0002, so this is their own session asking its own question under RLS,
over cookie or bearer token alike (addendum 27 §2).

**A failure to reach the server changes nothing at all.** No cloud in the
build, signed out, offline, a 500, an unparseable body, a status this build
cannot name — every one of them leaves the record exactly as it was, because
none is evidence that anybody stopped paying.

### 8.3 Generous wherever it is uncertain

The order of the clauses in `writingStanding` *is* the design, and most of them
exist to let somebody write.

| State | Answer |
| --- | --- |
| Nothing ever heard | Writable, nothing said |
| Paid up | Writable, nothing said |
| Lapsed, within the week | Writable, **warned**, with the date it bites |
| Lapsed, the week up | **Read-only**, explained |
| Lapsed, but the answer is over 30 days old | Writable, the lapse said, read-only not claimed |

**Read-only is a lapse, never an absence.** An account with no licence reads as
null, so a copy that was never activated writes exactly as it always has —
turning *those* read-only would be a far bigger change than the one asked for.

**A refusal is announced before it bites.** Stripe has retried and emailed by
the time a licence reads expired, but none of that happened *here*, so
`seenLapsedAt` records the first time this machine saw it and `WRITING_GRACE_DAYS`
gives a week. It is carried forward rather than written again, or every check
would start the week over and read-only would never arrive; a live answer
clears it, so a writer who lapses again next year gets the week again.

**Being unable to ask is not a lapse.** Past `STANDING_GOOD_FOR_DAYS` the
record is a month-old measurement of something that changes weekly, so
read-only lifts: it is a **fresh refusal and never a remembered one**. A writer
whose network is blocked, or who renewed on their phone and cannot get the news
to this machine, must not be locked out of their own book. What the
subscription still gates unconditionally is every part of the program that can
actually ask. The notice there says the licence has ended and says **nothing
about read-only**, which this copy is no longer entitled to claim.

And it is the inverse of `appleState`'s rule rather than a contradiction of it:
**for a shop, a word this build has never heard of is not a reason to hand
anything over; for the writing surface, it is not a reason to take anything
away.** The two point opposite ways because granting a new entitlement and
confiscating work in progress are not the same act.

### 8.4 What the writer is told

`WritingNotice` is one component for the warning and the refusal, because they
are one sentence from the domain in two states and a second banner would be a
second answer to *why can I not type*. It wears the notice bar every other
message in the window wears, with the refusal a modifier rather than a bar of
its own.

**A warning may be dismissed and a refusal may not.** In the week before it
bites this is news, and news a writer has read is news they can put away;
afterwards it is the explanation of a program that will not take a keystroke,
which is the one notice they must be able to find at any moment. Dismissing is
about this sitting and is remembered nowhere.

It is on the **Welcome screen** too: somebody who starts a project on a
read-only copy and then finds they cannot type a word has been trapped by a
screen that knew and did not say.

**The browser preview answers *no record*** rather than refusing. A browser is
not a licensed install — the preview is reached through the gate it is behind,
and a room's writers are there on their seats — so this is a statement rather
than a refusal, and the one thing it must never do is make `/preview`
read-only.

### 8.5 What driving caught

The measurements, at 1440×900 with the host stubbed:

- **Lapsed**: a red `role="alert"` bar, 1440 × 57, `rgb(217, 83, 79)` with a
  3px stripe, Renew and Check again and **no Dismiss**. Typing ` XYZ` into the
  Inspector's title left it reading *Opening beat*.
- **Within the week**: a muted `role="status"` bar at 47px with Dismiss, and
  the same typing landed — *Opening beat XYZ*.
- **Paid up**: no bar at all, and typing landed.

Worth recording because the reasoning could have gone either way: the
manuscript and every field in this program are **controlled React inputs**, so
an `onChange` that does nothing makes React restore the DOM value and the
character never appears. There is no `contentEditable` anywhere, which is what
would have left typed words sitting on screen unsaved. That was checked rather
than assumed.

### 8.6 Not built, and named

- **No local enforcement beyond the document.** A read-only copy still creates
  projects, opens, prints, exports and saves a copy somewhere else — all of
  which the promise says it will.
- **No refusal in the controls themselves.** Nothing is disabled or greyed:
  the bar explains, and the fields simply do not take. Disabling several
  hundred inputs would be a second answer to the same question in every
  component in the renderer.

---

## 9. Tax, per sale

From Ken, settling a question put to him while this addendum was being built —
`automatic_tax` was on unconditionally and nothing recorded whether that was a
decision: *I will use the stripe tax service that is per sale*. So
`automatic_tax: { enabled: true }` stays on both checkout sessions, which is
what the code already did — and **reading the two call sites against that
decision found something neither of them said**.

### 9.1 A subscription is taxed again every month

A single charge can be rated from wherever the buyer appears to be and nothing
is lost afterwards. **A subscription is re-rated at every renewal**, and a
renewal has no browser and no buyer in front of it: Stripe Tax computes it from
the address saved on the **Customer**. With no valid location there, the
renewal invoice **stays in draft** — which is the quiet failure this project
keeps finding, and the quietest version of it yet: the subscription goes on
reading active, the card is never charged, nothing errors, and the first person
to learn of it is whoever eventually reconciles the account. Addendum 31 §9's
webhook gate is the same shape one step earlier.

Two things follow, both one line.

**`billing_address_collection` is `required` rather than `auto`.** `auto` lets
Checkout decide an address is unnecessary — a reasonable judgement about a
single payment and the wrong one about a subscription, because what it decides
not to collect is what every later invoice has to be computed from.

**And a session that names an existing customer must write the address back.**
This is the one that was actually broken. `room-billing.ts` passes `customer`
where the room's owner already has one, and with `automatic_tax` on and no
`customer_update`, Checkout computes from **the address already on that
Customer** and discards the one the showrunner typed at the checkout. A
Customer made by an earlier purchase very often carries none, so the seat
subscription is exactly the case that would have gone to draft. `customer_update:
{ address: 'auto' }` fixes it, **inside the same branch** — Stripe refuses the
field without a `customer`, so moving it up beside `automatic_tax` would break
every seat checkout for a room whose owner has no Stripe customer yet, which is
why the test pins the pairing in both directions.

The desktop route needs no `customer_update` and must not have one: it names an
email, so Checkout makes the Customer itself and saves the collected address on
it.

### 9.2 What it is pinned by, and what it is not

Read off the two sources, addendum 31 §4's and §9's idiom, for their reason: a
Checkout Session cannot be created in a test and a Stripe signature cannot be
forged in one, and **both of these fail silently and later** — the first charge
is perfectly correct either way.

**The Stripe half has still never been run live** (§7), so what is proved is
that the sessions ask for what Stripe Tax needs. The rest is Ken's, in the
dashboard, and is named rather than assumed: Stripe Tax needs an **origin
address**, at least one **registration** for anywhere tax is to be collected,
and a **tax code** on the product — without the last, software is rated as the
default category, which is wrong in several of the places a registration would
be taken out.
