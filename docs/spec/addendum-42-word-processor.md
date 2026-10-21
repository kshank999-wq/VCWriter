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
The title bar keeps Research and drops the story rooms (Sculptor, Outliner,
the note sorter, Focus). The page tabs are Home, Write, Account and
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

- headers and footers, page numbers, footnotes and endnotes
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
- **Not yet:** the numbers do not print or go into the Word file.

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

**Not yet:** sending outline rows themselves. The rest of what was listed
here is built in §11.

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

- the bin report as a PDF
- sending outline rows
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
