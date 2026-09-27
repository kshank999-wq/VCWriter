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
9. **The one-column card stack** (§4b), from Ken overruling stage 8.

## 4a. What each built stage does

**All nine are built.**

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

**The shelf this stage kept is gone.** Screen 02 draws the traits as one
column of expanded cards; stage 8 weighed that against the shelf — the list
of traits beside the chosen one's moments — and kept the shelf, because the
shelf held four controls per trait that a card did not. Ken overruled it, and
§4b is the stack built to the mockup. The correction is recorded there,
because it is the part worth keeping: **that was an argument about where the
controls go, dressed up as an argument about the layout**.

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

**Stage 5 — the arc.** `character-arc-graph.ts`, the shape toggle, the
chapter ruler, the connected arc and the key. §2's decision arrives: the
toggle stores an **intention** (`intent` on the arc, migration 0055, nullable
because *not said* is a third state), `arcShape` goes on reading the points,
and **nothing consults the intention to decide the shape** — so the head
carries three chips, then the reading after a rule, and the reading is
deliberately not a fourth chip, a button beside the three saying it could be
pressed. `describeArcDisagreement` is **said only where they part**: a note
appearing the moment somebody chose an intention would be scolding them for
having a plan, an arc with no points has no shape to compare, and where they
do disagree it **states both and picks neither**, because either could be the
one that is wrong and software does not know which.

The graph is readings all the way down. **The ruler is the divisions where
there are any and the scenes where there are none** — a script with no acts
still has a spine, and a ruler labelled with nothing is one nobody can read a
position off. **Where a mark stands is the scene it is pinned to**, so moving
a scene moves the mark; **which division it falls in is carried forward** from
the nearest marker at or before, `divisionSpan`'s rule a second time in this
addendum, which building it caught — asking per unit named the chapter for its
first scene and left every other point in it blank. And **how high it stands
is addendum 13 §1 one module over**: a setback goes down because *setback*
means down, the word is the record and the height exists so there is something
to draw. No number is shown, asked for or typeable, **one mark makes no claim**
(it sits in the middle rather than being drawn at the top for the arithmetic's
sake), and *on deck* is **not a position of zero** — unplaced and at-the-start
are different things.

The arcs joined to this one are **read from the links**, so cutting the last
one takes the row away; each is drawn as a **level line rather than a second
curve**, that row being about *when* the other person's moments fall against
these and two curves inviting a reader to compare heights each normalised
against its own arc. And the key reads the same tables the marks do, a list
written out beside the drawing being a second answer to what a shape means.
*Open their arc* is `onOpenCharacter`, **absent rather than greyed** where the
Creator is opened somewhere with no cast to move through — and it opens them
**on the Arc tab**, which driving it caught: a button reading *Open their arc*
that lands on their Overview is a route that does not do what it says. Driving
also caught labels sitting on the rising line, fixed with `paint-order:
stroke`, the only way to cut a hole in a path for type without knowing where
the path goes.

**Stage 6 — relationships.** The steps and the map. There was one free-text
`evolution` — a paragraph about how a relationship develops — and the handoff
asks for the thing that paragraph is trying to say: a sequence of states, each
anchored to a scene, drawn as a strip.

**The paragraph stays, as the older spelling.** It is what a writer typed, and
replacing it to make room for a better shape would lose their words for a
reason nobody asked for; where there are steps they are what the screen shows,
where there are none it stands, and taking the last step away brings it back.
One answer at a time — `template`/`layout`'s rule (addendum 20 §14) pointed at
content. **A step is anchored to the scene and never to a chapter number**
(migration 0056, JSON in the row by a location's prepared descriptions'
precedent): the chapter it falls in is read from where that scene falls —
**the nearest marker at or before**, `divisionSpan` a third time in this
addendum — so there is nowhere to type *Ch 7* and moving the scene moves the
step. And **a step with no scene is planned rather than placed**, listed after
what is placed, which is `arcBoard`'s split for its own reason: once a step is
anchored the manuscript decides where it falls, and a control that let
somebody drag it above an earlier one would be a control that lies.

