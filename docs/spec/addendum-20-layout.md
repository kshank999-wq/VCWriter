# Addendum 20 — Layout

*A room for setting the book: the trim size drives the page, the plan says
what is in front of the story and behind it, and the words stay where they
were written.*

Status: all eight stages built, 19 September 2026; §13 says what each
does.

## 0. Where it came from

Ken, 18 September:

> In the novel, and short story sections, and instructional, there's going to
> be a layout section that is going to be comparable to the software Vellum.
> You enter in the trim size and it will automatically set up margins, page
> numbers, headers, footers, spread balancing, and allows you to insert your
> illustrated pages, chapter pages, index and other fore pages. And also pages
> in the end, possibly indexing or about the author or pages after the story.
> This will be called Layout, and will be its own section like Research. Needs
> to be easy: can help you format your text, pick your fonts, stylize the
> pages, etc., add in little graphics, cut them into your text, and re-lay
> everything out — basically everything you need to do a book layout.

So: a **Layout** room, on the three prose formats, opened from the title bar
beside Research, that turns the manuscript into a book.

## 1. The audit: what already exists

Less than usual, and the reason is the one fact that shapes the whole
addendum. **Everything the program prints today is a manuscript.** The page
is letter, the face is Courier at 12pt, a line is a sixth of an inch, and the
paginator lays text on a **character grid** — sixty columns, twenty-five
double-spaced lines for prose (`PROSE_LAYOUT` in `pagination.ts`). That is
standard manuscript format, the thing a novel goes out to an agent in, and it
is right. It is also not a book, and no setting of it can become one: a book
is proportional type at a trim size, and a character grid cannot say where a
line of Garamond breaks.

What does exist, and is only being widened:

| Asked for | Already built | Where |
| --- | --- | --- |
| Chapter pages | The leaf between chapters, its style set once for the book, its number derived, a summary, three templates, a graphic from the library | addendum 02 §12a, addendum 19 §7, `chapter-style.ts` |
| A contents page | `contentsOf`, listing chapters and the sections under them, with the page each opens on | `markers.ts`, `pagination.ts` |
| An index | Marks the writer places, page numbers stored nowhere, read off the pagination every time | addendum 10, `book-index.ts` |
| A title page | `settings.titlePage`, with a logotype and the front-page fields | spec §6.1, `entities/title-page.ts` |
| Fonts | Three faces named for what they are for and resolved to stacks that end in a generic family, so a page prints on a machine that has none of them | `chapter-style.ts` |
| Graphics | The library (`assets`), and a **figure** that is an element of the manuscript with its height read from the picture | addendum 16 §9 |
| The print stack | One HTML document for preview and PDF, a page being a `div` the size of the paper, `@page` at zero so the browser draws nothing of its own, `printToPDF` in the main process | `print-html.ts`, `export-pdf.ts` |
| A room on the title bar, in its own window | `ROOM_PANES`, `SHAPES`, `paneTitle`, a branch in `Satellite.tsx`, a *Window* menu item | addendum 02 §8 |
| Numbering and ornaments | `markerNumbering` and `markerSymbol` on the settings | addendum 02 §11 |
| Paragraph style | Indented or blocked, a book setting | spec §6.4 |

What is genuinely new: a trim size and everything derived from it; a plan of
the book's parts, front and back; recto and verso, running heads and folios;
a typesetting of proportional type; spread balancing; plates and insets; and
the room itself.

## 2. The manuscript and the book are two settings of one text

The words are the manuscript's. The Layout room **never edits them**: it
decides how they are set, and Write stays the one place anything is written.
This is the same shape as every other room in the program — Research, the
Sculptor and the Outliner all read the manuscript and write to it through
one door — and it is what keeps a novel one document rather than a
manuscript and a book that drift apart.

What follows from it: **the manuscript printing is untouched.** *File ▸
Export PDF* still produces standard manuscript format, because that is what
goes to an agent. The Layout room produces a second document, **the book**,
from the same elements, and *Export the book…* lives in the room.

The parts of a book that are not the story — a dedication, a copyright page,
*About the author* — are the book's furniture rather than writing of the
story, so they are stored beside the book's settings (§5) and never in the
manuscript. A dedication that appeared in the Outliner as a scene would be a
mistake the writer would have to keep stepping around.

## 3. The trim size drives everything, and the derived values are readings

Ken's sentence: *you enter in the trim size and it will automatically set up
margins, page numbers, headers, footers.* Built literally: the writer chooses
a trim — from a list of the sizes printers take (5×8, 5.25×8, 5.5×8.5, 6×9,
6.14×9.21, 7×10, 8.5×11, A5, B-format, Royal) or a custom width and height —
and **every other measurement is worked out from it**, in `book-layout.ts`:

- **Margins**, from the trim by a classical proportion (the outside larger
  than the inside would be on a single sheet, the foot larger than the head)
  with the **inside margin growing with the page count**, because a thick
  book's gutter swallows more. Nothing here is stored: a book that grows from
  two hundred pages to four hundred widens its own gutter with nothing run.
  This is the **spine allowance** Ken asked for (*there's an adjustment made
  to compensate at the centre spine, and it should be automatic*): the
  inside margin is the outside plus what the binding takes at that page
  count, read from the laid count every time the book is laid — the laying
  runs again when the count crosses a tier, so the margin is never a guess
  — and `describeSpine` says under the margins what it carries now and
  when it next widens, so nobody hunts for a switch. A typed inside margin
  takes the working-out away, and the sentence says that instead.
- **The text block**, what is left; **lines per page**, the block's height
  over the leading; the **measure** in characters, which the room says out
  loud because a measure over about seventy-five characters is hard to read
  and the room should say so rather than let it happen.
- **Running heads and folios** placed in the head and foot margins, mirrored
  on verso and recto.

Any derived value may be **overridden** by typing one, and an override is the
one thing stored — `minimumSetups`' shape (addendum 11): `null` means *worked
out*, a number means *the writer said*. The room shows the derived value in
the box either way, greyed where it is derived, so the writer can see what
they would be overriding.

## 3a. What the book is called

From Ken, after laying one out: *it is taking it from the actual saved file
name, and that is ending up on the tops of the pages.* He was right, and it
was worse than the running heads — a project is named when it is made, and
an **import names it after the file on disk**, so `lamp-manuscript-final-v3`
was on every verso, on the contents page, on the title page, in the eBook's
metadata and on the exported PDF.

**One reading, `bookNames`** (`book-layout.ts`): the title the writer gave
the book, and the project's name only as the fallback. Everything that
names the book asks it — the running heads, the contents, the chapter
fallback, the title page, the copyright notice, the eBook and the exported
file — so none of them can disagree, and naming the book once fixes all of
them at the same moment.

**It is set in Book settings and nowhere else**, under *The book*: the
title, the author and the publisher, the three names that run through the
whole book. The project's own name is the **placeholder**, so it is clear
which is showing, and the project keeps that name — renaming the book does
not rename the file. The title page's part dialog shows what it will print
and has a button to *Book settings…* rather than a second box for the same
field, because a second box is a second answer.

## 3b. The margins are a standard, not a proportion and not a floor

From Ken, in two goes. First: *margins for novels should be standard with at
least .75" on the open edge and .9 on the bound edge — please verify.* Then,
after seeing that built: *the proportions need to be appropriate for the book
size, here is the standard* — with the published table, and the core rules
under it.

**The table is the rule now, and it corrects both earlier answers, including
his own first figures.** Worth writing down, because the same mistake was made
twice in opposite directions.

§3's original rule was a **proportion** of the trim. It gave a paperback too
little: a tenth of a 5 in page is 1/2 in of fore-edge whatever the book
weighs. So the first fix put a **floor** under it — one pair of numbers, 3/4
and 15/16, for every trim there is. That moved the error rather than fixing
it: a mass-market paperback got 3/4 in of fore-edge out of 4¼ in of paper,
which is a fifth of the page thrown away on each side, and the 5 × 8's measure
fell to 45 characters.

