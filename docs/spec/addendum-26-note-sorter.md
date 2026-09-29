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
7. **Suggestions.** `note-sorter-suggest.ts` and the panel under the stacks:
   spec §15's three functions over one scorer, and §14 is the whole argument.
8. **Dictation.** `startDictation` reused whole; what is new is that the
   transcript becomes a **source** rather than typed screenplay elements, and
   where there is no speech service the system's is named in that module's own
   words. The line the handoff asks for by name — *Just talk. You'll sort it
   later.* — is the point of the panel: capture is kept apart from organising.

---

## §13a Nothing is created by looking

A project with no sitting opens on Gather with somewhere to put material, and
**the first thing put in begins the sitting**. `beginArc`'s rule (addendum 25
§4f): a room that made a record in order to have something to show would leave
one behind every time somebody looked at it.

---

## §14 Auto-sort suggestions

Spec §15, *Optional AI Assistance*, is three things — **Suggest Categories**,
**Suggest Destination** and **Auto-Sort Suggestions** — with its own caveat:
*the writer remains in control; AI should not silently reorganize source
material.* `note-sorter-suggest.ts` is all three, and they are **one scorer**.

### §14.1 It is a reading, not a model call

This is the stage's one real divergence from the spec, and the argument for it
is not thrift. For *this* question the writer has already given the answer.

Ask a model *which of these six categories does this paragraph belong in* and
you get general knowledge about the words. Ask the sitting and you get **what
this writer did with these categories half an hour ago**: they made *Dialogue*
and filed three passages in it, so the fourth passage that talks the same way
belongs there **because of those three**. A model cannot see that, and it is the
only thing worth seeing here.

Four things follow, each one this project has paid for before.

- **It says why, in something checkable.** *1 card uses “villain”, “morning” in
  Character* is a fact about their own filing that a writer can go and look at;
  a category named with no reason is what gets a suggestion panel switched off
  after the second wrong guess (the narrative validator's *not crying wolf*,
  addendum 18 stage 3).
- **Nothing moves until you approve is true by construction.** There is no
  suggestion record to write, approve or clean up — extracting the passage takes
  it out of the unsorted stretches and it stops being suggested with nothing
  run, which is `coverageOf`'s own rule (§4) one layer up.
- **It is testable rather than merely demonstrable** (addendum 09 §4). Every
  rule below is pinned by a test that says what was suggested and why; the AI
  routes this program already has (addendum 16 §6b) have still never been run
  live, and a panel a writer leans on all afternoon is the wrong place for that.
- **It costs nothing and needs no account**, so there is no cap to hit, no meter
  to read and no network to be without.

A model **is** the better tool for one of the three — naming a grouping from
unclustered prose — and §14a is that half, built at Ken's word. Nothing about
the panel changed shape to take it.

### §14.2 The scorer, and the rule that keeps it quiet

A term is worth more where it is **common inside one category and rare across
the rest**, which stops a word the writer uses everywhere (*scene*, in a book
about writing scenes) putting every passage wherever the most cards are. A
category is taught by its **cards and by its own name**, kept apart — without
the name the panel is silent until somebody has done by hand the work it exists
to save, and without the separation it says *1 card uses “dialogue”* about a
category nothing is filed in, which is ungrammatical and false.

Whether a row is shown at all is **a rule rather than a number**, and the first
draft had a number. A floor on `strength` is a floor on a *density*, so the same
evidence fell below it in a longer paragraph: an obviously-Dialogue paragraph
went unoffered at 0.125 while a shorter one cleared at 0.167. A threshold on a
density is a threshold on paragraph length wearing a disguise.

`worthSaying` asks about the **evidence** instead: **two words, or one word that
is the category's own name or that two of its cards share** — and in the
single-word cases, a word no other category knows. Both of those clauses were
earned on the screen: the first draft accepted any unique word and duly proposed
a paragraph about *revision* for **Character**, because one card there happened
to contain *write*. A passage that says the category's **name** is different in
kind, and so is a word the writer has filed on **twice**. One card's incidental
vocabulary is an accident.

`strength` survives, for ordering only.

### §14.3 The three functions

**Suggest Destination** is `scoreCategories` pointed at the live selection, and
it stands in the Sort footer beside the highlight: *Looks like Publishing →*,
with the reason in its title and the press doing the ordinary extraction.

