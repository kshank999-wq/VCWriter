# Addendum 09 — The Companion App

Status: **all six stages built**, plus §8 — dictation at the desk, which
is spec §9's first bullet rather than this app's, built here because it shares
the reading — and §10, hands-free capture, whose §10.5 names the two things
Ken asked for that are staged rather than half-built. September 2026. From Ken's *VC Writer
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

### 8a. A button in the corner, and the help in its tooltip

From Ken, looking at a beat: *when you're in a beat, the dictate should be a
button in the corner that you can turn on and off, with a little microphone that
says dictate. And when you hold your cursor over it, a tooltip comes up with the
instructions that are now shown on the screen. It would be too distracting for a
writer.*

He is right, and the reason is worth keeping. §8 put the five spoken styles in a
sentence under the writing — **standing prose beneath somebody's manuscript, a
permanent reminder of how to use a tool they may never press**. What a writer
needs on the page is a way in and a light that says whether it is listening.
Everything else is something you go and look for, once.

So the control is a small pill with a microphone: *Dictate*, *Listening* while
it runs, `aria-pressed` either way so the state is said as well as drawn, and
the instructions in its `title`. The microphone **fills** while the recogniser
is running, which is the one state that has to read from across the room.

**It stands in the top corner of the paper, out of the flow entirely.** Two
other arrangements were driven first and both were wrong in ways only the
screen showed: sticky at the foot put it an inch under the first line on a
short beat rather than in any corner, and giving the column a page's height to
push it down **stretched the empty-state button into a block half the sheet
tall**, the column being a grid whose single row then filled the track. The
sheet's top inch is margin — blank paper above the first line — so the button
stands there, always in the same place and never moving as the writing grows.

**Absent rather than greyed where the app cannot hear for itself.** A disabled
*Dictate* is a control that can only refuse, which this room forbids; where the
system types into the field instead, one short line stands in the button's
place, in the same corner, with the rest in its own tooltip. A test asserted
this before the change and was right to: it caught the first draft, which had
left a greyed button there.

Which help is shown is still settled by trying rather than by guessing the
platform (§8), because the two paths can offer different things: where the app
hears for itself, naming a style aloud works and is worth listing; where the
system types, it cannot, and implying otherwise would be worse than saying
nothing.

### 8b. The parenthetical that grew a bracket

From Ken, with a screenshot: he dictated *parenthetical*, then *lifted the gun*,
and the page read `() lifted the gun)`.

**The brackets are the program's furniture and the words are the writer's**, and
`insideParentheses` — the one function that separates them — could strand one.
It stripped from the outside in a loop, and the loop could not clear a bracket
that had become the **first** character: saying *parenthetical* makes an empty
one, `()`; the next words are joined onto its text, giving `() lifted the gun`;
taking the leading `(` off leaves `) lifted the gun`, which neither half of the
condition matches. So it came back with the stray bracket still in it and was
wrapped again.

It takes **every** bracket off now, which is idempotent by construction — what
`retype` needs when it is asked to turn a parenthetical into a parenthetical,
and what a dictated phrase arriving in two utterances requires. Nothing is lost:
a parenthetical is a wryly — *(beat)*, *(to Mara)*, *(quietly)* — and a bracket
inside one is this program's own, never punctuation somebody meant.

The lesson is small and general: **a function that normalises has to be safe to
run twice**, because the thing that runs it twice is not the code that was being
looked at when it was written.

### 8c. Off the page altogether

From Ken, after using §8a: *move the dictate button to just below where it says
in script. And you can make the box white, with black text instead, but off of
the page. I don't want distractions when people are writing.*

§8a moved the instructions into a tooltip and was still wrong about the button.
It found a corner of the **paper**, and the paper is the one surface in this
program that should hold nothing but somebody's words. Four arrangements were
driven in all — sticky at the foot, a page's worth of column height pushing it
down, the sheet's top margin, and this — and the first three differ only in
*where on the manuscript* the control sat. **The question was never which
corner; it was whether it belonged on the page at all.** It does not: it is a
tool of the writing screen, like the draft picker and *In script*, and it
belongs in the chrome with them.

So `writer-tools` is a strip between the bar and the sheet, right-aligned under
*In script*, empty and of no height until something is put in it.

**It is a slot, never a second control** (`dictationSlot` on `BeatBody`). Every
part of hearing, reading what was meant and laying the words in stays exactly
where it was; what moves is where the button is *drawn*, through a portal into
the node the surface supplies. A screen that built its own Dictate in the bar
would be a second answer to *is it listening*, free to disagree with the first
the moment either changed. Given no slot it draws in place, which is what any
other surface gets.

