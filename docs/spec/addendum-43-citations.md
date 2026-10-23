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
| 6 | A long note carried on to the next page in Layout | **built** (§12) |
| 7 | Citations in the front and back matter | **built** (§13) |
| 8 | Citations in a glossary's definitions | **built** (§14) |
| 9 | Citations in a reader extra's discussion questions | **built** (§15) |
| 10 | A reader extra's heading as its card promises | **fixed** (§16) |
| 11 | Citations in a newsletter's message and beside the author's other titles | **built** (§17) |
| 12 | Citations in a preview chapter's lead-in and extract; the extract printed | **built** (§18) |

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
- A note too long to stand whole under its marker breaks across pages
  (§12).
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

## 12. A note carried on to the next page

From Ken, after phase 4: *build the note carrying on to the next page next.*
Until now a note too long for the room under its marker was set whole and
clipped on that page, so its last lines were lost. A note now breaks the way
Word breaks one, and as Chicago allows (14.47).

**When a note breaks** (`layPages`, `fillPage`):
- A short note never breaks. Where it will not fit under its marker's line,
  that line goes over with it, as before (§8).
- A note breaks only where standing whole would push its own marker's line
  off the page. Then the text runs on down the page with the marker in it,
  and at least two lines of the note stand under it. A note of one line
  never breaks.
