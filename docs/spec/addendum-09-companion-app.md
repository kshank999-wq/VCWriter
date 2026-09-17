# Addendum 09 — The Companion App

Status: **all six stages built**, and §8 besides — dictation at the desk, which
is spec §9's first bullet rather than this app's, built here because it shares
the reading. September 2026. From Ken's *VC Writer
Companion App — Simplified Development Specification v1.0*, written as a
coding/quoting handoff. Extends spec §9 and §11 (capture and sync), and the
Mobile App area it asks for is a new part of the desktop.

His own first line is the constraint the rest has to serve: **this companion app
must remain intentionally simple.** Everything below is written to make that
survive contact with the codebase, because the pressure will all run the other
way — VC Writer already has a research tree, a character module, arcs and a
Writers Room, and every one of them will look like it *nearly* fits on a phone.

## 1. The decision that shapes everything

**The phone captures; the desktop places.**

§12 says it plainly — *automatic placement of mobile notes into the desktop
manuscript* is out of scope, and placement happens from the desktop inbox by
drag-and-drop. That is not a limitation to be lifted later. It is the thing that
lets the phone stay a voice notebook: if the app never decides where a thought
goes, it needs no folder tree, no character list, no scene picker and no
taxonomy — and §12's nine exclusions all follow from it rather than having to be
defended one at a time.

The product already holds this line. Spec §9's rule is that a classification is
*a proposal until a person confirms it*, and `capture-approval.ts` was built on
it. §1 here is the same rule, stated from the phone's end.

## 2. The second decision: a category is not a destination

This is the one place the new spec and the built code use the same word for two
different things, and getting it wrong would quietly undo §1.

| | What it answers | Who says it | Where |
| --- | --- | --- | --- |
| **Category** (new) | *What kind of thought is this?* | The writer, out loud, on the phone | `capture_items.category` |
| **Destination** (built) | *Where in the project does it go?* | The writer, on the desktop | `requested_routing`, then the drag |

§4's five — Character, Plot Point, Idea, Theme, Arc — are **kinds of thought**.
They are not folders, they are not research categories, and two of them
(Character, Arc) name parts of the program that a note is emphatically *not*
being filed into. Modelling them as destinations would put a folder picker back
on the phone within a week.

So `category` is a new column with exactly five values, and the existing
`requested_routing` keeps meaning what it means. The new capture flow does not
write it; old rows keep theirs.

## 3. What already exists

More than the spec assumes. Naming it decides how much of this is new work.

| What §§5–11 ask for | What exists today | Where |
| --- | --- | --- |
| A capture row with project, text, timestamps | `capture_items`, eight of the ten §10 fields | migration 0003 |
| Idempotent sync, no duplicate on retry | `client_capture_id`, unique per user | 0003 |
| Offline queue that survives restart | IndexedDB, written *before* the send | `capture-queue.ts` |
| Sync status and retry | `syncedAt` / `lastError` on the queued row | `capture-queue.ts` |
| Project list for the signed-in user | Project picker on `/notes` | `capture-app.tsx` |
| Dictation | Web Speech API, with its limits already written down | `dictation.ts` |
| A desktop inbox that does not auto-place | an approval queue, approve / defer / reject | `CapturesPanel.tsx`, retired in stage 1 |
| The destination chosen by a person | `requested_routing`, which **outranks** inference | 0006 |

What is genuinely missing is smaller than it looks, and it is almost all
*interaction* rather than plumbing: the spoken category command, the read-back,
the correction loop, a review-by-category screen on the phone, and — on the
desktop — the named **Mobile App** area with drag-and-drop.

### 3.1 Two fields the data model is short

§10 names ten fields. `capture_items` has eight of them under other names.
The two it does not have:

- **`category`** — §2 above. Five values.
- **`subject_name`** — §9's *character notes should retain the spoken character
  name*. Today the classifier's guess at an entity name lives inside
  `inference`, which is the wrong place for something a person said out loud;
  `inference` is a guess and this is testimony. Its own column, nullable,
  also serving §10's *optional short label*.

`sync_status` stays on the device. The server has `status`, which is the
**approval** axis (pending / needs_review / approved / rejected) and answers a
different question; a second enum next to it called `sync_status` would be read
as the same thing within a month. What the phone needs — local, queued,
syncing, synced, failed — is a fact about the device's own queue, and
`capture-queue.ts` already keeps it there.

### 3.2 Arc, and the thing not to build yet

`Arc` as a capture category is new, and the Character Creator now has real arc
points (addendum 08 §9). The obvious next thought is to have an Arc note become
an arc point on approval.

