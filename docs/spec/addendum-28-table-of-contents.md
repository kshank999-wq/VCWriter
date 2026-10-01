# Addendum 28 — The table of contents, and notes filed under it

From Ken, for the instructional book:

> In the instructional book section, there needs to be a table of contents. So
> where you can define all your chapters ahead of time and add chapters as you
> go. That will create chapters on the timeline as you create those. And in the
> notes section, you need to be able to drop notes into those areas. So you have
> a table of contents that you fill out that also populates the research
> section. So when you bring in some rough notes, you can divide it into those
> sections without dropping it in as beats, but it'll show up in the research
> section under those defined chapters. And it'll tell you, like in a
> screenplay, if you used that note or not… in the research section, as you do
> your table of contents and as you add them, the research section on the top
> will have table of contents and it will list them in boxes. So when you select
> that, and you put anything in the notes section, you can just drop it in and
> it'll show up in the research section. Then in the outliner, those beats that
> you put in with subsections will show up as beats in the timeline under that
> chapter and section.

And, a minute later:

> Also for chapters, you need a title of the chapter. In the dialog box so when
> you create a chapter in the table of contents you will need to eventually put
> a title of what that's about and that will be separate from the actual chapter
> name so for example chapter one Mathematics, and then you have the subsections
> division, multiplication, addition, subtraction, as subsection 1.1, 1.2, 1.3,
> etc.

## 1. The audit, and what it paid

**The twenty-sixth time**, and it paid most of the structure.

| What the ask names | What it already is |
| --- | --- |
| A chapter | A `chapter` story marker (addendum 19 §1) |
| *Chapter One* | Derived from where the chapter falls (addendum 02 §12a) — nowhere to type it |
| *Mathematics* | The marker's `title`, typed |
| *what that's about* | `page.summary` on the marker (addendum 19 stage 4) |
| *1.1, 1.2, 1.3* | `structureNumbers`, stored nowhere (addendum 16 §15) |
| Defining chapters ahead of time | The Outliner's Chapter row (addendum 19 stage 1) |
| A note becoming a beat | `addResearchRow` → `promoteRow` (addendum 06 §5) |

So Ken's second message is **already built**, and the answer worth giving back
is that there are *three* things rather than two: the number (derived), the
title (*Mathematics*), and what it is about (the summary). The example runs
exactly as he wrote it — measured on a fixture, the shelf reads `1 Mathematics`,
`1.1 Division`, `1.2 Multiplication`, `1.3 Addition`, `1.4 Subtraction`.

**Where the table of contents lives was the one real question**, and Ken chose:
the Outliner is it. That is the right answer for the room's own reason — a
second screen that defined chapters would be a second answer to what this
book's chapters are, which is the fault addendum 20 removed twice (§15c, §9u).
So the research room's table of contents **defines nothing**. It reads.

## 2. What was missing, and the fault it found

Two things: **a note could not name where in the book it belongs**, and **the
research room had nowhere to show that**.

And one fault, which is the more important half. `usage`, `usedAt`,
`usedInBeatIds` and `usedConfirmed` have been on a research item since 0001 and
**nothing has ever computed them** — `markResearchUsed` sets a flag by hand.
So a note went on reading *used* after the beat it fed was cut, and read
*unused* the moment it was really written unless somebody remembered to press
something. Ken asked for the light *like in a screenplay*; the screenplay side
has had the right answer since the Character Creator was built (addendum 08 §2:
*used is a reading, never a stored flag*), and research had the wrong one.

### The record

`place` on a research item: **one `StoryEntityRef`**, naming a chapter or a
section. `story_marker` joins `storyEntityTypeSchema`, the **sixth** time that
list has been the whole answer (after `arc_point`, `thread_node`, `theme`,
`motif`) and the first time it is a *place in the book* rather than a thing in
the story. It is not called `chapter`, because the record is a story marker —
an episode in a series and a story in a collection too, which is why addendum
22 §7a renamed `chapterSpan` to `divisionSpan`.

