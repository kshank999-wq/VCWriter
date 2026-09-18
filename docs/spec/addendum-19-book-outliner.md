# Addendum 19 — Outlining a book

*The Outliner as a book's front door: chapters, sections and subsections
worked out first, then put on the track.*

## 0. Where it came from

Ken, 17 September, after using instructional mode:

> I want the outliner to be a main feature that you can switch back and forth
> in the book view from Outliner to book view. But it starts default with the
> Outliner in that view. And you will work out your chapters and sections and
> subsections there. Then when you get that all filled out, you can highlight
> the sections, which will be like the equivalent of scenes, and the
> subsections, which will be the equivalent of beats, and you'll be able to
> transfer that to the timeline.

And, the same day: a **Delete** button in the toolbar in place of the × on
every row (*"that could too easily, if you build a section out, accidentally
delete it"*); **Add to track** for a selected section and its subsections;
a **chapter heading** above the sections; and, for the chapter page, a
**summary box** and **three templates** — the graphic at the top, the middle
or the bottom, with the title and the summary placed around it.

Just like a novel, a chapter here is *"simply a page denoting what the next
subject is, and then it'll start with content as a section."*

## 1. The audit: what already exists

More than half of it, which by now is the expected finding.

| Asked for | Already built | Where |
| --- | --- | --- |
| Transfer sections to the timeline | **Promotion.** A Scene row becomes a unit on the first track, its Beat rows the beats inside it, in their order | `outline-binding.ts`, addendum 06 §6 |
| Highlight several and send them | **Multi-select** with Cmd and Shift, and a strip that sends every scene among the chosen rows | addendum 06 stage 8 |
| Sections and subsections | The noun table already says *Section* and *Subsection* on a book, and the Outliner's kinds are the format's | `formats.ts`, addendum 16 §15 |
| A chapter above them | **Story markers**, kind `chapter`, which sit above units on the story order and already carry the chapter page, drive the contents page and paginate | `entities/structure.ts`, addendum 02 §12 |
| Numbers that follow the structure | `numbering.ts` counts sections and subsections in story order and stores nothing | addendum 16 §15 |
| A chapter page | *File ▸ Chapter page…*, a dialog whose sheet is the same `ChapterLeaf` the preview draws, and `chapterStyleVars` as the one thing deciding what the CSS custom properties mean | addendum 02 §12a |
| Graphics on it | A **graphics library**, from which a figure in the manuscript reads its number and its height | addendum 16 stage 2 |

So the third level is not a new table. It is the ninth time this project has
found the general mechanism already built and merely narrow in vocabulary: a
`chapter` marker *is* a chapter, and what was missing was a row in the
Outliner that knows it.

What is genuinely new: a chapter row and what promoting one means; numbering
three deep; the Outliner as a **page** a book opens on rather than a room
reached from a menu; delete and promotion moved to the toolbar and acting on
the selection; and three things on the chapter page — a summary, a template,
and a graphic that comes from the library.

## 2. A chapter is a page, not a container

**The sentence that shapes the whole addendum**, and it is Ken's: a chapter
*announces the subject, and the writing begins at the first section.* Nothing
is written *in* a chapter. Which is exactly what a story marker already is — a
leaf between units that carries no manuscript text — so a chapter in the
manuscript is a **marker of kind `chapter` on the first section under it**,
and the chapter page creator works on a book unchanged.

In the Outliner, a **Chapter** row is offered on a book, at the top level only:
it is the one kind that cannot hang under anything, because a chapter inside a
section is not a thing a book can print. Sections go under it, subsections
under those. Notes and Ideas go anywhere, as they always have.

**Promoting a chapter** promotes the sections beneath it — each a unit, each
with its subsections as beats, in their order — and then places the marker on
the first of them, with the chapter's title, and binds the row to the marker
(`boundMarkerId`, the third binding beside `boundUnitId` and `boundBeatId`).
From then on the two are one thing: rename either and both change, which is
the promotion contract of addendum 06 §1 kept for a third kind.

Three consequences, all of them the existing rules pointed at a chapter:

- **A chapter with no section under it cannot be promoted.** A marker has to
  start *on* a unit, and there is none. The refusal says so in a sentence —
  *a chapter starts on a section, and this one has none yet* — rather than
  making an empty section to hang it on, which would be inventing writing.
- **Unpromoting leaves both**, marker and row, no longer joined: the same as a
  scene. Deleting a promoted chapter row offers to unbind and never removes the
  marker, because the writing is never what a delete in the Outliner is
  allowed to cost (addendum 06 §10).
- **Moving a section between chapters after promotion** is the out-of-step case
  the Outliner already names in a sentence with one button beside it. It is
  not made to reorder the book behind the writer's back.

## 3. Add to track is promotion

Ken's words for the button are **Add to track**, and it is the existing
promotion with its name changed: a section becomes a unit on the **first
track** — which is what `promoteOne` has always done — and its subsections the
beats inside it. It goes into the Book at the same moment, the unit being one
thing seen from two places, and the button's tooltip says so.

The label is **Add to track on every format**, not only on a book. It is the
same button, it does the same thing, and a lane became a track in every module
yesterday for the same reason — one word for one thing. *Send to Script* is
retired.

**It acts on the selection, from the toolbar.** Today a single row is promoted
from its panel and several from a strip that appears only when there are
several; Ken's ask — *highlight the sections, click Add to track* — is one
gesture whether one row is chosen or nine. So Add to track joins the toolbar
and acts on whatever is selected, one row or many. A selected section brings
its subsections, as promotion always has. The bulk strip keeps what is only
sensible for several rows at once — marking, moving in and out — and loses the
two actions that now live above it.

## 4. Delete is deliberate

**The × comes off every row.** Ken's reason is the whole reason: a row being
built out is a row being clicked around, and a delete a pixel from the fold
handle is one a writer will hit. So there is a **Delete** in the toolbar, it
acts on the selection, and it is the only way to take a row out. The Delete
and Backspace keys do nothing to a row — a hand resting on the keyboard is the
same accident by another route.

This applies to the Outliner **on every format**. The accident is the same
whether the row is a section or a scene, and the Outliner is one component; a
delete affordance that differed by format would be the fork the noun table
exists to prevent.

What it asks before acting, all of it existing behaviour reached by a new
button:

- A selection with rows under it says how many go with it — *this takes six
  rows with it* — before anything goes, which is `whatGoesWith` from the
  Sculptor's × pointed at a tree.
- A promoted row offers to unbind rather than delete, as §10 of addendum 06
  has always required.
- Removing several gathers the subtrees first and removes them together
  (stage 8's rule), so a selection holding both a row and something under it
  cannot go looking for a row that is already gone.

## 5. The book opens on its outline

**On a book, the workspace opens showing the Outliner.** Not the Write page:
a textbook is planned before it is written, and the plan is the numbering, the
contents page and the shape of the whole thing. So on a book the Outliner is a
**page on the bar** — *Outline*, before *Write* — rather than a room reached
from the Window menu, and it is the page a book opens on. Choosing *Write*
shows the Book; choosing *Outline* comes back; the Outliner's own × means *to
the Book*. Switching back and forth is what Ken asked for, and two tabs is
what switching back and forth is.

It is the same component. The Editors are the precedent: a page rather than
an overlay, which can still go to a second monitor, marked ⧉ on the bar while
it is away (addendum 02 §8). The Outliner on a book does the same, so a
writer with two screens keeps the outline on one and the Book on the other,
and the page bar says where it went.

On every other format nothing changes: the Outliner is a room, reached from
*Window ▸ Outliner*, and the application opens on the writing as it always has.
The difference is where the component is mounted, not what it is.

The *Write* tab keeps its name on a book. The page beneath it already calls
itself the Book (`manuscript` in the noun table), and renaming the tab is a
one-line change if it turns out to matter; the decision worth making was
which page comes first.

## 6. Three levels, and how they number

**Chapter, Section, Subsection** — the marker, the unit, the beat. On a book
the numbering reads all three: chapter **1**, its sections **1.1**, **1.2**,
their subsections **1.1.1**, **1.1.2**. Still nothing stored, still nowhere to
type a number: the chapter's figure is counted from where its marker falls in
the story order, exactly as a section's has been, so dragging chapter four
above chapter two renumbers everything under both with nothing run.

`structureNumbers` grows a third map, chapters by marker id, and `outlineNumbers`
walks the same three levels through the tree so the Outliner shows the number
each row would print. `describeNumbering` says all of it in words.

Two rules, both the note rule of addendum 16 §15 pointed one level up:

- **A book with no chapters numbers as it does today** — 1, 1.1, 1.2. An
  existing project changes nothing by this addendum; the third level appears
  when the first chapter does.
- **A section before the first chapter carries no number.** It is a section of
  no chapter, with no path to the front of the book, and inventing one would
  collide with the sections that have. The Outliner says so beside the row, the
  same way it explains an unnumbered note.

The contents page reads the same numbers and lists the sections under each
chapter as an indent, `1.2 Lenses` with the page it opens on. (The first draft
of this section said the contents page already did this; it listed the
chapter markers and nothing under them, and stage 2 built the rest.) The
index needs no rule of its own.

## 7. The chapter page for a book

Three things join the chapter page, and one rule decides where each lives.
The rule is addendum 02 §12a's: **the look belongs to the book and the words
belong to the chapter**, because a reader who turns to chapter nine and finds
it laid out differently has found a mistake rather than a design.

**The summary.** A box for *what this chapter covers*, on the chapter — words,
so it is the chapter's. It is **not the epigraph** it sits near: an epigraph is
a quotation set in the display face, and a summary is prose about the chapter
set in the reading face at a reading size. A different field with a different
type treatment, not a rename.

**The three templates.** Graphic at the top, in the middle or at the bottom,
the title and the summary placed around it. Where the graphic sits is layout,
so the template is a **book setting** — set once, every chapter page follows
it — with a **per-chapter override that defaults to *use the book's***. That
is the same shape as `minimumSetups` on a setup record, where zero means *use
the default*: a pattern already in the codebase, so a writer who wants one
chapter's opening picture at the foot can have it without every other chapter
following. The dialog shows the three as tiles, and the sheet beside them is
the same `ChapterLeaf` the preview draws, so what is chosen is what prints.

**The graphic from the library.** A book has a graphics library, and a figure
in the manuscript already reads its number and its height from it. The chapter
page's picture comes from the same place on a book, so replacing a diagram in
the library replaces it on the chapter page too, and there is one answer to
*where are my graphics*. The existing data-URL illustration stays for a
novel's device and for pages already made; on a book the picker offers the
library.

`chapterStyleVars` stays the one thing that decides what the CSS custom
properties mean: the template adds to what it emits and changes nothing about
where the meaning lives. The summary, the template choice and the asset ride
inside the marker's page, which is one JSON column, so **no migration** for
this section; the one migration in the addendum is §2's `bound_marker_id`.

**A suggested summary** is the last stage and deliberately the last: the
learning-aid generator of addendum 16 already writes a summary from a
section's content, and a chapter's overview is the same reading pointed one
level up, over the sections beneath the marker. It goes through the same
route, with the same rule — the request has no field for the author's words,
and what comes back is offered, never written where the writer's words live.

## 8. What it must never do

- **Never delete from a row.** No ×, no Delete key, no Backspace. The toolbar,
  on the selection, or nothing.
- **Never make a section to hang a chapter on.** An empty chapter is refused
  with a sentence, not padded.
- **Never number a section that has no chapter above it** in a book that has
  chapters. Blank, and said why.
- **Never reorder the Book behind the writer's back.** A section moved between
  chapters in the outline is a sentence and one button, as it is for scenes.
- **Never store a number.** Chapter, section and subsection are all counted.
- **Never fork the Outliner by format.** One component; what differs is which
  kinds it offers (the noun table's business) and where it is mounted.
- **Never let regeneration reach the summary the writer typed.** The suggestion
  is offered beside it and accepted deliberately, addendum 16 §10's rule.

## 9. Build order

Each stage lands green on its own and is verified by driving the real
renderer, because every visual stage in this project has had a fault the tests
did not see.

- **Stage 0 — Delete and Add to track, on the toolbar, on the selection.** The
  × comes off the row; Delete and Add to track join the toolbar; both act on
  one row or many; *Send to Script* is retired. Every format. No domain
  change.
- **Stage 1 — the Chapter row.** `chapter` joins the kinds a book's Outliner
  offers, top level only, with a mark of its own. `boundMarkerId` on the item
  and migration 0052's `bound_marker_id`. Promoting a chapter: its sections,
  then the marker on the first, then the binding. Two-way rename. The empty
  chapter refused. Out-of-step reaches chapters.
- **Stage 2 — three-level numbering.** `structureNumbers` and `outlineNumbers`
  count chapters; the unnumbered-before-the-first-chapter rule;
  `describeNumbering`; the contents page's third level.
- **Stage 3 — the book opens on its outline.** `'outline'` joins the views,
  offered on a book, first after Home; the Outliner mounts as that page and
  can pop out with the ⧉ marking. Other formats untouched.
- **Stage 4 — the chapter page for a book.** `summary`, `template` and
  `assetId` on the page; `template` on the book's style; the three tiles and
  the summary box in the dialog; the library picker on a book; the printed
  page and the preview both from `ChapterLeaf`.
- **Stage 5 — a suggested summary.** The learning-aid route reading the
  sections beneath a marker; offered beside the box, accepted deliberately.

## 10. Acceptance

- A new book opens on the Outliner. *Write* shows the Book; *Outline* comes
  back; the × on the Outliner goes to the Book.
- The Outliner on a book offers Chapter, Section, Subsection, Note, Idea, and
  nothing else. Chapter is refused anywhere but the top level.
- No row has a ×. Delete in the toolbar removes the selection and says what
  goes with it first; a promoted row is offered unbinding instead.
- Selecting a section and pressing Add to track puts it on the first track and
  in the Book with its subsections in order; selecting three does the same for
  three; a row already there is left alone.
- Promoting a chapter with two sections makes two units and one marker on the
  first, titled as the chapter; renaming the row renames the marker and back.
  A chapter with nothing under it is refused with the sentence.
- Chapter 2's first section reads 2.1 and its second subsection 2.1.2 on the
  row, on the Book and in the contents; dragging chapter 2 above chapter 1
  swaps every number with nothing run.
- A book with no chapters numbers 1, 1.1 as before. A section above the first
  chapter shows no number and the reason.
- The chapter page dialog on a book shows three template tiles and a summary
  box; the book's template applies to every chapter page and one chapter can
  differ; the picture is chosen from the library and follows a replacement.
- The printed chapter page and the preview are the same leaf.
- *Suggest a summary* is absent when it cannot be had, present and refusing on
  a chapter with nothing written beneath it, and never touches a summary the
  writer typed.
- On a screenplay nothing in this addendum is visible except the toolbar
  Delete and the Add to track label.

## 11. Names

**Chapter, Section, Subsection** on a book; the noun table is the one place
they are spelled. **Track**, since yesterday, in every module. **Add to
track**, the button, every format. **Delete**, the button, every format.
**Outline**, the page a book opens on. **Summary**, the box, which is not the
epigraph. **Template**, the three, on the book with a per-chapter override.

## 12. What is built

This section is filled in a stage at a time, in the order of §9, each entry
saying what the stage does and what building it found.

### Stage 0 — Delete and Add to track, on the toolbar, on the selection

**What it does.** The × is gone from every row on every format. The toolbar
carries two more buttons after the kinds: **Add to track**, lit when any
chosen row could be promoted and running `promoteRow` over the selection so
one row and nine are the same gesture; and **Delete**, lit when anything is
chosen and never acting at once. Delete opens an ask that says what would go
before anything does: `whatGoesWithRows` in `outline.ts` gathers the chosen
rows and everything under them (a subtree chosen twice is counted once),
`rowsRemovalQuestion` writes the question — *Delete "Light"? It takes 4 rows
under it too.* — and `rowsRemovalComfort` adds the one sentence a promoted row
earns: *One of them is already in the book; what it stands for stays there.*
The buttons are **Keep it**, **Just unbind it** (offered only when something in
the selection is promoted, running `unpromoteRow` so the book keeps what the
row stood for), and **Delete all N**. The keys do nothing to a row; the bulk
strip keeps Mark, Move in, Move out and Done and loses Send to Script and
Remove, both of which are the toolbar's now. The panel's button reads *Add to
track* as well, since two names for one act is one too many. §4's refusal to
delete promoted work silently is the whole of the domain change; the rest is
the screen.

**What building it found.** Three §6c survivors, all in the Outliner's panel
and row: *in the script*, *Take it out of the script* and *while the scene is
written* were literal words on a book, and now read the noun table — *in the
book*, *Take it out of the book*, *while the section is written*. The
promoted badge's title said *This is in the script* the same way. And the
tally under the toolbar said *1 rows*, a plural nobody had pluralised. Driving
the real renderer showed the ask dialog at the size the Sculptor's card ask
draws at, which is the right size, so it borrows those two classes rather than
growing its own.

### Stage 1 — the Chapter row and its marker

**What it does.** `chapter` joins `OUTLINE_KINDS`, and a book's Outliner
offers **+ Chapter** first on the toolbar, a ruled heading in the display
face above its sections. It is the one kind whose place is fixed: `mayHang`
in `outline.ts` refuses a chapter under anything — `addItem` returns nothing,
`moveItem` and Tab leave it where it is, and retyping a nested row into a
chapter keeps the rest of the patch and drops the kind, while the panel's
type list simply does not offer it there. Return on a chapter makes a
**section under it** (`nextAfter`, the scene's own rule pointed one level
up), and **+ Section** from inside a chapter stays inside it, after the
section the writer is in.

Promotion is §2 made real. `boundMarkerId` is the third binding on the row
(migration 0052, one nullable column with the marker's `on delete set null`),
and `promoteChapter` in `outline-binding.ts` promotes the sections beneath,
each with its subsections, then `addMarker` of kind `chapter` on the first of
them with the row's title, and binds. `canPromote` refuses an empty chapter
with the sentence — *a chapter starts on a section, and this one has none
yet* — and makes nothing, no marker and no section invented to hang one on.
The rename is two-way through `planning.ts`: `BindingTarget` gained
`{ markerId }`, so `updateItem` retitles the marker and `updateMarker` (the
marker dialog, the chapter page dialog, the timeline) retitles the row.
Letting go is the same shape as a scene's: `removeMarker` unbinds the row,
`removeUnit` re-anchors the marker to the next section and the row stays
bound, and only when the last section goes does the marker go and the row
return to a plan. `unpromoteRow` leaves the marker, for §10's reason.

**What a chapter covers is read, never stored**: `chapterSpan` walks the
story order from the marker's unit to the next chapter marker's, so a section
dragged into the stretch is in the chapter with nothing run. That reading is
what places things. `indexAmong` now takes *where a sibling stands* as a
first-and-last rather than one position, so a second chapter lands after the
**whole** of the first rather than between its first section and its second,
and a section promoted on its own beside chapters lands after the last unit
of the chapter above it. Out-of-step reaches chapters the same way — two
chapters compare by their first units — and **Move the chapter to match**
moves the whole span as a block, each unit placed after the one before it
from the live order, because a chapter is a page and its sections are what
it is: moving the page alone would put the heading of chapter three over the
sections of chapter two.

**What building it found.** Two things outside the stage. `removeTrack`
never let the plans go — a row bound to a scene that left with its track
kept claiming to be real — so it calls `unbindRemovedFromPlans` as
`removeUnit` always has, and both now name the markers re-anchoring dropped.
Two §6c survivors: the promotion panel's out-of-step sentence still said *in
the script it comes* on a book, and the Book view's empty unit said *Nothing
in this chapter is in the script* — the unit's *kind* rather than its noun,
and the wrong manuscript — which the promoted chapter's leaf drew in the
first screenshot; both read the noun table now. In the renderer,
Return read the selection from the render that made the handler, which on a
row made a moment earlier was one render stale, so the section landed at the
top; a row's Return now names its own row (`fromId`), the row the caret is in
being the fact.

### Stage 2 — three levels, and how they number

**What it does.** `structureNumbers` grows a third map, `chapters`, keyed by
marker id, and once a book has a chapter marker its units number `1.1`,
`1.2`, `2.1` under the chapter whose marker fell at or before them — the same
reading `chapterSpan` makes — and their subsections `1.1.1`. A book with no
chapters numbers as it always has, so nothing changes for an existing project
until its first chapter is placed. **A unit before the first chapter carries
no number**, and nothing under it does either. `numberOfChapter` reads one.
`outlineNumbers` walks the same three levels through the tree, and at the top
level reads the manuscript's rule: a section beside a chapter row rather than
under it belongs to the last chapter above it, and before the first chapter it
has no number. `whyUnnumbered` is the sentence the panel puts under such a
row's title — *No number: it comes before the first chapter, so it is a
section of no chapter* — because a number that is simply missing looks like a
fault. `describeNumbering` says all three levels and that rule in words, under
*File ▸ Page setup ▸ Numbering*.

**The contents page lists the third level**, which is the part §6 got wrong:
it said the contents already drew it, and it did not — a contents entry was a
chapter marker and nothing under it. `ContentsEntry` carries `sections` now,
each `1.2 Lenses` with the page it opens on, read from `structureNumbers` so
the list and the page cannot disagree, and both the print stylesheet and the
preview's leaf draw them indented under the chapter. A novel's entries carry
none, a novel numbering nothing inside a chapter.

**What building it found.** Two faults in the contents reading, both from a
book still being planned. Which chapter a section fell in was first read by
counting the lines that went in ahead of it, and every section with no prose
yet counts the same number of lines, so all of them landed under the last
chapter — it is read from the story order now. And an empty section was
pointed at the page of the *next* section's first line, which on a book with
chapter leaves put *1.2 Lenses* on page 15 under a chapter 2 that opened on
14: a section with nothing in it stands where the chapter's flow stands, on
the page the line before it fell on, or the chapter's own page when it is the
first thing in the chapter. And one more §6c survivor, on the Preview page:
its scope tab said *This scene* on a book, the one word beside *Whole book*
that had never been read from the table.

### Stage 3 — the book opens on its outline

**What it does.** `'outline'` joins the page bar's views, between *Home* and
*Write*, and on a book it is the page the workspace opens on: `App` sets the
view when a project is opened, keyed on the project's id rather than the file,
so switching pages afterwards is the writer's and only opening another
project decides again — a screenplay opened next lands on *Write* as it
always has. The page is `OutlinerWindow` with `page` set: the same component
the rooms use, mounted inside the main area with the page bar still under it
(`.outliner.as-page` is `position: relative` where the room is `fixed; inset:
0`), its × titled *To the Book* and going there, its ⧉ sending it to the other
monitor and the bar marking *Outline* away, as it marks *Editors*. On a
book the title bar's *Outliner* and *Window ▸ Outliner* go to the page rather
than laying a room over it, so there is one Outliner and not two. On every
other format nothing changes: `PageBar` takes `hidden`, the page is left off
the bar rather than greyed, and the Outliner stays a room.

**What building it found.** Nothing in the code; the drive of the real
renderer confirmed each step of §10's first line — a new book opens on the
Outliner, *Write* shows the Book, *Outline* comes back, the × goes to the
Book — and that a screenplay's bar carries no *Outline* and its Outliner
still opens as a room.

### Stage 4 — the chapter page for a book

**What it does.** Three fields join the page a marker carries, and none of
them needed a migration, the page being one JSON column. **`summary`** is
prose about what the chapter covers, a box of its own on a book under the
epigraph's, and it prints in the **reading face** whatever the heading wears:
`chapterStyleVars` emits `--chapter-summary-face` as the manuscript's stack,
and the summary's size and weight are a fourth line of the book's style.
**`template`** is where the graphic sits — `graphic_top`, `graphic_middle`,
`graphic_bottom` — and it is a **book setting with a per-chapter override
that defaults to `book`**, `minimumSetups`' shape: the dialog shows the
three as tiles under *How every chapter page is set*, one chapter can differ
through a select that names the book's as its first choice, and a line says
so when one does. The book's default is *middle*, because that is the order
every page made before there was a choice has always drawn — heading, device,
lines under it — so a novel that never chooses looks exactly as it did.
**`assetId`** points at the graphics library, so on a book the picture is
chosen from the library rather than pasted in, one place holds the pictures,
and a diagram replaced there is replaced on the page; `graphicWidth` is its
own, and the data-URL illustration a novel's device has always been stays
for a novel and for pages already made.

**`chapterLeafContent` is the one function** that resolves what the marker
alone cannot — the template that may be the book's, the picture that may be
the library's — and the print, the preview, the marker dialog's sheet and
the chapter page dialog's sheet all read it, for the reason `chapterStyleVars`
is one function: a writer looking at two answers to *what will it look like*
has no way to tell which one the book will use. A library picture that has
gone draws nothing rather than a broken plate.

**What building it found.** A test that checked the order the printed page
put its parts in read the whole document and measured the stylesheet, which
names every class before the page does; the domain's render is right and the
test now reads from the page. Driving the renderer with a fixture written
before the field existed crashed the dialog on a page with no `template` at
all — the desktop parses every file on open, so a real project cannot arrive
that way, but `templateOf` now reads a missing value as *the book's*, the one
answer that cannot be wrong. Otherwise the audit paid a tenth time: the leaf,
its typography, the library and the print stack all existed, and the stage
was three fields and one resolving function.
