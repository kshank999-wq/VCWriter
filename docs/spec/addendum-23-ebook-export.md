# Addendum 23 — eBook export

*One EPUB 3.3 read off the book's own blocks, checked against the store it
is going to before anything is written, and delivered with its cover and a
report beside it. Nothing about a page survives the journey, and the
preflight says so.*

Status: phases 1 to 4 of Ken's spec built, 20 September 2026; §9 says
what each stage does, §10 is the fixed-layout book, §11 the accessibility
reading, and §8 what is deliberately not built.

## 0. Where it came from

Ken's *VC Writer — eBook Export Engine, Development Specification*, research
verified September 2026: a one-click export from the laid-out book to a
standards-compliant EPUB 3.3, with platform presets that validate and adapt
the same package for Amazon Kindle, Apple Books, Barnes & Noble Press, Kobo,
Google Play, Draft2Digital and IngramSpark. Its architectural decision is
the one this addendum builds on: **one canonical package, and retailer
rules as data** — never a renderer per store.

## 1. The audit: what already exists

The spec's §13 asks for an *eBook Intermediate Representation*: book order,
semantic blocks, inline styles, notes, images, metadata and navigation,
independent of print layout. **It exists and is called `bookBlocks`**
(addendum 20 §5). The Layout room already reads the project into exactly
that sequence — front matter, chapter openings with their leaves,
paragraphs with their parsed marks, headings, quotations, scene breaks,
figures, plates, back matter — before it measures anything, and the
measuring is the only print-shaped step. So the exporter is a **second
reader of the same blocks**, the eleventh time this project has found the
general mechanism standing and merely narrow in use.

The rest of the audit: a zip *reader* exists (addendum 21) and a writer does
not; the project already carries a title, an author, a synopsis, a logline,
an imprint and key art, and lacks a language, an ISBN, rights and a cover;
the manuscript has no footnote element, so the spec's note semantics have
nothing to carry; and the print stack's PDF export is the *companion PDF*
Google asks for, already built.

## 2. The blocks are the book's model

`ebook.ts` walks `bookBlocks(file)` and writes each run of blocks as one
XHTML file: a file per part of the front and back matter, a file per
chapter (or per story in a collection, addendum 22), and one for a body
with no chapters. The contents part is dropped in favour of the navigation
document, which every reader shows; the index part is dropped because it is
a list of page numbers and a reflowable book has none — both said in the
log. A plate keeps its place before the chapter it stands before.

Every block becomes the semantic thing the spec asks for: `<h1>` on a
chapter opening with its label and name as spans, `<em>` and `<strong>` from
the marks, `<blockquote>`, `<figure>` with `<figcaption>` and the asset's
alt text, `<h2>` for a heading, and a scene break as **one separator
paragraph with a role**, never empty paragraphs. The chapter's first
paragraph carries the Layout room's opening treatment as a class, so a
small-caps opening in print is a small-caps opening on the device. Every
string is escaped and every void tag closed, so the files are well-formed by
construction — and the desktop's test parses every one of them as XML to
prove it.

**Nothing about a page survives**: no folio, no running head, no blank
verso, no trim, no margins; the stylesheet is small and relative, and it
does not name a face, because the reader's face is the reader's. The log
says each of these out loud, since a writer who set a trim with care should
hear that it was, rightly, ignored.

## 3. The stores as rules

`ebook-presets.ts` is one record per store — a size limit, a cover's minimum
short side or each side or maximum long side, a cover's file limit, an
interior pixel limit, whether the cover must be inside the package, whether
one is written beside it, whether an ISBN is required, whether the EPUB 2
contents file is added for older readers, and a checklist of what to do at
the store. The figures are the ones each retailer published as of September
2026, cited in Ken's spec; when one moves, this is the line to edit. The
preflight reads them; nothing else does.

## 4. Metadata stored on the book

The eBook's fields live in `settings.book.ebook` (one JSON column, no
migration): language, ISBN, publisher, publication date, description,
rights, series name and number, the cover, and the store last chosen.
Empty means *not given*, and `ebookMetadataOf` falls back to what the
project already knows — the title page's title and author, the imprint as
publisher, the synopsis then the logline as description, the project's key
art as the cover — so a first export of an old project says something
sensible, and a second export says the same as the first. The package
identifier is the ISBN where there is one and the project's own UUID where
there is not.

## 5. The zip

`zip-write.ts` is the reader's other half: the central directory written
by hand, deflate done by the platform's `CompressionStream`, and the
`mimetype` entry first and stored, which is what makes a file an EPUB
rather than a zip with an EPUB inside it. One timestamp for the whole
archive, the package's *modified*, so two exports differ only where they
were asked to.

## 6. Preflight

