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

## 9a. A page that has outlived its deployment says so

Ken sent §9's report back **word for word**, which in this project has meant one
thing seven times now. The audit was paid first and found nothing left to fix in
the import: the deployed bundle was confirmed byte for byte the fixed one (its
`read-pdf` chunk was rebuilt locally from the deployment's own label and fetched
at that exact hash — 200, and it imports the fixed `main`), **no Word-reader
chunk exists in it at all**, no dynamic import of that reader survives anywhere
in the renderer, and the site's one service worker is scoped to `/notes/app` and
cannot touch `/preview`, so a reload really does reach the new build.

So §9 was right about the fault and **wrong about where it stopped**. It ended
by telling Ken to reload — and that is an instruction rather than a fix, which
is addendum 29 §2's lesson exactly: *a question about whether the feature is
finished is not the writer's to answer*. The sentence `late` says is honest and
arrives **after** a writer has chosen a file and been turned away. What was
missing is the half that arrives before they press anything.

`use-build-standing.ts` is that half. **It measures rather than guesses**: the
page asks for its own entry script, the one file it is certain the deployment it
came from had, and a flat refusal is the answer — no build id, no version
endpoint, nothing stored, nothing on the server to keep in step. **It asks when
the window is returned to**, which is the moment a writer is about to act and
the one moment a request costs nothing anybody notices; a timer would ask while
they type, and Ken's own case *is* coming back to the tab. Three refusals keep
it from crying wolf, because a notice that is wrong once is one nobody reads on
the day it is right: **only a 404 or a 410 counts** (a 500, a timeout or no
network at all is the page failing to ask — addendum 32 §8's *being unable to
ask is not a lapse*), **it says nothing where the page came off a disk** (the
desktop's renderer is on the machine, and a file on the machine has no
deployment to move on), and **it asks at most once a minute** however often the
window is switched to.

`StaleBuildNotice` wears `WritingNotice`'s bar for its reason — one bar for
every message in the window, so only what it *means* differs — and **the button
is the act**. Reloading needs nothing done first, the project having flushed on
`beforeunload` since it was written. It may be dismissed, this being news rather
than a refusal: nothing has stopped working. `.writing-notice-acts` became
**`.notice-acts`**, a layout named for the lapse being one the next bar copies
rather than wears.

Driven across two deployments of the fixed source: a fresh page carries no bar;
a deployment lands, the window is returned to, and a 47px `status` bar appears
at the top of a 1440 window; Reload lands on the new entry chunk and the bar is
gone; and the collection import that started all this reads the Word document on
the page it landed on — 3 sections, 12 paragraphs, no alert. The surfaces test
is §9's missing one in addendum 29 §2's shape: **every window that carries the
lapse bar must carry this one**, so a third window added later fails there
rather than shipping silent.

## 10. The import that erased a finished story

From Ken, and it is the worst report this project has had:

> I just finished editing and adding pictures and everything to a story and
> fixing it all and then when I went to import another one that's part of the
> same book and collection instead of adding it at the end it erased
> everything I did and all my work is gone. So if you select collection, and
> you bring in one story, there needs to be a button for next story. And when
> you add it, it adds it onto the end.

### What happened, read rather than guessed

`adoptImport` called `project.replace`, which is the **cloud merge's** door:
it takes a whole document and **keeps the path**. So a second book imported
with one open was written into the open project's own file. Three things then
made it final rather than merely wrong:

- **Nothing asked.** The chooser's heading says *A new project*, which was
  true of the document and not of the file it landed in.
- **Nothing could take it back.** `replace` calls `forget()`, and it is right
  to — a merge from the cloud is not this writer's act — so the undo stack
  went with the document it belonged to.
- **Nothing had a copy.** The desktop keeps rolling snapshots beside the
  project; the preview, which is the build Ken uses, answers `listSnapshots`
  with `ok([])`. Addendum 09 §15's own lesson, and here it is not a feature
  reading as unbuilt but the **safety net not being there**.

### A new project is a project

`createProject` takes a document now — one optional field in the preload type,
the main handler and the browser bridge — and `project.createFrom` goes
through `runOpen`, which **flushes what is open first** and then adopts what
comes back. So the project in front of the writer is saved and left exactly
where it is, and the document that arrived gets a file of its own, named after
its own title, in the folder a new project goes in (addendum 34).

It fixes a second case nobody had reported: an import from the **welcome
screen** called `replace` with no path at all, so the autosave had nowhere to
write and the project existed in memory and nowhere else.

The chooser says it, once, under the heading rather than on four rows
(addendum 20 §9k): *The project you have open is saved and stays as it is.
This one opens in a file of its own.*

