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
