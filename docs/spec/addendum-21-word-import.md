# Addendum 21 — Word import

*A Word document comes in with its formatting: the face and size each
paragraph was set in, its marks, its headings and its pictures. A script is
read by where its paragraphs sit and a book by what its headings say, and
what the document looked like is kept as data and honoured where the writer
asks for it.*

Status: built, 19 September 2026; §9 says what each stage does.

## 0. Where it came from

Ken, 19 September:

> I also want everything to be able to import a Word document and maintain
> the formatting. Along with the font type and size.

*Everything* is the three places a file can arrive: the script importer on
the Welcome screen and the File menu, the research importer in the
Instructional room, and — through the first — every format the program
writes, a screenplay as much as a novel.

## 1. The audit: what already exists

The **script importer** (addendum 02 §18) reads two kinds of file, and the
two are the two halves of what a Word document needs. Final Draft is XML
read by a hand-written tag reader, `import-fdx.ts`, chosen over a library
for a reason that holds here too: `DOMParser` is not in the main process, a
dependency in the path of opening a file is a liability, and the document is
small and regular. A PDF is read as **laid-out lines** — text and where it
sits — and `readLaidOutLines` classifies them by the geometry of the format:
cues in the cue band, speeches in the speech band, sluglines at the margin.
Both hand one `ImportedScript` to one builder, `buildProjectFromImport`,
which makes the project. A third reader is a third way of producing that
shape and no change to the builder's job.

The **research importer** (addendum 16 §4) says in its own comment what it
does with a `.docx`: *deliberately narrow — a `.docx` is a zip and reading
it as text produces mojibake rather than a note, so it is left to be
reported as skipped.* Its extensibility point is named in the same breath:
a host-side extractor, and one entry in `READERS`.

The **manuscript element** has carried `attributes` since the beginning, a
record of strings, numbers and booleans, used for `dual` and `assetId` and
`imported_guess`. A face and a size have somewhere to live without a
migration.

What did not exist: a zip reader, a Word reader, and any way for the words
to remember how they were set.

## 2. The host unzips and the domain reads

A `.docx` is a zip of XML parts: `word/document.xml`, `word/styles.xml`,
`word/theme/theme1.xml`, the relationships that name the pictures, and the
pictures under `word/media/`. The split follows the PDF importer's: the
**host** turns bytes into strings — `unzip.ts` reads the central directory
and inflates an entry with the platform's own `DecompressionStream`, and
`read-docx.ts` hands over the parts as a `DocxParts` — and the **domain**
decides what every paragraph is, in `import-docx.ts`, where it is tested with
a string and no zip anywhere. The zip reader is written here for the reason
the XML reader was; it refuses zip64, which no Word document is, rather than
reading it wrong.

What is read of each paragraph: the words, with bold, italic and underline
written back as the editor's own marks (`**`, `*`, `_`, around the words and
never around the spaces beside them); its style and the style's outline
level, the `basedOn` chain walked to the root so a *heading 2* inherits its
face from *heading 1*; how it is aligned and indented, in inches; the face
and size it was set in, the theme's *major* and *minor* faces resolved to
names, a run's own properties winning over its character style, over the
paragraph's, over the paragraph style's, over the document's defaults;
whether a page break comes before it; and any picture it holds, with the
drawing's extent as its size.

## 3. Formatting is kept as data and honoured where asked

The element keeps three attributes: `face`, `size` in points, and `align`
where it is centred or right-aligned. Nothing else about the manuscript
changes, and in particular **the manuscript print does not**: a screenplay
imported from Word still prints as a screenplay, Courier on letter, because
that is what a screenplay is, and a novel still prints as a manuscript for
the same reason. The formatting is honoured in two places, both opt-in:

- **The Write page** has an *As imported* face in the Script's gear beside
  Courier and Georgia. Under it, a paragraph with a face or a size of its own
  wears it; the rest are Courier. Under any other face the page is one face,
  which is what choosing one means.
- **The Layout room** has *As imported* among the book's faces. Under it
  each block is set in its own face and size — the size snapped to whole
  lines of the book's leading, so the page keeps its grid — and under any
  other face the book is set in that face and only the alignment survives,
  a centred paragraph being centred whatever it is set in.

Alignment is kept everywhere because it is a fact about the words rather
than about the type.

## 4. A script by its geometry, a book by its headings

Two readings, and the format chooses. A **script** typed in Word — sluglines
at the margin, cues centred, speeches an inch in, transitions to the right —
is laid out as the lines a PDF gives, each paragraph's indent where its line
starts (a centred paragraph in the cue band, a right-aligned one where a
transition sits), and handed to the same `readLaidOutLines` a PDF goes
through. Each paragraph is set far enough from the last that the reader
does not rejoin two of them, since **a Word paragraph is a paragraph, never
a wrapped line**. Nothing about screenplay classification was written twice.