White with black text, which is Ken's: the same paper as the page it works on,
so it reads as belonging to the writing without being in it. **Listening says
so inside the box** — a red microphone and a red word — rather than by
repainting it, a control that changes colour being the sort of movement this
was taken off the page to avoid.

The slot earned its own test for the reason it is worth having: it is the one
part of this that can fail silently. A button that never arrives because the
node was not passed down looks precisely like dictation not being there at all,
which is §15a's lesson — a gated control's absence reads as a decision rather
than as a fault.

## 9. What this addendum deliberately does not do

- It does not restate §12's nine exclusions. They are Ken's, they are clear, and
  §1 is the rule that makes them hold.
- It does not add a wake phrase. Spec §18 already flagged it as dependent on
  platform constraints, and §5's *tap the microphone* does not need one.
- It does not give the phone the Research tree, the Sculptor, the Outliner or
  the Room. §12 says so; §1 is why it stays true.

## 10. Hands free: a walk, not a screen

From Ken: *I want that same functionality in the mobile app… you can say
Project Jinn, character, Tom. And then it'll beep and you'll start that note.
And then you can say something that will turn it off without making that word
unavailable when you're using the notes. Maybe you can say dictate done. And
then it saves the note. Then you could say dictate new setting… Or you can just
say idea, and it can go into your ideas folder.*

### 10.1 The design is in the problem he stated

A voice notebook you use while walking cannot ask you to press anything between
notes, so the words that **end** a note have to be said out loud — and any word
that ends a note is a word you can no longer put *in* one. Ken's answer is the
right one and it is the only one that scales: **every command is prefixed
`dictate`**. The command vocabulary and the writing vocabulary then never
overlap, and a note may contain *done*, *idea*, *character*, *project* and
*correction* as freely as any other words. A test says exactly that, with all
five said inside one note.

Two states and one rule each.

**While a note is open, nothing but `dictate …` is a command.** Everything said
is the note. This is what makes the phone safe to talk into.

**While nothing is open, a bare category word may also start one** — his *or you
can just say idea*. It is safe there for the reason it is unsafe inside a note:
there is no note for the word to have belonged to.

`dictate` followed by something the app does not know is **said rather than
swallowed**. A writer who gave a command believes they gave one, and quietly
writing *dictate nwe setitng* into the middle of their sentence is the worst of
the three things that could happen to it, because it is the one they will not
notice until they are back at the desk.

### 10.2 The words are the project's, which revises §2

§2 fixed five kinds of thought — Character, Plot Point, Idea, Theme, Arc — and
said *five, and no more*. That was right for a phone that **did not know which
project it was in**, where the only honest thing to offer is kinds of thought.
The app has opened on a project list since stage 5, so a note is addressed to a
project before a word is spoken, and once the project is known the words that
project uses are the right words: a textbook writer saying *beat* means nothing;
saying *section* means something exact.

**What makes this a voice notebook is not the length of the list.** It is that
nothing here is filed into the manuscript — saying *character, Tom* makes a note
about Tom, never a character record, and the desktop still places it. §2's line,
the phone captures and the desktop places, is untouched, and it is the line that
matters.

`captureVocabulary` reads the words off the format, so the structural pair is
**the noun table's** (addendum 16 §6c): Scene and Beat on a screenplay, Chapter
and Passage in a novel, Section and Subsection in a textbook. Character, Setting,
Plot Point and Arc are **absent rather than renamed** on a textbook (addendum 16
§6a), which has no cast, no locations and no plot.

Writing the tests caught what generosity costs here. Ken said *just chapter and
section in that educational book*, and the program calls those Section and
Subsection; offering his words as synonyms as well put **`section` on both rungs
at once** — the unit to somebody who knows the program, the sub to somebody
using his words. Two levels behind one spoken word is the one ambiguity a tool
you cannot look at must not have, so **the program's own words win and there are
no synonyms for the structural pair**; a word that fits neither is kept as
writing rather than guessed at.

The stored category becomes text (migration 0060). An enum cannot carry a
vocabulary read off the format without a migration per word, and worse: a value
it does not hold is refused at the door, which would turn a note sent by a newer
phone into an error. The five keep their exact spellings, so every note ever
captured reads back as what it was, and `inboxGroups` now **groups by what is
there** rather than by a list written in that file — which is also the only way
it can keep the promise its own comment makes, that the last group is never
hidden.

### 10.3 What it does without being looked at

