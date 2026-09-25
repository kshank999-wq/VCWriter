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

## 8b. The text runs round a cut-in picture

From Ken: *the text below it is not wrapping around the picture, so it
splits it and adds a big gap*. He was looking at a four-line paragraph with
a picture fifteen lines deep beside it, and eleven lines of white under the
words.

**Two boxes were containing the float, and both were there for a reason
that had stopped applying to this case.** `.bk-p.bk-has-inset` was
`display: flow-root`, which makes a paragraph a formatting context of its
own and so as tall as anything floated inside it. And every block is drawn
in a `.bk-piece` of its measured height with `overflow: hidden`, which is a
formatting context too. A picture could not reach past its own paragraph,
and the paragraphs after it could not run round it: cutting in was cutting
*into one paragraph*, which is not what the words mean.

**Only a split piece is clipped now.** Clipping is what a split is *for* —
a paragraph broken across a page shows the lines that belong to this one —
so `PagePiece` carries `cut` and the page clips that piece alone. A whole
block is drawn whole, the paragraph is no longer a formatting context, and
the float reaches into the paragraphs after it exactly as a book sets it.
A heading, a scene break, a figure and a page of its own all **clear**,
having no business standing beside a picture.

**The reach is a measurement, not a calculation** (§4's rule pointed at a
float). The domain has no font metrics and cannot know how tall a picture
sets at this measure, so `measureBlocks` reads the picture's own box and
hands `layPages` a `Wraps` map beside the line counts. The cutter keeps a
picture and the text running round it on one page: without that, the
picture is clipped at the foot and the next page's text runs full measure
where it was measured narrowed. A picture taller than a whole page is run
over rather than looped on, there being no empty page that would help.

Measurement needed no change of its own. The measure box has always set
the blocks as consecutive siblings, which is what the page does, so the
paragraphs after a picture measure **narrowed** by it without anything
being told to do so — the float was simply never allowed to reach them.

A book with no picture cut into it lays exactly as it did, which a test
pins by laying the same blocks with and without a reach and comparing every
piece.

## 8c. A graphic set over the page

From Ken: *add a vector graphic … somewhere on the page that they can add a
vector graphic that anywhere on the page, and then they can resize that
also. But it has a transparent background.*

**It is a figure, and `free` is a fifth place** — the fifteenth time the
mechanism was already there. Everything that makes a figure work is
reused: the graphics library, the element's own attributes, the rail, the
inspector, `placeBookFigure`. What is new is one value of `FigurePlace` and
what it means.

What it means is that **it takes no room in the flow**. Every other place
is in the text's way and the cutter knows about it; a free graphic is set
over the page, nothing moves to make space, and the cutter never sees it.
That is why several may ride one block while an inset is one per paragraph,
and why it is offered on a blank leaf too — a flourish needs no writing to
stand beside.

**It rides a paragraph, and is placed against the page.** Those are not in
tension: a page is not a record, so a graphic anchored to page nine would be
on the wrong page the moment a word is added — riding the block puts it
wherever that block falls. Its `x`, `y` and `span` are fractions of the
**page** rather than of the text block, because *anywhere on the page*
includes the margins and a flourish that cannot reach the edge is not free.

**Nothing draws a background and nothing prints a caption.** Whatever the
file leaves clear stays clear, which is the whole of what Ken asked for
with *transparent*; and a flourish is not a figure, so it has no number and
no words under it. An SVG needs no new reader — `readPicture` has always
taken any image the browser decodes.

**Moving it is not drawing a box.** A figure in the text has no place until
a box is drawn, so *Draw the box…*; a free graphic is already on the page,
so the handle goes straight over it and *Move and resize it…* drags it
where it stands. The handle is the one from §9d, and it says *45% of the
page* where an inset says *of the measure* — two measurements of two
things, and a figure that cannot be checked against anything is worse than
none.

`FigureInset` **omits** `x` and `y` rather than inheriting them: an inset's
place is decided by the paragraph it cuts into, so a free position on one
could only disagree with where it actually sets.

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

## 9e. The spread fits the window

Not from Ken — found by opening the room and looking at it. The spread was
drawn at a stored **0.55** whatever window it was opened in: on a 1700-wide
screen the book stood 450 pixels tall in 960 of room, less than a third of the
space it had, and on a 1280-wide laptop the *same number* was too big and the
spread had to be scrolled sideways to be read. One fixed figure, wrong in
opposite directions on the two screens anybody would use.

It is addendum 15 §15's fault in another room — *Whole story means the whole
story fits*, where a column measured from the window replaced one measured in
the source — and it lands the same way: **the size that fits is a reading**.
`spreadFit` in `print-book.ts` takes the geometry and the space there is and
returns the scale; nothing is stored, so widening the rail, resizing the
window or changing the trim re-fits with nothing run and no button to press.
The room measures its own stage with a `ResizeObserver`, and the stage's
padding is set inline from `SPREAD_INSET_PX` rather than typed into the
stylesheet as well, because two numbers that have to agree are two answers to
how big a page may be drawn.

Two decisions inside it.

**The fit is a full spread's, whatever this sheet carries.** A half title
stands alone on its page, and fitting *that* page would draw it at twice the
size of every page after it — a book that changes size as you turn it is worse
than one drawn small.

**A zoom set by hand is the writer's, and it is a different state that says so
out loud.** `layout.pageZoom` holds null for *fit* and a number for a zoom
somebody chose — `minimumSetups`' nullable shape a fourth time — and the foot
says which: while fitting, the word **Fit** stands beside the slider as a
statement; once a number has been set by hand, the same place is a raised
**Fit** button that hands the page back. Absent rather than greyed, and raised
rather than flat, because the same word in both states drawn the same way is
two states that look alike.

The preference is a **new key**. The old `layout.zoom` held 0.55 on any
machine that had opened the room, and 0.55 was not somebody choosing a zoom —
it was the only size the room could be read at. Carrying it over would have
hidden this from the one machine that had used the room.

## 9f. The inspector is the selection's

From Ken, after §9e: *fix the inspector column too.*

It was a fixed 320-pixel column that stood whether or not anything was
chosen, and with nothing chosen it held **one paragraph** — a sentence naming
*+ Picture* and *Book settings…*, both of them labelled buttons already on the
screen. On a 1280-wide window that paragraph cost a quarter of the room, and
since §9e a quarter of the room is a quarter less book: the page measured
211 pixels wide with the column standing and 370 without it.

Two changes, and the first is the one that matters.

**With nothing chosen there is no column.** The inspector is the selection's,
which §9 already said and the screen did not do. Absent rather than empty, the
room's own rule pointed at a panel instead of a menu item. What the paragraph
said is now one line under the rail, cut to the two things a writer cannot see
for themselves — *A page can be chosen on the spread too. A double-click opens
it.* The other two halves were labels for buttons standing a few inches away.

**The column drags, like the rail.** `useSplit` took a `from: 'end'` option so
the same gesture sizes the pane *after* the divider rather than the one before
it; writing the drag a second time with its sign flipped would be a second
answer to how far the pointer moved. It is remembered per machine, and the
spread re-fits as it moves, because §9e reads the stage rather than a number.

## 9g. Two things on the screen that were not the book's

Not from Ken — found by opening the room's dialogs and reading them. Both are
the same fault: a number the screen stated that was **not the book's**.

### The page count

The bar said *13 pages* and the margin sentence beside it said *worked out
from the trim and 9 pages*; the spine sentence said *at 9 pages*. Two numbers
for one book, a few inches apart.

`estimatedPages` exists to break a circle — the gutter needs a page count and
the page count needs the gutter — and `layBook` lays the book at the guess,
then lays it again only when the true count would land in a different tier of
the standard's band. Where it does not, the geometry keeps the guess, and the
guess was what the sentences read. The guess now stops at the door: `countedAt`
tells the geometry the count the book has. Nothing about the margins moves,
and that is provable rather than hopeful — the re-lay is skipped exactly when
`insideFor` gives the same answer at both counts, and the inside margin is the
only one a page count reaches.

### The sheet a chapter page is judged on

The preview in *Chapter page…* was a letter-size sheet with fixed margins, set
in Courier, whatever the book was. The comment over it read *the shape it will
print* — true the day it was written, false from the day the Layout room
existed, and still sitting there: a comment keeping its own copy of a rule
long after the module changed its mind, which is addendum 24 §5e's lesson one
layer down.

So §9c put the drop and the template in that dialog, *so a writer sets them
while looking at the page*, and the page they were looking at was eleven
inches of typewriter paper. `chapterSheetVars` gives the sheet the book's
trim, the book's margins and the book's face, and `bookFaceOf` resolves *the
book's face* on the leaf itself, which the preview had never done.

Two details are worth keeping, because both are invisible when wrong — the
page still looks like a page, with the heading in the wrong place.

- **A percentage padding resolves against the containing block's *width***,
  even at the top. The old sheet divided its drop by eleven inches of height
  and drew it at three quarters of where it meant to; every share here is over
  the trim's width.
- **The drop is from the top of the paper**, so what the block's own padding
  carries is the drop *less the top margin*, over the width of the text block
  it sits in — which is the box that padding measures against.

The **drop as a share** moved out of `chapterStyleVars` while this was done:
how tall the sheet is, is the sheet's business rather than the style's, and
that is where the hard-coded eleven inches had been hiding. So did the
summary's face, which was Courier in a book as well as in a manuscript — the
reading face is the book's where there is a book, which is what the printed
book has always used.

