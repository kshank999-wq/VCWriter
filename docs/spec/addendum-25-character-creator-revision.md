# Addendum 25 — The Character Creator, revised

From Ken's handoff package: `HANDOFF.md`, five mockups and a second
development spec. It is a **revision of a built module**, not a new one —
addendum 08 is the Character Creator and all fourteen of its stages are
standing. This addendum says what the handoff asks for that is not there,
what is there under another name, and the order the difference is built in.

Where the handoff and the older spec differ the handoff wins; where the
handoff and **this project's built decisions** differ, §2 says which won and
why.

## 1. The audit

The habit pays a **twenty-first** time, and harder than usual: the handoff's
own headline decision had already been made here independently.

**The spec's seven tabs became four.** The handoff says so as a decision
beyond the spec, to be confirmed. `CreatorTab` has been
`'overview' | 'traits' | 'arc' | 'relationships'` since addendum 08 stage 2,
for the same reason — *Connections* is the Arc tab's business and *Usage* is a
filter rather than a place. Nothing to build.

Standing, and asked for again:

| The handoff asks for | Where it already is |
|---|---|
| The module in Research, from the Characters category | Addendum 08 §11: the research menu says **Character Creator** by name |
| A trait with a name, a category, a strength 1–5 and a note | `characterTraitSchema`: `name`, `kind`, `prominence`, `notes` |
| Moments under a trait, red until they are in the manuscript | §1's own principle: the characterization item is the unit of work |
| **Used is a reading, never a stored flag** | §2, and the handoff's §17 agrees word for word |
| Retired items kept out of counts and warnings | `retired`, stored because it is an intention |
| A link anchored to stable ids rather than to copied text | `usageLinkSchema` — beat id, element id, and the words as a quote |
| One moment used more than once, with a ×N | `whereItAppears` |
| Right-click *Add to Character Characterization*, with the character, the trait or a new one, and a name | Addendum 08 stage 4, `captureFromScript` |
| People in the current scene offered first | `peopleInBeat` |
| A moment found while writing goes in as **used** | `captureFromScript` pins it in the same act |
| Arc with a beginning, a need, an end and ten kinds of point | `characterArcSchema`, `ARC_POINT_KINDS` |
| Chance to change → refusal → doubles down → result | `opportunity`, `refusal`, `doubling_down`, `consequence` |
| An on-deck arc queue, dragged onto a scene | Addendum 08 §13, `carry-work.ts` |
| Relationships that are **directional**, typed, with a custom label, a description and a current state | `characterRelationshipSchema`, `relationshipsOf`'s two lists |
| A map focused on one person, one step out, filtered by type and chapter range | `character-map.ts`, `SceneRange` |
| Cross-character arc links with eight verbs | `ARC_LINK_VERBS`, on `story_links` |
| Review in story order, and an unused-material report | `character-review.ts` |
| Red counts per character | `characterRail`, `stillOnDeck`, `onDeckNote` |
| A colour per person | `characterColour(position)` in `story-threads.ts`, **derived** |

What is genuinely new is therefore smaller than the package looks, and it is
mostly **the screen** rather than the model.

## 2. Decisions

**The arc's shape is said *and* read.** Addendum 08 §5 made the shape a
reading — *a refusal makes it refused whatever else is there* — and the
handoff asks for a Grows / Falls / Refuses to change toggle. Both are right
about different moments. An arc with no points yet has no shape to read, and
the toggle is what makes the refusal furniture appear before there is
anything to refuse; a finished arc's shape is a fact about its points and a
control that let a writer label a refusal *Grows* would be a control that
lies. So the toggle stores an **intention**, `arcShape` goes on reading the
points, and **where the two disagree the screen says so** rather than
picking. That is addendum 13's `movementOf` pointed at an arc.

**`origin` is taken, so a moment is `found`.** The handoff's
`origin: planned | discovered` collides twice: `origin` on a record has meant
*who made it, in a room* since addendum 07 stage 4, and addendum 16 §2 had to
separate `source` from `origin` for the same reason. A moment carries `found`
— true where it came out of the manuscript — which is what the badge reads.

**A colour is read, never stored.** `avatarColor` on the record would be a
second answer to a question `characterColour` already answers for the
timeline and the threads, and a new character would arrive with no colour
until somebody picked one. It is read from the cast's order, so everything
that draws a person draws them the same colour.

**A moment in the interface, a `CharacterizationItem` in the data** — the
handoff's own decision, and the right one: the word a writer uses and the
word the schema uses answer different questions.

**Nothing here stores a status.** Every count, every bar, every *up next*
line and the whole of *at a glance* is read off the usage links at the moment
it is asked for, which is §2 of addendum 08 and is what makes cutting a scene
turn a row red with nothing run.

## 3. What is new