- The rest carries on at the head of the next page's notes, under a rule
  the full width of the measure (Word's continuation separator), so a reader
  knows it is not a new note. As much as fits goes there while leaving the
  text two lines. A note longer than that carries on again.
- **Notes keep their order.** While a note is still carrying on, no later
  note may start: a line whose marker would bring one in waits for the page
  after the carried note ends.
- A carried note does not wait for text:
  - it carries on the blank left-hand page before a chapter that opens on
    the right
  - past the end of the text, onto a page of its own
  - but not on a picture page, which it waits beyond
- A page's depth counts its carried lines, so spreads still balance.

**Measured, not guessed.** A note breaks between its own lines, never through
one. The typesetter already reads each note's height; it now also says how
tall one line of a note is (`noteLinePx`, from the same size and leading the
stylesheet sets them in), and the cutter counts each note in those lines
(`linesOfNote`, `notePartsCost`).

**Drawn the way a split paragraph is.** Each part of a broken note is the
whole note clipped to its lines (`NotePart`, `BookPage.noteParts`,
`renderPageNotes`). Its words therefore wrap exactly as they were measured,
and the second page picks up mid-sentence where the first left off. The PDF
is the same pages.

**Word and the eBook** need nothing. Word breaks its own footnotes, and an
eBook has no page foot.

**Proof.**
- In `citation-pages.test.ts`, six more tests:
  - a long note breaking, with at least two lines under its marker, the
    rest at the head of the next page, every line set once, and each page
    full and no fuller
  - a short note kept whole, its line going over with it
  - a later note waiting until the broken one has finished
  - a note carried past the end of the text onto a page of its own
  - a note carried on the blank left-hand page before a chapter, the
    chapter still opening on the right
  - the continuation drawn under the full-width rule, clipped to its lines
- Seen in Chromium: a chapter with a long note on a citation two-thirds of
  the way down a page. Three lines of the note stand under the text; the
  rest carries on at the foot of the facing page under a full-width rule,
  continuing mid-sentence.

## 13. Citations in the front and back matter

From Ken: *build the front matter citations next.* A foreword, a preface, an
introduction, an epigraph, an appendix: the pages an instructional book most
often cites from outside the chapters. Their words are typed into the page
itself (`part.text`), not the manuscript, so until now they could not cite.

**Typing one.** The text box of every page that carries prose is now
`CitableText`:
- the part's text in the Layout room's column
- an appendix, and the other pages of words, in the back-matter dialog
- the words of a designed page (an epigraph, a dedication, a page of your
  own)

It works as a chapter's line does:
- **Cite…** under the box, or Ctrl/Cmd+Shift+C in it, opens the same
  dialog and puts the `[^key]` token at the cursor
- a click inside a token opens that citation, to change its source,
  pinpoint or note, or to remove it
- under the box, each token is named by its note (*[^ab12cd] is note 1*), or
  by its missing source, so a writer can see which token is which
- on a book that does not cite, it is the plain box it was

**Where they count** (`citationOccurrences`): where the book prints them.
- The front matter's pages come first, in the order the writer arranged
  them, then the story, then the back matter.
- A foreword that cites a source first therefore takes note 1 and the full
  note, and the chapters' notes of that source are short.
- Where the count starts again at each chapter, each page of front or back
  matter is a division of its own and starts at 1.
- A page set inside the story is read after it, an approximation for a rare
  case.
- An occurrence carries `partId` for the page it stands on.

**On the page.**
- A page that runs as paragraphs (a foreword, an appendix) is set like a
  chapter: the marker raised, the note at the foot, measured and carried on
  if long.
- A page of words standing alone (an epigraph, a dedication) is drawn by
  the display page. It now renders its lines with their marks and markers,
  and sets its notes at its own foot, whole. Such a page is a few lines a
  third of the way down, and the rest of it is room.
- The eBook links an epigraph's marker to its note, as it does a chapter's.
  The Word export already reads the parts' words through the citation
  writer.

**Proof.**
- `matter-citations.test.ts` (4 tests) covers:
  - order: foreword, story, appendix, with the foreword's note full and the
    rest short
  - each page as its own division where the count restarts
  - the foreword's page raising its marker and setting its note
  - an epigraph's page of words placed after the foreword it was added
    behind, carrying its note, and linked in the eBook with no token left in
    its text
- `citable-text.test.tsx` (2 tests) covers:
  - placing a citation at the cursor and by Ctrl+Shift+C
  - naming it by its note
  - opening it from a click inside it and taking it out
  - the plain box on a novel
- Seen in Chromium: a foreword added in Layout and cited after *hours*. Its
  page raises marker 1 with the full note, and the story's two citations
  have become notes 2 and 3, both short.

## 14. Citations in a glossary

From Ken: *build the glossary citations next.* A glossary is a list page:
its words are not a text but terms, each with a definition
(`glossarySchema`). A definition is where an instructional book most often
owes a source — *a spring tide is…, after Jones*.

**Typing one.** Each definition in the glossary's card in the back-matter
dialog is a `CitableText` (§13), two lines high, with **Cite…** under it,
Ctrl/Cmd+Shift+C, a click inside a token to open it, and its tokens named by
their notes. A term itself does not cite; it is a word being defined, and
the definition is where the claim is.

**Where they count.** In the order the page prints its terms
(`glossaryEntries`): sorted A to Z where the glossary sorts, in the writer's
order where it does not. A definition written second but sorted first is
cited first. The glossary is back matter, so it counts after the story, in
its place among the other back-matter pages (`wordsOfPart` in
`citations.ts`).

**On the page.** A definition is already a paragraph of the glossary's page,
the term set before it, so its marker is raised and its note set at the foot
as a chapter's are, carried on if long. The eBook and Word read the same
paragraphs.

**Proof.**
- `matter-citations.test.ts`:
  - two definitions numbered in the page's sorted order, after the story
    and an appendix
  - the definition drawn with its term, its marker raised, and its note at
    the page's foot
- `back-matter-dialog.test.tsx`: citing from a definition in the glossary's
  card, the token at the cursor and named by its note.
- Seen in Chromium: a glossary added in Layout, the term *Spring tide*
  defined and cited after *month*. The page prints marker 3 there and the
  short note at its foot.

## 15. Citations in discussion questions

From Ken: *build the reader extra questions citations next.* A reader extra
set to *Discussion questions* is a list of questions for a reading group, and
in an instructional book a question often points at a source — *Jones says
the spring tides run a foot higher in the north. Why might the Admiralty
disagree?*

- **Typing one.** Each question in the reader extra's card is a
  `CitableText` (§13), two lines high, with **Cite…**, Ctrl/Cmd+Shift+C, a
  click inside a token to open it, and its tokens named by their notes.
- **Where they count.** In the order of the questions, in the reader
  extra's place in the back matter (`wordsOfPart`). The other kinds of
  reader extra (a newsletter, a preview, *also by*) do not cite.
- **On the page.** A question is already a paragraph of the page with its
  number before it, so its marker is raised and its note set at the foot,
  carried on if long; the eBook and Word read the same paragraphs.

**Proof.**
- `matter-citations.test.ts`: two questions numbered in order after the
  story and an appendix, and the second drawn with its number, its marker
  raised and its note at the page's foot.
- `back-matter-dialog.test.tsx`: citing from a question by Ctrl+Shift+C,
  the token at the end of its words.
- Seen in Chromium: a reader extra set to discussion questions, its first
  question cited after *north*. The page prints *1.*, the question with
  marker 3, and the short note at its foot.

## 16. A reader extra's heading

Noticed while building §15, and fixed at Ken's word (*fix the reader extras
heading next*). A reader extra's card has always said *It will be headed
“Questions for Discussion” unless you type something else below.* The page
printed **Reader extras**: with no heading typed, every page fell back to its
kind's name (`partTitle`), and nothing asked what the extra was for. The same
held for a newsletter, a preview chapter and *also by*.