**It beeps**, which is Ken's, and it is the whole of the feedback when the phone
is in a pocket: a tone says *heard, and listening now* in a tenth of the time a
spoken confirmation takes, which matters because the writer is about to talk and
anything still speaking is something they will talk over. Two sounds, told apart
**by direction rather than pitch** — opening rises, closing falls — because a
listener who cannot say which note is higher can always say which way a pair
moved, and a walk is not a quiet room. Synthesised rather than a file, and it
**never throws**: a browser that will not give a page audio, a device on silent,
a build with no `AudioContext` — none of those is a reason a note should fail to
open.

**It answers commands and never the writing.** Reading dictation back as it
arrives would talk over somebody mid-sentence, which is exactly what a
hands-free notebook must not do; what is worth hearing is that a note opened,
closed or went away.

**It never loses a note.** Every path that closes one files it — including the
one where a new note is started while another is open, because a writer who says
*dictate setting* mid-thought has finished the thought before it. The note still
open when the walk ends is kept too: a notebook that kept only what you
remembered to close is one you stop trusting after the first walk. The one act
that throws anything away is the one that says so out loud, *dictate scratch
that*. And each note goes to the device **as it closes** rather than at the end,
because the queue exists precisely so a flat battery costs nothing.

### 10.4 A bug in shipped code, found by writing his sentence down

Ken's example is *character, Tom*. Through the shipped stage 4 reader that came
back with **no name at all** — the remainder was tidied before the name rule
ran, which strips the leading comma, **the very pause that marks the name**, so
a name could only be found when there happened to be a *second* pause after it.
*Character, Marisol, she never trusts him* worked; *character, Tom*, which is
what somebody actually says, did not.

The first fix broke the other direction, and the existing tests caught it within
the minute: **there are two shapes and both are real.** The pause falls after
the name (*Character Marisol, she never trusts him*) or straight after the
category (*Character, Tom*), and the rule now says so in those terms. With no
pause anywhere nothing is taken, which is stage 4's rule and still the right
one. One function, read by both the single-utterance reader and the sitting.

### 10.5 What this stage deliberately does not do

Ken asked for two more things and they were stages of their own rather than
half-built here. **Both are now built** — §11 and §12 — and neither turned out
to need the machinery it looked like it needed:

- ~~**Making a project by voice**~~ — built, as §11.
- ~~**Subcategories within a project**~~ — built, as §12, and *not* as research
  categories made from a pocket. What a spoken one means is a word on the note;
  where it shows is the inbox, divided.

Neither is started, so neither is on the screen. What is built is the walk
itself, and it works end to end: driven in a real browser, Ken's own sequence —
*dictate project Jinn*, *character, Tom*, a sentence with *idea* and *project*
in it, *dictate done*, *dictate new setting*, a sentence, *dictate done*,
*idea*, a sentence — files three notes with their categories and Tom's name,
beeps on exactly the turns that open and close, and leaves both command words
sitting in the middle of the first note where they were spoken.

## 11. Making a project by voice

From Ken, straight after the walk: *now add creating a project by voice with
the format* — the first of the two things §10.5 had named as staged, and the
one it gave a reason for staging. That reason is the whole of the design, so it
is worth repeating before anything else: **a mis-heard *novel* makes a document
whose chapters are scenes, found out about a fortnight later.** A note in the
wrong group is a minute's work to move; a project of the wrong shape is not.

### 11.1 Nothing is made until a word whose only job is to make it

`hear` is pure and **never creates**. What a confirmation does is set
`makes: { name, format }` on the sitting for exactly that turn, and the host
goes and does it — which is what the domain half was for from the start: what
the writer said is a fact worth testing, and a network call is not one. The
route is the picker's own (`/api/notes/projects`, `createProjectFile` +
`toRows`), so a project named into a phone in a pocket is the same document —
the opening scene, the research folders, the cast headings — as one named with
a keyboard.

Three steps and each is said out loud:

    dictate new project Blackout     → “Blackout. What kind? Screenplay, Series, …”
    a novel                          → “Blackout, novel. Say ‘dictate yes’ to make it.”
    dictate yes                      → “Making Blackout…” then “Blackout is ready.”

The kind may arrive in the same breath (*dictate new project The Lamp, a
novel*), or **before the name** — a writer who answers the second question first
has still answered it — and `askAbout` is the **one place** that decides what is
asked next, because three of them would eventually disagree about what is still
wanted and the writer has nothing to check the answer against.

