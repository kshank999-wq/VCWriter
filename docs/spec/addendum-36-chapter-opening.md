# Addendum 36 — What the chapter covers

From Ken:

> Also, for the instructional book, there can be for each chapter a title page
> that allows you to outline what's in the chapter and add text such as what
> you'll be covering and that type of thing. So we need an opening

Then, the next day: *do the chapter opening page*.

Two clauses, and the audit answered one of them outright.

---

## 1. Measured first

Driven in the real preview at 1440×900 on a fresh **Instructional book**, with
a chapter *Light* planned in the Outliner over three sections and put on the
track, then *File ▸ Chapter page…*:

| Ken's clause | What was there |
| --- | --- |
| *add text such as what you'll be covering* | **Built.** *What this chapter covers* — `page.summary`, addendum 19 §7 — a five-row box on this very dialog, printed under the heading, with its own size and weight in the book's settings and a suggested summary beside it. |
| *outline what's in the chapter* | **Nothing.** No control, no field, and nothing in `ChapterPageContent` that could carry one. |

So this is not a route problem — the thing the route leads to was half built.
`ChapterPageContent` carried the number, the name, the epigraph, the summary,
the picture, the template, the placement and the layout, and had no way at all
to say what the chapter is made of.

## 2. The audit pays a thirty-second time

It paid in three places at once, and the third is the one worth keeping.

**The numbers exist.** `structureNumbers` has numbered a textbook 1, 1.1,
1.1.1 with nothing stored since addendum 16 §15, and `divisionSpan` has said
which units a chapter covers since addendum 19 §1.

**The list exists.** The **contents page** has listed the sections under each
chapter since addendum 19 §2 — `ContentsEntry.sections`, built in
`pagination.ts` off that same `structureNumbers`. So the question *what is in
chapter one* already had an answer in this program; it simply could not be
asked from the chapter's own page.

**And the place to put it exists.** Addendum 20 §14 made a chapter opening **a
list of slots that the print walks**, with its own stated promise that *adding
a layout needs only a new entry* and no `if (layout === …)` anywhere. The same
is true one level down: adding a *piece* of a chapter opening is an entry in
`CHAPTER_SLOTS` and one case in `slotMarkup`. Nine layouts got it without being
touched.

## 3. What it is

`chapterContents(file, markerId)` in `chapter-style.ts` — the units under the
chapter, with the number each one prints.

**Nothing is stored and there is nowhere to type one.** This is the seventh
time a fact about the work is a reading here rather than a column, and the
three things that fall out of it are the whole feature: renaming a section
renames the line, dragging section four above section two renumbers the list,
and dragging a section out of the chapter altogether takes it off the list —
each with nothing run. A stored list would be right on the day it was written
and wrong from the first edit, which on a page a reader trusts is worse than
having none.

**It is the contents page's own list, narrowed to one chapter.** The same
units, read through the same `structureNumbers`, because a reader who finds
the front of the book and the front of the chapter disagreeing about what is
in it has found a fault. What it does **not** carry is the page number, and
the absence is a decision rather than an omission: a chapter leaf is a block
that goes *into* the laying, so what page 1.2 falls on is not known when the
leaf is built — and a chapter opening that printed page numbers would be the
table of contents said over again at the head of every chapter.

**Sections and never subsections.** One level down is what a chapter opening
lists; two is the whole table of contents, printed nine times.

**No heading over it** — *overruled by Ken the same day; see §10.* The
argument was that a line reading *In this chapter* would be words this program
wrote into somebody's book, which is the one thing the chapter page has never
done. It was right about the words and wrong to conclude there should be no
line.

## 4. Whose decision it is

**The book's, and never one chapter's.** This is `firstLine`'s own argument,
written down when the drop cap was built: *a convention rather than a decision
about one page — a book where chapter four alone has a drop cap has a mistake
in it*. A book where chapter four alone lists what it covers is the same
mistake, and the practical half matters as much: a thirty-chapter textbook
needs one press, not thirty.

