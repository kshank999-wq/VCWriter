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
10. **What the record is called, and the left-hand list** (§4c), from Ken.
11. **The cast that would not appear** (§4d), from Ken's bug report.
12. **The arc as a line you fill in** (§4e), from Ken.
13. **The arc line before there is an arc** (§4f), from Ken asking twice.
14. **The line that fits the pane** (§4g), from Ken asking a third time.

## 4a. What each built stage does

**All fourteen are built.**

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

## 4c. What the record is called, and the left-hand list

**Stage 10**, from Ken in one message: five things renamed, and the cast
listed under its types on the left.

The renames are his words and there is nothing to argue with in them, but two
of the five turned out to be about more than a label.

**Character type** was *How much of the story*, which **describes the question
and never names the answer**. The control has always written `categoryId` —
the heading the cast is grouped by in the research menu, which `castByCategory`
has read since the categories were built — so a writer who picked one was
filing somebody under a heading on the left, and nothing on the screen said
so. It is the audit paying a **twenty-second** time, in the form this project
keeps meeting: the mechanism was built, general and correct, and narrow in
vocabulary. Ken's *main character, minor character, extra character* are what
a new project now seeds, singular, because **one of them is what a person
*is*, not a shelf they are on** — *Main character* is a sentence about
somebody where *Main characters* is a label on a drawer — and *Extra* is the
trade's word for what was called *Background*.

**An existing project keeps its own headings**, which is not an oversight but
the rule `defaultCharacterCategories` has carried in its own comment since it
was written: they are the writer's, and a heading appearing in a finished
script because the software changed its mind would be the software
rearranging somebody's cast. They are renamed by hand in the cast panel.

Renaming them found the fault worth keeping: **the four names were written
down twice.** The importer's `headingFor` files an imported cast by *naming*
the heading it wants — deliberately, so that arithmetic on how many headings
there are cannot silently refile a tier — and it held its own copy of the
strings. So renaming the defaults left the importer asking for headings that
no longer existed and quietly filing everybody under the last one. Four tests
caught it, which is the only reason it is not still true, and `CHARACTER_TYPES`
is the one list now. A test helper made it worse and has been fixed too: `cast`
filed under `null` when it could not find the heading it was given, so three
episode tests failed as *mysteriously empty casts* rather than as a fixture
saying what was wrong with it. **A fixture that cannot find what it was asked
for throws.**

The other four are labels and stay labels: **Character description** for the
fold that was *Background & look* and for the `look` field inside it,
**Backstory** for `history`, **Links** for `tags` (`tags` in the data, which
nothing moved). Two neighbours are worth naming rather than quietly leaving:
*Links* is also what the research menu calls story threads, and *Character
description* now sits under the *Who they are* box, which is the prose one.
Both are Ken's words and both are one edit to change if the neighbour turns
out to matter.

**The left-hand list is the one that was already there.** The research menu
lists the cast and has grouped it under its headings since §8b; what it could
not do was say so, because the heading was drawn only where there was more
than one group — so a cast filed entirely as main characters said nothing
about being one. A **second** list of characters inside the Creator was
considered and not built: it would stand an inch from the first, which is the
fault addendum 20 §9u had just finished removing from the Layout room.

Driving it caught this stage's own fault, and it is the shape of the rule
rather than a slip. The first draft drew a heading over every real type and
none over *Not filed*, since that names nothing — and **a group with no
heading takes the one above it**, so Victor Marsh, whom nobody had typed, sat
under BACKGROUND CHARACTERS reading as one. It is all of the headings or none.

**The rail is headed *Characterizations***, which is Ken's word and is the one
place §8's sweep to *moment* is deliberately not applied. It is not a
reversal: the tab is about a **trait** and the moments filed under it, where
*moment* is exactly right, while the rail is everything that characterizes
somebody — those moments, the arc, the notes — and no one of them is a
moment. `creator-vocabulary.test.tsx` strips the rail and asserts the older
word is nowhere else, so the sweep still holds over every screen it was
written about.

## 4d. The cast that would not appear

**Stage 11**, from Ken: *the characters that are in the script are not
recognized… and I added two new characters and neither of them show up.*

**The second half reproduced exactly, and the cause is one line.**
*+ New character* asked for the name with `window.prompt`, and **Electron does
not implement one** — it writes *prompt() is and will not be supported.* to a
console no writer ever sees and returns nothing. So on the desktop build the
button did nothing at all, silently, every time. It survived because it works
perfectly in the browser preview, which is where it was driven.

The rule it breaks is the one the rest of the room already follows: **an act
asks for what it needs where it stands** — a folder, a trait, a story and an
order are all named in a field on the row that makes them. `NewCharacter` is
that field: the row *is* the act until it is pressed, so the menu carries no
box nobody is using, Escape and an empty blur put it away, and Enter makes
them and opens them in the Creator. The copyright page's *Save as preset…* had
the same fault and is fixed in the same change. **There is no `window.prompt`
left in the program**, and the test throws if anything reaches for one, which
is the only way this cannot come back: a prompt works in every environment a
test runs in.

