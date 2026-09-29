# Addendum 26 — The Note Sorter

From Ken's own *VC Writer Note Sorter — Development Specification* and the UI
handoff that came with it (a spec, four mockups and four static HTML screens),
with his covering line: *a new ability to sort notes. Quickly. And easily from
whatever source.*

**Built.** §13 says what each stage does.

---

## §1 The audit

The **twenty-fourth** time, and it paid harder than usual: the spec's §19 data
model names four record types and **two of them already exist**.

| The spec asks for | It already is |
| --- | --- |
| `Category` — id, name, parentId, order, colour | a **`research_category`**, which has carried a parent, a colour and an order since the research tree was built |
| `ExtractedNote` — workingTitle, workingText, tags, categoryId | a **`research_item`** |
| §17's *a note may become or attach to* a theme, a character, an outline row | **`story_links`**, whose `from_type` is text and which has taken a `research_item` since it was built |
| §16's *cards become attached notes; outline items link back to their cards* | **`addResearchRow`** (addendum 06 §5), a row whose `source` names a research item and whose title is **read through** rather than copied |
| the dictation session | **`startDictation`** (addendum 09 §8) |
| *import a Word document* | **`docxToMarkdown`** (addendum 16 §4), which marks the author's own headings and separates paragraphs with a blank line — which is exactly what a page a writer is about to read and highlight should look like |

So the data work is **two tables and four columns** (migration 0057), and *after
sending, cards stay in the sorter* needed nothing at all.

What is genuinely new is the **sitting**, the **immutable source**, and the
character **ranges** that join a card to the words it came out of.

---

## §2 A card is a research item, and that has a price

The audit's convenience is also its one real risk, and it is the graveyard's
exactly (addendum 24 §5d, §5i, §5j): if a card is a research item and a sorting
category is a research category, then **every research reading that never heard
of the sorter will list them**, and the fault would be found one surface at a
time over the next five weeks.

So the predicate is applied **before the first surface rather than after the
fifth**, and it lives in research's own readings rather than in this module:

- `researchCategoriesInOrder` filters `sessionId === null` — the research side
  menu, the tree, the counts, the room's filing choices and the Writers Room's
  assignables all ask it, so none of them has to be told the sorter exists.
- `shelvedItems` is new beside `workingNotes` in `selectors.ts`, and
  `researchItemsIn` reads it, so a brainstorm halfway through being sorted does
  not fill the research room's *Everything* view, the Related Elements picker
  or the room's idea boxes.

There is deliberately **no `shelfCategories` of the sorter's own**: a second name
for one reading is the first step to a second answer.

`sorter-surfaces.test.ts` is `cast-surfaces`' and `setups-surfaces`' third
sibling, and it walks **every** research reading rather than the ones this module
happens to touch — each assertion checking the shelf **was** answering before the
sitting existed, so a reading that shows nothing cannot pass by accident.

---

## §3 The source is immutable, and sorting never touches it

Extracting records a **range**. It does not cut, mark or move a character of the
original, which is the only version of *Show original source* a module can
actually keep: it is a **read** rather than a reconstruction.

This is also why §19's stored `extractedText` snapshot is **not built**. With an
immutable source a snapshot can only ever agree with `text.slice(from, to)` or be
wrong about it, and two answers to *what did the page say* is the thing this
project spends its time removing. `passageOf` reads it every time.

A card's `title` and `body` are its **working** title and text — the writer's,
editable, and never written back.

---

## §4 Processed is a reading

Nothing anywhere stores *this passage has been sorted*. `coverageOf` counts it
back from the cards' ranges every time, so:

- deleting a card un-greys its passage with nothing run;
- two cards taken from overlapping passages make **one** run rather than two,
  because the question is *is this dealt with* and a character covered twice is
  covered once;
- the progress bar and the page cannot disagree, there being no second copy of
  the truth to disagree with.

The sixth time this project has made a fact about the work a reading rather than
a column, and the reason is always the same one.

---

## §5 The four display modes, and the two that were the same

§7's modes — **Everything · Grey sorted · Hide sorted · Unsorted only** — all read
one `piecesOf` list and none of them changes a character of the source.

Driving the real room caught the fault of the day **twice in the same shape**.
*Hide sorted* and *Unsorted only* drew exactly the same 358 characters; and once
that was fixed, *Everything* and *Grey sorted* drew the same 762. **Four controls
have to mean four things, or one of them is lying about what it does.**

- **Everything** is the source as it stands, undifferentiated — which is what a
  writer switches to in order to *read* it rather than to audit it.
- **Grey sorted** greys what is dealt with.
- **Hide sorted** takes it out and leaves a mark **in place**, so the page keeps
  its shape and you can see where you have been.
- **Unsorted only** takes even that away and runs what is left together.

Measured after the fix: 762 in reading ink, 762 with the sorted stretches at
`#5d5540`, 363 with five elision marks, 358 run together.

