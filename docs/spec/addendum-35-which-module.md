# Addendum 35 — Which module you are in

From Ken, in one message with four asks in it:

> So I'm starting an instructional book, and I want for whenever you enter a
> module, whether it be screenwriting, episodic, short form, in the center, I
> want it to be titled, and it'll say novel, short story collection, etc., just
> so you know what module you're in. Also, when you open the novel writing, it
> starts in the outliner. I'd like it to start on the main page so it's not
> confusing. 2. In the notes section, where it says drop files anywhere on this
> page, that needs to be at in the top of the page. And on each file, there's a
> zero percent, and I'm not sure what that means.

Four asks, and the first two are both about **a writer not knowing where they
are** — one in space and one in sequence.

---

## 1. What the format is called

The whole program is built on the format. `nounsFor` has decided since addendum
16 §1 whether a unit is a Scene, a Chapter or a Section; `isProseFormat` decides
the keyboard and the page geometry; `hasChapterPages`, `hasBookIndex`,
`isCollection`, `holdsWholeWorks` and `isInteractive` each turn a screen into a
different screen. **One fact decides what every noun on the screen means, and
no screen printed it.**

The audit found that `nounsFor` says what a format calls its **parts** and that
nothing said what the format itself is called — so each screen that needed a
name wrote the list out, and **the two that print it on the desktop had already
drifted**:

| Screen | What it calls an instructional book |
| --- | --- |
| New project (the grid a writer chooses from) | *Instructional book* |
| Import… (the screen that brings one in) | *Instructional or textbook* |

The same project, two names, neither of them wrong and neither of them the
program's. `formatName` in `packages/domain/src/formats.ts` is the one table.

Two decisions:

**The name is the program's and the list is the screen's.** Which formats a
screen offers, and in what order, is that screen's own business — the importer
shows four for a script and three for a book, and the grid has a layout and a
line of prose per card saying what the format is *for*, which a table of names
has no way to know. So it is a **record rather than an array**, and nobody reads
an order out of it. Welcome keeps its order and its `about`; what it loses is
its own spelling of the name.

**Where the two differed the grid's wins**, that being where a writer learns
what their project is called: a name chosen on one screen and contradicted on
the next is the fault this removes.

And one thing the private lists had all got wrong in the same way. Every one of
them stopped at **eight** formats where `projectFormatSchema` has nine — `other`
exists, no screen offers it, and nothing stops a project arriving in it — so a
project carrying it would have found no name at all. It reads as *Other*, which
is what it is, rather than falling back to *Screenplay*, which would be a label
naming the wrong thing.

## 1a. The phone's name is a different question

There is a second vocabulary and it **stays**: `formatSpokenName` in
`capture-vocabulary.ts`, which is what somebody *says* on a walk and hears read
back. Nobody says *Series or episodic*, and Ken's own word for a textbook out
loud (addendum 09 §11) is *educational book*. Two questions — printing and
speaking — so two tables, and the rule is that **a surface reads one of them
rather than keeping a third**.

Which the phone's own project list was doing. Its table of eight carried a
comment saying it was *the same list `SPOKEN_FORMATS` offers out loud*, which is
a **claim rather than a reading** — the second answer this project removes
everywhere else, and it had already cost that screen two formats once (it held
six, so an educational book could be made there by voice and not by hand). So
`spokenFormatChoices()` is the list, `formatSpokenName` the words, and the
`startsHere` filter is in the domain where addendum 30 put it: **what may be
named is not what may be made**, a game being built elsewhere, while a project
already in that format still needs a word.

## 2. Said in the centre, in every room and on the title bar

`RoomFormat` is one component drawing one span, centred on the bar it stands in,
in the room's own small tracked capitals.

Where it goes is the half worth recording, and the reason is **addendum 29 §2's
finding**: *a room covers the menu bar*. Every popped-out and overlaid room —
Research, Layout, the Note Sorter, the Story Sculptor, the Outliner, the
narrative map — paints over the workspace's chrome, so a name standing only on
the title bar is invisible from exactly the places a writer goes to do the work.
Ken's sentence is *whenever you enter a module*, which is those, and he names
three of them.