1. **The character record**: a role (preset chips plus the writer's own), an
   optional Background & look group, and the writer's own fields.
2. **`conflictsWith` on a trait** — *pulls against Miserly*.
3. **`found` on a moment** — the *found while writing* badge.
4. **An arc `shape`** — the intention, beside the reading.
5. **Relationship stages** — *How it changes*, a state at a scene, where
   there is one free-text `evolution` now.
6. **At a glance** and **Up next** — two readings on the Overview.
7. **The Story panel** on the Traits tab: chapters and scenes as drop
   targets, bright where the character appears.
8. **The arc on a chapter ruler**, with the connected arc under it and a key.
9. **A margin mark** in the manuscript where a passage is already linked.
10. **The filter bar** and traits that collapse to a row with counts.
11. **Search across all characters.**
12. **The restyle**: the header with its pills, the tokens, the type.

## 4. Build order

Each stage ships on its own.

1. **The record**: role, background, the writer's own fields; the Overview
   rebuilt around them.
2. **At a glance and Up next**, both readings.
3. **Traits & Moments**: the filter bar, the collapsing cards, the counts,
   `conflictsWith`, `found`.
4. **The Story panel** and its drag-to-link.
5. **The arc**: the shape toggle, the chapter ruler, the connected arc, the
   key.
6. **Relationships**: the stages timeline, and the map's chrome.
7. **The margin mark**, and search across the cast.
8. **The restyle**, and a sweep of the module's vocabulary to *moment*.

## 4a. What each built stage does

**Stage 1 — the record.** `role` (six chips offered, free text underneath),
`background` behind a fold marked optional, and the writer's own fields as a
**list rather than a map**, because the id is what makes a rename an edit.
Migration 0053. *Notes on their journey* moved to the Arc tab, where it stands
whether or not there is an arc — the case addendum 08 §4 keeps it for is the
character who has not got one.

**Stage 2 — at a glance, and up next.** `character-glance.ts`, and **neither
stores a thing**: a bar written down would go on saying *7 used* after the
scene was cut, and a to-do list written down would go on asking for something
already done. `characterGlance` is the counts, the arc as a line of marks
(placed first, in the story's order, then what is waiting) and everybody this
person is joined to, once each. `upNext` is the same readings said as work:
*3 ways to show "Secretly sentimental" are still on deck · Place one*.

Three decisions. **It names the trait rather than counting across all of
them** — *5 on deck* over four traits tells a writer nothing about where to
go. **It offers and never warns** (addendum 08 §7): a character with things
on deck is in the middle of the work rather than behind on it, and a line in
red would be telling them off for planning ahead. And the empty card **says
so out loud**, because a blank box looks broken.

The two buttons are **routes to readings that already exist**: *Review in
story order* and *Unused material report* are the Character review's own
modes, filtered to the person they were pressed from, rather than reports of
their own. And `castColours` came out of `story-threads.ts` so the avatars,
the timeline and the threads cannot disagree about anybody's colour — which
is why the handoff's stored `avatarColor` is not built.

**Stage 3 — traits and moments.** The filter bar, whose **figures are the
whole character's whichever tab is pressed**: those numbers are what the
writer is choosing between, and a bar whose own figures changed as it was
pressed would be unreadable. Under a narrowing filter a trait with nothing
left **drops out** — a card over nothing, on a screen that was asked what is
on deck, is a card about a question nobody asked — while under *All* every
trait stands, the empty one included.

**Red counts on every trait row**, which is §1's *unused material is always
visible as a to-do list*. **`found`** marks a moment that came out of the
manuscript: not called `origin`, which means *who made it, in a room*, and a
fact about provenance **never a status** — a planned moment and a found one
are used or on deck by the same rule. And **`conflictsWith`**, the handoff's
*pulls against Miserly*: the spec asks for contradictory traits to be
allowed, and allowing them is not the same as being able to say so. It is
**said once and read both ways** — written on the trait it was said from,
read by `conflictsFor` from either — because storing the pair on both would
be two records of one fact, free to disagree the moment one is edited.
Migration 0054.

**One place this diverges from the mockup, on purpose.** Screen 02 draws the
traits as one column of expanded cards. The built screen keeps the shelf it
has — the list of traits beside the chosen one's moments — because that panel
holds more per trait than the card does (*When*, *How much of them*, *Read
as*, and the *Where* panel that says which scenes a moment landed in). What
the mockup is *for* — the red counts always in front of you — is delivered on
every row of the list. The one-column stack is a layout preference and is
stage 8's to weigh.

**Stage 4 — the Story panel.** The scenes down the right of the Traits tab,
as somewhere to put a moment. **Nothing about it is stored**: which scenes
somebody is in is read off the cues every time — `castCalled`'s rule, so
MARABEL's lines are not MARA's — and what is pinned where off the usage
links, so writing a cue lights a row with nothing run and cutting one puts it
out again. A row is **dimmed and never dropped**: a scene they are not in is
exactly where a writer may be about to put them, and it says *not in scene*
rather than leaving the dimness to be read.

Three decisions. **The division is carried forward** — a marker sits on the
scene a chapter opens on, so reading it per unit labelled the first scene
*Chapter 1* and left every other scene in that chapter blank, which is the
question the column exists to answer; it is `divisionSpan`'s rule pointed at
a list, the nearest marker at or before. **A drop lands on the scene's first
beat**, because a scene is what a writer points at and a beat is where the
link lives — and a scene with no beats at all **takes no drop**, a link with
nowhere to anchor being one that would be broken the moment it was made.
And **only what is waiting is carried**: a moment already in the writing is
not draggable, there being nothing to place.

It is `carry-work.ts` unchanged — addendum 08 §13's MIME type of its own, so
dragging a line of dialogue inside the manuscript is left entirely alone —
and the drop runs the same `pinUsage` as the Where panel and the Inspector's
on-deck queue. **A third way in, not a third answer.**

## 5. Deliberately not built

§21's AI-assisted suggestions. The handoff does not ask for them and the
spec puts them in a future version.