**Not in this version.** §1 says the desktop places, and an arc point belongs to
a character's arc — which means picking a person and a kind of point, which is
the Character Creator, which is §12's *complex character creator* arriving
through the back door. The Mobile App inbox drags a note into the Creator like
anything else; the note is the note.

## 4. The desktop Mobile App area

§9 asks for a dedicated area named **Mobile App** where synced notes for the
active project appear, opened as a dialog, with drag-and-drop into place.

`CapturesPanel` was most of this already, but in neither the right place nor
the right shape: it sat behind a **Captures** page in the page bar rather than
being opened by name, and its verbs were *approve / defer / reject* with a
destination dropdown rather than a drag. Stage 1 retired it.

The change is to make the drag the primary act and keep the dropdown as the
second way, because **a drag needs somewhere to drop and a keyboard needs a
list**. The existing approval functions do not change; a drop calls
`approveCapture` with the destination the drop target names.

What a note can be dropped on, in this version:

- a research folder in the Research window;
- somebody in the cast;
- a scene or a beat, which files the note against it.

Each of those is a destination `approveCapture` already understands.

## 5. The decision: what the app is built as

**Decided: the web app, grown.** Ken chose it when stage 4 came up, and stage 4
is built on it. What follows is the reasoning that was on the table, kept
because it is also the list of what an iPhone user gets less of.

This was the one thing the code could not answer, and it changed the shape of
the work rather than the amount.

`dictation.ts` already carries the finding, written before this spec existed:
the Web Speech API is *a real capability on Android Chrome and a limited one on
iOS Safari*, where the system keyboard's own dictation is the better path. §5
and §6 want continuous listening, a spoken command that switches the screen, and
text-to-speech read-back. On iOS, in a browser, two of those three are unreliable
and the third needs a user gesture per utterance.

So:

- **A native app** (or React Native / Expo) does everything §§5–6 describe, and
  costs an App Store presence, two build pipelines and a release process the
  product does not have yet.
- **The web app, grown** reaches Android properly and iOS partially, ships
  today, and would have to tell an iPhone user to use the keyboard's dictation
  button — which is a worse product than the spec describes, honestly labelled.

The stages below were written so that **everything before stage 4 is the same
either way**: the data model, the sync contract and the desktop inbox do not
know what the phone is written in. That held — stage 4 changed nothing before
it, and a native app later would inherit the whole of stages 0–3 and 5 as they
stand, plus `capture-voice.ts`, which is where the rules went precisely so they
would not be trapped in a React component.

What the choice costs is named on the screen rather than hidden: where the
browser has no recogniser, the Dictate button is disabled and the line beneath
it says to use the keyboard's microphone key. The note is typed instead, and
everything else about it — the category, the name, the queue, the review — is
identical.

## 6. Build order

0. ✅ **The two fields** — migration 0041 (`category`, `subject_name`), the
   domain schema, the round trip. Nothing visible.
1. ✅ **The desktop Mobile App area** — see §7.
2. ✅ **The upload contract** — see §7.
3. ✅ **Review on the phone** — see §7.
4. ✅ **Voice capture** — see §7.
5. ✅ **Project page** — see §7.

**All six stages are built.** §13's acceptance criteria are met. §8 is the
desk's own dictation, which the phone's stage 4 made possible but which belongs
to spec §9 rather than to this app.

## 7. What each stage built

### Stage 0 — the two fields

Migration 0041, `captureCategorySchema` in `entities/capture.ts`, and the two
lines in `captureFromRow`. Both columns are nullable and the tests say why: a
capture taken before the companion app existed has neither, and a note where
nobody named a category is an ordinary note rather than a broken row.

The test that matters is the one asserting `category` and `requestedRouting`
may **disagree** — a Character note filed into Ideas — because that is §2 made
into something that fails if anybody later collapses the two.

### Stage 1 — the Mobile App area

`inboxGroups` and `spokenSuggestion` in `capture-approval.ts`,
`MobileInbox.tsx`, and the drops in `ResearchWindow.tsx`.

**It lives inside the Research window, and that is the whole reason the drag
works.** The folders and the cast are already down the left there, so *drag the
note where it belongs* has somewhere real to land. A dialog over the top would
have had to grow its own list of destinations, which is a menu pretending to be
a drag.

**A note dropped on somebody already in the cast becomes a note about them** —
`about_character`, a research note in the Characters folder linked to that
person — and **never a second character of the same name**, which is the one
outcome worse than doing nothing. It does not become a characterization item
either: whether a thought about somebody *is* characterization is the Character
Creator's question and the writer's to answer (§3.2).