**The map is the map.** `CharacterMap` itself is rendered beside the list —
the same component the Research menu opens, given an `initialFocus` — rather
than a second drawing, so the two can never disagree about who is joined to
whom; and it is an **opening state rather than a fixed one**, the writer being
free to focus on somebody else from its own bar. Pressing a person there opens
them **plainly**, on whatever tab they were last left on (addendum 08 §11),
where stage 5's *Open their arc* names a tab because its label does —
`onOpenCharacter` takes the tab as an argument so the act decides rather than
the route. Driving it caught the placement fault: `.charmap` is `flex: 1` with
its canvas `min-height: 0`, which is right in a room of its own and draws a
thousand pixels tall in ordinary flow, so the section gives it the height it
expects.

**Stage 7 — the margin mark, and search across the cast.**

`passage-marks.ts` is the mark, and the decision is that **the ask is the
Character Creator's and the reading deliberately is not**. A mark that showed
characterization and nothing else would stand beside a paragraph carrying a
theme, an index heading and a promise while saying nothing about any of them —
a mark that lies about what it means. `usage_links` has been the polymorphic
anchor since the Character Creator was built and four modules since have
widened it rather than adding one of their own, so **one reading answers for
all of them** and a module built next month is marked the day it anchors to an
element; the book index is one more reader here rather than a second answer,
being its own table because a mark carries a heading the writer typed.

Three rules. **Nothing is stored**, so cutting the passage or taking the pin
off takes the mark with nothing run. **A beat-wide pin is not marked** — a pin
with no `elementId` means *somewhere in this scene*, which is a real answer,
and putting its mark on the first paragraph would invent a position the writer
did not give. And **every mark is named rather than counted**: *Character:
Silas Crane · Miserly*, because the whole point of a margin is being able to
tell without going anywhere. A buried character's work is unmarked, the margin
being a list (addendum 24 §5i).

**The search across the cast is the audit paying again.** `reviewRows` with no
`characterId` has searched the whole cast since addendum 08 stage 10, matching
the work, its trait's name and the person's — and the research search, whose
box says *Search titles, notes and tags*, meant it: a writer who typed *coal
tongs* found nothing, though it is a moment under Silas's Miserly trait. So
this is a **second reader of one reading** rather than a second search, shown
where the search already puts things, **absent rather than empty** where
nothing matches, and capped at twelve because a search returning two hundred
is one nobody reads. Pressing a row opens that person on the tab the work
lives on.

Driving it caught the placement: the right gutter was tried first — a
statement about the line on the opposite side from the control that changes
it — and measuring killed it, the manuscript's side column ending at 425px
with the mark landing at 421, under the divider. The left gutter is the one
this room reserves.

**Stage 8 — the module says *moment*, and the header the handoff draws.**

The handoff's own decision — *a moment in the interface, a
`CharacterizationItem` in the data* — because the word a writer uses and the
word the schema uses answer different questions. So the tab is **Traits &
Moments**, the box is *The moment*, the button is **+ Moment**, the
manuscript's right-click says *Make this a character moment…* (with a note
under it saying what a press would do, which is §6b's own item shape), and
the readings say *3 moments for "Miserly" are still on deck*. Nothing in the
data moved.

What makes it worth a **test** rather than a rename is addendum 16 §6c's
lesson: seventeen components still said *Scene* after the noun table existed,
each having written the word itself. `creator-vocabulary.test.tsx` walks the
whole rendered screen on every tab, **attributes included**, and asserts the
older words are nowhere on it — `class` excluded, a class being a name for a
box rather than a word about the work.

Writing that test found the restyle's one real fault: **the tabs were a `nav`
of buttons carrying `aria-current="page"`**, which announces *the current
page* about something that is not a page, so a reader was told four links and
which one they were on rather than a set of tabs and which is showing. It is
a `role="tablist"` of `role="tab"` with `aria-selected` now — §4a's switch
argument, the same statement the ink makes made to a screen reader. And the
header gained **the avatar the handoff draws**, whose colour is `castColours`
(§2: read, never stored, so a new character arrives with one) and whose
initials are a reading with nowhere to type them; it is a **ring rather than
a disc**, a filled circle in somebody's colour competing with the name beside
it.