**The first half did not reproduce.** Driven through the real readers, a Final
Draft script and a PDF laid out at ordinary screenplay geometry both give up
their cast and file it — the first probe that said otherwise was a fixture
written in inches where the reader wants points, which is worth recording
because it nearly became a bug report about working code. So rather than guess
at which reader failed on a file nobody here has, the answer is the one that
works whatever went wrong: **the script still says who speaks**.
`cuesWithoutCharacter` has answered *which names speak and have no record*
since addendum 08 stage 13, and `notedCast` has filed them since long before
that; what was missing was anywhere to press. *+ Add 3 names from the script*
now stands under the cast in the research menu, **absent the moment there is
nobody left to add** — a reading, so it cannot offer what it would not do, and
it says how many rather than promising something vague.

There is a third thing in the report worth naming rather than fixing: *they
don't show up under the character folders*. The cast is under **Character
Creator** in the menu, while **Folders ▸ Characters** is a research shelf for
notes and will always read 0 for a cast. Two things called Characters in one
menu is a fair complaint, and it is left standing for now because renaming
either one reaches further than this fix should.

## 4e. The arc as a line you fill in

**Stage 12**, from Ken: *under the arc, that is going to be like a timeline
view — where the character begins as a box you could fill out, and by default
the end of the character arc, what the character becomes. Then you can double
click on the line and it will create another point… and you can also click
into that box and add a link, so you can link it to the script or to a theme
or a motif.*

**The audit paid a twenty-third time, this one inside the record itself.**
`beginning` and `ending` have been fields on `characterArcSchema` since the Arc
Builder was built — which is exactly *where they begin* and *what they
become* — and the moments between them are `arcPoints` in their order. None of
what Ken describes is new data. What was wrong is that the tab drew it as **two
loose textareas with the whole spine stacked between them**: the same
information, arranged so that nobody could see it was a journey.

**The line between two boxes is the act.** `addArcPoint` appends, which is
right for a form at the foot of a list and useless for a gesture that means
*here*, so `insertArcPoint` takes an index and the key is worked out between
the neighbours the way every other ordered thing in the program is placed. A
gap is a real button as well as a double-click target, which is also the only
way the keyboard reaches a gesture described with a mouse.

**Driving it settled the one real design question, and the first answer was
wrong.** Ordered `arcBoard`'s way — everything in the writing first, then what
is still on deck — double-clicking between the first two boxes put the new
moment **at the far end**, because a moment nobody has written yet sorts after
every one that is. A gesture that means *here* and lands somewhere else is a
gesture that does not work. So this is the one place the module keeps two
orders on one screen, deliberately: **the line is the writer's arrangement and
the lists below are the manuscript's**, because *what is the shape of this
journey* and *how far along is it* are two questions. Each stop still carries
the board's answer — its colour, and the scene it is pinned in — so the
manuscript's reading travels with a stop rather than deciding where it stands,
and there is still nothing to drag on the line.

**A link hangs on a moment and never on a state.** *Who they are at the start*
is a condition rather than an event, and a link from it would be a link from
the whole character — so the two ends carry no link control and **say why**,
rather than leaving a writer to press at them and conclude it is broken. What a
moment can be joined to is the script, a theme or a motif, which needed
**`theme` and `motif` to join `storyEntityTypeSchema`** — the fifth time that
list has been the whole answer, after `arc_point` and `thread_node`: two
references and a verb is what a story link has been since spec §7.4, so there
is no table, no migration and no second kind of link. They stay **two entries
and never one**, which is Themes & Motifs' own rule (addendum 12 §2). A link
to something since cut keeps its row struck through rather than vanishing,
because the writer put it there.

The graph stage 5 built is **kept and moved below the line**, and the order is
the argument for having both: a writer arranges the journey on the line, and
the graph reads the result back — its heights and its chapter ruler are a
reading of the same points, never a second place to put one.

## 4f. The arc line before there is an arc

**Stage 13**, from Ken sending §4e's request again **word for word**, with
nothing changed and nothing added. In this project that has meant one thing
four times now — §15c, §16b, §16c and §4d — and it meant it again: the
feature was built, and something stood between the writer and it.

Driving the room found the something exactly. Every character in the fixture
was opened in turn, and for **Tomas Hale**, who has no arc record, the Arc tab
drew a sentence and a **Start an arc** button, and `.arc-stop` returned `[]`.
There was no line on the screen at all. And since **every character starts
without an arc**, that was not an edge case: it was the only state most
writers ever meet the tab in. §4e's timeline was absent from the one screen it
had to be on, which from Ken's chair is indistinguishable from it never having
been built — so he described it a second time in the same words.

**No arc yet is not no line.** `arcTimeline` returns the two ends whether or
not there is a record: a character with no arc still begins somewhere and
still becomes something, so the two boxes are the arc rather than things on
it, and they read empty. The gap between them is the same gap, and
double-clicking it does the same thing.

