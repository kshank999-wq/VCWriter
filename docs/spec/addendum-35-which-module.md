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

## 7. The module cards on the site

From Ken, 7 November: *on the web front page, I want a working version of the
project screen … just when you select each of the module types, it goes to a
promotion screen for that particular module* — and *I don't want a game
studio included, just the modules, not where you fill in the project name or
who it is.*

- **One list.** The cards moved out of `Welcome.tsx` into the domain as
  `FORMAT_CARDS` (`packages/domain/src/format-cards.ts`), with
  `startableFormatCards`, `formatCardName` and `formatCardDetail`. The desktop's
  New project screen and the site both draw from it, so the site cannot offer
  a card the program lacks, in another order, or worded differently.
- **The front page** has a *What are you writing?* section (`#modules`) with
  the eight startable cards and nothing else: no title, no author, no folder,
  and no game (`startsHere` leaves it out, as on the desktop grid).
- **Each card is a link** to `/write/<slug>`: screenplay, series, novel,
  instructional, stage-play, short-stories, short-form, document. The page has
  a headline and intro, four strengths, what comes with the module, and the
  chooser again at the foot with the current module marked. What each page
  says is in `apps/web/src/lib/modules.ts`. The pages are static, and any other
  slug is a 404.
- **Each page shows the program.** Under the headline is a screenshot of VC
  Writer with a demo project of that kind open: `public/modules/<slug>.jpg`,
  2880×1800. They are not drawn by hand. `pnpm --filter @vcwriter/web shots`
  (`scripts/shots/capture.mjs`) builds the browser preview, serves it,
  puts each demo project from `scripts/shots/demo-projects.mjs` into the
  preview's own storage, opens it as a writer would and saves the workspace.
  The demo projects are original sample writing (a lighthouse screenplay, a
  newsroom series, a novel, a style guide, a one-act play, three short stories,
  a 30-second bakery spot and a heritage proposal), built with the domain's
  importers so they open exactly as a writer's would. Rerun the script when a
  screen changes. `--no-build` reuses the last preview build, and
  `CHROMIUM_PATH` names a browser outside Playwright's cache.
- **Sharing and search.** Each module page has its own title (*Novel · VC
  Writer*), description, canonical address, and Open Graph and Twitter card
  images (its screenshot), so a shared link shows the module. `sitemap.xml`
  lists the front page, buying, every module page, Notes and Writers Room.
- **The top menu** has *Modules* first, going to the chooser on the front page.

## 8. The screenshots, all of them

From Ken, 7 November: *we need to start assembling screenshots and tutorials
for this whole system before release* — this is the screenshot half (part B
of the plan).

- **One shot list.** `apps/web/scripts/shots/shot-list.mjs` names every
  screenshot: its id, the demo project it opens, the steps that walk to the
  screen (a bottom-bar page or room, a button, a folder, a key), what it must
  show, and where it is used. `docs/screenshots.md` is generated from it
  (`write-list.mjs`), so the list a person reads and the list the capture runs
  cannot differ.
- **27 shots today.** The eight module pages (`public/modules/`), and
  nineteen for the help guides (`public/help/`):
  - the New project screen and a project's home page
  - Research, a note in the rewrite screen, the Story Sculptor, the Outliner,
    Preview, the editors, Read back and Focus
  - Layout for a novel and for a collection
  - the book outliner and references for an instructional book
  - a season in the Outliner
  - the AV sheet as it prints
  - Research and *Place on page* in a Document
- **Demo projects grew to fill them.** The screenplay has a Story Sculptor
  map (two acts, plot points, scenes, the cast as placed characters and
  *causes* links) and an outline. The series and the instructional book have
  outlines. Every beat, passage and chapter is titled.
- **One command retakes them**: `pnpm --filter @vcwriter/web shots`, or name
  the shots to retake only those. A shot that cannot reach its screen fails
  and is listed, rather than saving the wrong picture. Steps match visible
  elements only, because Research keeps hidden copies of some titles.