And `addImported` refuses what it cannot be sure of: `update` writes what it
is given into whatever is open, so an append arriving while the window still
stood in the project before it would write a second book over the first.
**An append that would land on another project changes nothing at all.**

### The next story, from the same dialog

*More stories* and *More episodes* had a dialog of their own — 236 lines that
read a document, listed what it found, and had **none of the controls this one
grew**: no marks, no passage split, nothing to say where a story divides. Two
screens that import a story are two answers to what an import is, and Ken
asked for *the same formatting dialog box*. There is one now, and the kind
says where it lands.

So the round is the same code path the second file of a multi-file import
already took. After a landing on a format made of parts the dialog **stays
up** and says what is in and how many the collection now holds, with *Import
another story…* beside *Done*. The next document is appended to what the last
round made.

Three decisions.

**What has landed is held by the workspace, not by the dialog.** The first
landing turns a window with no project into one with a project, which is a
different tree — React unmounts the dialog and builds it again between the
rounds, so state kept there is lost exactly where *Import another* is pressed.

**Another round waits for the project to be open.** Making a project is the
host's work and takes a moment; an append sent before the window is standing
in it would be written over the project still open, which is the fault this
section exists to remove. It is refused rather than raced.

**What landed is named off the project, not off the files.** Driving it, a
document whose own title made the story *The Harbour* was announced as
**ken-harbour** — the file it came out of — an inch from a rail that said
otherwise.

### Driven

At 1440×900 in the preview. A collection imported from one document: the
dialog stays up reading *The Harbour is in. 1 story in the collection now.*;
a second document through *Import another story…* gives *In For A Pound is in.
2 stories in the collection now.* and the Layout rail lists both. Then the act
that lost the work: with that collection open, *Import…* ▸ *A novel* makes
**The Lamp and the Lighthouse** and opens it — and the browser's own library
then holds **both** projects, the collection still carrying its story.

Looking at it caught two wordings: *2 storys*, which is what `${noun}s`
gives, and the file name standing where the story's name belongs.

### Deliberately not built

**Snapshots in the preview.** The browser bridge answers `listSnapshots` with
nothing, so a browser has no copy of a project before a destructive act. The
cause of this report is gone, and the net is not there; it is named here
rather than half-built, and it is the next thing this file should grow.

## 11. The numerals, and a name typed once

From Ken in the same message:

> I merged two sections and made it one chapter. I would like it to
> automatically update the title headings if they're Roman numerals. And
> currently, in the actual passage, you have to rename it in the heading. If
> you rename it in the chapter portion, it should rename that heading also.
> So you don't have to go to do it in two places.

A story imported from a manuscript is divided at its numerals (§10 of addendum
21), and those numerals arrive as **heading elements in the writing**, which is
right: they are what the document said. The cost is that the book then holds a
stored copy of something derived — *which chapter this is* — and the unit's
title and the heading it opens with are two strings nothing kept in step.

`section-numbers.ts` is two rules.

**A bare numeral is the program's counting and is kept in step.** Nothing else
is: a heading with words in it is the writer's, and renumbering *The
Lighthouse* would be this program rewriting somebody's manuscript, which
Layout's own rule forbids outright. The style is **read back off what is
there** — roman or arabic, capitals or not, the full stop or not — so a book
set in lower-case roman stays in lower-case roman and nothing here decides
what a numeral looks like. The count restarts at each division, which is
`divisionSpan`'s rule read over units: chapter one of the second story is
chapter one.

It runs at the two acts that change how many chapters a division has — a merge
and a removal — rather than being offered as a command, because *automatically*
was the ask and a button here would be a second thing to remember.

**A name is typed once.** Renaming a chapter renames the heading it opens
with, **where the two were saying the same thing**; where the writer has made
them differ, both are theirs and neither is touched, and where a unit has no
heading there is nothing to keep in step (§9l already stands the title in on
the page). It lives in `updateUnit` beside `retitlePlans` for that function's
own stated reason — *rename it in either place and it is renamed in both* — so
every surface that renames a chapter gets it without being told, and no screen
has to remember a second call.

`sectionLabel` is named that because `labelFor` is the Writers Room's: the
sixth name this project has stepped around, and the second the compiler caught
rather than a reader.

### Driven

On an imported collection at 1440×900: the chapter's Title in the Inspector
read *The Harbour*, typing *The Lighthouse* changed the heading in the
manuscript beside it, and the chapters headed I, II and III were untouched.

## 12. The recovery points the preview did not keep

From Ken, after §10: *do the preview saved snapshots.*