## 9h. A page of the story is a thing you can choose

From Ken, after trying to put a full-page picture on a page he had picked:
*it doesn't add the picture, but it seems to remove pages… when you click on a
page it has a bunch of extra dialogue, like chapter pages and that type of
thing… trying to enter any information just changes title pages… the only
thing that should be in there is the ability to put graphics on that page, and
the adjustments of that graphic… you should be able to drop down each chapter
and see how many pages, so you can select an individual page, not just a
chapter, and on that page you can see which one is art and which one is not.*

One cause under all of it. **A page of the story belonged to no record.** The
rail named parts, chapters, sections and pictures, and a press on a page of
the spread was answered by `pagePlace` falling through to whatever *did* own
something: the part whose pages it sat among, or the chapter in force. So a
double-click on page nine opened chapter two's page, typing in it changed the
title page, and a picture asked for there landed on the chapter's own leaf —
which paginates differently, and is the *pages seem to disappear*.

Two things, and the first is a reading.

**`bookPageRows` gives every page a row**, saying in two words what stands on
it — *Chapter opens*, *Text*, *Picture*, *Blank* — with the chapter in force,
the part where it is front or back matter, and the figure where the page is a
picture. It is `pagePlace` said for every sheet at once, so nothing is stored
and a chapter that grows a page grows a row with nothing run. The rail folds a
chapter open to show them; which chapter is open is about this minute, so it
is not remembered anywhere.

**Choosing a page shows the page's own screen, and it does pictures and
nothing else.** What is on the page, the two ways to put a picture there, and —
where there is one — the place, the side and the width `FigureSection` has
always had, reached from the page at last. It says so out loud: *Nothing here
changes the chapter or the book — only this page.*

And the double-click rule is now **what the page *is***: a part's page opens
the part, the page a chapter opens on opens that chapter's page, and an
ordinary page of the story is neither — it goes in hand instead. That is the
whole of *trying to enter any information just changes title pages*.

One more thing came out of the same complaint (*the Roman numeral number one is
missing*). **How a division is numbered** — Numbers, Roman numerals, Letters,
Words, a symbol, none — has been a setting since the markers were built, and
the only way to reach it was to open a marker on the **timeline**, which is
nowhere near the room a book is laid out in. It applies to every division in
the book, so §9's own rule puts it in *Book settings ▸ openings*, beside the
type those headings are set in.

## 9i. Putting a page in, and the leaves that print nothing

From Ken, after §9h, in three goes. First: *the first chapter has a Roman
numeral I with a period, but it still doesn't recognise it in the layout… in
the chapter it needs to be like an outline form in the left-hand menu, with a
drop-down arrow that will give you every page in that… and you should be able
to select a page in the actual book view window and insert a blank page, a
picture for artwork, and it will slide what was on that page to the next
page.* Then, seeing the picture land at the end of the book: *when I insert a
picture it goes to the bottom, but it doesn't allow me to drag it up and place
it… I can drag it in between the pages, and it will change the numbering of
the pages… the illustration will count as a numbered page but there'll be no
printing of the page number on that page… so if you have page six and the
opposite page is an illustration, the illustration will be page seven, and
when the story picks up the text again that will be page eight.* And then:
*when you enter an illustration, you need to have an option for the back page
to be blank, so the illustration doesn't bleed through… a checkbox for blank
back page. The blank back page will be counted as a page in the numbering
scheme, but there will be no number printed on that page.*

### The missing numeral

A straight fault. §6's chapters inside a story are sections, and the story's
own marker sits on the first of them — so `bookRows` listed a story's sections
with `.slice(1)`, on the reasoning that the first is the story. That is true of
the **section** and false of the **chapter whose numeral is on it**: the row it
dropped was `I.`, which is why a book with three numerals showed two and
started at `II.`. The slice is gone; a story and the chapter that opens it are
two rows saying two different things, which is what the rail is for.

### Every page under its chapter

§9h gave a chapter's rows to `bookPageRows` and the rail folded a **chapter**
open. Ken asked it of a section, which on a collection is where the numerals
are, so the fold is on **every division** now — `unitId` on the row, which
§9b put on the block for the same reason, joins a section to its pages without
a second reading.

### A picture dragged onto a page

An art page is a **part**, and a part stands in the front matter, at the back,
or facing a chapter — it has nowhere to be *between page six and page seven*,
which is exactly why it went to the bottom. A picture that is a page of its
own does have somewhere: it is a figure, standing where it stands in the
writing. So dropping one on a page row is `plateIntoStory` — the figure is
made before the element the page opens with and the part is removed, which is
one picture in one place rather than two records agreeing. A figure already in
the writing only **moves**, which `moveFigureBefore` has done since the box
could be redrawn.

### The two facts about a page that prints nothing

Both halves of Ken's arithmetic were already true and neither was visible.
`layPages` counts **every** leaf — `number = ++arabic`, unconditionally — and
only `shows` consults whether a page prints its folio, so a picture page has
always been page seven with nothing on it. What was missing is the leaf behind
it: `bookBackBlank` on the element, the same shape as every other `book…`
attribute the manuscript carries and never reads, which puts a `blank` block
after the picture's. It is `display`, so it takes a page; its `folio` is off,
so it prints none; and it counts because counting is what `layPages` does to
everything. 44, 45, 46, 47 with numbers on 44 and 47 alone.

The answer **goes with the page**: `placeBookFigure` clears it when the
picture stops being one, a picture cut into the text having no back leaf to
leave and an answer left behind on it being a setting nobody can see.

### A blank page the writer puts in

`bookBlankBefore`, the same mechanism pointed the other way: a `blank` block
**before** the element, so the words on that page slide to the next and the
sliding needs nothing written to make it happen. Two things follow. It is said
of the **writing** rather than of a page, because a page is not a record — so
it moves when the writing moves, and cutting the paragraph takes it. And the
block carries `blankFor`, which is what lets the page's own screen offer to
take it away again: a blank leaf the **cutter** left, before a chapter that
opens on a recto, is not the writer's to remove there, and a button that
cannot keep its word is worse than none.

Three blank pages, three reasons, and the screen says which: *you put it
here*, *the back of the picture before it*, or *the page before a chapter that
opens on a right-hand page*. Only the first has a button under it.

## 9j. The pages by their numbers, and the first chapter of a story

From Ken, using §9h and §9i on his own collection.

### The first chapter had no opening

*The first chapter has a Roman numeral I with a period, but it still doesn't
recognise it in the layout… I selected page two, which is actually Roman
numeral one, and the page format is incorrect, where it should look like a
chapter page.*

Two faults, both one-liners standing on a reason that had stopped being true.

**The importer ate the numeral.** `materialiseScenes` drops the first heading
of a prose document because *the first heading is its title, said on the marker
the caller places* — which is right for a document headed *In For A Pound*
followed by chapters, and wrong for one headed `I.` A story called *I.* is not
a story anybody named; it is the first chapter of a story named somewhere else,
usually by the file on disk. `BARE_LABEL` already knows the difference, so it
decides: a bare numeral is kept as a heading like every other, and only a real
title is taken as one.

**And the plan gave it no page.** `atSectionHead` was `chapters && !placed`,
which reads *the story's opening is this section's opening*. They are two
pages — the story's carries its title, the section's carries its numeral — and
excluding the second left chapter one as the only chapter in the book that did
not open. It is `chapters` now.

### Every page, by its number, under the chapter it is in

*In the chapter it needs to be like an outline form in the left-hand menu…
chapter one has pages two, three and four, so it needs to say two, three and
four.*

Three things were wrong at once and only the first was visible.

**The number was drawn in muted small grey** out at the right margin, where a
writer reading a list of rows does not look. The page number is what the row
**is**, so it leads the row now, in a fixed column so the numbers line up.
A picture and a blank print none, and say so in its place.

**A section's numeral read *Text*.** A chapter inside a story opens with a
heading rather than with a `chapter_opening` (addendum 22 §6), so `says` never
called it an opening and nothing on the rail marked where a chapter began.

**And the unit in force ran past its own writing.** `bookPageRows` carried the
last unit forward across a division boundary, so the next story's opening page
and the blank leaf before the back matter were both credited to the section
before them. A new division ends the last one's run. With that, a division
lists the pages **no row under it lists** — a story's own pages, and each
numeral's — where before every page of a story appeared twice.

### Double-clicking a page

*If I double-click any page, the page setup dialog box should pop up with all
the options for that page… I should be able to click on any page in the
left-hand window and double-click on a selected page that opens up the dialog
box. Same function.*

§9h gave every kind of page an owner but not every kind a dialog: a part opened
its part and a chapter opening its chapter page, while an ordinary page of the
story — the one kind that belongs to no record — only went in hand, which on
the screen is indistinguishable from nothing happening. It has a dialog now,
opened by a double-click on its row or on the page itself, and the dialog
**holds nothing of its own**: it renders the same sections the inspector does,
because two copies would be two answers to *what can I do to this page*.

One thing had to be read more carefully for it. Which dialog opens is now
decided by **what is on the page** rather than by the chapter in force: a
chapter inside a story has no marker of its own, so asking the chapter in force
sent a writer who double-clicked the numeral to the *story's* page — §9h's
*trying to enter any information just changes title pages*, one layer further
in.

### The back of a leaf

*When you insert a picture on the left-hand page, leaving a blank page just
makes the next page blank — it's not the back of the page.*