Migration 0064 is two columns and no table, `story_links`' own shape
(`place_type` text, `place_id` uuid), with **no foreign key**: a note pointing
at a deleted chapter reads as unplaced by itself, where a cascade would
silently rewrite the writer's filing.

### Three rules

**A place is a reference and never a folder.** A folder named *Chapter 3* would
be a second record of one fact — rename the chapter and it says the old name,
move it and it does not follow, delete it and it is an orphan holding notes
about nothing. It is addendum 09 §12 in the other direction: there a spoken
group is a word on the note and never a folder, here a chapter is a place in
the book and never a shelf beside it.

**One place, and the chapter above it is a reading.** A note under section 1.2
is under chapter 1 because that is where 1.2 falls, so moving the section moves
the note with nothing run — `divisionSpan`'s argument, which addendum 25 leaned
on three times.

**How far along a note is, is read.** `noteProgress` gives three lights, which
is Ken's choice and the better one for a textbook: while a book is being
planned most notes sit in the middle for weeks, and a red light that never
moves stops being read — the validator's *not crying wolf* rule (addendum 18
stage 3) pointed at a colour.

- **unfiled** — nobody has decided where it goes.
- **planned** — filed under a chapter or section, or an outline row references
  it, but nothing in the manuscript has come from it.
- **written** — a beat that **still exists** came from it.

`usedInBeatIds` is honoured as the older spelling, filtered through the beats
the project actually has. That filter is the whole fix, and a test asserts it:
the stored flag still says `used` and the light no longer does.

## 3. The screen

**Table of contents**, first in the research side menu, on an instructional
book alone — absent rather than greyed elsewhere, a screenplay having no
chapters to file against. The chapters are drawn as **boxes** (Ken's word and
the right shape: a box is something you can aim a note at, where a column of
text reads as a menu), wrapping rather than scrolling sideways for the Note
Sorter's reason — you cannot drop a note onto a box that is off the screen.

Dropping a note on a box files it there. `filingOffer` says what the drop would
do before it can be asked for and `fileNoteUnder` refuses the same things again
— `trackRemoval`'s shape. A note has one place, so a second drop elsewhere is a
**move** and says so. The note **keeps the folder it is in**: where in the book
and which shelf are two questions, and answering the second would lose the
writer's own filing.

There is **no *+ Chapter*** here, and a line says where they come from.

### What driving it caught

Four things, and all four are this project's own lessons in a new place.

**The title was said twice** — the room's header already names the selection,
so the panel's own `h3` was a second copy on one screen.

**The room's note count contradicted the boxes**: it counts the *folder's*
items, so beside boxes reading 1 note each it drew `0 notes`. The room already
suppresses that figure for panels that are not folders; this is one.

**`1.1. Division` has a stray dot.** Books set a chapter with a full stop and a
multi-level number without one: *1. Mathematics*, then *1.1 Division*.

**A screen reader heard `1Mathematics`** — the number and the title are two
elements with only a CSS gap between them, and a gap is not a space. The box is
named by `describeContentsRow`, the one sentence that names a row, so what is
said aloud and what is drawn under the boxes cannot disagree.

## 4. Where the code is

| | |
| --- | --- |
| The module | `packages/domain/src/chapter-notes.ts` |
| The record | `place` on `researchItemSchema`; `story_marker` in `entities/links.ts` |
| The screen | `apps/desktop/src/renderer/components/ContentsPanel.tsx` |
| The way in | `ResearchWindow.tsx` — `selection.kind === 'contents'` |
| The table | `packages/supabase/migrations/0064_note_place.sql` |
| Sync | `sync-mapping.ts` — `place_type`, `place_id` |
| The chapter's page | `ChapterPageDialog.tsx`, opened by the room (§4a) |

## 4a. The way through to a chapter's own page

Ken sent §1's second message **three times, word for word**, which in this
project has meant one thing five times now (addendum 20 §15c, §16b, §16c,
addendum 25 §4d, §4f). Driving it named which of those it was.

**Everything he asked for was there and none of it was reachable from where he
asked for it.** On a textbook `File ▸ Chapter page…` is present
(`hasChapterPages` is `isProseFormat || series`, and `isProseFormat` takes
`instructional`), and its dialog offers exactly the three things his sentence
separates — measured on Ken's own example:

