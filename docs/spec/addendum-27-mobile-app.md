# Addendum 27 — Notes on the App Store and Google Play

From Ken: *we need to create notes as an app for the apple app store and
android*.

---

## 1. The audit, which is most of the answer

Addendum 09 §5 chose the web app over native and said why it could afford to:
the build order was arranged *so everything before stage 4 was the same either
way*, and it recorded the consequence — **a native app later inherits every
other stage untouched**. That promise comes due here, and it held.

**Already portable, and not rewritten:** `capture-session.ts`,
`capture-voice.ts`, `capture-vocabulary.ts`, `capture-upload.ts`,
`capture-approval.ts` and `capture-shelf.ts` — about 2,200 lines with no DOM
in them at all. `hear` folds an utterance into a walk, `readSpoken` reads one,
`askAbout` decides what to ask next, `speakBack` decides what to say aloud,
`groupsSaid` keeps one spelling per group, `captureVocabulary` reads the words
off the format. The app imports them and calls them. **Every rule the phone
follows is the rule the website follows, tested by the same 2,500 tests.**

**Already built, and pointed at exactly this:** the four `/api/notes` routes,
whose own comment says they exist *because another developer's app should not
need this project's RLS in its head* (addendum 09 §3).

**Already built, two days ago, for the same reason one layer out:** password
sign-in (addendum 09 §14). A magic link is bound to the browser that asked for
it; a native app has no browser to come back to at all.

**Actually new:** the screens, and the three things the browser was doing —
hearing, the offline queue, and the beep.

---

## 2. The door that only a browser could open

`currentUser()` read **cookies and nothing else**. So the routes written so
that another developer's app would not need the RLS in its head could only
ever be called by a browser, which is the same shape of fault as addendum 09
§15's bridge answering `ok([])`: **a door built for a caller that could not
open it.**

An app proves who it is with a **bearer token**, and `serverClient()` reads one
now. Three decisions.

**It is read in `serverClient()` rather than in the notes routes**, because
*who is calling* must have one answer — a second reader would drift, and the
phone will want more of the site than the four routes it starts with.

**The token is that person's session rather than a way past it.** It is handed
to Supabase, so row-level security applies exactly as it does to the cookie; a
route cannot see more because the caller is an app.

**Nothing that worked yesterday reads differently today**: a browser sends no
`Authorization` header unless it is asked to, so the cookie path is untouched
for every one of the fifty-two files that use it.

Driven against a stub that answers only for the right token: no token 401, a
wrong token 401, the app's token 200 with the project list — and the stub
refuses the *table* read without the token too, which is what proves it is
forwarded rather than merely accepted at the door.

---

## 3. Signing in

**A password, and no magic link at all.** *Email me a link* is **absent rather
than offered and broken** — this project's oldest rule, and here it is the
difference between a way in and a loop. Somebody with no password is sent to
vc-writer.com to set one, in a sentence that says where and why.

The session lives in the device's own storage and refreshes itself, so a
writer signs in once and never again: **a notebook that asked for a password on
a walk is one nobody carries.**

The anon key is publishable by design — it is already in every page of
vc-writer.com, and what protects the data is row-level security rather than the
key being secret. It is still read from the environment rather than written
into the repository, because a key in a file is a key nobody rotates.

---

## 4. The queue

**The same interface the web app has, on the storage a phone has** — IndexedDB
there, SQLite here — and the ordering that is the whole feature is identical: a
note is **written down before it is sent**.

It is a rewrite rather than a port for one honest reason: `capture-queue.ts` is
`indexedDB` from its first line to its last. What is shared is the thing worth
sharing — `QueuedCapture`'s shape, and `client_capture_id`'s promise that a
retried send cannot make a second copy of one thought.

Addendum 09 §13's lesson is built in rather than remembered: **`file` writes the
note down and sends it**, one function, so there is no way to do half of it the
way the web app once did. And a partial accept marks **exactly the notes that
landed**, which is what the route answers with — marking the whole batch is how
a note is lost while the screen says it was sent.

---

## 5. Hearing, speaking, and the two tones

**This is the reason the app is native rather than a wrapped web page.**

The browser's `SpeechRecognition` is a real capability on Android Chrome and a
limited one in Safari, and inside an iOS web view it needs the network, stops
when the screen locks, and cannot be relied on. That is survivable for a page
somebody reads and fatal for a notebook used on a walk, where the phone is in a
pocket and the entire feature is that nobody is looking at it.
`SFSpeechRecognizer` and Android's `SpeechRecognizer` do continuous recognition,
**on the device where the device can**, with an audio session that survives the
screen going dark — which is also why a walk out of signal works at all.

`listen.ts` does what its name says and nothing else: **what is heard is not
what it means**, and `hear` and `readSpoken` decide that, in the domain, as
they do for the website.

Speaking back keeps its own rule — **it answers commands and never the
writing**, because reading dictation back would talk over somebody
mid-sentence. And the beep keeps the rule addendum 09 §10 settled: **two tones
told apart by direction rather than pitch**, a walk not being a quiet room. They
are synthesised rather than shipped as files, a tone being four numbers, and
the header is what `wav.test.ts` pins — a WAV whose header disagrees with its
data plays as silence, which on a walk reads as *the app did not hear me*.

---

## 6. Where it opens

**The project list, always** — addendum 09 §2's *project first*, which is not
an ordering but the thing that stops a writer dictating a minute into whichever
script was open last.

Which projects show is `capture-shelf.ts`, the same reading the website uses:
only what is **off** is written down, so a project started tomorrow is here
without being asked, and the choice reaches this device and nothing else.

---

## 7. Catching a thought

Two ways, as on the website. **Typed**, with the project's own vocabulary as
chips and `readSpoken` reading a dictated utterance for it. And the **walk**,
which is `hear` and nothing else: a note opens, the words go in, *dictate done*
closes it, *dictate group …* puts the next ones together, and a project can be
named and made out loud.

The walk screen is the whole display, in the largest type the app has, because
what a glance has to confirm is *is it listening* and *did it get that*.

---

## 8. Review

Addendum 09 §7's list and its restraint: read, corrected and thrown away **only
while a note is still waiting**, `mayStillEdit` deciding in the domain and RLS
refusing underneath.

One thing it does that the website's does not, and must: **what is still on
this phone is said as such.** A walk out of signal ends with notes the server
has never heard of, and a screen listing only what the server knows would be
§13's bug with a different cause — a writer looking at an empty list while
holding a phone with their morning on it.

---

## 9. What is honestly not done

**It has never been run on a device.** This container is Linux: it typechecks,
its tests pass and its dependencies resolve, but an iOS build needs macOS and
Xcode or a cloud builder, and neither is reachable from here. Everything above
is built and nothing above is proved on hardware.

