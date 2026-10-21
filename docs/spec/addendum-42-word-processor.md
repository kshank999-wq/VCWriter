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

Next, in the WP spec's order:

1. **The Extract & Organize sidebar**: select, press a category, and the
   passage is an extract in a bin, with the source marked, greyed or hidden.
2. **Custom palettes.**
3. **The Outliner tab.**
4. **Sending extracts** to Research, the cast and the scenes of this project
   or another.