| What he said | What the screen calls it | Where it comes from |
| --- | --- | --- |
| *chapter one* | **Show Chapter 1** | Derived. Nowhere to type it. |
| *Mathematics* | **Its name** | The marker's title, typed. |
| *a title of what that's about* | **What this chapter covers** | `page.summary`, typed. |

So there was no missing feature and no broken mechanism: there was **no route
from the table of contents**, which is the screen his sentence names. The panel
that shipped an hour earlier had none, which is §15a's fault in an hour-old
panel — *a route needs a test per gesture, not per screen*, and the chapter
dialog's nine tests all open it directly.

**A route, never a second copy.** The obvious build is a title box and a
summary box on the panel, and it is wrong for the reason addendum 20 §15c
removed from Layout twice: a second pair of controls that set a chapter's name
is a second answer to what the chapter is called. So the panel has a press and
a double-click, both opening the chapter page's own screen, and it is **absent
on a section** — a section is not a chapter and has no page, which is this
room's own idiom for *not here*.

The **room owns the dialog** rather than asking the workspace to open it, for
the Layout room's reason (addendum 20 §9d): a route that only works while the
workspace is in front of it is not a route, and every room goes to a second
monitor (addendum 02 §8). There is no spread here, so no box is drawn and no
pages are laid.

### What driving it caught

**One row, two spellings of its own number.** The box drew `1 Mathematics` and
the heading an inch under it read `1. Mathematics`, because the box wrote the
number out and `describeContentsRow` wrote it out again — §3's *books set a
chapter with a full stop* having reached the sentence and not the thing beside
it. `contentsNumber` is the one reading both ask.

**The route ran on mid-paragraph.** A control with padding inside a sentence
that wraps around it reads as neither a button nor prose. It is on its own line
with its note under it — *which control a note belongs to is said by the gap*
(addendum 09 §14a) — and the note has **a rule of its own** rather than
reaching for `.small`, which has never had one on its own in this stylesheet:
that addendum's own finding, one stylesheet over.

## 5. What is not built yet

Named rather than half-built, in the order they should come:

1. **A chapter made in the Outliner lands on the timeline as it is made**,
   rather than on a separate *Add to track*. Ken's *that will create chapters on
   the timeline as you create those*.
2. **A filed note becomes a beat under its own chapter and section**, which is
   `addResearchRow` + `promoteRow` pointed at the place the note already names,
   so the Outliner puts it in the right chapter without being told.
3. **Notes filed in bulk** from the Note Sorter and the phone inbox, both of
   which already produce research items and so need only the place.

---

## 4b. Organising the rough information, before it is a chapter

From Ken, narrowing §1:

> I just wanna be able to create the chapters and sections and be able to take
> research and organize it per the sections, not actually create beats of
> everything. I just want a list of things so I can organize the rough
> information before I start crafting it into an actual chapter section.

**It was already built, in the Outliner**, and this was measured end to end
before anything was written rather than assumed:

- `+ Chapter`, `+ Section`, `+ Subsection`, `+ Note` and `+ Idea` on an
  instructional book, numbering themselves 1 and 1.1 as they are made.
- A research note filed **under a section** — `addResearchRow` takes a
  `parentId`, and the Outliner's drop handler passes one.
- The research shelf standing beside the rows to drag from (addendum 06 §3 put
  it there for exactly this).
- And **nothing reaching the manuscript**: after making a chapter, a section
  and filing a note under it, the document holds no new units, no new beats and
  no story markers at all. Promotion is `Add to track`, a separate press.

So Ken's whole sentence is the Outliner's own empty state, which reads
*everything here is a plan until you send it to the manuscript*.

### What was actually missing

**The door.** He keeps saying *in the research section*, and this panel — the
one screen in Research about chapters — named the Outliner twice in prose and
could not reach it:

> The chapters are the Outliner's.
> Nothing to list yet. Add chapters and sections in the Outliner…