**Nothing is created to draw it.** `beginArc` has been idempotent since the Arc
Builder was built — it returns the existing arc where there is one — so it
doubles as *ensure*, and it is run at the first act rather than at the first
look: typing into *Begins*, or putting a moment in the line, makes the record;
opening the tab makes nothing. A cast of forty extras still carries no arc
rows. That is how addendum 08 §9's **never require an arc** is kept, and the
distinction is the whole of the stage: that rule is about **not making a
record**, and it had been read as *not showing what one is*.

**The Start an arc button is gone rather than kept beside it.** The line is the
way in, and two ways to start are two answers — the module's own rule about
two controls for one act, which §5d had just applied to a delete. The sentence
it stood next to stays, as a quiet line under the strip: *most characters do
not need an arc — it is for somebody the story changes, or offers a change and
watches refuse it. Nothing is kept until you write in it.* That last clause is
the promise the mechanism keeps.

Driving it again, with the line drawing, found two more faults that no test
could see, and both are one rule.

**A placeholder names the question rather than answering it.** §4e had put an
example sentence in each end — *Keeps score. Money is the only measure she
trusts.* and *Counts faster.* — which on a dark screen sat close enough to the
reading colour that a writer opening the tab saw **two filled boxes**, and
which named a pronoun, so a character with no arc opened on somebody else's
sentence about *her*. They say *Who they are when we meet them* and *Who they
are by the end*, which is Ken's own two questions. The `+ Point` field one
control down had the same fault (*She is offered the money back*) and says
*What happens*.

**The notes box moved under the line.** *Notes on their journey* was the first
thing on the Arc tab, which was harmless while the line only drew for a
character who already had an arc and is not now that it draws for everybody: a
tab opening on a four-row free-text box says an arc is a paragraph, which is
the arrangement §4e was built to replace. The line first, then what it says in
words, then the notes.

## 4g. The line that fits the pane

**Stage 14**, from Ken sending §4e's request a **third** time, word for word
again. §4f read the second sending as this project's usual signal — a feature
built and something standing in front of it — and fixed a real one. It was not
the whole of it, because **both earlier readings were about the plumbing and
the ask is about the picture**: *that is going to be like a timeline view*.

Driving it found no route fault this time. From an empty cast: *+ Add 1 name
from the script*, press the name, press **Arc** — tabs, stops, gaps, all there.
So the screen was measured instead, and the measurement is the report.

On a character with five moments, in a 1700-wide window:

    .arc-line-track   x=278  width=944
    stop 0            x=280   … stop 6  x=1612 width=176
    .creator-body     ends at x=1700

`.arc-stop` was a **fixed 176px** in a `flex` strip with `overflow-x: auto`, so
seven stops ran 1508px through a 944px track. The last two moments **and
*Becomes* itself** were off the right-hand edge of the screen, behind an
overlay scrollbar that draws nothing until the pointer is already inside the
strip. The one thing Ken names twice — *by default, the end of the character
arc* — was not on the screen. And with only the two ends, the same fixed widths
huddled them into the left third of the pane with a **46px** dash between them:
two cards and a hyphen, which is not a line and not a timeline.

**A timeline fits the space it is given.** This is addendum 15 §15's *whole
story means the whole story fits* and addendum 20 §9e's *the size that fits is
a reading*, arriving in a third room — and it is the same fault each time, a
fixed number where a share of the measure belongs. A stop is `flex: 1 1 0` with
a floor of 110px and a ceiling of 220px, so it never grows into a slab and
never shrinks past legible; a gap is `flex: 1 1 auto` and **takes what the
stops do not**. Measured again, the seven stops end at 1220 in a track ending
at 1222, and with two stops *Begins* stands at one edge, *Becomes* at the
other, and the line runs the width of the pane between them.

That second half is not decoration: **the line is the gesture**. Double-click
*on the line* is a real act when the line is half the pane and a joke when it
is 46px, so making the line long is the same change as making the act
reachable. The `+` on it is faint rather than invisible for the same reason —
over 46px a hover-only mark was survivable, over half a pane it is the only
thing saying the line can be pressed.

**Where it must scroll, it says so.** Past about six moments on a laptop even a
legible floor will not fit, and there is nothing here to zoom; that is stated
rather than hidden, with a thin scrollbar instead of an overlay one, and the
chosen stop is brought into view — addendum 18 stage 4's own fix (*a card the
designer had just made was off the screen*) on another board whose arrangement
is likewise not the writer's to drag.

Two things came out of building it.

**A host is asked rather than assumed.** The new `scrollIntoView` threw in
jsdom, and an effect that throws takes the whole tab down — a worse failure
than a stop that stays put. The room already had the answer in two places
(`NarrativeMapWindow` and `StoryView` both test `typeof … === 'function'`) and
**two newer copies had not asked it**: this one, and §4b's own card scroll from
the week before, which survived only because its key is usually null. Both are
guarded now. It is the *second answer* argument pointed at a browser API.

And the lesson over the three sendings, which is the part worth keeping:
**when the same words come back a third time, stop reading them as a report of
a broken mechanism and read them as a description of a picture.** §4f's rule
was *a route is not a field*; this one is that **a repeat is not always a
regression** — twice it named something unreachable, and the third time it
named something reachable that did not look like what was asked for. The
measurement is what separated them, and nothing else would have: every test was
green through all three.