He is right, and the fix is a word. The back of a sheet is its **other side**:
a recto's back is the verso after it, a verso's is the recto before. A picture
asked to leave its back blank therefore takes a **recto**, and the blank that
follows really is behind it — which is also his own earlier arithmetic (45 the
illustration, 46 blank, 47 the text).

*Which page* is gone with it (*you can take the which page out and just make it
whatever the selected page*): it asked a question the gesture had already
answered, and its one real use — holding a leaf for a facing illustration — is
what the blank-back box does properly. An older book's answer is still
honoured; there is just nowhere to set a new one.

### Deleting a picture

*I need to be able to select the pictures on the page… or delete them. So if I
select it and hit delete, it should be able to delete.*

**Delete** on the picture's own panel, and the `Delete` key while a picture is
chosen and the pointer is not in a field. Only the box goes; the file stays in
the graphics library, which is what makes the key safe to give — and Ctrl+Z
puts it back.

## 9k. The three areas, and the copyright page

From Ken: *I want to add the label back in front matter… a locked area. Those
items from the list that are front matter will automatically populate that
area, and those items that are back matter will automatically populate that
area. But you can drag them around and reorder them… With the copyright page in
particular, we need to have a special pop-up dialog box that is for the
copyright information, that allows you to put all the information attached, but
also include a graphic box at the bottom right-hand corner of the page for a
barcode — in case there is no jacket on the actual book. For example, if the
book is made of leather.*

### Front matter, the story, back matter

§9a took two headings out and this puts three back, which only looks like a
reversal. What §9a removed were **rows that carried buttons and a sentence** and
said nothing about where anything was. What a label says is the one thing no row
can: **which part of the book you are in**. A writer looking at *Copyright* and
*About the author* in one list has no way to see that the first is bound before
the story and the second after it, and that is the fact the roman numerals in
the margin are there to carry.

They are **read and stored nowhere**: `halfOf` has decided a part's half since
§5, everything in the story is the story, and `BookRow.half` carries it. So a
part that changes half changes area with nothing run, which is the whole of
Ken's *automatically populate*. The story is labelled too — two named halves
around an unnamed middle reads as though the middle were left over.

**Dropping on an area asks for that half.** `partToHalf` answers, and what it
mostly answers is **no**: a copyright page is front matter *by being a copyright
page*, so it is refused in a sentence rather than moved somewhere a book would
print wrongly. The one kind that really moves is an **art page**, which belongs
wherever the writer wants it — the reason `inFront` exists (§8).

### The copyright page's own dialog

It was the one page in the front matter whose content was **a block of free
text**. Every other one either comes from a reading (the contents, the index) or
is one thing said once (a dedication, an epigraph). A copyright page is a dozen
separate facts in a settled order, and asking a writer to type them in the right
order, in the right words, with the right punctuation, is asking them to know a
convention the program already knows.

`packages/domain/src/copyright-page.ts` is the module and three decisions carry
it.

**The fields are the page, and a field with nothing in it prints nothing.**
There is no blank *ISBN:* line on a book without one and no separator left
behind, which is what makes the record safe to leave mostly empty. It carries a
**number per format**, because a paperback and an eBook are different books to a
retailer and a page that holds one of them makes a writer choose which to leave
off.

**The number line is worked out and there is nowhere to type it.** A writer says
which printing this is; the line drops a digit for each one after the first,
which is the convention every printer reads. Typing it by hand is how a second
printing ends up claiming to be the first — the same argument as the chapter
number, the figure number and the page number before it.

**An untouched page is untouched.** The record is null until a writer opens the
dialog, and until then the page prints the free text it always printed. So no
book made before this moves, which is `partStyleOf`'s rule (§7a) pointed at
content rather than at type. Starting to use the fields carries the old words
into *Anything else*, so nothing typed is lost by beginning.

`copyrightLines` is the **one reading**: the printed book, the spread and the
dialog's own list all ask it, so what a writer is looking at is what will be on
the paper.

### The barcode

A picture in the graphics library, drawn at the **bottom right** of the page at
a width the writer sets. It is a box for a barcode rather than a barcode the
program draws, and that is deliberate: a retail barcode encodes the **price**
as well as the number, which the book does not know. It is **absent rather than
boxed** where there is no picture — an empty rectangle would print on the
finished book.

## 9l. A row is a page, and the chapter that still would not open

From Ken, looking at §9j on his own book: *under the chapter titles, in chapter
one — the Roman numeral I — it says two Text. Well, the actual is four pages…
each underneath should say page two, page three, page four, page five. And if
there is an illustration on a page it will say page three and have something
that says illustration, or if it's blank, it'll say blank. Also, if you look at
the example I gave you with chapter three, how that page is formatted, it should
be the same for the first chapter.*

### The chapter that still would not open

§9j fixed the **importer** so a bare numeral is kept as a heading. Ken's book was
imported before that, so its first section has no heading element at all — and
the rule that opens a chapter could only act on one, because it reads the
manuscript. One chapter in the book opening differently from every other is a
fault whichever way it was arrived at, so the section's **own title** stands in:
the same words the rail shows and the contents page lists.

Two things it deliberately does not do. It does not **repair the manuscript** —
writing a heading back into the words to fix a page is the one thing this room
may never do, and a room that edits the writing to make a page look right is
worse than the page. And it invents nothing: a section the writer left unnamed
opens its page and prints no heading, as it always did.

### A row is a page

Three faults, and the first hid the other two.

**The number was the folio.** An illustration and a blank leaf are counted like
every other page and merely print no folio (§9i), so a row that showed the folio
left both of them with no number at all — the two kinds of page a writer most
needs to point at. `counted` is the page's number printed or not, which is the
reading the rail wanted and `folio` was never going to be.

**And the row said what stands on it instead of which page it is.** *Text* is
not the name of a page; it is what a page of a book contains. So the row reads
**Page 4**, with what stands on it after the number only where that is anything
but plain text — *Chapter opens*, *Illustration*, *Blank*. Ken's word for a
picture page is **illustration** and it is the domain's now, in the one place
that decides.

**A picture was listed after the last chapter.** A figure carries its story's
marker, and on a collection the story is the marker for every section in it, so
every picture in the story was listed after the last numeral — a picture on page
four standing below chapter thirteen, which says nothing about where it is. A
figure carries its **section** too now, and sits under it.

### What sets this page

From Ken: *when you double click, the dialog box should have all the graphic
buttons that let you format a page instantly and have all the options for that
page.*

The page dialog gains the way through to whatever sets it — the **chapter's own
page** where the page carries a chapter marker, **Book settings ▸ openings**
where it is a chapter inside a story, which §6 made a section deliberately and
which therefore has no page of its own to set. It is a **route rather than a
second copy**: putting the chapter page's controls here as well would be two
screens disagreeing about how a chapter opens, which is the fault §6a, §7a and
§9c each found in turn. Absent where the page has nothing to set.

## 9m. Every page under its chapter, and a panel that says less

From Ken, after §9l: *chapter one is still wrong, where it only has page two…
chapter three has only one page and it really has four pages… and so every page
is accounted for*. He reported it twice, which is what makes it the first thing
here.

**The fold matched ids, and matching loses pages.** §9h reads a page's
`unitId` and the rail draws a section row for every unit that has a **title**
(§6) — and those are not the same set. A story imported as a unit per
paragraph has one titled unit carrying the numeral and untitled ones after it:
their pages matched no section row, so they fell back to the story and the
numeral folded open on the one page its heading stood on. That is exactly what
he saw, and it is why two chapters were right and two were not — it depends on
how the writing happens to land in units, which is not a fact about the book.

So a division's pages are **a range rather than a set**: `pagesUnder` in
`book-rail.ts` walks the laid pages in order and gives each one to the nearest
division row at or before it, which is `divisionSpan`'s rule pointed at pages.
Every page of the story is then under exactly one row **by construction**,
rather than by every unit happening to be listed. A part's page is nobody's, a
part having a row of its own and no fold.

**The instructional prose is a floating help box.** From Ken: *all this extra
text that's instructional can be a pop-up box, like a floating help box*. It
was true and in the way — a writer who has read *a picture put here goes in
before the words on it* reads it again every time they open a page, and it
pushed the buttons they came for down the panel. It is behind a **?** now, and
it **floats**: nothing under it moves when it is asked for, which is what stops
it reading as part of the controls. It is anchored to the **section** rather
than to its mark, a panel being the width there is; the first draft hung a
260px box off a mark at the panel's right edge and it ran off the left one, in
the heading's own tracked capitals.

**Done is gone.** From Ken: *when you hit done, nothing happens — you have to
use the X on top, so you might as well remove that*. The figure's Done really
did nothing the × did not, and two ways out of one dialog are two answers. The
line describing the picture went the same way (*under picture, it's saying
about the actual picture — I don't know if that's necessary*): the heading is
the picture's own name now and what the line added is in the help.

**How openings look is on the page, not behind a door.** From Ken: *set how
openings look just gives you the book settings, and we need the graphic
dialogue buttons included in this menu*. §9l made that a **route** on the
argument that a second copy is a second answer — right about the copy and
wrong about the door, because sending a writer to Book settings took away the
picture controls they were standing beside. `ChapterStyleFields` is one
component, so rendering it **here** is not a second copy; it is the same
fields, on the panel that has the buttons. A chapter with a page of its own
keeps the button, that page having a sheet to be set against and a dialog that
draws it. The sentence pointing at the page's own settings is absent here, it
being a sentence telling somebody to go where they are.

