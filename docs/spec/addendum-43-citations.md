# Addendum 43 — Citations and references

From Ken: *For the instructional module, I want to include a citations
function.* The spec is his *VC Writer Citations & References Development Spec
v1*: a Reference Library entered once, citation markers inserted into the
text, footnotes generated at the foot of the page, a bibliography built and
kept current, and headers and footers for instructional publishing.

## 0. The plan, in phases

| Phase | What | Status |
| --- | --- | --- |
| 1 | The Reference Library; inserting, changing and removing citations; styles; cloud sync | **built** (§1–§7) |
| 2 | Footnotes at the foot of each page in Layout; the bibliography generated as back matter | **built** (§8) |
| 3 | Export: Word footnotes and bibliography, EPUB notes; footnotes read from Word | **built** (§9) |
| 4 | The header and footer gaps against spec §6 (author, date and custom fields, per-section restart, first page per section) | **built** (§10) |
| 5 | The Document (word-processor) module sharing the library | **built** (§11) |

**What already existed.** The Layout room (addendum 20) had measured pages,
running heads (the book's title on the verso, the chapter's on the recto),
folios, Roman front matter restarting in Arabic for the body, and no running
head on chapter openings or front-matter parts — most of spec §6. A
`bibliography` back-matter part existed with sources typed into the part
itself (`back-matter-pages.ts`); phase 2 feeds it from the library. There were
no footnotes anywhere.

## 1. The model

**A reference** (`entities/reference.ts`) is a source's facts, apart from
any way of printing them:

- a kind (book, chapter in a book, journal article, website, report,
  interview, video, other)
- an optional short code (R12, Smith2024) that is the writer's and never
  printed
- authors and editors, one *Last, First* a line, and an organisation for a
  body as author
- title, *published in* (the journal, the book, the website, the channel),
  publisher, place, edition, date (2024, 2024-03 or 2024-03-15), volume,
  issue, pages, DOI, URL, accessed, ISBN, notes and tags
- archived, or not

**A citation** is one place a source is cited: which source, a pinpoint
(page, pages, section, chapter, paragraph, time, other) and the writer's own
note.

**Where a citation stands is a token in the text**: `[^ab12cd]`, typed into
the manuscript line at the insertion point. The manuscript is plain text with
its emphasis written as marks (`entities/inline.ts`), and a citation is
written the same way. So:

- it moves with its words however the paragraph is edited, split or moved
- undo and redo restore it with the text, so no citation is ever left
  dangling by an undo
- the printed 1, 2, 3 is never stored. It is worked out from the order of
  the tokens every time it is drawn, so inserting, moving or deleting a
  citation renumbers everything after it with nothing to run. This is the
  spec's design note: *internal source IDs and printed markers are distinct*.

The token is six hex characters rather than the citation's id because it is
typed into the line itself: the manuscript's lines are text boxes with their
styling drawn underneath, so every character of a token takes room on the
screen. Six characters (16 million keys) are unique in a project;
`insertCitation` makes sure of it, and the database enforces it.

The inline parser reads a token as one span that prints nothing on its own
(`citation` on `InlineSpan`). A renderer that does not know about
citations prints nothing for one rather than its characters; that is now only
the manuscript's own print and pagination. Layout and its PDF learned them in
phase 2 (§8), and the eBook and Word in phase 3 (§9).

## 2. The library (spec §3)

`citations.ts`:

- **Add, edit, duplicate, archive.** Archive takes a source out of the
  pickers and keeps it printing for every citation already made.
- **Delete** is refused while anything cites the source, so no citation is
  ever left pointing at nothing.
- **Search** over short code, people, organisation, title, container, date,
  DOI, ISBN and tags; filter by kind and by tag.
- **Merge duplicates.** Sources with the same DOI, the same ISBN, or the same
  title by the same first author are offered as possibly the same. Keeping
  one points every citation of the others at it, fills its empty fields from
  theirs, joins their tags, and removes the others.
- **Checks**, field by field and in words: a DOI is 10. and a number then a
  slash; a web address starts https://; a date is 2024, 2024-03 or
  2024-03-15; an ISBN has 10 or 13 digits; a source needs a title.
