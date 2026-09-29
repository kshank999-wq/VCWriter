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
conversation with both stores; notifications; and the app's own icon and
splash, which are a designer's job rather than a placeholder's.