**Auto-Sort Suggestions** is `suggestPlacements`, and four rules hold it:
**only what is unsorted** (`piecesOf`, the same reading the greying uses, so the
two cannot disagree); **a paragraph at a time**, because that is what a writer
highlights and proposing half a sentence would make approving worse than doing
it by hand; **one category per passage**, two being a question rather than a
suggestion; and nothing that is not `worthSaying`. Approving is
`extractToCategory` and nothing else, so an approved suggestion is
indistinguishable afterwards from a passage dragged across by hand.

**Suggest Categories** is `suggestCategories` and, from §14a, a model beside it:
words that run through three or more unsorted paragraphs and that **no category
knows, by name or by card**, plus names read out of the passages themselves. It
**proposes a name and never makes one**, and pressing it makes the category
**empty** — after which the passages suggest themselves into it, which is the
writer's press. Making it *and* filling it would be the *silently reorganize*
the spec forbids.

## §14a A model, for the one it is better at

From Ken after §14 shipped. **The count can only offer a word that repeats, and
a grouping's name is very often a word that appears in none of the passages.**
The notes say *villain*, *antagonist*, *the man burning the village*, and the
category is called **Antagonists** — which no count will ever produce. That is
the whole case, and it is the one of the three where it holds: *which of my six
categories does this paragraph go in* is still the reading's, because the writer
answered it by filing three things half an hour ago.

**The shape is the permission**, the third time in this program (addendum 07
§12, addendum 16 §10). `suggestedCategoriesSchema` is **names with a sentence**
and nothing else: no field for a passage, a range, a card or a category id, so a
model that decided to sort the notes itself has nowhere to put the answer. Spec
§15's *AI should not silently reorganize source material* is kept by the type
rather than by care, and a test hands the schema a reply carrying `categoryId`,
`cardIds`, `from`, `to` and `apply`, and watches all five fall off.

**What leaves the machine is said beside the press** — *Sends the unsorted
passages and your category names. Nothing is filed.* — because a writer sending
a page of private notes somewhere should be told that is what the button does.
It is the unsorted paragraphs and the category names; no ids, no cards, no
sources, no project, and nothing is read from the database.

**The two halves are one list, counted first.** `mergeIdeas` puts the read ideas
before the suggested ones, because a writer scanning down should meet what they
can **check** before what they can only **judge**; a name a category already has
is dropped, and so is one the reading already offers — a model agreeing with the
count is not a second idea. Which half said it is **on the row**, marked
`suggested`, for `found`'s own reason (addendum 25 §2): the two are not the same
kind of claim.

Everything else is the pattern the learning aid set: the generator in
`apps/web/src/lib/ai-note-categories.ts`, the route at `/api/ai/note-categories`
with a `GET` that says whether it can be had at all, `resolveCaller` for
entitlement, **its own rate-limit bucket** so a morning of sorting does not use
up somebody's chapter summaries, and the three bridges — preload, main, and the
browser preview's same-origin fetch.

The button is **absent rather than greyed** when it cannot be had, with the
reason said once, and the reason it may be absent without leaving a hole is that
**the panel is complete without it**: the read ideas are the feature and this is
more of them. Offline, unlicensed, or in a build with no cloud at all, the
sorter goes on suggesting exactly as §14 describes.

**The model call has not been run live** — the same caveat addendum 16 §6b
carries, and for the same reason: no key is configured here. What is proved is
everything either side of it, driven in the real room with the bridge answering
as the route does: the button appears only when the status allows, what crosses
the boundary is `{ passages, categories }` and nothing else, a name already
taken is dropped, a name that survives is marked `suggested`, and pressing it
makes a category with nothing in it — which the panel then draws as a **chip**,
the reading's own rule for a category nobody has filed anything in.

### §14.4 The panel

**Under the stacks in Sort**, not in Refine where the handoff draws it: the
suggestions are about material still in the raw notes, and by the time a writer
is refining every card is filed and the panel would have nothing to say. Here
approving a row greys the passage an inch to the left, which is the whole of why
it is trustworthy rather than merely clever.

**The switch is per machine and dismissing is about this minute** — whether you
want the panel is a fact about how you work, while *not that one* is about this
reading of these notes, and the reading changes every time anything is filed.

Driving the real room caught three things, all of them the same kind.