- **Fields by kind** (`REFERENCE_FIELDS`). A journal article asks for volume
  and issue, a website for when it was read, a chapter for the book it is in
  and that book's editors. Labels change with the kind: *Article title* and
  *Journal*, *Interviewee* and *Interviewer*.

## 3. Styles (spec §5)

`citation-style.ts` writes the same facts four ways:

- **Chicago Notes & Bibliography**, the default and footnote-first.
  - A source's first note is full: *Jane Smith,* The Shape of Things *(Chicago:
    University of Chicago Press, 2020), 12.*
  - Later notes are short: *Smith,* The Shape of Things*, 15.*
  - The bibliography entry: *Smith, Jane.* The Shape of Things*. Chicago:
    University of Chicago Press, 2020.*
- **APA**, which cites in the text: *(Smith, 2020, p. 12)*; *(Jones & Lee,
  2019)*; three or more authors as *et al.* Its reference list is headed
  *References*.
- **MLA**, which also cites in the text: *(Smith 12)*. Its list is headed
  *Works Cited*.
- **Custom**: footnotes with the writer's choice of marker, the notes written
  in Chicago, APA or MLA form.

APA and MLA are **not** turned into footnotes (spec §5: *must not be
misrepresented as footnote-native*). Their citations print in parentheses
where the token stands, and the marker settings do not apply to them.

**Markers** are 1, 2, 3; a, b … z, aa; or *, †, ‡, §, ‖, ¶, then either doubled
(**, ††) or carrying on in numbers. They count through the whole book or from
1 in each chapter.

**The bibliography** lists one entry per source however often it is cited.
It lists the sources cited, or the whole library; by author A to Z, or in
order of first citation. Its heading is the style's own or the writer's.

The output is text in the manuscript's own inline marks (`*Title*` for
italics). Every renderer that already draws the manuscript's emphasis
therefore draws a style's italics. A source's own asterisks and underscores
are escaped so they print as themselves. Chicago and MLA put commas and full
stops inside closing quotation marks; APA sets a comma before its ampersand.

## 4. Inserting and changing citations (spec §2, §4)

On an **instructional book** (and on nothing else):

- **Cite** on the writing toolbar, **Insert citation…** on the right-click,
  and **Ctrl/Cmd+Shift+C** open *Insert citation*. The marker goes at the
  cursor, or after the words picked.
- **The dialog**:
  - search the library, or make **New source…** from the words typed and
    fill it in there
  - choose a pinpoint kind and value, and add a note of your own
  - see the note (or the in-text citation) exactly as it will print, a full
    note where this is the source's first citation
  - double-click a source to insert at once
- **In the line**, the token is drawn as a chip in the gold with its marker
  raised at its start. The chip keeps the token's room, so the text box above
  lines up to the letter. A citation whose record or source has gone shows
  red with a *?*.
- **A click on a chip** opens the same dialog for that citation:
  - change its source (*Change Source*), pinpoint or note
  - **Edit source…**, where every citation of the source changes with it
  - **Remove citation**, which takes the marker out of the line and leaves
    the source in the library

## 5. References, in Research

**References** sits under *Table of contents* in the Research side menu, on
an instructional book. It has three tabs:

- **Library.** The list, with search, kind, tag and an *Archived* switch, and
  how often each source is cited. The chosen source's form is beside it, with
  Duplicate, Archive or Restore, and Delete (off while cited). Below the list
  are groups of possible duplicates, each with *Keep this one*.
- **How the book cites.**
  - style
  - Custom's note form
  - markers, and what follows ¶
  - counting per book or per chapter
  - bibliography scope, order and heading
- **Notes & bibliography.** Every note in order, or every in-text citation for
  APA and MLA, and the bibliography with hanging indents. It is rebuilt as
  anything changes.

A warning above the tabs counts any citations that have lost their source.

## 6. Sync

The citation tokens live in the manuscript, which syncs, so the library must
sync too, or another device would read citations of nothing.

- **Migration `0068_reference_library.sql`:**
  - `reference_sources` holds the facts as `metadata` jsonb, with
    `short_code`, `tags` and `archived_at`. `references` is a word SQL keeps
    for itself, hence the table's name.
  - `citations` holds `reference_id`, `key`, the pinpoint and the note, with
    the key unique in its project and checked for shape.
  - Each table has one read policy and three write policies on
    `may_read_project` and `may_write_project`, as 0046 does.
