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
| 2 | Footnotes at the foot of each page in Layout; the bibliography generated as back matter | next |
| 3 | Export: Word footnotes and bibliography, PDF through Layout, EPUB notes; footnotes read from Word | after |
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
(`citation` on `InlineSpan`). Every renderer that does not yet know about
citations — print, eBook, Word, pagination — therefore prints nothing for
one, rather than its characters, until phases 2 and 3 teach them.

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

## 8. Not yet (phases 2–4)

- Footnotes at the foot of the page in Layout, above the footer, following
  their markers as pages reflow.
- The bibliography generated as back matter from the library.
- What print, the eBook and Word make of a citation. Until phase 2 a
  citation prints **nothing** in Layout, the PDF, the eBook and Word, so a
  book should not be published with citations until then.
- Reading Word footnotes back in.
- The spec §6 header and footer gaps.
- The Document (word-processor) module sharing the library.