While a plan is waiting the phone is **not taking notes**: what is said answers
the question just asked. That is safe where a bare category word is not, because
this state is short, explicit and says out loud what it wants next — and unsafe
to skip, since *a novel* would otherwise become the first line of a note nobody
meant to open, and *idea* would open one.

### 11.2 Refused rather than guessed, at both ends

**No word appears on two formats**, and the two that would — a bare *book*, a
bare *story* — are deliberately absent, because *book* is a novel to one writer
and a textbook to the next and there is no way to ask which from a pocket.
Matching is longest-first, so *screenplay* is not read as *play*. A word that is
not a kind is refused **with the list said again** rather than resolved to the
nearest-sounding one.

A command that is not one of the three this state answers is refused too:
*dictate done* over a waiting plan might mean *make it* and might mean *I have
finished talking*, and only `yes` is allowed to mean the first.

`NEW_PROJECT` is checked **before** `PROJECT`, or the filler stripper (which
holds *new*) turns *dictate new project Jinn* into *dictate project Jinn* —
making one and moving to one being two acts that must not collapse into each
other.

### 11.3 A failure keeps the plan; a success is only let go of if it is still the one

`projectMade` and `projectFailed` are in the domain rather than in the host for
the usual reason: a component assembling a `Sitting` of its own is a second
answer about what state the walk is in, and this one is read by a screen the
writer cannot see.

A failure **keeps the plan**, so saying *dictate yes* again is a retry rather
than starting over — which is what somebody walking with a phone will do, and
the only reason the name and the kind are worth gathering separately from the
making. And the plan is let go of only if it is still the one that was
confirmed: the network answers whenever it answers, and by then the writer may
have scratched it and started another, so clearing blind would take a plan
nobody had finished with (addendum 18 stage 7's lesson — a value caught on its
way out depends on when the host runs it).

Offline is **refused out loud rather than queued**. Every note on this screen is
queued offline and sent later, and a project is the one thing that cannot be:
the notes said into it would be addressed to an id that does not exist yet.

### 11.4 The picker was two kinds short

Building it found a plain gap beside the feature: `/notes`'s project picker
offered **six** formats and the program has **eight** — so *an educational
book*, the one Ken named by name, could not be made by hand at all, and a game
made on the desktop drew its raw column value in the list. The route had always
accepted any format; only the picker was short. It reads one table now, which
the select and the list share, because two lists of formats is how one of them
came to be missing two.

### 11.5 What driving it found: a reply that is not a reply

Two turns **said nothing at all**, and both are the same fault. `askAbout` said
what was *missing*, so answering *a screenplay* before naming anything produced
the identical sentence to the one before it — and `speakBack` suppresses a
repeat, so the phone was silent and nothing on the screen moved. From a pocket
that is indistinguishable from not having been heard, which is the one failure
this feature must not have. The same thing hid the refusal of *dictate done*.

So: **a reply has to differ from the question it answers or it is not a reply.**
`askAbout` says what has landed and then what is missing (*Screenplay. What is
it called?*), and the refusal comes first with the question after it (*Nothing
made yet. Blackout, novel. Say “dictate yes” to make it.*). A test now walks a
sequence and asserts every turn speaks — the assertion the earlier tests could
not have made, because they checked what each sentence *was* rather than whether
it was heard.

### 11.6 Driven

The phone screen itself, in Chromium at 420px, with Supabase's auth answered by
the harness, the projects route stubbed and a recogniser of the same shape
`dictation.ts` reads — so everything from the utterance to the pixels is the
app's own code. Talking into a screenplay called *Jinn*: *character, Tom* and a
sentence, then *dictate new project Blackout* (which files Tom's note first —
making a project is not a reason to lose the thought that led to it), *a novel*,
*dictate yes*. The route received `{ title: 'Blackout', format: 'novel' }`, the
header changed to **Blackout**, five sentences were spoken in order, and the
next *chapter* opened a **Chapter** — the new project's own word, which is what
the live-project ref is for.

## 12. Subcategories, said out loud

From Ken: *you can create subcategories for that project if you need to* — the
second of the two §10.5 staged, and the one whose own note said what was
missing: *these are `research_categories`, which already nest; what is missing
is what a spoken one means and where it shows on the desktop.*

The audit paid before a line was written. Research folders have nested since
addendum 02 §7; `requestedRouting` has existed since 0003 and already outranks
every guess in `suggestRouting`; `inboxGroups` already groups. So this is one
nullable column and one decision.

### 12.1 A word on the note, and never a folder in the project