**The store accounts are Ken's to make.** Apple's Developer Program is $99 a
year and Google Play $25 once; both verify identity, and a new personal Play
account must run a closed test with twelve testers for fourteen days before it
may go to production. Nothing in this repository can stand in for that.

**No signing key belongs here.** The iOS certificate and the Android keystore
live with Ken or in the build service's own secret store, never in a file that
is committed.

Deliberately absent for now, and named rather than half-built: a wake phrase
(*Hey VC Writer*), which needs always-on audio and is a different permission
conversation with both stores; and notifications.

---

## 10. The bundler, in a workspace

`metro.config.js` exists because **a build that cannot resolve the domain is
not store-ready however finished the screens are**, and Metro's defaults
assume one `node_modules` under one project. Three lines answer it: the
repository root joins `watchFolders`, two directories become the only two
that may resolve a package, and `disableHierarchicalLookup` is turned on —
the one that is easy to leave out and the reason this is a file rather than a
field. pnpm's store keeps a package's own dependencies under
`.pnpm/<name>@<version>/…`, so walking up from a file to find `node_modules`
finds the **wrong copy of React**, which fails at runtime rather than at
build and reads as the new architecture being broken.

`@vcwriter/domain` is consumed as its built `dist`, so `eas-build-post-install`
builds it before the bundler starts. The alternative — pointing `paths` at the
source — was tried when this app was first written and dragged the eBook
writer's platform globals into a phone's typecheck, which is the same fault
one layer up: **a package is consumed the way it is published, or it is not
one package.**

---

## 11. The icon, and the shape a launcher cuts

`brand/logo/icons.mjs` has cut every application icon from one piece of
artwork since the desktop shipped, and this adds three entries to its table
rather than a second cutter — the argument this project makes about screens,
made about images: two scripts would be two answers to *what does this
product look like*, free to disagree the first time the art is replaced.

The one decision worth keeping is **the size of the Android adaptive
foreground**. A launcher may cut any shape it likes out of the 108dp canvas
and guarantees only the central 72dp circle, so a square that survives every
mask has a side of 72/√2 — **0.4714 of the canvas**, which is smaller than a
logo usually sits on a home screen. That is the trade this artwork asks for:
the gold double frame **is** the mark, so a corner clipped off it is worse
than a mark drawn small. It is the maskable PWA icon's rule (0.566, from
Android's 80% promise for that surface) with Android's other number, and the
two are deliberately different because the two promises are.

The foreground is transparent outside the art and the black comes from
`adaptiveIcon.backgroundColor`, a black square drawn into the image being a
second answer to what that colour is. Rendered under a circle, a squircle and
a square at launcher sizes, the frame survives all three.

The iOS icon is written with an alpha channel, which the App Store does not
take — and needs no handling here, because Expo's prebuild generates the
`AppIcon.appiconset` with transparency removed and **that generated set is
what is submitted**. The splash is the same full-bleed art on `#070604`, the
ink the first screen is painted in, so what a writer sees while the app
starts is the frame standing on the ground the app stands on.

---

## 12. The policy, and the deletion that made it true

Both stores refuse a submission without a privacy policy at a public URL, and
**there was none** — so `/privacy` is new. The stores are why it was written
this week; they are not why it reads as it does. **A writer's manuscript is
the most private thing this program will ever hold**, and the question
somebody asks before dictating a novel into a phone is *who else can read it*
— so that is answered in the second section, in a sentence, rather than in a
clause with exceptions after it.

What makes it worth publishing is that **every claim is checkable against the
code**: the processors are the keys in `lib/env.ts`, the crash report's fields
are the schema in `api/telemetry` (opt-in, off by default, redacted twice),
*we do not read your work* is row level security plus the fact that no reading
in this application takes a manuscript anywhere, and the AI section describes
the three routes that exist rather than a general permission. A policy that
claims more than the code does has to be rewritten the first time anybody
checks.

Then it said somebody could delete their account, **and they could not** —
which is the half of this section worth writing down, because nothing was
missing from the application. The database refused. `profiles.id` cascades
from `auth.users`, so removing the sign-in removes the profile, and both
`orders.user_id` and `licenses.user_id` referenced that profile **on delete
restrict**: every customer who had ever bought anything was undeletable, which
is exactly the set of people most likely to ask. Migration 0062 separates the
two, and separating them is the whole of it.

**An order outlives the account, because it is a financial record.** It does
not need a person attached to be one — it carries the amount, the currency,
the Stripe session, payment intent and customer, and when it was paid, which
is a complete receipt, and Stripe holds the identity half under its own
retention. So the column is nullable and the reference is `set null`.
**A licence goes with the account, because it is an entitlement**: somebody
who deletes their account has given up the software, and a serial with no
owner is a row nobody can retrieve and nobody may use. Its activations already
cascaded from it.

Everything else needed nothing, and one part of that is worth naming:
addendum 07 §1's rule that **one writer's work is never destroyed by
another's** had already decided what happens to work contributed to somebody
else's room — a version's author and a seat's holder set null rather than
cascading — so a question nobody had asked was answered years before it was.
It cuts this way too, and is therefore said on the screen before the press
rather than discovered after it, alongside the receipt.

`POST /api/account/delete` is **one route for both doors**, which is what §2's
bearer token was for: the account page and the Notes app press the same button
and there is one answer to *what does deleting mean*. It is one call —
`auth.admin.deleteUser`, and the cascades do the rest — because writing the
deletions out would be a second, longer answer to a question the schema
already answers, and the first table added next month would be the one it
forgot. The confirmation is the account's **own email address, typed**: a
boolean is a click, and this is the one act in the product that the graveyard
cannot take back.

On the phone it is **in the app rather than behind a link to the website**,
which Apple asks for and which is right for the project's own reason: an
application that will write your notes to a server and cannot take them off it
is asking to be trusted on somebody else's screen. Building it found that the
app had no way to sign out either, and no way to see which account it was
signed into — three things a store requires and the app could do none of them,
all of them now behind **Projects ▸ Account**.

---

## 13. The listings, and what cannot be made here

`docs/store-listing.md` is every field both consoles ask for, filled in rather
than described: the name, subtitle, description, keywords, the App Store
privacy labels row by row, the Play Data safety answers, the content rating,
the export-compliance answer, and the review notes. It is written as the
**answer** and not as a draft to be reworded in the console, for the reason a
second copy is always wrong: the one in the console is the one people read.

Two things in it are honest absences rather than omissions. **The screenshots
cannot be produced here and must not be faked** — both stores require shots of
the app as it actually runs, a mock-up is a rejection, and more to the point
it is a lie about what a writer will see; the document names the five to
capture, in the order somebody meets them, and the sizes each store wants.
And **the feature graphic** wants designing, which is `brand/artboards.html`'s
job.

