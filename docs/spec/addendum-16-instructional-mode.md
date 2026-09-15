# Addendum 16 — Instructional / Book Mode

Status: **domain built**, September 2026. From Ken's *VC Writer — Instructional /
Book Mode Development Specification v1.0*.

A mode for academic, instructional, reference and nonfiction books: chapters and
sections, a research shelf of graphics and notes rather than characters and
props, graphics placed in the manuscript, and end-of-section learning aids.

## 0. Most of it already existed

The audit that preceded the build, because it decided the shape of everything
after. §11 lists eight entities and **six were already here**:

| §11 asks for | What it is |
| --- | --- |
| `BookProject` | a value of `projects.format` |
| `Chapter` | a `structural_unit` of kind `chapter` — a novel already uses them |
| `Section` (§2: "the role beats play") | a `beat` |
| `ContentItem` | a manuscript element |
| `ResearchItem` | a `research_item` in a category tree |
| `GraphicAsset` | an `asset`, riding inside the project document |
| `Relationship` | a `story_link` — the fifth time |
| `ImportBatch` | **new** |
| `LearningAid` | **new** |

And the views: §5's mind map is the Story Sculptor (addendum 03), §6's Outliner
exists with promotion built (addendum 06 §12), §7's lane view exists, §8's Book
View is the Script already rendering prose for a novel.

So the spec is largely a **vocabulary and taxonomy** change over machinery that
is built, plus three genuinely new things: the importer, the learning aids, and
graphics in the manuscript. Migration 0050 is one column and one table.

## 1. One predicate and one noun table

The precondition, and the reason it came first.

`format === 'novel' || format === 'short_story'` was written out inline in
**twelve places** across the domain and the renderer, and the renderer hardcoded
"Scene" in twenty-one more. A third prose format meant finding and agreeing with
all twelve — and one had already drifted: `render.ts` asked `format !== 'novel'`,
so **a short story was being laid out with screenplay geometry**. A live bug,
found only by going looking for the copies.

**A copied predicate is a decision made twice**, and the second copy is the one
nobody updates. So `formats.ts` holds two readings and every surface takes them:

- `isProseFormat` decides element types, the keyboard, page geometry, paragraph
  style and whether there is an index — everything that differs between writing
  a book and writing a script.
- `isInstructional` is the single question any instructional feature asks,
  because an instructional book is prose with chapters and what differs is what
  goes in them, never how a paragraph is set.

`nounsFor` is how §14 is kept — *a writer in Book Mode must never be forced to
work around Scene, Beat or Script*. **Nothing names a unit itself any more**;
every label reads the table, so a format renaming its parts renames them
everywhere at once and a surface that forgot is one still saying "Scene", which
is findable. An instructional book's are Chapter, **Section** (§2's "the
structural role beats play", named as a textbook names it) and Book.

### The abstraction that was deleted

An `isBookFormat` was written and then removed, because **every use of it was
wrong**. A short story is prose, keeps chapter-kind units, prints chapter pages
and carries a back-of-book index — so a predicate meaning *more of a book than a
short story is* had no honest users. The one place that genuinely differs (1, 2,
3 against I, II, III) is a fact about counting rather than about book-ness and
says so where it is asked. A test caught it, which is what made the refactor
safe to do at all: 1488 existing tests passed unchanged afterwards.

## 2. The shelves, and the one new field

§3 asks for a research system *intentionally different* from the creative one,
and §15 requires the two stay distinct. An instructional project seeds
**Graphics, General Notes, Ideas and an Imported inbox** — a professor offered a
Characters folder has been told what kind of book they are writing.

They remain ordinary categories, renameable and extensible, because a taxonomy
the author cannot extend is one they will work around. The **inbox is a real
shelf** rather than a modal: §4 wants imported material to land somewhere before
classification, and somewhere is a place you can leave things and come back to.

`source` on a research item is the whole of the schema change: **the one field a
nonfiction author cannot work without and a novelist never needs**. Not to be
confused with `origin` beside it, which has answered a different question since
0003 — *how it got into the project* rather than *whose fact it is*. Free text,
because a writer pasting a DOI, a page reference and a half-remembered author
should not be stopped by a form.

## 3. A figure is an element of the manuscript

The decision the graphics half rests on (§9).

Putting a figure in the element list is what gives it a place in the reading
order for free: it paginates, prints, travels when its section moves, and
appears in Book View exactly where the author put it. A side table of *graphics
attached to this chapter* would have to re-derive an order the manuscript
already knows, and would disagree with it the first time somebody moved a
paragraph.

Two things follow, and **neither is stored**:

- A figure's **number**. Counted in reading order every time, so dragging the
  last chapter to the front renumbers everything with nothing run.
- A figure's **height**. Read from the picture — set to the text column, its
  height follows from its own aspect ratio, so replacing an image re-sizes it
  and there is no number for the writer to go and correct. Proved in print: a
  4:3 picture on a 60-column double-spaced page takes fourteen lines, which is
  6in wide at 0.75 over a third of an inch a line.