- **Applied to the live project.** The performance advisor raises only
  *unused index* on the new, empty tables. The security advisor raises
  nothing about them.
- **The settings** go in the project's `settings.citations`, which already
  syncs with the project row.
- **In the sync code**, `SYNC_TABLES` lists `references` before `citations`,
  since a citation's row names its source's, and the two are mapped in
  `sync-mapping.ts`.

## 7. Proof

- Domain (`citations.test.ts`, 14 tests), from the spec's acceptance tests:
  - one source cited three times is three linked notes and one bibliography
    entry
  - changing the source's author and title changes every note and the entry
  - inserting and removing citations between others renumbers them
  - switching style or markers re-renders everything and leaves the sources
    untouched
  - the marker schemes and their overflow, and counting per chapter
  - search, archive, duplicate, the refused delete, duplicates found and
    merged, the field checks, and a dangling citation shown rather than
    dropped
  - exact Chicago, APA and MLA output for a book and a journal article, and
    escaping
- `sync-references.test.ts`: the round trip, and sources pushed before
  citations.
- Renderer (`citations.test.tsx`, 6 tests):
  - inserting from the right-click, with a new source made in the dialog
  - inserting from the toolbar and from Ctrl+Shift+C, the markers renumbered
    by place
  - offered on a book and not on a screenplay
  - a click on a marker opening it to change the pinpoint
  - removing one
  - References: adding and checking a source, the preview of notes and
    bibliography, and a change of style re-rendering it

## 8. In the printed book (phase 2)

The Layout room, and the PDF it exports, which is the same pages.

**In the line.**
- Chicago and Custom raise the marker where the token stands
  (`<sup class="bk-cite">`). It is set at `line-height: 0`, so the line it is
  in keeps the leading and stays on the grid the cutter counted.
- APA and MLA set the parenthetical there instead. Where the token was typed
  against the word before it, a space comes first.
- The markers are in the markup the measuring box sets, so a line that a
  marker or a parenthetical pushes over is measured as pushed over.

**At the foot of the page.**
- A page's notes sit on the foot of the text block, above the folio in the
  margin, under a short rule. The type is smaller and closer than the text.
- Their place is measured, not guessed. The typesetter reads two things back
  (`book-typeset.ts`, `NotePlacements`):
  - the line of its block each marker fell on, from the raised marker's own
    box
  - how tall each note sets at the measure, as a fraction of the body's
    leading
- The cutter (`layPages`) keeps the lines a page's notes need, rule and all.
  A page's notes are added up before rounding to whole lines (`noteLines`),
  so three short notes are not three lines.
- A note goes on the page its marker is on, whole. When a marker's line would
  leave its note no room, the line goes over to the next page and the note
  with it. When a paragraph breaks across pages, each note follows its own
  line.
- A page's depth counts its notes, so a spread is balanced on what each page
  holds.
- A note taller than a whole page is set and clipped on its marker's page,
  rather than turning pages for ever. Chicago would carry it on to the next
  page; that is not built.
- The note's head is *1.* or *a.*, and a symbol prints bare (*, †).

**The bibliography page.**
- The back matter's *Bibliography* is made from the References library
  (`bibliographyLines`), in the book's style and order, with hanging indents,
  and kept current as sources and citations change.