What was there before is the plainer fault: the title bar carried the format in
the **hover on the project's name** — `short story`, `instructional`, the
schema's own spelling with the underscore turned into a space — said to whoever
happened to rest a pointer on the title. **A fact that decides every noun on the
screen may not live in a tooltip**, and the spelling in it was not a name any
screen had ever shown a writer. It is on the bar now and the hover is the title
alone.

Two smaller ones. It says the **format rather than the room**, every bar already
naming itself at the left — a bar repeating its own name in the middle would
answer a question nobody has (addendum 33 §1's *the fact said twice*). And it is
**absolutely positioned and `pointer-events: none`**, so it is centred on the
bar rather than on whatever happens to be left of it, and cannot take a press
meant for a control underneath; it is capped at a third of the width and
truncates, a long name pushing a toolbar's controls off the edge being this
project's own repeated fault (addendum 19 §10).

What the tests pin is `room-save-surfaces`' shape and for its reason: **a
seventh room added without one fails there rather than shipping silent.**

## 3. Every project opens on the writing

This **reverses addendum 19 §5's default at Ken's ask**, and the argument it
reverses is still a good one — a textbook is planned before it is written, and
the plan is the numbering, the contents and the shape of the whole thing, which
is why the Outline page exists on a book at all.

What that argument is about is **where the work starts**. This is about **where
the program opens**, and they are not the same question: a writer who comes back
to a book they have been writing for a fortnight is put on a planning screen
they were not asking for, and *so it's not confusing* is exactly right about
what that costs. The Outline page is one press away on the bar either way, and
it is still the page a book's own work begins on.

Nothing else about §5 changes — the page is still on the bar, still absent
rather than greyed off a book, still poppable and marked away like Editors. What
goes is three words in one effect in `App.tsx`. The page is **the writer's the
moment they press one**: the effect is keyed on the project rather than the file,
so only opening another project decides again.

## 4. The Note Sorter's two

**The drop line is at the top.** *Drop files anywhere on this page* stood at the
**foot** of *Add material*, under the four ways in and the loud dictation tile —
so the cheapest way of all to get material in was the last thing a writer read,
after they had already picked one of the others. It says what the whole panel can
do, which is a heading's place rather than a footnote's; it is the first thing
under *Add material* now.

**The percentage gained its noun.** On every file and every source tab stood a
bare `0%`, which could as easily have been how much is left, how sure the
suggestions are, or how far a file had uploaded — **a number on its own is a
reading whose subject the writer has to guess**. It is `coverageOf`, the share of
a source that has become cards (addendum 26 §2: *processed is a reading*,
counted back from the cards' ranges every time, so deleting a card un-greys its
passage with nothing run).

The word is **`sorted`**, which the room already uses for this exact state in
*Grey sorted*, *Hide sorted* and *Unsorted only* — so the three places that show
the figure say what the display modes say, rather than the sitting's bar having a
sentence of its own (*dealt with*) and the files having none. `sorted(share)` is
one function and `COVERAGE_IS` one sentence, said in a hover where there is no
room for it, ending with what addendum 26 §11 settled: **nothing follows from the
figure**. It is progress and never a score.

---

## 5. Driven

At 1440×900 in the real preview, on a fresh **Instructional book** called
*Mathematics* — which is what Ken said he was starting:

- it **opened on Write**, not on the Outliner;
- `.room-format` reads **Instructional book**, centred at x = 720 against a bar
  centre of 720 — **0 px out** — on the title bar, in Research and in the Note
  Sorter;
- *Add material* reads, top to bottom: the heading at y = 64, then **Drop files
  anywhere on this page** at y = 93 as its first child, then the four tiles, the
  box and the dictation tile;
- with a source in, the sitting's bar reads **0% sorted** and the file row reads
  **0% sorted** with the sentence in its hover.

## 6. Named rather than built

- **A room's own name is not repeated in the middle**, which is §2's decision
  and worth naming as a refusal: the centre says the format, and a writer who
  wants to know which room they are in reads the left of the bar, where every
  room has always said so.
- **Nothing is stored.** Which page a project opens on is not a preference, and
  a remembered one would put somebody back on a screen they left a fortnight
  ago (addendum 02 §6d's rule about where a moved screen stands, pointed at a
  page).