A **book** divides at its chapter headings: a top-level heading, a line that
says *Chapter Three* or *Part II* (`CHAPTER_HEAD`, shared with the builder
so the two cannot disagree about what a heading is called), or a short
centred line after a page break. Under a chapter, a paragraph becomes what
its style made it — a heading, a quotation (the *Quote* style or an indent),
a scene break (`* * *` centred), a figure, a list item, or a paragraph. A
chapter heading becomes a **story marker** rather than a line of the
manuscript, because that is what a chapter is (addendum 19 §1); its number
is derived, so *Chapter 3* on its own leaves the title empty and *Chapter
3: The Road* is called *The Road*. A title paragraph at the top is the
book's, a *by* line under it the author's. A document with no chapter
headings comes in as one chapter and says so.

Only a Word document can come in as a book: a PDF's lines say where, not
what, so the three book formats are offered in the dialog for a `.docx`
and for nothing else, and choosing one **reads the document again** rather
than converting a script — the document is kept in the dialog and read for
whichever format is chosen.

## 5. Notes

The research importer gets a Word document as **markdown**: headings become
`#` lines, so the document splits where the author's own headings say,
lists become `-` lines, and the marks are the editor's already. Its pictures
come along as files of their own, for the graphics library. The reader's
comment about mojibake is gone, and the markdown reader's `handles` names
`docx` beside `md`.

## 6. Pictures

A picture in the document becomes an **asset** in the graphics library and
a **figure** element that names it (addendum 16 §9), so cutting the figure
keeps the picture as it does for one placed by hand. The dialog counts them
as a figure — *Pictures* — rather than warning about them, since a picture
arriving is not a thing to look into. A picture in a form the page cannot
draw (an EMF, a WMF) is left out and the paragraph comes in without it.

## 7. Where it is

- `packages/domain/src/xml-walk.ts` — the tag reader, shared with Final
  Draft, and a walker with open, close and text handlers.
- `packages/domain/src/import-docx.ts` — `readDocx`, `docxToScript`,
  `docxToProse`, `docxToImport`, `docxToMarkdown`, `opensChapter`.
- `packages/domain/src/import-build.ts` — attributes carried into the
  element, pictures into assets and figures, chapter markers on a prose
  format, `chapterName`.
- `packages/domain/src/book-plan.ts` and `print-book.ts` — a block's
  `face`, `size` and `align`, and `blockStyle`.
- `apps/desktop/src/renderer/unzip.ts`, `read-docx.ts` — the host's half.
- `ImportDialog.tsx`, `ImportNotesPanel.tsx`, `ScriptOptions.tsx`
  (`IMPORTED_FACE`), `StoryView.tsx`, `BeatBody.tsx`.

No migration: `face`, `size` and `align` ride in the element's existing
`attributes`, and `imported` joins `BOOK_FACES` in the project document.

## 8. What is deliberately not done

- **Tables** come in as their cells' paragraphs, in order. A table in a
  manuscript is rare and a table in a textbook is a figure.
- **Footnotes, comments and tracked changes** are not read. A footnote is
  an apparatus the manuscript has no element for; a tracked change is an
  argument between two drafts, and importing either side silently would
  take a side.
- **Character-level face changes** inside a paragraph are read as the
  paragraph's, from its first run. A word in a different face mid-sentence
  is a thing the element cannot hold, and inventing a span attribute for it
  would be a second inline syntax beside the marks.
- The manuscript print stays standard format (§3).

## 9. What each stage built

- **Stage 1, the reader.** `xml-walk.ts` split out of `import-fdx.ts`;
  `import-docx.ts` reading paragraphs, styles, theme faces, marks,
  character styles, pictures and page breaks; `docxToLines` and
  `docxToScript` through the PDF reader; `docxToProse` by headings;
  `docxToMarkdown` for notes.
- **Stage 2, the builder.** Attributes carried through; pictures made into
  assets and figures; a prose import gets chapter markers and no sluglines;
  `chapterName`; a Word document named as the source in the project note.
- **Stage 3, the host.** `unzip.ts` and `read-docx.ts`; the dialog accepts
  `.docx`, offers the book formats for it, reads the document again when
  the format changes, and counts chapters, paragraphs, headings and
  pictures for a book; the research importer reads it as markdown with its
  pictures; the Welcome button says *Final Draft, Word or PDF*.
- **Stage 4, honouring it.** *As imported* on the Write page and in the
  Layout room (§3).
- **Driven in Chromium**, which found two things the tests had not: the
  found panel listed the chapter headings under *Where it happens* — the
  summary reads a scene's heading as a slugline, and *Chapter One* is
  nowhere the story happens — and a picture arriving was drawn in red as a
  warning. The chapter headings are no longer places and the pictures are a
  count.