**The box is editable, and a picture goes in from the box.** From Ken: *it
should be an editable box that can be dragged out and can give you the
specifications of its dimensions… draggable corners that maintain its
squareness… and there's nothing that allows you to actually put a graphic in
the box area, it just says picture goes here*. So the box being placed wears
its size (`2.10 × 1.40 in · 62% of the measure`, read off the **laid page**
rather than off the drag, so it is the size the book will print), four corner
grips, and a **＋** beside the ✗ and the ✓. Only the **width** is dragged and
the height follows from the picture's own proportions — which is what keeps the
box square-cornered and the picture unsquashed, and is why there is no *fill
the box* to press: the box is never a shape the picture fails to fill. The
text runs round it as the corner moves, the handle being measured off the
figure after each laying (§9d).

## 14. The chapter opening layout

From Ken's own *Chapter Opening Layout* handoff — a spec, a `chapter-layouts.json`
of presets and an approved mockup. Writers pick how a chapter's opening page
looks: where a graphic goes, how the number is shown, how far down the page the
chapter starts, and how the first line is treated, with a live preview.

### 14.1 The audit

Of the handoff's six-field settings model, **four fields were already stored
under other names**: its `numberStyle` is `markerNumbering`, which has offered
all four of its options and three more since the markers were built; its `sink`
is `dropInches`; its `graphicSize` is `graphicWidth`; its `graphic` is
`assetId`. And **five of its eight layouts** are the four `CHAPTER_TEMPLATES`
plus *no graphic at all*.

So what is new is the **layout as one named thing**, three arrangements nobody
could draw (a bleeding header, a flush-left opening, a numeral alone), and the
drop cap.

### 14.2 Three decisions

**A layout is data and the renderer reads the data.** `CHAPTER_LAYOUTS` in
`chapter-layouts.ts` is a list of **slots** — the pieces in the order they are
met down the page — and the print walks the list. There is no
`if (layout === 'mid')` in the print, the preview or the thumbnails, which is
the handoff's *adding a layout needs only a new entry* kept by construction.

**`layout` is the answer and `template` is its older spelling.** An existing
book stores only where its graphic goes, so `layoutOf` reads that back: a book
made before this draws exactly as it did, nothing is migrated, and setting a
layout **clears** the template rather than leaving two fields to disagree. It
is the shape `manuscript`/`serif` took when the face list widened (§7a).

**The named steps are read back, never stored.** Shallow, Standard and Deep are
inches on the page; the buttons set them and one lights where the stored number
matches, so a writer who typed a depth sees none of the three lit rather than a
button lying about what will print. `bookPresetOf`'s rule (§7), and the same
for S/M/L over `graphicWidth`.

### 14.3 What the slot walk had to keep

The number, the rule and the title stay **one piece** inside `.bk-chapter-head`,
which is what carries the book's optional rule under the whole heading — so the
four older layouts emit byte for byte the markup they always did, and the whole
suite passed without a print assertion being edited. That is the proof the
older spelling really is unchanged.

**Every layout carries the epigraph slot**, not only the epigraph one: an
epigraph is something the writer typed on *that chapter*, and a layout that
dropped it would lose their words for a reason they never asked for. What `epi`
changes is how it is set (its own measure, air round it), never whether.

A **page of art** stays apart from a **bleeding header**: a band across the top
with the heading under it is not a picture that *is* the page, and the book has
drawn the second since `full_page`. Nine layouts, not eight.

### 14.4 The first line

`opensChapter` has been on the paragraph block since the book was first laid
out, so a drop cap is a **rendering of a paragraph the plan already marks** and
nothing new is stored. `firstLineCut` is the one rule both the print and the
preview take, so a writer choosing a drop cap sees the letter the book will
set. It cuts at a character rather than re-marking the text, so a chapter
opening on an italic phrase keeps it; the cap takes an opening quotation mark
with it, and a lead-in cuts on the fifth space. It is the **book's** and never a
chapter's — a book where chapter four alone has a drop cap has a mistake in it.

### 14.5 The screen

`ChapterLayoutDialog.tsx`, reached from **Chapter openings…** on the Layout bar
and from a page's own panel. Nine thumbnails drawn from the same slot lists,
the controls beside them, and the page on the right.

The handoff paints it in fixed hexes; it uses the app's **tokens**, because a
screen painted in literal colours is the one screen that does not follow the
writer's colour scheme. The preview shows the chapter's **own first words**
under the opening — without them the sheet is a heading in space and the
first-line control shows nothing at all — and a chapter that opens on a leaf of
its own says the words are overleaf rather than drawing a page that does not
exist.

Changes apply as they are made, which is addendum 02 §12a's rule (*a look is
tuned against the sheet beside it*); *Apply to* switches where the next one
lands. **Every opening** is the one act that reaches work somebody did, so
`describeApplyToAll` says how many chapters set on their own would be cleared,
and the press asks inline.

`ChapterLeaf` reads the slot list too. It kept a private template ladder that
knew three arrangements and could not draw a fourth, so a writer setting a
flush-left opening would have been shown a centred one. What it still does for
itself is the **size** — a sheet standing for a page at a few hundred pixels
against type measured in points — which is a real difference between a
thumbnail and a page rather than a second opinion about the design.

Driving the real room caught the fault no test could: a bare `display: flex` on
the dialog **beats the browser's own `display: none` for a closed `<dialog>`**,
so the whole thing was laid over the room and swallowed every click on the bar
behind it. It is on `[open]` now.

### 14.6 Not built

*Save as preset* (the handoff allows deferring it), and the per-chapter
`graphicSize` where a layout ignores it. The number style is the book's
`markerNumbering` rather than a per-chapter field, deliberately: two controls
deciding what a chapter prints would be two answers.

## 15. The copyright page's elements

From Ken's *Copyright Page dialog* handoff, the companion to §14's. Each
element is its own box: switched on or off, edited, and reordered, starting
from one of four standard orders, with the page drawn beside it.

### 15.1 The audit

**Ten of the handoff's twelve elements were already fields** on the record
§9k built, and the two that were not — permissions and the Library of
Congress number — had been going into *Anything else*. Its alignment and its
type size are the part's own `LineStyle` (§7a). So what was missing is not the
content but **the sequence**: `copyrightLines` walked a hard-coded run of
`say(…)` calls, and a writer who wanted the notice above the disclaimer could
not have it.

### 15.2 Three decisions

**An element turned off is not an element left empty.** They look alike on the
printed page and mean different things — *I have no Library of Congress
number* and *I have one and this book does not print it* — so `hidden` is its
own field and switching something off **keeps its words**. It is the
graveyard's `archived`-is-not-`deletedAt` argument pointed at a page.

**Which preset is in force is read back, never stored.** `presetOf` compares
the order, the hidden set, the position and the alignment against the four and
answers null for anything else, so moving one element reads *Custom* rather
than a preset that has stopped describing the page — `bookPresetOf`'s rule,
which the handoff asks for by name.

**Two of its controls are settings that already exist.** The alignment and the
type size write `partStyleOf`, not a second pair of fields, and the section
says so. A second control for either would be a second answer about how the
page is set.

### 15.3 What moved

An empty `order` means *the order this page has always printed in*, so a book
made before this reads unchanged and nothing is migrated — `layout`/`template`'s
shape a second time.

The block can sit at the **top** or the **middle** as well as the foot. §7a
hung it at the foot and nowhere else, on the reading that a notice a third of
the way down is not a copyright page and that the block is long enough to be
pushed off the sheet. That was right about the **default** and wrong to make
it the only answer.

The **number line rides with the edition**, where it used to stand last under
everything. It is where a book prints it, and it is what the handoff's element
is called — *Edition & number line* — so it moves with it when the order
changes. Still worked out, still nowhere to type one.

A **notice with nobody in it is owed**. It prints either way — *Copyright ©
2026* — which is exactly why the footer has to say it is unfinished rather
than reading as ready; an unfilled binding counts, which is the handoff's own
rule.

### 15.4 The screen

`CopyrightPageDialog.tsx`, in §14's chrome — the same `chl-*` head, foot,
sections and pills, with `cr-*` only for what is this page's own. Two dialogs
sharing one look rather than two copies of it.

A row carries a grip, its name, a one-line summary of what it will print, a
**Required** badge or a switch, and move buttons; the header expands it. The
summary says what is there and what is missing **as such** — a `[HOLDER]`
invented on the row would be a placeholder the counter at the foot cannot see.
An ISBN with a wrong check digit is marked and explained under the row, and an
**empty** one is not marked at all: it is a number the writer has not got yet,
not a mistake.

### 15.5 Not built

*Save as preset*, and the drop zone's dpi warning (the barcode is chosen
through the room's own file dialog, which has no dpi to read). Apply is not a
button: every change is kept as it is made, and the page is drawn beside it —
§12a's rule, and the handoff's Cancel would have to undo work the preview has
already shown as done.

## 15a. One prop, and a feature that read as unbuilt

From Ken, the day after §15 shipped: *the new copyright page is not live*.
It was, and it was reachable from one gesture out of two.

The dialog is offered by `PartFields`, which the room renders in **two**
places: the inspector, when a row is chosen with a single click, and the
**part dialog**, which is where a double-click lands. The inspector passed
`onOpenCopyright` and the part dialog did not, so the button was `absent`
there — and what stood in its place was the free-text box the dialog was
built to replace. A writer who did what §9h and §9l document for *open the
thing that sets this page* met the old screen and reasonably concluded
nothing had shipped.