`eas.json` is three build profiles and a **deliberately empty `submit` block**:
`eas submit` asks for an Apple ID and a Play service account at the prompt and
stores nothing, which is the only arrangement in which *no credential belongs
in any repository* is enforced by the file rather than remembered. The two
Supabase values are EAS environment variables, named in `apps/mobile/README.md`
with the commands — the anon key is publishable by design, and is still read
from the environment so that rotating it is a dashboard change rather than a
release.

## 14. Notes as a paid app

From Ken: *notes is a feature on the website but it's going to be notes app,
and it's going to need to refer the person to the app store to get the
companion app. And we'll make it like $49.99 a year or $4.99 per month* —
sold by **in-app purchase, App Store and Play**, covering **Notes and its
cloud sync**, with `/notes` on the website becoming **an advertising and
referral site where you can see the feature value**.

### 14.1 The subscription adds and never takes

The desktop licence is a purchase (spec §12.2) and a Writers Room seat is a
Stripe subscription (addendum 07 §14). This is the third entitlement and the
first whose till belongs to somebody else.

**What it entitles is Notes** — the app, and the syncing that is the whole
point of a capture app that is not where the writing happens. A desktop
licence has carried cloud sync for the project it owns since migration 0002
and goes on carrying it: **nobody who has already bought VC Writer loses
anything on the day this ships**. That is addendum 07 §1's rule pointed at a
new product, and it matters here because a subscription bolted onto something
people were already using is how a customer learns the software can be turned
against them. Ken's *Notes + cloud sync* is true without that, the phone's
notes *being* the sync; and if the desktop's own project sync should ever go
behind it, that is a separate decision about existing customers and it is
named here rather than made quietly.

**And nobody who was already using it loses it.** `NOTES_FREE_FROM` is the day
Notes became a paid app, and an account whose first note was captured before it
reads `included` — everything a subscription buys, with nothing to buy and no
offer made, because somebody who already has it is not somebody to sell to. It
is **a reading over `capture_items` rather than a flag** somebody has to
remember to set on the right accounts, it is asked **only where nothing is
being paid for** (so a subscriber costs no extra query), and it is read
**after** a live subscription and **before** a lapse: a subscriber's line says
what they pay for, and a subscription that ends or is refunded falls back to
it, which is the generous answer and the right one. Without it, the day this
shipped would have been the day the phone stopped sending for every person
using it — §14.1's own rule broken by §14.1's own change, which is the shape of
mistake this project makes when it does not check.

**A lapse never reaches what somebody wrote.** `NOTES_PROMISE` says it
wherever a refusal is: a subscription that ends stops the phone **sending**.
Everything already sent stays readable on the phone and on the desk, and
anything already filed into a project is part of the project. There is
deliberately no `mayReadNotes` in `notes-plan.ts`, because there is no state
in which reading is refused — `LAPSE_PROMISE`'s shape a second time.

**Two shops become one vocabulary, in the domain.** Apple reports a
subscription's status as a number and Google as a name, and neither's list is
the other's, so `appleState` and `playState` map both into `NotesState` and
nothing downstream knows which shop sold it. They are pure and tested for the
plainest reason: they are the part that can be wrong in a way nobody notices
until somebody who has paid is refused. A status this build has never heard of
reads as **expired rather than active** — an unknown answer is not a reason to
let somebody in.

**The store is the till and the website is the advertisement.** The price
lives in the shop, as it does in Stripe for everything else (`pricing.ts`):
the app shows what StoreKit or Play Billing says it costs in the reader's own
currency, which is both truer and what both shops require, and a plan the shop
has never heard of is **absent rather than offered at the website's figure**.
`NOTES_PRICE_WORDS` is the advertised price for the page that cannot ask a
shop — one copy, named for what it is.

### 14.2 The record, and asking the shop

Migration 0063 is `notes_subscriptions`, **a row of its own rather than a
licence**: `licenses` carries a serial, entitled platforms and an activation
count, none of which mean anything for a phone, while a store subscription
carries a period end, an auto-renew flag and a shop's own transaction id, none
of which a licence has — the fields differ, so they are two records (addendum
12 §2) — and a licence is `not null unique` on an `orders` row, which a store
purchase does not have and must not be given a fake one of. **One row per
person**, because two would be two answers to *is this account paid up*.
`store` and `state` are **text rather than enums** (0060's reason, which cost a
documented route a 400), it **cascades from the account** (0062's distinction:
an entitlement goes with it), and it has a read policy and **no write policy at
all** — `room_ai_usage`'s rule (addendum 07 stage 13) pointed at an
entitlement, which a client may not write or it is not one.

`notes-store.ts` asks Apple and Google. **The client sends an identifier and
never a state**: what the phone posts is the shop's own receipt handle —
Apple's original transaction id, Google's purchase token — and the server asks
the shop. There is no field anywhere in the request for a period end, an
auto-renew flag or the word *active*, which is **the shape being the
permission** a fourth time (addendum 07 §12, addendum 16 §10, addendum 26
§14a). **Not configured is said, never assumed**: a deployment without the
store credentials refuses and says why rather than trusting the phone because
the server has no way to check — the one failure that would quietly make a paid
app free. **No credential is in this repository**; both shops' keys are
environment variables (`APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_ID`,
`APPLE_IAP_PRIVATE_KEY`, `GOOGLE_PLAY_SERVICE_ACCOUNT`), named in one file and
nowhere else, exactly as `eas.json`'s `submit` block is deliberately empty.
Apple is asked in **production first and sandbox only on a 404**, which is
Apple's own advice and the only way one deployment serves both; which answered
is recorded, a test purchase not being a sale.

**One route for a purchase, a restore and a renewal**, because they are one
act: `POST /api/notes/purchase` takes a receipt identifier and goes to the
shop. Three routes would be three answers to *what is this account entitled
to*. And on the client, **a transaction is finished only after the server has
written it down** — both shops replay an unfinished transaction, which is
exactly the behaviour wanted: if the verification call never reaches
vc-writer.com the purchase comes back next time the app opens. Finishing first
and failing to record would take somebody's money and leave them unsubscribed.

There are **no store-to-server notifications yet** (§14.4), so a renewal
reaches the row through `worthReVerifying`: **ask only where the row says it
has run out and has not been checked since it did**. A paid-up subscription is
never re-verified, so the ordinary case costs no network at all and a renewal
costs exactly one question the first time anybody looks.

### 14.3 One gate, in one place

`requireNotesCapture` is what every door the phone pushes through asks — §2's
argument about `currentUser` applied to *may they* as well as *who is calling*.
It decides **sending, and nothing else**: reading notes back, correcting one
that is still waiting, deleting one, listing the projects and everything the
desk does with notes it already has never ask it.

