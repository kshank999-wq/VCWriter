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

## 8. Driven on a novel

From Ken, the day it shipped: *let's test the import with a novel.* A
manuscript was built to be the thing a writer actually hands over — a title
page, a byline, ten chapters divided four different ways (a styled heading,
*Chapter Two* as plain centred text, a bare Roman numeral, a page break with
a short line in capitals), a scene break, an illustration, a passage set in
another face, and **a typed page number at the foot of every page**. It found
three faults, and the first two were one fault counted twice.

**A byline is rarely the bare word *by*.** The reader has dropped a byline
near the top since the Word importer was built, and it matched `^by …` alone —
so *a novel by K. Shank*, which is what a title page usually says, was left
standing. On a novel the first thing in the document is a chapter, so the
front matter **became chapter one**: *Chapter One: The Road* arrived as chapter
two, and every chapter after it printed one too high. What may stand in front
of *by* is now a short closed list of the words a title page carries, because
*she had been working by the light of one lamp* is a sentence and not a
byline — which a test says.

**Nothing stored may claim a derived number.** The timeline drew the fault
twice over on two rows an inch apart: the markers row said **CHAPTER 1 · THE
ROAD** and the chapters row under it said **Chapter 2**. The second comes from
`sequenceLabel`, a positional `Chapter ${index + 1}` the importer wrote on
every unit — addendum 16 §15's own argument (*a writer could have typed 7
against the fourth section and the book would print both answers*) arriving
from the importer rather than from a box. A screenplay's scene number is a
real convention that nothing derives, so `Sc. 4` is still written down; a
chapter's is read off where the chapter falls, so none is. Only a **new**
import changes; nothing is migrated.

**And a chapter is named once.** The marker carried `chapterName`'s *The
Road* while the unit kept the raw *Chapter One: The Road*, so the same two
rows disagreed about the name as well as the number. The unit takes the
marker's string now, and a chapter named only *Chapter Two* reads as
**Untitled** — which it is, its number being the whole of its name.

**And the list clipped.** `.import-list` carried `max-height: 168px` over a
list the component already stops at twelve rows, so a novel of ten chapters
drew eight and put the last two behind an overlay scrollbar that paints
nothing until the pointer is inside the box — addendum 19 §10 and 25 §4g in
the one place it costs most, the screen a writer uses to decide whether the
reader found their chapters. **The cap is the limit, not a scrollbar.**

What was right and is worth recording: each mark divides the document on its
own (5, 7, 3 and 2 chapters for a heading, the word Chapter, a numeral and a
page break; 10 with all four), the twenty typed page numbers are dropped and
**said**, the illustration comes in, the face and size of the set-apart
passage are kept, and each chapter arrives as one passage.

## 9. The part of the program that was no longer there

From Ken, on the deployed site: *when I go to VC Writer and import, and I go
to import a collection of short stories, I get an error that says failed to
fetch dynamically imported module. I tried to import a Word doc .docx.*

Nothing was wrong with the import. The Word reader is fetched when it is first
needed — `await import('../read-docx')`, which Vite emits as a chunk named by a
**hash of its contents** — and a deployment replaces every chunk, so a page
that has been open since before the last one asks for a file that is no longer
on the server. Ken's tab had been open across a deployment, and pressing Import
was simply the first thing in that tab that needed a part of the program it had
not already loaded.

**It could not be seen from inside one build**, which is why every test passed
and why driving it found nothing: there is no stale page until there is a
*second* deployment. So it was reproduced by serving two builds in turn —
`out/preview` and a second build of the same source, as two production
deployments — opening the page against the first, swapping, and then choosing a
`.docx`. It answered, word for word, *Failed to fetch dynamically imported
module: /preview/assets/read-docx-BKO8tlPd.js*, which is a chunk name said to
somebody who has just chosen a file. The deployed chunk was then checked
directly and is fine: 200, `application/javascript`, the right bytes. Nothing
is broken in the build, the copy or the gate — a thing that existed stopped
existing, which is the one failure a content hash guarantees.

The answer is in two halves, and **the second is the one that fixes Ken's
report**.

**A split has to buy something.** `read-docx` is 2.8 kB against a 1.2 MB
bundle, so splitting it bought nothing measurable and cost a failure a writer
cannot act on — it is a plain import now, in all four places that read a Word
document, and a Word document needs no network at all. **pdf.js is a megabyte
and a half** and most sittings never want it, so that one stays split and the
failure has to be **said rather than thrown**: `late-module.ts` is the one
place, `STALE_PAGE_REFUSAL` the one sentence, and it names the usual cause and
the whole of the fix — *Part of the program could not be loaded. VC Writer was
most likely updated after this page was opened. Reload the page and try again.*
It says *most likely* because a dropped connection reads the same from here and
*reload* is the right move either way. `late` wraps the `import()` **and
nothing else**, which is what makes that reading honest: the modules behind it
do no work at load, so anything that comes out of it is the fetch rather than
the module. The browser's own wording goes to the console, where a chunk name
is of use to somebody.

**A reader loaded late again would look exactly like this never having been
fixed**, so it is asserted off the source rather than remembered: the test
walks every renderer file and refuses `import('…read-docx')` anywhere, and
refuses a bare `await import(` outside `late` — addendum 31 §4's and 32 §9's
idiom, both of which fail by being *absent*. Driven again across the same two
deployments: the two stories come in on a stale page (3 sections, 12
paragraphs, in order) and a PDF chosen on that same page says the sentence.

**Named rather than built**: the preview's build label carries a timestamp and
rides in the main chunk, so **every deployment rotates every hash even when
nothing changed**, which makes the window this happens in as wide as it can be.
Narrowing it means putting the label somewhere the application reads at runtime,
which is a second fetch to save a reload; the refusal is the better answer, and
a deployment that really does change the reader rotates its hash whatever is
done about the label.
