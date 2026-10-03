# Addendum 31 — Discount codes

> From Ken: *there needs to be the ability to give discount codes, create
> discount codes in a checkout screen and for advertising.*

Three things, and the audit answers the first one before a line is written.

## 1. What was already there

`apps/web/src/app/api/checkout/route.ts` has carried
`allow_promotion_codes: true` since it was written, so **Stripe's hosted
checkout has always shown an *Add promotion code* field** and a code made in
the Stripe dashboard has always worked. Giving a discount was built; what was
missing is everything around it.

| Ken's three | Where it stood |
| --- | --- |
| Give a discount code | **Built**, in Stripe's own checkout page |
| Create one | Only in the Stripe dashboard — nothing in this program |
| For advertising | Nothing at all |

So this addendum is the second and third, plus a code box on **this** site's
buying page rather than only on Stripe's.

## 2. Stripe is the till, so the discount lives there

`pricing.ts`'s rule, applied to the other half of the transaction: the price is
read from Stripe rather than repeated here, so what comes **off** it must be
too. **There is no `discount_codes` table and no migration.** No stored
percentage, no copied expiry, no redemption counter — a code withdrawn in
Stripe stops working here with nothing run, and the admin screen is a window
onto the one set of codes rather than a second set to keep in step.

What the domain holds is the part that is not Stripe's:
`packages/domain/src/discounts.ts` — the one spelling of a code, what an offer
says in words, what a reader is charged, the link an advertisement carries, and
what is refused. Rules about the shop rather than facts about the money, and
the ones four screens would otherwise each write for themselves.

**A coupon is the discount and a promotion code is the word you say.** That is
Stripe's own split and it is kept rather than flattened, because one coupon —
*20% off* — can carry several codes, which is exactly what advertising in more
than one place needs: each code counts its own redemptions, so the podcast and
the newsletter can be told apart. Making one here makes both in a single act,
since somebody naming a code has not asked to learn the distinction.

## 3. One refusal, for every way a code can fail

Unknown, expired, used up, switched off, for another product: a customer does
exactly the same thing about all five — asks for one that works — so five
sentences would be five answers to one question. The one that tells them apart
is also the one that tells a stranger which codes exist. `DISCOUNT_REFUSAL` is
*That code is not valid.* and the rate limit (thirty an hour) is there for the
only thing about a published code that is not public: guessing at one nobody
published.

## 4. The shape is the permission

A browser may name a **code** and may not name what it is worth. The checkout
body takes `platform`, `email` and `code`, and has no field for a percentage,
an amount, a coupon or a promotion-code id — so a client that decided its own
discount has nowhere to put it. The server resolves the word with Stripe and
refuses one that is not redeemable rather than quietly charging full price:
somebody who followed an advertisement and is charged in full without being
told has been overcharged as far as they are concerned.

`discount-shape.test.ts` hands that schema everything a client might hope
decides its price and watches all six fields fall off — and its first
assertion **reads the route's own source**, because a test whose subject has
quietly drifted is worse than no test.

**Stripe refuses `discounts` and `allow_promotion_codes` together**, which is
its API's rule rather than a choice made here — and it is the right way round:
somebody who arrived with a code should not be shown an empty field asking for
one, so the box is offered to everybody else.

## 5. The advertising half, and the word that was taken

A code printed in an advertisement is only as good as the link beside it. A
reader who has to carry six characters from the page to the checkout is a
reader who forgets; one handed a link arrives with the discount already named.
So every code in the admin list has its link ready to copy, the buying page
reads it, says what it takes off, and applies it without anybody typing.

**The first draft built that link on `?code=` and it did not work at all.**
`strayAuthRedirect` forwards a `?code=` on any page to the Supabase auth
callback — behaviour added after a real sign-in failure — so
`/download?code=LAUNCH20` became `/auth/callback?code=LAUNCH20`, failed the
token exchange, and landed the reader on **“your sign-in link has expired”**
with the discount never mentioned. The page itself was perfect and unreachable;
only driving the real site found it, and no unit test could have.

So `DISCOUNT_PARAM` is `discount`. It is the third name this project has had to
step around for the same reason — `origin` was taken, so a moment is `found`;
`Standing` was taken, so a node's is a `Situation` — and the rule is the same:
**the collision is with a word, so the fix is a word.** Two tests pin it, one
that the advertised link survives `strayAuthRedirect` and one that `?code=`
really would not have.

## 6. What was driven, and what it caught

The buying page at 1280 and 420, with the shop stubbed at the network the way
the desktop stubs its preload bridge; the admin screen in a scratch harness,
since it is gated on a Supabase session this container has no keys for.

- **Typed**: `launch20` reads back as `LAUNCH20`, a wrong code gives the one
  refusal, a right one replaces the field with *LAUNCH20 — 20% off ·
  ~~$249~~ $199.20 · Remove*.
- **Followed**: `?discount=launch20` applies itself on arrival, at both widths.
- **Four dead classes.** The first draft reached for `.panel`, `.table`,
  `.link` and a bare `.muted`, **none of which has a rule on this site** — the
  admin console's own vocabulary is `.card` and `.data-table`, and `.muted` is
  the trap addendum 09 §14a and §14c each named. `Remove` came out as a native
  grey browser button sitting inside a sentence.
