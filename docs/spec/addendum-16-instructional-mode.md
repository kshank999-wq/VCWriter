# Addendum 16 — Instructional / Book Mode

Status: **built**, September 2026. From Ken's *VC Writer — Instructional /
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
**General Notes, Ideas and an Imported inbox** — a professor offered a
Characters folder has been told what kind of book they are writing.

A *Graphics* shelf was seeded here too and **was removed when the screen was
looked at** (§6a): it sat directly above the graphics *library*, and the first
thing anybody would do is drop a diagram into the one that cannot hold a
picture. The library is the graphics shelf.

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
| The way in | `apps/desktop/src/renderer/components/Welcome.tsx` |
| The graphics screen | `apps/desktop/src/renderer/components/GraphicsPanel.tsx` |
| A figure in the writing | `FigureRow`, `PutAFigureHere` in `BeatBody.tsx` |
| The aids screen | `apps/desktop/src/renderer/components/LearningAidsPanel.tsx` |
| The importer screen | `apps/desktop/src/renderer/components/ImportNotesPanel.tsx` |
| The menu that is the taxonomy | `ResearchWindow.tsx` |
| Graphics and figures | `packages/domain/src/instructional.ts` |
| Learning aids | `packages/domain/src/learning.ts`, `entities/learning.ts` |
| The importer | `packages/domain/src/note-import.ts`, `entities/import-batch.ts` |
| Generation | `apps/web/src/lib/ai-learning.ts` |
| The endpoint | `apps/web/src/app/api/ai/learning-aid/route.ts` |
| Who may ask | `apps/web/src/lib/ai-caller.ts` |
| The schema | `packages/supabase/migrations/0050_instructional_mode.sql` |

## 6a. The interface, and the four things looking at it caught

The domain was complete and tested and the mode was still unreachable: the
format was valid and nothing offered it, and a placed figure drew as a stray
caption. The screens are **Instructional book** on the New Project card, the
graphics library and the importer in the research menu, the aids in the
Inspector on a section, and a figure in the manuscript itself.

Four things were wrong on the screen and right in the tests, which is the case
for building the fixture and driving the real renderer rather than trusting
1550 green assertions:

- **The menu was the wrong taxonomy.** §3 asks for a research system
  *intentionally different* from the creative one and §15 requires the two stay
  distinct — and the menu was still offering a professor Plots, Setups &
  payoffs, Locations, a character mind map and a character review. They are
  **absent rather than greyed**, the same rule the book index follows: a
  disabled control says *not yet* about something that is never coming. Themes,
  Links and the phone stay, because a work of nonfiction has all three.
- **Two things called Graphics.** The seeded `graphics` shelf sat directly above
  the graphics *library*, and the first thing anybody would do is drop a diagram
  into the one that cannot hold a picture. The shelf is gone; the library is the
  graphics shelf. The key is out of the schema too, so it cannot come back by
  accident.
- **"Used in the script" on a book**, which is the exact phrasing §14 forbids.
  The four research views now read the noun table like every other surface.
- **A name collision made a lie.** The manuscript importer already owned
  `.import-warnings` and coloured it red, so every note import drew *every*
  unread file as a failure — including the ones that merely were not read and
  the one that was empty. The note importer's classes are `note-import-*`.

Two decisions the screens add to the module:

**Nothing about a figure is stored except which picture and where.** The number
is counted in reading order by `figuresInOrder` every time it is drawn, so
there is no field for it and no *renumber* command; and a figure carries no
colour, size or face of its own, because the manuscript is drawn on dark ink or
on white paper depending on the gear — a caption field with a background of its
own was black on black on one of them, which is what the first screenshot
showed.

**Putting a figure in is on the manuscript's right-click**, the sixth thing it
does, rather than a button on the graphics screen. A figure has a place in the
reading order and the only person who knows where it goes is the one looking at
the paragraph it belongs under. It is absent on any other format and absent on
a book whose library is empty: *put a figure here* with nothing to put is not
an offer.

## 6b. Wiring the suggestion

The generator existed and nothing could reach it. It now has the same three
layers the Final Editor's read has, for the same reasons: **the key lives on
the server**, where it can be rotated and metered, instead of inside every
installed copy. The desktop sends a bearer token from the main process; the
browser preview sends its session cookie to the same origin.