- It is headed as the style heads it (*Bibliography*, *References*, *Works
  Cited*, or the writer's heading), unless the page was given a title of its
  own.
- The page's card in Layout has **From the References library**, on by
  default. Off, or with nothing in the library, the page prints the sources
  typed on it, as it always did. Those typed sources wait unprinted while the
  library is used, and the card says so.
- References → *Notes & bibliography* says whether the book prints the list,
  with **Add it to the back matter** where it has no bibliography page.

**Proof.**
- `citation-pages.test.ts` (12 tests) covers:
  - the lines kept for notes, and notes added up before rounding
  - a note following its marker's line onto the second page
  - a marker's line sent over when its note will not fit under it
  - a note taller than a page not stranding the cutter
  - a book with no citations laid exactly as before
  - the raised marker and the first full note and second short note in the
    page's markup
  - APA's parenthetical with its space, and no notes
  - symbol markers
  - the library's bibliography in Chicago and APA with the APA heading,
    current after an edit, and the typed sources when switched off or with
    an empty library
- The renderer test adds the bibliography to the back matter from References.
- Seen in Chromium: two citations raised in the line, their notes under the
  rule at the foot of the page above the folio, and the bibliography page in
  the back matter.

## 9. Leaving the book, and coming back (phase 3)

**The book in Word** (`book-docx.ts`).
- A book had no Word export at all; the script's (`docx-export.ts`) is a
  script's page. A book's is now its manuscript as Word expects one:
  - Times New Roman at 12 point, double spaced, on a Letter page with 1-inch
    margins, and page numbers in the footer
  - the title page, the copyright page and each chapter on a new page, under
    a *Heading 1* that Word's navigation lists
  - the front and back matter the book has
  - pictures, the contents page and the index are left out: Word builds its
    own contents, and an index is page numbers this document does not have
- **Chicago and Custom**: each marker is a real Word footnote
  (`footnotes.xml`), the first citation of a source in full and the rest
  short, the titles in italic.
  - Word numbers them in the book's scheme: `decimal`, `lowerLetter`, or
    `chicago` for *, †, ‡, §.
  - A book counting per chapter has a section per chapter, so Word restarts
    at each.
  - An editor's added note renumbers the rest, as in any manuscript.
- **APA and MLA**: the parenthetical in the line, and no notes.
- **The bibliography** is the back matter's page where the book has one,
  made as Layout makes it. Where the book has none and the library has
  entries, it is added at the end under the style's heading. Each entry has
  a hanging indent in Word's *Bibliography* style.
- It is offered as **Export as Word…** in the Layout room, and as **Export
  Word document…** on the File menu of every book as well as every script.

**The book as an EPUB.**
- Chicago and Custom link each marker to its note (EPUB 3's
  `epub:type="noteref"`, which most readers open as a pop-up), and each note
  back to its marker.
- The notes follow their own chapter, under a short rule. A reflowable book
  has no page foot to put them at.
- APA and MLA set the parenthetical in the line.
- The bibliography page reaches the eBook as the back matter does, made from
  the library.

**Footnotes read from Word.**
- On importing a Word document as an **instructional book**, each footnote
  reference becomes a citation token where it stood. Its words come from
  `footnotes.xml`, with their italic and bold.
- Each distinct note is a source, and each place it was cited is a citation
  of it. The same note twice is one source cited twice.
- A Word footnote is one line of text with its parts run together, so the
  source is kept **as written** (`asWritten`) and **flagged**:
  - tagged *From Word*
  - shown in the library by its text
  - its form opens with the text as it came, and the Title field carries the
    flag *Brought in from Word as one line. Separate it into author, title,
    publisher and the rest…*
  - until it has a title it prints exactly as written, in notes, in the
    text and in the bibliography, with any pinpoint or note added since
  - once it has a title the style sets it from its parts, and *Forget the
    Word text* clears the original
- *Ibid.* and other back-references come in as sources of their own, flagged
  like the rest, for the writer to point at the source they mean.
- Importing as a novel or a collection leaves the footnotes out and says how
  many, since only an instructional book cites.
- The book's own Word export reads back as the same notes.

**A short title** (Chicago 14.32) now drops a leading *A* or *The* on a title
longer than four words and never ends on a small word: *Moon and the Sea*,
not *The Moon and the*.

**Proof.**
- `citation-exports.test.ts` (12 tests) covers:
  - Word footnotes, the first in full and the rest short, in italic, with
    Word's separators
  - the bibliography added once, or taken from the back matter's page
  - symbol numbering and per-chapter sections
  - APA in Word, and MLA in the EPUB
  - the EPUB's linked notes, per chapter, with backlinks
  - reading notes and tokens from Word, the words kept clean
  - sources made, merged by text, flagged, and printing as written
  - the style taking over once a source has a title
  - a novel leaving the notes out and saying so
  - the round trip from the book's own Word export
  - the short title
- The renderer test adds the Word export on the File menu of a book.
- Opened in LibreOffice: the exported `.docx` converts with true footnotes
  at the foot of each page, numbered by Word, and the bibliography at the
  end.
- Seen in Chromium: a Word document with three footnotes imported as an
  instructional book. References lists two flagged sources, one cited twice,
  each shown as written.

## 10. Headers and footers by division (phase 4)

Spec §6 asks for global, chapter-specific and first-page-different layouts,
a set of fields, roman or arabic numbers, and numbering that restarts per
section. The Layout room already had the global half (addendum 20 §7): a
left-hand and a right-hand top, each the author, the book's title, the
division's title, words of the writer's own, or nothing; the folio's place;
no heads on title, copyright or display pages; roman front matter.

**Fields.** Words of the writer's own, in a head or a foot, may carry:
- `{title}` the book's title, `{chapter}` this division's title and
  `{author}`, filled as the book is laid
- `{page}` the page's number as printed (*iv*, *12*), `{pages}` the page
  count and `{date}` the day it is printed, filled as each page is drawn
  (`fillHeadFields`, `fillPageFields`)
- chips under each box type a field in, so nobody has to know the braces

**A running foot.** `runningHeads.foot`, with its own place (centred, outer
or inner edge), at the foot of every text page in the bottom margin where the
folio stands. Empty prints none, as every book did before.

**A division of its own** (`settings.book.sections`, `SectionLayout`).
- It is keyed by the division's record, the way the contents page keys a
  row: a chapter's marker, a part, a heading's unit (`sectionIdOf`). So it
  holds however often the book is laid.
- Each division may set:
  - its own left-hand and right-hand tops, and its own foot, in words with
    fields; empty is the book's
  - whether its opening page carries the heads and foot. By default an
    opening stands clear of them, as before; this is the spec's
    *first-page-different*, per division.
  - page numbers starting again at its opening
  - roman or arabic numbering; *As the book* follows the book
- An override belongs to that division only. The next division takes the
  book's heads and numbering back, its arabic count carrying on from where
  arabic last stood unless it restarts too.
- A division set back to the book's in every respect is removed
  (`setSectionLayout`), not kept as a record that changes nothing.
- In the room: **Book settings → Heads & numbers by chapter** (the format's
  own noun) lists the contents page's rows, each saying in a few words how
  it differs. Opening one shows its controls.

**In Word.** The book's Word export (§9) now has a section per division,
each with Word's own bands:
- a right-hand and a left-hand header and footer (`evenAndOddHeaders`),
  their words the division's or the book's
- `{page}`, `{pages}` and `{date}` as Word's PAGE, NUMPAGES and DATE fields
- a first page of its own (`titlePg`) with no head, and its number where the
  book shows one on an opening, unless the division carries its heads there
- `pgNumType` lower-roman or decimal, restarting where the division
  restarts; the body's first section always starts at 1
- the front matter one section with empty bands, so the title and
  copyright pages carry nothing

**Proof.**
- `section-heads.test.ts` (9 tests) covers:
  - the fields, filled in two stages
  - division keys
  - a restart in arabic and in roman
  - a division's own heads and foot, and the book's back after it
  - an opening clear of the heads and foot, or carrying them
  - the drawn foot with page, count and date
  - Word's sections with left-hand and right-hand headers, NUMPAGES and a
    first page of its own
  - a roman restart in Word, with the heads on its first page
  - a layout set back to the book's being forgotten
- The Layout room test types a running foot with a field chip and gives a
  chapter a roman restart with heads on its opening.
- Seen in Chromium: the Bibliography given its own right-hand head
  (*Sources · page i of 7*), heads on its opening and a roman restart. The
  rail numbers it *i*, the page prints the head, the running foot (*The Sea
  · 22 October 2026*) and the folio *i*.
- Opened in LibreOffice, the Word export shows *The Sea* on left-hand pages
  and *The Pull* on right-hand ones, *Page 2 of 11* in the foot, chapter
  openings clear, and the second chapter numbered from *i*.

## 11. The library in the Document module

From the plan: *share the library with the Document module.* A Document
project (addendum 42) already carried `references` and `citations`, as every
project file does, and nothing used them. Now it cites exactly as a book
does: the same styles, markers, notes and bibliography, the same dialog, and
the same References panel.

**Where a citation stands.** In the word processor a citation is an inline
node, `citation`, holding its key (`Citation` in `document/extensions.ts`).
The manuscript's `[^key]` token is a token because a manuscript line is
text; the editor keeps a tree, and a node moves, copies and undoes with its
words in the same way. Its HTML is an empty `<sup data-cite>`, and the screen
draws its marker over it as a decoration, worked out from where it stands
every time.

**Each document counts on its own** (`citationOccurrences` walks the story,
then each document, `documentId` set and the unit, beat and element null).
A letter and a report in one project are two pieces of writing: each numbers
its notes from 1 and cites a source in full the first time.
`occurrencesIn(file, documentId)` reads one place, and `citationNotes`,
`referenceBibliography` and `bookCitationsOf` take it. The story's own
numbering is unchanged.

**On the ribbon: References**, as Word has it:
- **Insert citation**, and **Ctrl/Cmd+Shift+C** in the page, open the
  manuscript's dialog. In it a source can be searched, made, and given a
  pinpoint and a note. The preview counts this document's citations only.
- A click on a marker opens it, to change or remove.
- **Bibliography** puts a block where the cursor is. It holds nothing typed:
  it lists the sources the document cites, in the style's order under the
  style's heading, and draws itself again as they change.
- **Sources & style** opens the References panel over the page. Its preview
  is this document's notes and bibliography, and its settings tab is *How it
  cites*.
- **Bring in sources…** (below).
- A line says the style, how many citations the document has, and how many
  sources the library holds.

**Research → References** is offered on a Document project too.

**Leaving the page.**
- **Word**: Chicago and Custom citations are Word's own footnotes, the first
  in full and the rest short, and APA and MLA set the parenthetical in the
  line. The bibliography block becomes a heading and *Bibliography*-style
  paragraphs with hanging indents.
- **Print and PDF**: a document is laid out by the browser, which cannot put
  a note at the foot of the page it falls on. So the notes are set as
  endnotes under *Notes*, each linked to its marker, before the bibliography
  where the document has one (`citeDocumentHtml`).

**Bring in sources from another project** (`bringInReferences`,
`BringInSourcesDialog`). This is the sharing:
- The library a book was cited from can be brought into the report written
  about it, or the other way round.
- It is offered on the ribbon of a document and in every References panel,
  a book's included.
- Choose a project from the list or browse to a `.vcw`. Its live sources are
  listed with the ones this library already has marked, and the rest ticked.
- Each comes in as a copy with an id of this project's. A project file is a
  whole thing of its own, kept and synced on its own, so two files cannot
  share one record.
- A source this library already has is never brought in twice: the same
  DOI (however it was pasted), the same ISBN, the same title by the same
  first author, or the same Word text.
- Archived sources stay where they are.

**Proof.**
- `document-citations.test.ts` (7 tests) covers:
  - each document counting on its own, with full and short notes
  - print's markers, endnotes before the bibliography, and the bibliography
    block filled
  - APA in a document
  - Word footnotes and the bibliography block in Word
  - the story's numbering untouched
  - bringing in: copies with new ids, duplicates by DOI and title left
    out, archived skipped, twice the same as once, and only the picked
- `document-citations.test.tsx` (4 tests) covers:
  - inserting from the ribbon with a source made in the dialog, and the
    marker drawn
  - renumbering by place and Ctrl+Shift+C
  - the bibliography block filling itself
  - a marker opened and removed, the words and the source kept
  - bringing in another project's library, the shared source left out
- Seen in Chromium: a new Document project with two citations (markers 1
  and 2), a bibliography block listing the source, and Sources & style with
  the document's full and short notes.
- Opened in LibreOffice: the document's Word file has its two footnotes and
  the bibliography.
- Rendered by Chromium to PDF: the print has its markers, *Notes* and the
  bibliography.

## 12. Not yet

- A note carried on to the next page in Layout when it is too tall for its
  own.
- Citations typed into front- or back-matter pages (they are numbered only in
  the story).
- Recognising a Word note's parts (author, title, publisher) automatically.
  They are kept whole and flagged.
- A division's head set to print nothing: an empty box is the book's, and
  *nothing* needs a way to say so.
- The eBook has no pages, so it carries no heads, feet or page numbers.
- Footnotes in a Word file inserted into a document: Insert → From file
  brings the words in without them.
- A document's print sets its notes at the end, not at the foot of each page.
- One library held live between projects: sources are brought in as copies,
  and a change in one project does not reach the other.
