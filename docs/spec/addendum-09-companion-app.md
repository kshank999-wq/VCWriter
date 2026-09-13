# Addendum 09 — The Companion App

Status: **stages 0–3 built** — the two fields, the desktop Mobile App area with
drag-and-drop, the upload contract, and review on the phone. September 2026. From Ken's *VC Writer
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

## 5. The open decision: what the app is built as

This is the one thing the code cannot answer, and it changes the shape of the
work rather than the amount.

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

The stages below are written so that **everything before stage 4 is the same
either way**: the data model, the sync contract and the desktop inbox do not
know what the phone is written in. The decision is only needed when the capture
screen itself is built.

## 6. Build order

0. ✅ **The two fields** — migration 0041 (`category`, `subject_name`), the
   domain schema, the round trip. Nothing visible.
1. ✅ **The desktop Mobile App area** — see §8.
2. ✅ **The upload contract** — see §7.
3. ✅ **Review on the phone** — see §7.
4. **Voice capture** — §5 and §6: the category command, the live transcription,
   the read-back, the correction loop. **Needs §5's decision.**
5. **Project page** — §3.1, including *create a new project* from the phone.

§13's acceptance criteria are met at the end of 5, not before — stage 3 gives a
working typed-capture product, which is worth having on its own and is what a
first release can be if the platform decision takes a while.

## 7. What stages 0 and 1 built

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

## 8. What this addendum deliberately does not do

- It does not restate §12's nine exclusions. They are Ken's, they are clear, and
  §1 is the rule that makes them hold.
- It does not add a wake phrase. Spec §18 already flagged it as dependent on
  platform constraints, and §5's *tap the microphone* does not need one.
- It does not give the phone the Research tree, the Sculptor, the Outliner or
  the Room. §12 says so; §1 is why it stays true.
