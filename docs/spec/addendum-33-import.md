# Addendum 33 — Import

From Ken, in one message:

> So for VC writer import, I want to remove those two — import a script, add
> stories to a collection — from the files menu and just put *Import…* This
> will open a center dialog box that asks you what you're importing. So
> there'll be buttons that say import a script, import an instructional book,
> import a novel, import a collection of short stories, import notes, which
> will put notes into research for you to sort through. And each will be
> treated differently. So when you import a script, the pop-up window that you
> have now will come up. When you import a novel, it will import it and give
> you options on how to divide it up into chapters. Each chapter, if you're
> importing, will go into one long beat. Then you'll have to divide it up
> manually. If you're importing short story collection, then it will ask you to
> import one, then the next one, then the next one until you're finished and
> you'll click a button and it will divide each story up by its Roman numerals,
> but keep them separate. And in between, it will create the layout where you
> can reorder how the stories are. And then you can insert chapter pages, etc.
> in the layout. It'll also give you the ability to import graphics, which will
> be stored in the research section under media and graphics. And just be a
> much more robust import screen. That addresses everything you may need to
> import.

---

## 1. The audit

Paid a **twenty-eighth** time, and paid most of this.

| What he asks for | What was already there |
| --- | --- |
| *divide each story up by its Roman numerals, but keep them separate* | Addendum 22 §6 — a bare numeral opens a chapter inside a story, and `BARE_LABEL` is read by both the Word and the plain-text reader |
| *options on how to divide it up into chapters* | `opensChapter` has read exactly four signals since the Word importer was built |
| *each chapter will go into one long beat* | `materialiseScenes` has had the one-beat branch since it was written; the per-paragraph split was the other arm of the same `if` |
| *reorder how the stories are, insert chapter pages* | Addendum 20 §9a — the Layout rail drags parts and chapters and makes the pages |
| *import notes… into research for you to sort through* | `importFiles` and the Research importer, which already files notes **and** pictures |
| *import graphics* | Research ▸ Graphics, the library addendum 20 §9 made every prose format's |

So almost nothing here is a mechanism. What is new is **the question, asked
first** — and four places where asking it first made an existing default
wrong.

## 2. The question comes before the file

Every importer this program has had asked for the document first and the kind
of thing afterwards: a dialog headed **Import a script** with a *Format* select
two thirds of the way down it, opened by somebody bringing in a novel. That
order is backwards twice over — the title says the wrong thing before a word is
read, and the control that decides what will actually be made is the one nobody
looks at.

`packages/domain/src/import-plan.ts` is the list of answers.
`ImportChooser.tsx` draws them. It **names no screen**: each row is an
`ImportKind`, the workspace routes it, and a kind added to the list is a row
the day it is written.

What falls out of asking first is that **the format select is unnecessary on
every kind that already answered**. A novel, an instructional book and a
collection each name one format, so the control is **absent** on them; a script
is four formats and nothing said which, so that is the one place it stays.

### Two headings, because a row cannot carry the fact

The one question a writer has before pressing anything here is *is this going
to replace what I am looking at?* — and saying it on all eight rows is saying
it eight times. It is addendum 20 §9k's argument (*what a label says is the
one thing no row can*), so the rows stand under **A new project** and **Into
this project**, which are the writer's own two questions.

With nothing open the second group is **absent rather than greyed**, and the
reason is said in its place: *Notes, pictures and more stories go into a
project that is open. Open or start one first.*

And because the heading says it, **the rows do not**. From Ken, of the
graphics row: *just call it graphics.* He is right, and the reason is the
headings' own — *Into this project* stands once above all four, so *Graphics,
into the library* says it a second time, and **a label that repeats its
heading has nothing of its own to say**. The clause came off the other three
in the same change, one screen having one rule: **Notes**, **Graphics**,
**More stories**, **More episodes**. Where each actually goes moved into the
note under it, which is what a note is for.

### Only where it can land

`importChoices` offers more stories in a collection, more episodes in a series,
notes wherever there is a project — and **graphics only on a prose format**,
because Research ▸ Graphics is every book's and no script's. A row that routed
to a shelf the menu does not draw would leave a writer unable to get back to
what they had just imported.

## 3. Where the chapters fall

Ken asked for *options on how to divide it up into chapters*, and the honest
set of options is **the set of things the reader can actually see**:

| Mark | What it is |
| --- | --- |
| A heading | A line the document itself styles as a top-level heading |
| The word Chapter | *Chapter One*, *Chapter 7*, *Chapter 7: The Road* |
| A numeral on its own | *I*, *1*, *One* alone on its line — his Roman numerals |
| A new page | A page break whose first line is short, and centred or in capitals |

These are `opensChapter`'s four branches, each named for what a writer would
call it. `ALL_CHAPTER_MARKS` is the default **and is exactly what the reader
did before there was a choice**, which is why the whole import suite passed
unedited — the proof that nothing about an existing document moved.