Two things are worth keeping from a one-line fix.

**A control gated on a callback is absent wherever the callback is not
handed down**, and absence is the room's own idiom for *this does not
apply here* — so a forgotten prop does not look like a bug, it looks like
a decision. `PartFields` is rendered twice and was given different powers
in each, which is the same shape as a screen holding its own copy of a
rule: two answers to *what can be done to this part*.

**A route needs a test per gesture, not per screen.** §15's own tests
drive `CopyrightPageDialog` directly and all nine passed throughout; what
none of them asked is how a writer gets there. The test added here presses
the row and then double-clicks it, and asserts the same dialog opens both
times — the route rather than the dialog, which is the half that was
broken.

## 9n. The designed page, on one screen

From Ken's handoff, headed *Half title page panel (redesign)*: three
numbered sections, four placement templates, a page navigator, guides, and
a footer saying how far the page has been taken from the style.

**The audit paid an eighteenth time.** Nearly every control the handoff
asks for was already stored, under names that mean the same thing: the
template table, the drop, the alignment, the face, the size/case/style/
tracking of a `LineStyle`, the rule, and *Back to the page's own look*.
`partTemplateOf` was already a **reading** — the handoff asks for exactly
that by name. What was missing is not the settings but the **shape**: three
decisions the old stack of fields could not express.

### A template is a height

The first five templates conflated two questions. *High and left* and *Low
and right* each carried an alignment, so ranging a page left made it
*Custom* though it sat exactly where *Classic* puts it, and choosing a
template silently moved the block across the page. The handoff separates
them — four heights, and an alignment control beside them — and that is the
right reading: **where a block sits down the page** and **how it is ranged**
are two questions, and a control that answers both can only be wrong about
one of them.

So `PART_TEMPLATE_WORDS` is *Upper third* (33), *Optical centre* (42),
*Centred* (50) and *Low* (62), it carries no alignment, and
`partTemplateOf` asks the **drop alone**. It is still read back rather than
stored, so dragging the height makes the page *Custom · placed by hand* by
itself.

The default drop moves from **30 to 33**, which is the one place a page
nobody ever set changes — by 3% of the height, on the four designed pages.
It is the handoff's own number, and the alternative is worse: at 30 a fresh
book reads *Custom · placed by hand*, which is a lie about the page and
makes the template row useless out of the box.

### The mode is a reading

What the page carries in place of its title — the words, a logotype, a page
of art — is `partModeOf`, read off the record, so the tiles cannot disagree
with what the page prints. Choosing a tile is **the act**: it opens the
picker, or takes the picture off. Nothing stores a mode beside the picture
that could drift from it, which is the same absence as the chapter
template's and the book preset's.

The half title takes a logotype now, as the title page always has.
`logoAssetId` on the part is the picture, from the graphics library like
every other; `settings.titlePage.titleImage` is the **older spelling of the
same intent** and is still honoured where a part carries none — nothing is
migrated, no page moves, and `partLogo` is the one reading that says which
is in force. *File ▸ Title page…* goes on writing the older field, which is
what the handoff asks for by *keep it bound to the same setting*.

### Cancel means cancel

The room saves as you type and this screen goes on doing it, because a look
is tuned against the sheet beside it (§12a). So the part **as it stood when
the screen opened** is held, and Cancel puts it back; Done keeps what is
there, having already kept it.

### The rest

`partChanges` counts **leaf by leaf** — a writer who set the size, the case
and the slope is told three, where counting `title` as one field would say
*1 change* over a page that had been taken apart. It compares the resolved
style against the same style with nothing stored, so a field written back
to its own default by hand is not a change.

The navigator counts **sheets** rather than printed numbers: the front
matter counts in roman and the story in arabic, so *page i of 9* would put
two numbering systems in one sentence. What the page prints is on the chip
beside it and in the line under the name.

The guides are the room's own and nothing about them is stored: the text
block from the geometry, and a line at the chosen height — the one thing a
writer cannot otherwise watch themselves setting.

Which pages get this screen is `partPlacement(kind) === 'block'`, the
predicate §7a already drew: a page that **flows** or hangs at the foot has
no block to place, so the contents, the index, the copyright page and the
prose parts keep the older fields. There is no second list of kinds.

Driving it caught three things the tests did not: the room's own `h3` is a
tracked-capitals section label, so *Typography* was shouted and *Upper
third* came back as UPPER THIRD — a template nobody named, from a rule this
screen never wrote and inherited anyway.

## 15b. The two the copyright page still owed

§15.5 listed *Save as preset* and the barcode's drop zone as not built. Ken
re-sent the handoff — *I'm not sure if I gave you this spec because the
copyright page hasn't changed* — which was §15a's fault rather than a
missing feature: the dialog was reachable from one gesture out of two, so
the double-click landed on the free-text box it replaces. With that fixed,
these two are what the handoff still asked for.

**The barcode's sharpness is a reading**, and that is why it is worth
having: the same picture is fine at 1.5in and too coarse at 3in, so a
warning worked out when the file arrived would be about a size the writer
has since changed. `barcodeResolution` counts the dots at the width it is
*placed*, so narrowing the barcode clears the warning by itself — the
honest fix as well as the fastest. The sentence names the number, the width
it is about and the way out, because a warning that does not say what would
fix it is one a writer can only ignore. A **vector is not warned about**
rather than warned about with a made-up number, having no pixels to count;
what a file is, is the host's business, so the caller says which it is. The
box takes a file dragged onto it and Browse… does the same for anybody not
dragging — both through the room's one reader, so a barcode joins the
graphics library like every other picture.

**A saved order is the same shape as a built-in.** `savedCopyrightPreset`
makes one from the page as it stands, and `presetOf` takes the four and the
writer's own as one list — so the tiles, the reading and `applyCopyrightPreset`
take it without being told saved ones exist. It is still a **reading**:
nothing stores which preset a page came from, so moving one element makes
it *Custom* by itself. It keeps the **arrangement and never the words** — an
order is a house style and a copyright notice is one book's — and a
writer's own can be forgotten where the four cannot, those being the
standards rather than somebody's choice.

## 15c. A route is not a detour

From Ken, looking at the part dialog open on Copyright: *it still does not
show in the update*. The screenshot showed the older screen — a HEADING
field, a **The copyright information…** button, the free-text TEXT box, and
PAGE STYLE with its face and its small print.

§15a was right about the fault and only half right about the fix. It gave
the part dialog the button it was missing, so the double-click *reaches*
the new screen — a route rather than a second copy, which was the correct
instinct. What it did not ask is what the route passes through: the page
the gesture lands on first is the one the new screen was built to replace,
and a writer standing on the old box does not read *there is a button that
would take me somewhere better*. They read what Ken read, which is that
nothing changed.

So the line §9n drew for the designed pages is drawn again here: **a
copyright page opens its own screen**, from the rail, from its page on the
spread and from the inspector alike, and the older dialog never stands in
front of it. One page, one screen, and no press in between.

Two things follow.

**A route is only honest where what it passes through is not the thing it
is routing away from.** §15a's rule — a route rather than a second copy —
is still right, and it is what the inspector's button does: the inspector
is a panel about a selection, not a rival screen. The part dialog was a
rival, because it holds a control for the very thing the new screen sets.

**What the older screen alone could do had to come with it.** The part
dialog's PAGE STYLE was the only way to set the copyright page's face and
the small print's case, weight, slope and letter spacing — the new screen
had the alignment and three sizes and nothing else. Routing past a screen
without carrying its controls is how a fix loses a feature, so *The small
print* now holds all of it, writing to `partStyleOf` exactly as before: the
same field, one place to set it.

Driving it caught what the tests could not — the section runs past the foot
of the side column on a laptop, so every control below *Small caps* was
reachable only by a scroll nothing announced. The column is wider and
scrolls visibly now. A control a writer cannot see is one they report as
missing, which is the whole of why the type is here at all.

## 16. The title page

From Ken's own *Title Page panel* handoff, the companion to §9n's and §15's:
seven elements each with a switch, three arrangements, its own typography,
and the page beside them.

**The audit paid a nineteenth time, in two directions at once.** Four of the
seven were already printing — the title and the author are `bookNames`', the
subtitle is `settings.titlePage.episode` (the older spelling, drawn under the
title since the room was built), the publisher is `settings.book.imprint`.
Two more were already *typed*, on the **copyright page**: `publisher`,
`publisherPlace` and `edition` have been fields on that record since §9k. So
what is new is not the content but the **switches, the arrangement and the
type**; the one field a title page had nowhere to keep is the contributor.

Four decisions carry it.

**The publisher is the book's, and is named once.** A title page and a
copyright page naming different publishers is a mistake rather than a design,
so `publisherOf` reads that record and the rows offer **Edit on the copyright
page** — §15c's route rather than a second copy, which is what the row would
be if it held a box.

**An element switched off is not an element left empty** (§15's rule pointed
at the page in front of it). *This book has no second edition* and *this book
has one and the title page does not print it* look alike on the page, so each
optional element has a switch of its own and switching it off keeps its
words. The defaults are exactly what the page printed before there were
switches; the location is on because an element that is on and empty prints
nothing, which is the whole of why the switch and the field are two things.