So `showContents` is on `ChapterPageStyle` and there is **no per-chapter
field** to disagree with it — a test asserts the marker's page carries
neither.

**Off by default**, because a chapter page that already prints is one somebody
asked for before there was a list to put on it (§7a's rule). The proof is that
the whole domain suite — 3,041 tests at the time — passed with **no assertion
edited**.

**Absent where the book does not number its sections**, which is
`numbersDivisions` and so covers both halves at once: a format with no numbered
sections, and a book whose numbering the writer has switched off. A switch that
can only do nothing is one a writer never trusts again.

## 5. How it is set

A contents line is **a line of type**, so it is a `LineStyle` beside the
number, the name, the epigraph and the summary rather than a vocabulary of its
own — §7a's running heads for the fourth time. Size, case, weight, slope,
alignment and face, at 10 pt by default: smaller than the summary, a list
being furniture under prose. It takes the **reading face** for the summary's
own reason — a list of section names is read, not looked at.

## 6. Where the control stands, which driving corrected

The first draft put the switch in *How every chapter page is set*, beside the
other things that are the book's. Measured in the real room it sat at
**y = 2104 in a dialog 2,662 px tall** — a thousand pixels below the fold,
behind a scroll nothing announces. That is §15c's fault and §7b's, in the one
dialog Ken's whole ask is about.

It stands in the page's own fields now, at **y = 650**, in **the order the page
prints**: the number, the name, the epigraph, the summary, then this. That
ordering is the dialog's own and is the clearest rule available — a writer
reads down the controls and down the page in the same sequence.

Its **value is still the book's**, which the note says in one clause (*Every
chapter opening lists them, not this one alone*), and that clause is also the
answer to why one press is enough. Only the **type** stayed among the type,
which is the dialog's own split: content beside content, lines of type beside
lines of type.

The note names the sections rather than counting them — *This page would list
3 sections: 1.1 What light is, 1.2 Reflection, 1.3 Refraction* — because
*lists 3 sections* says nothing about whether they are the three the writer
meant. `trackRemoval`'s shape.

## 7. It is the leaf's and not every opening's

The slot walk runs on `block.leaf`, so the list appears on a chapter that
**opens on a page of its own** and not on one that opens above its first
paragraph. Nothing was written to make that true — Ken asked for a *title
page*, and a chapter that runs straight on from the last one has no page to
put a list on.

## 8. Driven

At 1440×900 in the real preview, on *Mathematics*, an instructional book with
chapter *Light* over 1.1 *What light is*, 1.2 *Reflection* and 1.3
*Refraction*:

- the switch reads **List what each chapter covers** at y = 650, with its
  sentence naming all three sections at `rgb(163, 148, 111)`;
- ticking it draws the three lines on the sheet beside it at once;
- six type controls appear with it and not before it;
- and in the **Layout room**, on the chapter's own laid page: `CHAPTER 1`,
  *Light*, the summary, then the list at 10 pt in the book's reading face —
  which is the page Ken asked for.

## 9. Named rather than built

- **A chapter with more sections than fit the page.** The leaf is a `display`
  block that takes a whole page and is not measured against it, so a very long
  list would be clipped — which is exactly as true of a very long summary, and
  has been since addendum 19 §7. It is the chapter leaf's behaviour rather
  than this list's, and the sheet beside the control shows it.
- **Page numbers against each line.** Covered in §3, and they would be a
  second table of contents besides.
- **The list with no heading at all.** Clearing the box gives the format's own
  words back, which is `settings.titlePage`'s shape and avoids two states that
  look alike — an empty box that printed nothing and an empty box that printed
  *In this chapter* are indistinguishable to look at. Nobody has asked for the
  list bare; if it is wanted, that is a tick and a line to say.

---

## 10. The heading, after all