- **The dismissal sentence lied.** With everything put aside the panel said
  *nothing here looks enough like any of your categories* — false, and false
  about the one thing it is asking to be trusted on. `describeSuggestions` is
  told how many were put aside, says so, and there is a way back.
- **Approve was below the panel's own scroll**, which is addendum 20 §15c's
  fault in a smaller box: the list scrolls now and the head and the acts do not.
- **The switch's accessible name was *On***, which is addendum 02 §4a's switch
  exactly — *off* means nothing on its own, and neither does *on*. It is named
  for what it switches.

A fourth thing the tests caught rather than the screen, and it is the switch
being real: turning it off in one test reached every test after it, because a
preference is per machine and jsdom's storage persists. The suite clears it.

## §15 Deliberately absent, and said
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

## §16a The standard categories a sitting opens with

From Ken: *I would like the note sorter to have categories set up and then you
can add categories, but there needs to be a character setting dialogue. theme
idea set up and payoff scene beat and other standard categories for
storytelling.*

Read as a **list** — character, setting, dialogue, theme, idea, setup and
payoff, scene, beat, and the standard ones beyond them — rather than as an ask
for a dialog that sets up characters. The sentence runs as a list and ends
*other standard categories for storytelling*, which only the list reading
finishes.

`seedCategoriesFor` in `note-sorter.ts` is the list and `beginSession` hands it
to every new sitting, beside the unsorted pile it already seeded and for the
pile's own reason: **the thing that needs it is the writer's first drop**, and a
screen that asks somebody to invent a taxonomy before they may sort anything is
the screen this module exists to replace.

Three rules decide what is in it.

**Every seed names something the program already has somewhere to put.**
Character is the Character Creator's, Setting is Locations', Theme is Themes &
Motifs', Setup & payoff is that module's, Plot is a track, Idea is the Ideas
shelf, Research is the shelf and its `source` — so a category here is the first
half of a journey the rest of the program finishes, rather than a taxonomy
invented for one room, and each carries a `description` saying where that kind
of note ends up. **Dialogue is the one exception and it is Ken's**: writers keep
notes about dialogue and there is no record for it, and it earns its place by
being asked for.

**Nothing names a unit itself** (addendum 16 §6c). The two structural seeds read
`nounsFor`, so a screenplay is handed *Scene* and *Beat*, a novel *Chapter* and
*Passage*, a textbook *Section* and *Subsection*.

**Absent rather than renamed where a format has none.** A textbook has no cast,
no locations, no cues and no setups, so it is handed none of them and gets
Concept, Example and Figure instead — the research menu's own rule (addendum 16
§6a), which is why the list is built per format rather than translated.

They arrive **empty**, which costs nothing and buys two things: §8's rule draws a
category with nothing in it as a **chip**, so a fresh sitting is a row of chips
rather than ten empty stacks; and `scoreCategories` is taught by a category's own
name, so §14's panel has something to say before a writer has filed anything by
hand — the half of the suggestions that otherwise waits for somebody to do by
hand the work they exist to save.

Two things fell out of building it, both of them faults the seeds made visible
rather than caused.