**A template is a pair of heights, and one of the handoff's four is not a
template at all.** On this page the title's height says nothing about whether
the author is under it or half a page below, so `titleTemplateOf` asks
both — Classic, Stacked, Set high. The handoff's fourth, *Flush left*, is
Classic's heights ranged left, which is the conflation §9n removed: keeping
it would mean choosing a template moved the page across as well as down, and
ranging a page left would read as *Custom* though its heights had not moved.
The alignment stays its own control. **Null means *under the title***, so
`authorDrop` is one field answering both of the handoff's controls rather
than a number and a mode that could disagree — `minimumSetups`' shape, and
what the page has always done, so a title page nobody has arranged is
unchanged. It reads as **Stacked**, which is §9n's argument again: the
default drop moves 33 → 36 so a fresh page names an arrangement rather than
lying about being custom.

**The author, the subtitle and the publisher were one line of type and are
three.** `.bk-author`, `.bk-subtitle` and `.bk-imprint` all read
`--pt-line-*`, so setting the author to sixteen point set the imprint to
sixteen point and a subtitle could not be italic while the author was in
small caps — §7a's running heads, on the page in front of them. The
subtitle's **size is derived** from the title's and there is nowhere to type
one; its slope is the one thing books disagree about, so it is the one thing
there is to set.

Two smaller ones. The conventions — always a recto, counted but unnumbered,
the copyright page on its back — are **said rather than hidden**, because a
writer who cannot find a control should be told why instead of hunting. And a
missing publisher is **said, never refused**: plenty of books are published
by nobody in particular, so it is a note in the footer and never something
holding *Done*.

Driving the real room caught two faults tests could not. The author's `2em`
of air, which is what separates it from the title in the stacked
arrangement, carried into its own group and put Classic's author at 56%
rather than the 52% the writer set. And the inspector's older `PageStyle`
panel still offered this page the **one-height** templates, which on a page
whose placement is a pair could only disagree with it — absent there now,
with the way through said.

## 16a. A barcode as the vendor sends it

From Ken while §16 was being built: *the ISBN barcode needs to be able to
import a PDF, because that's how it's exported from the actual vendor. Or an
EPS file.*

**The PDF is drawn once, on the way in.** A data URI of a PDF in an `<img>`
draws nothing — not in the room's preview, not in the exported PDF, not in
the eBook — so `readPdfPicture` renders page one at **600 dpi against the
page's own size in points** and what the library keeps is an ordinary
picture. Nothing downstream learns that PDFs exist, and `barcodeResolution`
reads the dots it is given and answers honestly: a 2 in vendor file comes in
at 1200 × 600 and reads *600 dpi at this width*, falling to 400 when the
writer widens it to 3 in.

**EPS is refused, with the one-step fix named.** Nothing in the app can
rasterise PostScript — pdf.js reads PDF and Chromium reads neither — and
there is no honest way to accept one: a stored EPS would be an empty box in
the preview, the printed book and the eBook alike. So it says *open it and
save it as a PDF*, which is a refusal a writer can act on; `.ai` and `.ps`
say the same. Everything else still reads *that is not a picture file*.

**One reading, where there were nine.** `pictureRefusal` is what decides, and
it had been written out by hand as `startsWith('image/')` in nine places plus
`accept="image/*"` in nine more — so a gate beside the reader would have gone
on refusing what the reader had learned to draw. `PICTURE_ACCEPT` is the one
constant the pickers offer, because a picker that refuses what the reader
takes is a control that lies.

**And it found a fault in code it did not write.** pdf.js 6 calls
`Map.prototype.getOrInsertComputed`, a proposal method that landed in V8
*after* the Chromium this app ships on — so `getDocument(…).getPage(1)`
throws on a writer's machine, and **the PDF script importer had been broken
the same way** with every test green, nothing in the suite loading pdf.js.
`pdf-runtime.ts` is one place that loads the library, owns the worker and
supplies the missing method where it is missing; both readers ask it, which
also took out a second copy of the worker setup.

## 16b. The route that predates the screen

From Ken, the day §16 shipped: *the title page dialogue box not showing —
probably same problem as copyright had.* It was, and he named it before
looking.

**`File ▸ Title page…` opened the screenplay's front page.** Written by,
Contact, Draft date, Revision — a different page of a different kind of
document, offered on a book because that command has existed since long
before books did and nothing had ever asked it what it was opening. The
panel §16 had just built was one double-click away in the Layout room and
read as unbuilt from the only route the menu documents.

On a book the item now opens **the book's title page**, which is the room's
own screen: its preview is the page as the book sets it and its navigator
turns to the next one, so it needs the laid pages and cannot be hosted over
the workspace — §9d's rule about the chapter page, arrived at from the other
end. `openOnKind` is how the room is asked, keyed on **arriving** rather than
on the kind, so closing the dialog and staying in the room does not reopen it
a moment later.

Three of these in three days is a pattern worth naming.

**When a new screen replaces an old one, the old screen's routes are the
feature.** §15c found a route that passed *through* the page it replaced;
this found one that had never heard of it. Both times the screen itself
worked, both times every test passed, and both times the writer correctly
concluded nothing had shipped. Building the screen is not shipping it.

So §15a's rule grows a clause: **a route needs a test per gesture, and per
menu item.** A menu command is the most durable route in the program and the
least likely to be revisited — it is written once, years before the screen it
will one day be wrong about.

A sweep of the other nineteen commands found no second case: *Chapter page…*
opens addendum 19's own book screen, and page setup and print are the
manuscript's, which a book still has.

## 16c. A logotype replaces the title, not the page

From Ken, looking at his own title page: *the new title page box is not
coming through.* He was on the new screen — his title page is set as
**full-page art**, and in that mode it showed three tiles and nothing else.

**§9n hid the elements and the type wherever the page carried a picture**,
which is right on the half title: a logotype there *is* the whole content of
the page, so there is nothing left to set. On the **title page** it stands
where the title would and **six of the seven go on printing** — the subtitle,
the author, the contributor and the whole publisher block — so the print drew
things the screen would not let anybody reach. The predicate is the page's
now, not the picture's: only **art** really has nothing to set, because it
bleeds to the trim and the words are in the artwork.

The title's own row then has to say what stands there, since the words are
not set under a logotype; it offers another one, or the title back.

And the art mode is **absent with the reason said**. It listed no elements
and explained nothing, so a writer who had just specified seven of them
found a panel that looked unbuilt — which is exactly what Ken reported, on a
screen that was working as designed. It now says that none of the seven
print, why (they are all in the artwork), and which tile brings them back.

The lesson is the same one §16b drew, one layer in. **A mode is a route
too.** §15c and §16b found ways *in* that missed the new screen; this found a
state *of* the new screen that showed none of it. All three read identically
from the writer's chair — the feature is not there — and in all three the
feature was there and working.

## 16d. A route is not a field

From Ken, re-sending the handoff unchanged: *here is what it is supposed to
be.* Comparing it against what shipped, the divergence is one decision of
mine and it was wrong.

**§16 made six of the seven rows read-only**, each with a button through to
wherever the value is typed — *Edit in Book settings*, *Edit on the
copyright page* — on the ground that a value should be named once. The
handoff's §8.1 asks for the opposite in plain words: *editing the title or
author here updates Book settings, and the reverse.*

**And two-way sync is not a second answer.** A box on this row writes the
**same field** Book settings writes; there is still one value, with two
doors. What I built was not a stricter reading of *named once* but a
misapplication of it: §15c's *route rather than a second copy* is about
**screens** — do not build a second panel that sets the same thing — and
says nothing against a second control onto one field. A route in a row's
place is worse on every count: it cannot show the value as an editable
thing, it throws the writer out of the page they are setting, and it makes a
seven-row panel into a list of links.

So every row is a real input now, each writing where that value lives: the
title, the subtitle and the author through `setTitlePage` (the call Book
settings makes), the contributor onto this page's own record, and the
publisher, its place and the edition onto the copyright page's — which is
still the one place each is stored, and is now reachable from both.

The publisher takes the handoff's **Name / Logo** pair rather than a button
beside the name, and the header carries its line: *Title and author stay in
sync with Book settings*, which is the argument for the boxes said on the
screen.

**And *Flush left* is built after all.** §16 dropped it as §9n's conflation
returning — a template that ranges the page as well as placing it. The way
to keep both is to make the **reading** ask all three numbers rather than to
drop the arrangement: Classic is 30/52 centred and Flush left is 30/52 left,
so each names one whole arrangement, nothing is stored, the alignment keeps
its own control, and ranging a Classic page left reads as *Flush left* —
which is what it now is. Anything the four do not name is *Custom*.

The lesson is narrower than §16b's and worth keeping beside it: **a rule
about screens is not a rule about controls.** Applied one level down it
turned a panel into a set of doors.

## 17. The back matter

From Ken's handoff, for seven pages that come after the story:
acknowledgements, appendix, glossary, bibliography, index, about the author
and reader extras — each with its own first section and one shared screen
behind them all.

**The audit paid a twentieth time, and this one is mostly shell.** The
*screen* exists: §9n and §16 built exactly the handoff's shape — numbered
section cards down the left, the page as the book sets it on the right, a
navigator, Guides and a footer of *Reset to page style · Cancel · Done* —
and the handoff says so itself, *identical in structure to the Half title
and Title page panels*. *Sections 2 and 3* exist: a part's `PartStyle` has
carried the heading's line, the alignment and the rule since §7a, and the
body's size is its `line`. And *five of the seven pages* exist as part
kinds, the index in particular being addendum 10 whole — marks placed in
the manuscript, page numbers read off the pagination every time, letter
dividers — which is the handoff's *Build from the manuscript* tile already
built and already better than its own promise, since the numbers are a
reading rather than a stored list.