That is addendum 10 §8's rule exactly — **a route is only a route where it
exists** — and addendum 20 §15c's one room over. So *Open the Outliner* is a
button here, running the **same three-way the title bar's own Outliner button
runs** (a popped-out pane, the Outline page on a book, the room elsewhere), so
there is one answer to where the Outliner is rather than a second that could
drift. Research closes behind it: this goes somewhere rather than opening a
second thing over the first.

**No second screen was built**, which §3 already decided and is worth keeping:
a Research screen that made chapters would be a second answer to what this
book's chapters are, and this room has removed that fault twice (addendum 20
§15c, §9u).

### Driven, and the fault it caught

Pressing it closes Research and lands on the Outliner with all five row kinds
offered. And looking at the panel caught a contradiction nobody had reported:
the header read **No chapters yet** while a box reading **1. Chapter One** sat
under it. The sentence counts **chapters** and the boxes are **rows**, so a
book with sections and no chapter markers had two readings of one screen
denying each other — §3's own note-count fault a second time. It names what is
drawn now (*1 section, and no chapters yet*), in the format's own noun, and a
test pins that the sentence may never deny what the boxes show.

The route also read as prose rather than a control — a flat `ghost` button
above its own note — which is §4a's finding on this very panel; it is a raised
button now.

---

## 4c. The Outliner's chapters, as boxes — and the drag that had no source

From Ken, after §4b shipped:

> So in the research section, I'm doing an instructional book. Uh, it has a
> section for the outliner that creates chapter one. **We don't need that
> anymore.** But what I really want is **not necessarily a connection between
> the outliner and the research**, but I wanted when you hit table of contents,
> it gives you categories. Not that it affects the outliner, but it gives you
> **automatic categories for you to drop things into**… **just so the outliner
> chapters and sections show up under the table of contents in little boxes**
> or whatever categories so you can drag and drop your um, whatever research
> you have and organize it under those names. **Nothing complex.**

This is the third time on one ask, and §4b's answer is now the thing he asked
to remove — which is the correction worth keeping: **§4b was right that the
Outliner already does the work, and wrong to answer with a door.** A door takes
him out of the room he said he wanted the boxes in. He said *in the research
section* three times.

### Why there were no boxes

`contentsShelf` read the **manuscript** and nothing else: `file.markers` for
the chapters, `unitsInStoryOrder(file)` for the sections. A chapter planned in
the Outliner is an **outline item** and reaches neither of those until *Add to
track* is pressed — and the whole of what Ken is doing is planning, before
anything is promoted. So on his book this screen drew the one seeded unit and
nothing else, which is exactly what he reported each time.

Not a missing feature and not a broken mechanism: **a reading that was right
about the manuscript and silent about the plan**, on a screen whose whole
purpose is sorting material that is not written yet.

### What was built

**`outline_item` joins `storyEntityTypeSchema`** — the **seventh** time that
list has been the whole answer (after `arc_point`, `thread_node`, `theme`,
`motif` and `story_marker`), and **no migration**: 0064 made `place_type`
**text** for 0060's reason, so a note may name an outline row with nothing in
the database changed. `NotePlace` gains a third kind, `plan`, and `placeKey` is
the one string that identifies all three so nothing compares three pairs.

`contentsShelf` then lists **two groups**, and three rules hold them.

**A row that has become a chapter is listed once.** `boundMarkerId` and
`boundUnitId` have said which outline rows are promoted since addendum 19 §2,
so a promoted row drops out of the plan half by itself and no box is drawn
twice. It is checked against the records actually there — a chapter deleted
from the book leaves the row behind, and a row drawing no box at all would read
as the plan having gone with it.

**The two groups are not interleaved.** A plan has no place in the story order
— that is what makes it a plan — so there is nothing to interleave it with, and
a list that guessed would stand a chapter nobody has written between two that
are. The manuscript's rows first in the story order, the Outliner's after them
in the outline's own order, each group named on the screen (*In the book*,
*Planned in the Outliner · not in the book yet*) and the second group named
only when there is a first to tell it from.