That forced the one change with teeth: **the browser capture screen now goes
through the route**. It wrote its own rows from the day it was built, which was
fine while the two doors agreed and stopped being fine the moment one grew a
gate — *a subscription enforced on `/api/notes` and bypassed by the page an
inch away is not a subscription*. So the browser is a client of its own route,
`uploadToRow` writes the row in one place, and the gate covers both. It drops
`requested_routing` from the send, which is the correction that comes with it:
*where a note goes* is chosen at the desk (§1), the picker that set it here
went in stage 2, and the route has deliberately never had a field for it.

A refusal is **kept rather than thrown away** — the notes stay in the device's
own storage with the reason on them, so fixing the subscription and pressing
Sync again sends the lot. The sentence is said **once at the top** rather than
nine times on nine notes: it is one fact about the account.

### 14.4 The screens

`/notes` is the referral page, in the `(site)` group with the header and the
footer. The nav has linked *Notes* since the app was built and dropped a
visitor into a chrome-less screen with no way back; it is a page **about** the
app now, and the app is at `/notes/app`, where the manifest, the service worker
and every home-screen copy point. **A store link that does not exist is absent
rather than dead**: the badges appear when `NEXT_PUBLIC_APP_STORE_URL` and
`NEXT_PUBLIC_PLAY_STORE_URL` are set, and until then the page says so — a link
to a store page that 404s is worse than a sentence. Which button is filled is
read from the same fact: until the app has shipped, opening it in a browser is
the only thing a reader can act on, and a page whose every button is outlined
offers nobody a way in.

The account page carries the subscription in one line — `describeNotesPlan`,
said for everybody including somebody who has never bought it, so the feature
is findable from the account and not only from the app that needs it — and
**the managing is the shop's**, cancelling and changing the card happening in
an Apple or Google account where a button here could only pretend to.

In the app, `Subscribe.tsx` is the screen: the shop's own prices, **the promise
before the price** (what a writer wants to know before paying for a notebook is
what happens to the notebook if they stop paying), and **Restore as a
first-class button**, a reinstall, a new phone and a family-shared subscription
all needing it and an app that sells a subscription and cannot hand one back
being one Apple rejects. It is reached from the projects list and from the
capture screen, one screen with two doors. **Capture is never blocked**: the
note is written to the phone whatever the subscription says, because a notebook
that refuses a thought loses it — what is said is that it is waiting rather
than gone. And **not asked is never a refusal**: offline, which is the case
this whole app is arranged around, the plan cannot be read, so a paywall drawn
on a failed fetch would lock a paying writer out on a train.

### 14.5 What is honestly not done

**The purchase itself has never been run.** The app has never run on a device
(§9), no store products exist yet, and in-app purchase cannot be exercised from
this container at all — it needs a real device, a signed build and live store
products. What is proved is everything either side of it: the reading and both
shops' vocabularies under the domain suite, the gate on the routes, the referral
page driven in a browser, and the app's screens typechecking against
`expo-iap`'s own types.

Named rather than half-built: **App Store Server Notifications V2 and Play
RTDN**, which would keep the row fresh without anybody opening the app —
`worthReVerifying` is what stands in for them and is bounded by design;
**promotional and introductory offers**; **family sharing**, which arrives as
an ordinary purchase and needs nothing, but has not been thought through;
and **a grace of any kind on this side** — the grace here is the shops' own,
read and honoured rather than invented.

Ken's own next steps, which nobody else can take: create the two subscription
products (`com.vcwriter.notes.yearly`, `com.vcwriter.notes.monthly`) in App
Store Connect and Play Console at $49.99 and $4.99, generate an App Store
Server API key and a Play service account, and set the four environment
variables plus the two store URLs in Vercel. **No key belongs in this
repository and none will be asked for in a message.**

---

## 15. Four things between here and a submission

From Ken, after the phone-to-desk sync turned out to be built already: *so
really what's next is to get the app up and running, in the App Store*. An
audit of what a submission actually meets found four, and the half worth
keeping is that **two of them were about the gap between a feature being right
and a reviewer being able to see it** — which is this project's own commonest
finding, arriving at a store console for the first time.

### 15.1 The terms, on the screen where the agreement is made

Apple's guideline **3.1.2** asks a purchase screen to carry the subscription's
title, its length, its price, **and functional links to the terms of use and
the privacy policy**. `Subscribe.tsx` had four of the five and was going to be
refused for the fifth — and the page the link would point at **did not exist**:
there was a privacy policy and no terms, which is the plainer half of this.

The guideline asks for the right thing, which is why it is worth more than
compliance here. **This is where the agreement is made**, and a term somebody
meets after paying is one they did not agree to; the account page is one screen
too late and a help page is not a screen at all. They are **links rather than
text repeated on the phone**, which is `Account`'s own stated reason for the
privacy link it already had — a second copy would be the older one, and nothing
on the screen would say which — and they open in the phone's own browser, so a
reader who stops to read one comes back to an app that never went anywhere.

Writing them found the copy that reason is about: **`site()` was written out
twice**, in `host/api.ts` and again in `Account`, and a third was one keystroke
away. It is exported from `host/api` now, which is already *the site, from the
app*; a `site.ts` beside it would have been a second answer to where that is.

`/terms` itself is written the way the privacy policy is and for the same
reason: **every clause is checkable against the code**. What a licence covers,
what a lapse reaches, what happens to notes already sent, who may read work in
somebody else's room — each is a rule the program already enforces and a test
already pins, so the page describes a mechanism rather than undertaking
something a person has to remember. Three of its sentences are therefore
**read rather than typed** — `DESKTOP_LAPSE_PROMISE`, `NOTES_PROMISE` and
`NOTES_PRICE_WORDS` — because a terms page is the worst place in the product
for a sentence that has stopped being true. And what it **does not** name is
the same rule from the other end: the desktop price is Stripe's and appears
nowhere in this repository, and how many computers a licence covers is stored
on the licence, so both are pointed at rather than quoted.

One clause is **deliberately absent and named rather than invented**: a
governing-law line, which needs the legal entity and the jurisdiction Ken is
operating from. Guessing one would be worse than having none.

`store-requirements.test.ts` pins both halves by **reading the source**, which
is the idiom addendum 31 §4 and addendum 32 §9 use wherever a thing cannot be
exercised — the screens are React Native and need a simulator, and both of
these fail by being *absent*, which looks exactly like nobody having added them
yet.

### 15.2 iPhone only, said rather than defaulted

`ios.supportsTablet` was `true`, which is Expo's default and not a decision.
It costs a real thing: Apple then expects **iPad screenshots**, and an iPad
build nobody has laid out, tested or looked at is how an app is rejected for a
screen that was never opened. This is a voice notebook used on a walk with the
phone in a pocket; it is `false`, which costs nothing and can be turned on the
day there is an iPad layout worth shipping. (An iPhone app still installs and
runs on an iPad, scaled.)

### 15.3 The feature graphic, as a board rather than a cutter