A proportion is wrong because the ink does not shrink with the paper. A single
floor is wrong because the **paper does not stop mattering**. The published
standard is neither: it is **a band per page size**.

| page size | inside / gutter | outside | top | bottom |
| --- | --- | --- | --- | --- |
| pocket / mass market (4.25 × 6.87 – 5 × 8) | 5/8 – 3/4 | 1/2 | 1/2 | 5/8 |
| digest / small novel (5.5 × 8.5) | 3/4 – 7/8 | 1/2 – 5/8 | 1/2 – 5/8 | 5/8 – 3/4 |
| US trade (6 × 9) | 3/4 – 9/10 | 1/2 – 5/8 | 5/8 – 3/4 | 3/4 – 7/8 |

The jump from a pocket book to a trade paperback is a quarter inch of trim and
an eighth of an inch of margin — which no proportion produces, and which is
the whole point.

`MARGIN_STANDARD` in `book-layout.ts` is that table, and `trimClassOf` says
which row a trim falls in. It reads the **area** rather than the width: how
much paper is in the hand is what the rows are about, and it puts a B format
and a 5 × 8 in the pocket row, a 5¼ × 8 and an A5 in the digest, a Royal with
the 6 × 9.

Three rules decide where inside a band a book lands, and all three are the
standard's own:

- **The thicker the book, the wider the gutter.** The inside walks its band as
  the page count rises — the one margin that is not a fact about the trim
  alone. On a trade paperback the walk is the standard's own schedule: 3/4 in
  to 150 pages, 13/16 to 300 (its 0.825, said as the nearest sixteenth), 7/8
  past that. Nothing is stored, so a book that grows re-reads its own gutter.
- **The thumb factor.** The outside is never under 1/2 in. It is the bottom of
  every band rather than a number anything computes.
- **Optical centring.** The foot is always wider than the head. A test asserts
  it on every trim at every thickness, along with the other two.

Where a band gives a range this takes its **middle**, the ends being the
standard's tolerance rather than two different right answers. Everything lands
on the **sixteenth**, so a margin prints as a fraction a printer can set —
which is why the standard's 0.825 appears as 13/16.

### The head and the foot break at 5½ × 8½

From Ken, after the table: the standard ranges the head and the foot over the
**whole book** — top 1/2 to 3/4, foot 5/8 to 7/8 — and then breaks them in two
rather than by trim row:

- **5½ × 8½ and smaller** take the **bottom** of both, 1/2 and 5/8, because on
  a small page the point is to maximise the reading space.
- **6 × 9 and larger** take the middle of 5/8–3/4 and 3/4–7/8, so the text
  block is not swallowed by white borders.

So this is the one place the middle-of-the-range rule above does not apply, and
the reason is worth keeping: **pocket and digest carry the same head and foot
while their sides differ**, because the question a head answers is *how tall is
the page* and the question a fore-edge answers is *where is the thumb*. They
are not the same question and they do not have to break at the same size.

It cost the digest row a sixteenth off each of the head and the foot, which is
two more lines on a 5½ × 8½ page: 35 where the first draft of this section gave
34 and the old proportion gave 33.

### A running head clears the paper's edge by a quarter inch

The standard's third rule about the head and the foot is about what sits
**inside** them rather than how deep they are: a running head or a folio must
keep 1/4 in of clear space to the physical edge, or the printer's trim can take
it off.

This was already right and **was not tested**, which is the same thing as being
right by accident. `headFromTop` and `footFromBottom` are
`Math.max(0.25, margin / 2)` — halfway into the margin, and never under the
quarter inch. What the test now pins is the part a reader has to take on trust:
that those two numbers are the **clear space itself** and not a baseline. They
are, because `.bk-running` and `.bk-folio` are set solid (`line-height: 1`) and
positioned by `top` and `bottom`, so the number is the distance to the near
side of the line. The doc comment said *baseline* and was wrong; a baseline at
1/4 in would put the ascenders about 0.14 in from the edge and break the rule
the field was there to keep.

Measured on the real page at 5½ × 8½: the head clears the top edge by exactly
0.25 in — the minimum, met exactly, because the head sits at half of a 1/2 in
margin — and has 0.128 in between it and the text block; the folio clears the
foot by 0.313 in. On a 6 × 9 the head clears by 0.34 in.

Two things the table does not cover are said here rather than pretended:

- **A workbook.** The standard stops at 6 × 9, novels being what it is written
  for, so the `large` row (7 × 10, 8½ × 11) is extrapolated from the same shape
  and labelled as such in the code.
- **A page bigger than that.** A custom trim past a workbook would take a
  workbook's margins and look starved, so the old proportion returns as a
  floor on the **sides alone** — the two edges a thumb and a binding take —
  with a coefficient set so it bites on nothing in the preset list, and the
  gutter grows with the fore-edge rather than being eaten by it.

`describeSpine` now names the row in force (*the standard for a digest
paperback puts the inside margin between ¾ and ⅞ in*), because a writer
looking at a derived number should be able to see which standard produced it.

What it comes to: the novel trims now set **52 to 66 characters** to the line,
where the floor had the 5 × 8 at 45 and the old proportion had the 6 × 9 at
76. The head and foot are shallower than the proportion was, so a 5½ × 8½
holds 34 lines where it held 33.

Ken's *title centred*, from the first go, was measured on the real page rather
than assumed: the story title was already exactly centred **on the text
block**. What is visible is that it is not centred on the **paper**, by half
the gutter, because the inside margin is wider than the outside. That is
correct bookbinding and the standard asks for it on every row.

## 4. The browser measures and the domain decides where the pages fall

The honest constraint. Where a line of proportional type breaks depends on
the font's advance widths, which the domain does not have — the faces are
stacks, resolved by the machine the page is drawn on. So the domain cannot
paginate a book on its own, and a domain that guessed with average character
widths would be wrong at every line.

The split is the one `capture-voice.ts` made for speech (*the browser hears
and the domain decides what was meant*), pointed at type:

- **The domain says what the book is made of and every rule about it**:
  the sequence of blocks (§5), which start on a recto, which carry a running
  head, how the pages are numbered, how many lines a page holds (§3), that a
  paragraph's last line may not stand alone at the head of a page nor its
  first alone at the foot, that a heading keeps the lines after it, that a
  spread's two pages are cut to the same depth.
- **The renderer measures**: it sets each block in the chosen face at the
  chosen size and measure, reads back how many lines it made, and hands the
  counts to the domain.
- **The domain lays the pages** from those counts (`book-pages.ts`): recto
  starts, blank versos, roman numbers over the front matter and arabic over
  the body, the running heads' words, widows and orphans, balancing. This is
  where the rules live, so it is tested with counts made up in a test, and a
  renderer that measured a line differently would change where a break falls
  and never whether a chapter opens on a recto.
- **The renderer draws** what it is given: a page is a `div` the size of the
  trim, the running head and folio positioned from the geometry, and the
  export is `printToPDF` with the paper set to the trim — the print stack's
  existing shape with a different paper.

The contents page and the index then read the **book's** pages rather than
the manuscript's, through the same `bookIndex` reading the manuscript's index
uses, given the book's page-of-element map. No page number is stored, still.

## 5. The plan: parts in front of the story and behind it

A book is a sequence of **parts**. Most of them exist as readings already
(§1) and stay that way; what is new is saying **where they go and what stands
around them**.

| Part | What it is | Stored? |
| --- | --- | --- |
| Half title | The title alone, first leaf | position only |
| Title page | Title, author, publisher | reads `settings.titlePage` and the book's imprint |
| Copyright | The notice, the ISBN, the edition | its text |
| Dedication | A few lines | its text |
| Epigraph | A quotation | its text |
| Contents | The chapters, read | position only |
| Foreword, preface, prologue, introduction | Prose before the story | its text |
| **The story** | The manuscript, in story order, with its chapter pages | never a part you move |
| Epilogue, afterword, acknowledgements, glossary | Prose after the story | its text |
| About the author, also by | The back pages | its text |
| Index | The index, read | position only |
| Art page | A picture that fills the page, edge to edge, in the front matter, at the back or facing a chapter | the asset, where it stands, and a description that prints nowhere |

