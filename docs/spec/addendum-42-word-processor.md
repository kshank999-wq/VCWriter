# Addendum 42 — The word processor (Document format)

From Ken: *in the new project screen there is one box open, and a perfect fit
would be a standard word processor that interfaces with the other modules.*
His development spec is `VC_Writer_Word_Processing_Module_Development_Spec_v1`
(21 October 2026), called **the WP spec** below.

This addendum covers **phase 1 of the WP spec's six (§13): the foundation.**
That is the format, the document model, the editor, the ribbon, file
operations, autosave, and the Word, PDF and text conversions. The Extract &
Organize sidebar (phases 2–3), the shared Outliner tab (phase 4) and sending
extracts to other projects (phase 5) are the next stages. Each gets its own
section here when it is built.

## 1. The format

`'document'` joins `projectFormatSchema`. `isWordProcessor` is the only
question anything asks (`formats.ts`), and `formatName` calls it **Document**.

- **The new-project screen.** The eighth card, in the slot the game card's
  move to VC Game Studio left open. It reads *A word processor: letters,
  reports, essays and notes, filed into your other projects*.
- **The phone.** It is a spoken format too ("document", "word document",
  "letter", "report", "essay"), so a Document project is named in Notes and
  on the website's notes pages like any other.
- **A new project** is one empty document. The track, unit and beat every
  project carries are still made, empty and unseen, so nothing that counts or
  lists them meets a project without them.

## 2. The document model (WP spec §8, §11)

`ProjectFile.documents: WpDocument[]` holds the following:

- `id` and `projectId`.
- `title`.
- `content`: the editor's own tree, as ProseMirror JSON.
- `schemaVersion`.
- `pageSetup`: paper (Letter, Legal, A4 or A5), orientation, and four margins
  in inches.
- `revision`: counts every change to the body. An extract (phase 2) records
  it, which is how it will know its source has moved on (WP spec §5.2).
- Timestamps.

The tree is stored **as the editor keeps it** rather than translated into
beats and elements. A letter has tables, lists and runs of mixed formatting
that the manuscript model was never meant to hold, and the WP spec asks for
an editor-native model with the plain text derived. The schema checks the
tree's *shape*, never which node types it holds, so a file written by a later
build still opens.

Pure functions in `document.ts`:

- `setDocumentContent` changes the body, `setDocumentPageSetup` the page
  setup, `renameDocument` the title.
- `docPlainText` gives one block to a line, list items and table cells
  included.
- `docWordCount` counts as Word does: an apostrophe or a hyphen stays inside
  a word.
- `docHeadings` lists the headings, for the navigation pane.
- `pageSize` gives the sheet's width and height, turned for landscape.

## 3. The editor: TipTap 3

No rich-text editor existed in the repository. Every manuscript line is its own
`<textarea>`. The WP spec (§11) asks for a proven framework, so the editor is
**TipTap 3.31.4** (ProseMirror), which works in Electron and in the browser
preview alike. TipTap supplies:

- bold, italic, underline, strike, subscript and superscript
- font family, size and colour, and highlight
- alignment
- bulleted, numbered, lettered and Roman lists, nested
- headings 1–6, quote, code, horizontal rule and links
- tables with header rows, merging and splitting
- pictures
- undo
- the placeholder

Ours (`renderer/document/extensions.ts`):

- **BlockFormat.** Word's paragraph settings: an indent in half-inch steps,
  line spacing, space before and after, and Title and Subtitle as paragraph
  styles. **Tab** behaves as in Word:
  - in a list item, it moves the item down a level
  - in a table, it moves to the next cell
  - anywhere else, it types a tab

  **Shift+Tab** reverses each of these.
- **PageBreak.** A real break, on Ctrl+Enter, as Word has it. On screen it is
  a labelled dashed rule; on paper, a new page.
- **Search.** Find marks every match and the current one more strongly. Case
  and whole-word options. A match may run across bold and plain text within a
  paragraph but never across two paragraphs, which is Word's rule too.

## 4. The workspace

`DocumentWorkspace` takes the place of the story workspace on the Write page.
The title bar drops the story rooms (Sculptor, Outliner, the note sorter,
Focus), and Research moved to the right-hand menu (§16). The page tabs are Home, Write, Account and
Recovery.

- **The ribbon** has six tabs:

  | Tab | What it holds |
  | --- | --- |
  | File | Save, save as, print, export to Word, PDF or text, and insert a Word or text file at the cursor |
  | Home | Format painter, paste as text, the font group, the paragraph group, the Styles gallery, find and replace |
  | Insert | Page break, tables with their tools, pictures, links, a horizontal line, today's date, symbols |
  | Layout | Paper, orientation, margin presets and exact margins |
  | Review | Spelling on and off, word and character counts |
  | View | Print layout or web layout, the navigation pane, formatting marks, zoom |

  - The Home tab's font group is font, size, bold through superscript, clear
    formatting, ten font colours and six highlights. Its paragraph group is
    the four list kinds, indent, alignment, line spacing and space after.
  - The table tools on Insert appear only when the cursor is in a table.

  Buttons take the press on mouse-down and refuse focus, so a selection
  survives pressing Bold, as in Word.