**Filing against a plan changes nothing in the Outliner**, which is Ken's own
sentence. `fileNoteUnder` writes one field on the research item and touches
nothing else — not the row, not its title, not a new row referencing the note —
and a test asserts the outline's items are byte for byte what they were.

### The half that would have lost a morning's sorting

A plan row drops off the shelf the moment it is bound. So without something
more, the notes sorted under it would be **perfectly stored and drawn nowhere**
— the writer presses *Add to track*, the chapter appears in the book, and
everything they filed under it vanishes.

`placeNow` is that something: **the place a stored place means now**. A note
filed under a plan row is filed under whatever that row *became*, read through
`boundMarkerId`/`boundUnitId` every time. Nothing is rewritten on promotion,
nothing is stored, and where the binding names a record that has gone it
answers with the plan again — the same answer the shelf gives, so the box comes
back. It is this module's own sentence (*one place, and the chapter above it is
a reading*) pointed at the binding rather than at the story order.

Driven: a note sorted under *1.2 Division* while nothing was promoted, then
*Add to track* on the chapter — all three boxes move into **In the book**, the
group heading disappears because there is only one group left, and the note is
under the section it was sorted into, now a section of the manuscript.

### The fault the screen found, which the tests could not

**There was nothing to drag.** This panel takes the whole of the room's middle,
so while the table of contents is showing, the note cards are drawn **nowhere**
— the boxes were a drop target with no source on the screen. §4's own test
supplied `dragging` as a prop, which is precisely the shape of test that cannot
see this: it proves the drop and never asks where the writer picks anything up.

That is addendum 06 §3's lesson one room over — the Outliner puts the research
shelf *inside* itself for exactly this reason, and Ken's own objection quoted in
addendum 09 §15 (*you'd have to have the sculptor or the outliner up and be able
to drag it into a specific place*).

So the panel carries a **shelf of what is not placed yet**: every living note
`noteProgress` reads as `unfiled`, as draggable chips, under the header and
above the boxes — what you are sorting, then where it goes. **Absent once
everything is placed**, the header sentence already saying so.

Three decisions on it. **What is in the air has one answer**: the shelf tells
the room (`onDragNote`) rather than keeping a second piece of drag state the
boxes would then have to read beside the room's. **One control, two doors**
(addendum 20 §16d) — the chip is draggable, which is the gesture Ken asked for,
and a press files it into the chosen box, which is the only path a keyboard can
reach (addendum 26 §2's rule: *the press is the act and the drag is the
browser's*); both read the same `filingOffer`. And with **no box chosen the
press opens the note** rather than refusing, a control that can only refuse
being one a writer stops trusting.

### Driven

Measured in Chromium against the real preview build, from an empty
instructional project: a chapter and two sections made in the Outliner and
nothing promoted, then Research ▸ Table of contents.

- Five dashed boxes under *Planned in the Outliner*, numbered 1, 1.1, 1.2, 1.3,
  2, 2.1 — `outlineNumbers`, derived, nowhere to type one.
- A real HTML5 drag of a chip onto *1.2 Division*: the sentence reads *File
  “New note” under 1.2 Division. The note itself does not change.*, the box
  reads **1**, and the note stands under it with the **Placed** light.
- *Open the Outliner* is gone.

Two things only looking caught. **The dashed edge said nothing**:
`border-style: dashed` alone is a dash pattern in `--border` against a
near-black panel, which from a foot away is a solid line — the colour goes with
the style now, which is addendum 02 §4b's `.ghost` fault the other way round (a
dashed style with a transparent colour). And **the first group was unnamed
while the second was named**, so the book's own chapters read as the screen's
preamble; both carry a heading, and the heading appears only where there are
two groups, a heading over the only list on a screen saying nothing.

### Deliberately not built

- **No chapter is made here**, §3's decision kept for the third time: a
  Research screen that defined chapters would be a second answer to what this
  book's chapters are.
- **No subsections as boxes.** Ken said chapters and sections, and the
  manuscript half lists exactly those. A note hanging under a section in the
  Outliner is a thing the writer knows rather than a place in the book — the
  rail's *a note gets no dot* (addendum 16 §15) pointed at a box.