**One answer** (`partHeading` in `book-plan.ts`): where the writer typed a
heading, that; otherwise
- a reader extra's purpose's heading (`extraHeading`: *Questions for
  Discussion*, *Also by R. Jones* and the rest)
- a bibliography's style's (§8)
- any other page's kind's name, as before

Every place that prints or lists a page's heading now reads it, so they
cannot disagree:
- the page itself, and so the contents and Word, which read the page's blocks
- the eBook's sections and its navigation
- the fixed-layout eBook
- the Layout rail

Both heading boxes, in Layout's column and in the back-matter dialog, show it
as their placeholder: an empty box says what will print. The heading follows
the page when its purpose changes, and words the writer types win. Nothing
is stored, so pages already in people's books print the right heading as
they stand.

**Proof.** `part-heading.test.ts` (5 tests):
- the purpose's heading, *Also by* with the author's name
- printed on the page, listed in the contents and the eBook, never
  *Reader extras*
- named so on the rail
- following a change of purpose, and giving way to typed words
- a bibliography's style's heading unchanged

Seen in Chromium: the discussion-questions page of §15 now heads itself
*Questions for Discussion*, and the rail names it so.

## 17. Citations in a newsletter and in *also by*

From Ken: *build the newsletter and also by citations next.* These are the
reader extra's two kinds that §15 left out.

- **A newsletter's message** is a `CitableText` in the reader extra's card,
  the paragraphs of the message citing as any page's words do. The link and
  its code do not cite; they are an address, not a claim.