**The spoken category ranks between the two things that already existed**: below
a destination the writer actually chose, above anything a classifier guessed,
because it is testimony. It buys an opening proposal — *You said Plot Point*,
*You said Character — MARA, who is already in the cast* — and never a placement.

One thing was retired rather than built: the **Captures** page in the page bar
is gone, and `CapturesPanel` with it. Two inboxes onto one queue is a bug
waiting to happen, and that page could not do the drag because the destinations
were not on screen. Its slot now shows the account panel, which a signed-in
writer previously could not reach at all.

Driven in the real interface: six notes group under Character, Plot Point,
Theme, Arc and *No category*; the count sits beside **Mobile App** before
anybody opens it; and dragging one onto **Props** or onto **MARA** files it
there. Looking at it caught a defect the tests had not — a note with no spoken
name printed its own first line as a heading and then again as the body.

### Stage 2 — the upload contract

`capture-upload.ts` in the domain, and `POST /api/notes`.

**The shape is the permission.** A capture row carries fields that belong to the
desktop — `status`, `inference`, what the note was turned into — and the phone
has no business setting any of them. Rather than checking that on the way in,
the payload simply has nowhere to put them: a client that tried has no field to
try with, and `uploadToRow` writes `status: 'pending'` itself. That is the same
trick addendum 07 §12 used for the room's AI, for the same reason — a rule
enforced by the shape of the data cannot be forgotten by the next person to
touch the endpoint.

The route is deliberately thin, and the web capture page still writes to the
database directly. It exists because §14 asks for one, and because a companion
app built by somebody else should not need this project's row-level-security
rules in its head to send a note. **One** definition of the payload, in the
domain, used by both.

Idempotence needed nothing new: `client_capture_id` has been unique per user
since migration 0003, so a retried Sync upserts the same row. The response
returns the ids that landed, so a client marks exactly those synced rather than
assuming the whole batch went through.

The capture screen changed with it: the **destination** picker is gone and a
**category** picker stands where it was, with an optional name beside it. That
is §2 arriving in the interface — asking a phone *where* is how a voice notebook
grows a folder tree.

### Stage 3 — review on the phone

`notes-review.tsx`, `GET /api/notes`, `PATCH`/`DELETE /api/notes/[noteId]`, and
migration 0042.

§7's list and its restraint: the project's notes, filtered by the five
categories, correctable, deletable with a confirmation, and **no research
hierarchy** — which §1 is what makes affordable, since deciding where a note
goes happens at the desk.

**A note the desktop has already filed is shown and not edited.** It is the
trail behind a real research item by then; rewriting the capture would change
nothing about the project and everything about the record of where that work
came from. `mayStillEdit` decides in the domain, the route answers a person with
a sentence rather than a silent no-op, and **migration 0042 refuses underneath
both** — because a rule that lives only in a screen is a rule the next client
will not know about. Reading is untouched: §9 wants the phone to keep a
reviewable copy after syncing rather than appearing to lose it.

Proved against the live database, in a transaction and rolled back: a waiting
note could be corrected and thrown away, the desktop could still move it from
`pending` to `approved`, and a placed note was neither edited nor deleted while
staying readable.

Driven at phone width: the capture screen asks *Project*, *This is a* and
*Who*; Review lists the notes under filter chips with **Correct** and
**Delete**, and the filed one faded, uneditable, saying *Filed in VC Writer —
change it there*. Looking at it caught two things the tests could not: the name
field had no box (only `select` and the textarea were styled) and the chips had
no outline, because the variable I reached for does not exist in this theme.

### Stage 4 — voice capture

`packages/domain/src/capture-voice.ts`, `isReadBackSupported` / `readAloud` in
`apps/web/src/lib/dictation.ts`, and the capture screen around them.

**The browser hears; the domain decides what was meant.** A recogniser hands
back a string, and every question after that — was a category named, was a
person named, is this a correction — is a rule about text. `readSpoken` is that
rule, in the domain where it can be tested, rather than in a component where it
can only be demonstrated. The file is named `capture-voice.ts` because
`voice.ts` was already taken by the read-back voices of spec §10: a *voice*
there is a synthesised speaker, and here it is what somebody said.

Three things it refuses to do, each for the same reason — **a wrong guess is
worse than no guess, because on a phone in a pocket nobody sees it happen**:

- **Only the opening of an utterance is a command.** A writer who says *the idea
  is that she never drives* is dictating, not filing. A parser that hunted for
  keywords anywhere would quietly file half their notes for them.