What is genuinely new: an appendix, a bibliography and the reader extras as
part kinds, the two page-specific sections below, and four things the
cutter has always understood and nothing could ask for.

**The page's own side and its own number.** `layPages` has taken `starts`
and `folio` on every block since §4, and every prose part took a recto and
printed a number whether it wanted one or not, there being nowhere to say
otherwise. `recto` and `folio` are on the style now; both default to what
every prose part already did, so no existing page moves.

**The sink, and the fourth step nobody asked for.** How far down the page
the heading begins is `drop`, which every designed page has carried since
§7a and which a prose part **stored and never read** — so the day it became
a control was the day it could move an existing foreword. §7a's own rule
decides it: a style starts as exactly what the page prints, so `BACK_SINKS`
offers **At the head** before Shallow, Standard and Deep, and it is the
default for all seven. The three named steps are `CHAPTER_SINKS` (§14) read
through `sinks.ts` rather than a second table; a depth set by hand lights
none of them, `bookPresetOf`'s rule for the sixth time. It is **absent on a
page that flows** — the contents and the index run to as many pages as they
need, so there is no single block on a page to place, which is
`partPlacement`'s own predicate and the same reason the template and the
drop are absent there.

Driving the real room found the fault of the day, and it is the one this
whole room keeps finding: **the sink replaced the book's opening depth
rather than adding to it**, so pressing *Shallow* moved the heading a
quarter of the way **up** from where *At the head* drew it — a control that
goes the wrong way when a writer asks it to go down. `.bk-opening` now
reads `calc(… + var(--pt-sink, 0in))`, and the depth is in **inches**,
because a percentage padding resolves against the containing block's
*width* even at the top (§9g). It also found the navigator keeping the
fields column's scroll, so › off the foot of one page landed halfway down
the next — indistinguishable, on the screen, from the turn not having
worked.