`ebook-preflight.ts` runs on the built package before anything is zipped
and answers what a store's own checker asks first: is the package named
(title, language, identifier), is the cover there where the store demands
it and big enough, is every picture under the limit, does every link in
every file land on a file in the package, are the ids unique, is the book
under the store's size. Errors hold the export; warnings do not; notes are
the log. What it cannot do is EPUBCheck's own validation, which is a Java
program; the report says so rather than pretending, which is the same
honesty the model call in addendum 16 keeps.

## 7. The screen

*Export as eBook…* sits beside *Export the book…* in the Layout room's bar,
and the dialog is the preflight: the package is rebuilt from the book at
every change, the findings are shown in three groups, the fields save as
they are typed, and the button holds while an error stands. Writing the
book asks where, makes a folder named *Title - eBook Export* there
(`saveExport` on the bridge; in the browser each file is a download), and
puts in it the EPUB, the cover beside it where the store asks, a report of
the findings and the log, and a `metadata.json` for later. The panel then
says what to do at the store.

## 8. What is deliberately not done

- **EPUBCheck** is not run inside the program. It is a Java program; the
  desktop does not carry a JVM. The check after packaging (§9) reads the
  archive back and the report says to run EPUBCheck before uploading where
  the store insists; it has been run by hand over every book in the corpus.
- **Footnotes and endnotes.** The manuscript has no element for them, so
  there is nothing to carry. When one exists it becomes a block, and the
  block becomes EPUB note semantics here.
- **Embedded fonts.** A licence question the program cannot answer for the
  writer; the reader's face is used and the log says so. This is also the
  fixed-layout book's one honest limitation (§10).
- **Media overlays and enhanced books.** Phase 4's *if product direction
  requires*: an overlay is recorded speech synchronised to the text, and
  the program records nobody's speech — its read-back voices (spec §10)
  are synthesised on the desk and never kept. When a recording exists
  there is something to synchronise.
- **Retailer APIs**, which the spec puts in phase 5 and keeps apart from
  file export for good reasons of its own.
- **Image re-encoding.** A picture is carried as it is in the library and
  never upscaled; a picture past a store's limit is an error that names it.
- **A conformance claim.** The package says what it truthfully can about
  its accessibility (§11) and never that it conforms to EPUB Accessibility
  or WCAG: conformance is a certification of the whole book, which no
  program that has not read it can give.

## 9. What each stage built

- **Stage 1, the package.** `ebook.ts` — metadata, sections, images, the
  cover, the navigation document with landmarks, the EPUB 2 contents file
  where the store's rules ask, the package document with accessibility
  metadata the book can truthfully claim, the stylesheet; `zip-write.ts`.
- **Stage 2, the rules and the preflight.** `ebook-presets.ts`,
  `ebook-preflight.ts`, `ebookReport`.
- **Stage 3, the screen and the delivery.** `EbookExportDialog.tsx`, the
  Layout bar's button, `saveExport` on all three bridges, the eBook fields
  on the book's settings.
- **Proved.** The domain builds a novel and a collection into packages and
  checks their parts; the desktop reads the archive back through its own
  zip reader with the mimetype first, parses every XHTML, OPF and NCX file
  as XML, and drives the dialog from a warning through a blocking error to
  the files written. And **EPUBCheck 5.2.1 itself was run** on three
  packages written by the domain — a novel for the universal target, the
  same novel with a cover, an ISBN and a series for IngramSpark, and a
  collection for Apple Books — and reported **0 errors, 0 warnings** on
  each. It caught two things on the way that the tests had not: a default
  part's id carried a colon, which an XML name may not, and the landmarks
  pointed at the navigation document while it stood outside the reading
  order — so the navigation document now sits in the spine after the front
  matter, as the visible contents page. The program still does not ship a
  JVM, so the preflight's last note stands.
- **Stage 4, the device preview (phase 3).** `ebook-preview.ts` and
  `EbookPreview.tsx`: the *Preview* tab of the dialog shows the package's
  own files — the XHTML the store receives, its stylesheet inlined and its
  pictures put back, and nothing else — in a frame the size of a screen a
  reader holds (a 6.8″ Kindle, a 6″ Kobo or NOOK, a phone, a tablet, in the
  CSS pixels a reading app lays out), with the reader's type size in the
  reader's hand and the sections turned a screen at a time. The screens
  are an honest approximation: a reflowable file is set in columns the
  width of the device and counted by the flow's width, which is what a
  reading system does and not what any one of them does exactly, and the
  foot of the panel says so. A fixed-layout page is scaled to fit, as every
  reader scales it — and a blank verso shows blank, because it is.
