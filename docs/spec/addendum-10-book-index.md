# Addendum 10 — The Book Index

Status: **built**. September 2026. From Ken's ask: chapter-break pages that
carry a graphic and other information, *"but it goes into an Index. So you
basically have your book index already done automatically as you add the
chapters, it goes ahead and adds those and the page number of where it's at.
And it automatically updates the page number if it shifts."*

Two of the three things in that sentence already existed, and saying which is
the whole reason this addendum is short.

## 1. What was already there, and what was actually missing

| What was asked for | State |
| --- | --- |
| A page between chapters carrying a graphic and other information | **Built** — the chapter leaf of addendum 02 §11: number, name, an image, an epigraph, a note |
| A list at the front that says where each chapter starts, kept right as the writing shifts | **Built** — the contents page, written after pagination from the pages that actually exist |
| A list at the **back**, of what the book is *about*, alphabetically, with page numbers | **This addendum** |

The first two are a contents page. The third is an index, and they are not the
same thing twice:

| | Contents | Index |
| --- | --- | --- |
| Lists | The divisions of the book | What the book is *about* |
| Ordered by | The order they happen in | The alphabet |
| Entries come from | The chapters, automatically | **The writer, one passage at a time** |
| Sits | At the front | At the back |

That last row is the one that matters, and §2 is why.

## 2. The decision the whole module rests on

**A mark is an anchor a writer places. It is never a search.**

The tempting build is: type a word, and every occurrence of it gets a page
number. That is a **concordance**, and no reader has ever wanted one. An index
is a piece of editorial judgement — *which* mentions of the lamp are worth
turning to, and what they are worth turning to *for* — and the writer's
judgement about that is the only thing that makes an index worth having.

So there is no *index every occurrence* anywhere in this module and there never
will be. `findForIndex` exists to help somebody mark, by showing the lines a
phrase appears in; it marks none of them.

Two corollaries the code holds to:

- **The heading is the writer's words, never the passage's.** A paragraph about
  a lens is filed under *lenses, Fresnel*. The dialog that files one therefore
  opens with an empty heading box rather than the line pre-filled.
- **A book has an index and a screenplay does not.** `hasBookIndex` is `novel`
  and `short_story` only — a series is a stack of scripts each numbering from
  its own page one (addendum 02 §17), so there is no single page 34 for an entry
  to point at, which is the same reason its contents page counts sheets instead.
  Everywhere this shows in the interface, the control is **absent rather than
  greyed**: a disabled line says *not yet*, and the true thing is that this
  format has no index at all.

## 3. The second decision: no page number is ever stored

**There is no page-number column anywhere in this module, and the absence is the
feature.**

Ken's requirement — *it automatically updates the page number if it shifts* —
is met by having nothing to update. A page is where something lands once the
book is laid out, so the index is computed from the pagination every time it is
drawn or printed. There is no *rebuild the index* command, no *refresh page
numbers* button and nowhere for a writer to type one, because there is nothing
stored that could go stale.

This is the same absence `usage_links` has (addendum 08 §2, migration 0039): a
column that could hold a stale answer is a column that eventually does.

What is stored is the anchor: a mark names a **manuscript element**, and the
paginator says what page that element landed on. Cut forty paragraphs into
chapter one and every entry after them moves by itself, with nothing running.

**One reading, not two.** The screen and the printed book both go through
`bookIndexOf`, which goes through the paginator's own walk (`elementPages`). A
second reading that worked the pages out its own way would be a second answer,
and a writer looking at two of them has no way to tell which the book will use.

## 4. What a mark is, and what a cross-reference is

Two tables, because they are different in kind: one is anchored to a passage and
one is a sentence about the index itself. One table with a nullable anchor and a
flag is the half-a-target muddle migration 0035 refused for comments, for the
same reason.

**`index_marks`** — a passage filed under a heading.

| Field | What it is |
| --- | --- |
| `term` | The heading. The writer's words. |
| `sub_term` | The sub-heading. Two levels, never three — three is where an index stops being readable. |
| `beat_id`, `element_id` | The anchor. No foreign key: a manuscript element lives inside a beat's JSON document, and every branch carries its own copy under the same id (as 0033, 0034 and 0035 before it). |
| `quote` | What the passage said when it was marked. **For reading, never for finding** — so a writer can recognise the mark later. |
| `principal` | A principal discussion, set bold in the printed index. |

**`index_refs`** — a *see* or a *see also* between headings. `see` redirects a
heading with no pages of its own; `see_also` sits after a heading's page
numbers. They print differently, so they are not one kind with a flag. Both ends
or neither: a cross-reference to nowhere wastes the reader's time, and one under
no heading cannot be shown at all.