- **A control hidden behind a scrollbar that draws nothing.** The advertisement
  column took the whole un-wrapped URL, ran the table to 1018px inside a 944px
  box and put `Switch off` — the one control that withdraws a code — 82px past
  the edge (addendum 19 §10, where what was hidden was a control rather than a
  picture). Two wrong fixes before the measurement settled it: the cell needed
  a **cap and not a floor**, because a floor was never what was holding it
  open, and it needed the table's own `.wrap`, its cells being `nowrap` by
  default.

## 7. One money formatter

`formatPrice` lived in `pricing.ts` and `formatMoney` in `admin-console.ts`,
both pure and both in modules that reach Stripe or the database — so a screen
that merely wanted to write `$10` could not have one without dragging a server
client into the browser. They are `packages/domain/src/money.ts` now, kept
apart rather than merged because **a price is advertised and a figure is
accounted for**: the first drops the two zeros nobody is being asked for, the
second never does.

## 8. Not built, and named

- **The Stripe half has not been run live.** No code has been created against a
  real account from this container, and there are no test keys here. What is
  proved is everything either side of it: the rules, the refusals, the schema,
  the three screens and the two routes, driven against a stubbed shop. §9 is
  what asking for that test turned up anyway.
- **Nothing is deleted.** Withdrawing a code switches it off, for the
  graveyard's reason (addendum 24 §1): the orders it was used on still refer to
  it, and *how did LAUNCH20 do* must still have an answer a month later.
- **No per-customer or first-time-only codes.** Stripe supports both on a
  promotion code; neither is offered here until somebody asks, a control
  storing a restriction nobody uses being one that lies.
- **The code is not carried through sign-in.** A reader who follows an
  advertised link and then signs in mid-purchase loses the code and has to
  apply it again. Named rather than half-built.

## 9. The free purchase, and what asking for a test found

> From Ken: *make a test code and run it through checkout.*

**It cannot be run from here**, and that is the first half of the answer rather
than an excuse: `STRIPE_SECRET_KEY` is stored in Vercel as a *sensitive* variable
whose value the API will not return to anybody, including this container; there
is no key in the environment, none may be put in this repository, and Ken must
not be asked to paste one anywhere. The egress proxy blocks `vc-writer.com` too,
so even the public half could not be driven. Nothing was created in Stripe.

**What could be done is work out what that test would meet**, and it met
something. A test that costs nothing is a **100%-off code** — which is also a
review copy, a press copy and a giveaway, so it is not a testing contrivance but
the thing the feature exists to give. Everything up to the till was already
right: `newDiscountRefusal` allows exactly 100, `priceWith` answers zero, the
admin screen makes it and Stripe would take it.

**And the webhook would have dropped it on the floor.** `payment_status ===
'paid'` was the gate, and **Stripe answers `no_payment_required` when the total
is zero** — so a 100%-off checkout completed, the buyer saw the success page, and
the webhook claimed the event, skipped fulfilment, marked itself processed and
returned 200. **No order, no licence, no email, and no error either**, which is
what makes it the bad kind: nothing in the program would ever have reported it,
and the one person who would have found out is the buyer holding a receipt for
nothing. Every test in the suite passed over it, because every test used a paid
session.

`purchaseSettled` in `discounts.ts` is the one reading of Stripe's three words,
and it lives in this module for a plain reason: **a discount is the only way a
purchase here reaches nothing**. It is `appleState`'s rule on the other shop
(addendum 09 §14) — **a word this build has never heard of is not a reason to
hand anything over** — so the two that settle are named and everything else,
`unpaid` included, is refused.

Three smaller things:

- **Fulfilment itself needed no change at all**, which is worth saying because
  it is why the fix is one line: `amount_cents` is `check (>= 0)`,
  `stripe_payment_intent_id` is nullable, and `fulfillCheckout` already takes
  `paymentIntentId: string | null`. The money path was built general and the
  gate in front of it was not.
- **A code taking everything off says so before the press.**
  `describeNewDiscount` adds *Nothing is charged and no card is asked for, and
  the licence is still issued*, because what happens next is not what somebody
  setting a percentage would guess. It is said only where it is certain — a
  *percentage* of 100 says it and a fixed amount does not, this module not
  holding the price, and a sentence about a free purchase that merely might be
  one being worse than none.
- **The gate is pinned by reading the route's own source**, which is this
  addendum's §4 idiom pointed at a webhook: a Stripe signature cannot be forged
  in a test, so the reading is tested in the domain and what is tested here is
  that the route still *asks* it rather than having drifted back to a literal.

So the honest state is: the free purchase is fixed and proved either side of
Stripe, and the one thing still unrun is the same one §8 names.

**For the test Ken asked for**, the whole of it is now one minute in the admin
screen and no money: make a code at **100% off with a limit of 1**, follow its
own *Copy* link, and complete checkout — Stripe asks for no card, the limit
burns the code so nobody else can use it, and the order, the licence and the
email now arrive.