- **A name needs a pause after it.** A recogniser writes a pause as a comma or a
  dash, and without one there is no way to tell *Marisol never trusts him* from
  a name followed by a note. With no pause nothing is taken and the whole thing
  becomes the note — visible, and one tap to fix. Capped at four words, since a
  pause also falls mid-sentence and *the audit lands the same week* is not
  somebody's name.
- **Whole words only.** *Arc* must not match *architecture* — the same mistake
  `charactersCalled` was built to stop the rest of the product making about
  character cues.

Only **Character** and **Arc** take a name, because those are the two of the
five that are about a person. *Idea, the audit lands the same week* has a pause
in it and nobody in it.

**A correction replaces.** His §6 allows a correction to be a clarification
instead, and an interpretation layer could try to tell the two apart — but a
model deciding whether to replace or append is a model that will sometimes throw
a sentence away silently, in a room where the writer cannot see the screen. So
it replaces, the previous wording is handed back, and **Undo correction** puts
it back in one press.

The screen gained three things and lost none. The largest type on it is now
**what is about to be filed** — the category and the name, which are the two
facts a writer cannot check by glancing and the two a recogniser most often gets
wrong — with *Heard: …* under it whenever an utterance was read as a command.
**Read it back** speaks the note through `speechSynthesis` (far better supported
than recognition, iOS included, and the tap that stopped dictation is the
gesture it needs), saying the category and the name first and then the note
*exactly as it stands*: a read-back that tidied the words would be confirming
something other than what would be saved. And the line under the buttons names
the five spoken commands, because a command nobody knows about is not a feature.

**`continuous` is a request, not a promise.** Driven at iPhone size, the first
version of this stage failed the platform it was chosen for: iOS Safari ends a
recognition session after every utterance whatever the flag says, so the button
went back to reading *Dictate* after one sentence and the writer had to tap
again for the next — *tap once and talk* quietly becoming *tap after every
sentence*. `startDictation` now restarts a session nobody stopped, so the tap on
**Dictate** means listening until it is tapped a second time, and a silence long
enough to time out is not reported as an error, because a writer thinking is the
normal case. Three fruitless restarts in a row end it instead: a microphone
another app has taken would otherwise be restarted for ever with the button
lit, which looks exactly like listening and is not. On a browser that honours
`continuous` none of it fires. `dictation.test.ts` holds both halves — that it
keeps going, and that it knows when to stop.

**The phone app is not a page of the site.** The same iPhone run found the
microphone below the fold: the marketing header — the wordmark and five nav
links — took the top half of a 664pt screen, and under it sat the tabs, both
pickers and a note box asking for 44vh, so the button a voice notebook exists
for needed a scroll before the writer had done anything. `/notes` now sits
outside a `(site)` route group that owns the header and the footer, so what a
page wears is decided by **where it is in the tree** rather than by a condition
somebody has to remember to keep true. No address changed; `not-found.tsx` sits
outside the group too and asks for the chrome itself, since an address that
matched nothing could have been meant as any page of the site. The note box is
sized to the screen rather than to a row count — tall enough to read a note
back, short enough to keep the microphone on it, and still draggable. Dictate is
now above the fold on every capture screen, checked by measuring it rather than
by looking.

**A phone is operated with a thumb, on a train.** Apple asks for 44pt, and a
note taken one-handed is exactly the case that number exists for. A sweep of
every control on every current iPhone size found fourteen that were not: the
way back at 26px, *Correct* and *Delete* on a note at 29, the Review filters at
35. All of them are 44 now. It is worth saying how they were found — **measured,
not looked at**: each of them was legible, none of them looked wrong in a
screenshot, and the audit that reads every control's height on four viewports
took less time than squinting at one.

Driven at phone width with a stubbed recogniser, so the whole path runs for
real: *Character, Mara — she never lets anyone else drive* set the category, the
name and the note from one utterance; *Correction. …* replaced the wording and
raised the undo. Then at iPhone SE, 13, Pro Max and landscape, on all four
screens — the project list, capture, review and starting a project — with a
recogniser that ends after each utterance, which is what found all of the
above.

### Stage 5 — the project page

`project-page.tsx`, and `GET`/`POST /api/notes/projects`.

**The app opens here, always.** Ken's §2 puts *project first* at the top of the
UX principles, and building it as a picker above the microphone quietly broke
that: a writer could dictate for a minute into whichever script was selected
last. It is now the first screen, and past it every screen carries the project's
name and the way back — because project-first is a promise, not a first step.