Migration **0046**, with one select policy and three mutating ones per table
rather than a read policy and a `for all` — `for all` includes select, so the
pair is two permissive policies on every row of every read, which the
performance advisor flags, correctly.

## 5. How it prints

`collapseRuns` turns page numbers into runs the way an index does: `14–17`
rather than four numbers, with an en dash.

**A principal discussion never merges with a passing mention**, even when they
are adjacent. The bold is the only thing on the line distinguishing the two, and
`14–17` set half bold is not something type can do — so 14 bold and 15 plain
stay `14, 15`, which says the true thing.

`indexPages` breaks the index across pages by **counting lines rather than
measuring type**, which is what the rest of the paginator does and is as exact
as a monospaced page needs. A letter is never left alone at the foot of a page:
if its heading would be the last line it goes over with its first entry, because
a letter standing by itself at the bottom of a column is the one thing that
makes an index look broken. A letter that runs over says *L (continued)*.

The index pages are appended **after** the manuscript is numbered and **before**
the contents page is unshifted, so the contents' sheet numbers still count from
the front of the finished stack.

The printing carries an index when the format has one, something is in it, and
this printing was not told to leave it out (`includeBookIndex`, in Page Setup
and on the preview toolbar).

## 6. Marking a passage

Right-click a line of the manuscript and choose **Index this…** — the same
right-click the Character Creator uses (addendum 08 §7) and deliberately the
same shape, because it is the same act, *this passage is about that*, pointed at
the back of the book instead of at a person.

The dialog asks for a heading, optionally a sub-heading, and whether this is the
principal discussion. Headings already in the book are offered as you type,
which is the whole of what keeps an index from growing *lamp* and *Lamp* and
*the lamp*.

Two things differ from the Character Creator's dialog, and both are §2 arriving
in the interface:

- The heading box starts **empty** rather than pre-filled with the line.
- The passage is **shown rather than offered for editing**. The Character
  Creator lets it be rewritten because what is filed there is the writer's
  *reading* of the line; a quote here is what the page said.

No page number is asked for, and the line under the buttons says why.

## 7. The screen that manages it

**Editor ▸ Index…**, and the fourth tab of the Editors page — on a book only.

It is a reading of the marks, and the only writing it does is to the marks
themselves. Every number on it is worked out at the moment it is drawn.

Three things it shows that the printed index cannot:

- **The marks under a heading**, not merely its page numbers: unfiling something
  means pointing at a passage rather than at a number, and two marks routinely
  share a page.
- **Orphans** — marks whose passage has been cut. The printed index simply has
  one fewer number in it; here they are listed with what they used to say and
  struck through, because a mark that vanished silently is a writer wondering
  where their entry went. They are the writer's to refile or throw away, and
  nothing throws them away for them.
- **Renaming a heading everywhere at once**, which is the one bulk edit an index
  needs and the one a writer will certainly reach for: having filed forty
  passages under *lighthouse*, they decide it should be *lighthouses*. Doing it
  mark by mark is how an index ends up with both.

Cross-references are made here and nowhere else, because they are about the
index rather than about a passage.

## 8. Where the code is

| | |
| --- | --- |
| The schemas | `packages/domain/src/entities/book-index.ts` |
| The module | `packages/domain/src/book-index.ts` — marking, renaming, cross-references, runs, the reading, the printed pages |
| The pages | `packages/domain/src/pagination.ts` — `elementPages`, `bookIndexOf`, and the index pages at the back |
| The print | `packages/domain/src/print-html.ts` |
| The preview | `apps/desktop/src/renderer/components/Paper.tsx` |
| Marking | `apps/desktop/src/renderer/components/BeatBody.tsx` — `FileInIndex` |
| The screen | `apps/desktop/src/renderer/components/IndexPanel.tsx` |
| The table | `packages/supabase/migrations/0046_book_index.sql` |
| Sync | `sync-mapping.ts` — `indexMarks`, `indexRefs` |

## 9. What is deliberately not here

- **Indexing every occurrence of a word.** §2. It would be a concordance.
- **A third level of sub-heading.** Two is where an index stays readable.
- **An index in a screenplay or a series.** §2. There is no page for an entry
  to point at.
- **Page numbers in the database.** §3. There is nothing to keep up to date
  because there is nothing stored.
- **An automatic index of chapter titles.** That is the contents page, and it
  was already built. An index of the chapter names would be an alphabetical
  list of things the reader can already find at the front.