Two rules shape it. **The story is not a part**: it is the manuscript, its
order is the story order, and nothing in the room reorders it — the
Outliner and the tracks do that. And **a part with a reading behind it stores
only its place**: the contents page's rows come from `contentsOf`, the
index's from `bookIndexOf`, the chapter pages from the markers, and a part
record that held a copy of any of them would be a second answer.

A new book starts with the parts nearly every book has — half title, title
page, copyright, contents, and *About the author* — and the writer adds,
removes and reorders the rest. The conventions a reader expects are
**rules rather than choices**: the copyright page is the verso of the title
page, every other front-matter part opens on a recto, the first page of the
story is a recto, the front matter is numbered in lowercase roman and the
body from 1 — and a chapter opening on a recto is a book setting the writer
can turn off, because some books run their chapters on.

Parts are stored in `settings.book.parts`, beside the trim and the type,
for the reason §2 gives and by the precedent of `settings.titlePage`: the
book's furniture travels with the book's settings. No migration.

## 6. The type

Picking fonts, in Ken's words, has to be easy, and the way to make it easy
is the way the chapter page did it: **a short list named for what each is
for**, resolved to stacks that print everywhere. The body face is one of a
handful of book faces — an old-style serif, a transitional serif, a modern
serif, a humanist sans for a textbook — at a size from 9 to 13 points and a
leading the room proposes from the size. A **style** is the face, the size,
the leading, the paragraph style (indented or blocked, already a setting),
what a chapter's first paragraph does (nothing, small capitals for the first
words, a drop cap), the ornament at a scene break, justification and
hyphenation. Three presets — *Classic*, *Modern*, *Textbook* — set all of it
at once, and any field can be changed after.

The chapter opening is **not restated here**: it is `settings.chapterPageStyle`
already, edited in *File ▸ Chapter page…*, and the room's chapter section is a
button to that dialog. Two places to set the same heading would be two
answers.

## 6a. The six faces by name

From Ken: *several fonts I want to add that are standard — Garamond,
Baskerville, Georgia, Caslon, Gill Sans and Lato.*

§6's list names a **kind** — old-style serif, transitional, modern, sans — on
the argument that naming what each is *for* makes picking easy. That argument
holds and the list stays. These six name a **font**, and both belong for
opposite reasons: a writer who knows they want Garamond should not have to work
out that it is an old-style serif, and one who does not should not have to know
what Garamond is.

They are offered **for a line of type as well as for the body**, in one list,
because a heading set in *Garamond* and a page set in *Garamond* being two
different fonts is exactly the kind of drift the room exists to prevent.

Each is a **stack headed by the font asked for and ending in a generic
family**, which is §12's open question unchanged: a machine without Caslon
prints the book in the nearest serif it has. Georgia is on nearly every machine
there is; Garamond comes with Windows and Office, Baskerville and Gill Sans
with macOS, and **Lato and Caslon are the two most likely to be missing**.
Bundling the files would make every machine print the same and is still
deferred — it is a licensing decision, not a technical one.

The one thing that is not cosmetic: each face carries a **character width**, so
the room can say how many characters fit the measure. Garamond sets narrow
(0.44 em) and Georgia wide (0.50), which is most of why one wants a point more
than the other to read the same — and why a book switched from Georgia to
Garamond gains characters to the line without the trim changing.

## 6b. A font of the writer's own

From Ken: *put an option to import a font. So you can download a font. And
select it from a browse. And be able to add it to your fonts.*

This is **§12's first open question answered from the other end**. Shipping
font files with the program is a licensing decision that is not ours to make,
and §6a's stacks resolve to whatever happens to be installed — so a book set in
Caslon prints in Caslon on one machine and in Georgia on the next. A writer who
has licensed a face can now hand it to their own book, and **the file travels
in the project**, which is the whole point: the same book sets the same
everywhere, which no stack can promise.

Four decisions carry it.

**Importing never chooses the face.** Bringing a font in and setting the book
in it are two decisions; a book quietly re-set by a file dialog is the worse
surprise. The list offers **Use it** instead, and says *In use* once it is.

**A face is a name or `font:<id>`,** and `faceStackOf` is the **one place a
face becomes type**. That mattered more than it looks: the part styles and the
running heads each carried their **own copy** of the face table, so an imported
face would have set the story and left the front matter in whatever the copy
held. Both ask the one resolver now — §7a's argument, arriving where a second
answer would have been visible on the page.

**A book whose font has gone still prints.** An imported face resolves to *its
own family first and a generic after it*, and a face naming a font that is not
there falls all the way back. The face is still stored, so putting the file
back brings the book back; nothing is silently rewritten.

**The room waits for the font before it believes its measurements.** A data URL
is decoded *after* the first layout, so the first measurement is of the
fallback — and a fallback that sets narrower puts the wrong number of lines on
every page. `document.fonts.ready` and one more laying is the honest fix, and
driving it proved the need: importing a display face took a nine-sheet book to
eleven.

The file is capped at **4 MB** for `MAX_CHAPTER_IMAGE_BYTES`' reason — the
project is a text file that syncs — and the room says what the fonts are
costing. Licensing is said once and not moralised about: embedding a font in a
book you sell is a question for your licence rather than for us.

Driving it found a real fault in code this did not write: the renderer's
content-security policy allowed `data:` for **images and nothing else**, so
`font-src` fell through to `default-src 'self'` and every imported font failed
to load with a network error. `font-src 'self' data:` is the same widening
`img-src` already had, for the same reason.

**Deliberately not done:** the eBook does not embed these (§8 has said fonts
are not embedded since phase 1, and an EPUB that carries a font is a separate
licensing and packaging question). The exported **PDF does**, because the print
document carries the file inline from the same builder the screen reads.

## 7. Running heads and folios

A running head is a reading: the verso carries one of *the book's title*,
*the author* or nothing, the recto one of *the chapter's title*, *the book's
title* or nothing, and the folio sits at the outside of the foot, the centre
of the foot, or the outside of the head. Display pages — the chapter
opening, every front-matter part, a plate, a blank — carry no running head,
and a chapter opening carries a folio only where the style says so. None of
the text is stored: the chapter's title is the marker's, and the book's title
is the project's.

## 7a. The furniture is the writer's

From Ken, after laying a book out: *the running headers and footers need to be
adjustable.*

He was right, and the gap was wider than the word suggests. §7 gave four
dropdowns — what each side carries, where the page number sits, whether an
opening shows one — and **nothing at all about how any of it looks**, with a
sentence under them admitting it: *the words in the running heads are read from
the book and its chapters; nothing about them is typed here.*

Worse, the look was not merely fixed, it was fixed **inconsistently**. The
print stylesheet set `.bk-running` at `0.8em`, in capitals, tracked a twelfth
of an em; then set `.bk-running.recto` in italic with the capitals off and the
tracking nearly closed. The verso and the recto looked different for a reason
neither could state, neither could be changed, and a book set throughout in a
sans face still printed a serif running head.

The audit paid a **fourteenth** time. A running head is **a line of type**, and
`LineStyle` — size, case, weight, slope, tracking — has been the record for
that since the chapter page (addendum 02 §12a), read again by the front
matter's pages (§9). So there is no new vocabulary: `runningHeadStyle` is three
`LineStyle`s and a face. On the way, `lineStyleVars` came out of
`chapter-style.ts` as the one place that decides what a line's fields *mean* —
it was two private copies, in the chapter style and the part style, and this
would have been the third.

Three decisions carry it.

**Three lines rather than one.** The verso, the recto and the folio are set
separately, because the hard-coded difference between the first two was a real
convention rather than an accident — the author's name in capitals against the
chapter's in italic. Collapsing them into one style would have changed every
existing book on the next open. So the **defaults are exactly what the
stylesheet printed**, and what was hidden is now the writer's to see and to
change. The whole domain suite passed without a single test being edited, which
is the proof.

