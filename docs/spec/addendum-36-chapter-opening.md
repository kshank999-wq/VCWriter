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

**No heading over it.** A line reading *In this chapter* would be words this
program wrote into somebody's book, which is the one thing the chapter page
has never done — the number is derived and the heading, the epigraph and the
summary are the writer's. The epigraph and the summary are both there for
anybody who wants to say it in their own words. The list is set apart by its
type instead.

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
- **A heading over the list.** Covered in §3: the epigraph and the summary are
  where a writer says *In this chapter* in their own words.
- **Page numbers against each line.** Covered in §3, and they would be a
  second table of contents besides.