The decision is §2's trap asked a second time, and the tempting build is the
wrong one. Letting the phone name a research folder — even letting it *make*
one — is the phone **placing**, and §1's line is that it captures while the
desktop places. §2 says why in one sentence: an app that never decides where a
thought goes needs no folder tree, no cast list and no taxonomy. A taxonomy
growing out of somebody's pocket, while they are walking and cannot see a
screen, is exactly the thing that sentence refuses.

So **saying a group creates nothing**. `subcategory` is free text on the
capture row (migration 0061), the project document is untouched by a walk, and
there is no network call, no folder, no id and nothing to reconcile. It works
offline like the rest of the app because there is nothing for it to ask.

What that buys is real and it is the whole feature: **a walk arrives at the desk
already divided**, and filing a whole group is one press there.

### 12.2 It sticks, because that is why it is worth saying

Like the project and unlike a category, a group is a setting on the sitting:

    dictate group Marketing   → “Group: Marketing.”
    idea · a poster with nobody on it · dictate done
    idea · the tagline is the last line of the film · dictate done
    dictate no group          → “Out of that group.”

Six thoughts about one thing cost one word. It applies to **the note in hand**
too — somebody who says it halfway through a note means this one, which is the
only reading whose mistakes are in the recoverable direction — and it is spoken
back on every turn, because a setting that silently changes where six later
notes land is the one a pocket most needs to hear.

*group*, *subcategory*, *folder*, *topic*, *under* and *subgroup* all mean it
(**generous in, one key out**); *dictate group* with no name **says where you
are and changes nothing**, clearing having a command of its own, since guessing
would throw a group away on half a sentence. `groupsSaid` keeps **one spelling
per group** — a reading over the sitting, not a list beside it — so *marketing*
said twice is one folder at the desk rather than two.

### 12.3 The act makes the folder, at the desk

The inbox divides each category by what was said, in the order the notes
already come in (newest first — writing *first said first* there would have been
a second ordering inside a list that has one, and the test caught it), and
**divides by nothing where nobody said a group**: a single heading reading *No
group* over everything divides nothing, which is the glossary letters' rule
(addendum 20 §17a).

`groupOffer` says what a press would do before it can be asked for —
`trackRemoval`'s shape — and `openGroupFolder` is the act: the folder is made
**under the category's own** (Marketing under Ideas), or found if it is already
there, and then each note goes through the same `approveCapture` a single press
uses. **This is the one place the taxonomy grows**, and it grows by somebody
pressing a button while looking at what is about to go in it. It is idempotent
by name, addendum 24 §5n's rule put in the act rather than on the screen.

`suggestRouting` routes to the group's folder **only once it exists**, and where
it does not the note goes to the category's own folder with the word in the
reason — *no Marketing folder yet* — because a spoken word that vanishes is
worse than one that lands somewhere plain.

### 12.4 A group narrows a folder; it cannot narrow a person

Driving the walk found the one place the two things a writer said pull apart:
*dictate group casting*, then *character, Tom*. The name is the more specific
of the two and is what the character branches exist for, so the person wins —
and **the group is said in the reason** rather than dropped where nobody can see
it (*you also said casting, which does not narrow a person*). A writer who hears
their own word back knows it was heard, and the drag is still there for filing
it the other way.

### 12.5 Three places that had not followed §10

Building it found the same drift three times, all from §10 widening the spoken
vocabulary and migration 0060 widening the column:

- **`captureUploadSchema.category` was still the five-value enum**, so the
  documented `POST /api/notes` refused a `setting` or a `sub` note with a 400
  while the web page, which writes to the database directly, took them happily.
  A gate beside a reader that has learned to take more is addendum 20 §16a's
  lesson pointed at a payload — and **the test that pinned the narrowness is why
  it survived**, asserting *refuses a category that is not one of the five* long
  after there were more than five.
- **`QueuedCapture.category`** was the same union, which the hands-free path had
  been casting past, so a `setting` note went into IndexedDB under a type saying
  it could not exist.
- **The desktop inbox never passed the format**, so a scene note was headed
  *Scene or chapter* on a screenplay that has scenes.

### 12.6 Driven

The phone at 420px with the recogniser and the routes stubbed: *dictate group
Marketing* sets it and speaks it, two notes file carrying it, *dictate no group*
comes out, and the next opens ungrouped — with the group on the screen above the
note and a chip on each filed row. Then the same captures through the desk:
`Idea` divides into *Marketing (2)* and *No group (1)*, `Character` into
*casting (1)*, the presses read *Make Marketing under Ideas and file 2 notes
into it*, and one of them takes the project from six research folders to seven
with **Marketing under Ideas**.