**One list of contents for both sides.** There were two enums — the verso could
carry the author or the title, the recto the chapter or the title — and neither
side could state why it was refused the other's. Both now offer the same five,
`custom` among them: the writer's own words, a series name or a part's, which
nothing else could say. The words box is **absent rather than greyed** unless
that side carries them, a box for words the page will not print being a control
that lies.

**A size in points, not a share of the body.** `0.8em` grew when the body grew.
A running head is furniture rather than text, and a book set a point larger does
not want a larger running head. This is the one thing about an existing book
that reads differently, and only where the body is not 11 pt.

Two smaller ones. The head gained a **place** — centred, at the outer edge or at
the inner — which is the folio's own setting and whose absence was the plainer
asymmetry: the footer could be placed and the header could not. `headSideClass`
reads which physical side that is from the page, the outside of a verso being
its left edge and of a recto its right. And the folio gained **`none`**: a book
with no page numbers at all, which there was no way to ask for. It still
*counts* its pages — the contents and the index are read off the count — it
just prints none.

The one thing deliberately **not** adjustable is how far into the margin the
head and the folio sit. That is `margin / 2` and clamped to the quarter inch
§3b tests, because a control there can only put a running head under the
printer's blade.

### The chapter openings, the same way

From Ken, straight after: *the chapter openings need the same style options.*

Two gaps, and both are this section's shape pointed at the next fold down.

**The face was three generic names and one of them lied.** *Manuscript*,
*serif*, *sans* — so a chapter opening could not be set in the book's own face
by name, nor in two of the faces the book itself offers. And `manuscript`
**secretly meant the book's face** inside a book: `chapterStyleFor` in the print
stack overrode `--chapter-face` after `chapterStyleAttr` had already decided it,
so the word on the screen and the type on the page said different things. The
running heads had just got this right with an explicit `book`, so the list is
now theirs — the book's own face, the five it offers, and `manuscript` for the
Courier a script's chapter leaf actually wants. The override is gone:
`chapterStyleVars` takes the body face and resolves it, which is `partStyleVars`'
shape and one answer instead of two.

Nothing about an existing book changes. `manuscript` still resolves to the body
face where there is a book, being the older spelling of the same intent, and
`serif` still parses — it is the name old-style had, kept out of the offered
list as history rather than as a second answer.

**The opening's drop was hard-coded, and the screen admitted it.**
`.bk-opening` was `calc(var(--bk-lead) * 8)`, and under the drop slider the room
said *a chapter that opens above its first paragraph keeps the book's own
opening depth* — which is an admission, not a setting, exactly like the running
heads' *nothing about them is typed here*. `openingLines` is that number, and
the two drops now sit together: the leaf's in **inches**, because it is a page
of its own, and the opening's in **lines of the body**, because what it has to
look right against is the text under it. Eight is what it always drew.

### The epigraph and the dedication, the same way

From Ken: *the epigraph and dedication pages need the same style options.*

Three things were withheld from **exactly these two kinds** while the half
title and the title page had them, and a fourth turned out to be broken.

**The lines under the words.** *Lines under it* was `part.kind ===
'title_page'` alone, so an epigraph's attribution and a dedication's second
line could not be set apart from the words above them — every line took the
one style. They are the title page's own shape: **the first line is the words
and everything under it is the lines under them**, which is not a guess but the
rule that page already follows. They **start as the words** (`KIND_DEFAULTS`
gains a `line` equal to each kind's `title`), so a page made before this is
unchanged; the title page's tracked capitals would have been absurd on a
dedication.

**A rule.** `{words ? null : …}` — these two kinds alone could not have one.
Books put a rule under an epigraph; there was no reason for the exclusion.

**A page of art.** The picker sat inside the half-title/title-page branch, so a
dedication as a piece of artwork was impossible. It is lifted out to every
**designed** page, because the words are in the picture whichever page it is
and the print draws all four through `fullPageArt`. The block now carries
`assetId` for these kinds too.

**And the one option they did have was dead.** Driving the real page found the
attribution taking the body size however it was set — the variable arrived on
the box (`--pt-line-size: 8pt`) and nothing moved. The cause is in code this
change did not write: the stylesheet said

```
.bk-display .bk-words p { font-size: var(--pt-title-size, 1em); … }
```

with a **descendant combinator**, and `bk-display` and `bk-words` are two
classes on **one element** — so the rule had never matched anything, and the
*words* control on the dedication and epigraph dialogs had been doing nothing
since it shipped. The neighbouring rules are fine because `.bk-book-title` and
`.bk-author` really are children. One space deleted. The defaults are exactly
what the dead rule fell back to (11 pt italic, inherited), so no existing page
moves; only a writer who had changed the control and seen nothing happen now
gets what they asked for.

### The copyright page, the same way

From Ken: *the copyright page needs the same style options.*

It was the one designed page with **no style at all**. `partHasStyle` refused
it outright, so the Page style section never appeared, and its whole look was
three declarations in the print stylesheet: ranged left, at the foot, `0.8em`.
There was no face, no size, no case, no weight, no tracking and no rule.

It is a designed page now, with one difference that is the page rather than a
choice. **It hangs at the foot**, which is what a copyright page is: a notice
floating a third of the way down is not one, and the block is long enough —
the notice, the ISBN, the edition, the printer — that a drop from the head
would push it off the page. So `partHangsAtFoot` makes the **template and the
drop absent** on it, the project's *absent rather than greyed* rule, with a
sentence saying where the page sits. Everything about its **type** is the
writer's: the face, the small print's size, case, weight, slope and tracking,
whether it is ranged left or centred, and a rule.

The size is **9 pt** where the stylesheet said `0.8em` — 8.8 pt at an
eleven-point body. That is the running heads' rule again: this is furniture,
and furniture does not grow because the body did.

### The contents page and the index, the same way

From Ken: *the contents page needs the same style options.*

Same gap, the last two pages that had it. `partHasStyle` refused both, so
their whole look was in the stylesheet — `.bk-part-title` at `1.3em`, in
capitals, tracked, centred, over entries at whatever size the body happened
to be. A book set in a sans face printed a serif contents heading, and there
was nowhere to say otherwise.

The predicate is now a **rule rather than a list**: a part is designed where
its page **prints type of its own**. Not a plate, which is a picture; and not
the prose parts, because a foreword's body *is* the book's body text and
should stay it. That is the line `partHasStyle` draws, and it names all seven.

`partHangsAtFoot` was a yes-or-no about one page, and there are now three
answers, so it is **`partPlacement`** — `block`, `foot`, `flows`. A designed
page's placement is what the page **is** rather than a choice, which is why
the template and the drop are **absent** on the two that are not a block of
words: the copyright page hangs at the foot, and the contents and the index
**flow** over as many pages as they need, so there is no single block on a
page to place. The heading stands at the head and the entries follow, and the
screen says so.

Everything about their type is the writer's, in the pair the other designed
pages already use: the **title** style is the heading, the **line** style is
the entries — one record said of a list rather than a second vocabulary. The
style sits on the wrapper rather than on each row, so the entries take it by
inheritance and a sub-entry's `0.92em` stays a share of the entry rather than
of the body; the heading takes the title style over the top. The alignment is
the heading's, the entries keeping their leader layout.

The defaults are what the stylesheet drew: **14 pt** for the heading (1.3em of
an eleven-point body), in capitals, tracked open, over **11 pt** entries. As
with the running heads, that is a size in points where there was a share of
the body, so a book whose body is not eleven point is the one thing that reads
differently — and by a couple of per cent.

#### The letter dividers

From Ken, after seeing the above: *separate out the letter dividers.*

They were the one thing left on that page whose look was not the writer's.
`.bk-index-letter` was `font-weight: 700` and nothing else, so an index's A and
its B were **the entries in bold** — they took the entries' size, case,
tracking and slope, and differed from them only in weight.

That is the running heads' argument a third time, and it lands the same way: a
letter divider is **a line of type**, so it is a third `LineStyle` on the part
(`divider`) rather than a new vocabulary, and it overrides every property the
wrapper hands down instead of inheriting most of them. An index page therefore
sets three lines — the heading, the entries, the dividers — where a contents
page sets two.

Two decisions. **`partHasDividers` is a predicate rather than `kind ===
'index'` written into the screen**, because the print and the dialog have to
agree about which page has them — and a contents page is in the book's own
order, so there is nothing to divide it by. And **the default is exactly what
the stylesheet drew**, bold at the reading size, so an index nobody has
touched is unchanged; the before-and-after measured on the real page is what
proves it.

The size is the divider's own from here, which is the point of separating
them: setting the entries to 9 pt now leaves the letters where they are. Only
a book whose entries were resized since the change above could notice that,
and that change is a few hours old.

#### The prose parts, and a default mistaken for a permission

From Ken: *the about the author page needs the same style options.*

`partHasStyle` refused it, and the reason given was that a foreword's body
**is** the book's body text and should stay it. That reason was wrong, and the
way it was wrong is the part worth keeping: it is **a statement about the
default mistaken for a statement about the permission**. What a prose part
should *start* as is the book's own type. Whether a writer may depart from it
is a different question, and the answer is obviously yes — a biography set a
size smaller than the story is ordinary book design.

So the predicate collapses to one line: **a part is designed unless it is a
plate**, a plate being a picture edge to edge with no type on it at all.
`partPlacement` gains `prose` — a heading at the head and paragraphs running
on under it, so there is no block to place and the template and the drop are
absent for the flowing pages' reason. The **heading** takes the title style and
the **words** take the line style, the same pair a fourth time.

Two things make it safe. **The style starts as the book's**, through a `base`
`partStyleOf` now takes: the chapter-opening style for the heading and the body
size for the words, both of them settings the writer may already have changed,
so a static default would have moved an existing page the moment the control
appeared. And **only what differs from that base is drawn** — a part nobody has
touched carries no style on its blocks at all, so the markup of a book made
before this is byte for byte what it was, which is what let the whole domain
suite pass with one assertion edited.

The words are set as **declarations on their own paragraphs** rather than by
teaching the body rule to read a variable. `.bk-p` is the hottest rule in the
book and the story has no business being reachable from a back-matter control;
a test asserts that setting the biography leaves every other paragraph in the
book without so much as a `font-size`.

## 8. Graphics

Three kinds, and two of them exist:

- A **chapter-page graphic**, from the library, placed by the template
  (addendum 19 §7). Unchanged.
- A **figure** in the manuscript (addendum 16 §9), which the manuscript
  prints across the full measure. In the book it gains a **placement** —
  across the measure, or cut into the text at the left or the right at a
  fraction of the measure, which is *little graphics cut into your text* —
  read from an attribute on the element that only the book honours. The
  renderer measures a wrapped paragraph the same way it measures any other,
  with the float in place, so the domain's rule needs no change.
- A **picture cut into a part's text** (from Ken: *placing a graphic on a
  page is different than adding a page graphic — drop in graphics that
  will cut into the text*): an inset on a foreword, a preface, an afterword
  or any prose part, held on the part as `insets` — the picture, which
  paragraph it sits beside, the side and the fraction of the measure. It
  becomes **the same `inset` the manuscript's figure makes** on the
  paragraph's block, so the cutter, the renderer, the PDF and the eBook
  needed no second rule for it. It names the paragraph by its place in the
  text; where the text has grown shorter than the number the picture rides
  in the last paragraph rather than vanishing, and with no paragraph at all
  it waits, the screen saying *write a paragraph first*. A dedication, an
  epigraph and a copyright notice take none (`partTakesInsets`), standing
  alone on a page of their own.