- **The author's other titles** (*also by*). Each title is a book's name,
  and the series note beside it is where a source belongs (*a field guide,
  after Jones's tables*). So the note is a `CitableText`, one line high, and
  the title is a plain field. A title with no name is not listed, and its
  note is not read.
- The separate **Also by** page, written as words of its own, already cited
  through its text box (§13).
- **Where they count.** In the reader extra's place in the back matter: the
  message's paragraphs in order, or the notes in the order the titles are
  listed (`wordsOfPart`).
- **On the page.** A message's paragraphs and a title's line (*The Moon's
  Hours — a field guide, after Jones's tables*) are paragraphs of the page
  already, so the marker is raised and the note set at the foot. The eBook
  and Word read the same paragraphs.

An *also by* page in a book with no author yet is headed *Also by*, with no
space left hanging after it (`extraHeading`).

**Proof.**
- `matter-citations.test.ts`:
  - a newsletter's message and a title's note numbered in their place after
    the story and an appendix
  - a nameless title's note left unread
  - the title's line drawn with its marker raised and its note at the foot
- `back-matter-dialog.test.tsx`: citing from a message with Cite…, and from
  a series note with Ctrl+Shift+C.
- `part-heading.test.ts`: *Also by* alone where the book has no author.
- Seen in Chromium: an *also by* page with *The Moon's Hours — a field
  guide, after Jones's tables*, marker 3 after *tables*, and its note at the
  foot.

## 18. A preview chapter: its lead-in, its extract, and their citations

From Ken: *build the preview chapter lead-in citations next.*

**A fault found first.** A preview chapter is a lead-in line (*Turn the page
for the opening of…*) and an extract, the opening of the next book. The page
read the lead-in **or** the extract: a page with a lead-in printed only the
lead-in, and the chapter it was there to show never printed. Without a
lead-in the extract printed, so the fault showed only once a lead-in was
typed. A citation in the extract would have been numbered and never printed.
The page now prints the lead-in, then the extract as the book's own
paragraphs (`partOwnBlocks`), and `partParagraphs` counts both. The eBook
and Word read the same paragraphs, so they print the extract too.

**Citing.**
- The lead-in and the extract are each a `CitableText` in the reader
  extra's card: the lead-in one line high, the extract as it was.
- Both count in the reader extra's place in the back matter, the lead-in
  first (`wordsOfPart`).
- Their markers are raised and their notes set at the foot, as on any page
  of paragraphs.

**Proof.**
- `matter-citations.test.ts`: a preview with a lead-in printing the lead-in
  and then both paragraphs of its extract, and its two citations numbered
  in order after the story and an appendix.
- `back-matter-dialog.test.tsx`: citing from the extract by Ctrl+Shift+C,
  and a Cite… under the lead-in too.
- Seen in Chromium: a preview headed *A Sneak Peek*, its lead-in centred
  above the extract's three paragraphs, the last cited after *shape* with
  marker 3 and its note at the foot.

## 19. A page inside the story: numbered where it stands

A page of your own can stand inside the story: in front of a line, in front
of a chapter's opening, in front of another page, or after everything at the
end of the book. Until now its citations were numbered after the story,
whatever page it printed on.

They are numbered where the book prints them now. `citationOccurrences`
walks the same records `bookBlocks` emits pages for:

- in front of each front- or back-matter page, the pages anchored to it
- in front of each chapter's opening, the pages anchored to its marker
- in front of each line, the pages anchored to that element
- after the back matter, the pages anchored to the end of the book

Several pages in front of one record are read in the order of their leaves
(`afterLeaves`), as the leaf run sets them.

Counting by chapter:

- A page inside a chapter counts with that chapter and does not restart it.
- A page in front of a chapter's opening counts with the chapter it opens.
- A page in front of a front- or back-matter page, or at the end of the
  book, is a division of its own, like the pages around it (§13).

A page whose record has gone prints nowhere. Its citations are listed last,
so the writer can still find them, and they take no number from a page that
prints.

The test compares the numbering with the order the citation tokens come out
of `bookBlocks`, so the numbers and the printed pages can't drift apart.

## 20. A Word note's parts, read

A Word footnote came in as one line, kept as written and flagged (§9). Most
notes a writer types follow Chicago's note form, and that's regular enough
to read back. `recogniseNote` (`note-parts.ts`) reads these shapes:

| Shape | Example |
| --- | --- |
| Book | `Robert Jones, *On Tides*, 2nd ed. (Boston: Sea Press, 2019), 12.` |
| Edited book | `Bo Kim, ed., *The Sea Book* (London: Wave, 2010), 3–5.` |
| Chapter | `Ann Hall, "Charts," in *The Sea Book*, ed. Bo Kim (London: Wave, 2010), 45.` |
| Article | `Ada Lee, "The Pull," *Journal of Tides* 4, no. 2 (2018): 33.` |
| Web page | `"Tide Tables," Harbour Board, accessed May 1, 2024, https://…` |
| Short note | `Jones, *On Tides*, 20.` |
| Ibid. | `Ibid., 14.` |

- **All or nothing.** A note is read only when the whole of it fits one
  shape. Anything else is kept as written and flagged, as before: a title
  split in the wrong place is worse than a line kept whole.
- **People and bodies.** Names are turned round ("Jones, Robert"). A name
  with a word like Board, Society, Ministry or University is an
  organisation.
- **The page belongs to the citation.** The pinpoint comes off the note
  onto the citation, with its kind: 12 a page, 12–14 pages, chap. 3 a
  chapter, at 1:02 a time.
- **A DOI or address** at the end of any note goes to the source.

**Reading a run of notes.** `readNotes` reads a Word file's notes in order:

- A full note gives a source. The same author and title in two full notes is
  one source.
- A short note cites the latest source by that author whose title holds the
  short title.
- *Ibid.* cites the source of the note before it, read or not.
- A note that can't be read, or a short note with nothing to point at, is a
  source of its own kept as written. The same words twice are one source,
  as before.

The import uses it, so a book with its notes in Chicago's form comes in with
a library of real sources, each cited at its own pages. The style then sets
the notes: the first in full, the later ones short (Chicago's own rule, so
*Ibid.* prints as a short note). A read source keeps its Word text beside
the fields, for the writer to check them by.

**Books imported before this.** Their sources are each one line. The
References library offers *Read the parts of N sources from Word*.
`recogniseFromWord` walks the citations in the order the book prints them,
so short notes and Ibid.s find the source before them as the import does:

- A full note fills its source's fields and puts its page on the citation,
  where the citation has none of its own.
- A short note or an Ibid. moves its citation onto the source it names.
- A line left citing nothing is taken out of the library.
- A note it can't read is left as it was.
- Running it twice does nothing the second time.

## 21. A division's head set to print nothing

A division could give its pages their own heads and foot (§10), but an empty
box meant *as the book*, so there was no way to say *nothing here*.

The model already had the three answers: null is the book's, empty words
print nothing, and anything else is the division's own. Pages and Word
honoured an empty string. Only the screen couldn't say it.

In *Heads & numbers by …*, each of the three lines (left-hand head,
right-hand head, running foot) now has a choice beside it:

- **As the book**: null; no box.
- **Nothing**: empty words. The pages carry no head or foot there, and Word
  gives the section bands without the book's words. The page number, where
  the book prints one, is a separate thing and stays.
- **Its own words**: the box appears, starting as what the book prints
  there written as a field (`{chapter}`, `{title}`), so the writer edits
  from where the book was.

A box emptied while being typed in stays a box until the writer leaves it.
Left empty, it prints nothing, which is what empty words mean. The summary
beside the division says *no heads* and *no foot*. Putting all three back to
the book's (with nothing else set) forgets the division's layout, as before.

**A page inside a division no longer ends it.** Driving this caught a fault
from §10. A page of your own is a part opening, and every part opening
started a division of its own. So a page set inside a chapter dropped the
chapter's heads, foot and numbering for every page after it: the book's
heads came back mid-chapter, and a roman count restarted by the chapter
fell back to arabic. A page anchored inside something (a line, a chapter's
opening, another page) is now marked `anchored` on its block, and
`sectionIdOf` gives it no division of its own. The chapter's layout carries
on past it, on the pages and in Word. A page of your own in the front or
back matter, anchored to nothing, still opens a division as before.

## 22. A Word file's footnotes, inserted into a document

*Insert a file…* in a document brought a Word file's words in and dropped
its footnotes. They come in as citations now.

- **The notes are read** as the book import reads them (§20,
  `readNotes`): Chicago's forms into their parts, short notes and Ibid.s
  onto the source before them, anything else kept as written.
- **The library first.** `notesIntoLibrary` matches each source against the
  project's References before adding it: by first author and title, or by
  its words where it's kept as written. A source the project already has is
  cited, not added twice, and its facts are the writer's: the note doesn't
  overwrite them. A new source is tagged *From Word* and keeps its Word text.
- **Keys free in this project.** A footnote's key in the file can clash with
  a citation the project already has, so each note gets a key that's free,
  and `keys` maps the file's keys to the library's.
- **Where they stood.** `docxToDocContent(docx, keys)` puts a citation node
  where each note's reference stood in the line. The document then numbers
  and sets them like any it cites (§11). Without `keys` the words come in
  clean, as before.

The status line says how many footnotes came in, how many sources were new,
and how many were already in the library.

## 23. A document's notes at the foot of each page

A document's print and PDF set its notes at the end, under *Notes* (§11).
Chromium sets the pages itself and has no `float: footnote`, so it can't
put a note at the foot of the page its marker falls on. Word already
printed them as footnotes.

They stand at the foot of each page now. The pages are set before printing,
in the renderer (`apps/desktop/.../document/foot-notes.ts`), in a hidden
frame with the print's own stylesheet at the width of the page's words
(`documentMeasureHtml`):

- **Blocks go onto a page** while they, and the notes cited in them, fit in
  the page less its margins (`documentPageBox`), with a few pixels spare for
  the printer's rounding.
- **A paragraph that doesn't fit is broken between its lines.** The lines
  are found from the text's boxes by their middles (a glyph's box is taller
  than its line, so neighbouring lines' boxes overlap). The break falls at
  the first character set below the gap. The rest goes over the page with
  no space above and no first-line indent (`wp-split`, `wp-cont`).
- **A list, a quotation, a table or the bibliography breaks between its
  items, rows or entries**, and an item can itself break between its lines.
  A numbered list goes on counting where it broke, and an item carried over
  isn't numbered twice. A table repeats its head row.
- **A heading is never left at the foot of a page**, and a page break the
  writer put in starts a new page.
- A block that won't fit even on a page of its own stands alone, cut at the
  foot rather than pushing everything after it astray. Pictures are capped
  at the page's height so this is rare.

`documentPagedHtml` draws the pages: each a box the height of the page
(a hair less, so a page never spills onto a printed page of its own),
the words at the top and the page's notes at its foot under a short rule.
Headers, footers and page numbers stay in the page's margin boxes. The
words come through whole: checked in Chromium that the set pages hold the
same text as the document, the notes in order, and that no page overflows.

Where nothing is cited, or the style cites in parentheses (APA, MLA), the
browser sets the pages as before. If the setting fails for any reason, the
print falls back to the notes at the end. Only print and PDF are set this
way; the editor's own page view doesn't show notes.

## 24. A long note carried on in a document's print

In a document's print (§23), a note that wouldn't fit beside its marker took
the marker's line over to the next page with it, and a note too long for any
page was cut at the foot and lost. It carries on now, as a book's does (§12).

- **When a note breaks.** Only the last note cited on the page, only when
  it won't stand whole there, and only when it is long: more than a third
  of a page. A shorter note never breaks; its marker's line goes over with
  it, as before.
- **How much stays.** As many lines as fit, and never fewer than two. The
  lines are found the way a paragraph's are (§23), and the cut note's first
  lines are drawn in its place (`DocumentPage.cut`).
- **Where the rest goes.** First at the foot of the next page, before that
  page's own notes, under a rule the width of the page instead of the short
  one (`DocumentPage.carried`, `.wp-page-notes.continues`), the way a book
  marks a note carried on.
- **A note longer than a page.** What's carried takes at most two thirds of
  the next page, so that page still has room for its own words; the rest
  is carried on again. If the words end with a note still being carried, it
  finishes on pages of its own.

Checked in Chromium, on Letter and on A5 with a 5,000-character note:
the note's words arrive whole across the pages, every other note stays in
order, no page overflows, and the PDF has exactly the pages that were set.

## 25. The editor's page view, set into pages, with each page's notes

The page view was one long sheet with a rule where each page would end, and
the words ran across the rules. Notes showed only in print and PDF (§23).

The page view is now set into pages as the words are written
(`apps/desktop/.../document/page-view.ts`), each page's notes at its foot:

- **Measured line by line.** A moment after the words stop changing, the
  editor's lines are read off the screen (by their middles, §23), with the
  citations each line holds. A table, a picture, a rule or the bibliography
  is one row and goes over whole.
- **Pages end where the print's do.** A page takes rows while they and the
  notes cited in them fit. A heading isn't left at the foot, and a page
  break the writer put in ends the page.
- **A gap at each page's end.** A widget decoration, not part of the
  document, is put in where the page ends. It's as tall as the rest of the
  page plus the margins down to the next page's words, and it carries the
  page's notes standing at its foot. The last page's notes follow its last
  words. The gaps are never typed into, saved or printed, and are measured
  without them each time, in one go so nothing is painted between. The
  scroll position is kept.
- **Headers and footers on every page.** Now that the pages are real, the
  bands are drawn on each page with its own number ("Page 2 of 3"), the
  first page carrying them only where the document says so. Before, only
  the first page's header and the last page's footer showed.
- **Web layout** has no pages, and the gaps go.

Checked in Chromium: the page view breaks on the same lines as the PDF,
each page's notes end exactly at its foot (960, 2016 and 3072 pixels down a
Letter sheet), the page count matches, and typing on page 2 keeps the caret
and sets the pages again.

## 26. A long note breaking over the page on screen

The page view (§25) never broke a note: a page's notes took at most three
fifths of it, and a long one was cut off at the screen's foot. It breaks
now as the print's does (§24), with the same rules and helpers (`lineCuts`,
`LONG_NOTE`, `NOTE_LINES_KEPT`, shared with `foot-notes.ts`):