**`addSortCategory` was making a rival by name.** Addendum 24 §5n settled where
that check belongs — in the **act**, wherever a single act means *this one or a
new one by this name*, so no caller can forget it — and §16a made it necessary
rather than merely tidy: a sitting now opens with *Character* in it, so a writer
typing the word would have got an empty Character beside the full one with
nothing in the room able to tell them apart, the suggestion engine least of all
since it is taught by the name. Case and surrounding space are ignored, a writer
typing from memory not being promising to match capitals (§5m's rule).

**Send offered every empty category as a chapter.** Measured on a sitting two
passages old: *12 chapters · 5 notes*, eight of them headings nobody wrote. The
rule is §16b's and it is stated on the screen — **a category with nothing
anywhere under it is not a row of the book**; it is a shelf waiting for
something, and one thing filed in it is all it takes to be offered.

## §16b The handoff's own screens

From Ken, after the three earlier stages shipped: *It doesn't look like you use
the UI mockups.* He was right, and what was wrong is worth naming precisely
rather than apologised for: **the mockups had been read for structure and not
for surface.** The four steps, the two-panel split with its divider, stacks and
chips, the four display modes, the cream index-card colours, the tick tree and
the outline preview all came from the handoff — and the reading stopped there,
so what a writer saw was a working room that did not look like the comps.

The correction is a **visual restyle in place**, addendum 02 §4a's shape one room
over: every binding, reading and promise is exactly what it was, and the whole
domain suite passed through it untouched except where the seeds changed a count.
What is worth keeping is the handful of places where a look turned out to be a
statement about the work.

**The bar is one row and a step is a numeral in a ring.** The steps were a
second strip of tracked capitals reading *1 GATHER*; they are the handoff's
circled numeral and a sentence-case name now, which needs the number and the
label to be **two elements rather than one string** — and that is what makes the
numeral `aria-hidden`, so a tab's accessible name is *Gather* and the tablist
says which of four it is. Sixteen renderer assertions named the old spelling and
were updated rather than worked around. The handoff's lockup is `VC WRITER ·
NOTE SORTER` and the first half is deliberately not repeated: the application's
own title bar is an inch above and already carries it, so a second copy would be
branding the program to somebody using it. Measured at 1440 the row was one
squeeze short — the last step ran under the progress rail and *+ Sitting* wrapped
to two lines — so **the steps and the search never shrink** and what gives way as
the window narrows is what is merely nice to have, in order: the room's name,
then the sitting's, then the progress said in words.

**Undo is on the bar, and absent rather than dead where it cannot work.** Spec
§13 asks for it and §6c had it on the keys alone. In a window of its own the
history is the workspace's, so the button is not there — §15's gap named rather
than papered over with a control that can only refuse.

**Gather is four tiles and a loud fifth.** It was three framed boxes, one of them
a raw `<input type=file>` reading *Choose Files · No file chosen*, which is the
browser's own control and looks like a screen nobody finished. **Paste text and
Type directly are one control reached through two doors** (addendum 20 §16d's
rule, not a shortcut): what differs is what the writer means to do and the box
says which they asked for, where two *boxes* would have been the second answer.
The dashed drop zone, the *Raw dictation session* strip, §6's promise at the foot
of the sources and the gold **Start sorting** under it are all the handoff's, and
the last two matter most — a writer about to sort twenty pages should be able to
read *sorting never cuts or deletes* without being told.

**A card carries its lineage on its face.** *Brainstorm ¶3*, in the mono the
handoff reserves for a source reference, on every card in every stack. It is
`whereFrom` and stored nowhere, so cutting the source says so there; and it is
the single thing that makes a card an index card rather than a coloured box,
because what a writer wants to know about a card at a glance is where it came
from.

**A tag is a thing you take off.** The card's tags were a comma-separated line,
which is the shape of a field rather than of a set; they are pills with a ✕ and
a `+ tag` box, which is the only shape that says a tag can be removed.

**The card's acts are one row at the top.** Split · Merge · Move to… · Also show
in…, with *made* and *edited* out at the right, then title and tags together,
then the working text, then source and *appears in* together, then the comment —
because the acts are what you *do* to a card and the fields are what it *is*, and
the handoff is right that they should not be interleaved. **Merge lives once**,
here rather than also under the sequence, one act with two doors having been the
thing §16d warned about in the other direction.

**A comment is a third field, and the record had nowhere for it** (migration
0059). Three fields answer three questions: `body` is the working text — the
words that travel into the outline — `source` is where the fact came from, and
this is *pair with the Hans Gruber example?*, which belongs to neither. A writer
with only the first would be typing an instruction into the words the book is
going to print.

**The outline preview is numbered, and the numbers are a reading.** `numberRows`
counts over the rows that are going, so unticking a category renumbers what is
left with nothing run — and **a card gets no number**, an attached note carrying
none in the Outliner, so a number here would be a promise the other room does
not keep.

**The waveform is decoration and says so where it is written.** No speech API
available here reports a level, so bars that rose and fell with the voice would
be an animation pretending to be a meter. They move while the recogniser is
running and stand still when it is not, which is the one thing about them that
is true.

Two things the handoff draws are deliberately still absent. The **category
context menu** (Rename · Merge into… · Duplicate · Colour · Delete) is a strip of
controls on the tree rather than a menu, every one of them reachable; and the
suggestions panel stays **under the stacks in Sort** rather than in Refine, for
§14's reason, which is recorded there rather than rediscovered here.

The lesson, and it is this project's oldest one pointed at a picture: **a handoff
is read twice — once for what the screen must do and once for what it must look
like**, and doing the first alone produces a room that passes every test, keeps
every promise, and reads to the person who asked for it as though the mockups
were never opened.