**The one-column card stack was weighed here and refused**, which §4a said
this stage would decide — on the ground that the shelf held four controls per
trait a card did not, so rebuilding it as cards would trade those controls
for a layout. Ken overruled it the same day, and he was right: §4b is the
stack, and the refusal above is left standing because the correction is more
useful than a tidy record.

## 4b. The one-column card stack

**Stage 9.**

Every trait is a card, one under the next, with its moments inside it: the
handoff's screen 02, and what stage 8 declined to build. The overrule is the
part worth writing down, because the argument that lost was not wrong about
its facts. The shelf really did hold *When*, *How much of them*, *Read as*
and *Pulls against*, and a card head really cannot carry five form fields
nine times over. What the argument got wrong is that **those are two
questions**: *what layout does the screen have* and *where do a trait's
settings live*. The handoff had already answered the second — it draws a ⋯ on
every card head, for exactly them — so the controls were never the price of
the layout. **An argument about where the controls go, dressed up as an
argument about the layout.**

What the stack buys is the thing the mockup exists for, and the thing the
shelf could not do at all: **every trait's red count, and every trait's
moments, on the screen at once**. On the shelf the counts were a column of
numbers you pressed one at a time to read behind; here a writer reads down
and sees what the whole character still owes.

Three decisions hold it. **A card is open by default and folding is about
this minute** — nothing is stored, the Layout rail's rule (addendum 20 §9h),
so a writer with nine traits closes the seven they are not working on and
comes back tomorrow to all nine. **A head's counts are the whole trait's**
whatever the filter bar is showing, which is `filterBoard`'s own rule about
the bar pointed one level down: a card reading *1 on deck* because the bar
was set to *On deck* would be telling you what you had just asked for. And
**the unfiled pile is absent where there is nothing unfiled** — it is a pile
of things caught while writing rather than a folder anybody files into, and
the only route to it, the Overview's *File them*, appears only when there is
something in it, so nothing is ever sent somewhere that is not there.

The old `Shelf` state survives with a changed meaning, and the rename is the
point: it was *which trait is showing*, and in a stack every trait is
showing, so it is now a **destination** — the Overview's *Place one* and the
rail's rows name a trait, and naming one opens that card and brings it into
view. It is cleared the moment it is honoured, or a card that had been
routed to could not be folded again.

Driving the real room caught three things 727 green tests could not, and the
third is the one worth keeping. In a narrow column the `found while writing`
badge is `nowrap` and the words were `min-width: 0`, so at 1280 a row read as
a single letter beside the badge — **a badge about a moment standing where
the moment should be**; the badge wraps under the words now. The *why it
matters* field was a full-width box, which was one box on the shelf and nine
down the stack, so it is a line of italic prose that draws its box when it is
typed in. And **`.empty-state` is 48px of padding and a centred sentence** —
right where it fills a column, absurd where nine of them stack: nine traits
nobody had written under yet drew a page and a half of *Nothing shows this
yet.* So the sentence is **gone rather than shrunk**: the head's `—` already
says the trait is empty, and what an empty card needs is the way to fill it.
Its placeholder does the saying, and says *what shows it* rather than
*another* — there is no other one yet.

`creator-stack.test.tsx` pins the shape rather than the styling: nine traits
draw nine cards, a card's moments are on the screen without anything being
pressed, folding takes the moments and keeps the head, a head's counts
survive the bar narrowing the rows, a card with nothing left under a
narrowing filter drops out, and **all four of the shelf's controls are still
reachable behind the ⋯** — which is the thing the overrule was about, and so
the thing a test has to hold.

## 5. Deliberately not built

§21's AI-assisted suggestions. The handoff does not ask for them and the
spec puts them in a future version.