**The acknowledgements** are the page's words and a **sign-off**, which is a
field of its own rather than a last paragraph: the page sets it apart —
ranged right, in italic — and a writer who typed it as a paragraph would
have no way to say so. Switching it off **keeps its words** (§15's rule),
and it prints as a `paragraph` block with `role: 'sign_off'`, a field
narrow enough to name the one page it serves being honester than a general
one nobody can read — `copyrightPosition`'s precedent.

**About the author** is the photograph and the links. Two things are
deliberately *not* fields on it. The **name** is the book's, read from
`bookNames`, so a pen name typed on the title page is the one on this page
too — §16d's one value with two doors. And the **biography is the page's
words**, `part.text`, which every prose part has carried since §5 and which
the printer already sets; a `bio` beside it was written first and deleted,
because it would have stranded whatever an author had already typed here
and given the book two answers to what this page says. The photograph is a
**figure and an inset a sixteenth time** rather than a picture of its own
kind: *above* is a figure across the measure, *beside* is exactly the inset
the book has cut pictures into paragraphs with since §8, *none* is no block
at all — and where it goes and what shape it is are **absent until there is
a photograph**, both being questions about a picture.

**Columns were built and taken out.** `PartStyle` carried a `columns` and
the stylesheet a `.bk-cols-2`, and nothing emitted the class: a two-column
reference page is a change to the *cutter* — the measurement and the lines
per page both halve — rather than a declaration, and a control that stores
a number the book never reads is a control that lies. It is its own stage.

## 17a. The other five, and pulling from the text

The remaining five first sections, and Ken's ask in the middle of building
them: *any functions in the back matter that can be pulled from the text?
Let's have a function and a button that says pull from text.*

**The answer is that two of the seven can, one already does, and four
cannot** — and saying which is most of the feature, because a button on a
page with nothing to read is one a writer presses once and never trusts
again. It is **absent rather than greyed** on the five, with the reason in
its place.

- **Glossary** ← the terms the book itself marks: a heading marked for the
  **index**, or a short run set **bold** in the writing, which is how a work
  of non-fiction names a term on first use. Both are the writer's own marks
  on their own text. A bold run longer than four words is emphasis rather
  than a term, and a glossary of sentences is worse than no glossary.
- **Bibliography** ← the research notes that carry a `source`, which is the
  field addendum 16 §2 calls the one a nonfiction author cannot work
  without. Each arrives **as written**.
- **Index** ← it already does, continuously, and has since addendum 10. A
  button here would be a second and worse copy, so the section says so.
- The other four have nothing a book could give them, and say that instead.

Three rules keep it honest. **It never writes a definition** — a term
arrives with its definition empty, because the definition is the work and
the term is the tedium, and a generated one would be a sentence the author
did not write standing in their book under their name. **It adds and never
overwrites**, matching on the words, so a second press changes nothing and
an edited definition cannot be lost — which is what makes it safe to put on
the page with no ask. And **it reads marks rather than guessing**: nothing
here decides what a term is.

### The five panels

**Appendix.** The label is a **reading**: `appendixLabel` works it out from
where the appendix falls among its fellows, so moving one relabels the rest
with nothing run and there is nowhere to type *Appendix C* — the chapter
number's rule for the seventh time. Letters, numbers or roman, plus the
title and whether each starts a new page.

**Glossary.** Terms and definitions as rows, sorted or in the writer's
order, with letter headings **absent rather than greyed** while the list is
unsorted (letters over an unsorted list head groups of one). A term style
and a run-in or stacked layout.

**Bibliography.** Sources as fields, set live in Chicago, MLA or APA — and
**a free-text entry is kept exactly as written**, shown as one box rather
than five, because a style is a rule about *fields* and an entry with none
cannot be restyled without inventing the parts.

**Index.** Its section is a statement rather than a control: the page is
addendum 10 whole, so it says how many marks the book carries and where to
manage them.

**Reader extras.** Four kinds as tiles, each with its own controls and its
own heading — and *Also by* takes the book's author, so it is a reading
rather than a string in a table.

**What a list page prints is its records.** A glossary, a bibliography and
a reader extra hold records rather than prose, so `partBlocks` reads its
paragraphs off them; the panel and the page cannot then disagree about what
the page says. A term's `lead` is its own field rather than an inline mark,
because a term may be set in **small capitals**, which no inline mark
spells, and because the definition after it is the writer's prose and keeps
its own italics.

**The §3 defaults table, and a correction.** Each page now starts at the
handoff's sink, size, folio and side. That corrects §17, which gave all
seven *At the head* on §7a's rule — and the correction is the interesting
half: **that rule is about not moving work somebody did, and it is not a
reason to withhold a design from a page that has never had one**, which is
what a handoff is for. *At the head* stays as the fourth step, so the older
look is one press away, and the prose pages that are **not** among the seven
(a foreword, a preface) are given `drop: 0` explicitly so none of them
moves.

## 17b. Collecting into the back matter while reading

From Ken, the day after §17a: *for the appendix and the glossary and the
index in the book view as you're reading it you can pick a word and when you
use the right click menu you can say add to appendix add to index add to
glossary.*

**One of the three was already built.** *Index this…* has been on the
manuscript's right-click since addendum 10 §6, and it is the better half of
the three: a mark anchored to the passage, with the page number read off the
pagination every time. So this is the other two, built to its shape — and the
existing one renamed to match, since **three acts of one kind should read as
three**, and *Index this…* beside *Add to the glossary…* reads as two
different sorts of thing.

Three decisions carry it.

**The act makes the page.** A writer who picks a word and asks for it in the
glossary is telling you the book has a glossary; refusing for want of one and
sending them to Layout to make it first is §4b's mistake — an act must make
the reading true rather than require it. `captureToGlossary` and
`captureToAppendix` make the page where the book has none.

**A word for the two that list words, the passage for the one that holds
prose.** An index entry and a glossary term are things a reader looks up, so
they take what was picked; an appendix holds supplementary *material*, so
*add to the appendix* means the passage. Which is which is the thing a writer
would otherwise get wrong once and distrust afterwards, so the menu says it
under each label — `note` on the item, which §6b built for exactly this —
rather than leaving it to be discovered by pressing.

**A term already listed is said, never doubled.** A glossary with *Fresnel
lens* in it twice is worse than one with it once, and the writer who asked did
not know it was there. `glossaryCaptureOffer` refuses in a sentence, and
`captureToGlossary` refuses the same thing again, `trackRemoval`'s shape.

`packages/domain/src/back-matter-capture.ts` is the module;
`CollectIntoBackMatter` in `BeatBody.tsx` is **one screen for the two**,
because they are one act with two destinations and two screens would be two
answers to *what does picking a word do here*. The index keeps its own, which
asks for a heading, a sub-heading and whether the discussion is the principal
one — none of which either of these has. An appendix picker is **absent where
the book has none or one**, nothing to choose not being a control. All three
are **absent rather than greyed** on a screenplay, which has no back matter at
all.

Driving it caught the fault of the day, and it is a wording one: the screen
said *Start a glossary with “X” in it.* and then, under it, *The book has no
glossary yet. This makes one, at the back.* — **two sentences saying one
thing**, which reads as two facts. The page it would make is part of what a
press would do, so it is said in the same breath: *Start a glossary at the
back of the book, with “X” in it.*

## 9o. What a fold hides

From Ken: *when you collapse a story, it only collapses the first chapter. It
needs to collapse the entire story until the next one. So I have three stories
loaded. And it works with the second story, but it still shows the opening page
even when you collapse it.*

**Both halves of that are one fault**, and it is this room's own rule going
unread. §9a settled that **containment is depth, never a heading** — the front
matter, the story and the back matter are not three lists, they are the order,
and the only nesting is depth. The fold never asked about depth. It hid a row's
**pages** and nothing else, so closing a story hid the one page the story row
owns and left every chapter under it, and every one of *their* pages, standing.
Measured on a collection of three stories with three chapters each: the whole
rail was nineteen rows and closing every story took it to nineteen rows.

The opening page is the same fault from the other end. `pagesUnder` gives each
page to **one** owner (§9m), so where the story's first chapter carries a row
the opening page belongs to **that chapter** rather than to the story — and a
chapter row that never hides is an opening page that never hides. Which is why
it looked like it half worked on the second story: whether the story or its
first chapter owns that page depends on whether the chapter has a title, which
is not a fact about the book.

So `visibleRows` reads depth: **a closed division hides every row after it that
is deeper, until the next row at its own level or above.** The pages go with
them because a hidden row draws nothing, which is why there is no second rule
about pages. Three stories now close to three rows.

Two things came with it. The arrow is **absent rather than dead** where there
is nothing under a row (`rowHasUnder`) — which the row's own comment has
claimed since §9h while every chapter and section got one regardless, so a
story's untitled first section offered a fold that opened onto nothing. And it
is labelled **what is under** rather than *the pages of*: a story holds its
chapters as well as its own opening page, and a label naming one of the two
describes the fold a writer is complaining about rather than the one they have.

**What changes for a novel**, and it is worth saying because Ken asked about a
collection: a novel's chapters have pictures under them (§9l) rather than
chapters, so closing one now hides its pictures too. That is the same rule and
is why it is not special-cased, but it does mean an illustrated book opens on
its chapters rather than on its chapters and every picture in them.

## 9p. A picture on a chapter's page, and a tool that would not go down

From Ken, four reports in one message. Three are fixed here; the fourth is a
limit rather than a slip and is named at the end.

**A picture on the page a chapter opens on split the chapter in two.** The
room's rule is that a picture goes in *before the element the page opens with*
(§9a) — and on a chapter's opening page that element is the chapter's **first
paragraph**, because a `chapter_opening` is emitted by the **unit** and is not
a manuscript element at all. So the figure landed *between* the opening and
the words: the numeral kept its page alone, the picture took the next, and the
chapter's text began on the one after. Three pages doing the work of two, and
none of them what was asked for.

*Before the opening* cannot be said with a `beforeElementId`, so it is said
where the opening is made instead: **a page-figure standing at the head of a
unit is emitted before the chapter opens**. One branch, nothing stored, and
the figure keeps the chapter it is in — which is where §9l's rail puts it and
where a writer looks for it. Measured on a three-chapter novel: the picture
takes the page the chapter used to open on, and the chapter opens whole on the
next one.

**A page that only opens a chapter offered nothing.** Same cause from the
other end: `pagePlace` answers with a body block, a chapter opening is not
one, and the room greys its picture buttons on exactly that answer — so on
chapter one's own opening page every button was dead with nothing saying why
(*it just did nothing*). The chapter's **first element** is the answer, on
that page or the next, and putting a figure before it now puts it before the
opening.

**The drawing tool would not go down.** `finish()` has five ways out and only
the successful one cleared `drawing` — so a press that drew nothing, or a box
dragged a few pixels wide, left the room armed. And while it is armed every
press on the spread returns *before* it selects anything, so the writer could
not choose a page or a picture, could not delete one, and had no way back if
the box that would have carried the ✗ was never made. It is the divide tools'
own idiom (addendum 21 §10): **the tool puts itself down when the act is
over**, whether or not it came off.

### The one that is a limit, not a slip

Ken's third screenshot: an illustration placed facing text in chapter one
left the facing page's text **cut short**, with white below it — *it should
fill that entire page to a sentence, then move the rest to the appropriate
page*.

Reproduced and measured. The page he chose opened with the **tail of a
paragraph that began on the page before**, so taking that paragraph to sit
after the picture emptied the foot of the previous page. But moving the
insertion point does not fix it: putting the picture after that paragraph
instead leaves the *next* page holding a two-line tail and a far bigger hole.
Both choices leave white, because **a full-page plate cannot interrupt a
paragraph** — `fillPage` ends the page when it meets a display block, and a
figure is an element between paragraphs rather than something a paragraph can
be split around.

What Ken is describing is what illustrated books actually do: the paragraph
runs to the foot of the page, the plate takes the next leaf, and the same
paragraph continues after it. Getting that means letting a display block fall
at a page boundary with the flow resuming past it — a change to the cutter
that moves **every plate in every illustrated book**, not only new ones. It is
its own piece of work and is not done here.

## 17c. Importing a back-matter page

From Ken: *for the appendix and the glossary and the index, you need an
option to import that as text or import that as a PDF and it'll just maintain
the formatting.*

The decision the module rests on is that **those are two different promises,
and they keep two different things**.

**Text becomes records.** The words come in as the page's own — a glossary's
terms, an appendix's paragraphs, an index's headings — and the book then sets
them in the book's face, at the book's size, with the book's running head over
them. What *maintain the formatting* means here is the **structure**: which
line is a term and which its definition, where a paragraph breaks, which entry
hangs under another. It cannot mean the source document's type, because that
type belongs to another book.

**A PDF becomes pages.** Read literally, and the only honest way to keep
somebody else's typesetting is to keep their pages — so a PDF comes in as art
pages, drawn once at print resolution exactly as §16a brings a barcode in. The
cost is real and is **said rather than discovered**: it is then a picture of a
glossary rather than a glossary — not re-set in this book's face, no running
head, not searchable, and it will not reflow in the eBook.

And the third thing, which is the one a writer would not think of:

**An imported index's page numbers are another book's.** Addendum 10 §3 is
that no page number is stored anywhere — this book's index is read off this
book's pagination every time, which is what makes it right after the writing
moves. So importing an index as **text keeps the headings and drops the
numbers**, and what arrives is a **worklist**: every heading the old index had,
with how many places in this manuscript mention it. It marks nothing, because
`findForIndex`'s own rule is that a search helps somebody mark and marks
nothing — filing every hit is a concordance, and which mentions matter is the
judgement that makes an index worth reading. **Done is read off the marks**, so
marking a passage strikes its row off with nothing run, and a heading this
manuscript never mentions is **said rather than hidden**, being the most useful
row on the list.

`packages/domain/src/back-matter-import.ts` is the module and
`readPdfPages` in `read-vector.ts` the reader — the same `drawPage` the
barcode uses, at 300 dpi rather than 600, because a whole leaf of type at 600
is megabytes per page and the file travels inside the project. Two functions
that turn a PDF page into a picture would be two answers to how sharp a page
is. Capped at `MAX_IMPORT_PAGES`.

Both ways are **two steps** — the file is read, what it would do is said, and
only then is there something to press — because what an import would do to a
page that already has words on it is exactly what a writer wants to know
first. It **adds and never overwrites** (§17a's rule), so a second press of the
same file changes nothing and an edited definition cannot be lost. Every line
read that became nothing is **accounted for on the screen**, which is §4's own
rule: a file that half arrived without saying so is the one outcome an
importer may not have.

Driving it caught a collision the tests found first and the screen would have
kept: the import's dismiss button said **Cancel**, and the dialog's own footer
already owns that word for *put the whole page back as it was*. It says
**Forget that file**, which is what it does.

## 17d. Leaving the back of a page blank

From Ken: *on the title page, there needs to be an option to leave the back of
the page blank, because it could be a printed page on different paper.*

**The mechanism was already there one level down** — §9i put `bookBackBlank`
on a manuscript element so a picture could leave its back blank — so this is
the same question asked of a **part**, and `backBlank` on the part is the whole
of the data. No migration: parts live in `settings.book.parts`.

Two rules carry it, both already written. **The back of a leaf is its other
side** (§9j, Ken's own correction), so the page takes a **recto** and the
`blank` block that follows really is behind it rather than being the next page
along. And the blank is `display` so it takes a page, `folio: false` so it
prints no number, and **counted**, because counting is what the cutter does to
everything.

It is **absent on a page that flows** — a contents page, an index — there
being no single back to leave; `partTakesBlankBack` is `partPlacement`'s own
predicate rather than a second list of kinds. The default is false, so the
whole suite passed unedited, which is the proof that no existing book moves.

One thing had to be **unsaid**: the title page's panel stated *The copyright
page goes on its back* as a fixed convention, and it is now a choice. And
driving it found the wording that replaced it was wrong too — a copyright page
is a **verso**, so blanking the title page's back sends it to the next
**left-hand** page, two leaves on, with a second blank falling out of the
pagination. One block is inserted and the convention does the rest; the screen
says *the next left-hand page* because of it, and a test pins the pair so the
second blank is not later "fixed" as a fault.

### Deliberately not built

The **file importers** of §2 — BibTeX, RIS, CSL-JSON, CSV/TSV/XLSX, a
two-column .docx table, an index with static page numbers and its *Match
them to tags* — are their own stage, and a large one. So is the **QR code**
at export, the **preview chapter** taken from another project, and the
**two-column index**, which is a change to the *cutter* (the measurement and
the lines per page both halve) rather than a declaration: `columns` was
built as a field, found to be read by nothing, and taken out rather than
left as a control that lies.

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
