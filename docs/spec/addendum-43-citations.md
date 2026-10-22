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
| 3 | Export: Word footnotes and bibliography, EPUB notes; footnotes read from Word | next |
| 4 | The header and footer gaps against spec §6 (author, date and custom fields, per-section restart, first page per section) | after |

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
(`citation` on `InlineSpan`). A renderer that does not yet know about
citations (the eBook, Word, pagination) prints nothing for one rather than
its characters. Layout and its PDF learned them in phase 2 (§8); the eBook
and Word learn them in phase 3.

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

## 9. Not yet (phases 3–4)

- What the eBook and Word make of a citation. Until phase 3 a citation prints
  **nothing** in the eBook or Word: no marker, no note, no parenthetical. The
  bibliography page reaches the eBook as the back matter does.
- Reading Word footnotes back in.
- A note carried on to the next page when it is too tall for its own.
- Citations typed into front- or back-matter pages (they are numbered only in
  the story).
- The spec §6 header and footer gaps.
- The Document (word-processor) module sharing the library.