§10 found the cause of the lost story and named what it did not fix — the
desktop keeps rolling copies beside every project (spec §15, *no manuscript
data loss*) and the browser preview answered `listSnapshots` with `ok([])`
and `restoreSnapshot` with *not available here*. That is addendum 09 §15's
shape for the third time, and the worst instance of it: not a feature reading
as unbuilt, but **the safety net not being there** on the one build Ken uses.

### The caller was asking all along

`useProject` has set `snapshot: true` on every twentieth save since autosave
was written, and the browser bridge took the flag and did nothing with it. So
the work is not a mechanism, it is the other end of one that already runs.

### One rule about throwing a copy away

The moment there are two hosts keeping recovery points, **which of them may
be pruned has to live in one place**: it is the only part of this whose
mistakes are invisible until somebody goes looking for the copy that is no
longer there. `snapshots.ts` in the domain holds it — `IRREPLACEABLE` (a
pre-upgrade file and the state a merge overwrote exist nowhere else, so a
rolling autosave must never push one out) and `snapshotsToDrop`, a reading
over the list. The desktop's `pruneSnapshots` wrote that out by hand and asks
it now, with its own suite unedited and green, which is the proof the two
agree.

**What is not shared is how much room there is.** A disk shrugs at thirty
copies of a book; a browser's quota is shared with every other site and a
project carrying pictures runs to megabytes, so the preview also passes a
**budget in bytes** — a limit the desktop has no use for and does not pass.
The newest point is never dropped by the budget: a copy too big for the whole
of it is still the one a writer wants, and dropping it to satisfy arithmetic
would be the module deleting the only thing it has in order to stay tidy.

`RecoveryReason` is named that because **`SnapshotReason` is taken** — by
`entities/revision.ts`, whose `snapshots` collection sits inside every project
document and which nothing has ever written, a recovery point being a copy
beside a project rather than a row inside it. Its vocabulary is not this one
either, so merging them would rename what is already on writers' disks. The
seventh name this project has stepped around.

### What the preview keeps

A second object store in the same database, at version 2 — the upgrade **adds
a store and touches no project**, so a browser that has been writing here for
months opens with everything it had, which a test pins by seeding a version-1
database and opening it.

A point holds **the bytes rather than the object**, which is what the desktop
keeps and what makes one written by an older build readable by this one: it is
parsed on the way back out like any file.

Three rules carry the writing of one.

**A recovery point must never cost somebody their save.** The quota is the
browser's and it may refuse at any moment, so the write is tried, pruned
against, tried once more, and if it still will not go the project is saved and
nothing is said — a notice about the net while the work itself landed would be
a fault report about something that did not fail.

**Pruning runs after the new point is in**, not before: making room first
would drop a copy that is still the best one there is if the write then fails.

**Restoring is itself reversible** (spec §19): what the writer has now is kept
first, so a restore chosen in a hurry is one more row on the same list rather
than the second thing lost in a morning.

Two more, each one line. A point is taken **before a format upgrade rewrites
anything**, which is the desktop's own reading of the version the bytes
declare. And deleting a project **takes its points with it** — keeping them
would make the row's own sentence (*this cannot be undone in a browser*)
untrue and leave copies nothing could reach, the Recovery page needing an open
project to list any.

### What the page says, on each host

`describeRecoveryPoints` is one copy of the promise, read off the path
(`describePhoneShelf`'s rule). On a disk the points sit beside the project and
a sync that had conflicts leaves one. In a browser there is no sync, and **the
copies are in that browser**: clearing the site's data takes them, and a copy
saved to a disk is the one that outlives it. That is the `browser://` of
addendum 29 §1 — said rather than hidden — about the one thing somebody
relying on this net has to know.

And **looking at it caught the other half**: the page opened on *Overwritten
by a sync — nothing has been overwritten*, a heading standing above the thing
the writer came for, on a host that has no sync and never will. Absent there
now; it stands on the desktop, where a conflict is a real thing and this is
where it appears.

### Driven

In the real preview at 1440×900: a save asking for a point leaves one
(*Autosave · 7 KB*), the page lists it under the browser's own sentence with
no sync section above it, and pressing **Restore** on it brought *The Lamp*
and its logline back from a document that had been wrecked and saved over —
with the wrecked state then on the list as a manual point, which restored in
turn.

### Still not done

The preview keeps no copy **off this machine**. The net is a browser's own
storage, which a writer can clear and a private window never had; *Download
.vcw* is the only copy that leaves it, and that is a press somebody has to
remember. A scheduled export, or the cloud sync the desktop has, is the
answer and is named rather than half-built.