Google Play requires a **1024 × 500 feature graphic** and there was none. It is
**an entry in `brand/artboards.html`**, not a new script — the same argument
§11 made about the launcher icons, since `render.mjs` already screenshots every
board at its exact pixel size. Three things about it are the format's rather
than anybody's taste. It says **NOTES** with the product's name small above it,
this being a listing for VC Writer Notes and not for VC Writer — which is also
how the app brands itself, every screen of it being headed NOTES. **The mark
sits left of centre**, because Play draws a play button over the middle
wherever a promo video is set, and whether one is set is a decision in a
console rather than in this file; it happens to be the 1500 × 500 banner's own
composition, which is the point. And **the words are the listing's** — *Dictate
ideas while you walk* is the App Store subtitle verbatim, for `store-listing.md`'s
own reason that a listing typed twice is two listings.

Rendered, measured and looked at: a 24-bit PNG with **no alpha channel**, which
is the format Play asks for, and legible scaled to the 383px a collection draws
it at — which is the only honest test, and the one `icons.mjs` makes for itself.

### 15.4 The reviewer should meet the paywall, not be routed round it

The fourth item was offered as *arrange the demo account so the reviewer never
meets the paywall*, and **reading the gate corrected it**. Two things it got
wrong.

`requireNotesCapture` is narrower than it sounds: it gates **sending** a note
and **creating** a project, and `/api/notes/projects` says in its own comment
that *listing them is not* — a lapsed subscriber still sees their projects,
because the list is the account's rather than the app's. So an unsubscribed
reviewer is not locked out of anything but the one act the subscription is for.

And the goal was backwards. **A reviewer who cannot find the in-app purchase
cannot verify it**, and *we were unable to locate the in-app purchase* is
itself a rejection. What they need is a paywall that **works**, which it does,
in Apple's sandbox, with their own sandbox Apple ID — so the demo account stays
**unsubscribed on purpose** and the review notes say where the purchase screen
is and what completing it does.

The real need is one layer along, and it is the twelve closed testers §2.2 of
`store-setup.md` describes: they cannot send a note without getting past the
subscription, and a tester who meets a paywall they cannot pass is one who
stops opening the app on day two of fourteen. **Both shops already solve this**
— Apple's Sandbox test accounts and Play's **License testing** list — and
nothing in this repository changes for it, which is the part worth writing
down, because the tempting alternative is to write free subscription rows onto
those accounts by hand. It should not be done: `notes_subscriptions` has a read
policy and **no write policy at all**, `room_ai_usage`'s own shape, and every
row in it is something a shop confirmed; a comped row would be a second way to
be entitled that no receipt stands behind, carried forever, and would have to
be undone by hand on twelve accounts afterwards. `store-setup.md` §2.2a is the
arrangement, and it is two lists in two consoles.

### 15.5 What is honestly not done

**The purchase screen has not been looked at.** The app has never run on a
device (§9) and React Native cannot be rendered in this container, which is
`vitest.config.ts`'s own standing argument — so what is proved about the two
links is that they are there, that they are built from the one site address
rather than a typed URL, and that the app typechecks. **The screenshots still
cannot be made here and must not be faked**, which leaves them and the store
accounts as the submission's only remaining work that is nobody else's.

## 16. Erasing, and a note's title and body, out loud

From Ken, after his first hands-free walk on the iPhone:

> I tried to erase all because my title was wrong. There needs to be a way to
> reset. Maybe we can say command erase all… And we can have it on the
> screen, a little instruction thing. … There's also no way to switch from
> the title or the character to the actual body… every time you say erase
> word, it'll erase the next word.

**The command word.** Either *command* or *dictate* begins a command
(`WAKE_WORDS`). *Dictate* was addendum 09 §10's word and still works;
*command* is the one Ken reached for, and the one the screens teach.

**The new commands** (`readTurn`, `hear`):

| Say | It does |
| --- | --- |
| *command erase word* | takes back the last word |
| *command erase three words* | takes back three (a number said or written, up to ten) |
| *command erase all* | empties the open note and starts it again on its title |
| *command next* | what follows is the note's body |
| *command title* | what follows is the note's title again |

Each is spoken back (*Erased “tonight”.*, *Now the note.*), because from a
pocket a command nobody hears is one somebody says again.

**A title, then the body.** A note opened by a kind that takes a name
(character, setting, dialogue, arc) with nothing said after it starts on its
**title**: the next words are the name. *Command next* moves to the body.
- A whole sentence said on the title (more than four words) is the note
  itself. It goes to the body, and the note moves on with it, so addendum 09
  §10's *dictate new setting*, then *the kitchen is too small for the table in
  it* still lands as it always did.
- The part being spoken into (`OpenNote.on`) is the sitting's business, and
  is never filed with the note.

**Several commands in one breath.** A recogniser hands back *command erase
word command erase word* as one string. `splitTurns` cuts it where a command
begins, and each is heard in turn.
- The wake word in the middle of a sentence, with no command after it, stays
  part of the sentence: *I command you to stop* is a line of dialogue.
- Every note closed in the breath is filed, on the phone and on the website
  alike.

**The walk listens a phrase at a time.** In continuous mode an iPhone
confirms nothing until it is stopped, so a command said mid-walk was never
acted on. The walk now listens without `continuous`: it ends at each pause
with that phrase confirmed, and restarts. The typed screen keeps one
continuous sitting.

**Backspace kept writing *erase all*.** The typed box shows the words plus
the recogniser's current guess, and every key pressed wrote both back as the
words, with the guess drawn on the end again.
- Typing now ends the dictation it is typed over, and keeps what is in the
  box once.
- A stop always clears the guess, which the walk's stop used to leave behind
  (the stop fix of build 4).

**On screen.** The hands-free screen says whether the next words go into the
title or the note, and lists the commands in the words to say them.

## 17. Ken's second walk: doubled words, a phone that heard itself, and a Save that never sent

From Ken, on build 5:

> It'll either double the words that you said, or if I erase a word at the
> end, then it'll put that word in the beginning… Save it still doesn't work…
> If I say subsection and give it a title, it reads it back to me immediately
> and then repeats the word again… I said, next. And it added the same, you're
> a loser, next to it. And it didn't move on to the body. And then it shut
> down.

**Save never sent: one note held up every note.**
- The phone sends everything waiting in one batch, and the server refused a
  batch whole if any note in it failed.
- A note with a title and no body (a walk's *subsection*, *you're a loser*)
  failed the `rawText` minimum. From then on every send carried it, every
  send was refused, and nothing reached the database after 29 September.
- The phone also said *it will go when there is signal* whatever the reason
  was.

Now:
- A note may be a title alone. `captureUploadSchema` asks for words **or** a
  title.
- The route reads a batch note by note (`readUploadBatch`): good notes land,
  and each refused one comes back with its reason.
