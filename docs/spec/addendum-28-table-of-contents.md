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