- **No inert buttons** (WP spec §14). What the editor cannot do yet is left off
  rather than greyed: headers and footers, page numbers, footnotes, a table of
  contents, comments and tracked changes. They are listed in §7.
- **Print layout.** The page is the document's own paper and margins, with a
  rule where each page ends. The words are set into pages by the browser when
  printed or exported. The status bar's page count is the height of the text
  divided by the page's, so it is close to what prints, not exact.
- **The status bar** shows pages, words (and the selection's share), characters,
  the format painter's state, zoom, and the save state.
- **Saving.** The editor keeps its own undo, as Word does. A beat after each
  burst of typing (300 ms), it hands the finished tree to the project through
  the same `update` every edit uses. Autosave, recovery points and sync
  therefore treat a document as they treat a beat. A change made elsewhere —
  a sync, a recovery point — reaches the page. Save, Save as and Close hand
  over anything still settling first.
- **Undo.** The program's one undo (addendum 02 §6c) gives Ctrl+Z to the
  document, and so do the Edit menu's Undo and Redo, through
  `documentCommands`.
- **Menus.** A word processor's: File (new, open, save, save as, a copy,
  page setup, print, PDF, Word, preferences, close), Edit (undo, redo, find,
  find next, replace), Window and Help.
- **Paste.** Pasted web text is held to the editor's schema, which drops what
  it does not know. *Paste as text* takes only the words. Pictures pasted or
  dropped from another program come in as pictures.

## 5. Conversions