- The phone records that reason against the note, and *Save it* says *Saved
  and sent*, or *not sent yet:* and why.

This is a server change, so the notes already waiting on the phone go out at
its next send, without a new build.

**Every phrase twice.**
- On iOS 18 a phrase arrives as final when the speaker pauses, and again when
  the recogniser stops. Ken's doubled words, and *you're a loser, you're a
  loser*, were both that.
- `startDictation` now drops a final that repeats the last one, and takes only
  the new words from a final that carries the last one and more.
- It trims the leading space the library puts before a following phrase.

**The phone heard itself.**
- The walk answers out loud (*Subsection. Say the title…*) with the
  microphone on, so the answer came back as words in the note.
- The walk now holds the microphone while it speaks and for a moment after
  (`hold`, `speakOnWalk`).

**The walk shut down.**
- Listening a phrase at a time (§16) means each quiet stretch ends a
  recognition. Four of those in a row read as a dead microphone.
- Now only a recognition that ends within 1.2 seconds, having heard nothing,
  counts against the walk, so silence between thoughts never stops it.

**A title for the book's own parts.**
- §16 started only the kinds that take a name on a title. Ken's *subsection*,
  then *you're a loser*, wanted a heading too.
- Characters, settings, dialogue, arcs, and the structural kinds (chapter,
  section, subsection, scene) now start on a title.
- Ideas, themes, plot points and research stay all body, so *idea*, then *she
  drives a lorry*, is still the note.
- On a title, *next* said on its own moves to the body; elsewhere it is a word.

**Not yet reproduced:** *erase a word at the end, and it puts that word at
the beginning*, in the title. The repeat above is the likeliest cause; it is
named here until it is seen gone on a phone.

## 18. Hands-free that asks, and a Save you can see

From Ken, on build 6:

> When I stop the dictation, it doubles the sentence I just put in… Hands-free
> mode doesn't really work very well. It doesn't take a command, and when you
> say command, it just repeats it back to you… and then it crashes… still the
> save button doesn't work. It needs to change color or do something…

And then the design, in his words:

> It can listen and say… is it a section, is it an idea, a theme, or whatever
> category… then if you pause for 3 or 4 seconds… it can let you know by
> saying what is the title… it'll move on by what would you like to put in
> this note and then you dictate it… when you're done, it asks you, are you
> done or would you like to continue? … So the hands-free mode is interactive.

**The walk asks** (`startGuided`, `hearGuided`, `hearPause` in
`capture-session.ts`). Four questions, in his words:

| It asks | You say | Then |
| --- | --- | --- |
| *What kind of note is it?* (the project's own kinds) | *idea*, *subsection*, *character*… or *just a note* | the title |
| *What is the title?* | the title, or *skip* | the body |
| *What would you like to put in this note?* | the note, for as long as you like | at a pause of 3.5 seconds, the next question |
| *Are you done, or would you like to continue?* | *save*, *continue*, *read it back*, *start over*, *throw it away* | *save* files it and asks the kind again |

- Words said at the last question that are none of those answers are the
  writer carrying on, and go into the note.
- A kind said with a short run of words after it takes those words as the
  title.
- No word needs a command in front of it. §16's command words still work at
  any point.
- *Command* said alone, which a pause after it delivers as its own phrase,
  arms the next phrase instead of being refused (`armed`). That refusal was
  Ken's *it just repeats it back to you*.

**Listening for a walk** (`listen.ts`).
- One continuous recognition for the whole walk. §16 restarted the
  recogniser at every pause, and whatever was said in the gap was lost: *it
  missed a bunch of sentences*.
- A phrase is taken when its guess has stopped changing for 1.5 seconds
  (`commitAfterMs`), or when the phone confirms it, whichever comes first.
- Listening is **stopped outright while the phone speaks** (`pause`, by
  abort, and `resume`), not merely ignored. A recogniser running under the
  phone's own speech is the likeliest cause of the crash, and the phone heard
  its own questions.

**The repeat, compared by words.** §17 compared the repeated phrase exactly,
and iOS 18 sends it back with different capitals and punctuation (*this is
an Amber Alert* / *This is an Amber Alert.*), so it slipped through.
- Words are compared plain now.
- A repeat is dropped only at the two moments a phone sends one: **at the
  stop**, and **when it confirms a phrase already committed early**. A
  writer who says *erase word* twice means it twice.
- What is handed on keeps the writer's own punctuation; only the comparison
  ignores it.

**Save you can see.**
- The button says *Saving…*, then *✓ Saved and sent* in green, or *Saved on
  this phone — not sent* or *Not saved* in red, with the reason under it.
- A failure to write to the phone itself is caught and said. It used to be
  swallowed, which is *nothing happens*.
- The screen counts the notes waiting on the phone and gives the last
  reason one did not go.

**Not done, and why.** The phone could report its own failures to
vc-writer.com's error log, which would let them be read here without Ken
relaying them. It is not done: the App Store privacy answers say the app
sends no crash reports, and changing that is Ken's call. Everything is said
on the screen instead.

## 19. Why Save never worked: a global the phone does not have

Build 7's new Save button said what no build before it could: *Could not save
on this phone: Property 'crypto' doesn't exist.*

- Every note is given an id on the phone (`newClientCaptureId`), and it was
  made with `crypto?.randomUUID?.()`.
- The `?.` was meant to cover a phone without `crypto`. It guards a missing
  *property*, not a missing *global*, and Hermes, the phone's JavaScript
  engine, has no `crypto` at all. Naming it threw.
- So every Save, on every build, failed before the note reached even the
  phone's own queue. Until build 7 the screen said nothing about it, and
  nothing was ever sent.

Now:
- The id comes from `expo-crypto`, which is native and always present.
- The fallback reads through `globalThis`, so naming it cannot throw.
- `ids.test.ts` checks the generator with and without the module, and that
  no file in the app names a bare `crypto` again.

§17's server change (a batch read note by note) and this one were both
needed. Either alone would still have lost every note.

Also, from Ken: the hands-free button reads **Stop the note**, not *Stop the
walk*, and the screen says *saved so far* and *notes saved*.


## 20. Short form's segments, and a kind question you can answer

From Ken, on build 8 (Save working at last): *under the notes for short form,
it will be just segments or ideas. And when you do a segment, it first asks you
with the audio and then the visual. If it's an idea, it's just a general note.
… It just needs to say what kind of note is it? … it takes too long to read
off all of them. … it doesn't recognize what type very easily. And when I say
it's a scene, it then re-asks me what type of note is it.*

- **Short form's vocabulary is Segment and Idea** (`captureVocabulary`). The
  segment is the unit key (`unit`), named as addendum 05 names a scene there;
  *segment* and *scene* both open one. Other formats are unchanged.
- **A segment is asked audio, then visual.** After its title the walk asks
  *What is the audio?*; a pause asks *What is the visual?*; a pause after that
  asks whether you are done. *Continue* carries on with the visual, *skip*
  leaves either half empty, and *read it back* reads both. The open note holds
  the two halves (`OpenNote.av`, `text` for the audio, `visual`), and filing
  folds them into one labelled text — `Audio: …` and `Visual: …` on their own
  lines — so the upload, the server and the desk need nothing new.
- **A kind with no title asks none.** An idea goes straight to *What would you
  like to put in this note?*; `hasTitle` already said so for the command walk
  (§16) and the guided walk now follows it. Named kinds and the structural
  parts still ask the title.
- **The kind question is the question only**: *What kind of note is it?* The
  kinds stay on screen in text, where they can be read at a glance.
- **The kind is heard the way people answer.** *It's a scene*, *a new scene*,
  *scene please*, *scene note*, *let's do a scene* and the recogniser's
  *seen* all open a scene: lead words come off, a half-heard opening word is
  mended, and a kind anywhere in an answer of four words or fewer counts. Lead
  words that arrive alone (*it's a*, committed early before *scene*) are
  waited through in silence rather than answered with the question again,
  which is what made the walk re-ask. A kind the project lacks says so —
  *There are no scenes in this project* — instead of *I didn't catch a kind*.

## 21. The keyboard's own dictation, written once

From Ken, on build 9: *when I use the dictate on the phone, as opposed to the
dictate button, and I am in the short form, and I say, or speak in a title,
then when I stop the dictation, it repeats it still. The hands-free works very
well now.*

That is iOS's keyboard microphone, not the app's Dictate. It writes into the
focused box and, when it stops, replaces what it wrote with its final text. The
boxes were controlled — the app handed `value` back on every change — and the
value arriving in the middle of that replacement put the words in a second
time.

- **The boxes keep their own text.** The Capture title and note boxes, the
  Review edit box and the new-project title take a `defaultValue`, and what
  is typed or dictated by the keyboard only updates the app's copy.
- **Only a change the app makes redraws a box**, by a new `key`: our own
  Dictate (its words and its grey guess), a spoken correction, *put the old
  wording back*, and Save clearing the boxes.
- The title box capitalises a name as a script prints it (MARA) and anything
  else — a segment's title — word by word.
- `dictation-boxes.test.ts` holds the three screens to it.

## 22. Dictating a title, and a keyboard that goes away

From Ken: *when I use the dictate button, I'm trying to put a title. It jumps
down to the body portion. Also, when I hit dictate, I don't want the keyboard to
be up… Maybe it can have a tab on the bottom if you want to bring it up that
says keyboard, but it should be collapsible because it gets in the way.*

- **Dictate writes into a chosen box.** *Dictate into: Title | Note* sits
  above the Dictate button (*Who* in place of *Title* for a kind that names
  somebody), and touching either box chooses it too. The box being written
  into is outlined while the phone listens, and its grey guess shows there.
- **A title heard moves on to the note**, as the hands-free walk does: the
  phrase (its full stop dropped) is the title, and the next goes to the body.
  Pressing *Title* again adds to it.
- **Dictate puts the keyboard away.** A *⌨ Keyboard* tab at the foot of the
  screen brings it back on the chosen box; while it is up, a *⌄ Hide
  keyboard* bar sits on it (on the iPhone an input accessory, fixed to the
  keyboard; on Android at the foot of the screen).
- Typing in either box ends a dictation in progress, as typing in the note did.

## 23. One story or a collection, and the story a note goes into

From Ken: *under short stories and collections, I want an additional screen
that asks you, is this a single story or a collection? If you hit collection,
it gives the ability to enter multiple story names into a list… and then you
can add to that list. So when you're on the note screen, there'll be a
dropdown that allows you to pick the short story that it's going to go into.*

- **New project, Short stories and collections**: *Start it* reads *Next*, and
  the next screen asks *Is this a single story or a collection?* **Single
  story** makes the project with one story named for it. **Collection** opens
  a list of story names, *+ Another story* adding a row, and *Start it with N
  stories*.
- **The stories are the desk's own.** `POST /api/notes/projects` takes
  `stories`, and `withStories` (addendum 22 §11) puts the first on the
  opening section and starts each later one on a section of its own at the
  end — a story is a marker over its sections, exactly as *+ New story* makes
  one on the desktop.
- **The note screen has a Story dropdown** on a collection: the stories in
  order, read from `GET /api/notes/projects/:id/stories`, and a box at its
  foot that adds one at the end (`POST` the same route, which writes only the
  rows that are new). The choice is remembered per project on the phone, and
  the hands-free bar names the story its notes are going into.
- **The note carries the story**: `storyId` on the upload, the queue's
  `story_id` column (added to a phone's existing queue on open), and
  `capture_items.story_marker_id` (migration 0071, no foreign key, for 0061's
  reason). The desktop inbox shows the story's name on the note.

## 24. The keyboard is down until it is asked for

From Ken, on build 11: *it's made mainly to dictate into, but whenever you put a
cursor in the About or the Title section… I want to be able to get to the button
to dictate. Otherwise, I have to use the dictation on the keyboard. So I want the
keyboard by default to be collapsed unless you click the bottom keyboard tab…
And I would actually like to change the name from About to Title.*

- **Touching a box does not raise the keyboard.** It puts the cursor there and
  chooses the box Dictate writes into (§22); the boxes take
  `showSoftInputOnFocus` from a `typing` flag that is off by default.
- **The ⌨ Keyboard tab** turns it on and refocuses the chosen box, so the
  keyboard comes up there. *Hide keyboard*, Dictate, and the keyboard going
  away for any reason turn it off again.
- **The first box is called Title**, whatever the kind (it was *About*, or
  *Who* for a kind that names somebody; the *MARA* placeholder still shows a
  name is wanted there). The *Dictate into* choice reads *Title | Note*.

## 25. The phone's notes by hand, the archive, and deleting

From Ken: *in the research section under the mobile app, it will show you the
notes available on the phone, because if the projects don't match perfectly,
it's not going to really work automatically transferring. So you'll be able to
see which note groups are on the phone. You can select the project and it will
sync and transfer those. Once they're transferred, those notes need to go into
an archive. And on the app itself, once the notes are transferred and
verified, that it'll give you the option to delete those notes. And you can
also delete it from the actual desktop app.*

A note is sent under the phone's project, and the desk's inbox lists the open
project's own (and those with none). A project kept on this computer only, or
a copy with another id, never met its notes.

- **Research ▸ Mobile App has three tabs.** *This project* is the inbox as it
  was. **On the phone** lists every note still waiting that the inbox does not
  show, grouped by the phone project it was said in (`phoneNoteGroups`), each
  group opening to its notes and carrying **Transfer to this project**.
  **Archive** lists what has been filed or set aside (`ARCHIVED_STATUSES`).
- **Transfer** is `transferNotes`: each note filed by its suggestion — the
  folder for its kind, the person it names — and one with none into a *From
  the phone* folder made the first time it is needed. Each is then marked
  filed on the server, which is what moves it to the archive.
- **Deleting.** The archive deletes a note, or all of them, after asking. The
  phone's Review marks a filed note *✓ Transferred to VC Writer* and offers
  **Delete transferred notes**, which deletes them from the account. What the
  notes became in the project stays either way.
- **Routes.** The desktop reads Supabase directly (`listPhoneNotes`,
  `listArchivedNotes`, `deleteCaptures` in `cloud.ts`); the browser preview and
  the phone use `/api/notes/inbox` — `?all=1`, `?archive=1`, and `DELETE`
  with `ids`.
- **Migration 0072** lets the writer delete their own note whatever its status;
  0042's refusal to *change* a filed note stands.

## 26. Two halves, a keyboard that never comes by itself, and dictation written once

From Ken, on build 12: *the keyboard should never come up… it should never be
accessible unless you hit the keyboard tab… the note shouldn't elongate. It
should have a scroll bar… the save disappears off the bottom of the page… if
you use the dictate function off of the keyboard, it doubles the words again…
seems only happened in the title… another major change I want is to be able to
have a landscape view… the screen will be divided into the upper half with the
note and all that information and the lower half, which is basically the
controls, and so if you turn it sideways, one is on one half, one's on the
other.*

- **The note screen is two halves.** The note — its kind (and story) as a
  heading, the title box and the note box — takes the top half; the controls
  — Save, Dictate into, Dictate and Read it back, Hands free, the Story, the
  kinds — take the bottom half in a scrolling column of their own. Turned on
  its side (`useWindowDimensions`, wider than tall) the note is the left half
  and the controls the right. `app.json`'s orientation is `default` now.
- **The note box keeps its size and scrolls** instead of growing, so Save is
  always on the screen.
- **The keyboard comes only from its tab.** The boxes are `editable` only
  while the Keyboard tab has asked for it; until then a touch takes no focus
  and only chooses the box Dictate writes into (`onPressIn`), and the chosen
  box is outlined. `showSoftInputOnFocus` (§24) was not enough on the iPhone.
- **Why the keyboard's dictation still doubled (§21 was half the answer).**
  React Native hands a box's `defaultValue` to the native view whenever it
  changes, exactly as it does a `value`, and the boxes' `defaultValue`
  followed the words as they were typed. Each box now starts from a *seed*
  worked out only when it is drawn again (its `key` changes: our own
  dictation, a correction, Save clearing it) — in Capture, Review, the new
  project's title and story names. `dictation-boxes.test.ts` holds every box
  to a seed.

## 27. Resetting a note

From Ken: *we need a way to cancel the note. Maybe a little button on top.
Because if you start writing a note and you have to go all the way back out to
the project screen and go back in.*

**↺ Reset** (Ken: *it can be like a reset button*) sits at the top of the note,
beside its heading. It stops a
dictation without keeping what it was hearing (`typedOver`, so the last words
are not committed), empties the title and the note, and points Dictate back at
the note; the kind and the story stay, as they do after a save. With anything
written it asks first (*Keep writing* / *Reset*); with nothing, it just
clears.

## 28. Title first, a keyboard tab in the corner, and smaller kinds

From Ken, on build 14: *the default is note. So I'd like to just be able to
hit the dictate button and it defaults to where it's set to title first… The
keyboard obscures one of the titles when you rotate it in landscape mode… just
put a small tab in the right or left corner that says keyboard… like a folder
tab… you can take out "this is a" or move the section, subsection, ideas,
those things up or make them smaller.*

- **Dictate starts on the title.** A new note, a saved one and a reset one all
  point *Dictate into* at **Title**; a title heard moves it on to the note
  (§22), so Dictate, title, pause, the note is the whole of it.
- **The keyboard's tab is a folder tab** in the bottom-right corner, not a bar
  across the screen: *⌨ Keyboard* while it is down, *⌄ Hide* on it while it is
  up. The controls leave room at their foot so it covers nothing.
- **The kinds come first in the controls, smaller and unlabelled**: *This is
  a* is gone, the buttons are smaller, and they sit at the top of the controls
  where a turned phone shows them.

## 29. The archive in folders, and clearing the phone

From Ken, on build 15: *when you transfer the notes off the phone and it goes
into the archive, put it in a single folder… by date and by title of that
project… and then you can delete it by the folder if you need to. In the notes
app, I attempted to delete the ones that were transferred. And nothing
happened. It should clear all transferred notes. And since they'll be in the
archive, there's a backup.*

- **Why nothing happened.** The phone's delete went to a rule the database had
  not been given yet (migration 0072 was written but not applied), and a
  refused delete under row-level security matches no rows rather than
  failing. 0072 is applied now, as an `alter policy` rather than a drop.
- **Clearing, not deleting.** *Clear transferred notes* on the phone stamps
  `cleared_from_phone_at` (`POST /api/notes/cleared`, written with the service
  key for the caller's own filed notes, since 0042 keeps filed notes from being
  changed) and the phone's list leaves those out. The notes stay on the
  account, in the desk's archive: that is the backup.
- **The archive in folders.** A note filed at the desk records the project it
  went into (`filed_into`, set by `approveCapture`); `archiveFolders` groups
  the archive by the day it was filed and that project — *Oct 28, 2026 —
  Blackout* — with *Set aside* for discarded notes and *Earlier* for notes
  filed before the project was recorded. A folder opens to its notes, and
  **Delete folder** deletes the lot after asking; a note can still be deleted
  on its own.

## 30. A note full screen: read it back, then add on

From Ken, on build 16: *in the review section, you can select a note and it
brings it up full screen. And you can then add to the note or read it back. Or
actually read it back, and then it'll ask you, would you like to add on to
this note? And it'll add, continue on where you were at.*

- **Review opens a note full screen** (`NoteView`): its title as a heading, its
  words large, and *Open ›* under each note in the list.
- **🔊 Read it back** reads the note (`sayBack`), then — on a note still
  waiting — asks *Would you like to add on to this note?* and listens.
  `addOnAnswer` hears yes (*yes*, *sure*, *keep going*…) and no (*no*, *that's
  it*, *done*…); yes goes on listening, and what follows is added to the end;
  no stops; anything else is taken as the writer already adding, and is
  added. *■ Stop* ends either.
- **🎙 Add to it** skips the question and listens straight away.
- **Save** writes the note (`PATCH /api/notes/:id`); leaving with words unsaved
  asks *Save* or *Discard*. A note the desk has filed is read back and not
  added to — it is changed there (§7, `mayStillEdit`).