- **Dark only.** The program has one theme, so there is no light set.
- **Not the phone.** The store screenshots for VC Writer Notes have to come
  from a real device or simulator (`docs/store-listing.md` §4) and are not
  made here.

## 9. The help centre, and help from inside the program

Part C of the plan: tutorials and in-app help.

- **vc-writer.com/help.** Twenty-three guides in three groups:
  - *Getting started*: getting started, finding your way round, saving and
    recovery, notes from your phone.
  - *Modules*: one guide for each of the eight.
  - *Rooms and tools*: Research, the Story Sculptor, the Outliner, the
    Character Creator, Preview, the editors, Read back, Focus, Layout,
    citations and references, spelling and the thesaurus.

  A guide is data (`apps/web/src/lib/help/`, typed by `types.ts`): short
  sections of paragraphs and numbered steps, with button and menu names in
  the program's own words, **bold** for what to press and *italic* for what
  the program says. The pictures are the shots of §8. Pages:
  `/help` (the index, a card per guide) and `/help/<slug>` (the guide, with
  the list of guides beside it, *Read next*, and where to report a guide that
  does not match the program). Each has its own title, description,
  canonical address and share image, and all are in the sitemap.
- **Written from the code.** Each guide was drafted against its addenda and
  the components, and every label was checked against the source. Where the
  spec and the code disagree, the guides follow the code. For example, the
  stage-play styles are chosen in *File ▸ Page setup…* (seven of them,
  counting US musical), and the instructional book's learning aids are
  Summary, What you learned and Review questions.
  `src/lib/__tests__/help-guides.test.ts` checks:
  - every slug appears once
  - every *Read next* link points to a guide that exists
  - every picture is on disk
  - every module, and every guide the program opens, has a guide
  - no section is empty
- **Help ▸ Guide for this screen (F1)** in the program opens the guide for
  what is in front: a room first (Layout, Sculptor, Outliner, Research), then
  Read back or Focus, then the page (Preview, Editors, the book's Outline page,
  Home), then the project's own module. With nothing open it is *Getting
  started*. **Help ▸ All guides** opens the index. `help-links.ts` decides;
  `window.open` sends it to the browser in the desktop app and to a tab in the
  preview.
- **Each module page links to its guide** (*Read the guide*). *Help* is in
  the site's header and footer.
- **The release check** (`/admin/release-check`, administrators only) lists
  every step of every guide as a box to tick, separately for Windows and for
  Mac, kept in that browser. Before a release, someone works through it on a
  clean machine of each kind. A step that does not do what its guide says is
  fixed, in the program or in the guide, before the installer ships. It reads
  the guides themselves, so it is never a check of an older guide.
- **Not built yet: the videos.** The same capture can record the walk to
  each screen, but a 60–90 second tutorial needs a script and a voice. That
  is its own piece of work.
- **Found while writing the guides.** The import dialog still pointed at
  *File ▸ Add stories to the collection…*, which became *File ▸ Import… ▸
  More stories*; it is corrected. Ctrl/Cmd+Shift+P is two things at once: the
  Inspector's own key, and *Export PDF…* on the File menu. It is left for Ken
  to choose which keeps it.

## 10. The classics in the samples

From Ken, 7 November: *I've collected classic stories from all the
different modules … we need to create examples of the software using these
stories.* He chose **public domain only** after being told that two of the
collection, *Chinatown* and *Sweat*, are under copyright and would show
pages of their text on a sales site.

The demo projects (`apps/web/scripts/shots/demo-projects.mjs`) now use:

| Module | Classic |
| --- | --- |
| Screenplay | *Night of the Living Dead* (1968; Ken's choice), opening scenes written out from the film, with a Story Sculptor map and an outline |
| Series | Sherlock Holmes: *A Scandal in Bohemia*, *The Red-Headed League* and *The Speckled Band* as three episodes, with Doyle's dialogue |
| Novel | *Great Expectations*, chapters I–III |
| Short stories | *Tales of Mystery*: three Poe tales as a collection |
| Stage play | *Hamlet*, Act I, Scene I (Ken's choice) |

The instructional book, the short-form spot and the document stay original.
The texts and where each came from are in `scripts/shots/classics/`. All 30
shots were retaken from them.

The *Night of the Living Dead* scenes are written from the film, using only
lines known from it; they are to be checked against the film before release.
A famous film still under copyright, of the kind some other products show,
would be at most a structure-only breakdown with no script text, after
advice from an IP lawyer.

## 11. The rooms and tools, promoted

From Ken, 7 November: *we need to also have screenshots and instructionals
and promotionals for the research, the outliner, the sculptor, and all those
other ones.*

- **A page for each room or tool** at `/tools/<slug>`: Research, Story
  Sculptor, Outliner, Character Creator, the two editors, Read back, Preview
  and Focus mode. Each page has:
  - a headline and intro, and the room's own screenshot
  - its features, alternating with their screenshots
  - *Read the guide* (the instructional for that room)
  - the other rooms at the foot

  Content is in `apps/web/src/lib/tools.ts`. Every claim there is one the
  room's guide makes, and the guides were written against the code.
- **On the front page**, a *Rooms and tools* section under the Layout band:
  a card for each tool, plus Layout and publishing (`/layout`) and VC Writer
  Notes (`/notes`), which have pages of their own. *Tools* is in the site's
  header. The tool pages are in the sitemap.
- **Four new shots** on the list:
  - the Story Sculptor with the Outliner panel beside the map
  - the Character Creator with Barbra open
  - Setups & payoffs
  - the Final editor

  The capture gained `button` and `tab` steps that match a name by pattern,
  for names that carry a count or a symbol. The *Night of the Living Dead*
  demo now has two setups placed on its scenes, so that screen shows real
  work.
- The tool pages are checked by `help-guides.test.ts`: every picture exists,
  every guide exists, and each slug appears once.

## 12. VC Writer Notes at the top of the front page

From Ken: *we need to mention the VC Writer Notes companion app on the front
top of the page, capturing every idea when inspiration takes you and
organizing and loading it right into your writing software.* A band under
the opening section has the Notes icon, *The companion app — VC Writer
Notes*, a line on capturing an idea when inspiration takes you and having it
arrive in VC Writer titled, dated and filed, and a button to `/notes`.

## 13. Work any way you want (`/workflow`)

From Ken: *a promotional page for the outliner, the sculptor, the notes, that
promotes that you can work any way you want … a flexible workflow, and
organize yourself with multiple tools at your disposal … a little section that
highlights those, they're just text boxes … group that into one promotional
thing.*

The tools each keep their own page under `/tools`; `/workflow` sells the fact
that they are several ways into **one** story. It runs:

1. The hero, *Work any way you want*, over the Sculptor-with-Outliner shot.
2. **Tools at your disposal**: the short text boxes (`.workflow-box`), one
   line each for Notes, Research, Outliner, Story Sculptor, Character Creator
   and the page itself, each linking to that tool's page.
3. **Start wherever you start**: four cards, from a pile of ideas, an outline,
   a map, or the page.
4. Shot-and-copy bands for catching and sorting notes (`research-filed`), the
   Outliner (`outliner`), the Sculptor (`sculptor`) and the notes beside the
   writing (`writer-notes`), all from `scripts/shots`.
5. A closing band, *All of it, in every module*.

The front page carries a band to it (*Work any way you want* → **Your
workflow**) between Layout and the rooms-and-tools chooser, and the sitemap
lists it.

## 14. The workflow, a step at a time

From Ken:

> *We need to create a workflow for the advertisement and we'll start with
> the screenplay. You click the workflow but it'll show you a box with you
> create the scene, then the beat, and then it writes the screenplay for you.
> You can reorder things. Decide whether your scenes are working with the
> plus minus features … a simple workflow for advertising so people feel that
> it's not intimidating.*

A button, **See how a screenplay comes together**, opens a box of six steps.
Each step has one picture of the program, a title and a line or two of words:

1. **Make a scene**: the scene box (`scene-notes`).
2. **Add the beats**: scenes and beats on the track (`modules/screenplay`).
3. **Write each beat**: the writing screen with its notes (`writer-notes`).
4. **It becomes a screenplay**: the pages as they print (`preview`).
5. **Move things around**: drag scenes and beats (`outliner`).
6. **Check every scene works**: the Polarity graph, up and down, plus and
   minus (`polarity`, a new shot).

The box moves with Back and Next, the arrow keys, or the dots, and closes
with the ×, Escape, or a click outside it. On the last step, Next becomes
**Buy & download**. The picture shrinks to the window, so Next is always on
screen, laptop or phone.

**The wording is careful.** VC Writer sets and formats the screenplay from
what the writer writes. It does not write the writer's words. Step 4 says
*everything you write is set as a screenplay for you*, which is true; *it
writes the screenplay for you* would not be.

**Where it appears:** beside the guide button on `/write/screenplay`, as a
band on `/workflow`, and beside **Your workflow** on the front page.

**The steps are data** (`lib/walkthroughs.ts`, `WalkthroughButton`), so the
next module's box is a list of steps, not a new component. The help test
checks every step's picture exists.

The screenplay demo now marks where each of its seven scenes starts and ends
(`withPolarity` in `demo-projects.mjs`). The first is left flat on purpose,
so the graph has something to show.

### 14.1 The novel

**See how a novel comes together**, in six steps:

1. **Plan your chapters**: the Outliner with three chapters, their passages
   and beats, each level in its own colour (`novel-outliner`, new).
2. **See the whole book**: chapters and passages on the track
   (`modules/novel`).
3. **Write each passage**: a passage open for writing (`novel-writer`, new).
4. **It becomes a manuscript**: the title page and contents
   (`novel-preview`, new).
5. **Polish it**: the Daily editor's notes, and the Final editor's questions
   (`editors`).
6. **Set it as a book and publish**: Layout at chapter one (`novel-layout`).

**Where it appears:** on `/write/novel`, beside the screenplay one in the
`/workflow` band, and on `/layout`, since it ends with publishing.

The novel demo now has an outline: the three chapters of Great Expectations,
with their passages and beats (`withOutline` in `demo-projects.mjs`).

### 14.2 Short stories and collections

**See how a collection comes together**, in six steps:

1. **Start a story, or a collection**: three stories on the track
   (`modules/short-stories`).
2. **Plan each story**: the Outliner with three stories, their passages and
   beats (`short-stories-outliner`, new).
3. **Write each passage**: a passage open for writing
   (`short-stories-writer`, new).
4. **Bring in stories you have written**: the Import box, with *A collection
   of short stories: one document per story* (`import-collection`, new).
5. **Polish it**: the Daily editor across the collection
   (`short-stories-editors`, new).
6. **Set the collection as a book**: Layout at the first story
   (`short-stories-layout`).

**Where it appears:** on `/write/short-stories`, and as a third button in the
`/workflow` band.

The Poe demo now has an outline of its three tales, with their passages and
beats.

### 14.3 The series

**See how a series comes together**, in six steps:

1. **Plan the season**: the Outliner (`series-outliner`).
2. **Every episode on one track**: with the timeline showing each character
   across the season (`modules/series`).
3. **Write each scene**: a scene open for writing (`series-writer`, new).
4. **It becomes a script**: the contents page, each episode with its length
   (`series-preview`, new).
5. **Keep your cast straight**: the Character Creator with Holmes open
   (`series-characters`, new).
6. **Polish every episode**: the Daily editor across the season
   (`series-editors`, new).

**Read back was tried for step 6 and dropped.** The browser preview the shots
are taken in shows its "natural voices come with the desktop app" note, and
an unassigned cast, which read badly in an advertisement.

**Where it appears:** on `/write/series`, and as a fourth button in the
`/workflow` band.

### 14.4 The stage play, and its formats listed

**See how a play comes together**, in six steps:

1. **Plan your acts and scenes**: the Outliner (`stage-outliner`, new).
2. **See the whole play**: scenes on the track, with the cast's timeline
   (`modules/stage-play`, retaken).
3. **Write each scene**: a scene open for writing (`stage-writer`, new).
4. **Choose your house style**: Page setup with the seven stage presets
   (`stage-house-style`, new).
5. **Add a cast page**: the cast page dialog (`stage-cast-page`, new).
6. **It becomes a script**: the printed pages (`stage-preview`, new).

From Ken: *also list the formats that you can do a stage play in, all the
major formats.* The stage play page now has **Every major format**, listing
the seven house styles `scriptFormatsFor('stage_play')` offers, described as
Page setup describes them:

- US modern play
- US traditional play
- US publisher reading copy
- UK BBC stage
- UK contemporary play
- Continental reading copy
- US musical

The list is the module's optional `formats` field. Its *Six stage formats*
strength was out of date since the musical preset was added, and now says
seven.

**The Hamlet demo was filled out:**

- the rest of Act One as planned scenes with their beats (`withPlannedScenes`)
- an outline through the start of Act Two
- the cast page filled in (`withCastPage`): each role's line and playing age,
  the time, the place and a note. Without it the shot showed the dialog's
  placeholder examples (*a kitchen in Duluth*), which read as content.

### 14.5 The instructional book

**See how a nonfiction book comes together**, in six steps:

1. **Plan the book**: the numbered outline (`instructional-outliner`).
2. **Write each section**: the book with the section's summary beside it,
   marked In the book (`modules/instructional`, retaken).
3. **Cite your sources**: the references library (`instructional-references`,
   new).
4. **Contents and index, built for you**: the contents page with numbered
   sections and page numbers (`instructional-preview`, new).
5. **Polish it**: the Daily editor (`instructional-editors`, new).
6. **Set it as a book and publish**: Layout at chapter one
   (`instructional-layout`, new).

**The *Plain and Clear* demo was filled out** (`withSourcesAndAids`):

- three real sources on plain writing in its references library: Strunk and
  White, Gowers, Flesch
- a summary and two review questions on its first section, both in the book

Without these, the library read *References 0* and the end-of-section panel
*Nothing written yet*.

**Where it appears:** on `/write/instructional`, and as a sixth button in the
`/workflow` band.

### 14.6 Short form

**See how a commercial comes together**, in **four** steps, since a
commercial is a short job and the box says so:

1. **Plan it from the brief**: the Outliner, with the client brief and
   mandatories on its shelf (`short-form-outliner`, new).
2. **Write what is heard and what is seen**: the AV sheet with a frame on
   every row (`modules/short-form`, retaken).
3. **A frame for every shot**: the Board view (`short-form-board`, new).
4. **Timed to the second**: the printed sheet, its total against a 30-second
   limit (`short-form-preview`, retaken).

**The Harbour Bakery demo was filled out:**

- a storyboard frame on every row: five rough pencil thumbnails drawn for the
  demo in `classics/frames/`
- a 30-second limit (`setMaxSeconds`)
- a client brief and mandatories in Research
- the spot planned in the Outliner

**Found, not fixed: the Daily editor misreads short-form sheets.** It flags
every audio line of the sheet as *a speech with no character cue above it —
nobody is saying this*, five errors on a correct sheet. A sheet's audio
column is not dialogue awaiting a cue, so the rule should not apply to
`short_form`. For that reason no editors step is in this walkthrough. The
Research shot was dropped too: the brief landed in the Characters folder,
which read wrongly.

**Where it appears:** on `/write/short-form`, and as a seventh button in the
`/workflow` band.