---

## 4d. The section the project is born with

From Ken, sending §4c's ask back **word for word**.

§4c had shipped minutes earlier, so the easy explanation was that he had not
looked yet. That explanation is not available in this project, and checking it
was the first thing done rather than the last: `apps/web`'s `prebuild` runs
`scripts/build-preview.mjs`, which rebuilds the renderer from source on every
deployment and copies it to `public/preview`, none of which is checked in — and
running it here puts *Planned in the Outliner* in the shipped bundle with *Open
the Outliner* gone from it. The deployment was not stale. So the repeat meant
what it has meant every other time.

### §4c removed the wrong thing

His first sentence is:

> it has a section for the outliner that creates chapter one. **We don't need
> that anymore.**

§4c read that as the *Open the Outliner* route §4b had just added, removed it,
and was wrong. Driving a **fresh** instructional book straight to Research ▸
Table of contents — without touching the Outliner, which is the state anybody
is in when they first look — draws exactly one thing:

| | |
| --- | --- |
| Sentence | *1 section, and no chapters yet. Add chapters in the Outliner…* |
| Boxes | **1. Chapter One** |

That box is `createProjectFile`'s seed (`project-file.ts`: every project is born
with one unit, titled *Chapter One* on a prose format and *Opening Scene*
otherwise). It is **a section** — `nounsFor('instructional').unit` is *Section* —
**that is called Chapter One** and that the writer never made. His sentence
describes it exactly, word for word, and reading it as a button was reading past
the thing he was looking at.

It is also §3's and §4b's fault a **third** time, in the one place it costs
most: a sentence reading *no chapters yet* standing over a box that names a
chapter — and here the box is not merely a label but **a thing a writer is
invited to aim research at**.

### The rule

**A box is a place in the book, and the starting section nobody has touched is
not one.**

`seedOnly` in `contentsShelf` identifies it by **what has happened to it rather
than by its name**: a title here is the *program's*, so a rule about the words
would be a rule about one seed in one format, and would say nothing about the
next. Four signals say a writer has been here, any one of which is enough —

- a chapter marker on it,
- writing in it (any beat with a manuscript element),
- a note filed under it,
- an outline row promoted into it (`boundUnitId`).

— plus the clause that makes it unambiguous: it is **the project's only unit**.
A book with a second section has had somebody's hand in it, so **nothing anybody
made can be caught by this**, which is the half worth testing, a hide being far
easier to get too wide than too narrow. Five of the six new tests are that half:
the box returns the moment a word is written in it, a chapter is put on it, or a
row is promoted into it, and a book with two sections keeps both however empty.

It is a reading, so it stores nothing and it un-hides itself.

### Driven

Measured against the bundle `build-preview.mjs` actually ships.

- **Fresh book**: no boxes, and *No chapters yet. Add them in the Outliner and
  they turn up here, and on the timeline.* — the sentence and the screen
  agreeing for the first time.
- **Fresh book, two chapters and three sections planned in the Outliner**: six
  dashed boxes, numbered 1, 1.1, 1.2, 1.3, 2, 2.1, and **nothing else on the
  screen**. Which is the whole of what he asked for.

One thing looking caught: with the phantom gone there is only one group on his
screen, and `.toc-plans`' rule was then separating the plans from nothing. It is
drawn only where there are two groups.

### The lesson

**When the same words come back, re-read the words before re-reading the code.**
§4c went straight to the mechanism, found a real gap and fixed it, and never
checked its reading of the one sentence that said what to remove — so it removed
something he had not mentioned and left the thing he had. The sentence named a
*section*, named *chapter one*, and said *we don't need that*; all three are
facts about a box that was on the screen the whole time.

---

## 6. The note's own screen, in the middle

From Ken:

> In the research center, when you create a note, I would like a dialog box in
> the center that you can type into, like a beat in a script or something,
> because trying to type it into the sidebar, it just doesn't feel right.

### It is a feeling with a measurement under it

Driven in the real preview at 1440×900 before anything was designed. Pressing
**+ Note**:

| What | Measured |
| --- | --- |
| The writing box | **287 × 204** |
| Where it stood | a 320px column pinned to the right edge, at x = 1120 |
| The middle of the screen | **860px of it empty** |
| Where the cursor was | **on the + Note button** |

So the press made a note called *New note* and then did nothing whatever to help
anybody write it — no box focused, no words selected, and the box it meant was a
quarter the width of the screen, hard against the edge, under a Tags field and a
Folder select and above a Related Elements panel.

That is the whole complaint and it is exact: **this room was treating a research
note as a property of a selection** when it is a thing somebody composes. A beat
opens in the middle with the cursor in it; a scene does; a chapter page does; a
part does. A note did not.

### The screen

`NoteDialog.tsx`, and it is the beat's own chrome rather than a second idea of
what a writing screen looks like — `dialog.note-dialog` joins
`dialog.track-dialog`'s rule for the padding, border, background, colour and
backdrop and **sets its width and nothing else**. A third copy of the chrome
would be a third answer to what a dialog looks like, free to drift the first time
a colour scheme changes.

What it carries: the folder's name across the top left, **✓ Saved as you type**
beside it, and a ×. There is no *Save*, because the room has always saved as you
type and a writing screen with no Save button has to say why it has none rather
than leave a writer hunting for one.

Measured after: **760 × 707** at x = 340 with the writing box at **726 × 414** —
the same note, two and a half times the area, in the middle of the screen. At
1280 × 800 it is 760 × 661 with the writing at 726 × 368; at 1024 × 700, 760 ×
586, the body scrolling, the whole dialog still clear of the foot of the window.

### It is not a second copy of the aside

`NoteFields` was pulled out of `Detail` and is **one component drawn in both** —
the dialog and the right-hand aside render the same four fields writing the same
calls through the same `onUpdate`. That is *a second control onto one field*
(addendum 20 §16d) rather than two screens that could come to disagree, which is
the fault §15c removed from Layout and §9m settled with `ChapterStyleFields`.
What differs between them is the size of the box and where the cursor lands,
which is the whole of what Ken asked for.

The aside was **considered for removal and kept**: it is the room's panel about
the selection, holding the actions, the figures and Related Elements beside the
fields, and taking it away would be removing a panel to fix a dialog. The only
thing it loses is being the only place to write.

### Where the cursor goes is the act's, not the route's

`startOn` is `'title'` or `'body'`, and the two gestures answer differently:

- **+ Note** makes a note called *New note*, so the title is focused **and
  selected** — the first keystroke replaces the name the program gave it rather
  than appending to it (addendum 20 §16e's rule that a field says what was
  typed).
- **A double-click on the card** opens a note that is already named, so the
  **writing** takes the cursor.

This is addendum 25 §4e's `onOpenCharacter` one room over: the act decides, not
the screen. The effect is keyed on the note's id as well as `startOn`, because
opening a second note without closing the first is one open dialog and two
notes, and the cursor belongs in the one now in hand.

### What is tested, and why it is the gesture

`note-dialog.test.tsx`, six tests, and **what they pin is the gesture rather
than the dialog** — addendum 20 §15a's rule, which this room has now been taught
twice. The screen can be perfect and Ken's complaint still stands if *+ Note*
leaves a writer hunting for a box: so what they assert is that the press opens
it, that the cursor is *in it* (`document.activeElement.closest('dialog.note-dialog')`,
not merely focused somewhere), that the name arrives selected, that what is typed
reaches the card, that the × leaves the note behind, and that a double-click
reopens it on the writing. **A dialog nobody is put inside reads exactly like the
one that was there before.**

Writing them caught one thing worth keeping: a note's title is also an
`<option>` in the Related picker, so `getByText` found two of everything. That is
the note being **linkable** rather than a second copy of it, so the assertions
name the card — which is the note read back, and the honest place to look.

### Where the code is

- `apps/desktop/src/renderer/components/NoteDialog.tsx` — the screen.
- `apps/desktop/src/renderer/components/ResearchWindow.tsx` — `NoteFields`
  extracted from `Detail`, the `writing` state, `+ Note` opening on the title, a
  card's double-click opening on the writing.