**Removing is two different acts** (§12). Cutting a figure leaves the picture in
the library; deleting a picture leaves its figures in place, reading as missing.
The words around a figure referred to it, and whether they go too is the
author's decision rather than a cascade's.

Caption and alt text live on the **asset**, so one diagram is not described two
ways in one book; a placement may then carry its own. `figuresWithoutAltText` is
checkable rather than an opinion, which is the only kind of warning this project
makes.

## 4. Learning aids, and a rule kept by the shape

§10 makes three demands. The third is the one that costs somebody an afternoon
when it is wrong — *regeneration should not overwrite author-edited content
without an explicit action* — and it is kept **structurally**:

There are two content fields. `text` is the author's and is **the only thing
that ever prints**; `suggestion` is what the machine last offered and is never
printed. **Regeneration cannot overwrite an edit because it does not write where
edits live.** A test runs a hundred regenerations over an author's paragraph and
the paragraph is still there.

The alternative — one field and a `hasBeenEdited` flag — puts the whole rule on
a boolean every code path has to set correctly, and the first one that forgets
eats the work silently.

**The shape is the permission**, the same trick addendum 07 §12 rests on. A
`LearningSuggestion` has a text and some questions and nothing else: no field for
`approved`, none for which section it belongs to, none for the author's words. A
model that decided to approve its own work has nowhere to put it.

Two distinctions kept apart on purpose:

- **Accepting is not approving.** *These are the right words* and *this goes in
  the book* are different decisions that happen to sit next to each other.
- **Accepting hands back what it replaced**, so the interface can offer an undo
  — the same choice `capture-voice`'s correction makes, and for the same reason.

A quiz keeps questions rather than lines, because the fields genuinely differ: a
question has an answer and a summary does not, which is addendum 12 §2's
reasoning again. An answer may be empty — plenty of textbooks print the
questions and put the answers at the back, or nowhere.

An aid nobody filled in is never a fault, because §10 says these are optional.

## 5. The importer, and the sentence it exists for

§4: *never silently discard unsupported content; flag it and preserve the source
file reference for review.*

So **every file offered comes back with an entry** saying what became of it, and
a file nothing could be made of is named. An import that quietly skipped nine of
two hundred notes is indistinguishable from one that took them all, until the
author goes looking a year later for a note that was never there.

`skipped` and `failed` are separate outcomes because they mean different things
to the person reading the list: *we do not read this kind of file* (convert it,
or ask for the format) against *we tried and could not* (look at that file).
`empty` is a third, because a file that read fine and had nothing in it is not a
failure and is still worth saying.

**What splits is what the file says splits.** A markdown file's headings are the
author having already decided where the divisions are, so they become separate
items — and whatever comes before the first heading is kept, because it is
usually the point of the file. A plain text file is **one item** however many
blank lines it has: a blank line is not a decision, and shattering somebody's
lecture notes into forty fragments is much harder to undo than not having split
them. §4's "where practical" is the licence to be conservative here.

The **host/domain split** is what makes §4's extensible architecture real: the
host turns bytes into a name plus text or a data URI (it unzips a `.docx`,
decodes an image), and the domain decides what that becomes. A new format is a
new extractor on the host and, where it needs different handling, one entry in
`READERS`. Neither touches the research model.

Each note keeps its **original filename as its `source`** — the field §2 added,
used for exactly this. A title is the author's to change, and the moment they
change it the trail back to `lecture-notes-final-v3.txt` is gone unless it was
written down.

`describeBatch` leads with what came in and says what did not **in the same
breath**: a line reading "47 notes imported" would be true and would hide the
three files nobody read.

## 6. Where the code is

| | |
| --- | --- |
| Formats and nouns | `packages/domain/src/formats.ts` |
| Graphics and figures | `packages/domain/src/instructional.ts` |
| Learning aids | `packages/domain/src/learning.ts`, `entities/learning.ts` |
| The importer | `packages/domain/src/note-import.ts`, `entities/import-batch.ts` |
| Generation | `apps/web/src/lib/ai-learning.ts` |
| The schema | `packages/supabase/migrations/0050_instructional_mode.sql` |

## 7. What is deliberately not here

- **`isBookFormat`.** §1.
- **A stored figure number, or a stored figure height.** §3.
- **A `hasBeenEdited` flag on a learning aid.** §4 — the two fields are the rule.
- **A `status` or `warnings` column on an import batch**, which §11 lists: both
  are readings of the entries, and a stored copy is the one that goes stale.
- **A graphics table, or a figure-placement table.** An asset rides in the
  document and a figure is already an element.

## 8. What is not built

The domain is complete and tested; **the interface is not**. Specifically:

- No **New Project** entry for the mode — `instructional` is a valid format and
  nothing in the desktop offers it yet.
- No screen for the **graphics library**, for **learning aids**, or for the
  **importer** and its batch review.
- No **drag-and-drop** import (§4), and no way in from the Outliner (§6) or the
  mind map (§5) — both of which the audit found already built for the creative
  side and neither of which has been pointed at instructional research.
- The generation path in `ai-learning.ts` is typechecked but **has never been
  run against the live API**.