- An **art page** (the `plate` kind): a picture that *is* the page, edge to
  edge past the margins to the trim, with nothing set over it — from Ken:
  *a title page or an index that is artwork, imported at the size of the
  page, and it fills the page automatically*. It stands in the front matter,
  at the back, or *before a chapter*, so that moving the chapter moves the
  page (`halfOf` reads the chapter first and `inFront` after). Its
  description prints nowhere: the eBook reads it to a reader who cannot see
  the picture, and the library shows it. A picture that is not the page's
  shape is cropped to it rather than boxed, since a border of paper around a
  painted page is the one thing nobody who made one wants.

## 8a. Pictures inside the story

From Ken, laying out a children's book: *the ability to add an illustrated
facing page on one side or the other; and a small illustration inside the
text where the text wraps around it like a magazine — you draw a box and
the text moves around the box and gives a little bit of a border.*

**A picture inside the story is a figure**, which the manuscript has had
since addendum 16 §9 and which already stands exactly where the writer put
it. So none of this is a new record: it is two more readings of
`figurePlacement`, the thirteenth time the mechanism was already there and
merely narrow in vocabulary. A figure now sits in one of four places:

| Place | What the book does | Stored |
| --- | --- | --- |
| Across the measure | The manuscript's own behaviour, a picture the width of the text | nothing |
| Cut in at the left, at the right | A float inside the next paragraph, the text running round it | `bookPlace`, `bookSpan`, `bookStandoff` |
| A page of its own | The picture fills the page edge to edge where it stands, on the side asked for | `bookPlace: 'page'`, `bookSide` |

**An illustrated page is a page, so it says which side.** *Whichever page
it falls on*, *always a left-hand page*, *always a right-hand page* — the
block's `starts` is `page`, `verso` or `recto`, which the cutter already
understood, so asking for a side may leave the page before it blank. That
is what a facing illustration *is*, and the screen says so rather than
letting the blank look like a fault. The page carries **no running head
and no folio**, the art page's rule, and it draws through the art page's
own markup: one way for a picture to be a page, whether it came from the
front matter or from the middle of chapter nine.

**The border is the writer's** (`bookStandoff`, in ems of the body size, so
it holds at any trim and any type size), and **only what differs from the
default is written down** — a figure at the usual border stores nothing
about it.

**The box is drawn on the page.** *Draw the box…* on the picture's fields
puts the spread in a drawing mode; dragging a rectangle over a page says
how much of the measure the picture takes and which side of the measure it
cuts in at. The rectangle is read against the **text block** it was drawn
over rather than against the paper, so the same drag means the same thing
at any zoom and any trim. The **height is not taken**: a picture keeps its
own proportions, and a box drawn tall and thin makes a narrow picture
rather than a squashed one, which is what a float does. The sliders remain,
because a writer who knows they want a third of the measure should not have
to draw it.

**Putting a picture in is on the manuscript's right-click**, on every prose
format rather than the textbook alone — a children's book is a novel with
pictures — and absent on a book whose library is empty, since *put a
picture here* with nothing to put is not an offer.

## 9. The room

Opened from **Layout** on the title bar, beside Research, and absent rather
than greyed on every format that is not prose. In its own window like every
other room (addendum 02 §8). Three regions:

- **The parts**, down the left. **+ Add a part** is the first thing on
  the rail (from Ken: *the add-a-part should be at the top, like a menu
  item*), a raised button opening the right-click menu (addendum 02 §6a)
  with every kind the book can still take, each with its note, and on a
  collection *A new story*. Under it the front matter, the story, the
  figures and the back matter. **Every part row carries a ×** — half
  title, title page, copyright, contents, all of them — which asks once
  inline (a copyright notice somebody typed goes with it) and takes the
  part out; the menu offers it back. **Rows drag**: a part within its
  half (`placePart`, the story standing between the halves and nothing
  crossing it), and a chapter — a story in a collection — **as a block**
  (`moveChapterBlock`, its sections in their order, only the units that
  moved getting a new key), which is the one thing the rail does to the
  story order and it does it by moving the sections, since a chapter is
  where its sections fall. **Between the chapters** is where a book is
  dressed, and the rail shows the page there: a *Chapter page* row (*Story
  page* on a collection) before each chapter saying how it opens — *a leaf
  of its own* where its page carries a device, a summary or an epigraph
  (`opensOnLeaf`), *above the first paragraph* otherwise — with **Chapter
  page…** opening the chapter-page dialog on that chapter and **+ Picture
  facing** opening the file dialog for an art page before it. **An art page
  is one act wherever it goes** (from Ken: *it should be just as easy to
  add a plate in the front matter, the back matter or the story area, and
  it should cover the entire page*): the *Add a part* menu offers *Art page
  in the front matter* and *Art page at the back*, the chapter's row offers
  *+ Picture facing*, and all three open the same file dialog — the picture
  joins the graphics library, a page is made for it where it was asked for,
  the room turns to that page, and the inspector's *Where* moves it between
  the three places afterwards. **Nothing is made until a picture arrives**,
  so a cancelled dialog leaves no empty page behind, and the plain kind is
  not on the menu, a blank art page being nothing. An art page that faces a
  chapter is listed where it falls; the others in their half. (This grew
  out of *can't we just find the picture and load it? Or where is the
  library?* — the library, *Research ▸ Graphics*, had been the textbook's
  alone and is every prose format's now, since a novel with art pages has
  pictures too; the library select on the page's fields still offers what
  is already in the book.)
- **The spreads**, in the middle: two facing pages at a time, the verso on
  the left, at a zoom, with a slider along the foot. The page the writer is
  looking at is the page the PDF will have, because both come off one laying.