The one they last captured into is **marked rather than pre-opened**. Skipping
the question would put the picker back where it was, in effect if not in
pixels.

**A new project is made by the same function that makes one on the desktop.**
`createProjectFile` builds the whole document — the opening scene, its beat, the
plot track, the research folders, the cast headings — and `toRows` says what that
is in the database, written in `SYNC_TABLES` declaration order for the same
reason the desktop's push uses it. A route that wrote a bare `projects` row
instead would give the phone a second, thinner idea of what a project is, and
the difference would surface the first time somebody opened it at a desk and
found no folders in it. If any collection fails to insert, the project row is
deleted and its children go with it on the cascades: half a project is worse
than none.

One thing went with the picker: the phone can no longer file a note under **no
project**. The column still allows it and the desktop still routes such a note,
but §3.1 is explicit that every captured note belongs to a selected project, so
the phone no longer offers the state.

Driven at phone width: the list, the name-and-format form, and the capture
screen behind *‹ Projects · Blackout*.

## 8. Dictation at the desk

The phone's stage 4 finished the *phone*. Spec §9's first bullet — **desktop
writing areas support dictation as an alternative to typing** — is a different
thing, and this is where it was built, because it shares the reading.

`packages/domain/src/spoken-script.ts` is that reading, and the reason it has to
exist is a fact about where the writing rules live: **Return and Tab are handled
on keydown, and dictated text never presses a key.** It arrives as an edit to
the field. Without this, a scene spoken into the app lands as one action
paragraph with the newlines buried inside it — every slugline, cue and speech
in it flattened into a single element. The clipboard has had the answer since
the reformat tool: text arriving in bulk becomes *typed elements*. Dictation is
a paste coming through a different door.

**A command is a sentence of its own.** *Scene heading*, *Action*, *Character*,
*Dialogue*, *Parenthetical*, *Transition*, *Shot* — and the words a writer
actually uses, *slug line*, *wryly*, *cue* — start an element when they open a
sentence and close it, which is what a pause sounds like to a recogniser. *The
action was over by the time she got there* is prose and stays prose. When the
test fails nothing is taken and the words stay in the manuscript where they can
be seen, which is the trade §2 of this addendum already made about a spoken
name: a wrong guess is worse than no guess, because a guess that goes unnoticed
is a line of somebody's screenplay quietly turned into a heading.

One thing is edited rather than transcribed, and only one: **a cue is a name**,
so the full stop a recogniser puts after *Mara.* comes off. Not for how it
reads — the cast is noted from cues, so leaving it on would put a second,
punctuated person in the character list beside the real one.

**Which recogniser is answered by trying, not by guessing.** The API is present
in both places the renderer runs and works in one: in the browser preview the
page is real Chrome; in Electron the constructor exists but Chromium's
recogniser is a client for a Google speech service reached with a key only
official Chrome builds carry, so the session dies with a network error. Nor may
it be settled by sniffing `window.vcwriter`, which is deliberately the same
interface in both — *the application above does not know the difference, and
that is the entire point of the interface*. So the button is offered, and **the
first failure is the answer**: after a network error the app names the operating
system's dictation instead, for the run. It costs one press to find out, it is
honest about what happened rather than about what was predicted, and it needs no
revisiting if Electron ever gains a service.

The system's dictation is the better tool anyway — installed, trained,
permitted, and it types into whatever field has focus, which the writing areas
are. What does **not** work on that path is naming a style aloud, and the
interface says so rather than implying otherwise: the system types into the
field, and the app cannot tell those words from the same words typed by hand,
so it must not act on them. Saying *new line* does reach it, a line break in a
field never having been a keypress, and that is what is offered there.

The control is opt-in per writing surface (`dictation` on `BeatBody`) because
the Script draws every beat in the manuscript with one — rendered
unconditionally it appeared nine times down a short script, each with its own
copy of the help. It belongs where one beat is being written.

Driven in the built renderer: *Scene heading. Interior kitchen, night. Action.
She opens the fridge. Character. Mara. Dialogue. There is nothing in here.*
spoken in one breath arrived as four correctly typed, correctly indented
elements, and a network failure flipped the same control to naming the system
key.

## 9. What this addendum deliberately does not do

- It does not restate §12's nine exclusions. They are Ken's, they are clear, and
  §1 is the rule that makes them hold.
- It does not add a wake phrase. Spec §18 already flagged it as dependent on
  platform constraints, and §5's *tap the microphone* does not need one.
- It does not give the phone the Research tree, the Sculptor, the Outliner or
  the Room. §12 says so; §1 is why it stays true.