- **When it breaks.** Only the last note cited on a page, only when it
  won't stand whole there, and only when it's longer than a third of a page.
  The page ends at the line that cites it, and at least two of the note's
  lines stay.
- **Where the rest goes.** First at the next page's foot, under a rule the
  width of the page. A carry longer than two thirds of a page is set that
  far and carried on again. A note still carried after the last words
  finishes on further pages at the end of the sheet, each with its foot.
- **The same markup as the paper.** The gaps draw each page's notes with
  the print's own `pageNotesHtml`, so the screen and the paper agree.

**Found on the way: two faults in reading Word notes (§20, §22).**

- A note that went on after its source ("…2019), 12. He is wrong about the
  bar…") matched the book's shape, and everything after the source was taken
  as its page. A page has a 120-character limit, so the whole insert or
  import failed. A pinpoint now has to look like one: a page, a section, a
  time, or something short with no new sentence or semicolon in it.
  Otherwise the note is kept whole as written, as §20 says it should be.
- A note longer than the 5,000 characters a source keeps as written also
  failed the whole file. It's now cut there with an ellipsis, and the
  locator is clamped to its limit too, so one note can never stop a file
  coming in.

## 27. Word notes in APA's and MLA's forms

A Word file's notes were read only in Chicago's forms (§20). One written to
APA or MLA was kept whole and flagged, note by note. They're read now, in
the same all-or-nothing way, by `recogniseNote` (`note-parts.ts`):

| Form | APA | MLA |
| --- | --- | --- |
| Book | `Jones, R., & Lee, A. B. (2019). *On tides* (2nd ed.). Sea Press.` | `Jones, Robert, and Ada Lee. *On Tides*. Sea Press, 2019.` |
| Article | `Lee, A. (2018). The pull. *Journal of Tides*, *4*(2), 33–40. https://doi.org/…` | `Lee, Ada. "The Pull." *Journal of Tides*, vol. 4, no. 2, 2018, pp. 33–40.` |
| Chapter | `Hall, A. (2010). Charts. In B. Kim & C. Day (Eds.), *The sea book* (pp. 45–60). Wave.` | `Hall, Ann. "Charts." *The Sea Book*, edited by Bo Kim, Wave, 2010, pp. 45–60.` |
| Web page | `Harbour Board. (2023, March 3). *Tide tables*. Harbour Board. https://…` | `"Tide Tables." *Harbour Board*, 3 Mar. 2023, harbour.example/tides.` |
| Short form | `(Jones, 2019, p. 12)`, `Jones and Lee (2019, pp. 12–14)` | `(Jones 12)`, `(Jones, *On Tides* 12–14)` |

- **Names.** APA's are kept with their initials ("Jones, R."); MLA's first
  author as written and the others turned round. A name that isn't a
  person's is an organisation, as before.
- **Addresses.** An address at the end goes to the source, including MLA's
  without its scheme ("harbour.example/tides"), and a DOI to its own field.
- **Short forms.** A short form cites the latest source by that author it
  names: by its title where it gives one (Chicago, MLA with a title), by its
  year where it gives that (APA), or by the author alone (MLA's
  "(Jones 12)"). A year that isn't the source's names another work, so the
  note is kept as written. "(Smith 2019)", a year without APA's comma, is a
  year and not page 2019. A remark in parentheses ("(See also chapter 3)")
  is no citation.
- **The library action** (*Read the parts of N sources from Word*, §20)
  and **Insert → From file** (§22) use the same reading, so they know these
  forms too.

Checked by reading back what the book's own APA and MLA styles write, entry
and short form, for a book and an article. In the preview, a Word file with
six APA notes came into a document as four sources, its book cited three
times at its own pages.

## 28. The printed book's page numbers in the eBook

A reflowable eBook has no pages of its own. The reading app sets them to
the screen and the reader's type size, and draws its own top line. Running
heads and feet can't travel, so none were made. What can, and what readers,
teachers and accessibility rules ask for, is **the printed book's page
numbers**: "page 37" in the eBook is page 37 in print, so a citation or a
class discussion finds its place in either. They now travel.

- **Where each printed page begins** (`printPageStarts`, in the Layout
  room's typesetter). The laying says which line of which block each page
  opens on. Each block a page turns inside is drawn again, and the first
  character of that line found by the middles of the characters' boxes,
  counting only the words (not a citation's marker or a caption). A blank
  page, or one the eBook doesn't carry (the contents, an index), begins
  where the next page that it does carry begins.
- **Markers in the eBook** (`ebookOf(file, { printPages })`). At each page's
  start, an empty `<span epub:type="pagebreak" role="doc-pagebreak"
  aria-label="37">`, before the block or among its words where a page
  turns inside a paragraph, even inside italics. The words are set with a
  private-use stand-in character at each turn, replaced by its marker.
- **The page list.** The navigation document carries a hidden
  `<nav epub:type="page-list">`, one entry per printed page (roman in the
  front matter, arabic after). The EPUB 2 navigation, where the store
  wants it, carries a `<pageList>` with its counts.
- **Said in the package.** `printPageNumbers`, `pageBreakMarkers` and
  `pageNavigation` are added to the accessibility features, and
  `a11y:pageBreakSource` names the source: the book's print edition.
- **Heads.** The reading app's own top line shows the section's title, from
  each content file's `<title>`, which is the chapter's or the page's own
  title. Nothing more is written for it.
- **The export screen** says how many printed pages are marked, or that the
  Layout room must be opened first.

Checked in Chromium: a book laid in the Layout room at 11 pages exported as
an EPUB with 11 page-list entries (i–vi, 1–5). The marker for page 3 stands
at "because the chart tells him…", mid-paragraph, the first words of page 3
in the Layout room.

## 29. One library, live between projects

Sources brought in from another project (§11) were copies; a change in one
project never reached the other. Each project still keeps its own copies,
so a file is whole on its own and opens, syncs and prints without the
other. But the copies are now **linked**, and the project they came from
acts as the library.

- **Linking.** *Bring in sources* links what it brings, unless the writer
  unticks "Keep them linked". A linked source remembers the project's path
  and name, that project's own record of it, and a fingerprint of its
  facts as they stood when the two last agreed (`link.base`). The facts are
  who, what, where, when, the identifiers, the note and the Word text. A
  short code and tags are each project's own and never travel. A duplicate
  is not linked.
- **In step, each time the library opens** (`syncLinkedLibrary`, in
  `library-links.ts`). Every linked project is read, and each linked source
  compared with its original:
  - **Changed there only:** the change comes here.
  - **Changed here only:** the change goes there, written into that project
    only if it hasn't changed since it was read (the same guard as sending
    extracts). The browser preview keeps a recovery point of it first.
  - **Changed on both:** nothing moves, and the writer chooses: *Keep this
    project's* (sent there) or *Take The Sea's* (`settleLink`).
  - **Gone there** (deleted or archived): the copy stays, unlinked, this
    project's own.
  - **There unreadable** (moved, deleted, offline): the link waits for next
    time.
- **A send counts only once it's written.** Where writing into the other
  project fails, nothing here is marked as sent, so the next opening sees
  the same change and tries again. An edit can't be lost to a failed send.
- **Shown.** The list says "linked to The Sea" beside each linked source,
  the source says what being linked means and offers *Unlink*, and the
  status line says what came, what went, and what couldn't be read.
- **In the cloud.** The link travels in the source's metadata, like
  everything else about it.

Checked end to end in the browser preview: two sources brought from The
Sea into a Document project, linked; a title changed in the Document's
library reached The Sea when the library was next opened.

## 30. Not yet

- A Word note in a form other than Chicago's, APA's or MLA's (Harvard's
  author-date notes beyond "(Smith 2019)", a legal citation), or one that
  says something besides its source, is kept whole and flagged.
- A reflowable eBook exported without the Layout room open carries no print
  page numbers: the pages are only known once the room has laid them.
- The fixed-layout eBook is unchanged: its pages are the laid pages already.
- A linked library is found by its file's path. Moved or renamed, or on
  another computer where the path does not exist, the links wait (nothing
  is lost) until the writer brings the sources in again from the new place.
- A change is sent into a project's file on disk. If that project is open
  in another window at the time, its next save puts back what it had, and
  the change is then taken back here at the next opening. (Sending extracts,
  addendum 42 §10, has the same limit.)
- Sources already in this library when another is brought in are not
  linked: linking two that differ would make one overwrite the other.