- `apps/desktop/src/renderer/workspace.css` — `dialog.note-dialog` joined to the
  shared chrome; the header, the 16px title, the deep writing box.
- `apps/desktop/src/renderer/__tests__/note-dialog.test.tsx` — the six gestures.

No migration and no domain change: a note is the record it always was, and this
is where it is written.

---

## 6a. Its bar moves

From Ken, straight after §6: *make the top bar draggable too*.

**The comparison was load-bearing.** §6's ask was *like a beat in a script*,
which was read as a statement about **where the screen stands** — the middle
rather than the right-hand column — and it is also a statement about **what the
screen can do**. A beat's writing screen has moved on the desk since addendum
02 §6d, for Ken's own reason (*when you open a beat you should be able to grab
the top bar and drag it around*), and a note's screen that looked like one and
stood still was like it in every way but the one you find out about by
reaching for it.

### One gesture, one copy

The obvious build is twenty lines in `NoteDialog`: a pointer-down, a
pointer-move on the window, two numbers of state. That is the fault this
project has removed from printing, from the face table, from the running heads
and from the chapter templates — **a second hand-written drag is a second
answer to how far the pointer moved and where a screen may stand**, free to
disagree the first time either is touched.

So `use-moved-dialog.ts` is `BeatDialog`'s own code lifted out and read by
both. Three rules came with it, and they are now the hook's rather than each
screen's:

- **Where it stands is kept nowhere.** Not in the project, which is the
  writing, and not on the machine either — a screen that opens where it was
  left a fortnight ago is one you go looking for. A different note is a fresh
  screen, which is what `opensFresh` says.
- **Being moved is the one state that places it.** A `<dialog>` is centred by
  the browser, so untouched it carries no style of ours at all — measured:
  `style.left` is empty until the bar is grabbed, and `80px` after.
- **A control is a control.** A press on the name, a picker, a switch or the ×
  is that control's and never the start of a drag, or naming a note would
  slide the screen out from under the pointer.

That last one is the half worth recording, because **the guard already existed
and was in the wrong place**: `BeatWriter` wrote out
`closest('input, button, select, textarea, label')` by hand on its own bar, so
the rule lived in one bar rather than in the gesture, and the note's header
would have written it out a second time. It is in the hook now and `BeatWriter`
just hands the handler over. `.writer-bar-grab` became **`.bar-grab`** for the
same reason — a cursor rule named for the writing screen is one the next bar
copies rather than wears.

### Measured in the real browser

jsdom gives every box a zero rect, so a drag is exactly the thing a test cannot
see. Driven at 1440 × 900:

| | |
| --- | --- |
| Opened | x = 340, no inline style — the browser centred it |
| Dragged 260 left and 40 up | x = 80, `left: 80px`, `position: fixed` |
| Dragged hard at the top-left corner | x = −31, y = 0 — it stops where the bar is still reachable |
| Dragged **from the name box** | did not move at all |
| The × | still closes, and the card holds the words |

The bar's cursor reads `grab` where it is a handle, which is how a bar that
moves is told from one that does not.

### Where the code is

- `apps/desktop/src/renderer/use-moved-dialog.ts` — the gesture, once.
- `apps/desktop/src/renderer/components/BeatDialog.tsx` — reads it instead of
  holding it.
- `apps/desktop/src/renderer/components/BeatWriter.tsx` — its private copy of
  the control guard removed; `.bar-grab`.
- `apps/desktop/src/renderer/components/NoteDialog.tsx` — the header is the
  handle.
- `apps/desktop/src/renderer/__tests__/note-dialog.test.tsx` — that this screen
  *has* the gesture and that the × is not a handle. How far the pointer moves
  is the hook's business, so the beat's own assertions are not duplicated here.

Deliberately **not** built: a ⧉ to send the note to a second monitor. That is
§6d's other half and a different gesture — a page drawn inside a window cannot
leave it, and what leaves is a window of its own. Ken asked for the bar.
