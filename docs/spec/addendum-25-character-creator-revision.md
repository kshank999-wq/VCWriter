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

## 5. Deliberately not built

§21's AI-assisted suggestions. The handoff does not ask for them and the
spec puts them in a future version.