`resolveCaller` moved out of the scene-review route into `lib/ai-caller.ts`
rather than being copied. The three questions — is there a key, is somebody
signed in, do they hold a licence — are one decision, and **a copied predicate
is a decision made twice**; the copy nobody updates is the one that lets an
unlicensed caller through the day the rule changes. §1 made the same argument
about a format check and found a live bug proving it.

Two things the wiring adds to §10's rule rather than merely carrying it:

- **The request has no field for the author's words.** The route's schema takes
  a kind, a section and a title, so a client that tried to send `text`,
  `approved` or an aid's id has nowhere to put them, and a test posts all three
  and watches them not arrive. The shape is the permission on the way out as
  well as on the way back.
- **What comes back is recorded with `suggestAid` and nothing else.** That
  function writes to the suggestion field and cannot reach `text`, so the client
  half of *regeneration must not overwrite an edit* is kept by having nowhere
  else to write. The test that matters writes a paragraph, asks for a
  suggestion, and finds the paragraph still there.

A **bucket of its own** in the rate limiter (forty an hour), because a morning
spent on the Final Editor should not silently use up somebody's summaries.

The button is **absent rather than greyed** when it cannot be had, and the
reason is said **once at the foot** rather than three times beside three missing
buttons: *why can I not have one* is a question about the account, not a fault
of the summary. A section with nothing written in it is the other way round —
there the button is present and refuses, because that reason is about this
section.

## 6c. The vocabulary sweep

§14 of Ken's spec — *a writer in Book Mode must never be forced to work around
Scene, Beat or Script* — was written into `nounsFor` at stage 1 and then only
the workspace shell was pointed at it. **Seventeen components still said Scene
or Beat in visible text**, and the sweep turned up something worse: **five
separate private copies of the same decision**, each spelling out *chapter or
scene?* inline —

| Where | What it said |
| --- | --- |
| `StoryView` | `const noun = prose ? 'Chapter' : 'Scene'` — and **never used**, dead |
| `ScriptOptions` | the same line, used for one label |
| `SceneDialog` | derived from the unit's kind, with `'Scene'` as the fallback |
| `PageSetup` | `prose ? 'chapter' : 'scene'` written out **six times** in one file |
| `OutlinerWindow` | a hardcoded table of seven kind names |

Which is §1's argument arriving a second time, in the renderer this time: a
copied predicate is a decision made twice, and by the fifth copy one of them is
already dead code.

Everything now reads the table. Three things beyond renaming came out of it:

- **The Outliner's kinds are the format's.** `scene` and `beat` are named from
  the table, so a textbook's tree offers **Chapter, Section, Note, Idea** — and
  Character, Setting and Prop are **absent rather than renamed**, because a
  professor has no use for them and the honest thing is not to offer them.
- **A book is shown no runtime.** A page of script is a minute of screen time; a
  page of a textbook is not a minute of anything, so the chip is absent rather
  than printing a figure that means nothing.
- **A closed scene dialog on a book said "Scene"** — its fallback, with no unit
  selected, was the literal word rather than the format's noun.

Verified by walking the whole rendered DOM of an instructional book, attributes
included, and looking for the words. **Three survive and all three are meant**:
*scene break* is the standard prose term for the `* * *` divider, *an act in a
script, a chapter in a book* is an explanation that names both on purpose, and
*Import a script* is reading a Final Draft file, which is a script.

Preferences is the one screen that cannot read the table: it belongs to the
machine rather than to a project, so there is no format to ask. Its one label
now says **cards**, which is what the board actually draws.

## 7. What is deliberately not here

- **`isBookFormat`.** §1.
- **A stored figure number, or a stored figure height.** §3.
- **A `hasBeenEdited` flag on a learning aid.** §4 — the two fields are the rule.
- **A `status` or `warnings` column on an import batch**, which §11 lists: both
  are readings of the entries, and a stored copy is the one that goes stale.
- **A graphics table, or a figure-placement table.** An asset rides in the
  document and a figure is already an element.

## 8. What is not built

The mode is reachable and every screen §4, §9 and §10 ask for is there. What is
left:

- The generator has **never been run against the live API**. Everything in
  front of it is proved — the gate, the shape, the bridge, the screen — and the
  model call itself is the same shape as the Final Editor's, which is. It needs
  somebody to press the button on a deployment that has the key.
- No way in from the **Outliner** (§6) or the **mind map** (§5) — both of which
  the audit found already built for the creative side and neither of which has
  been pointed at instructional research.
- Dropping files onto the Research window from **outside** it. The importer's
  own drop zone works; dragging a folder onto the folder tree does not.