- **Book settings…**, on the bar (from Ken: *a book settings button in
  the top toolbar, because this is going to apply to the entire book*):
  everything that runs all the way through — **The book** (§3a), *Trim,
  margins & spine* (§3),
  *Type* (§6), *Running heads & page numbers* (§7), *Chapter openings* (a
  button to the dialog) — in one dialog in the middle of the screen, each
  group behind a heading drawn as a raised button with a disclosure arrow
  (from Ken, earlier: *these need to be collapsible, the titles bigger, so
  it's more organised*); whether each is open is a preference of the
  machine, not of the book. They used to be a column beside every part,
  which read as if they belonged to the part.
- **The inspector**, on the right, is now the selection's alone: the
  chosen part's fields, or a chosen figure's placement, and when nothing is
  chosen a sentence saying what it is for and where the book-wide settings
  went.
- **A part opens in a dialog of its own** on a double-click — on its row
  in the rail, or on its page on the spread (from Ken: *double click the
  front matter or whatever page … in a dialog box that pops up in the
  centre, and you can see the type of page formatting*): its fields on the
  left, **Pictures cut into the text** under them on a prose part (§8: from
  a file, or one already in the book; beside which paragraph, which side,
  how wide, a caption; × takes one out and the picture stays in the
  library), and on the right **the page as the book sets it** — every page
  the part falls on, drawn from the laying with the same builder the spread
  and the PDF read, turned with arrows and turned by itself to the page a
  picture just placed fell on. Double-clicking a chapter's opening page
  opens the chapter-page dialog instead, and pressing a picture cut into a
  part on the spread opens that part. **The half title and the title page
  are designed there** (from Ken: *the pop-up needs options for different
  templates, a way to redo the wording and the fonts, and stylize the
  page*): the page says what it will print and sends the writer to **The
  book** for the title and the author (§3a), since those run all the way
  through; a **line under the title** is the title page's own and is typed
  there; **Import full page art…** makes the page a picture edge to edge
  with the words in it (`assetId` on the part, drawn by the plate's rule);
  and a **page style** (`part-style.ts`) — a *template* for where the block
  sits and how it is ranged (Classic, Centred, High and left, Low and left,
  Low and right), a *face* (the book's, or one of the book faces for this
  page alone), the title's line and the lines under it in the chapter
  page's controls, and a rule — stored on the part, a dedication and an
  epigraph taking the same. **The template is read back from the
  placement, never stored**, so a hand change reads as *Custom* by itself,
  the book preset's rule; `partStyleVars` is the one place the custom
  properties mean anything, and the drop is a share of the page's height
  (a spacer in the flex column) rather than the percentage padding the old
  page used, which measured against the width.

**Export the book…** is in the room's bar, and it is the only place the book
is exported from; *File ▸ Export PDF* stays the manuscript's.

## 9a. The rail as one linear tree

From Ken, after using the room: *this has become way too complicated to make
this workable… this should be simple linear workflow… we don't need to divide
up front matter and back matter, we should be able to just add them as a
linear tree… there shouldn't be all this extra wording.* He read the rail back
in his own words — *art page, picture, story page above the first paragraph,
story page, picture facing* — and said people would not work it out.

He was right, and the reason is worth keeping. §9's rail grew a heading per
half and, between every pair of chapters, a **second row** that existed only
to carry two buttons and a sentence about how the chapter opened. None of
that says *where anything is in the book*, which is the one question a rail
answers.

**One list, one row per thing, in the order it is bound** — `bookRows` in
`packages/domain/src/book-rail.ts`. Two rules hold it there.

**Containment is depth, never a heading.** The front matter, the story and
the back matter are not three lists; they are the order. A picture inside a
chapter sits under it because it is in it, and that is the only nesting the
rail has. A picture page a writer put before a chapter is listed where it
falls, which is before it.

**A row is its name and its page, and nothing else.** No note, no state, no
pair of buttons. What a row *is* it says by where it sits; what can be done
to it is done from the selection. A picture page is named after its
**picture** rather than after the word *Art page*, because the writer knows
what they imported. Nothing is stored: the list is read from the parts, the
markers and the manuscript every time, so cutting a chapter takes its
pictures off the rail with nothing run.

### A × on every row

*I added a new story on accident, and there's no way to get rid of it.*
`removeBookRow` is one act for every kind of row, and `whatGoesWithRow` says
what would go before it does. A chapter is the one that needs saying, and the
answer is the honest one: **the chapter break goes and the words stay**, its
sections joining the chapter before — *unless nothing is written in it*, which
is the chapter somebody added by accident, and then its empty sections go with
it. That distinction is a reading, not a flag.

### Select a page, add a picture to it

*You select a page in the layout view and then add picture. It should be that
simple… and it scoots all the text down.*

A page is not a record — it is where the laying happened to cut — so a press
on one is answered by reading what is **on** it. `pagePlace` gives the
manuscript element the page opens with, the part it belongs to, and the
chapter in force. A picture added to the page goes in **before that element**,
so the page opens with the picture and the words move down. That is the whole
mechanism, and it needs nothing stored about pages at all.

One act, read where it lands: in the story it is a figure; in a part with
words it is cut into the text; where the page has neither it is a page of its
own. None of that is a choice the writer makes — it is what *here* means at
each of those three places. The chosen page is **outlined on the spread**, and
the button's tooltip names it, so nothing has to say in the margin which page
is meant.

### The box before the picture

*You should be able to draw a box in a page and it will create a graphics box.
You should be able to move that around until it's correct and then add a
graphic to it.*

Stage 6's drawing needed a figure first, which is the order backwards.
**Draw a box for a picture…** on the Add menu now makes the figure itself —
a figure with **no picture**, which the print stack has always drawn as a
box holding its space (the words are *Picture goes here*, not *Picture
missing*, because a box drawn on purpose is not a fault). *Choose a picture…*
fills it afterwards. Drawing the box again on **another page moves the
picture there** (`moveFigureBefore`) rather than leaving it where it was and
lying about it — a box is where the picture goes, so drawing it elsewhere is
how it is moved.

### Dragging, and the double-click

One drag, three landings, each of them something the book already understood:
a part moves within its half, a chapter moves with its sections, and **a
picture page dropped on a chapter comes to face that chapter**. A figure in
the writing is not draggable and says so: it stands where the writing puts
it, and the drawn box is how it moves.

A double-click opens the one thing that sets that page — a part's dialog, a
chapter's own page — from the row or from the page on the spread, which are
the same act.

## 9b. Turning the pages, and a rail you can read

Three things from Ken after setting a book in the room, and the middle one is
a real fault rather than a preference.

**The rail was too narrow.** It opened at 288px, which fits *Copyright* and
not *The Lamp and the Lighthouse* — and a rail whose job is to list the book's
parts by name cannot cut their names off. It opens at 360 now. Only a machine
that has never dragged the divider takes it: the width is remembered per
machine, so nobody's own setting is overwritten by the new default.

**A chapter inside a story did nothing when chosen.** Every other row turns to
its page and shows the page it opens on; the Roman numerals under a story
showed no page and turned to nothing. The cause is exactly the join §6 of
addendum 22 leaves open: the rail lists a chapter-inside-a-story by its
**unit**, while the block that opens it is the **heading element** and carries
that element's id — so nothing on any laid page held the row's id, and the room
had no way to find the page. `unitId` on `BookBlock` is what joins them, set on
the first block of each unit and read by the room the same way `partId` already
joins a part's row to its page. It is set on the *first* block rather than on
every one of them, so the page found is the page the section opens on; and on
the first block whatever that block is, since a section with no heading still
has a row and still needs a page.

Worth noting what this did **not** need: no second reading, no map from units
to pages kept anywhere, and nothing stored. The block already travels to the
page; it simply was not carrying which section it began.

**And the pages turn with an arrow.** A large arrow either side of the spread,
the way pictures are turned on a web page, with the scrubber left at the foot
for moving a long way at once. They stand **beside** the spread rather than
over it: a page being set is the thing to look at, and an arrow laid across its
corner is in the way. The foot's own small ← and → are gone — two answers to
*turn the page* on one screen, and these are the answer. Putting the arrows
beside the spread also meant centring it in the viewport, which it had never
been: it hugged the top, so the arrows sat well below the page they turn.

## 9c. Page settings: placement belongs to the page

From Ken, looking at Book settings: *when you double click a page, these are
the settings that need to be removed from book settings — and these are going
to be page settings.*

He is right, and the line the section draws is **placement against type**.

- **Placement belongs to the page.** Where the picture sits, whether a rule
  runs under the heading, how far down the page the heading falls and how much
  air stands over the first paragraph are decisions about *one page*, and
  somebody setting a book makes them page by page while looking at the page.
- **Type belongs to the book.** The face, the sizes, the case, the weight and
  the tracking stay book-wide, for addendum 02 §12a's reason, which has not
  changed: a reader who turns to chapter nine and finds its heading in another
  face has found a mistake rather than a design.

So Book settings keeps *How every chapter page is set* — the face and the four
lines — and says in one sentence where the rest went. The three sliders and the
template tiles are now **This page**, in the dialog a page opens.

The mechanism is `minimumSetups`' shape, which the template already had:
`rule`, `dropInches` and `openingLines` join it on the marker's page as
**nullable, null meaning *use the book's***. That is what makes a page nobody
has touched go on following the book when the book changes — a copied number
would freeze at whatever the book said the day the page was made.
`chapterPlacementOf` is the one reading that resolves them, and the resolved
placement rides on `ChapterPageContent`, so the print, the room's spread and
the dialog's sheet all draw the same page. A block with no placement draws
exactly as it always did, which is why nothing in an existing book moves.

Two smaller things fell out. The per-chapter **select** (*Where the graphic
sits*) is **gone**: the tiles now set the page, and two controls for one act on
one screen are two answers to *where does the graphic go*. And the section
**says which it is** rather than greying anything — *This page follows the
book — graphic in the middle, 2.5″ down*, or *This page is set on its own*,
with **Follow the book again** beside it, because handing a page back should be
one press rather than three sliders returned by eye.

## 9d. The custom graphic: draw it, slide it, keep it

From Ken: *when you say add custom graphic, which should be an option, the menu
disappears and allows you to draw a box where you want the graphic, and then
the text will move around it. And then you can slide it around and watch the
text move around it so you can get it placed perfectly … there will be an X or
a check mark in the middle of the box.*

Two halves of this already existed and two did not. *Draw a box for a
picture…* (§9a) has made an empty box the text runs round since the rail was
rebuilt, and choosing the picture afterwards has always been there. What was
missing is **sliding it**, and **the two marks**.

**The box being placed is drawn over the picture itself.** There is no ghost
rectangle and no preview: the handle is measured off the figure wherever the
laying put it, so dragging it moves the *figure*, the book is set again, and
the handle lands back on it. That is the whole of *watch the text move around
it* — what a writer sees is the book, not a picture of what the book might do.
It costs a re-lay per drag, and it is what makes the gesture honest.

**Sliding reads two things.** Across the measure it is the side the picture
cuts in at; down the page it is **which paragraph it rides in**, which needs
the room to know what block the pointer is over. The rendered children of a
page's text stand in the same order as its pieces — the one builder writes them
that way — so the nth child is the nth piece's block, and the join needs
nothing added to the markup. A `data-` attribute on every paragraph would have
been the obvious way and the wrong one: it changes what the print and the eBook
emit, to answer a question only this room asks.

**Placing is a state of the room and never of the figure.** Nothing about it
is stored, so a project saved mid-drag reads as a box standing where it was let
go; there is no *unplaced* flag for a later reader to wonder about. The ✗ is
what undoes drawing one — `removeBookFigure`, the only act that takes a box
away — and the picture in the library is untouched, which is the rule every
figure has followed since addendum 16 §9.

**And the way in is the page's own dialog.** *Add custom graphic…* stands in
**This page** (§9c), it closes the dialog when pressed — the box is drawn on
the spread the dialog was covering — and ✓ brings the page back with *Choose a
picture…* waiting. It is **absent** from *File ▸ Chapter page…* opened over the
workspace, where there is no spread to draw on.

That last point forced a change worth naming: **the Layout room now owns its
chapter-page dialog** rather than handing the chapter to the workspace. The old
arrangement was fine while the dialog could do nothing the room had to help
with; a control that draws on the spread behind it can only be offered by the
screen holding that spread.

## 10. What it must never do

- Edit a word of the manuscript.
- Store a page number, a margin it worked out, or a running head's words.
- Reorder the story.
- Guess a line break in the domain.
- Grey out on a screenplay. It is absent.

## 11. Build order

| Stage | What | Where |
| --- | --- | --- |
| 0 | The room exists: pane, title bar button, menu item, window shape, an empty screen that says what is coming | `panes.ts`, `TitleBar.tsx`, `menus.ts`, `Satellite.tsx`, `LayoutWindow.tsx` |
| 1 | The trim and the geometry: presets, the settings record, `geometryOf`, overrides, `describeGeometry` | `book-layout.ts`, `entities/project.ts` |
| 2 | The plan: parts, the default plan, ordering rules, `bookBlocks` — the sequence of blocks with their rules | `book-plan.ts` |
| 3 | The laying: `layPages` from measured counts — recto starts, blanks, numbering, running heads, widows and orphans, balancing; the book's contents and index | `book-pages.ts` |
| 4 | The screen: the measuring typesetter, the spreads, the parts rail, the inspector | `LayoutWindow.tsx`, `typeset.ts` |
| 5 | The export: `renderBookHtml` from laid pages, `printToPDF` at the trim, the browser preview's print | `print-book.ts`, `export-pdf.ts` |
| 6 | Graphics: plates, and figures cut into the text | §8 |
| 7 | Type presets, drop caps, ornaments, hyphenation | §6 |

## 12. Open questions

- **EPUB.** Vellum's other half. A reflowable book has no trim, no spreads
  and no folios, so nearly nothing in §3, §4 and §7 applies, and what does
  apply — the plan, the type, the parts — is already separate from the
  laying. It would be a second renderer over `bookBlocks`. Not in this
  addendum.
- **Bundled fonts.** The faces are stacks (§6), so a book set in *old-style
  serif* prints in whichever old-style serif the machine has. Shipping font
  files would make the PDF the same everywhere, at the cost of licensing and
  size. Deferred; the stack ends in a generic family so nothing breaks.
- **The web preview's export.** In the browser the export is the browser's
  own *Save as PDF*, which honours `@page size` — so the trim carries, and
  the writer chooses *no margins* in the dialog as the manuscript already
  asks them to.

## 13. What is built

### Stage 0 — the room

`layout` in `ROOM_PANES` with a window shape of its own; **Layout** on the
title bar between Research and Sculptor, drawn only where `isProseFormat`
holds; *Window ▸ Layout in its own window*, likewise; a branch in
`Satellite.tsx`. `LayoutWindow.tsx` is the room, opened over the workspace
the way Research is.

### Stage 1 — the trim and the geometry

`book-layout.ts`: `TRIM_PRESETS`, `bookSettingsSchema` (trim, the four
margin overrides, the face, the size, the leading, running heads, the folio,
whether chapters open recto, the parts of stage 2), `bookSettingsOf`,
`setBookSettings`, and `geometryOf(settings, pageCount)` — the derived
margins, the text block, the lines per page and the measure, every override
honoured and every derived value said. `describeGeometry` writes the answer
in words for the inspector, and `measureWarning` says when the measure is too
long to read.

### Stage 2 — the plan

`book-plan.ts`: `PART_KINDS` with what each is (text, reading, or plate),
`defaultParts` for a new book, `addPart`, `removePart`, `movePart` (within
its half; the story is not a part), `updatePart`, and `bookBlocks(file)` —
the whole book as a sequence of blocks, each saying what it is, what text it
carries, whether it opens on a recto, whether it carries a running head, and
how its pages are numbered.

### Stage 3 — the laying

`book-pages.ts`: `layPages(blocks, measured, geometry)` — the cutter. Given
each block's measured line count, it produces `BookPage[]`: which sheet,
verso or recto, its folio in roman or arabic or none, its running head's
words, the lines of each block it carries, and blanks where a recto start
needs one. Widows and orphans are refused by moving a line, a heading keeps
its two following lines, and a spread's two pages are cut to the same depth
where both run on — by laying the pair again to the shallower of the two.
A page a chapter opens on carries no running head (the heading is the head)
and shows its number at the foot whatever the book does elsewhere.
`bookContentsOf` and `bookIndexFor` read the laid pages, so the contents and
the index carry the **book's** numbers and store none.

### Stage 4 — the screen

`book-typeset.ts` is the measuring typesetter: every block is set at once in
a hidden box the width of the text block (`.bk-measure`), one layout, one
read per block, a picture's lines coming from its own shape rather than the
box so an undecoded data URL cannot measure as nothing. Two passes at most,
for the gutter. `LayoutWindow.tsx` is the room: the parts down the left with
the chapters between them (read, and each showing the page it opens on), the
spreads in the middle at a zoom with ← and → and a slider, the inspector on
the right — *Trim & margins* with every derived value shown greyed and a ×
to let a typed one go, *Type*, *Running heads & page numbers*, and the
selected part's own fields. Choosing a part or a chapter turns to its page.

### Stage 5 — the export

`print-book.ts` is **one string builder for three readers**: the screen
measures a block with it, draws a page with it (each block clipped to the
lines the laying gave that page, shifted up by the lines before), and the
export prints the same pages at the trim with `@page { size: <trim> }`. A
chapter page whose face is *manuscript* is set in the book's face, because
in the book that is the face the text is in. **Export the book…** in the
room's bar hands the drawn document to `exportPdf` with `kind: 'book'` and
the trim as `paper`, which `printToPDF` takes in inches; in the browser
preview it is the browser's own *Save as PDF*, whose page size the document
names. This is the one document whose markup the renderer hands to the main
process, because its pages exist only where the type was measured; the
window it prints in still runs with scripts off and the sandbox on.

### Stage 6 — graphics

All three of §8's kinds. The chapter-page graphic is unchanged, and the
**plate** — a part anchored before a chapter, with its picture from the
library and its caption — came with stage 2. The new work is the
**inset**: a figure in the manuscript cut into the text at the left or the
right, at a fraction of the measure. Its placement is `bookPlace` and
`bookSpan` on the figure element's attributes, read by `figurePlacement`
and written by `placeBookFigure`; the manuscript carries the two and never
reads them, so it prints the figure across the measure as it always has,
and *across the measure* clears them so an unplaced figure and one put back
are the same element. **An inset rides in the paragraph it cuts into**:
`bookBlocks` holds a placed figure until the next paragraph and puts it on
that block as `inset`, marked unbreakable, so the renderer measures the
wrapped paragraph with the float in place and `layPages` needs no rule for
floats at all — which is what §8 promised. A placed figure with nothing to
cut into stands across the measure. The float declares the picture's own
proportions, because the paragraph is measured the moment it is set and a
picture that has not decoded would measure as no height. The room lists the
figures in the rail with where each sits, and a figure on the page is
tagged with its id, so pressing it on the spread picks it for the
inspector — place, and a width from a fifth to three fifths of the measure.
The eBook floats it the same way.

### Stage 7 — the presets

`BOOK_PRESETS` in `book-layout.ts`: **Classic** (old-style serif, small
capitals to open, a blank line between scenes, folios at the outer foot —
which is the book's defaults, so a new book reads as Classic), **Modern**
(transitional serif, a drop cap, chapters on either page, folios at the
outer head) and **Textbook** (sans, ragged right, no hyphenation, folios at
the centre foot). A preset is a patch and nothing else: **which one is in
force is read back** by `bookPresetOf` from the fields rather than stored,
so a field changed by hand makes the style *Custom* by itself, and the
trim, being no part of a style, does not. The *Style* select at the head of
the Type section applies one; every field stays settable under it. The
opening treatment, the ornament, justification and hyphenation were stage
5's and are unchanged.

Driving the presets caught a fault in **stage 4's measuring** that the
tests could not: the box read a block's `offsetHeight`, which is a whole
number of pixels, so a four-line paragraph on a fractional leading (14 pt
is 18.667 px) measured 75 rather than 74.67, read as 4.02 lines and was
counted as five — one line too many on such paragraphs, and a last line
alone at the head of the next page that the cutter's widow rule could not
see, because by its count there was no widow. The box reads the fractional
height now, with a tenth of a line of slack for what rounding is left.

### Stage 8 — the rail and the folds

From Ken after laying out a collection: *+ Add a part* at the top as a
menu; × on every part; the page between the chapters shown as a row of its
own with the chapter-page creator and a full-page picture on it; parts and
chapters dragged to reorder (`placePart`, `moveChapterBlock`); and the
inspector's four groups folded behind button headings (`Fold`, a
preference per machine). §9 says what each does. Then, from Ken again: the
plate became the **art page** — the picture the whole page, edge to edge,
no caption on it (§8) — added in one act to the front matter, the back or
facing a chapter, from one file dialog (§9), with `inFront` on the part the
only new field and no migration. And then: the book-wide settings moved
off the inspector into **Book settings…** on the bar, a part opens **in a
dialog of its own** on a double-click with its page set beside its fields,
**pictures cut into a part's text** (`insets` on the part, the manuscript's
inset reused whole), and the **spine allowance said in words**
(`describeSpine`) — it was already automatic, and the ask was answered by
making it visible. No migration: the insets ride in the part's JSON. Then,
from Ken using it: the **half title and title page are designed in the
part dialog** — wording, full-page art, a template, a face and the lines
of type (`part-style.ts`, `style` on the part, the template read back and
never stored); **the chapter-page row is editable and removable** (its
name opens the page, a leaf of its own carries a × that asks and takes the
picture, the summary and the epigraph off), the × on a part row is visible
rather than shown on hover, and a room in a window of its own owns a
chapter-page dialog so the row works there too; and **the rail drags**
(`useSplit`, half an inch wider than it was by default). No migration.
And then §8a: **pictures inside the story** — an illustrated page of its
own on the side asked for, a border round a picture cut into the text, and
a **box drawn on the page** that says how wide it is and which side it
sits on. All of it is the figure the manuscript already had, placed two
more ways; no migration, and the half title, the title page, the
dedication and the epigraph share one page style.