- **Word (.docx), out:** `buildDocumentDocx`, hand-written WordprocessingML
  like `docx-export.ts`.
  - Headings are Heading 1–6, Title and Subtitle are themselves, a quote is
    Quote.
  - Lists are real Word lists (`numbering.xml`). A nested list numbers under
    its parent, and each top-level list starts afresh, or at its own start
    number.
  - Tables carry a header shade and spanning cells.
  - Hyperlinks, pictures (their size read from the file's own header),
    colours, sizes, faces, highlights, alignment, indent, spacing and page
    breaks all carry.
  - The page size, orientation and margins carry too.
- **Word, in:** `docxToDocContent`, over the reader every other import uses
  (`import-docx.ts`).
  - Headings, Title, Subtitle, Quote, emphasis, alignment, indent, list items
    (as bullets), pictures and page breaks carry.
  - The reader now carries a page break standing alone in an empty paragraph
    (Word's own Insert → Page Break) to the next paragraph, where it had been
    dropped. Every importer gains from that.
- **PDF and print:** the editor's HTML in `DOCUMENT_CONTENT_CSS`, the one
  stylesheet the page and the paper share, on the document's paper. It goes
  through the existing `exportPdf` / `print` route as kind `document`. In the
  browser preview it opens in a print window, as the book does.
- **Text:** exported one block to a line; imported one paragraph to a line.

## 6. Proof

- Domain (`document.test.ts`, 18 tests): the format and its card, the empty
  start, save and reopen, revisions, page setup, plain text, word counts,
  headings, every element of the Word file, a picture's proportions, CSS
  colours and sizes, and **a round trip**: a document written to Word XML,
  read back by the shared reader and turned into a document again, every word
  surviving.
- Renderer (`document-workspace.test.tsx`, 9 tests):
  - the Document card on the new-project screen, and the menus
  - the page showing the document and its counts
  - typing reaching the project only once it settles
  - a change from elsewhere reaching the page
  - Bold from the ribbon keeping the selection
  - a heading from the Styles box
  - find, match case, and replace all
  - the app's Undo reaching the document
- Driven in Chromium, from the browser preview: a title, a heading, bold, a
  nested bulleted list, a table typed with Tab, find with highlights,
  landscape, and the navigation pane.

## 7. Limits, and what is next

Not in phase 1, and not shown as buttons:

- footnotes and endnotes (headers, footers and page numbers are built: §15)
- a table of contents, bookmarks and cross-references (WP spec §4.3, "staged")
- comments and tracked changes (WP spec §4.3: only if robustly supported)
- columns and section breaks
- RTF import and export
- style creation and modification (the built-in styles are there)

The DOCX reader does not see tables, a list's kind or its depth, so a Word
table arrives as its cells' paragraphs in reading order and every list as
bullets at one level. Every word arrives. A merged cell's `rowspan` is
written as separate cells.

Next, in the WP spec's order: the Extract & Organize sidebar and custom
palettes (§8), the Outliner tab (§9) and sending extracts to a project
(§10) are built.

## 8. Extract & Organize (WP spec phases 2 and 3)

From Ken: *build the extract and organize sidebar next.*

**The model** (`entities/extract.ts`, `extracts.ts`). Three collections on
the project file:

- `extractPalettes`: a palette is a set of buttons.
- `extractCategories`: a category is one button and the bin behind it. It has
  a label, a colour, an order, an on/off state, and a **kind**: the canonical
  type a later stage maps to a destination (scene, character, plot point…).
- `extracts`: an extract is a captured passage, with the following:
  - a plain-text snapshot, and the rich one as the editor's tree
  - the document revision it was taken at
  - a title (its first words, to start), tags and a status (Unassigned,
    Ready, Exported, Failed)
  - its place in the bin

**General Writing** is the spec's fifteen buttons in its order: Scene, Beat,
Character, Characterization, Dialogue, Description, Location, Object, Plot
Point, Note, Idea, Setup, Payoff, Research, Other. Each has a colour and its
kind. It is added the first time the sidebar opens (`ensureExtractPalettes`),
so documents made before it get it too.

**Where an extract is: a mark, not a position.** The passage is marked in the
document itself, an `extract` mark carrying the extract's id, colour and
label. So it moves with its words however the text around it is edited.
`excludes: ''` lets marks overlap, so one sentence can be a Location, a
Description and a Setup at once (WP spec §5.2, EX-05). `inclusive: false`
means typing at the edge does not grow it. The mark changes no character, and
the Word file ignores it. The capture adds the mark outside the writing's undo
history, so Ctrl+Z after a capture takes back the last thing typed.

**One press, one extract** (WP spec §5.1):

- The buttons take the press on mouse-down and never take focus, so the
  selection survives (the spec's *selection focus rule*). With nothing
  selected they are off and the sidebar says *Select text first*.
- The mark in the page and the copy in the bin go into the project in one
  change, so they can never be saved apart.
- A line confirms each capture: *Added to Character (3)*. There is no dialog,
  so the twentieth capture is as quick as the first (EX-02).
- The same words in the same bin are warned of, not copied twice. In another
  bin they are a separate extract.

**The source text** has three views: **Normal** (tinted in the category's
colour and underlined with dots, so it is told apart by shape as well as
colour), **Gray** and **Hide**. All three are views only: the saved document
is identical under all of them (EX-03), and none of it reaches the printed
page. Hovering a marked passage names its category.

**The bins**, in the sidebar under the buttons:

- One bin per category that has something in it, for this palette or for all
  categories.
- Counts on the buttons and the bins.
- Search over titles, words and tags, and a status filter.
- Each extract's title shows the passage in the page. Each can be renamed,
  given a status, moved to any category in any palette, reordered, or
  deleted after a confirmation.
- *Source changed* when the marked words no longer match the snapshot, with
  *Update from source* to take the new words. The snapshot is never changed
  silently (WP spec §5.2). *Source removed* when the passage has been
  deleted from the document; the extract stays.
- Deleting an extract removes the copy and its mark. Every word of the
  document stays.

**Palettes of your own** (WP spec §5.3, EX-04):

- *New…* names a palette ("Math Instruction") and opens it for editing. Each
  button can be added, relabelled, recoloured, given a kind, moved up or
  down, or removed.
- A palette can be duplicated as the start of another.
- **Nothing is ever thrown away.** Removing a button whose bin holds extracts
  turns the button off and keeps the bin. Removing a palette with extracts
  archives it: the buttons go, and the extracts stay, reachable under All
  categories. General Writing cannot be removed.
- Switching palettes loses no extract and no selection.

**Not yet:**

- palettes shared across every project, and saved presets (the spec's
  scopes)
- a right-click *Extract as…* on the page, and a keyboard shortcut per
  category
- drag-and-drop between bins, merging extracts, and undo for bin-only actions
  (a delete is confirmed instead)
- sending extracts anywhere: built since, in §10

**Proof:**

- Domain (`extracts.test.ts`, 12 tests):
  - General Writing's fifteen categories, added once
  - capture into the matching bin, with overlaps and duplicates
  - twenty captures kept in order
  - save and reopen
  - moving, reordering, editing and deleting, with the document untouched
  - search
  - Math Instruction persisting, duplication, and the never-discard rules
- Renderer (`extract-sidebar.test.tsx`, 9 tests):
  - EX-01 to EX-05, driven through the sidebar
  - the no-selection and duplicate messages
  - *Source changed* and *Update from source*
  - deleting the extract and its mark, and showing where an extract came
    from
- Driven in Chromium: six captures, one line carrying three overlapping
  extracts, Gray, and a four-button Math Instruction palette.

## 9. The Outliner tab (WP spec §6, phase 4)

From Ken: *build the outliner tab next.*

**Two tabs under the ribbon: Document and Outliner.** The Outliner is the
program's own Outliner (`OutlinerWindow`), mounted as a page, so a
document's outline is the same tree, keys and commands as a book's. The
editor stays mounted and hidden while the Outliner shows, so its undo
history and selection survive the trip.

**What the Outliner shows in a document:**

- Kinds are Heading, Note and Idea.
- *+ Heading* adds one beside the chosen row. *+ Subheading* adds one under
  it, which is a level down in the document.
- Promotion, Add to track and the scene card are left out
  (`promotion={false}`), because a document has no track.
- A double-click on a row goes to its heading, or to the passage an extract
  row came from.

**The binding** (`document-outline.ts`):

- Every heading carries a `headingId` for life. The editor's `HeadingIds`
  extension assigns one to a heading that has none, and to the second copy
  that Enter makes when it splits a heading.
- The document records which row stands for which heading in
  `outlineLinks`. The link lives on the document, not the row: rows sync to
  the cloud column by column, and a field the row did not know would be lost
  on the way back. So no migration was needed.
- The outline is made the first time the tab opens (`ensureDocumentOutline`).

**Both directions:**

- **Document → outline** (`outlineFromDocument`, on every save of the
  editor's tree):
  - Every heading has a row, nested as the levels nest, titled with the
    heading's words, in the document's order.
  - A note the writer added stays beside the heading it followed.
  - A row whose heading is deleted becomes a note if anything was written on
    it, and goes otherwise.
  - When nothing has changed it returns the same file, so it is free to run
    on every save.
- **Outline → document** (`documentFromOutline`, on every change made in
  the Outliner):
  - Sections are rebuilt in one change, each a heading and everything up to
    the next.
  - They take the outline's order and titles, and the levels its nesting
    gives.
  - A heading row added in the Outliner becomes a heading.
  - A heading keeps its own level where its parent did not change, so a
    Heading 3 straight under a Heading 1 is not made a 2 by an unrelated
    edit.
- **No text is lost** (OL-01). A heading whose row is deleted stays in the
  document as a paragraph, with its body, after the section it followed.

**Numbering** (WP spec §6: *configurable numbering schemes*):

- The choices are None, 1 / 1.1 / 1.1.1, or I / A / 1 / a / i, with `(1)`
  deeper still. The setting is on the document (`headingNumbering`).
- The number comes from the nesting, so the page and the outline agree.
- On the page the number is drawn in front of each heading as a widget,
  never typed into it, so the heading's words stay the writer's.
- The numbers print, and go into the PDF, the Word file and a text export (§14).

**Extracts into the outline:** *Add to outline* on an extract makes a linked
Note (an Idea for an idea) carrying its words (`linkExtractToOutline`). A
second press finds the row that is already there.

## 10. Sending extracts to a project (WP spec §7, §9)

From Ken: *there should be an ability to select a project. So if there's an
existing project that you have, it should show up in the list … you can
export it directly to a certain project.*

**Where to start a send:** *Send…* on any extract, or *Send all…* (or *Send
N…* while filtering) at the top of the bins.

**The destination dialog:**

- **To:** this project, or any project on the list of the writer's projects
  (`listProjects`, the same list the Projects page uses). The open project is
  not offered twice: a list entry that turns out to be the same project is
  treated as this one.
- **The preview** says where each extract will land in that project:
  *Research › Characters*, *A new scene*, *A beat in "The Harbour"*. The
  preview is the send done on a copy (`planTransfer` runs `applyTransfer`),
  so it cannot say one thing while the send does another.
- **Copy** (the default) or **Move.** A move takes the extracts out of the
  bins and their marks off the page. Every word of the document stays (WP
  spec §7.1).

**The mapping** (`transfers.ts`), by the target's shelf system keys, never
by a category's label:

| Extract kind | Lands in |
| --- | --- |
| Character, Characterization | Research › Characters |
| Location | Research › Locations |
| Object | Research › Props |
| Plot point | Research › Plot Points |
| Idea | Research › Ideas |
| Setup, Payoff | Research › Setups & Payoffs, where the project has it |
| Scene | A new scene in a script; in prose, a beat in the last chapter (a new chapter if there is none) |
| Beat | A beat in the last scene or chapter |
| Anything else, or no such shelf | Research › Notes, made if missing; the preview marks it *no shelf of its own there* (TR-02) |

- A Document or instructional target has shelves only, so its scenes and
  beats go to Notes.
- A research item carries the extract's words and tags. Its source reads
  *From "Notes" in My Project*: the credit is kept, and the copy is
  independent (WP spec §9).

**Safe to retry** (WP spec §9, TR-03):

- Another project is read without opening it (`readProject`) and written
  back with `sendIntoProject`, which refuses if the file has changed since it
  was read.
- A recovery point of the target is taken first, with the new reason
  `pre_transfer` (*Before extracts were sent in* in Recovery).
- Receipts are recorded here only after that write succeeds. A failure says
  why and records nothing.
- Each extract keeps a receipt per send (`sentTo`: project, file, area, the
  id of what it became, when). Its status becomes Exported, and the bin
  shows *Sent to The Lamp › Research › Locations*.
- A second send to the same project skips what went before, unless the
  writer ticks *Send … again, as new copies*.

**Not yet:** nothing from this list; picking files, adding to items and the
bundle are in §11, and sending outline rows is §13.

**Proof:**

- Domain:
  - `document-outline.test.ts`, 10 tests: OL-01; renames, reorders and
    deletions both ways; no-op detection; level keeping; numbering; extract
    rows.
  - `transfers.test.ts`, 3 tests: TR-01 with ten mixed extracts to a
    screenplay, TR-02's Notes fallback, TR-03, and a move.
- Renderer (`document-outliner.test.tsx`, 7 tests):
  - the tab, reordering and renaming through the Outliner, and numbering
  - a send to another project through stubbed bridge calls
  - a failed write recording nothing
  - a move into this project
  - *Add to outline*

## 11. Destinations (WP spec §7.1, §7.2, §9)

From Ken: *build the destinations next.*

§10 sent each extract where its kind said. This stage lets the writer say
otherwise, and adds the portable files the spec lists.

**Each row has its own destination** (`destinationOptions`, `choiceFromKey`).
The *Into* list for a row offers every place in the chosen project:

- every research shelf there, in its order
- a new scene (a new chapter in prose)
- a beat in any scene or chapter, by name

The kind's choice is preselected, so a writer who changes nothing gets §10's
result. A shelf the send will make (Notes, or a button's default shelf)
appears as *(new shelf)*.

**New, add to, or replace** (WP spec §9: *Create New / Append to Existing /
Replace, with explicit confirmation; never overwrite silently*). A row going
to a shelf that has items gets a second list:

- **A new item.** This is the default.
- **Add to an item.** The extract's words go after the item's own, separated
  by a blank line, and the tags merge.
- **Replace an item's words.** The Send button stays off until a checkbox
  confirms it, and the box names how many items will be replaced and where.
  In another project the recovery point from §10 holds the old words; in
  this one, Undo does.

The receipt names the item and what happened to it: *Research › Locations ›
"The house" (added to)*.

**A default shelf on each button** (WP spec §5: *default destination*). In
the palette editor every button has a *Shelf* box. When it is filled in, the
button's extracts go to that shelf by name, and the shelf is made in the
target if it is missing. So Math's *Multiplication* can land on a *Times
tables* shelf of the book (the spec's own example). When it is empty, the
kind decides. A per-row choice in the dialog still wins.

**Browse…** beside the project list chooses a project file anywhere
(`pickProject`) and adds it to the list without opening it. In the browser
the chosen file is copied into the browser's library, which is where its
projects live, and the send writes to that copy.

**The portable bundle and the CSV** (`extract-bundle.ts`, WP spec §7.2).
They sit under the bins and use what the bins are listing, so a search or a
status filter narrows them:

- **Export bundle:** a versioned JSON file (`vcwriter.extracts`, version 1)
  holding the extracts with their text, tags and receipts. Each extract's
  whole palette travels with it, buttons, kinds, colours and default shelves
  included.
- **Import bundle…** puts one into this document.
  - A palette of the same name is joined rather than repeated, as is General
    Writing, and a button of the same label inside it is reused.
  - An extract already here, by id, is skipped, so importing twice adds
    nothing.
  - Imported extracts have no passage in this document, so each shows
    *Source removed* and keeps its words.
  - A bundle from a newer version is refused in words rather than guessed at.
- **Export CSV:** one row per extract (title, category, palette, kind,
  status, tags, sent to, captured, text), quoted so a spreadsheet reads
  commas and line breaks. It is for review, not a way back in.

**Not yet:**

- a shared, cross-install service for direct handoff (the bundle is how
  extracts move between installs today)

**Proof:**

- Domain:
  - `transfers.test.ts`, 3 new tests: the destination list; sending to a
    chosen shelf and into a chosen scene; append and replace; a button's
    default shelf, made once.
  - `extract-bundle.test.ts`, 3 tests: a round trip that joins palettes and
    imports once; refusing a non-bundle and a newer version; CSV quoting.
- Renderer (`document-destinations.test.tsx`, 4 tests):
  - a row sent to Themes instead of Locations
  - add to an existing item, with replace held back until confirmed
  - Browse
  - importing a bundle, twice, adding once

## 12. The bin report (WP spec §7.2)

From Ken: *build the bin report PDF next.*

**Report PDF** and **Print report** sit under the bins, beside the bundle
and CSV buttons. Both use what the bins are listing, so the scope, status
and search narrow a report the same way they narrow an export. That gives a
report of everything Ready, or of every extract matching "harbour".

**The page** (`bin-report.ts`):

- **A title** (*Story Notes: extracts*), and under it a line saying how many
  extracts in how many bins, the date, and the filters in force: the
  palette, the status, the search.
- **A count by bin**, with how many in each are Ready and how many Exported,
  when there is more than one bin.
- **Each bin under its own heading**, in the sidebar's order and in the
  bin's colour, with its palette's name. Each extract in it shows:
  - its title, where that is more than its first words
  - its words, set off by a rule in the bin's colour, line breaks kept
  - its status, tags, every project it was sent to and where, and the day
    it was captured
- **The document's own paper and margins**, so the report prints on the
  same stock as the writing it came from.
- An extract is never split across a page, and a bin's heading is never left
  at the foot of one.

It goes through the same print and PDF path as the document (a new `bins`
print kind on both hosts). The PDF is named *Story Notes extracts.pdf*. In
the browser it opens the print window, as the document does.

**Proof:**

- Domain (`bin-report.test.ts`, 3 tests): bins in listed order with the
  count table; the writer's words escaped, with status, tags and receipts;
  only what is listed, the filter said, on the document's paper.
- Renderer (`document-destinations.test.tsx`, 1 new): a search narrows the
  report, the PDF is asked for with the `bins` kind, and the saved path is
  reported.

## 13. Sending outline rows (WP spec §6)

From Ken: *build sending outline rows next.* The spec's line is *send
outline nodes into the appropriate authoring destination*.

**Send…** sits in the Outliner tab's toolbar, beside Delete, and acts on the
same selection. A row goes with everything under it. Choosing a row and its
parent sends the parent once, with the row inside it.

**The same dialog as extracts** (`SendExtractsDialog` with a `rows`
subject):

- the same project list and Browse
- the same per-row *Into* list, with new, add to or replace for shelves
- the same preview, made by doing the send on a copy
- the same refusal when the target changed, and the same recovery point
- no second copy unless asked

What differs: a row is only ever copied, so there is no Move. The outline
and the document are untouched, and the dialog says so.

**What a row becomes** (`outline-transfer.ts`):

| Row | Into a story (script or prose) | Into a Document project | Anywhere else |
| --- | --- | --- | --- |
| Heading | A new scene (a chapter in prose) | Its whole section at the end of that document | A research note with the section's words |
| Note | Research › Notes | Research › Notes | Research › Notes |
| Idea | Research › Ideas, else Notes | Research › Ideas, else Notes | Research › Ideas, else Notes |

**A heading as a scene:**

- The row's own notes become the scene's summary.
- The words under the heading in the document, up to the next heading,
  become its first beat.
- Each subheading becomes a beat after it, titled with the subheading. The
  beat carries the subheading's words and anything nested deeper.
- A note or idea hanging under the heading goes into the scene's notes as
  *title: words*.

**A heading into another document:** its whole section, down to the next
heading at its level, goes on at the end of that document as it is written.
Its heading ids are left behind, so the target gives its own, and so are its
extract marks, which belong to this document's bins. A target that is only
an empty page is replaced rather than appended to.

**Pointing a row elsewhere.** The *Into* list offers:

- the end of the target's document (for a Document project)
- every shelf
- a new scene
- a beat in any scene, which puts the row and everything under it into one
  beat

On a shelf, the item's words are the row's notes, then its section, then
each row under it with its title.

**Receipts** are kept on the document (`rowReceipts`), not on the row,
because rows sync column by column. When a row is chosen in the Outliner,
its receipts show under its notes: *Sent to The Lamp › A new scene*.

**Proof:**

- Domain (`outline-transfer.test.ts`, 5 tests):
  - a heading becoming a scene with its summary, opening beat, a beat per
    subheading, and notes
  - a section appended to another document, without its ids or marks
  - notes and ideas onto their shelves, and a nested row sent once
  - a row pointed at a beat in a chosen scene, and at a shelf
  - receipts, and a second send skipped unless asked
- Renderer (`document-outliner.test.tsx`, 1 new): Send… off until a row is
  chosen; no Move; the row lands as a scene in another project; the
  message; the receipt under the row.

## 14. Heading numbers on paper

From Ken: *build printing the heading numbers next.*

§9's numbering was drawn on the screen only. The numbers now go everywhere
the document goes, and all from the one numbering (`headingNumbers`), so
paper, file and screen cannot disagree:

- **Print and PDF** (`numberHeadingsHtml`, called by `documentPrintHtml`).
  - The editor draws its numbers as decorations, which its HTML does not
    carry, so they are set back into that HTML by heading id.
  - The number goes in front of the heading's words with the same space the
    screen leaves (`.wp-heading-number`, now in the shared stylesheet).
- **The Word file** (`documentBodyXml`).
  - Each numbered heading starts with its number and a tab, then its words,
    in its Heading style.
  - The numbers are typed text, not a Word multilevel list. Word numbers a
    list by style level, so a Heading 3 straight under a Heading 1 would be
    1.0.1 there and 1.1 here. Typed numbers keep the file as the writer saw
    it. Moving a heading in Word does not renumber it.
- **Plain text** (`numberedPlainText`): each heading line starts with its
  number.

The heading's own words never change. The numbers are put in on the way out.
Word counts and search use the words without numbers, as before.

**Proof:**

- Domain (`heading-numbers-output.test.ts`, 4 tests):
  - numbers in front of each heading in the print HTML, both schemes, and
    none when unnumbered
  - number and tab in the Word XML
  - the text export
- Renderer (`document-outliner.test.tsx`, 1 new): with 1.1.1 numbering
  chosen, the HTML the real editor hands to the PDF carries each heading's
  number.

## 15. The Word basics, checked

From Ken: *make sure that … zoom … fit the page … insert a table or pictures
or shapes … headers and footers and page numbers … lines, page breaks,
margins … alignment … bullet points, numbers, the outlining stuff,
indention … font size … a font library … dictate or listen back … standard
print menu, export menu.*

**What was already there:**

| Asked for | Where |
| --- | --- |
| Zoom slider | Status bar, 50–200% |
| Table | Insert › Tables, with rows, columns, merge, split, header row |
| Pictures | Insert › Picture…, also by paste or drop |
| Lines | Insert › Horizontal line |
| Page breaks | Insert › Page break, Layout › Breaks, Ctrl+Enter |
| Margins | Layout › Page setup: presets and each side in inches |
| Alignment | Home › Paragraph: left, centre, right, justify |
| Bullets, numbers | Home › Paragraph: bullets, 1-2-3, a-b-c, i-ii-iii |
| Outlining | Tab and Shift+Tab nest lists; the Outliner tab (§9) |
| Indent | Home › Paragraph: decrease and increase indent |
| Font size | Home › Font: 8 to 72 pt |
| Print, export | File › Print…, Word (.docx), PDF, Plain text |

**What is new:**

- **One page and Page width.** These are in View › Zoom and beside the
  status bar's slider. The zoom follows the window as it is resized; moving
  the slider or choosing a percentage takes back control.
- **Shapes.** Insert › Illustrations › Shapes offers rectangle, rounded
  rectangle, oval, triangle, diamond, pentagon, star, right arrow, line and
  speech bubble, in Word's eight fills or outline only. Each shape is drawn
  as SVG and inserted as a PNG picture at twice its size (`shapes.ts`), so
  the printed page, the PDF and the Word file all carry it as they carry a
  photograph. Pictures and shapes now have Word's corner handles: drag to
  resize, keeping their proportions. The width is saved and exported.
- **Headers, footers and page numbers** (`document-pages.ts`). Details
  below.
- **The font library** (`fonts.ts`).
  - The list is grouped as Word's is: Serif, Sans serif, Monospace, Script
    and display. About 55 common faces from Windows and macOS are included.
  - Only faces installed on this computer are listed. Each is measured
    against its fallback; none is offered and then drawn in something else.
  - *All fonts on this computer…* lists every installed font by family,
    through the browser's Local Font Access. The browser asks once; the app
    allows it.
  - A face already used in the document stays in the list even on a
    computer without it.
- **Dictate and Read aloud**, in Review › Speech (`speech.ts`).
  - Dictation uses the program's own recogniser (`dictation.ts`) and types
    at the cursor. The status bar shows what is being heard. Where this build
    has no speech service, the writer is told which keys start the operating
    system's dictation, which types into the page directly.
  - Read aloud uses the computer's voices. It reads the selection, or from
    the cursor to the end, one paragraph at a time, selecting each paragraph
    as it is read. Speed and voice can be chosen. Pressing the button again
    stops it.

### Headers, footers and page numbers

**The model.** A document has a header and a footer, each with left, centre
and right slots, as Word's default header has. A slot is text that may hold
fields:

- `{page}`: the page number
- `{pages}`: the number of pages
- `{title}`: the document's title
- `{date}`: the date printed

*On the first page too* can be switched off (Word's *Different first page*).
They live on the document as `headerFooter`.

**Writing them.**

- Insert › Header & footer opens a bar under the ribbon with the six slots.
  Its *Insert* buttons put a field at the cursor of the slot last typed in.
- Insert › *Page numbers* is Word's gallery:
  - bottom centre
  - bottom right
  - bottom right as *Page 1 of 3*
  - top right
  - top centre
  - none

  Choosing one moves the numbers rather than adding a second set, and
  *none* leaves a running title alone.

**On screen.** The header is drawn in the first page's top margin and the
footer in the last page's bottom margin, with the fields filled in. A
double-click on either opens the bar. The screen is one long sheet, not set
into pages, so the pages in between show theirs only on paper.

**On paper (print and PDF).** The slots are the page's own margin boxes,
`@page { @top-left { content: … counter(page) … } }`. The browser that sets
the pages also numbers them, so each page's number is the page it is on.

- The desktop's Chromium 130 has margin boxes built in, but behind a switch.
  The app turns that switch on at start (`PageMarginBoxes`). This was tested
  under the app's own Electron: with the switch, each page printed its
  header and "Page 1 of 5", and without it nothing printed.
- The browser preview needs no switch: Chrome has had margin boxes on since
  131.

**In Word.**

- The Word file has real header and footer parts (`header1.xml`,
  `footer1.xml`), referenced from the section.
- Each part is one paragraph with Word's centre and right tab stops, so
  the slots sit where Word puts them.
- `{page}` and `{pages}` become Word's PAGE and NUMPAGES fields, so they
  keep counting as the writer edits in Word.
- *On the first page too* off is Word's `titlePg`.
- Checked by opening a generated file in LibreOffice: every page carried
  the title, the date and "Page N of 4".

**Proof:**

- Domain (`document-pages.test.ts`, 5 tests):
  - the page-number gallery: moving the numbers, taking them out, the
    running title kept
  - fields filled for the screen
  - margin boxes with counters and escaped quotes
  - the bare first page
  - Word's header and footer parts and the section's references
- Renderer (`document-features.test.tsx`, 7 tests):
  - a footer written with a field, shown on the page, and printed in the
    margin
  - the page-number gallery in and out
  - a shape inserted at its size in the chosen fill
  - One page and Page width
  - the grouped font list, and the computer's own fonts
  - reading aloud a paragraph at a time from the cursor
  - dictation typed at the cursor

## 16. Word's look, and a right-hand menu

From Ken: *for the new document section, I don't want anything in it. I just
want to take out the tracks. I don't want it to look like the other modules. I
want it to look just like a word processor, just like Microsoft Word. It can
have the functions where you have research and things… And then it'll have the
functions that we talked about in a right-hand vertical menu along the
right-hand side.*

- **No tracks, ever.** Documents are not in the sync tables, so a Document
  project made on the phone or brought down from the cloud arrived with no
  document, and the workspace fell back to the story workspace with its
  tracks. `withMainDocument` gives such a project its empty page, and the
  app adds it on open; meanwhile the window shows an empty body, never the
  story workspace. (Documents still do not sync: that is its own change.)
- **Word's look.** A Document project's window carries `wp-mode`, which sets
  Word's light scheme whatever scheme the program wears: a blue title bar,
  a light ribbon with flat tools and an underlined active tab, a grey canvas
  with the white page on it, a light status bar and a quiet page bar. Only
  CSS variables change, so every part that reads them, Research included,
  follows.
- **The right-hand menu** (`DocumentRail`). One column down the right edge,
  icon over label:

  | Item | Does |
  | --- | --- |
  | Document, Outliner | The two views, as tabs (they were a row above the page) |
  | Navigate | The headings pane |
  | Research | Opens Research over the document |
  | Extract | Extract & Organize (it was at the ribbon's right end) |
  | Sources | The library and the citation style |
  | Cite | Insert a citation at the cursor |
  | Find | Find in the document |

  Dictate and Read aloud stay on the ribbon, where Word keeps Dictate.
- **Research works in a document.** The title bar's Research button set a
  flag that only the story workspace read, so in a document it did nothing.
  The window is now drawn over the word processor too, opened from the menu.

## 17. The document in the cloud

From Ken: *you mentioned that opening in one computer or another, the file comes
out blank… let's fix that first so I can start working in the program on
different computers.*

A Document project's document — and the extracts taken from it, with their
palettes and buttons — were never in `SYNC_TABLES`. A project brought down from
the cloud on a second computer arrived with no document (§16 then gave it an
empty page), and a Document project made on the phone was made without one.
Nothing was lost on a computer that already had the file: the merge keeps
`...local` for what it does not carry.

- **Four collections now sync**: `documents`, `extractPalettes`,
  `extractCategories`, `extracts`, into `wp_documents`, `wp_extract_palettes`,
  `wp_extract_categories` and `wp_extracts` (migration 0073). Each row holds
  the record **whole as `data`**, beside `id`, `project_id`, `created_at` and
  `updated_at`, so a field added to a document later travels without another
  migration. A category and an extract carry no project of their own; the
  row's `project_id` is the file's, and is dropped again on the way back.
- They merge like every other record (`mergeProjects`), and the phone's
  *new project* route writes a Document project's document with the rest.
- `sync-documents.test.ts`: the round trip is exact, the row keeps the record
  whole, and a project merged from the cloud has its words.
- Still not in the cloud: pictures (`assets`), import batches, and the game
  collections, which VC Game Studio keeps.

## 18. Footnotes and endnotes

From Ken: *let's start with number three. Let's get the word processor going.*
The first of §7's list.

- **The writer's own note** is an inline node, `footnote`, holding its words
  (`id`, `kind: foot | end`, `text`), so it moves, copies and undoes with the
  sentence it hangs on. Its HTML is an empty `<sup data-footnote data-kind
  data-note>`.
- **References ▸ Footnotes**: *Insert footnote* (Ctrl+Alt+F, Word's key) and
  *Insert endnote* (Ctrl+Alt+D). A small box takes the note's words and
  whether it is a footnote or an endnote; a click on a marker in the page
  opens it again to change it, turn it into the other kind, or remove it.
  *Replace…* in a document's Edit menu moves to Ctrl+H, Word's key, to free
  Ctrl+Alt+F.
- **One sequence at the foot of the page**, as Word keeps: a footnote style's
  citation notes and the writer's footnotes are numbered together, 1, 2, 3,
  in the order they stand (`withWriterNotes`, keys `fn:<id>` beside the
  citations'). Endnotes are their own sequence, i, ii, iii.
- **Where they are set.** On the screen's page view and in print and PDF,
  footnotes stand at the foot of their page under a short rule, by the same
  page setter citations use (addendum 43 §23, §25); endnotes stand at the end
  under *Endnotes*, before the bibliography. In Word they are Word's own
  footnotes and endnotes (`footnotes.xml`, `endnotes.xml`, lower-roman
  endnote numbering).
- Not yet: endnotes are shown at the end in print, PDF and Word but not on the
  screen's page view; Word's footnotes imported still arrive as citations
  (addendum 43 §9).