---

## §6 The press is the act, the drag is the browser's

The handoff's gesture is *read, highlight, drag, drop*, and the first draft made
the page `draggable` so the passage could be picked up. Measuring the real
browser showed what that costs: **a `draggable` element cannot have text selected
inside it with the mouse at all** — the selection came back empty — so the first
of the four verbs did not work.

Chromium drags a selection of its own accord and fires `dragstart` as it goes, so
the attribute is gone and the drag is the **browser's affordance** rather than
something this room declares. What the room supplies is the **press**: every
category is a button that files the live selection, with `extractOffer`'s
sentence in its title. That is not merely a fallback — a drag is unreachable by
keyboard and easy to miss, so the press is the reachable path and the drag is the
convenience.

The drop is claimed by **a MIME type of its own**
(`application/x-vcwriter-passage`), `carry-work.ts`' rule, so dragging text
anywhere else in the program is left entirely alone.

**No dialog while sorting**, which the handoff asks for by name: a passage
dropped on a category becomes a card at once, named from its first seven words.
A writer going through twenty pages cannot be asked to name each one on the way
past; renaming is Refine's business.

---

## §7 The offsets need nothing added to the markup

Every piece of the page is one span carrying its own `data-from`, and its only
child is a text node, so a point inside it is that offset plus the node offset.
The pieces need the attribute to be keyed anyway. It is addendum 20 §9d's join
one room over: **the markup a screen already emits is usually enough to answer
the question only that screen asks.**

---

## §8 Chips, stacks, and the unsorted pile

The handoff asks for main categories as **stacks of index cards** and less-used
ones as **chips** above them, so a sitting of fifteen still fits.

Which are chips is a **reading** rather than a measurement: **a category with
nothing filed in it is a chip, and becomes a stack the moment something lands in
it.** A chip takes a press and a drop exactly as a stack does, because a target
you cannot drop on is not a target.

One divergence from the mockup, and it was measured: the handoff has the stacks
**scrolling off to the right**, and at 1500px three of six were past the edge of
the window — you cannot drag a passage onto something that is not on the screen.
The stacks **wrap**. With the chips taking the unused categories, everything a
passage can go to is in front of the writer.

The **unsorted pile** is a real category marked `systemKey: 'note_unsorted'`,
seeded by `beginSession`. It has to be real, because a card must have a home and
the handoff's *Delete (cards return to unsorted)* has to land somewhere; and it
is seeded rather than made on demand because the thing that needs it is a
*delete*, and a writer pressing × is at the worst moment to discover that the
place their cards are going to has to be created first. It has no × and no
rename — **absent with the reason said**, rather than a control that can only
refuse — and `removeSortCategory` refuses it again, so a caller cannot get past
the reading by not reading it.

**Merge into… is Delete with a different target.** `removeSortCategory` takes
*where the cards go*, so there is one act with one parameter rather than two
functions that must agree about what happens to the writing.

---

## §9 A reference is not a copy

*Also show in…* puts the same card on a second list. One record, one set of
words, so editing it in either place is editing the one card and taking the
reference away leaves the card at home. A duplicate record would be two answers
to what the note says the moment either is edited.

Splitting keeps **both halves' source link**: the range is split in proportion
where the working text still matches the passage, and where the writer has
rewritten it both halves carry the whole original range — which is honest, the
lineage being *this came out of that stretch*.

Merging keeps the **widest** range and buries the rest rather than destroying
them (addendum 24 §2), so a merge nobody meant is undone by restoring. Undo takes
it back anyway; this is the belt beside the braces.

---

## §10 The search is both halves

A writer who searches *monologue* wants the passages they have already sorted
**and** the ones still sitting in the raw notes. `searchSession` answers both, and
pressing a hit goes to the source in Sort or the card in Refine — a search that
answered one of those would send them looking twice.

---

## §11 Send to Outliner, and the writing mode that is not there

The handoff asks for a **writing mode** on the sitting that *sets the mapping*.
It is not built, and the reason is the module's own argument: **the project has
already answered that question.** This program has had a `format` since the first
migration and `nounsFor` has named its levels since addendum 16 §1, so a sitting
that said *Book · nonfiction* inside a screenplay would be two claims about one
piece of work, free to disagree the moment either was edited.

`sendLadder` reads the mapping off the format. **A chapter where the format has
one, otherwise the unit**, and the level under it is the next noun down — which
is `kindsFor`'s own list read as a ladder rather than as a menu. Nothing names a
level: a textbook sends Chapters and Sections, a novel Chapters and Passages, a
screenplay Scenes and Beats. A card is a **note** on every format, that being the
type which claims least about what the thing is.

What the handoff really wants from that control is the **per-row override**,
which it asks for in the very next sentence and which is built and stores
nothing.

`send_mode` was written into migration 0057, found to be read by nothing, and
**taken out** in 0058 rather than left as a field that lies — `columns` on a
part's style, exactly (addendum 20 §17).