- **Stage 5, Kindle Previewer (phase 3).** `main/kindle-previewer.ts` and
  two optional methods on the bridge: where Amazon installs the Previewer
  is looked in, and after writing for any store the panel offers *Open in
  Kindle Previewer* where it is installed; for Kindle it says otherwise
  that KDP recommends it. Absent in the browser, where there is no
  computer to look on. Nothing is downloaded and nothing is asked of
  Amazon.
- **Stage 6, the report and the check after packaging (phase 3).**
  `ebookReportHtml` writes `export-report.html` beside the book — target,
  layout, files and their sizes, the findings by severity, what was done on
  the way, every part of the package with its type and size, every picture
  with its description or the want of one, and the store's checklist.
  `packagedCheck` is Ken's *preflight again after packaging*, and it is
  about the archive rather than the book: the central directory is read
  back and the mimetype must be first, stored and exact, every file the
  package meant to write must be there once, and each one's length and
  checksum must be what was handed to the writer. Nothing is inflated. The
  panel says the result after writing and the report carries it.
- **Stage 7, the regression corpus (phase 3).** `ebook-corpus.test.ts`:
  a twenty-chapter novel; smart quotes, dashes, ellipses, accents and four
  non-Latin scripts; several authors; pictures and a cover; parts before
  and after the story; a collection with a written and an imported story;
  and every store preset on one book. Each must export with nothing
  blocking, pass the packaged check, carry no markup an XML parser refuses,
  and come out the same twice. The same books were written to disk and run
  through **EPUBCheck 5.2.1: 0 errors, 0 warnings** on each, the
  fixed-layout ones included. It found one thing the tests had not — a
  part and the chapter opening under it on one page listed that page twice
  in the EPUB 2 contents, which that reader refuses — so a fixed page is
  named once. Hyperlinks and notes are in Ken's list and not in the corpus,
  the manuscript having no element for either.
- **Stage 8, the fixed-layout book (phase 4).** §10.
- **Stage 9, the accessibility reading (phase 4).** §11.

## 10. The fixed-layout book

Ken's §15 says when: an illustrated book, a comic, a children's book, work
where the composition must stay exact — and never a novel merely because
it has a trim. So the reflowable book stays the default and the
recommendation, and *Fixed layout* is a second choice on the dialog, offered
only once the Layout room has laid the pages, because that is what it is
made of.

`ebook-fixed.ts` is a **third reader**: where the reflowable book reads the
*blocks*, this reads the *pages* — the same `renderBookPage` markup the
screen draws and the PDF prints, one XHTML document per page at the trim in
CSS pixels, with the viewport the pre-paginated layout requires, `rendition:
layout` on the package, and each page's side (verso left, recto right, the
cover centred) on its spine item, so a reader that shows spreads shows the
right ones. Page numbers, running heads and blank versos are **kept**, this
time: they are part of the page. The pictures a page draws as data URLs are
moved into the package's files with the alt text the page gave them, and
the page's stylesheet is the room's own — the same custom properties, the
same rules — so the page on the device is the page in the room. The two
exporters share everything below the content: the image bank, the cover,
the accessibility reading and `finishPackage`, which writes the navigation,
the package document, the container and the mimetype for either. The
contents lists the first page of each part and the page each chapter opens
on, read off the pages, so a chapter that moved lists where it now is.

Two honest limits, said rather than hidden. **The faces are not embedded**
(§8): a reader without the book's face sets each page in its own, and the
lines may fall differently *within* the page; the log says so. And **a
book of text should not be fixed**: the preflight warns when fewer than
half the pages carry a picture, in Ken's own words about a reader who can
no longer change the type size, and each store's stance is a rule
(`fixedLayout` on the preset — Draft2Digital refuses it, an error; NOOK and
IngramSpark reach fewer shelves with it, a warning).

## 11. What the package says about itself

Ken's §16 asks for accessibility metadata *when VC Writer can truthfully
determine it*, and the rule here is that **every claim is read off the
package**. The modes come from whether there are pictures;
`accessModeSufficient: textual` and `alternativeText` are claimed only when
no picture still owes a description; `displayTransformability` only on a
book the reader may reflow; `structuralNavigation` because the headings
are real and the contents lists them; and the summary is a sentence about
this book. No conformance is claimed (§8).

A picture owes a description unless the writer gave one or marked the
figure **decorative** — the spec's *allow decorative designation*. The
description is the picture's, in the library (`altText`, edited from the
dialog's *Pictures* list, which is where the preflight's warning finally
has somewhere to act); decorative is the *figure's*, on the element beside
its placement (`markFigureDecorative`, no migration), because the same
picture can be an ornament in one place and a figure that carries meaning
in another. A decorative figure is written with an empty alt and a
presentation role, a chapter device the same, and neither is counted
against the book. `needsDescription` on a package image is the one thing
the preflight and the metadata read, so they cannot disagree.