**What each combination costs is read off the document rather than estimated.**
Turning a mark off re-reads the manuscript and the *Chapters* figure moves,
which is the only way a writer can tell a book whose numerals are chapters from
one whose numerals are page numbers. Driven on the real screen: 3 → 2 → 1 as
the marks go off, with the sentence under them tracking.

With every mark off the document **comes in whole**, and the sentence names the
way out rather than leaving a writer with one undivided chapter and no idea
what to do about it: *Nothing divides it, so the whole manuscript comes in as
one chapter. The Chapter tool on the manuscript bar divides it afterwards.*

Plain text asks only the two marks it can see. There are no styles and no page
breaks in a `.txt`, so `opensDivision` honours *the word Chapter* and *a
numeral on its own* and refuses to guess at the other two.

## 4. One long beat

From Ken: *each chapter, if you're importing, will go into one long beat. Then
you'll have to divide it up manually.*

This is the opposite of what a novel did. Addendum 21 §10 made **a beat of
every paragraph**, at his own earlier ask, and that is right for a short story
worked over scene by scene and wrong for a four-hundred-page manuscript
arriving as four hundred beats on a timeline nobody can read.

So it is **a per-format default rather than a change of mind**: `defaultSplit`
gives a novel and an instructional book one beat per chapter and keeps the
collection's paragraph beats, and the select beside it lets either be chosen.
Neither is a reading of the document — it is a decision about the timeline,
which is why it is stored nowhere.

## 5. A collection lands in Layout

His *in between, it will create the layout where you can reorder how the
stories are* is **a route rather than a feature**: the room has dragged the
parts into order and made the chapter pages since addendum 20 §9a, and somebody
who has just handed over nine documents has no way of knowing that is where the
order is set.

`landsInLayout` is the rule, **in the domain rather than in the component**, so
the sentence the dialog says before the press and the room that opens cannot
disagree — a screen promising Layout over a workspace that stays put is worse
than no sentence at all. It is a collection's alone: a novel and a book arrive
as one document whose order is the document's, so there is nothing there to
rearrange and the manuscript is what a writer wants to look at.

Driven: two stories imported, and the Layout rail opens listing *the-harbour*
and *in-for-a-pound* under **THE STORY**, each with a drag handle and a ×.

## 6. What driving it found

Four faults, every one of them this project's own lessons in a new place, and
none of them visible to 3,536 passing tests.

**A heading is not a place.** `summarise` reads `script.locations` off the
scene headings, which in a screenplay are sluglines and in a manuscript are the
chapters — so importing a novel drew **Where it happens** over *CHAPTER ONE*
and *CHAPTER THREE: THE ROAD*, each with *1 scene* beside it, **and filed all
three under Research ▸ Locations** as places that do not exist. An instructional
book escaped it only because its menu has no Locations folder at all, which is
an absence doing a job it was never asked to do. Prose files none now, and the
panel lists **The chapters** — which is the list a writer actually wants there,
being how they decide whether the reader found what they meant.

**Nothing names a unit itself** (addendum 16 §6c). Three literal *chapter*s
went into this feature and all three stood an inch from a figure that reads the
noun table, so a collection drew **3 Sections** over *3 chapters here*: one
count said two ways on one screen. `describeMarks` takes the format, the split
control reads `nounsFor`, and the explanation at the top names no unit at all.

**A mark is a sentence, not a switch on a bar.** The marks borrowed `.check`,
which is 10px tracked capitals, `nowrap` and gold once ticked — right over a
one-word label on a toolbar, and on this screen it drew A HEADING over A LINE
THE DOCUMENT ITSELF STYLES AS A TOP-LEVEL HEADING, in gold, with all four on by
default so the colour distinguished nothing either.

**A control promised below that was not below.** The waiting screen read *You
say where the chapters are below*, and the marks only exist once a file has
been read — addendum 10 §8's *a route is only a route where it exists*, in a
tense. It says *once it is read* now.

**And the capital is the mark.** `describeMarks` lowercased each label, so the
sentence read *divided at the word chapter*, which is a different claim from
*the word Chapter* and drops the one thing the reader is looking for.

## 7. What is deliberately absent

**A Media shelf.** Ken said *stored in the research section under media. And
graphics* — which is one place said twice. Pictures go to Research ▸ Graphics,
the library the Layout room places from, and a second shelf for pictures would
be a second answer to where a picture is. He settled it himself the next day:
*just call it graphics.*

**Nothing new reads a file.** Every kind goes through the readers that existed:
Final Draft, Word, PDF, plain text, and `importFiles` for notes and pictures.
*The kind decides what may be read, and the reader says so rather than only the
picker* — `accept` is a filter the file dialog applies and a renamed file walks
straight past, so a `.txt` offered as a script is refused in the reader.

**No route to Layout from a novel or a book.** It was considered and is not his
ask: those arrive as one document, and opening a room over a manuscript
somebody has just imported, to rearrange an order there is nothing to
rearrange, is a room nobody asked for.