Four more rules:

- **Only what is off is written down** (addendum 20 §9v), so a category made
  after the picker was opened belongs in the send without being asked.
- **A row switched off takes what is under it**, and the screen says so rather
  than letting an unticked category's cards quietly arrive at the top level.
- **A nested category asking to be a chapter is stepped down** rather than
  dropped: `mayHang` refuses a chapter under a parent (addendum 19 §2), and
  refusing the row outright would lose the writer's cards for a reason about
  type.
- **A send adds and never clears**, so sending twice gives two copies rather than
  losing the first. That is what Undo is for.

Nothing about a plan is stored. A plan is about this send rather than about the
work.

---

## §12 One card to the shelf

§17's *also send single cards somewhere else* is `fileOnShelf`, and it **moves
the card's home rather than listing it twice**. The reason is a fact about the
rest of the program: every research reading answers *what is on this shelf* from
a card's `categoryId` (§2), so a card merely referenced into a folder would be
invisible in the one place the act exists to put it. One home — and the outline
row is still the second place it appears, a row referencing the card by id and
reading its title through.

The sitting does not lose the passage: the card keeps its range, so the source's
grey does not move. `shelfOffer` says all of that before the press.

---

## §13 What each stage built

1. **The records.** `note_sessions` and `note_sources` (migration 0057);
   `session_id` on a research category and `source_id`/`source_from`/`source_to`/
   `also_in` on a research item. `entities/note-sorter.ts`, and the round trip
   through `sync-mapping.ts` — where `ProjectRows` being **derived** from
   `SYNC_TABLES` meant the typecheck refused to pass until both row directions
   were written.
2. **The readings.** `note-sorter.ts`: `coverageOf`, `piecesOf`, `progressOf`,
   `sessionProgress`, `passageOf`, `whereFrom`, `searchSession`, and the shelf
   predicate in `selectors.ts`.
3. **The acts.** `beginSession` (with its pile), `addSource`, `addSortCategory`,
   `extractOffer`/`extractToCategory`, `moveCard`, `placeCard`, `referenceCard`,
   `unreferenceCard`, `splitCard`, `mergeCards`, `removeSortCategory` and
   `categoryRemoval`.
4. **Send.** `note-sorter-send.ts`: `sendLadder`, `sendRows`, `sendCount`,
   `sendToOutliner`, `fileOnShelf`, `shelfOffer`.
5. **The room.** `NoteSorterWindow.tsx`, the **seventh** (`ROOM_PANES`), on every
   format — a page of notes wants sorting whatever is being written from it — and
   reached from a **Notes** button on the title bar and *Window ▸ Note Sorter in
   its own window*. Four tabs: Gather, Sort, Refine, Send to Outliner.
6. **The reader.** `read-notes.ts`: Word through `docxToMarkdown`, plain text and
   Markdown as they are, a PDF's laid-out lines rejoined into paragraphs by their
   vertical gaps. RTF and `.doc` are **refused with the one step that fixes
   them** (`pictureRefusal`'s shape, addendum 20 §16a), a crudely stripped RTF
   being a page of control words with the writer's sentences buried in it.
7. **Dictation.** `startDictation` reused whole; what is new is that the
   transcript becomes a **source** rather than typed screenplay elements, and
   where there is no speech service the system's is named in that module's own
   words. The line the handoff asks for by name — *Just talk. You'll sort it
   later.* — is the point of the panel: capture is kept apart from organising.

---

## §14 Nothing is created by looking

A project with no sitting opens on Gather with somewhere to put material, and
**the first thing put in begins the sitting**. `beginArc`'s rule (addendum 25
§4f): a room that made a record in order to have something to show would leave
one behind every time somebody looked at it.

---

## §15 Deliberately absent, and said

- **§15's auto-sort suggestions.** The handoff draws them with a switch, an
  approve-N and the line *nothing moves until you approve*. Not built: the
  approval machinery is the easy half and what a suggestion would have to be is
  the hard one, and this module is worth having without a model in it. It is the
  obvious next stage and needs no new records — a suggestion is a category id
  against a card id, and `moveCard` already exists.
- **Undo in a popped-out room.** Undo is §6c's and reaches the sorter the day it
  was written, every act being a pure function through `update` — *in the
  workspace*. A room in a window of its own has never had it, `useLinkedProject`
  carrying no history, and that is true of all six rooms before this one. It
  belongs to addendum 02 §8 rather than here, and is named rather than quietly
  inherited.
- **Dragging a card into another *category*.** Reordering within a category is
  built — a card carries its own MIME type and the list draws the handoff's gold
  insertion line where it would land — but the category tree is not a drop
  target. *Move to…* does that act, and it was left as a press because it is the
  one gesture here that crosses two panels. Writing this section is what caught
  the reorder: the panel said *Drag one to move it* and nothing took the drop,
  which is a promise the screen made and the code did not keep.