From Ken, the same day §1–§9 shipped:

> add the "In this chapter" heading

**§3 was right about the words and wrong about the line.** Its argument — that
*In this chapter* would be words this program wrote into somebody's book — is
the rule this room keeps everywhere else (addendum 20 §17a: *it never writes a
definition*). What it did not ask is whether the words have to be the
program's. They do not.

**So the line is the writer's.** `contentsWords` on `ChapterPageStyle` is a box
they type in, and **empty means the format's own** — `settings.titlePage`'s
shape, so a book that lists gets *In this chapter* without anybody typing it,
and a writer who wants *What you will cover* types that. The objection stops
being an objection the moment the sentence is theirs rather than ours, which is
a better outcome than either the refusal or a fixed string would have been.

Three things follow.

**Nothing names a unit itself** (addendum 16 §6c): `defaultContentsHeading`
reads `nounsFor`, so it is *In this chapter* where the division is a chapter.

**It is a reading, not a value in a field.** `chapterContentsHeading` is the
one function the print, the sheet and the eBook ask, and the **placeholder** is
where the default is shown on the screen — a box that handed the default back
as its `value` would read as something somebody typed, append to it on the
first keystroke, and give it straight back when cleared (addendum 20 §16e).

**A list is two lines of type**, which is §18's own pair said of the contents
page one room over: `contentsHead` is a `LineStyle` beside `contents`, in small
caps by default because that is what books set this line in. Not a second
vocabulary, and not furniture the writer cannot reach.

**The heading and the list are one block.** The list is shrink-to-fit and
centred on the page while its entries range left inside it, so a heading
standing as its sibling would centre on the *page* rather than over the *list*.
`.bk-chapter-contents-block` holds both, which is also what lets the pair widen
together: driven, *In this chapter* gives a block of 82 px and *What you will
cover in this chapter* gives 154 px, both one line, both with the heading's
left edge exactly on the numbers'.

In the eBook it is a **paragraph rather than an `<h2>`**: a reading system
builds its navigation from the headings, and *In this chapter* is not a
division of the book.

Driven on the laid page: `IN THIS CHAPTER` in small caps at 10 pt with 8/100 em
of tracking, 20 px over the list.

---

## 11. The heading follows the title

From Ken, straight after §10:

> make the heading alignment match the chapter title

**§10 ranged it left, and that made it the odd line out.** The epigraph has
inherited the page's alignment since it was written, and the page's alignment
*is* the chapter title's — so the heading was the one line on the leaf that
chose a direction of its own. The rule it should have followed was already
there: a heading is **a label like the title above it**, where the **summary**
below it is reading matter and a centred paragraph is wrong. The entries keep
their own left, a list of numbered rows being a list rather than a line of type
over one.

The fix is one word in two stylesheets — the fallback under
`--chapter-contentsHead-align` is `inherit` rather than `left` — because
`lineStyleVars` emits nothing where a line has no alignment of its own (§18),
so what the stylesheet falls back to *is* what null means. The writer's own
override is untouched and its first option still reads *The page's*.

### What driving it caught

**The sheet and the printed page disagreed about where the list sits**, which
is the one thing `ChapterLeaf` exists not to do. The printed leaf is a centred
flex column and the dialog's sheet is an ordinary block, so a block left to
find its own width came out shrink-to-fit in the book and full measure on the
sheet. `width: max-content` is said on the block now, so neither depends on its
parent's layout mode.

**And `max-content` overflows rather than wrapping.** With long section names
the block ran past the narrow sheet, and an overflowing box cannot be centred
by `auto` margins: measured, the title's centre was 1153 and the heading's
1186 — **33 px out on the sheet while the printed page was exact**, which is
precisely the shape of fault a preview is supposed to make visible rather than
commit. `max-width: min(34em, 100%)` clamps it to the room there is, after
which both surfaces measure the same: sheet 1153 and 1153, page 1133 and 1133.
