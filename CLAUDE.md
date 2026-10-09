# Working on VC Writer

## Reporting a revision

**Finish every revision with a link.** Ken wants to look at the change, not
read about it.

| Where the work is | What to hand over |
| --- | --- |
| Pushed to `main` | <https://vc-writer.com/preview> (the browser preview; his admin sign-in), and the commit link |
| On the branch only | Say so, give the commit link, and offer to push |

`https://github.com/kshank999-wq/VCWriter/commit/<sha>` is the commit link.

Branch preview URLs (`vcwriter-git-…vercel.app`) are **not** worth handing
over: the Vercel project has SSO protection on every deployment except the
custom domain, so they demand a Vercel login first. Only `vc-writer.com`
is exempt, and it serves `main`.

Wait for the Vercel production deployment to report READY before calling a
push live; the build takes a minute or two.

## Where things are

- `packages/domain` — the model: Zod schemas, pure mutations, pagination,
  the writing rules (`editing.ts`, `reformat.ts`, `entities/inline.ts`).
  Everything testable lives here rather than in a component.
- `apps/desktop` — Electron and the renderer. `src/renderer/components`.
- `apps/web` — the Next site, and the admin-gated browser preview built
  from the renderer into `public/preview`.
- `apps/mobile` — **Notes on iOS and Android** (Expo), from Ken's *we need to
  create notes as an app for the apple app store and android*. It has **never
  been run on a device** — this container is Linux, an iOS build wants macOS or
  a cloud builder — so it typechecks, its tests pass and its dependencies
  resolve, and nothing more than that is claimed. `README.md` there is the
  build, and `docs/store-listing.md` is every field both consoles ask for plus
  what only Ken can do. **No credential, key, certificate or keystore belongs
  in this repository**, which is why `eas.json`'s `submit` block is empty and
  the two Supabase values are EAS environment variables.
- `packages/supabase/migrations` — apply new ones to the live project as
  part of the change, not afterwards. The Supabase connector can do it from
  here; afterwards run the advisors (`get_advisors`, security **and**
  performance) and fix what they raise, because they catch what the SQL
  reads like it does. Applied through 0066.
- `docs/spec/` — the master spec and `addendum-02-workspace.md`, which
  describes the workspace as built. Keep it current with the code. Its **§8** is
  the windowing, and the thing to know is that **every room goes to a second
  monitor**: research could already, and the Outliner, the Story Sculptor, the
  Editors and (on a game) the narrative map now can. The first three needed no splitting the way `ResearchBody` was
  split — they are already `position: fixed; inset: 0`, so a window of their own
  is the same component with nothing under it, and the change is the key joining
  `PaneKey` and `ROOM_PANES`, a `SHAPES` entry, a branch in `Satellite.tsx` and a
  menu item. **The Editors are the odd one**, being a *page* rather than an
  overlay: what is left behind is the page bar sitting on a page that has gone,
  so it is **marked rather than removed** — *Editors* keeps its place with a ⧉
  and choosing it raises that window — and over there a finding opens its beat in
  a window of its own, there being no Write page to send anybody to. Three things came out of
  building it. **An unknown `?pane=` used to draw the plot tracks** — they were
  the fallthrough of the branch ladder — so a window opened by an older
  workspace drew the tracks while its title bar claimed to be whatever had been
  asked for; there is a real default now. `paneTitle` is **the one thing that
  names a pane**, the title bar's chips having held a second copy that knew
  about research and nothing else. And `printing.ts` is printing in one place,
  because **a room on the other monitor must not be able to do less than the
  panel it came out of**: the popped-out Outliner still prints and exports, and
  the thing that makes that sound is that **what is printed is the document in
  hand rather than the one on disk** — the flush is the workspace's business and
  a satellite needs none. Its **§12a**
  is the **chapter page** as Ken asked for it — *File ▸ Chapter page…*, under
  *Title page…*, because a chapter leaf is the same kind of object: a page of
  the book that is not a page of the manuscript. Most of what he described
  already existed (§12's leaf carried a number, a name, an epigraph and an
  illustration, and the number was already derived); what was missing was a way
  in from File and any control over the type. The split that shapes it is that
  **the look belongs to the book and the words belong to the chapter** — face,
  sizes, case, weight, tracking, the rule and the drop are set once in
  `settings.chapterPageStyle`, because a reader who turns to chapter nine and
  finds its heading in another face has found a mistake rather than a design,
  which is §12's numbering rule pointed at the type. **The number is neither and
  there is nowhere to type it**: it is worked out from where the chapter falls,
  so moving chapter nine makes it chapter eight with nothing run, the list down
  the left shows the number each would print, and a line under the controls says
  so in words. `chapterStyleVars` in `packages/domain/src/chapter-style.ts` is
  the **one** thing that decides what the CSS custom properties mean — the
  printed document carries them inline, the preview declares them on the leaf,
  and the dialog's sheet is the same `ChapterLeaf` the preview draws, so neither
  stylesheet names a size of its own. The marker dialog's hand-rolled copy of
  that markup is gone: a second copy was a second answer to *what will it look
  like*. Case is a real setting rather than a change to the letters (*small
  caps* is `font-variant-caps`), and unlike the title page everything here saves
  as you type, because a look is tuned against the sheet beside it.
  **§6b is joining several into one**, from Ken (*you should be able to shift
  click several beats… in this one it'll be merge… if you're within a beat and
  you right-click, you can split a beat at that point… even in the one for
  textbooks, so in the subsections, you should be able to either join those*).
  Half of it stood — §6a's menu, the split at the cursor on the manuscript's
  own menu, and `dividing.ts`'s **split before an element** and **merge the
  neighbour in** since the divide tools — so what was missing is the act a
  writer performs: picking a **run** and joining it. **Shift picks the run and
  it is a range from the selection** (the far end on the track, the near end
  the project's chosen beat, so an ordinary click clears it and the two cannot
  disagree), and the marked beats are **tinted**, a menu saying *Merge 3 beats*
  over a screen showing no three being one nobody trusts. **The domain answers
  before the act can be asked for**: `beatsJoin`/`unitsJoin` give a refusal a
  writer can act on or the sentence *3 beats become one, called Opening beat.
  Not a word is cut*, and `joinBeats`/`joinUnits` refuse the same things again
  so a caller cannot get past the reading by not reading it — `trackRemoval`'s
  shape, with the cuts' own promise that **not a word moves**. Two rules: a run
  must be **adjacent** (joining the first and the third would carry the
  second's writing along, a reordering nobody asked for) and two units on
  **different tracks** are not joined (the story order runs across them, so it
  would take a scene off its subplot silently); a break on an absorbed unit
  goes with it, which is what a writer would not guess and so is what the
  sentence says. **Nothing names a format** — every menu reads `nounsFor`, so
  it is *Merge 3 beats* on a screenplay, *3 passages* in a novel and *3
  subsections* in a textbook, with *Join it into the section before* one level
  up. `ContextMenu` grew a **note** for it: what an item would do, said under
  its label rather than in a hover nobody sees, with the item still **named by
  its label alone** so a menu can be found by what its items are called.
  **§6c is undo, for everything**, from Ken (*everything you do needs to be
  able to undo using control plus Z, back at least 10 steps*) — and there was
  **none at all**. What made it a day's work is one fact: **every change to the
  document is a pure function of the document** and every one goes through the
  same `update`, so the step before an act *is the document before it* and undo
  is a **stack of documents rather than of inverses** — no module knows undo
  exists, nothing describes how to take itself back, and **an act built
  tomorrow is undoable the day it is written**, which is the only way *everything
  you do* is true rather than a list somebody forgets. Whole documents are cheap
  for the same reason (a mutation rebuilds one collection and shares the rest);
  **fifty** steps rather than ten. Two rules in `history.ts` decide what a step
  is. **The writer's acts and not the program's** — the writing clock ticks
  through `update` once a minute, so without `isWritersAct` a step lands mid
  paragraph and the redo stack goes while somebody types; it compares top-level
  references and is **derived rather than listed**, so a new module is covered
  the day it is written. **Typing is one step and an act is always its own** —
  a burst within 700ms folds and the fold **keeps the earliest** (undo takes the
  sentence, not its last letter), while `shapeOf` stops an act folding into the
  typing before it, which is what a plain timer gets wrong exactly when a writer
  most wants their merge back. Two histories are **dropped**: another project
  (a different document) and a cloud merge (not this writer's act). Ctrl/Cmd+Z
  and +Shift+Z, plus *Editor ▸ Undo / Redo*; the keys are the program's rather
  than the focused field's, both being in one stack already. And §6b's gesture
  is now at **both levels**: shift-click a run of sections for *Merge 2 scenes*,
  *Join it into the scene before* with nothing marked, the run taken **along the
  track** because the story order runs across them.
  **§6d is the writing screen moving**, from Ken (*when you open a beat you
  should be able to grab the top bar and drag it around and be able to drag it
  to another screen if you want*), and the whole of it is that this is **two
  gestures and not one**: a page drawn inside a window cannot leave it, so the
  bar moves the screen **on the desk** and §8's ⧉ beside the × puts it **on the
  other monitor**. A `<dialog>` is centred by the browser, so being moved is
  the one state that places it; `BeatDialog` holds a left and a top while the
  pointer is down. Three decisions: **where it stands is kept nowhere** (not in
  the project, which is the writing, and not on the machine either — a screen
  that opens where it was left a fortnight ago is one you go looking for), the
  bar is a handle **only where it can be** (absent in the beat's own window,
  and the cursor says so, a bar that moves and one that does not looking
  alike), and **a control is a control** — a press on the name, the draft
  picker or *In script* is that control's and never the start of a drag, or
  naming a beat would slide the screen out from under the pointer.
  **§8a is the working surface taking the stage**, from Ken (*switch the
  timeline viewer and the plot tracks… the plot tracks are the ones we're going
  to be working with, and the timeline viewer is basically an overview… I also
  want the plot tracks to be expandable height-wise*). **Both halves were
  mechanisms already there, pointed the wrong way**: §8 has let any section swap
  with any other since it was built and the stage has had a drag divider all
  along, so what was wrong was the **default** — `DEFAULT_ARRANGEMENT` put the
  viewer on the stage and the tracks in the strip, which is a claim about which
  of them a writer's hands are on. **A screen is arranged around what is acted
  on, and the overview goes under it.** Two things fall out of the swap rather
  than being arranged beside it, which is why it is made in the record: the
  **Inspector comes with it** (it stands in the top row beside whatever is
  there, describing the scene or beat you select *on the tracks*), and the
  divider **now sizes the tracks**, having always sized whatever is on top —
  Ken's *adjust the height of it too*, with no new gesture. The half that
  decides whether any of it is seen: **a new preference key, because the old one
  holds the old default** — the arrangement is per machine, so every machine
  that ever opened the workspace has `panes` written with the viewer on top, and
  for nearly all of them that was not a choice but what they were handed;
  changing the default alone would have reached **nobody who had already opened
  the program**, which is the week's own fault a fourth time, and `panes2` is
  `layout.pageZoom` replacing `layout.zoom` (addendum 20 §9e) again.
  `tracksHeight` replaces `viewportHeight` on the same argument (a height chosen
  for the *viewer* is not one anybody chose for the tracks), opening at 0.58
  rather than 0.48 — the surface rather than the summary — with the floor and
  the reserve swapping sides. The divider is **named for what it sizes**
  (`Resize the plot tracks`, read off the top slot), its old *Resize the
  viewport* having been true of one arrangement in twenty-four. Measured with
  the old arrangement still in storage: tracks on the stage at 580px, viewer at
  337, and a 180px drag puts the tracks at 764 with the viewer at its floor.
  Three `windows.test.tsx` assertions spelled the old default out while testing
  the swap and were **updated rather than worked around**. Short form is
  untouched, its arrangement being hard-coded and its split keeping
  `sheetHeight`.
  **§4c is the beat under the pointer**, from Ken (*when you hover over a
  beat in a scene, I want to be able to see the entire description of the
  beat, so you don't have to go into it to see if it's the one you need to be
  working on. And these changes need to be universal*). **Universal is the
  whole design**: a card built into the timeline would have to be built again
  in the scene dialog, the Outliner, the Sculptor, the Script and the panels —
  six more answers to *what is in this beat*, and a seventh surface built next
  month with none. So `BeatPeekLayer` is **one listener over the window**, a
  row says which beat it is with `data-beat`, and adding the hover to a new
  screen is adding one attribute. It is mounted in the workspace **and in
  every popped-out room**, §8's rule that a room on the other monitor must not
  do less. `beatPeek` in the domain decides what it says, and three rules hold
  it. **The description is never cut** — that is the ask: a writer who reads
  half a sentence still has to open the beat, which is the trip this saves.
  **Where nothing is described the writing stands in and says so**, a beat
  with no summary not being an empty beat and its opening words being what it
  is; the writing *is* clamped, being context rather than the answer. And
  **one hover, one answer**: the native `title` on those rows said the status
  and the keys, which beside the card would be a second tooltip over the same
  row, so `data-keys` carries them into the card and the rows carry no title.
  Two things driving it caught: the card had `overflow-y: auto` **and**
  `pointer-events: none`, a scrollbar nobody can reach, so the writing is
  clamped instead and the card never promises a scroll it cannot give; and it
  goes on any press, key or scroll, being for reading and never for acting.
  `beat-peek-surfaces.test.tsx` is `cast-surfaces`' shape: what can go wrong
  is not the card but a screen that draws a beat and never says so, which
  reads exactly like the feature not being there.
  **§4a is the scene's screen restyled**, from Ken with a handoff and a
  mockup (*this is going to apply to all the scenes throughout all the
  modules… just want to clean up the UI make it look a little more
  elegant*) — a **visual restyle in place**, every binding and the
  save-as-you-type untouched, so what is worth keeping is the handful of
  places where a look turned out to be a statement about the work. **The
  switch says what it is rather than *Off***: *off* means nothing on its own
  — off *what*? — so a writer had to toggle it to find out, which is the one
  thing a switch may never require; it reads *In manuscript* / *Not in the
  manuscript* in the format's own noun, and is a `role="switch"` with
  `aria-checked`, the same statement made to a screen reader. **What it is
  comes before how it turns** — Status and Label, then the polarity pair,
  then Summary, then Notes, because a writer opening a scene asks what state
  this is in before how it moves — and the pair is **one strip** rather than
  two loose selects, *begins* and *ends* being one reading (addendum 13 §1)
  and two controls that must be read together looking like one. **The
  breadcrumb is two lines** (what this is, then which plot, behind a dot in
  the track's colour, two questions being two lines), the **name is the
  reading face and is not uppercased** (a screen that shouts it back has
  edited it), and `UNIT_STATUSES` in `entities/structure.ts` is the **one
  table** naming the five states and their colours, so the select's dot and
  anything else that draws one cannot disagree. The figures moved out of the
  middle of the form, where they looked like another field's help text, into
  a **status bar** beside *✓ Saved as you type*. Two things the handoff
  asked for are **deliberately absent**: the *+ Add character* and *+ Link a
  setup* buttons, both lists being **readings** — the cast off the cues, the
  promises off the tagged passages — so neither has anything a button could
  add, and what stands there instead is a sentence saying what makes a name
  appear. Driving it caught four faults no test could see, and the last is
  the one worth writing down: the narrow-window rule was **correct and
  overruled by a later rule of equal specificity**, a media query buying no
  weight, so where it stands in the file is the whole of whether it is
  obeyed. (Its first draft set `flex-wrap` on a **grid**, which does nothing
  at all — two different ways to draw a screen indistinguishable from one
  where the rule was never written.)
  **§4b is the two acts in the side column**, from Ken after §4a shipped
  without them (*wire them to the cue and tag menu*), and the correction
  worth keeping is that §4a was **right about the lists and wrong about the
  buttons**: a reading is not a reason to have no act, it is a rule about
  **what the act must do** — the act that makes the reading true rather
  than a second list beside it. **+ Add character writes a cue**, because
  `sceneCast` is read off the `character` elements and a cue is the only
  way a name can appear in it; `bringIntoScene` in `scene-cast.ts` puts one
  at the end of the scene's writing with an empty speech after it and the
  beat opens in the writing screen, so cutting the speech takes the name
  off the list with nothing run. It lives **beside the reading it feeds**,
  `cueOffer` gives the refusal or the sentence before the act can be asked
  for and `bringIntoScene` refuses the same things again (`trackRemoval`'s
  shape), and it **never files a character record** — `notedCast` does that
  from the cues, so doing it here would be a second answer about who the
  project knows. **Absent rather than greyed on prose**, a novel having no
  cue. **+ Link a setup opens the manuscript's own tag menu**, literally
  `PlantSetupOrPayoff` exported and anchored to the beat the scene's
  writing ends in, two screens that can make a promise being two answers to
  what a promise is. Driving it caught the CSS fault of the day: the dashed
  outline the handoff drew was written and **half obeyed**, `.ghost` setting
  the border *colour* to transparent while the dashed *style* took, so the
  control drew as a line of gold text.
  **§20 §15a is one prop, and a feature that read as unbuilt**, from Ken
  the day after the copyright dialog shipped (*the new copyright page is
  not live*). It was, from one gesture out of two: `PartFields` is rendered
  in the **inspector** and in the **part dialog**, only the first passed
  `onOpenCopyright`, and the button is gated on it — so the double-click,
  which is the gesture §9h and §9l document for *open the thing that sets
  this page*, landed on the free-text box the dialog replaces. Two things
  worth keeping. **A control gated on a callback is absent wherever the
  callback is not handed down**, and absence is this room's own idiom for
  *this does not apply here*, so a forgotten prop does not look like a bug,
  it looks like a decision — the same shape as a screen holding its own
  copy of a rule. And **a route needs a test per gesture, not per screen**:
  §15's nine tests drive the dialog directly and passed throughout, because
  not one of them asked how a writer gets there; the new one presses the
  row and then double-clicks it and asserts the same dialog opens both
  times.
  **§23a is two more colour schemes**, from Ken with a screenshot of each
  (*add these two colour schemes to the preferences. One we'll call green and
  the other one name it whatever*) — **Green** and **Cobalt**. A scheme is
  eleven token values, so this is additive and the only question is what the
  eleven are; both pictures were **sampled rather than matched by eye** (Green:
  page `#f5f6f8`, white cards, rules `#dfe2e8`, `#3fb950`, type `#1b1f27`;
  Cobalt: `#3d3d3d` over `#252527`, `#0075f8` and `#2579b1`, muted `#939393`).
  **The one thing a screenshot cannot say is which green goes in which token,
  and getting it wrong is invisible**: the names are the brand's and the
  meaning is the stylesheet's — `--gold` is the accent as **type**,
  `--gold-bright` the most **emphatic** against the surface, `--gold-deep` a
  **fill or an edge** — so on a dark scheme bright is lighter and deep darker,
  and **on a light one that inverts**, Parchment's `goldBright` being its
  *darkest* bronze because what is emphatic on cream is dark. So `#3fb950`
  reads at **2.5:1** as text on white and is the **fill** (his pills and card
  edges), while `#1a7f37` at 5.1 and `#116329` at 7.4 carry the words; a scheme
  that read the names literally would print its most important words at its
  lowest contrast and **nothing would fail**, which is why the rule is now
  asserted over **every** scheme by luminance rather than left in a comment —
  the next one is covered the day it is written, and the panel's own test
  counts `SCHEMES.length` rather than the literal 4 that made adding one an
  edit to a test about something else. Two things the pictures asked for and
  did not get: **Green's panel is lighter than its ink** (a white card on a
  grey page, the only scheme where that holds, and his picture), and **Cobalt's
  blue title bar is deliberately not reproduced** — the bar is `--panel` like
  every surface, and painting one element from a screenshot would be a twelfth
  token nothing else could read. **And driving it found a fault only looking
  could find**: the preview strip stayed gold on a white page, `preview.tsx`
  having written `#a3946f`, `#c9a45c`, `#3a3018` and `#8a6f2f` into its own
  stylesheet — **literally Gold's `muted`, `gold`, `border` and `goldDeep`** —
  a surface keeping its own copy of a colour, invisible under the scheme it was
  copied from; it reads the tokens now. Three nearby literals are **correct and
  left**: the logo's gradient (a logo is a logo), the `:root` block (that *is*
  Gold's definition, overridden inline), and the beat and folder pickers'
  `#c9a45c` default — a beat's colour is a **document** colour that travels in
  the project and is drawn for every reader, so it must not move because
  somebody switched scheme.
  `addendum-03-story-sculptor.md` is the Story Sculptor node canvas: stages
  1–7 (the board and its two nodes, the structure column, the layout rule
  with scenes, beats, the columns the writer defines, binding a node to a real
  scene, and the writer's own labelled connections) are built — §16 says what
  they do — plus the card revision: a card opens as a dialog with its notes and
  who is in it, the × asks before anything goes (`whatGoesWith` in
  `sculptor.ts` says what would), and the research shelf folds out from the
  left (§5, §9) — and stage 9, **the views**, all five of them: §17 and §18
  say what they do. Folding was already in the layout (`boardLayout` has
  honoured `collapsed` since stage 4, and a line into a fold already drew to
  the folded card), so the new work is focus, filters and search — and the
  design is one split: **depth hides, everything else dims**. A column is a
  depth, so hiding one hides what is under it and the board is re-measured;
  focus, *ideas only* and search never hide, because this is a tree and hiding
  a parent would orphan its children. One lit set serves all three, so two at
  once give the intersection. §10's *any subset* of columns is built as a
  **prefix** of one, a tree having no coherent way to draw beats with no
  scenes above them, and §10's **Focus** is labelled **Just this** because the
  workspace's title bar already owns that word. Filters are per machine;
  folding stays on the node. The **mini-map** (§18,
  `packages/domain/src/sculptor-map.ts`) closes the stage, and it holds §10's
  six words whole — *for a board bigger than the window*, **including the half
  everybody drops**: a board that fits gets no map, so there is no switch and
  *Structure alone* makes it vanish by itself. *Bigger* is by a **whole card**,
  a column across or a row down, because the literal reading put a sliver of
  two marks under a board that was entirely legible. It reads the *layout*
  rather than the board, so a fold is folded and a hidden depth is absent on it
  too, and it carries `readBoard`'s lighting — the one place a writer can see
  that what they searched for is off the top of the window. Nothing about it is
  stored. **§6a is *Add to track***, from Ken after the Outliner got its
  button: one press puts the selected scene on the track **with every beat
  under it**, from the toolbar, the card's right-click (`.sculpt-menu`) or the
  panel where *Make it a scene* used to be — all three reading one
  `trackOffer` in `sculptor-binding.ts` and saying its one sentence (*Add to
  track — and its 3 beats*; *Add its 2 beats to the track* where the scene is
  already there), so they cannot disagree about what a press would do, and
  refusing in a sentence a writer can act on. `addToTrack` is `realiseNode`
  on the scene and then on each idea beat in canvas order, which is the
  Outliner's `promoteRow` read off a board. It came with the **stepped
  layout** (§4): children used to lie level with the parent's head, so a scene
  stood *beside* its block and nothing separated two structure points but the
  scenes' own height; now `place` starts a node's children a row and a gap
  under its head, so the scenes fall between the structure points and the
  beats fall under a scene the same way. §8, the export as an outline, is **withdrawn**
  — the Sculptor does not make outlines. §14 says why the first draft was
  wrong.
  `addendum-04-story-grid.md` is the Story Grid, the third tab of the
  Editors page. **All six stages are built** — §9 says what each one does.
  `addendum-06-outliner.md` is the Outliner: the rigid sibling of the
  Sculptor, a typed tree that promotes scenes into the script. **All nine
  stages are built** — §14 says what each one does, and §12 calls promotion
  the point of the whole thing.
  `packages/domain/src/planning.ts` is where the board and the outline meet
  the script: one plan per scene across both, and the rename that reaches
  both. Rules about the *pair* go there rather than in either module. §1 and §2 are the decisions the rest hangs off.
  `addendum-07-writers-room.md` is Writers Room, the cloud collaboration
  module: the showrunner's dashboard as the front door, logins, assignments,
  submitting, the brainstorming room, curation and a non-destructive master
  merge. **All fifteen stages of §15 are built, and nothing in the addendum is
  unbuilt.** §1 and §2 are the rules it all hangs
  off — one writer's work is never destroyed by another's, and a collaborator
  gets the whole program rather than a web editor. §3 says how much of it the
  product already has (the Room is `/preview` grown up; membership widens
  `owns_project` rather than adding a second set of policies; several writers
  side by side is the pane windowing that exists). §4 is stage 0, now built:
  boards and outlines sync, nested in the document and flat in the database,
  with `planParts`/`withPlanParts` in `sync-mapping.ts` the one place that
  knows the difference. Stage 1 is rooms and seats: `packages/domain/room.ts`
  holds the rules, `apps/web/src/lib/rooms.ts` the data layer, and migration
  0024 splits `owns_project` into `may_read_project` and `may_write_project` —
  writing stays owner-only until branches exist. Stage 2 is the front door:
  `/rooms` and `/rooms/[roomId]` in `apps/web`, with `landingFor` in the domain
  deciding what each role is shown. Stage 3 is branches: a writer writes to
  their own branch, never to the project's rows, so `may_write_project` never
  needed widening; `packages/domain/branch.ts` holds the rules and
  `apps/desktop/src/renderer/cloud-bridge.ts` is the third bridge, reached at
  `/preview?room=<id>`. Stage 4 is contributor colour: `origin` on a scene and
  a beat names a person and nothing else, and the colour is read through the
  seat in `packages/domain/attribution.ts`; the bridge signs new work in one
  place (`signWork`), and `apps/desktop/src/renderer/room.tsx` is the context
  every badge, bar and stamp reads. Stage 5 is the dashboard and the version
  window: `packages/domain/desk.ts` says what a reader may be offered,
  `/preview?room=…&version=…` opens one recorded version read-only, and the bar
  wears the *author's* name rather than the reader's. Stage 6 is submitting:
  `packages/domain/submission.ts` holds the states and the queue,
  `apps/web/src/lib/submissions.ts` the data layer, and migration 0031 widens
  `versions_read` for the first time — a submitted version is readable by
  whoever curates the room, and an unsubmitted one still is not. Stage 7 is the
  brainstorming room: `packages/domain/ideas.ts` says what a box is and what
  filing does — **it copies, it never moves**, and the copy keeps whose idea it
  was — `/rooms/[roomId]` draws the boxes in their writers' colours, and
  migration 0032 puts `author` on a research item (*not* `origin`, which there
  already means how it got into the project). Colourising the Research shelf
  reached the Sculptor and the Outliner for free, since both already hold one.
  Stage 8 is assignments: `packages/domain/assignment.ts`, and the rule that
  shapes all of it is that **an assignment is not a lock** — nothing consults
  one before letting anybody write. One row read from three angles (the
  writer's page, the dashboard column, a hollow badge beside the scene), and
  migration 0033 answers the *column* question RLS cannot with a trigger: a
  writer may change the state and nothing else, and only into the three states
  that say how their own work is going.
  Stage 9 is the point of the module: `packages/domain/curation.ts` is the tray
  and the merge, and `applyTray` is **pure**, which is what makes the preview
  honest — the page runs it to draw what the master would read like and the
  commit route runs the same function, so the picture and the commit cannot
  disagree. A merge **adds**: a new master version beside the one before it,
  never an overwrite. Attribution survives the journey for free (a record has
  carried `origin` since stage 4), so a merged scene has two authors and the
  preview draws both. Migration 0034 is the tray, the merge record on the
  version, and a hole 0026 left — anybody in the room could insert a
  `master`-kind version, which is readable by everybody.
  Stage 10 is comments, mentions and the trail: `packages/domain/comments.ts`
  and `activity.ts`, and the decision worth keeping is that **the trail is a
  reading, not a second recording** — every event in it comes off a version, a
  submission, an assignment or a seat that already carried the fact, so there is
  no log table to drift. *What is new* is computed the same way; the only thing
  recorded is when each person last looked. A comment is speech about the work,
  so it can be edited and never deleted (withdrawing is a state). Migration 0035.
  Stage 11 is the desktop: `packages/domain/standing.ts` answers §14's four
  words — current, ahead, behind, diverged — plus an honest fifth, `unmoored`,
  and the rule lives there rather than on a server so the desktop and the
  browser cannot disagree. It needs a **mooring** on the project (migration
  0036): which master version this copy descends from, without which *behind*
  and *ahead* are indistinguishable. Both sides hash `bytesToHash` from the
  domain, or *current* would be a coin toss. Sending desktop work up makes a
  version and a submission — a contribution, never the master — which needed no
  new machinery at all. The Electron wiring is typechecked and built but not
  run here; the rules behind it are tested and the database side is proved.
  Stage 12 is the room's AI: `packages/domain/assist.ts` and
  `apps/web/src/lib/ai-room.ts`. The rule that shapes it — **it never rewrites
  another writer's work** — is enforced by the *shape of what comes back*: there
  is no field in any reading that can hold replacement prose, so a model that
  tried has nowhere to put it. Work it helps make is `assisted` on the record's
  existing `origin`, attributed to the person and never the machine. Migration
  0038 is the owner's switch.
  Stage 13 is the **AI spending cap**, which 0038 had named the three blockers
  for — metering, what happens at the limit, somewhere to show the total —
  `packages/domain/src/spending.ts`, `room-spend.ts` and migration 0043. The
  admission that makes it honest is in the interface: **a cap stops the next
  reading, never the one in flight**, because what a reading costs is known only
  once the model has answered, so a room can pass it by one reading and the
  overshoot is drawn rather than clamped. The meter **records** where the rest of
  the module reads, and the exception holds because tokens are written down
  nowhere else and the row is an *event* rather than a second copy of a state; a
  refusal and a cut-off answer go on it too. `room_ai_usage` has a read policy
  and **no write policy at all** — a meter a client may write is not a meter. The
  rate lives beside the model id and never in the domain. Everybody in the room
  reads the number (a cap you can hit without seeing it coming is the failure it
  fixes); only the showrunner sets it, along with the stage-12 switch, which
  until now was in the database and nowhere else.
  Stage 14 is **email notification**: `packages/domain/src/notify.ts`, the
  `roomNotice` template, migration 0044. One sentence carries it — **the room
  notifies; email interrupts, so email carries only what was addressed to you**:
  a mention, an assignment given to you, a decision on your own submission, and
  nothing else. A **reply in your thread is news in the room and never an
  email**, which is where the line sits. Four refusals: your own act never mails
  you; an invited seat gets the invitation and nothing else, mail about the work
  being the one way in that skips RLS; a deactivated seat gets nothing; and
  **speech travels while the work does not**. Still **no notification table** —
  what is recorded is that mail was *sent*, in `email_events`. The switch is on
  the **seat**, and it is the one field a seat holder changes and the showrunner
  cannot: §6 gives them what you are called, not the ability to make your phone
  ring, which needed a second policy plus 0033's trigger shape (RLS answers
  *which rows*; the question is *which column*).
  Stage 15 is **recurring seat billing**: `packages/domain/src/billing.ts`,
  `room-billing.ts`, migration 0045, `STRIPE_PRICE_ID_SEAT`. **An unpaid room
  never locks anybody out of what they wrote** — the only thing a lapsed
  subscription stops is *taking another seat*, and the refusal itself says so,
  because a showrunner reading a payment failure is at the worst moment to be
  guessing. Billed from **acceptance, never invitation** (charging for one would
  be charging for an email), and the gate counts the room as it *would* stand.
  The quantity is **set, never incremented** — a retry can apply an *add one*
  twice — which is what lets `setQuantity` fail safely and self-heal at the next
  seat change, and why *what Stripe was told* is stored apart from *what the
  room needs*. Stripe's own Checkout and Portal rather than an invoice screen
  here. **The Stripe half is not proved live**: no seat product exists yet, and
  until one does a room reads as it always did.
  §19 says what each built stage does; §15 is the build order; §21, §22 and §23
  are stages 13–15.
  `addendum-08-character-creator.md` is the Character Creator, the first module
  of the Research room, from Ken's own dev spec. **Complete: all ten stages
  built, plus stages 11–14 — the way in, the map and the review reading
  the script, and the rail — and §11's two leftovers, the scene range and the
  drag** (0–5 were his MVP) —
  `packages/domain/character-creator.ts`. Two decisions carry it: **a trait is
  not characterization** (*greedy* is telling, *leaves a small tip* is showing,
  so the unit of work is the characterization item and a trait is a folder for
  them), and **used is a reading, never a stored flag** — derived from usage
  links every time, so deleting a beat turns an item red by itself and moving a
  scene changes nothing. `retired` is stored because it is an intention no
  reading can discover. Stage 1 is the six tables (migration 0039, with **no
  `used` column anywhere** — the absence is load-bearing) and the round trip
  through `sync-mapping.ts`; the test that matters is that an item stays green
  on the second machine, since the claim the module makes to a writer is a
  colour. `ProjectRows` is now **derived** from `SYNC_TABLES` and `gatherRows`
  assembles a fetch, so a new module's collections cannot be named in one list
  and forgotten in another — which read back as nothing, after which the push
  took nothing for the truth and deleted the server's rows. Stage 2 is the
  screen (`CharacterCreator.tsx`, reached from the **Cast** section of the
  research side menu — see stage 11): traits down the side and the *ways one of them gets shown*
  in the middle, because the characterization is the work and the trait is only
  the folder. The behaviour to protect is that **removing a trait unfiles its
  characterization rather than taking it**, and the colour is never computed in
  the component — `characterBoard` reads it off the usage links, so cutting the
  beat turns it red with nothing running. Migration 0040 adds `tags` to a
  character: §5's Overview asked for it and it was the only field with nowhere
  to live. Stage 3 is pinning (`pinUsage`, `whereItAppears`, and the **Where**
  panel the state on a row opens): **there is no "mark as used" anywhere in the
  module and there never will be** — a writer says *where* something landed and
  the colour follows from the manuscript, which is §2 made operational. The
  scene is worked out from the beat rather than asked for, naming a line is
  optional and copies it as the quote, and a pin to writing that has gone keeps
  its row struck through, because the red needs an explanation. Stage 4 is §8's
  one to protect — the right-click in `BeatBody.tsx`, so it works everywhere the
  manuscript is edited: `captureFromScript` makes the trait if one was named,
  adds the item and pins it in one call, **and keeps nothing at all if the pin
  cannot be made**, since something born on deck in the beat the writer is
  looking at is the one confusing outcome. The passage arrives editable because
  the item keeps the writer's reading and the pin keeps the page's words. Stage
  5 is the Arc Builder (`arcBoard`, `beginArc`, `moveArcPoint`, and the **Arc**
  tab): a spine read top to bottom, whose **shape is read back rather than
  declared** — a refusal makes it *refused* whatever else is there — and whose
  points split into what is in the manuscript, in the manuscript's order, and
  what is on deck, in the writer's. **The arrows are only on the second group**,
  because reordering something already written would be a control that lies.
  Pinning an arc point turned out to be the same act as pinning
  characterization, so the Where panel took an *owner* and worked unchanged.
  Stage 6 is the module read from the *scene* (`characterWorkIn`,
  `onDeckForBeat`, and `CharacterWorkPanel` under Related Elements): three of
  §10's five bullets were already standing, and what was missing was the
  direction of travel — a writer in a beat asks *what is this carrying*, which
  is the same rows read backwards. **The on-deck queue belongs where the
  opportunity appears**, so what is waiting is offered in the Inspector with a
  press that runs the same `pinUsage` as everywhere else. Stage 7 is
  relationships (`relate`, `relationshipsOf`, `answerRelationship`, and the
  **Relationships** tab): **two lists rather than one**, because §11's
  requirement is that the directions may disagree — *A trusts B while B is
  manipulating A* — and a row per pair would have to pick a sentence. An
  unanswered reading offers *+ The other way*, which opens the reverse **empty**,
  since copying the description across would put the first person's words in the
  second person's mouth. Stage 8 is the mind map
  (`packages/domain/character-map.ts`, `CharacterMap.tsx`, reached from
  **Character map** in the Research menu): **nothing about the picture is
  stored** — the Sculptor's board keeps x and y because arranging it is the
  work, while this is a reading of the relationships, so the layout is computed
  every time and a new character appears without anybody dragging one. One line
  per pair with a label at each end (the promise §3.1 made), and clicking the
  line is the only place in the product where both readings can be edited side
  by side. Stage 9 is cross-character arc links, and it is the stage that
  **built nothing**: §3.1 decided three stages earlier that one of these is
  exactly a story link, so the whole change is `'arc_point'` joining
  `storyEntityTypeSchema`, the eight verbs joining `storyLinkTypeSchema`, and a
  case in `resolveRef` — **no migration**, since `story_links.from_type` was
  always text. The Related Elements box then shows a cross-arc link without
  being told arcs exist, which is the proof the promise held. `arcEffectsOf`
  reads both directions and `arcsTurningIn` wants **both ends in one beat**,
  since that is what makes it one dramatic event. Stage 10 is
  `packages/domain/character-review.ts` and **Character review** in the Research
  menu: **one filter and three readings on top of it**, because §18's search,
  seven filters, story-order review, on-deck report and continuity check are one
  question asked three ways. The two continuity notes are **checkable rather
  than opinions** — a cause written after its effect, and a refusal in an arc
  that never offers a change — because *this character is thin* is not a thing
  software gets to say. Stage 11 is **being able to find it**: the module
  shipped behind a small button on a row inside one folder, so a writer who
  opened Research and looked around correctly concluded it was not there. The
  cast is now in the research side menu by name, one click in, and the Creator
  is a **selection** rather than a layer over one — which is the whole of why
  it stays with somebody: pointing the menu at a person is the same act as
  pointing it at a folder, so leaving is clicking something else and coming
  back is clicking them again, on the tab they were left on. Stage 12 is the
  map **reading the script**: a map that opens empty on a finished screenplay
  has not read the screenplay, so `togetherInScript` counts who speaks in the
  same scenes — **counted, never stored**, so cutting the scene thins the line
  by itself — and draws a dashed line labelled with the count **and nothing
  else**, because *nine scenes together* is a fact and *rivals* is the
  writer's. Clicking one is how they answer, a direction at a time. Focus now
  expands through those lines (without which it was useless until somebody had
  written relationships down); asking for a *kind* drops them, an unnamed line
  not being one. Sharing is *who speaks*, so a silent presence does not
  count — matching names in prose would as often find somebody being talked
  about. Stage 13 does the same to the **review**, which opened on *In story
  order* and said *nothing matches that*: `scriptPresence` is a fourth reading
  and the one it now opens on — scenes, speeches, where somebody comes in and
  goes out, and the longest stretch they are away, all countable and none of it
  a warning, and **arriving late is not a gap**. `cuesWithoutCharacter` and
  `castNeverSpoken` fall out of the same walk. It carried a correctness fix:
  three modules asked *is this cue this character* with **startsWith**, which
  made MARABEL speak as MARA, so `charactersCalled` in `characters.ts` is now
  the one rule (strip the extension, match whole) and returns a *list*, an alias
  being allowed to collide with a name — `castForNewEpisode`'s *carry whoever
  spoke* was the fourth copy and now asks it too, so there is no loose cue match
  left in the domain. Stage 14 is the **rail** and the module by
  name: the research menu now says **Character Creator** rather than *Cast*
  (the feature's name is what somebody looks for after reading about it) with
  the folders moved to the bottom, and `characterRail` is one reading over
  everything a person has — a block per trait, one for the arc, one for the
  notes, every row red or green, each block's heading saying what it still
  owes. Ken asked for a **mark as used** and it is still not there, for §2's
  reason: green is read off the usage links, so cutting the scene turns a row
  red by itself, and a stored flag would make the colour a fact about who last
  clicked rather than about the script. Clicking a red row instead opens that
  work with **Where** already showing, which is what marking it used was *for* —
  one press, and the colour still means something. **A note gets no dot**, the
  same rule pointed the other way: there is no manuscript claim to make about
  something the writer merely knows. The dots are now actually red and green,
  gold-for-used having been the brand's colour for everything and so said
  *done* to nobody. §3
  says what already exists and is only being widened; §8 is the
  build order; §3.4 says why there is deliberately no module framework yet; §10
  says what each built stage does. §11's two leftovers are now built and §11 is
  empty. The **scene range** (§12 of the addendum) is `SceneRange`,
  `charactersInScenes` and `describeRange` in `character-map.ts` plus the
  **Scenes … to …** pair in the map's bar: a track is a *subplot* and a range is a
  *stretch of the script*, so *who is in act two* is a question the track cannot
  answer, and the rule that decides everything is that **a range narrows what
  the script says and never what a writer said** — a relationship has no scene
  number, so dating one would be inventing it. It is positions rather than ids
  (moving a scene into the stretch puts it in the stretch), a backwards range is
  read forwards, and a range covering everything is `null` so a filtered map
  cannot look unfiltered. **Drag and drop** (§13) is `carry-work.ts`: the press
  stays, because the drag does the one thing a press cannot — land work in a
  beat that is *not* the selected one — and **the drop is claimed by a MIME type
  of its own**, so dragging a line of dialogue inside the manuscript is left
  entirely alone rather than swallowed by a beat that prevents every drag.
  `addendum-09-companion-app.md` is the phone, from Ken's own *Companion App —
  Simplified Development Specification v1.0*. **All six stages are built.**
  §1 is the rule the whole thing hangs off — **the phone captures and the
  desktop places** — which is his §12 said from the phone's end, and is what
  lets the app stay a voice notebook: an app that never decides where a thought
  goes needs no folder tree, no cast list and no taxonomy. §2 is the trap:
  **a category is not a destination**. His five (Character, Plot Point, Idea,
  Theme, Arc) are *kinds of thought* said out loud on the phone; the built
  `requested_routing` is *where it goes*, chosen on the desktop — one word, two
  questions, and conflating them puts a folder picker back on the phone. §3 is
  how much already exists, which is most of the plumbing: `capture_items`
  (0003) has eight of his ten fields, `client_capture_id` already makes sync
  idempotent, `capture-queue.ts` writes to IndexedDB *before* sending, and
  `CapturesPanel` is an inbox that does not auto-place. What is missing is
  nearly all *interaction*. §3.1 names the two real fields — `category` and
  `subject_name`, the latter because a spoken name is testimony and `inference`
  is for guesses — and says why `sync_status` stays on the device rather than
  sitting next to the approval `status`. §3.2 refuses to turn an Arc note into
  an arc point, since that is the Character Creator arriving through the back
  door. §5 was the open decision — native or the web app grown — and Ken made
  it: **the web app**. It cost only what it says on the screen, since the build
  order in §6 had been arranged so everything before stage 4 was the same either
  way, and it held: a native app later inherits every other stage untouched.
  §7 says what each stage built: migration 0041's two nullable
  columns, and the **Mobile App** entry in the research side menu —
  `MobileInbox.tsx`, grouped by the five categories, every note draggable. It
  lives *inside* the Research window because that is the only place the drag has
  somewhere real to land (the folders and the cast are already down the left); a
  dialog would have grown its own destination list, which is a menu pretending
  to be a drag. A note dropped on somebody in the cast becomes
  `about_character` — a research note linked to them, **never a second person
  of the same name**, and never a characterization item. The old **Captures**
  page and `CapturesPanel` are retired: two inboxes onto one queue is a bug
  waiting to happen, and that page could not drag anywhere; its slot now shows
  the account panel, which a signed-in writer could not previously reach.
  Stage 2 is `capture-upload.ts` and `POST /api/notes`, where **the shape is the
  permission**: the payload has no field for `status`, `inference` or what a
  note became, so a client that tried has nowhere to try — `uploadToRow` writes
  `pending` itself. The route is thin and the web page still writes to the
  database directly; it exists because §14 asks and because another developer's
  app should not need this project's RLS in its head. Idempotence needed
  nothing: `client_capture_id` has been unique per user since 0003. The capture
  screen lost its **destination** picker and gained a **category** one, which is
  §2 arriving in the interface. Stage 3 is `notes-review.tsx` and migration
  0042: the phone reviews, corrects and deletes **only while a note is still
  waiting** — once the desktop has filed it, it is the trail behind a real
  research item, so `mayStillEdit` decides in the domain, the route gives a
  person a sentence, and RLS refuses underneath both. Reading is untouched, so
  §9's reviewable copy survives. Proved live and rolled back: a waiting note
  could be corrected and deleted and still approved by the desktop; a placed one
  could be neither, and stayed readable. Stage 5 is `project-page.tsx` and
  `/api/notes/projects`: **the app opens on the project list, always**, because
  his §2's *project first* was quietly broken by building it as a picker above
  the microphone — a writer could dictate a minute into whatever was selected
  last. The last-used one is **marked rather than pre-opened**. A new project is
  made by `createProjectFile` + `toRows`, the same pair the desktop's push
  uses, so the phone cannot grow a second thinner idea of what a project is; a
  failed insert deletes the project row and the cascades take the rest, since
  half a project is worse than none. The phone no longer offers **no project**,
  which the column still allows and the desktop still routes. Stage 4 is voice:
  `packages/domain/src/capture-voice.ts` — named that because `voice.ts` was
  already the read-back *voices* of spec §10, a synthesised speaker there and
  what somebody said here. **The browser hears and the domain decides what was
  meant**, so `readSpoken` is testable rather than merely demonstrable, and it
  refuses three things for one reason — a wrong guess is worse than no guess
  when nobody is looking at the screen: only the **opening** of an utterance is
  a command (*the idea is that she never drives* is dictation), a name needs the
  **pause** a recogniser writes as a comma (without one nothing is taken and it
  all becomes the note), and matching is **whole-word**, which is the mistake
  `charactersCalled` was built to stop. A correction **replaces** and hands the
  old wording back, because a model choosing between replacing and appending
  will one day throw a sentence away silently. The screen's largest type is now
  what is about to be filed, **Read it back** speaks it exactly as it stands,
  and the line under the buttons names the five commands. §8 is **dictation at
  the desk** — spec §9's first bullet, built here because it shares the reading:
  `packages/domain/src/spoken-script.ts`, and the fact that makes it necessary
  is that **Return and Tab are handled on keydown and dictated text never
  presses a key**, so without it a spoken scene lands as one action paragraph
  with the newlines buried in it. The clipboard has had the answer since the
  reformat tool — text arriving in bulk becomes typed elements — and dictation
  is a paste through a different door. **A command is a sentence of its own**,
  so *Scene heading* starts one and *the action was over by then* does not; a
  cue is the one thing edited rather than transcribed, because the cast is noted
  from cues and *Mara.* would file a second, punctuated person. **Which
  recogniser there is gets answered by trying**: the API is present in Electron
  and does not work there, `window.vcwriter` is deliberately identical in both
  so it may not be sniffed to guess the platform, and the first network failure
  is the answer — after it the app names the system's dictation, on which *new
  line* works and naming a style aloud cannot, and the interface says so. The
  control is opt-in per surface (`dictation` on `BeatBody`), the Script drawing
  every beat with one having put nine of them down a short script.
  **§8a is a button in the corner and the help in its tooltip**, from Ken (*the
  dictate should be a button in the corner that you can turn on and off, with a
  little microphone that says dictate… a tooltip comes up with the instructions
  that are now shown on the screen. It would be too distracting for a writer*).
  He is right and the reason is worth keeping: §8's line naming the five spoken
  styles was **standing prose under somebody's manuscript**, a permanent
  reminder of how to use a tool they may never press, where all a writer needs
  on the page is a way in and a light saying whether it is listening. So it is a
  small pill with a microphone that **fills while the recogniser runs**,
  `aria-pressed` either way so the state is said as well as drawn, and the
  instructions in its `title`. **It stands in the top corner of the paper, out
  of the flow entirely** — two other arrangements were driven first and both
  were wrong in ways only the screen showed: sticky at the foot put it an inch
  under the first line on a short beat rather than in any corner, and giving the
  column a page's height to push it down **stretched the empty-state button into
  a block half the sheet tall**, the column being a grid whose one row then
  filled the track; the sheet's top inch is blank margin, so it stands there and
  never moves as the writing grows. **Absent rather than greyed** where the app
  cannot hear for itself, a disabled *Dictate* being a control that can only
  refuse — a test asserted that before the change and caught the first draft,
  which had left a greyed button there. **§8b is the parenthetical that grew a
  bracket**, from Ken with a screenshot: he said *parenthetical*, then *lifted
  the gun*, and got `() lifted the gun)`. **The brackets are the program's
  furniture and the words are the writer's**, and `insideParentheses` — the one
  function that separates them — stripped from the outside in a loop that could
  not clear a bracket which had become the **first** character: an empty
  parenthetical is `()`, words joined onto it make `() lifted the gun`, taking
  the leading `(` off leaves `) lifted the gun`, which neither half of the
  condition matches, so it came back with the stray one in it and was wrapped
  again. Every bracket comes off now, which is **idempotent by construction** —
  what `retype` needs when asked to turn a parenthetical into a parenthetical,
  and what a phrase dictated in two utterances requires; nothing is lost, a
  bracket inside a wryly being this program's own rather than punctuation
  anybody meant. The general lesson: **a function that normalises has to be safe
  to run twice**, because the thing that runs it twice is never the code being
  looked at when it was written.
  **§10 is hands free**, from Ken (*you can say Project Jinn, character, Tom.
  And then it'll beep and you'll start that note… then you can say something
  that will turn it off without making that word unavailable when you're using
  the notes. Maybe you can say dictate done*). **The design is in the problem
  he stated**: a notebook used while walking cannot ask for a press between
  notes, so the word that *ends* a note must be spoken — and any word that ends
  one is a word you can no longer put *in* one. His answer is the only one that
  scales: **every command is prefixed `dictate`**, so the command vocabulary
  and the writing vocabulary never overlap and a note may contain *done*,
  *idea*, *character*, *project* and *correction* freely, which a test says by
  putting all five inside one note. Two states: **while a note is open nothing
  but `dictate …` is a command**, and **while nothing is open a bare category
  word may also start one** (his *or you can just say idea*), safe there for
  the reason it is unsafe inside a note. `dictate` plus something unknown is
  **said rather than swallowed** — a writer who gave a command believes they
  gave one, and writing *dictate nwe setitng* into their sentence is the one
  failure they will not notice until they are back at the desk. **§10.2 revises
  §2's *five, and no more*** and says why the reason has not gone away: the
  five were for a phone that did not know which project it was in, and the app
  has opened on a project list since stage 5 — so `captureVocabulary` reads the
  words off the format, the structural pair being **the noun table's** (Scene
  and Beat, Chapter and Passage, Section and Subsection) and the cast, places
  and plot **absent rather than renamed** on a textbook. What keeps it a voice
  notebook is not the length of the list but that **nothing is filed into the
  manuscript**, which is untouched. Writing the tests caught what generosity
  costs: offering Ken's *chapter and section* as synonyms at a textbook put
  **`section` on both rungs at once**, so the program's own words win and a
  word that fits neither is kept as writing. Migration 0060 makes the stored
  category **text**, an enum being unable to carry a vocabulary read off the
  format and — worse — refusing at the door a note a newer phone sent, which is
  the one thing `inboxGroups`' *the last group is never hidden* forbids; it
  groups by what is there now rather than by a list in its own file. **It
  beeps** (two tones told apart **by direction rather than pitch**, a walk not
  being a quiet room), **answers commands and never the writing** (reading
  dictation back would talk over somebody mid-sentence), and **never loses a
  note** — every path that closes one files it, the one still open when the
  walk ends is kept, each goes to the device as it closes rather than at the
  end, and the only act that throws anything away says so out loud. **§10.4 is
  a bug in shipped code found by writing Ken's sentence down**: *character,
  Tom* came back with no name, the remainder having been tidied before the name
  rule ran — which strips the leading comma, **the very pause that marks the
  name** — so a name was only found where a *second* pause happened to follow.
  The first fix broke the other direction and the existing tests caught it
  inside a minute: **there are two shapes and both are real**, the pause after
  the name or straight after the category, and one function now says so and is
  read by both the single-utterance reader and the sitting. §10.5 names what is
  staged rather than half-built — making a project by voice, and subcategories.
  **§8c is off the page altogether**, from Ken after using §8a (*move the
  dictate button to just below where it says in script… but off of the page. I
  don't want distractions when people are writing*). §8a moved the instructions
  into a tooltip and was still wrong about the button: it found a corner of the
  **paper**, and the paper is the one surface in this program that should hold
  nothing but somebody's words. Four arrangements were driven in all and the
  first three differ only in *where on the manuscript* it sat — **the question
  was never which corner, it was whether it belonged on the page at all**. It
  does not: it is a tool of the writing screen like the draft picker and *In
  script*, so `writer-tools` is a strip between the bar and the sheet,
  right-aligned under *In script*, empty and of no height until something is
  put in it. **It is a slot, never a second control** (`dictationSlot` on
  `BeatBody`): hearing, reading what was meant and laying the words in all stay
  where they were, and only where the button is *drawn* moves, through a portal
  into the node the surface supplies — a bar that built its own Dictate would be
  a second answer to *is it listening*, free to disagree the moment either
  changed; given no slot it draws in place, which is what every other surface
  gets. White with black text (Ken's): the same paper as the page it works on,
  so it belongs to the writing without being in it, and **listening says so
  inside the box** — a red microphone and a red word — rather than by repainting
  it, a control that changes colour being the movement this was taken off the
  page to avoid. The slot has its own test because it is the one part that can
  **fail silently**: a button that never arrives because the node was not passed
  down looks precisely like dictation not being there at all, which is addendum
  20 §15a's lesson.
  **§11 is making a project by voice**, from Ken the moment the walk shipped,
  and §10.5 had already written the reason it was staged: **a mis-heard *novel*
  makes a document whose chapters are scenes, found out about a fortnight
  later** — a note in the wrong group is a minute's work to move and a project
  of the wrong shape is not. So **nothing is made until a word whose only job is
  to make it**: `hear` stays pure and sets `makes` on the confirming turn, the
  host runs the picker's own route (`createProjectFile` + `toRows`), and a
  project named into a pocket is the same document as one named with a keyboard.
  The name and the kind arrive in any order — in one breath, name first, or kind
  first, a writer who answers the second question first having still answered it
  — and `askAbout` is the **one place** that decides what is asked next. While a
  plan waits the phone is **not taking notes**, or *a novel* would be the first
  line of a note nobody meant to open. **No word is on two formats** and a bare
  *book* and a bare *story* are absent, *book* being a novel to one writer and a
  textbook to the next with no way to ask which from a pocket; a word that is
  not a kind is refused with the list said again rather than resolved to the
  nearest-sounding one, and *dictate done* over a waiting plan is refused too,
  only `yes` being allowed to mean *make it*. `NEW_PROJECT` is read **before**
  `PROJECT`, the filler stripper's *new* otherwise turning *make one* into *move
  to one*. `projectMade`/`projectFailed` live in the domain (a component
  assembling a `Sitting` is a second answer about the walk): a failure **keeps
  the plan** so a retry is one word, a success lets it go **only if it is still
  the one confirmed** (addendum 18 stage 7 — the network answers whenever it
  answers), and offline is **refused out loud rather than queued**, notes said
  into a queued project being addressed to an id that does not exist. Building
  it found the picker **two kinds short** — six formats where the program has
  eight, so *an educational book*, the one Ken named, could not be made by hand
  at all — now one table the select and the list share. And driving it found the
  fault worth keeping: two turns **said nothing**, because `askAbout` named only
  what was *missing* and so repeated the sentence before it, which `speakBack`
  suppresses — **a reply has to differ from the question it answers or it is not
  a reply**, and from a pocket a silent reply is indistinguishable from not
  being heard. It says what landed and then what is missing, the refusal comes
  first with the question after it, and a test walks a sequence asserting every
  turn speaks. Driven on the real screen at 420px with the recogniser and the
  routes stubbed: Tom's note filed first, `{ title, format }` at the route, the
  header changed, five sentences spoken in order, and the next *chapter*
  opening a **Chapter**.
  **§12 is subcategories said out loud**, from Ken, and the audit paid before a
  line was written — research folders have nested since addendum 02 §7,
  `requestedRouting` has outranked every guess in `suggestRouting` since 0003,
  and `inboxGroups` already grouped. So it is one nullable column (0061) and one
  decision, which is §2's trap asked a second time: **a spoken group is a word
  on the note and never a folder in the project**. Letting the phone name — or
  make — a research folder is the phone *placing*, and §1's line is that it
  captures while the desktop places; §2's own sentence is that an app which
  never decides where a thought goes needs no folder tree, so a taxonomy grown
  from a pocket is exactly what it refuses. Saying a group therefore **creates
  nothing** — no folder, no id, no network, so it works offline like the rest —
  and what it buys is that **a walk arrives at the desk already divided**.
  It **sticks**, like the project and unlike a category, which is why one word
  covers six thoughts; it takes **the note in hand** with it (somebody who says
  it halfway through means this one, the only reading whose mistakes are
  recoverable); *group*, *subcategory*, *folder*, *topic*, *under* all mean it;
  **an empty *dictate group* says where you are and changes nothing**, clearing
  having its own command and a guess throwing a group away on half a sentence;
  and `groupsSaid` keeps **one spelling per group** — a reading over the sitting
  — so *marketing* twice is one folder rather than two. **The act makes the
  folder, at the desk**: `groupOffer` says what a press would do
  (`trackRemoval`'s shape) and `openGroupFolder` makes it **under the category's
  own**, idempotent by name (addendum 24 §5n's rule in the act rather than on the
  screen), after which each note goes through the same `approveCapture` a single
  press uses — **the one place the taxonomy grows**, by somebody looking at what
  is about to go in it. The inbox divides **in the order the notes already come
  in** (newest first; *first said first* would have been a second ordering inside
  a list that has one, and the test caught it) and **divides by nothing where
  nobody said a group**, the glossary letters' rule. Driving it found the one
  place two spoken things pull apart — *group casting* then *character, Tom* —
  and **a group narrows a folder and cannot narrow a person**, so the person
  wins and the group is **said in the reason** rather than dropped. It also
  found §10's widening had never reached three places: the upload schema still
  held the five-value enum (so the documented route 400'd a `setting` note while
  the web page took it, and **the test pinning the narrowness is why it
  survived**), `QueuedCapture` the same union the hands-free path had been
  casting past, and the desktop inbox never passed the format, so a scene note
  was headed *Scene or chapter* on a screenplay.
  **§13 is the note that was saved and never sent, and three things round it**,
  from Ken using the phone for the first time. The first is a real bug in
  shipped code and he diagnosed it himself (*there was two notes… because I
  didn't sync it, it didn't save the notes to the review category*): **the typed
  screen has always done `enqueue` and then `flushQueue` and the hands-free path
  did only the first**, so every note of a walk sat in IndexedDB on the phone —
  correctly, visibly, on the front screen where he saw them — while Review,
  which reads the **server**, had none. Nothing was ever lost; it was simply
  never sent, which from the writer's chair is the same thing and worse, because
  the screen said *Saved*. **A queue is a promise that something will go; a queue
  nothing flushes is a drawer.** Sent **per note rather than at the end**, which
  is what the caller's own comment already claimed — a walk that pushed
  everything when it stopped would lose the lot to a dropped connection —
  offline being the one case where a note waits, and it waits written down.
  Then **two categories**: **Dialogue** everywhere a story is written (absent on
  a textbook for the cast's reason, taking a name because *dialogue, Mara* is
  what anybody says about a line, and stopping short of a bare *line* since only
  the **opening** of an utterance is a command, so *line up the shot* would file
  *up the shot*), and **Scene only where the format has not taken the word** —
  §10.2 read twice, a screenplay's unit *being* a Scene so a second key spelled
  the same way is `section`-at-a-textbook again, while a novel's unit is a
  Chapter and a novelist saying *scene* means the dramatic unit inside one,
  which the table had no word for at all. Neither files into the manuscript:
  Scene gets no folder for the structural pair's reason, Dialogue reads as
  **Notes** and deliberately not Characters even where a name was said, a note
  filed under somebody being a claim about them. The finding is bigger than the
  ask — **the typed screen was still offering the five stage 4 shipped**, its
  picker holding `CAPTURE_CATEGORIES` and `readSpoken` a private table of five,
  with Review's chips a third copy, so §10's widening reached the walk and not
  the screen an inch away. **A widening reaches only the callers that ask the
  one table**, §12.5's finding a fourth time; `readSpoken` takes the format now
  and the Review chips read **what is in these notes** (`inboxGroups`' own rule).
  §13.3 is **which projects are on this phone**, from Ken (*it shows you the
  projects that are available and you can go ahead and check mark those… you can
  also uncheck it which will hide it but does not delete it… it does not delete
  it from your hard drive*) — and the audit answers the first word of the ask:
  **there is nothing to sync**, the phone holding no copy of a project, the list
  being read from the account every time and a note carrying an id. What was
  missing is not a sync but a **choice**, a desk with eleven scripts on it being
  ten too many to scroll past in a pocket; and that same fact makes his promise
  true **by construction rather than by a warning**, there being nothing on this
  side a delete could reach. `capture-shelf.ts` holds it: **only what is off is
  written down** (addendum 19 §9v at a project list — work started tomorrow must
  be on it, and a project named into a pocket by voice is the sharpest case),
  **per device** with a browser that has nothing, refused or stored nonsense all
  reading as *everything on*, and `phoneShelfOffer` saying what a tick would do
  in `trackRemoval`'s shape. `describePhoneShelf` is the **one** copy of the
  promise, addendum 24 §5c's reason. The voice lookup reads the shelf through
  the same `shownOnPhone` the list reads, or a component would go on finding a
  project the list had stopped showing. **Deliberately not built and named
  rather than invented**: the settings screen that *deletes those from the app*,
  since with no copy on this side there is nothing a delete could take that
  unticking does not, and two states that look alike is what this project
  refuses everywhere else.
  **§14 is signing in on a phone**, which came before §13 and is how Ken got
  into the app at all (*it just keeps looping me back to the sign-in screen…
  you need to be able to create a password instead of having to always be
  linked in from the email*). **A magic link is bound to the browser that asked
  for it** — the PKCE verifier is in that browser's storage — and a phone opens
  mail in the mail app's own in-app browser, which has none, so the exchange
  fails and the form comes back, which from the writer's chair is a **loop**.
  Nothing was broken: the one mechanism the site had could not work on the one
  device this module is for. So a password is the **fix** rather than a
  convenience, having no handoff between browsers; the link stays, being the
  only way in for somebody who has never set one. **Two ways in, one at a
  time.** Setting one is on the **account page**, only somebody signed in being
  able to (`updateUser` writes to the session's own account), and it is **one
  heading for both** — the first draft chose *Set* or *Change* off a
  `has_password` flag I had invented, and nothing on an account says whether a
  password was ever set, so it says *Password*, true for everybody. The failure
  notice goes **under the form**: measured at 390×780 it put the tabs at 786 and
  the email box at 896, so the writer it is written for saw the explanation and
  none of the form that would fix it — **what they came to do goes first**.
  Supabase answers *Invalid login credentials* both for a wrong password and for
  an account that has never set one, so the refusal names both.
  **§14a is proving the one you have**, from Ken after turning on the
  project's leaked-password protection and its eight-character floor. It is
  worth building rather than merely switching on because Supabase's *Require
  current password when updating* is a **server rule the screen could not
  satisfy** — `SetPassword` sent `updateUser({ password })` and nothing else,
  so flipping that switch would have made *Save it* fail for everybody in the
  server's own wording: **a setting the screen cannot meet is not a setting,
  it is an outage waiting for somebody to find the toggle**. **The field is
  asked for and not required**, which is §14's own finding on a second
  control — nothing on an account says whether a password was ever set (the
  reason the heading is *Password* for everybody), so demanding the old one
  locks a link-only writer out of ever having a first — and
  `current_password` is sent **only when it was typed**, an empty string being
  a different request from one never made and the account with nothing to
  prove being exactly the one that cannot fill the box; the server is left to
  be the thing that refuses. `refusalFor` names the three a writer can act on
  (the password they already have, a wrong current one — naming the empty box,
  §14's *Invalid login credentials* problem again — and the reauthentication
  the other switch would demand) and **passes anything else through
  unparaphrased**, a guess at an unknown code being worse than the server's
  own words. *Secure password change* is **named rather than half-built**: its
  nonce arrives by email, which is the round trip §14 exists to avoid on a
  phone, and the current password already carries what it is for. Driving it
  caught this project's oldest fault in a new place — the hint reached for
  `.muted small` and **`.muted` has never had a rule on this site**, so it drew
  at full body colour between two inputs and read as a heading for the pair
  below; `.field-note` is named for what it is and tucked against its own
  field, because **which control a note belongs to is said by the gap**.
  **§14b is forgetting it**, from Ken reading §14a back (*if they go to reset
  it… you shouldn't have to put in your current password*). He is right and the
  sentence is the design: **the link is the proof**, so asking somebody who has
  forgotten their password to confirm it is asking for the one thing they have
  not got — §14a's field pointed at exactly the person it cannot serve — and
  `/reset` sends `updateUser({ password })` and **no `current_password`,
  ever**. The audit paid again: **it needs no token of its own**, `/auth/callback`
  having exchanged an emailed code for the session cookie since the magic link
  was built, so `resetPasswordForEmail` redirects there with `next=/reset` and
  the recovery session is simply the session — which also settles the page's
  two states, the second being the ordinary one: **a reader who opened the link
  somewhere else arrives signed out**, a reset link inheriting the magic link's
  browser binding exactly. The refusal wording moved to
  `lib/password-words.ts` (two screens set a password and must agree about what
  Supabase's answers mean), while the one sentence **about the screen** stayed
  put — the account page can be told its current password is wrong and the
  reset page cannot, having sent none. **Forgetting is not a third way in**, so
  it is a repair reached from the password form rather than a third tab, and
  driving it caught what that costs done carelessly: on the forgot path
  **neither tab read as selected**, a tablist with nothing lit over a form
  belonging to neither. The sent notice **says the same thing whether or not
  the address has an account**, answering differently being a way of asking the
  site who its customers are.
  **§14c is saying so**, from Ken (*once you get your email login, that you set
  a password, and that it says password set in your account settings… important
  especially for doing teams in writer's room*), and everything but the middle
  clause was built — §14 set one and §14b reset one, and the page could not say
  **whether**. §14's stated reason (*nothing on an account says whether a
  password was ever set*) is **right about the evidence and wrong in the
  conclusion it drew**: the column that looks like the answer,
  `auth.users.encrypted_password`, is written at **signup** for every account,
  including one that has only ever used a link — measured here, **295 of 295
  carry a `$2a$` hash and exactly one has ever signed in** — so reading it would
  not be unreliable, it would be *Password set* said to every writer alive, the
  one wording that sends them to the sign-in form to prove it. What was missing
  is not a column in somebody else's table but **the program's record of its own
  act**: setting a password is something a writer did and is derivable from
  nothing, which is exactly what earns a stored field here (addendum 08's
  `retired`, addendum 24's `deletedAt`) against the two dozen facts this project
  refuses to store because they can be read. **The record is made where the
  password is** — migration 0065 is one column on `profiles` and a trigger
  `after update of encrypted_password` with a `when (old is distinct from new)`,
  so a sign-in and a confirmation do not stamp and **signing up is an INSERT and
  so is not a change**, which is the whole point; a trigger rather than a stamp
  each screen writes, because no client can then claim a password it has not
  got, no screen that sets one can forget, and **the reset page and anything
  built later are covered the day they are written** — `on_auth_user_created`'s
  shape, 0033's answer to a question RLS cannot ask. Proved in a rolled-back
  block on the live project: null after signup, stamped on a set, **unchanged
  after a sign-in**. The linter then caught what 0065 had left out and it is this
  project's own idiom — a `security definer` function with the default grant is
  callable at `/rest/v1/rpc/note_password_set` **by anybody at all**, which 0005
  says of `handle_new_user`, the only other trigger function here, so execute is
  revoked from `public`, `anon` and `authenticated`; the helpers 0005 leaves
  executable are left so because an RLS policy calls them as the invoking role,
  and **a trigger function has no caller but its trigger**. The one rule in
  `account-password.ts` is that **no record is not proof of no password**: the
  stamp began the day it shipped, so there are **two states and not three** and
  no *definitely none*, nothing being able to tell somebody who never set one
  from somebody who set one earlier, and the sentence says a password set before
  this still works and saving it again will show the date — a page that told a
  writer they had none while theirs worked being the one failure that makes them
  distrust everything else on it. The `set` sentence names **where it works**,
  which is Ken's point about teams. Driving it caught this addendum's own fault
  two sections back: the date reached for **`.muted`**, which has never had a
  bare rule on this site (§14a found exactly that and named `.field-note` for
  it), so it drew at full gold — `.password-when` and `.password-standing-note`
  now, measured back at `rgb(163, 148, 111)` — and **the screen argued with
  itself**, the current-password note reading *Leave this empty if you have
  never set one* two lines under *Password set*; it reads the standing.
  **§15 is the notes at the desk**, from Ken in one message, and it opens with
  the fault that made the rest invisible: **`listCaptures` in the browser
  bridge answered `ok([])` — always**. The Research window has loaded the queue
  the moment it opens since stage 1, so the sync he asked for was there and was
  being handed an empty list, which reads exactly like a phone that sent
  nothing; every note he dictated was on the server and the one screen built to
  show them could not see them, **on the one build he actually uses**. The
  desktop talks to Supabase directly and needed nothing; the preview cannot (no
  keychain, `connect-src 'self'`), so `/api/notes/inbox` is **the desk's end of
  the queue** where `/api/notes` is the phone's — `reviewScene`'s argument, the
  gate's own cookie, same origin — and **what stops the two hosts drifting is
  that the part worth getting wrong is in the domain**: `WAITING_STATUSES` says
  what *waiting* means and `captureReviewToRow` what a resolution writes, the
  main process reading that list too where it had its own copy. The categories
  needed nothing, `inboxGroups` having grouped by what is in the notes since
  §12. **Moving and correcting** is three reaches rather than three answers (the
  suggestion, the right-click, the drag), and correcting is **on the way past
  rather than a change to the note** — `raw_text` is the recovery record (§9),
  so the words typed here are what goes *into the project*. **Into the plans**,
  `ApprovalDecision` gains `outline` and `board` and the pipeline needed nothing
  else (the renderer has done `approveCapture` then `resolveCapture` since stage
  1): each is **filed and placed in one act** and **keeps nothing at all** if
  the placing fails (`captureFromScript`'s rule), the outline taking a **row
  that references** the item (addendum 06 §5) and the board a **card carrying
  the words** (addendum 03 §2) — each plan's own rule rather than an
  inconsistency. `filingFolder` is the one reading for where a note goes when
  nobody said, ending at **Ideas** rather than *the first folder*, a
  screenplay's first folder being the cast. And **the shelf answers Ken's own
  objection** (*you'd have to have the sculptor or the outliner up and be able
  to drag it into a specific place*): addendum 06 §3 put Research *inside* the
  Outliner for exactly that reason and §2 put the other plan there too, so the
  phone is a **third source on that shelf** in both rooms — no new gesture, the
  rooms' existing drop targets, and his *or have its own place to where you can
  see both*; a Mobile App room of its own is **deliberately absent**, Research
  being a room and §8's rule being that every room goes to a second monitor.
  `usePhoneNotes` is one reading of the queue for every room that shows it
  (addendum 24 §5j pointed at a fetch), the Research window moved onto it in
  the same change. Driving it caught a sentence that was **not true** — a
  `dialogue` note read *No category identified*, said to somebody who had just
  said one out loud, because `spokenSuggestion` returned null wherever the
  mapped folder was absent and a screenplay has no General Notes shelf — plus
  §13.2's fourth copy one place further on (that function asked
  `captureKeyName` for the format `null`, so a scene note read back as *Scene
  or chapter* on a screenplay), and a tab row where three tabs did not fit a
  210px shelf and *RESEARCH* drew as *RESEA…*.
  `addendum-27-mobile-app.md` is **Notes on the App Store and Google Play**,
  from Ken, and **the audit is most of the answer**: addendum 09 §5 chose the
  web app and recorded why it could afford to — the build order was arranged so
  everything before stage 4 was the same either way, with the consequence
  written down that **a native app later inherits every other stage untouched**.
  It held. The ~2,200 lines of `capture-*.ts` have no DOM in them, so `hear`,
  `readSpoken`, `askAbout`, `speakBack`, `groupsSaid` and `captureVocabulary`
  are **imported rather than rewritten** and every rule the phone follows is the
  one the website follows, under the same 2,500 tests; the four `/api/notes`
  routes exist for this by their own comment; and §14's password sign-in was
  built two days earlier for the same reason one layer out. **What is new is
  the screens and three things the browser was doing.** §2 is the door: **`currentUser()` read cookies and nothing else**, so
  the routes written *so another developer's app should not need this project's
  RLS in its head* could only ever be called by a browser — addendum 09 §15's
  `ok([])` in another shape, **a door built for a caller that could not open
  it**. `serverClient()` reads a **bearer token** now, in one place because
  *who is calling* must have one answer, and the token is **that person's
  session rather than a way past it** (it is forwarded, so RLS applies
  unchanged); a browser sends no such header unless asked, so all fifty-two
  cookie callers read as before. Driven against a stub that answers only for
  the right token: no token 401, a wrong token 401, the app's token 200 — and
  the stub refuses the **table** read without it too, which is what proves the
  forwarding rather than the acceptance. §5 is **why native rather than a
  wrapped page**: web speech inside an iOS web view needs the network, stops
  when the screen locks and cannot be relied on, which is survivable for a page
  somebody reads and fatal for a notebook used on a walk with the phone in a
  pocket — `SFSpeechRecognizer` and Android's own do continuous recognition
  **on the device**, which is also the only way a walk out of signal works.
  `listen.ts` hears and decides nothing. §4 is the queue, **the same interface
  on the storage a phone has** (SQLite for IndexedDB) with §13's lesson built
  in rather than remembered — **`file` writes the note down and sends it**, one
  function, so there is no way to do half of it — and a partial accept marks
  **exactly what landed**. §8's Review says **what is still on the phone**,
  which the website's does not and this must, a walk out of signal otherwise
  ending at an empty list. §9 is what is honestly not done: **it has never been
  run on a device**, the store accounts are Ken's to make (Apple $99/yr, Play
  $25 plus twelve testers for fourteen days on a new personal account), **no
  signing key belongs in the repository**, and a wake phrase and notifications
  are named rather than half-built.
  **§10–§13 are store-ready**, and the half worth keeping is that two of the
  four found something missing rather than something to configure. **§10** is
  `metro.config.js`: a build that cannot resolve the domain is not store-ready
  however finished the screens are, and the line easy to leave out is
  `disableHierarchicalLookup` — pnpm keeps a package's own dependencies under
  `.pnpm/…`, so walking up to find `node_modules` finds the **wrong copy of
  React**, which fails at runtime and reads as the new architecture being
  broken; `eas-build-post-install` builds the domain, because **a package is
  consumed the way it is published or it is not one package**. **§11** is three
  entries added to `brand/logo/icons.mjs` rather than a second cutter, and one
  number: an Android launcher may cut any shape out of the 108dp canvas and
  guarantees only the central 72dp circle, so a square that survives every mask
  has a side of **0.4714** of it — smaller than a logo usually sits, and the
  trade this artwork asks for, the gold frame *being* the mark, so a clipped
  corner is worse than a mark drawn small (the maskable PWA icon's 0.566 is the
  same rule against a different promise, which is why the two differ). The
  foreground is transparent and the black is `adaptiveIcon.backgroundColor`, a
  black square in the image being a second answer to what that colour is; the
  iOS alpha channel needs no handling because Expo's prebuild strips it and
  **the generated set is what is submitted**. **§12** is the privacy policy,
  which did not exist — written the way it is not because the stores ask but
  because **a writer's manuscript is the most private thing this program will
  ever hold**, so *who else can read it* is answered in the second section in a
  sentence; what makes it worth publishing is that **every claim is checkable
  against the code**. Then it said an account could be deleted **and it could
  not**, with nothing missing from the application: `profiles` cascades from
  `auth.users` while `orders.user_id` and `licenses.user_id` referenced it **on
  delete restrict**, so **every customer who had ever bought anything was
  undeletable** — which is exactly the set most likely to ask. Migration 0062
  separates them on the distinction that decides it: **an order outlives the
  account because it is a financial record** (and needs no person attached to
  be one — the amount, the Stripe ids and the date are a complete receipt), so
  `set null`; **a licence goes with the account because it is an entitlement**,
  so cascade. Everything else needed nothing, and addendum 07 §1's *one
  writer's work is never destroyed by another's* turns out to have answered
  what happens to work in somebody else's room years before the question — so
  that, and the receipt, are **said before the press** rather than found after
  it. `POST /api/account/delete` is **one route for both doors** (§2's bearer
  token's whole point) and **one call**, the cascades doing the rest because
  writing the deletions out would be a second answer the first new table would
  forget; the confirmation is the **email typed**, this being the one act the
  graveyard cannot take back. On the phone it is **in the app rather than a
  link**, and building it found the app had no sign-out and nothing saying
  which account it was in — three things a store requires and it could do none,
  now behind **Projects ▸ Account**. **§13** is `docs/store-listing.md`, every
  field filled in rather than described (the copy is the **answer**, a listing
  typed twice being two listings), plus two honest absences: the
  **screenshots cannot be made here and must not be faked**, a mock-up being a
  rejection and a lie about what a writer will see, and the feature graphic
  wants designing. `eas.json` has a **deliberately empty `submit` block** —
  `eas submit` asks at the prompt and stores nothing, which is the only
  arrangement where *no credential belongs in any repository* is enforced by
  the file rather than remembered.
  **§14 is Notes as a paid app**, from Ken (*notes is a feature on the website
  but it's going to be notes app… refer the person to the app store… $49.99 a
  year or $4.99 per month*), sold by **in-app purchase** and covering **Notes
  and its sync**. The decision the rest hangs off is that **the subscription
  adds and never takes**: a desktop licence has carried cloud sync for its own
  project since 0002 and goes on carrying it, so nobody who has already bought
  VC Writer loses anything on the day this ships — addendum 07 §1 pointed at a
  new product, and the thing a subscription bolted onto something people were
  already using would teach them. **Nobody already using it loses it**: `NOTES_FREE_FROM` and a reading over
  `capture_items` — an account whose first note came before the day it became
  paid reads `included`, with nothing to buy and no offer made, asked only where
  nothing is being paid for, **after** a live subscription and **before** a
  lapse; without it the day this shipped is the day the phone stopped sending
  for everyone using it, which is §14.1's rule broken by §14.1's own change.
  **A lapse never reaches what somebody wrote**
  (`NOTES_PROMISE`; there is deliberately no `mayReadNotes`, reading being
  refused in no state — `LAPSE_PROMISE`'s shape), so what it decides is
  **sending, and nothing else**. **Two shops become one vocabulary in the
  domain** — `appleState` takes a number, `playState` a name, and an unknown
  status reads as **expired rather than active**, an answer this build has
  never heard of not being a reason to let somebody in. **The store is the till
  and the website is the advertisement**: the app shows what StoreKit or Play
  Billing charges in the reader's own currency (a plan the shop has never heard
  of **absent rather than offered at the website's figure**), and
  `NOTES_PRICE_WORDS` is one copy of the advertised price for the page that
  cannot ask. Migration 0063 is **a row of its own rather than a licence** (the
  fields differ, addendum 12 §2; and a licence is `not null unique` on an
  `orders` row a store purchase has not got), one row per person, `store` and
  `state` **text** (0060), cascading from the account (0062), with a read policy
  and **no write policy at all** — `room_ai_usage`'s rule pointed at an
  entitlement. `notes-store.ts` asks the shops: **the client sends an
  identifier and never a state** (the shape is the permission a fourth time),
  **not configured refuses out loud** rather than trusting the phone because
  the server has no key, Apple is asked production-first and sandbox only on a
  404, and **no credential is in the repository** — four environment variables,
  named in one file. **One route for a purchase, a restore and a renewal**,
  they being one act; on the client **a transaction is finished only after the
  server has written it down**, both shops replaying an unfinished one, where
  finishing first would take somebody's money and leave them unsubscribed.
  There are **no store notifications yet**, so `worthReVerifying` asks the shop
  **only where the row says it has run out and has not been checked since** — a
  paid-up subscription costs no network and a renewal costs one question.
  `requireNotesCapture` is the **one gate**, §2's argument about `currentUser`
  applied to *may they*, and it forced the change with teeth: **the browser
  capture screen goes through the route now**, a subscription enforced on
  `/api/notes` and bypassed by the page an inch away not being a subscription —
  which also drops `requested_routing` from the send, the desk placing (§1) and
  the route never having had a field for it. A refusal is **kept rather than
  thrown away**, said once at the top rather than on every note. `/notes` is
  the **referral page** in the site's own chrome (the nav has linked it since
  the app was built and dropped a visitor into a chrome-less screen) with the
  app at `/notes/app`; a store link that does not exist is **absent rather than
  dead**, and which button is filled is read from the same fact. In the app,
  **the promise comes before the price**, **Restore is first-class**, **capture
  is never blocked** (a notebook that refuses a thought loses it) and **not
  asked is never a refusal**, offline being the case the whole app is arranged
  around. **The purchase has never been run** — no device, no store products,
  and IAP cannot be exercised from this container; what is proved is everything
  either side of it. Store notifications, offers and family sharing are
  **named rather than half-built**, and the products, keys and store URLs are
  Ken's to make.
  **§15 is four things between here and a submission**, from Ken (*so really
  what's next is to get the app up and running, in the App Store*), and two of
  the four are about **the gap between a feature being right and a reviewer
  being able to see it**, which is this project's commonest finding arriving at
  a store console. **The terms go on the screen where the agreement is made**:
  guideline 3.1.2 asks a purchase screen for the title, the length, the price
  and **functional links to the terms and the privacy policy**, `Subscribe.tsx`
  had four of the five, and the page the fifth would point at **did not exist**
  — there was a privacy policy and no terms. The guideline asks for the right
  thing, which is why it is worth more than compliance: **a term somebody meets
  after paying is one they did not agree to**, so the account page is one screen
  too late. They are **links rather than text repeated on the phone**,
  `Account`'s own stated reason for the privacy link it already had, and writing
  them found the copy that reason is about — **`site()` was written out twice**,
  in `host/api.ts` and again in `Account`, with a third one keystroke away; it is
  exported from `host/api` now, a `site.ts` beside it being a second answer to
  where the site is. `/terms` is written the way the privacy policy is and for
  its reason: **every clause is checkable against the code**, so three of its
  sentences are **read rather than typed** (`DESKTOP_LAPSE_PROMISE`,
  `NOTES_PROMISE`, `NOTES_PRICE_WORDS`), a terms page being the worst place in
  the product for a sentence that has stopped being true — and what it does
  **not** name is the same rule from the other end, the desktop price being
  Stripe's and the machine count being stored on the licence, so both are
  pointed at rather than quoted. A **governing-law clause is deliberately absent
  and named**, needing the entity and the jurisdiction Ken operates from, where
  guessing one would be worse than having none. Then **iPhone only, said rather
  than defaulted**: `supportsTablet` was Expo's `true`, which is not a decision
  and costs a real thing — Apple then expects **iPad screenshots**, and an iPad
  build nobody has laid out is how an app is rejected for a screen never opened.
  The **1024 × 500 Play feature graphic** is **a board in `brand/artboards.html`
  rather than a new cutter**, §11's own argument, `render.mjs` already
  screenshotting every board at its exact size; it says **NOTES** with the
  product name small above it (a listing for VC Writer Notes is not one for VC
  Writer, and every screen of the app is headed NOTES), the mark sits **left of
  centre** because Play draws a play button over the middle wherever a promo
  video is set, and the words are the listing's own subtitle verbatim — rendered
  as a 24-bit PNG with no alpha, which is what Play asks for, and **looked at
  scaled to the 383px a collection draws it at**, which is `icons.mjs`' own
  only-honest-test. The fourth was offered as *arrange the demo account so the
  reviewer never meets the paywall* and **reading the gate corrected it twice**:
  `requireNotesCapture` gates **sending** a note and **creating** a project while
  `/api/notes/projects` says in its own comment that *listing them is not*, so an
  unsubscribed reviewer is locked out of nothing but the one act the subscription
  is for — and the goal was backwards, **a reviewer who cannot find the in-app
  purchase cannot verify it**, *we were unable to locate the in-app purchase*
  being itself a rejection. So the demo account stays **unsubscribed on purpose**
  and what they need is a paywall that **works**, which it does in Apple's
  sandbox. The real need is the twelve closed testers, and **both shops already
  solve it** (Apple's Sandbox accounts, Play's **License testing** list) with
  nothing in this repository changing — worth writing down because the tempting
  alternative is comping those rows by hand, and `notes_subscriptions` has a read
  policy and **no write policy at all** (`room_ai_usage`'s shape): a comped row
  would be a second way to be entitled that no receipt stands behind, carried
  forever and undone by hand on twelve accounts afterwards. **The purchase screen
  has not been looked at** — React Native cannot be rendered here, which is
  `vitest.config.ts`'s own standing argument — so `store-requirements.test.ts`
  pins it by **reading the source**, addendum 31 §4's and 32 §9's idiom, both of
  these failing by being *absent*, which looks exactly like nobody having added
  them. The **screenshots still cannot be made here and must not be faked**.
  `addendum-10-book-index.md` is the back-of-book index, from Ken's ask for
  chapter pages that carry a graphic *"but it goes into an Index"* with the page
  numbers updating themselves. **Built.** Two of the three things he asked for
  already existed — the chapter leaf (addendum 02 §11) and the contents page —
  and §1 draws the line the module needed: a contents page lists the divisions
  in the order they happen, an index lists what the book is *about*,
  alphabetically, at the back. Two decisions carry it. **A mark is an anchor the
  writer places and never a search** (§2): indexing every occurrence would be a
  concordance, and which mentions matter is the editorial judgement that makes
  an index worth having — so `findForIndex` helps somebody mark and marks
  nothing, and the heading is the writer's words rather than the passage's. And
  **no page number is stored anywhere** (§3), which is how *it updates when the
  writing shifts* needs nothing to run: there is no page column in migration
  0046, no *rebuild* command and nowhere to type one, because the index is read
  off the pagination every time. The screen and the printed book go through the
  same `bookIndexOf`, or a writer looking at two answers has no way to tell
  which one the book will use. `packages/domain/src/book-index.ts` is the
  module, `entities/book-index.ts` the two tables — a mark is anchored to a
  passage and a cross-reference is a sentence about the index itself, which is
  why they are not one table with a flag. A run prints as `14–17`, and **a
  principal discussion never merges with a passing mention** because `14–17` set
  half bold is not something type can do. `indexPages` breaks it by counting
  lines, and never leaves a letter alone at the foot of a page. **Add to the
  index…** is on the manuscript right-click beside the Character Creator's (§6;
  named *Index this…* until addendum 20 §17b gave it two neighbours), and
  **Editor ▸ Index…** opens the fourth tab of the Editors page (§7) — which
  shows the three things the printed index cannot: the *marks* under a heading
  rather than only its numbers, **orphans** (a mark whose passage was cut, kept
  and struck through rather than silently dropped), and renaming a heading
  everywhere at once. Absent rather than greyed on a screenplay, everywhere: a
  format with no index has no index, and a disabled control says *not yet*.
  **§8 is building it from the book**, from Ken twice in the same words (*build
  the real index*) — which in this project has meant one thing five times now
  (addendum 20 §15c, §16b, §16c, addendum 25 §4f): the feature was there,
  working, under test, and read from his chair as though it had never been
  built. He was looking at a page headed **Index** with nothing under it, and
  nothing was broken — `bookIndexOf` reads the marks and the page prints them,
  there were simply **no marks**, because the only way to make one was to
  right-click a passage and nobody does that four hundred times. **§2 is kept
  and read properly**: *a mark is an anchor the writer places and never a
  search* is right about what an index is and had been read as *and so the
  program offers nothing to start from*, which does not follow — addendum 25
  §4b's correction in another room, an argument about **where the work comes
  from** dressed up as an argument about what an index is. The audit paid a
  **twenty-fifth** time, on this module's own data: **the writer has already
  placed the anchors, in other rooms**. Every characterization moment pinned to
  a paragraph, every arc point, every theme and motif tagged in the manuscript,
  every moment on a story thread is a `usage_link` carrying an owner, a beat, an
  **element** and a quote — somebody deliberately pointing at a passage and
  saying *this one*, which is precisely what an index mark is, made in a
  different room for a different reason. The index was empty not because the
  work had not been done but because **the work that had been done was invisible
  to it**. So `index-build.ts` has **no search in it, no word counting and
  nothing that reads the manuscript's text at all** — a concordance is still
  refused — and offers a heading per record, the person with the trait under
  them, which is how a two-level index reads and what the record already
  carries; measured on a four-chapter fixture, thirteen pins give **ten
  headings**. Four rules: **only an anchor that names a passage** (a beat-wide
  pin means *somewhere in this scene* and filing it against the first paragraph
  would invent a position, `passageMarks`' own refusal; a **location** is absent
  for exactly this, `usedIn` reading scene headings); **it proposes and never
  files**, storing nothing, so cutting the passage shrinks the offer with
  nothing run; **it adds and never overwrites** *by construction* rather than by
  a check written here, `markForIndex` having refused the same passage under the
  same heading since the module was built — which is what keeps a mark the
  writer made by hand exactly as they left it, **`principal` included**, the one
  thing about a mark only they can know; and **the heading is the record's own
  name and never a rearrangement of it**, inverting *Crane, Silas* out of a
  string being a guess at where the surname is that goes wrong on the first name
  that is not two plain words, with `renameHeading` one press away. The screen is
  **Build it from the book** at the **top** of the Index tab, above the index
  itself, because somebody who opens this page on an empty index has come to
  fill it; a row is the heading, **which room the anchor was made in** (what
  makes it checkable rather than a guess), what a press would do, and the press.
  Driving it caught two. **The sentence must not name the heading** — written to
  stand alone it read *Index 2 passages under Maeve Toller, Dutiful* on a row
  beginning *Maeve Toller, Dutiful*, one answer said twice on one line, so it is
  about the **passages**. And **a route is only a route where it exists**: the
  empty-index line said *Take a heading from above* on a book with nothing
  anchored anywhere, pointing at a box holding one sentence and no headings. No
  migration — a proposal is a reading over two tables that already exist.
  `addendum-28-table-of-contents.md` is **the table of contents, and notes
  filed under it**, from Ken for the instructional book (*there needs to be a
  table of contents… you have a table of contents that you fill out that also
  populates the research section… it'll tell you, like in a screenplay, if you
  used that note or not*). **The audit paid a twenty-sixth time and paid most
  of the structure**: a chapter **is** a `chapter` story marker (addendum 19
  §1), the Outliner has had a Chapter row since then, and `structureNumbers`
  has numbered a book 1 / 1.1 / 1.1.1 with nothing stored since addendum 16
  §15 — so the table of contents is not a new record and not a new screen, it
  is **the chapters the book already has, read in order**. His second message
  (*chapter one Mathematics… subsection 1.1, 1.2, 1.3*) is therefore **already
  built**, and the answer worth giving back is that there are **three** things
  rather than two: the number (derived, nowhere to type it), the title
  (*Mathematics*), and `page.summary`, which is *what that's about*. Where the
  table of contents lives was the one real question and Ken chose the
  Outliner — right for the room's own reason, a second screen defining
  chapters being the fault addendum 20 removed twice (§15c, §9u) — so the
  research room's table of contents **defines nothing and reads**. What was
  missing is one field, one reading, and **one fault that is the more
  important half**: `usage`, `usedAt`, `usedInBeatIds` and `usedConfirmed`
  have been on a research item since 0001 and **nothing has ever computed
  them**, `markResearchUsed` setting a flag by hand — so a note went on
  reading *used* after the beat it fed was cut, which is exactly what addendum
  08 §2 exists to prevent and which the screenplay side has had right since
  the Character Creator. `place` on a research item is **one `StoryEntityRef`**
  naming a chapter or a section, `story_marker` joining `storyEntityTypeSchema`
  the **sixth** time that list has been the whole answer and the first time it
  is a *place in the book* rather than a thing in the story (not called
  `chapter`, a marker being an episode and a story too — addendum 22 §7a's
  rename). Migration 0064 is two columns and no table (`story_links`' shape)
  with **no foreign key**, a note pointing at a deleted chapter reading as
  unplaced by itself where a cascade would rewrite the writer's filing. Three
  rules: **a place is a reference and never a folder** (a folder named
  *Chapter 3* is a second record of one fact — addendum 09 §12 in the other
  direction); **one place, and the chapter above it is a reading**, so moving a
  section moves its notes with nothing run (`divisionSpan` again); and **how
  far along a note is, is read** — `noteProgress` gives **three** lights
  (unfiled, planned, written), Ken's choice and the better one for a textbook,
  where most notes sit in the middle for weeks and a red light that never
  moves stops being read (addendum 18 stage 3's *not crying wolf* pointed at a
  colour). `usedInBeatIds` survives as the **older spelling**, filtered through
  the beats the project actually has, which is the whole fix and what a test
  asserts: the stored flag still says `used` and the light no longer does. The
  screen is **Table of contents**, first in the research menu and on an
  instructional book alone, the chapters drawn as **boxes** (Ken's word and the
  right shape — a box is something you can aim a note at) that **wrap** rather
  than scroll, the Note Sorter's reason; a drop files, `filingOffer` says what
  it would do before it can be asked for and `fileNoteUnder` refuses the same
  things again, a second drop elsewhere is a **move** and says so, and the note
  **keeps its folder**, where in the book and which shelf being two questions.
  Driving it caught four, all of them this project's own lessons in a new
  place: **the title was said twice** (the room's header already names the
  selection), **the room's note count contradicted the boxes** (it counts the
  *folder's* items, so beside boxes reading 1 note each it drew *0 notes*),
  **`1.1. Division` has a stray dot** (books set a chapter with a full stop and
  a multi-level number without one), and **a screen reader heard
  `1Mathematics`**, the number and the title being two elements with only a CSS
  gap between them and a gap not being a space — the box is named by
  `describeContentsRow`, the one sentence that names a row.
  **§4a is the way through to a chapter's own page**, from Ken sending §1's
  second message **three times word for word** — which in this project has
  meant one thing five times (addendum 20 §15c, §16b, §16c, addendum 25 §4d,
  §4f) and meant it again: **everything he asked for was there and none of it
  was reachable from where he asked for it**. Driving it measured that on an
  instructional book *File ▸ Chapter page…* is present (`hasChapterPages` is
  `isProseFormat || series` and `isProseFormat` takes `instructional`) and its
  dialog offers exactly the three things his sentence separates — **Show
  Chapter 1** (derived, nowhere to type it), **Its name** (*Mathematics*) and
  **What this chapter covers** (`page.summary`, the *title of what that's
  about*) — so there was no missing feature and no broken mechanism, there was
  **no route from the table of contents**, which is the screen his sentence
  names, in a panel an hour old: §15a's *a route needs a test per gesture, not
  per screen*, the chapter dialog's nine tests all opening it directly. The
  build is **a route, never a second copy**: a title box and a summary box on
  the panel is the obvious answer and is the fault addendum 20 §15c removed
  from Layout twice, a second pair of controls that name a chapter being a
  second answer to what it is called — so a press and a double-click open the
  chapter page's own screen, **absent on a section**, which has no page. The
  **room owns the dialog** rather than handing the chapter to the workspace
  (addendum 20 §9d): a route that works only while the workspace is in front
  of it is not a route, and every room goes to a second monitor. Driving it
  caught two. **One row, two spellings of its own number** — the box drew
  `1 Mathematics` over a heading reading `1. Mathematics`, §3's full stop
  having reached the sentence and not the thing beside it, so `contentsNumber`
  is the one reading both ask. And **the route ran on mid-paragraph**, a
  control with padding inside a sentence that wraps round it reading as
  neither button nor prose: it is on its own line with its note under it
  (*which control a note belongs to is said by the gap*, addendum 09 §14a),
  and the note has **a rule of its own** rather than reaching for `.small`,
  which has never had one on its own in this stylesheet — that addendum's own
  finding, one stylesheet over. §5 names what is
  **not** built and in what order: a chapter landing on the timeline as it is
  made, a filed note becoming a
  beat under its own chapter and section, and filing in bulk from the Note
  Sorter and the phone.
  **§4b is organising the rough information before it is a chapter**, from Ken
  narrowing §1 (*I just wanna be able to create the chapters and sections and be
  able to take research and organize it per the sections, not actually create
  beats of everything… a list of things… before I start crafting it*) — and
  **it was already built, in the Outliner**, measured end to end before a line
  was written: `+ Chapter`, `+ Section`, `+ Subsection`, `+ Note` and `+ Idea`
  numbering themselves 1 and 1.1, a research note filed **under a section**
  (`addResearchRow` takes a `parentId` and the drop handler passes one), the
  research shelf beside the rows to drag from (addendum 06 §3 put it there for
  exactly this), and **nothing reaching the manuscript** — after a chapter, a
  section and a filed note the document holds no new units, no new beats and no
  markers, promotion being `Add to track`, a separate press. His whole sentence
  is the Outliner's own empty state: *everything here is a plan until you send
  it to the manuscript*. **What was missing is the door**: he keeps saying *in
  the research section*, and this panel named the Outliner twice in prose and
  could not reach it — addendum 10 §8's *a route is only a route where it
  exists*, addendum 20 §15c one room over. *Open the Outliner* is a button here
  running **the same three-way the title bar's own Outliner button runs** (a
  popped-out pane, the Outline page on a book, the room elsewhere), one answer
  rather than a second that could drift, with Research closing behind it. **No
  second screen was built**, §3's decision kept: a Research screen that made
  chapters would be a second answer to what the book's chapters are, the fault
  this room has removed twice. Driving it caught a contradiction nobody had
  reported — the header read **No chapters yet** over a box reading **1. Chapter
  One**, the sentence counting *chapters* and the boxes being *rows*, so a book
  with sections and no markers had two readings of one screen denying each
  other (§3's note-count fault again); it names what is drawn now, in the
  format's own noun, with a test that the sentence may never deny the boxes —
  and the route read as prose rather than a control (§4a's own finding on this
  panel), so it is a raised button.
  **§4c is the Outliner's chapters as boxes, and the drag that had no source**,
  from Ken a third time (*it has a section for the outliner that creates
  chapter one. **We don't need that anymore*** … *just so the outliner chapters
  and sections show up under the table of contents in little boxes… Nothing
  complex*) — and the correction is that **§4b was right that the Outliner
  already does the work and wrong to answer with a door**, a door taking him
  out of the room he said *in the research section* three times about; it is
  gone. The gap was that `contentsShelf` read the **manuscript** — `file.markers`
  and `unitsInStoryOrder` — and a chapter planned in the Outliner reaches
  neither until *Add to track*, which is the whole of what he is doing, so the
  screen drew the one seeded unit and nothing else: **a reading right about the
  manuscript and silent about the plan**, on the one screen whose purpose is
  sorting material that is not written yet. `outline_item` joins
  `storyEntityTypeSchema` — the **seventh** time that list has been the whole
  answer — with **no migration**, 0064 having made `place_type` text for 0060's
  reason, and `NotePlace` gains a `plan` kind with `placeKey` the one string
  that identifies all three. The shelf is **two groups**: a row that has become
  a chapter is **listed once** (`boundMarkerId`/`boundUnitId`, checked against
  the records actually there, so a chapter deleted from the book brings its plan
  box back rather than leaving the row drawing nothing), they are **never
  interleaved** (a plan has no place in the story order, and a list that guessed
  would stand an unwritten chapter between two written ones), and each is named
  on the screen with the second heading appearing only where there is a first to
  tell it from. **Filing against a plan changes nothing in the Outliner**,
  Ken's own sentence, asserted by a test that the outline's items are what they
  were. **`placeNow` is the half that would otherwise lose a morning's
  sorting**: a plan row drops off the shelf the moment it is bound, so a note
  filed under it reads as filed under whatever that row *became* — nothing
  rewritten on promotion, nothing stored, and where the binding names a record
  that has gone it answers with the plan again, which is this module's *one
  place, and the chapter above it is a reading* pointed at the binding. Driving
  the real room found the fault no test could: **there was nothing to drag** —
  this panel takes the whole of the room's middle, so while it is showing the
  note cards are drawn nowhere and the boxes were a drop target with no source
  on the screen, which §4's own test (supplying `dragging` as a prop) is exactly
  the shape of test that cannot see. So the panel carries a **shelf of what is
  not placed yet**, addendum 06 §3's reason one room over, absent once
  everything is placed; **what is in the air has one answer** (the shelf tells
  the room rather than keeping a second piece of drag state), the chip is **one
  control with two doors** (the drag Ken asked for, and a press into the chosen
  box, which is the only path a keyboard can reach), and with no box chosen the
  press **opens the note rather than refusing**. Two more things only looking
  caught: **the dashed edge said nothing** (a dash pattern in `--border` against
  a near-black panel is a solid line from a foot away — the colour goes with the
  style, addendum 02 §4b's `.ghost` fault the other way round), and **the first
  group was unnamed while the second was named**, so the book's own chapters
  read as the screen's preamble.
  **§4d is the section the project is born with**, from Ken sending §4c's ask
  back **word for word** minutes after it shipped — and the stale-deploy
  explanation was checked first rather than offered: `apps/web`'s `prebuild`
  rebuilds the renderer on every deployment and nothing is checked in, and the
  shipped bundle carried the new strings. So **§4c had removed the wrong
  thing**. His sentence is *it has a section for the outliner that creates
  chapter one, we don't need that anymore*, which §4c read as the *Open the
  Outliner* route it had just added; driving a **fresh** instructional book
  straight to the panel — the state anybody is in when they first look — draws
  exactly one box, **1. Chapter One**, which is `createProjectFile`'s seeded
  unit: literally **a section**, literally **called Chapter One**, that the
  writer never made, under a sentence reading *no chapters yet*. §3's and §4b's
  contradiction a **third** time and in the one place it costs most, the box
  being something a writer is invited to aim research at. The rule is that **a
  box is a place in the book and the untouched starting section is not one**,
  and `seedOnly` identifies it **by what has happened to it rather than by its
  name** — a title here is the program's, so a rule about the words would be a
  rule about one seed in one format: a chapter marker on it, writing in it, a
  note filed under it or an outline row promoted into it each make it a place,
  plus the clause that makes it unambiguous, **it is the project's only unit**,
  since a book with a second section has had somebody's hand in it. **Nothing
  anybody made can be caught by it**, which is the half worth testing — five of
  the six new tests are that half. A reading, so it stores nothing and un-hides
  itself. Driven: a fresh book now draws no boxes and says so, and a fresh book
  with two chapters planned in the Outliner draws six dashed boxes and nothing
  else. The keeper: **when the same words come back, re-read the words before
  re-reading the code** — §4c went straight to the mechanism, found a real gap
  and fixed it, and never checked its reading of the one sentence saying what to
  remove.
  **§6 is the note's own screen, in the middle**, from Ken (*when you create a
  note, I would like a dialog box in the center that you can type into, like a
  beat in a script or something, because trying to type it into the sidebar, it
  just doesn't feel right*), and **it is a feeling with a measurement under
  it**: driven at 1440×900, *+ Note* put the writing box at **287 × 204** in a
  320px column pinned to the right edge with **860px of the middle empty**, and
  left focus **on the + Note button** — so the act made a note called *New note*
  and then did nothing whatever to help anybody write it. **The room was
  treating a research note as a property of a selection** when it is a thing
  somebody composes; a beat, a scene, a chapter page and a part all open in the
  middle with the cursor in them, and a note did not. It is the beat's own
  chrome rather than a second idea of what a writing screen is —
  `dialog.note-dialog` **joins `dialog.track-dialog`'s rule** and sets its width
  and nothing else, a third copy of the padding, border, background and backdrop
  being a third answer free to drift the first time a colour scheme changes —
  with the folder's name across the top, **✓ Saved as you type** beside it (a
  writing screen with no Save button has to say why it has none) and a ×.
  Measured after: **760 × 707** with the writing at **726 × 414**, and it still
  stands clear of the foot at 1024 × 700, the body scrolling. **It is not a
  second copy of the aside**: `NoteFields` came out of `Detail` and is **one
  component drawn in both**, writing the same fields through the same
  `onUpdate` — *a second control onto one field* (addendum 20 §16d) rather than
  the fault §15c removed from Layout and §9m settled with `ChapterStyleFields` —
  and the aside was **considered for removal and kept**, being the room's panel
  about the selection, with the actions, the figures and Related Elements beside
  the fields; all it loses is being the only place to write. **Where the cursor
  goes is the act's and not the route's** (addendum 25 §4e's `onOpenCharacter`):
  *+ Note* focuses the title **and selects it**, so the first keystroke replaces
  the name the program gave it rather than appending to it (addendum 20 §16e),
  while a double-click opens a note already named and the **writing** takes the
  cursor; the effect is keyed on the note's id too, opening a second note
  without closing the first being one dialog and two notes. **What the tests pin
  is the gesture rather than the dialog** — addendum 20 §15a, which this room has
  now been taught twice: the screen can be perfect and the complaint stands if
  *+ Note* still leaves a writer hunting for a box, so they assert the cursor is
  *in the dialog* rather than merely focused somewhere, **a dialog nobody is put
  inside reading exactly like the one that was there before**. Writing them
  caught one thing worth keeping: a note's title is also an `<option>` in the
  Related picker, which is the note being **linkable** rather than a second copy
  of it, so the assertions name the card. No migration and no domain change.
  **§6a is the bar moving**, from Ken straight after (*make the top bar
  draggable too*), and **the comparison in §6's ask was load-bearing**: *like a
  beat in a script* was read as a statement about where the screen stands and
  is also one about **what it can do** — a beat's screen has moved on the desk
  since addendum 02 §6d, and a note's screen that looked like one and stood
  still was like it in every way but the one you find out about by reaching for
  it. The build is **one gesture and one copy**: twenty lines in `NoteDialog` is
  the obvious answer and is the fault removed from printing, the face table, the
  running heads and the chapter templates — **a second hand-written drag is a
  second answer to how far the pointer moved and where a screen may stand** — so
  `use-moved-dialog.ts` is `BeatDialog`'s own code lifted out and read by both,
  carrying §6d's three rules as the *gesture's* rather than each screen's:
  **where it stands is kept nowhere** (not the project, which is the writing,
  and not the machine either), **being moved is the one state that places it**
  (a `<dialog>` is centred by the browser, so untouched it carries no style of
  ours at all), and **a control is a control**. That last is the half worth
  keeping, because **the guard existed and was in the wrong place**:
  `BeatWriter` wrote `closest('input, button, select, textarea, label')` out by
  hand on its own bar, so the rule lived in one bar rather than in the gesture
  and the note's header would have written it a second time; `.writer-bar-grab`
  became **`.bar-grab`** for the same reason, a cursor rule named for the
  writing screen being one the next bar copies rather than wears. **jsdom gives
  every box a zero rect, so a drag is exactly what a test cannot see**: driven
  at 1440×900 it opens centred with no inline style, a 260-left drag puts it at
  `left: 80px`, a hard drag at the corner stops where the bar is still
  reachable (x = −31), a drag **from the name box** moves it not at all, and the
  × still closes with the card holding the words. The ⧉ is **deliberately
  absent** — that is §6d's other half and a different gesture, and Ken asked for
  the bar.
  `addendum-11-setups-and-payoffs.md` is Setups & Payoffs, from Ken's own dev
  spec. **Built.** Half of it already existed (the record, its setup points, its
  payoff, archiving — master spec §7.3); what was missing was **the rule the
  spec is about**. Two decisions carry it. **Before the payoff is the only thing
  that counts** — a setup falling after it is an explanation, so it stays listed
  with a sentence saying why it does not count, because a point that silently
  stopped counting is worse than one that says why. And **nothing is stored**:
  `setupReadiness` in `packages/domain/src/setups.ts` counts every time it is
  asked, so dragging a scene across the payoff turns the light red with nothing
  run, and dragging it back turns it green — a cached status would survive the
  reorder and be wrong, which is the same absence the book index and the
  Character Creator's colour rest on. Position is read **to the beat**, since a
  setup and its payoff in one scene is a real thing and *which came first* is
  answerable. `MINIMUM_VALID_SETUPS = 3` is the one place the number lives;
  `minimumSetups` on a record overrides it and `0` means *use the default*. The
  light and the X/3 count are **on the list** rather than inside each record
  (§10), and the under-prepared sort first. The sentence separates three states
  the light cannot — *not named yet*, *one short*, *prepared* — which is what
  stops it becoming noise. **Make this a setup or a payoff…** is the third thing
  the manuscript right-click does; which of the two it is gets the largest type,
  and everything else is worked out from the story order afterwards. The
  timeline track is **a row per payoff** rather than one row of everything: rings
  for the setups, a diamond for the payoff, a rule between them so the gap is
  what you see, and a point that falls after drawn dashed and red where it
  actually is. No migration — an `excerpt` on each point and `minimumSetups` on
  the record live in the project document.
  `addendum-12-themes-and-motifs.md` is Themes & Motifs, from Ken's own dev
  spec v2. **Built.** Nothing of it existed — but §1 is the thing worth
  remembering: the spec asks for *a polymorphic occurrence service*, and one was
  already there. `usage_links` (0039, built for the Character Creator) carries an
  owner kind, an owner id, a scene, a beat, an element and a quote, which is
  every field the spec's §5 lists — so widening `ownerKind` from two values to
  four was the whole of the data work for occurrences. **When a spec asks for a
  general mechanism, look for the one that is already general and merely narrow
  in vocabulary**; this is the third time (arc links joined `story_links` the
  same way). **Two kinds all the way down** (§2): two tables, two collections,
  two tabs, two tracks, two choices on the right-click, and no function anywhere
  that takes *a thematic thing* and works out which. The reason it is true rather
  than merely asked for is that the fields differ — a theme has `arcNotes`
  because a theme **develops**, a motif has `motifType` because a motif
  **recurs**, and neither means anything on the other. A motif may be *linked* to
  a theme and this never merges their occurrence lists: the bell recurring nine
  times does not make the theme nine times explored. **Whether a tagged passage
  still exists is a reading** (§3): `occurrencesOf` works it out from the
  manuscript every time, so cutting the scene turns the occurrence red and struck
  through with nothing running, and orphans sort last because they have no place
  in the story to sort into. **Tag a theme or a motif…** is the fourth thing the
  manuscript right-click does; the kind is chosen first and the list underneath
  is that kind's alone. The two timeline tracks are **never one** (§6): a reader
  *meets* a motif and *understands* a theme, so nine marks mean different things
  on each row and combining them would average the two into nothing — squares for
  a theme, rings for a motif, each group foldable whole. Migration 0047.
  `addendum-13-scene-polarity.md` is Scene Polarity & Scene Purpose, from Ken's
  own dev spec. **Built.** An overlapping feature existed and was close enough
  to feel done — the Story Grid's polarity column and purpose line — and §1 says
  why the difference matters: that column was **one word the writer picks**, so
  a scene could be marked *up* while beginning and ending in exactly the same
  place, and nothing could catch it. **Flat is worked out and nobody says it**:
  `turnOf` reads `start === end`, and there is deliberately no *changed / flat*
  control anywhere, because that is not a question a writer gets to answer. Both
  values start empty because **a scene nobody has read is not a neutral scene**,
  and **the label is the truth while the number is only for drawing** — storing
  `+2` would let the word and the figure drift and would invite arithmetic
  nobody asked for. §2 is the tidy part: `movementOf` makes the Story Grid's
  single word **a reading wherever the pair is given**, falling back to the
  stored word where it is not, so the grid's column, filters and value graph
  improved untouched and an older project keeps the work somebody did. The graph
  (Editor ▸ Scene polarity, and the fourth Editors tab, every format) is
  **neutral-centred** with each scene's start joined to its end, so what you see
  is the *turn*, and the ends joined scene to scene so the handover is visible
  too. **An unread scene is drawn as a gap rather than skipped** — a graph that
  dropped them would draw a continuous story and lie about how much has been
  looked at — and the whole column is the click target, since a scene with
  nothing on it is the one you most want to click. A flat scene gets a red ring
  and a **prompt, never a verdict**. Purposes are **six tags, several true at
  once**, and an untagged scene reads *Purpose not defined. Nothing follows from
  that on its own*. The pair control also sits in the scene's own dialog, which
  is §2's *visible while working inside the scene*. No migration — four more
  fields on the scene grid.
  `addendum-14-locations.md` is Location Research & Scene Integration, from
  Ken's own dev spec. **Built.** A *Locations* research folder held ordinary
  notes and the slugline SmartType offered places already typed; neither is a
  location record. **A location fills a heading in and never owns one** (§1):
  choosing one writes `EXT. MILLER HOUSE - NIGHT`, taking the record's defaults
  for whatever the scene has not said, and from then on the heading is the
  scene's — a scene at the same house in daylight is a scene, not a second
  house, so `setting` and `time` are **defaults, not facts about the place**
  and the screen says so. **Which scenes use it is a reading** (§2): `usedIn`
  matches the place in each heading, so there is no `scene_locations` table to
  drift, retyping a heading moves the scene with nothing running, and §10's
  *unused* indicator and `placesWithoutRecords` — adopt what the script already
  names rather than retyping it — fall out for free. **Several prepared
  descriptions, and an inserted one is a snapshot** (§3): a place is described
  differently the second time it is seen, nothing is inserted because a place
  was chosen, and editing the master afterwards changes nothing already written
  — the only behaviour that makes prepared descriptions safe to go on editing.
  Renaming carries into scene *headings* (a structural line the program writes)
  and never into inserted prose (§4). Reached from **Research ▸ Locations** and
  from a picker in the scene's own dialog, where **New location…** makes one
  without leaving the scene — a writer sent to Research to name a house will
  type the heading by hand instead and the library will be empty forever.
  Migration 0048; the descriptions ride inside the row as JSON, being parts of a
  location rather than records of their own.
  `addendum-15-research-links.md` is Research Links and the story relationship
  timeline, from Ken's own dev spec. **Built.** §16 asks for three record types
  and **two already existed** — the fourth time this project has found the
  general mechanism already built and merely narrow in vocabulary: a **node** is
  a `usage_link` (owner kind widened a third time, to `thread`) and a
  **dependency edge** is a `story_link` with `depends_on`, whose `from_type` is
  text so `thread_node` needed no DDL at all. Migration 0049 is therefore one
  table, `story_threads` — a name, a description and what its connectors assert
  — and nothing else. **A sequence edge is stored nowhere**, and §13 is the
  reason read from the other end: it requires a node's position to be derived
  from script position and never draggable, so if position is derived then order
  is derived, and §16's `sequence_order` would be a second answer waiting to
  disagree the next time a scene moves. **Nothing infers a cause** (§5.2): a
  dependency thread draws only the arrows the writer drew, and with none drawn
  it says *the order alone is not a cause* rather than falling back to
  chronology and calling it a claim — the one exception being the one §12
  permits, a setup and its payoff, where naming the setup *is* the dependency.
  `packages/domain/src/story-map.ts` is §21's ask made real: the track engine
  knows **nodes, edges and a scene index and nothing else**, so it cannot tell a
  setup from a motif, each module contributes rows through one small reader, and
  §19's next track is another reader and no change to the engine or to anything
  that draws it — the screen has one `TrackRow` used by all four. **One grid**
  carries the ruler and every track on the screen, so §2's *synchronised to the
  scene timeline* holds by construction rather than by two widths agreeing, and
  **Whole story means the whole story fits** (the column is measured from the
  window; a fixed one drew a 154-pixel board in a 1200-pixel pane). Three widths
  rather than §15's four, because act view and scene-range view are the same act
  and the **Scenes … to …** pair does it properly. **Add to Research ▸ Links…**
  is the fifth thing the manuscript right-click does, with §11's *new* and
  *existing* one control rather than two, and it keeps nothing at all if the
  moment cannot be marked. A thread of one is **said, never refused**.
  `addendum-16-instructional-mode.md` is Instructional / Book Mode, from Ken's
  own dev spec. **Built**; §8 of the addendum lists the three things left, all
  of them optional halves. §0 is the audit that shaped everything:
  §11 lists eight entities and **six already existed** (a Chapter is a
  structural unit, a Section is a beat, a ContentItem is a manuscript element, a
  GraphicAsset is an asset, a Relationship is a story link — the fifth time),
  and §5's mind map is the Sculptor, §6's Outliner is built, §8's Book View is
  the Script already rendering prose. Migration 0050 is one column and one
  table. Stage 1 is the precondition: `format === 'novel' || format ===
  'short_story'` was inline in **twelve places** and one had already drifted —
  `render.ts` asked `format !== 'novel'`, so **a short story was being laid out
  with screenplay geometry**, a live bug this fixed. `formats.ts` now holds
  `isProseFormat` and `isInstructional`, and `nounsFor` is how §14's *never
  forced to work around Scene, Beat or Script* is kept: **nothing names a unit
  itself**, so a surface that forgot is one still saying "Scene". An
  `isBookFormat` was written and deleted because every use was wrong — a short
  story is prose, keeps chapter units, prints chapter pages and has an index, so
  *more of a book than a short story* had no honest users. Stage 2 is the
  shelves (General Notes, Ideas, an **Imported inbox** that is a real
  shelf rather than a modal) and `source` on a research item — **the one field a
  nonfiction author cannot work without and a novelist never needs**, not to be
  confused with `origin`, which has meant *how it got in* since 0003 — plus
  graphics: **a figure is an element of the manuscript, not an attachment to a
  section**, so it paginates and travels for free, and its **number and height
  are both readings** (moving a chapter renumbers; replacing a picture
  re-sizes). Cutting a figure keeps the picture; deleting a picture keeps the
  figure reading as missing. Stage 3 is learning aids, and §10's hardest rule is
  kept **structurally**: two content fields, and **regeneration cannot overwrite
  an edit because it does not write where edits live** — a test runs a hundred
  regenerations over a paragraph and the paragraph survives. Accepting is not
  approving, and accepting hands back what it replaced. Stage 4 is the importer,
  which exists for one sentence of §4 — *never silently discard unsupported
  content* — so **every file gets an entry** and `skipped`/`failed`/`empty` are
  three different answers to the reader. **What splits is what the file says
  splits**: markdown headings do, blank lines do not. The host turns bytes into
  text or a data URI and the domain decides what it becomes, which is §4's
  extensibility made real. Stage 5 is **the interface** (§6a), and the case for
  it is that four things were wrong on the screen with 1550 tests green, every
  one of them found by building a fixture and driving the real renderer. **The
  menu is the taxonomy**: Plots, Setups & payoffs, Locations and the two
  character readings are *absent rather than greyed* on a book, and there is no
  longer a seeded *Graphics* folder sitting above the graphics *library* waiting
  for somebody to drop a diagram into the one that cannot hold a picture. The
  research views read the noun table, so a book no longer says *used in the
  script*. The note importer's classes are `note-import-*` because the
  manuscript importer already owned `.import-warnings` and coloured it red —
  which drew every unread file as a failure, a **collision that made the screen
  lie**. And a figure now draws in the manuscript (`FigureRow`): number counted
  in reading order and nowhere to type one, and **no colour of its own**, the
  manuscript being dark ink or white paper depending on the gear — a caption
  field with its own background was black on black. **Putting a figure in is on
  the right-click**, the sixth thing it does, because the only person who knows
  where a figure goes is the one looking at the paragraph it belongs under; it is
  absent on every other format and on a book whose library is empty. §6c is the
  **vocabulary sweep**, and it is §1's argument arriving a second time in the
  renderer: seventeen components still said Scene or Beat in visible text, and
  **five of them held a private copy of "chapter or scene?"** — one of which
  (`StoryView`'s) was computed and never used, dead code nobody had noticed.
  Everything reads `nounsFor` now. Three things beyond renaming came out of it:
  the **Outliner's kinds are the format's** (a textbook's tree offers Section,
  Subsection, Note, Idea, with Character/Setting/Prop *absent rather than
  renamed*),
  a **book is shown no runtime** (a page of a textbook is not a minute of
  anything), and a **closed scene dialog on a book said "Scene"** because its
  fallback was the literal word. Verified by walking the whole rendered DOM of a
  book, attributes included; the three survivors are all meant (*scene break* is
  the prose term for the divider, *an act in a script, a chapter in a book* names
  both on purpose, *Import a script* reads a Final Draft file). Stage 6
  (§6b) **wires the suggestion**, which had a generator nothing could reach: the
  route is `api/ai/learning-aid` with the Final Editor's three layers, and
  `resolveCaller` moved out of the scene-review route into `lib/ai-caller.ts`
  rather than being copied — §1's argument about a duplicated predicate, applied
  to the one that decides who may spend money. **The request has no field for the
  author's words**, so the shape is the permission on the way out as well as
  back, and what returns is recorded with `suggestAid`, which cannot reach
  `text`. Its own rate-limit bucket, so a morning on the Final Editor does not
  use up somebody's summaries. The button is **absent rather than greyed** when
  it cannot be had and the reason is said **once at the foot**; a section with
  nothing written in it is the other way round, the button present and refusing,
  because that reason is about the section rather than the account. The model
  call itself has still never been run live. **§15 is sections and
  subsections**, from Ken after using it: the nouns are now *Section* and
  *Subsection* (they were *Chapter* and *Section*, borrowed from the novel),
  which was one edit to `nounsFor` and reached all seventeen surfaces without
  touching any of them — the point of having done §6c first, and *the script
  view is now the book view* was already true because `manuscript` already said
  *Book*. The new work is `packages/domain/src/numbering.ts`: a textbook's
  structure **is** its numbering, so section 1 with 1.1, 1.2, 1.3 under it, and
  **nothing is stored and there is nowhere to type a figure** — the fifth time
  this project has made a fact about the work a reading rather than a column,
  so dragging section four above section two renumbers everything with nothing
  run. `sequenceLabel` is **not** this and is the reason the module exists: a
  stored string the FDX importer writes, which the Book view drew as an
  *editable box*, so a writer could have typed *7* against the fourth section
  and the book would have printed both answers. Where a book numbers, the box
  is gone rather than disabled. The outline numbers a **tree** (`outlineNumbers`
  gives a path, 1.2.1), and **a note is not numbered and nothing under one is
  either** — a thought parked between 1.1 and 1.2 is not section 1.2, and the
  section after it is still 1.2: the rail's *a note gets no dot* pointed at
  numbering. **The one thing there is to set is *whether*, never *what*** —
  *File ▸ Page setup ▸ Numbering*, absent rather than greyed elsewhere, with
  `describeNumbering` under it saying in words that there is nowhere to type
  one. Driving the real renderer caught three more §6c survivors in the
  Outliner's own bar, all the same failure: **a second hand-written list of
  kinds** still offering a textbook *+ Scene*, *+ character*, *+ setting* and
  *+ prop* — the three §6c says are absent — plus *3 scenes* in the tally and
  *what happens* as the placeholder on a section about refraction. The bar
  reads `kindsFor` now, which is the list.
  `addendum-17-project-home.md` is the project home, master spec **§4** —
  **built**, and found by surveying the master spec against the code rather than
  by anybody asking. It was the one section that existed **only as a data
  model**: `logline`, `elevatorPitch`, `synopsis`, `genre`, `notes`, `status`
  and `posterAssetId` have been on `projectSchema` since the beginning and
  round-trip to the database, and grepping the whole renderer and the whole web
  app for any of them returned nothing. A writer could not type a logline
  anywhere. **This is the opposite of the failure the module audits usually
  find** — there a spec asked for a mechanism that already existed under another
  name; here the mechanism existed under its own name and nobody built the way
  in. §1 is the audit of the dashboard, which was likewise mostly already
  answered: `projectStats` gives the progress and both unresolved counts,
  `writingReport` and `daysOfWriting` give recent work. §2 is the decision worth
  keeping: **where you are is read from the work, not from the window** — a
  selection is a fact about a pane and this application opens one document in
  several, so a stored *current* would be whichever pane was clicked last;
  `whereYouAre` reads the most recently updated beat, and **ties break by story
  order** because six chapters laid out in one sitting carry the same
  millisecond and the first draft answered with whatever was first in memory.
  §3: **the one-sheet is assembled and never stored**, and names what is missing
  rather than hiding it. §4: **status is the writer's and nothing reads it** —
  deliberately not a state machine, because every such rule is a guess about how
  somebody works. The screen is `ProjectHomePanel.tsx` on a **Home** page, first
  on the bar and deliberately not the page the application opens on, with the
  figures **stated rather than scored** (no percentage, no progress bar) and a
  day spent cutting drawn as a day's work in red. §3a is the email action's rule:
  **the request carries fields, never markup** — posting the rendered sheet would
  make vc-writer.com send whatever HTML anybody posted to it, so the server
  builds and escapes it from eight plain strings, and the key art does not
  travel. No migration: every field has existed since 0001.
  `addendum-18-interactive-narrative.md` is Interactive Narrative for video
  games, from Ken's own dev spec. **All ten stages built, and §19's MVP whole** — §10 is the build
  order and §13 says what each built stage does. The audit found **more than half of it already
  exists**: §2.3's central spine is the **story order**, §3's Relationship is the
  Character Creator's two-directional one, §4's edges are `story_links` (whose
  `from_type` is text and whose verb list already holds five of §4.1's twelve),
  §9's chrome is the Sculptor's, §14's tracks are `story-map.ts`, and §17/§18's
  export is the print stack. What is new is choices, conditions, effects, state,
  resources, endings, the simulator and the canvas. Four decisions carry it.
  **The Sculptor is a tree and a branching narrative is not** (§1) —
  `sculptorNodeSchema` has a `parentId` and convergence means two parents, so
  the map is a *second canvas sharing the Sculptor's chrome and not its layout*,
  with the layout **derived rather than dragged** for the character map's
  reason. **A choice is not an edge** (§2), which is the one the module rests
  on: §5 wants delayed and cumulative consequences, and a consequence fifty
  nodes away has no edge to live on — so an *edge* says where the player goes, an
  *effect* hangs on the choice, and a *condition* hangs on the gated element.
  **The spine is the manuscript** (§3), so the prose and the graph cannot drift,
  which is most of what "limited" means in the tools Ken has tried. And
  **reachability is a reading** (§4) — no stored flag, no *validate* button, an
  unreachable node drawn unreachable the moment the choice that led there is
  cut, which is the fifth time this project has made a fact about the work a
  reading rather than a column. §5 is one `evaluate` read by the simulator, the
  map and the validator alike (`applyTray`'s precedent); §6 is state named once
  by id, which is what makes §12's *set but never read* answerable at all; §9
  is the comparison against Twine, Ink and articy; §12 holds the two open
  questions. **Stage 0** is the format: `game` joins `ProjectFormat` and
  `isInteractive` joins `formats.ts` — named for the *property* rather than the
  format, because every caller asks *does this have a graph*. A game is **not**
  a third branch of `isProseFormat`: its manuscript is a script, so the noun
  table's entry is `...SCRIPT_NOUNS` with `work: 'Game'` and nothing else, which
  is the table working rather than failing. Every other format predicate is an
  allow-list, so `hasChapterPages` and `hasBookIndex` refused a game without
  being told. The setup record is short **on purpose** — §2.3's premise is the
  logline, its milestones are story markers already in order, its mandatory
  nodes are a flag on the node — and game type and structure are **free text
  with suggestions, never enums**, with *nothing reading the structure* because
  a hub is a node with many edges back and the engine cannot tell it from a
  converge. **Stage 1** is `entities/narrative.ts` + `narrative.ts`: four
  collections and **no edge table**, the only edge being a choice's
  `toElementId`. A choice may have effects and **nowhere to go** (null is legal
  and is what makes a delayed consequence expressible); convergence needed no
  word; renaming a state renames every rule because conditions hold the **id**,
  and deleting one takes its rules with it — the one place a delete reaches into
  another record, a condition about nothing being unevaluable and unrepairable.
  `Comparison` was already the room AI's, so a rule's operator is a **`Test`**.
  Four of the eight effect kinds (`unlock`, `block`, `reveal`, `hide`) are **the
  designer's vocabulary over one mechanism**, and `timing` is a **label nothing
  evaluates**, said so in the comment because a field that looks as if it
  schedules and does not is the worst kind. Resources are **one record with a
  kind rather than eight tables**, with `feeds` inverted from how §12 asks
  because a reading can invert a list where it cannot invent one.
  **Stage 2** is `narrative-eval.ts`, and the whole of it is §5's *one
  evaluation*: a second implementation of *is this choice available* anywhere is
  the bug, whatever else it appears to fix. A `PlayState` is held **inside a run
  and nowhere else**, and its element maps read **absent as open** — the
  alternative is a graph where everything is locked until somebody remembers to
  unlock it. **A refusal changes nothing at all** (availability first, effects
  only once the answer is yes), which is what makes the simulator safe to press;
  a **destination is read against the state the choice's own effects leave**,
  because a choice that grants the key its destination requires is ordinary, and
  one whose destination is shut is **refused rather than hidden or entered** —
  hiding makes a door vanish for a reason nobody can see. A `consume` the player
  cannot pay is **a reason the choice is not offered** rather than a negative
  count, and *why* is a sentence built in the domain (`trust_mara is at least
  40`), because a sentence assembled in a component cannot be tested — under
  NONE what is named is what **passed**. `reachable` is §4: no column and
  nowhere to press *validate*, so cutting the only choice that led somewhere
  makes that somewhere unreachable the next time anything asks. It is
  **structural on purpose** — *could the player ever get here* and *can this
  condition ever be satisfied* are two questions, and a validator that called a
  hard-but-possible gate unreachable would cry wolf, which is how a validator
  gets switched off. `depths` is the same walk and is what stage 4's canvas
  ranks by. `Standing` was taken by the desktop's mooring (addendum 07 §14), so
  a node's reading is a **`Situation`** — the second name this module has had to
  step around, for `Test`'s reason.
  **Stage 3** is `narrative-check.ts` and **all twelve of §12**, each a
  `Finding` with one sentence that is the whole of it. Three of the twelve
  collapsed into one function — *missing prerequisite*, *circular dependency*
  and *required before any acquisition point* are **one question asked at three
  distances**, which is the audit habit arriving inside a single spec section —
  and both halves of the answer come off stage 2: `meets` decides whether an
  effect could satisfy a condition, `reachable` grew a **`without`** rather than
  a second copy of the walk appearing here. **The discipline is not crying
  wolf**, because a validator that reports what a designer can see is fine gets
  switched off and then catches nothing: it is deliberately silent about a
  condition under an ANY or a NONE, an `add` or a `consume` of an unknown
  amount (only `set` and `grant` are read exactly), a range a fraction still
  falls into, a dead end the designer has marked, a rule on a node nothing
  reaches, and a state nothing sets at all — that last being the orphan check's
  to name, so *missing prerequisite* is about a state that **is** set but never
  to anything that satisfies the gate. Two words earned their meaning:
  **`endsHere` is what *intentional* means** in §12.3 and **`mandatory` is what
  *supposed to* means** in §12.11, that check being the walk-with-one-node-out
  for the second time. `findingsAt` is §15.2's inspector — a node's own
  findings, its choices' and its rules' — because a warning a designer can only
  find in a list elsewhere is one they do not find, and `describeFindings` says
  *nothing to report* out loud, a validator with an empty box looking broken.
  **Stage 4** is `narrative-map.ts` + `NarrativeMapWindow.tsx`, the **fifth
  room** (`ROOM_PANES`), absent rather than greyed on every format but a game.
  **The layout is derived and there is nowhere to drag**, which is §1 on a
  screen: columns are `depths`, and within a column the **spine comes first in
  the script's order**, so the top row read left to right is the story. The
  honest limitation is said on the screen rather than hidden — *the layout is
  read from the graph* — because a designer will otherwise hunt for the handle;
  they cannot compose the picture, they change it by changing the graph. Every
  mark is a reading from somewhere else: `reachable` and `depths` from stage 2,
  `findingsAt` from stage 3 as a badge **on the node it is about**, the gold
  line from the story order. A node nothing reaches is **placed rather than
  dropped**, a map that omitted it hiding the thing the validator is shouting
  about. Driving the real renderer caught three things 1698 green tests did
  not: **a card the designer had just made was off the screen** (a new node is
  unreachable, so it lands in a column past the right edge — the selected card
  is scrolled into view, the layout not being theirs to arrange), **the entry
  was a gold stripe and nothing else** (a stripe explains itself to nobody, so
  `describeNode` says *starts here*), and **SVG text neither wraps nor clips**,
  so a long name ran out across the canvas. A connection is drawn by pressing
  the node and then its destination rather than by dragging, keeping the screen's
  one rule; the inspector is deliberately modest, WHEN / DO / GO TO being stage
  5's and half a rule builder here meaning building it twice.
  **Stage 5** is `narrative-rules.ts` + `RuleBuilder.tsx` +
  `NarrativeWorldPanel.tsx`. **There is no code box anywhere and the sentence
  is the interface**: a rule *is* the `ConditionGroup` and `Effect[]` stages 2
  and 3 already read, so there is no source text, no parser and no compile
  step — which is §9's *logic without code*, and is what lets `sayRule` write
  the rule back out in English (a sentence can only be written back out of
  something structured to begin with). **The builder never says whether a rule
  is true**, the obvious feature and a lie: at authoring time there is no state,
  because the player arrives with whatever their path gave them — what is
  statically true is the validator's, what is true *now* is stage 7's. Three
  smaller ones: the **value control is read off the definition** (a flag offers
  true and false, so `is mabye` cannot be typed), **effects are ordered and the
  order is the rule** (stage 2 applies them in turn, so *give a key then take a
  key* is not the reverse — hence the arrows and the word *then*), and changing
  an effect's kind **clears its target** when the kind changes what a target is.
  `NarrativeWorldPanel` is the half that made the stage possible at all: every
  condition asks about a state or a resource and **nothing could define one**
  until now. Driving the real renderer caught three layout faults tests cannot
  see — the inspector at 320px **pushed itself off the edge of the window** (it
  is 372 and rule rows wrap), and `.narrmap-choices li` was still `display:
  flex` from stage 4, which laid the rule builder out *beside* its own sentence
  in a column two words wide.
  **Stage 6** is `narrative-economy.ts`, and the audit paid a **sixth** time:
  **§8 was already built**. *Low ammunition makes an assault unavailable* is a
  **condition whose subject is a resource**, which stage 1 built and stages 2,
  3 and 5 already evaluate, check and edit — there is no resource edge to add,
  a resource never having been a second kind of thing, and a test asserts no
  `resourceEdges` collection exists. What §8 needed was a **reading**: a
  designer could write *needs a keycard* in four places with nowhere to see
  that one place gives one, so `resourceEconomy` answers sources, sinks, what
  asks about it and whether it can be had at all — stored nowhere, so cutting
  the choice that grants it turns it unobtainable with nothing run. **§7 asks
  for eight tables of fields and nearly all of them are readings**; the three
  that are not are the only fields added — **`tier`** (an ability granted in
  hour one can be a late-tier ability, so the graph knows where it is handed
  out and not where it belongs), **`upgradeOf`** (nothing in a graph says one
  rifle supersedes another) and **`scarcityTarget`** (an intention nothing
  evaluates). *Optional or required* is read from whether something
  **mandatory** asks for it, `mandatory`'s third use. §9's overlay **dims and
  never hides** — the Sculptor's rule pointed at a graph, where a hole punched
  in the picture is a different game. Deliberately absent: a **duration or
  stacking rule for a buff**, there being no clock to evaluate one, which is
  the `timing` warning kept.
  **Stage 7** is `narrative-run.ts` + `NarrativePlayPanel.tsx`, and it
  **decides nothing** — what is offered, why not, what changes and where it
  leads are `evaluate` and `choose` from stage 2, the same pair the map and the
  validator read, which is what stage 2 was for. Its one decision is what a
  saved path **is**: **a run stores the choices and never the states**. Stage 2
  being deterministic, the counts and the log come back by replaying; keeping
  them too would keep a second answer about a version of the game that may not
  exist — which turns the objection into the feature, since **a recorded path
  that no longer runs is the finding** and the step it breaks at is the one
  that changed. It is also **the module's one stored thing**, and the reason
  holds: everything else is a fact about the work and derivable, while a
  playthrough is what a person did one afternoon. Three smaller ones: **a move
  the rules refuse is not written down** (it did not happen, and recording it
  would break the path from the moment it was walked — the reason is said
  instead), **a replay stops at the break** rather than putting a state on the
  screen no player could hold, and **comparison is where two paths part and
  what the player is left holding**, never the middle, two routes through a hub
  differing in twelve places and meaning nothing by it. Driving the real
  renderer caught §9's *path preview*: the panel worked and **the board beside
  it showed nothing** — where the player stands and the way they came are now
  drawn, both as readings of the run, so stepping back un-draws the line with
  nothing told to. It also caught a component fragility worth remembering: a
  value **caught on its way out of a React state updater** depends on when the
  host runs it, so the refusal is read from the file in hand and the change
  made as a mutation of whatever is current.
  **Stage 8** is `narrative-endings.ts`, and the audit paid a **seventh** time —
  this one **inside the module's own spec**: §7's entity table calls an
  `EndingDefinition` new and it is not, an ending being a node whose kind says
  so, its **hard requirements its conditions**, already evaluated, checked and
  edited by stages 2, 3 and 5. What was missing is half a sentence of §11, the
  *weighted contributors*. **A weight is not a condition**: a group is boolean
  and answers *may this happen*, a contributor answers *how much has been
  earned*, so the two are kept apart all the way down — `conditions` **vetoes**
  and `contributors` only **ranks**, Themes & Motifs' *two kinds* pointed at
  §11. But the **test** is the same test, so a contributor is a `Condition`
  with a number on it and the screen's row is `ConditionRow` with a weight
  beside it. Three more: **scored is read rather than declared** (weights make
  it so; no switch to disagree with the rules), **an ending is a node and not a
  second record** (a join kept in step would let the map and the matrix
  disagree), and **a tie is said rather than broken silently** — `earnedEnding`
  picks because a game must, ranks earned-first then by score then by the
  designer's order, and names what tied, an ending decided by an accident of
  ordering being what a designer hears about from a player. The matrix is read
  off the rules, so an ending that stops asking about the keycard loses its
  cell with nothing run; `unreachableEndings` is **not** stage 3's check —
  that one finds an ending nothing *reaches*, this one an ending no state can
  *satisfy*. Driving the renderer caught two wording faults, one shipped in
  stage 6 (*1 rule ask about it*, *1 thing decide them*), and a scored ending
  with a threshold of nothing now **says so** rather than being defaulted to a
  number nobody chose.
  **Stage 9** is `narrative-reports.ts` + `print-narrative.ts` + the
  **Narrative design** tab of Reports, and the audit paid an **eighth** time:
  **nine of §18's ten reports are readings that already exist** — the choice
  report is `sayRuleLine`, the critical path the story order, branches the
  map's counts, resources and weapons stages 6 and 3, the matrix stage 8,
  errors `narrativeFindings`, a playthrough `replayRun`. So a report is **a
  reading shaped into rows and nothing else**: no report table, no *generate*
  button, nothing cached. Two of the ten are **absent for opposite reasons** —
  the *quest dependency* report because there are no quests (an empty table
  implying a feature), and the *character relationship* report because it is
  the **Character Creator's**, a second copy being a second answer. §17's
  export is **the records with their own ids** (§21's *stable IDs*) rather than
  a flattened shape, since an adapter must be able to say *this is the same
  node the designer saw*; it adds only what cannot be read without this program
  (reachability, distance from a start), computed rather than stored. JSON and
  per-report CSV go to the clipboard, the human-readable report through the
  print stack as `kind: 'narrative'`. Driving the renderer caught the stage's
  one real bug **in code it did not write**: the story-statistics figures were
  the ***else*** of the writing tab, so a third tab drew them underneath its own
  tables — with two tabs the two spellings are the same thing, with three they
  are not.
  `addendum-19-book-outliner.md` is the Outliner as a book's front door, from
  Ken after using instructional mode: chapters, sections and subsections
  worked out first, then put on the track. **All six stages of §9 are
  built** — §12 says what each does. Stage 0 is the × off
  every row, **Delete** and **Add to track** on the toolbar acting on the
  selection, and an ask that says what goes (`whatGoesWithRows`,
  `rowsRemovalQuestion`, `rowsRemovalComfort` in `outline.ts`) with *Just
  unbind it* offered when a chosen row is already in the book; building it
  found three more §6c survivors in the Outliner's panel (*in the script* on a
  book) and a *1 rows* tally. Stage 1 is the **Chapter row**: `chapter` in
  `OUTLINE_KINDS`, offered on a book only (a novel's unit is already called
  Chapter), fixed at the top by `mayHang` in `outline.ts`, Return under it
  making a section; `boundMarkerId` is the third binding (migration 0052) and
  `promoteChapter` in `outline-binding.ts` promotes the sections and then
  places a `chapter` marker on the first, with `BindingTarget` in
  `planning.ts` carrying the two-way rename to a marker. **What a chapter
  covers is `divisionSpan`, a reading** from the marker to the next chapter's,
  which is what lets a second chapter land after the whole of the first and
  *Move the chapter to match* move the span as a block. Found on the way:
  `removeTrack` never let the plans go of what left with the track, and a
  row's Return read a stale selection, so it names its own row now. Stage 2
  is **three levels**: `structureNumbers` has a `chapters` map and numbers
  units `1.1` and subs `1.1.1` under the chapter whose marker fell at or
  before them, a unit before the first chapter unnumbered and `whyUnnumbered`
  saying so under the row's title; `outlineNumbers` reads the same rule at
  the top level; and the contents page lists the sections under each chapter
  (`ContentsEntry.sections`, drawn indented by the print stylesheet and
  `Paper.tsx`), which §6 had wrongly said it already did. Building it found
  two faults in placing those sections, both from a book with no prose yet —
  read by element count, every empty section fell under the last chapter, and
  an empty section pointed at the *next* section's page — so the chapter is
  read from the story order and an empty section stands where the flow
  stands. Stage 3 is the **Outline page**: `'outline'` on the page bar
  between Home and Write, hidden (never greyed) off a book, the page a book
  opens on (an effect keyed on the project id in `App.tsx`), and it is
  `OutlinerWindow` with `page` set — the same component, `position:
  relative` instead of `fixed`, its × *To the Book*, poppable and marked
  away like Editors; the title bar's Outliner and *Window ▸ Outliner* go to
  the page on a book so there is one Outliner and not two. Stage 4 is the
  **chapter page for a book**: `summary`, `template` and `assetId` on the
  marker's page (one JSON column, no migration), the template a **book
  setting with a per-chapter override defaulting to `book`** whose book
  default is *middle* so every existing page draws as it did, the summary in
  the **reading face** whatever the heading wears, the picture from the
  graphics library by id; `chapterLeafContent` in `chapter-style.ts` is the
  one function that resolves the template and the picture, read by the print,
  the preview and both dialogs' sheets. Stage 5 is the **suggested summary**,
  `chapter-summary.ts` and no route of its own: `chapterTextFor` is the
  learning-aid reading pointed one level up (every section the chapter
  covers, by `divisionSpan`), sent through the existing learning-aid route
  and bridge with kind `summary`; `offerSummary` writes `suggestedSummary`
  and nothing else, `acceptSummary` is the one act that reaches `summary`
  and hands back what it replaced, and `summaryRefusal` is the chapter's own
  reason (nothing under it yet), the account's being said once at the foot.
  **Full-page art** is the fourth template (`full_page`, from Ken): the
  picture *is* the page, edge to edge, with nothing set over it — the number
  and the name are in the art — and **Import full page art…** in the
  chapter-page dialog and on the marker reads the file and sets the template
  in one act, the art joining the library on a book; `isFullPageArt` wants
  the template *and* a picture, so the template alone still draws as the
  middle one. §1 is the
  audit and it paid a
  **ninth** time: a `chapter` **story marker** *is* a chapter — it already sits
  above units, carries the chapter page and drives the contents page — so the
  third level is a row in the Outliner that knows it, not a new table. Four
  decisions carry it. **A chapter is a page, not a container** (§2, Ken's
  sentence): promoting a Chapter row promotes its sections and then places the
  marker on the first of them, bound through `boundMarkerId` (migration 0052,
  the addendum's only one); an empty chapter is **refused with a sentence**
  rather than padded with a section nobody wrote. **Add to track is promotion**
  (§3) — the existing `promoteOne` onto the first track with Ken's name for the
  button, on every format, acting on the selection from the toolbar so one row
  and nine are the same gesture; *Send to Script* is retired. **Delete is
  deliberate** (§4): the × comes off every row on every format, Delete is a
  toolbar button on the selection, and the keys do nothing to a row. **The book
  opens on its outline** (§5): on a book the Outliner is a *page* on the bar —
  *Outline*, before *Write* — and the page a book opens on, poppable with the
  Editors' ⧉ marking; elsewhere it stays a room. §6 numbers three deep (1,
  1.1, 1.1.1), still storing nothing; a book with no chapters numbers as
  before, and a section before the first chapter carries no number, said why.
  §7 is the chapter page for a book: a **summary** (reading face; not the
  epigraph), **three templates** (graphic top, middle, bottom) as a **book
  setting with a per-chapter override** that defaults to *use the book's* —
  `minimumSetups`' shape — and the graphic taken from the **library**, so one
  place holds the pictures; no migration, the page being one JSON column. A
  suggested summary is the last stage on purpose, through the learning-aid
  route with its no-author-words rule. Yesterday's rename is a precondition
  it leans on: a lane is a **track** in every module and in Postgres
  (migration 0051, done while `lanes` held zero rows), and the timeline's
  drawing rows are **rows** — `ActsRow`, `TrackRow` — because the code had
  already used *track* for those and one word cannot mean two things in one
  file. That rename fused `.lane-head` into `.track-head`, two classes into
  one of seventeen rules, which no test could see; `.row-head` is the generic
  sticky cell now, and the counts are back to eight and nine.
  **§10 is how the rows are named, and one row shape**, from Ken (*I want the
  sections and subsections along with the chapters to be in title case, or
  sentence case, you can choose between in a setting… sometimes it puts a box
  around it. Sometimes it forces capitalization. Sometimes it does both*). The
  placement he describes was already right; the *but* is the look, and
  measuring five rows on a textbook gave **four kinds with four treatments** —
  a chapter with no box and capitals, a section with a box and capitals, a
  subsection with a box and none, a note with a box of a third fill — which is
  his sentence exactly and no rule anybody could state. **The fault under it is
  that the capitals were `text-transform`**: a row's name *travels*, promotion
  carrying it into the marker, the unit or the beat, so the project stored
  *Mathematics and its parts*, the Outliner drew MATHEMATICS AND ITS PARTS and
  the chapter page printed the stored one — the outline, the timeline, the
  contents page and the printed page as **four answers to one name**. So the
  setting **casts the words rather than how they are drawn**, which is the
  opposite of addendum 02 §12a and for that section's own stated reason: there
  the look belongs to the book and the letters are the writer's *because a
  chapter page's type is not its words*, and here the name **is** what travels,
  so a case kept in a stylesheet is a case the book does not print.
  **Every row is the same box and the type says what it is** — the box means
  *this is where you type*, true of every row alike, so what differs is the
  face, the size and the colour. `outlineCase` on the project (`as_typed` by
  default, so no outline moves), `outline-case.ts`, a select on the bar beside
  the filter. Two words are left **exactly as typed** and both are the writer
  saying what no rule can: **a word in capitals** (*NASA*, *I* — nothing tells
  an abbreviation from shouting, and shouting is theirs) and **a word with a
  capital after its first letter** (*iPhone*, *McDonald*); a hyphenated word is
  the same rule one level down rather than a second copy; and **a colon starts
  a new title and not a new sentence**, the one place the two cases part and
  the commonest title there is. **Choosing it names what is already written**,
  a setting reaching only rows typed afterwards reading as one that does not
  work. Driving it caught the one that mattered: **sentence case lowercased
  *Hans Gruber*** and, because the cast also ran on leaving a box, would have
  taken the capitals off again every time the writer put them back — a control
  that undoes you, and no rule can tell a surname from an ordinary word. The
  answer is a **smaller reach rather than a better rule**: `Reach` is a pair,
  **choosing the case may lower and leaving a box may only add**, since
  somebody asking for sentence case has asked for the capitals off and somebody
  who merely left a row has not. It also caught the bar running **off the
  window** — `overflow-x: auto`, so at 1440 the tally, *Print…*, *PDF…* and
  *Copy* sat past the right edge behind an overlay scrollbar that draws nothing
  until the pointer is in it (addendum 25 §4g on a toolbar, where what is
  hidden is a control rather than a picture); it wraps now, two rows and
  nothing unreachable, which adding a control to it is what made worth fixing
  here. **Not built and named**: a case per kind, one setting naming every row
  being what *make it consistent* asks for.
  `addendum-20-layout.md` is **Layout**, the room where a book is set, from
  Ken's ask for something comparable to Vellum: *enter the trim size and it
  sets up margins, page numbers, headers, footers, spread balancing*, with
  the pages in front of the story and behind it. **All eight stages built**;
  §13 says what each does. Stage 6 is the **inset** — a figure cut into the
  text at a side, `bookPlace`/`bookSpan` on the element that the manuscript
  carries and never reads, and the rule that keeps the cutter innocent of
  floats: **an inset rides in the paragraph it cuts into** (`inset` on the
  block, unbreakable), so the renderer measures the wrapped paragraph whole;
  the float declares the picture's proportions or it would measure as no
  height before decoding; a figure on the spread is tagged with its id so
  pressing it picks it. Stage 7 is `BOOK_PRESETS` — Classic is the defaults,
  Modern and Textbook are patches — and **which is in force is read back**
  (`bookPresetOf`), never stored, so a hand change reads as Custom. The fact
  that shaped it: **everything the program printed was a manuscript** — Courier
  on letter on a character grid — and a book is proportional type at a trim,
  which a character grid cannot paginate. So (§2) the manuscript printing is
  untouched and the room produces a **second document from the same
  elements**, never editing a word; (§3) the trim is the one measurement the
  writer chooses and margins, text block, lines and measure are **readings**
  of it (`book-layout.ts`, the gutter growing with the page count, an
  override stored as `null`-means-derived); (§4) **the browser measures and
  the domain decides where the pages fall** — the domain has no font metrics,
  so `book-typeset.ts` sets each block in a hidden box and reads back a line
  count, and `layPages` in `book-pages.ts` holds every rule (recto starts,
  blank versos, roman then arabic, running heads, widows and orphans, a
  spread cut to one depth) and is tested with made-up counts; (§5) **the
  story is not a part** and a part with a reading behind it stores only its
  place, parts living in `settings.book.parts` by `titlePage`'s precedent, so
  no migration. `print-book.ts` is **one string builder for three readers**
  — measure, draw, print — which is what lets the page on the screen be the
  page in the PDF; the export is the one document whose markup the renderer
  hands to the main process, with the trim as paper. A chapter opens on a
  leaf only where its page carries a device, a summary or an epigraph
  (`opensOnLeaf`, a reading); a chapter-page face of *manuscript* means the
  book's face in the book. Room wiring is the usual five places plus a
  **Layout** title-bar button, absent rather than greyed off prose. The rail
  (§9) now dresses the book **between the chapters**, which Ken found
  unintuitive: each chapter's row carries *+ Picture facing* (a plate before
  it, selected so the inspector asks for the picture) and *Chapter page…*
  (the dialog opened on that chapter, `initialMarkerId`), and a plate that
  faces a chapter is listed where it falls. Focus mode got a **Leave focus ·
  Esc** button and is dropped when a room opens or the page changes, and
  the title bar's *Close* (which closed the project) is gone; *File ▸ Close
  project* remains. The title bar's **Save now** is gone too (it was *File ▸
  Save* a second time), and the rooms and Focus are **raised buttons** — the
  base `button` in `styles.css` is raised now, so *Chapter*, *Passage*, the
  tools and the chips got the look without being touched, and `button.ghost`
  is the one that stays flat; Focus draws pressed while it is on. **§6a of
  addendum 02 is the right-click, everywhere**: `ContextMenu.tsx` is the one
  menu the manuscript's lines, the timeline's beats and scenes and the
  Layout rail open at the pointer — an item that cannot be done *now* is
  greyed with the reason in its title, one that does not apply is absent —
  and on a line it offers *Split the scene here* and *New beat from here*
  (the noun table's words) before what the writing can become. A beat
  **dragged onto a track's tail or an empty slot becomes a scene of its
  own** there (`beatIntoNewUnit`), the tails lighting up *+ new scene*
  while a beat is in the air. **Stage 8 of Layout** (addendum 20 §9) is the
  rail Ken asked for: *+ Add a part* at the top as a menu (with *A new
  story* on a collection), × on every part row asked once inline, a
  *Chapter page* row between the chapters carrying the creator and *+
  Picture facing*, parts dragged within their half (`placePart`) and a
  chapter dragged as a block (`moveChapterBlock`, only the moved units
  rekeyed) — the one thing the rail does to the story order, done by moving
  the sections — and the inspector's four groups behind `Fold` headings
  drawn as raised buttons, open or shut per machine. The plate is the **art
  page** now (§8): the picture *is* the page, edge to edge to the trim
  (`.bk-plate-art`, the chapter art's rule), nothing set over it and no
  caption printed — a title page or an index made as artwork carries its own
  words — and it is **one act wherever it goes** (§9): *Art page in the
  front matter* and *Art page at the back* on the Add-a-part menu and *+
  Picture facing* on a chapter's row all open the room's one file dialog,
  the picture joins the library, the page is made where it was asked for
  and the room turns to it; nothing is made until a picture arrives.
  `inFront` on the part is the only new field (`halfOf` reads the chapter
  first), no migration, `read-picture.ts` the one reader, and *Research ▸
  Graphics* is every prose format's rather than the textbook's alone,
  because Ken asked *where is the library*. Then the room was
  **rearranged around what applies to the whole book** (§9): the trim, the
  margins, the type and the running heads are **Book settings…** on the
  bar, one centred dialog behind the same `Fold` headings, and the
  inspector is the selection's alone; **a part opens in a dialog of its
  own on a double-click** (its row, or its page on the spread) with its
  fields on the left and **the page as the book sets it** on the right —
  `PagePreview` draws the part's laid pages with `renderBookPage`, the one
  builder, so what is seen is what prints; and **pictures cut into a part's
  text** are `insets` on the part (`addPartInset`, `partTakesInsets`,
  `partOfInset` in `book-plan.ts`), which `partBlocks` turns into **the
  manuscript figure's own `inset`** on the paragraph's block, so the
  cutter, the print and the eBook needed no second rule — the twelfth time
  the general mechanism was already there. A picture names its paragraph
  by position and rides in the last one where the text has grown shorter.
  The **spine allowance was already automatic** (`gutterFor` from the laid
  page count, re-laid across a tier); Ken's ask was answered by
  `describeSpine` saying under the margins what it carries and when it next
  widens. Then, from Ken using it: the **half title and the title page are
  designed in the part dialog** — the wording (`settings.titlePage`, the one
  place, so *File ▸ Title page…* agrees; empty means the project's, which an
  import named from the file), *Import full page art…* (`assetId` on the
  part, drawn by the art page's rule), and a **page style** in
  `packages/domain/src/part-style.ts` (`style` on the part; a template read
  back from the placement and never stored, a face, the title's line and the
  lines under it in the chapter page's `Line` control, a rule; a dedication
  and an epigraph take the same). The drop is a spacer in the page's flex
  column, a share of the *height*, where the old `padding-top: 30%`
  measured against the width. The **chapter-page row is editable and
  removable** (its name opens the page; a leaf carries a × that asks), the
  part rows' × is visible rather than hover-only, a popped-out room owns its
  own `ChapterPageDialog` so the row works there, and the **rail drags**
  (`useSplit`, 288px by default, half an inch wider than before). §3a is
  **what the book is called**, from Ken: a project is named when it is made
  and an **import names it after the file on disk**, so
  `lamp-manuscript-final-v3` was on every running head, the contents, the
  title page, the eBook's metadata and the exported PDF. `bookNames` in
  `book-layout.ts` is the **one reading** — the writer's title, the
  project's name only as the fallback — and everything that names the book
  asks it, so naming it once fixes all of them at the same moment. It is
  typed in **Book settings ▸ The book** and nowhere else (the title page's
  dialog says what it will print and has a button there instead of a second
  box), the project's name being the placeholder; renaming the book never
  renames the project. **§3b is the margin standard**, from Ken in two
  goes — first *margins for novels should be standard with at least .75″ on
  the open edge and .9 on the bound edge, please verify*, then, after seeing
  that built, *the proportions need to be appropriate for the book size, here
  is the standard*, with the published table. **The table is the rule now and
  it corrects both earlier answers, his own first figures among them**, which
  is the part worth keeping: the same mistake was made twice in opposite
  directions. §3's rule was a **proportion** of the trim and gave a paperback
  too little (a tenth of a 5 in page is 1/2 in of fore-edge whatever the book
  weighs); the first fix put a **floor** under it, one pair of numbers for
  every trim, which merely moved the error — a mass-market paperback got 3/4 in
  of fore-edge out of 4¼ in of paper, a fifth of the page thrown away on each
  side, and the 5 × 8's measure fell to 45 characters. A proportion is wrong
  because **the ink does not shrink with the paper**; a single floor is wrong
  because **the paper does not stop mattering**. The standard is neither: it is
  **a band per page size** — pocket 5/8–3/4 inside and 1/2 outside, digest
  3/4–7/8 and 1/2–5/8, trade 3/4–9/10 and 1/2–5/8 — and the jump from a pocket
  book to a trade paperback is a quarter inch of trim and an eighth of an inch
  of margin, which no proportion produces. `MARGIN_STANDARD` is that table and
  `trimClassOf` picks the row **by area rather than width** (how much paper is
  in the hand is what the rows are about), putting a B format with the 5 × 8, an
  A5 with the 5½ × 8½ and a Royal with the 6 × 9. Three of the standard's own
  rules place a book inside its band, each with a test over every trim at every
  thickness: **the thicker the book the wider the gutter** (the inside walks its
  band — on a trade paperback the standard's own 3/4 to 150 pages, 13/16 to 300,
  7/8 past that — and nothing is stored, so a book that grows re-reads it),
  **the thumb factor** (the outside never under 1/2 in, which is the bottom of
  every band rather than a computed number) and **optical centring** (the foot
  always wider than the head). A range takes its **middle**, the ends being
  tolerance rather than two right answers, and everything lands on the
  **sixteenth** so a margin prints as a fraction — which is why the standard's
  0.825 appears as 13/16. Two things the table does not cover are **said rather
  than pretended**: the `large` row is extrapolated, the standard stopping at
  6 × 9 because novels are what it is written for, and a custom trim bigger than
  a workbook gets the old proportion back as a floor on the **sides alone**,
  with a coefficient that bites on nothing in the preset list. `describeSpine`
  names the row in force, a derived number being worth little if you cannot see
  which standard made it. The novel trims now set **52–66 characters** to the
  line (the floor had the 5 × 8 at 45). **The head and the foot break at
  5½ × 8½** rather than by trim row, from Ken after the table: the standard
  ranges them over the whole book (top 1/2–3/4, foot 5/8–7/8) and then splits
  it, **5½ × 8½ and smaller taking the bottom of both** to maximise reading
  space and 6 × 9 and larger the middle so the block is not swallowed by white
  — so it is the one place the middle-of-the-range rule does not apply, and
  **pocket and digest share a head and a foot while their sides differ**,
  because *how tall is the page* and *where is the thumb* are not the same
  question and need not break at the same size. That gave a 5½ × 8½ 35 lines
  where the proportion gave 33. The third rule — **a running head or folio
  clears the paper's edge by 1/4 in**, or the printer's trim takes it off — was
  already right and **was not tested**, which is right by accident:
  `headFromTop`/`footFromBottom` are `Math.max(0.25, margin / 2)`, and what the
  test now pins is that those are the **clear space itself rather than a
  baseline** (`.bk-running` is set solid and positioned by `top`, so it is the
  distance to the near side of the line). The doc comment said *baseline* and was
  wrong — a baseline at 1/4 in puts the ascenders 0.14 in from the edge and
  breaks the very rule the field exists for. Measured on the page: the head
  clears by exactly 0.25 in at 5½ × 8½ (the minimum, met exactly, being half a
  1/2 in margin) and 0.34 in at 6 × 9. His *title centred* from the first go was
  measured rather than assumed: it was already exactly centred **on the text
  block**, and what is visible is that it is not centred on the **paper**, by
  half the gutter — correct bookbinding, and what the standard asks for on
  every row. **§7a is the furniture**, from Ken: *the running headers and
  footers need to be adjustable*. The gap was wider than the word suggests —
  §7 gave four dropdowns and **nothing about how any of it looks**, with a
  sentence under them admitting it (*nothing about them is typed here*) — and
  the look was fixed **inconsistently**: the stylesheet set the running head at
  `0.8em` in capitals, then set the *recto* in italic with the capitals off,
  so the two sides differed for a reason neither could state, neither could be
  changed, and a book set in a sans face still printed a serif head. The audit
  paid a **fourteenth** time: a running head is **a line of type**, and
  `LineStyle` has been the record for that since the chapter page, read again
  by the front matter's pages — so `runningHeadStyle` is three `LineStyle`s and
  a face, no new vocabulary, and `lineStyleVars` came out of `chapter-style.ts`
  as the one place that decides what a line's fields mean (two private copies
  before; this would have been the third). Three decisions carry it. **Three
  lines rather than one** — the verso, the recto and the folio are set
  separately, because the hard-coded difference between the first two was a
  real convention rather than an accident, so the **defaults are exactly what
  the stylesheet printed** and the whole domain suite passed without a test
  being edited, which is the proof. **One list of contents for both sides**,
  where there were two enums neither of which could say why it refused the
  other's, now five with `custom` among them — the writer's own words, a series
  name or a part's — whose box is **absent rather than greyed** unless that side
  carries them, a box for words the page will not print being a control that
  lies. And **a size in points rather than a share of the body**: `0.8em` grew
  when the body grew, and a running head is furniture rather than text; this is
  the one thing an existing book reads differently, and only off 11 pt. Two
  smaller ones: the head gained a **place** (centred, outer or inner), whose
  absence was the plainer asymmetry — the footer could be placed and the header
  could not — with `headSideClass` reading which physical side that is from the
  page; and the folio gained **`none`**, a book with no page numbers at all,
  which still *counts* its pages (the contents and the index read the count)
  and merely prints none. Deliberately **not** adjustable: how far into the
  margin they sit, which stays `margin / 2` clamped to §3b's quarter inch,
  because a control there can only put a running head under the printer's
  blade.
  **§7b and §7c are which title goes on which top**, from Ken on a collection
  (*there needs to be another category called chapter or story title… right
  now, if you add a book title, it adds it to both sides of the page for some
  reason. There's no way to determine the title on one side or the other*),
  and the audit paid a **thirtieth** time by paying his first sentence
  outright: §7a's whole argument was **one list for both sides**, `chapter` is
  one of its five and the room names it in the format's own noun, so the select
  has read **The story's title** since the day it shipped and both sides have
  been set separately for just as long. **What is wrong is where that pair
  stands.** Measured: Book settings is **2,662px of dialog in a 760px window**,
  the title is typed at y=107 under a sentence reading *the title is on the
  **running heads***, and the pair that decides which top was at **y=1,409** —
  1,300px down, behind a scroll nothing announces, under a printer's word for
  the thing a writer calls the top of the page; §15c's fault in a bigger box
  and §9u's from the other end. **And *for some reason* is real**: a collection
  of one story imported from a file is named after that file and so is its
  story, so pointing either side at the book's title prints **the same words on
  both tops** with nothing saying the right-hand one is the story's. **§7b
  answered with one select naming both tops at once and that was the wrong
  answer** — Ken sent the ask back word for word, the ninth time in this
  project, and the correction is that a combined row is **the same shape as the
  complaint**: a single control deciding both sides, which cannot be
  *determining the title on one side or the other* however well it reads.
  **§7c is two sides, two controls**: *Top of left-hand pages* and *Top of
  right-hand pages* in **The book**, beside the titles they choose between,
  each offering the same five with the words box under whichever side carries
  the writer's own. Three decisions. **It is the pair moved, not copied** —
  §7b left the originals in the furniture fold and added a second control over
  the same two fields, which is two folds offering one choice, so the furniture
  fold keeps what it is for (the place, the folio, the face, the three
  `LineStyle`s) and **says rather than sets**, carrying the sentence and a line
  naming where the choice is made, with `HEAD_ARRANGEMENTS` and its readings
  **deleted rather than left as a second way in**. **The labels carry the fact,
  so no heading does** — they say both which side and which edge, his own *the
  other top of the page*, and a heading over them would be the fact said twice
  (addendum 33 §1) under a fold head that is already a tracked-capitals shout
  (§9n). And **nothing names a unit itself**, each select reading `nounsFor`.
  What stays from §7b is the measurement, the diagnosis, and **the sentence
  that says what the two tops will actually print, in the book's own words** —
  *“Harbour Tales” on the left, “The Harbour” on the right*, or *Both tops read
  the same words*, which is the half that answers *for some reason*, a
  **category** never being able to show it where the **words** can; it names
  the category (*each story's own title*) where there is no division yet rather
  than inventing one. Driven at 1440×900: the two selects stand side by side at
  **y=365** inside *The book*, the furniture fold holds **no second pair**, and
  versos read *Harbour Tales* with rectos *The Harbour* then *In For A Pound*.
  Looking at it caught this project's oldest fault a **fifth and sixth** time —
  **`.field-note` had a rule on the website and none in the renderer's
  stylesheet** (it has one now, measured back at `rgb(163, 148, 111)`), and
  §7c's own first draft wrote a heading with **`.layout-subhead`, which has no
  rule either**, after which the heading was deleted rather than given one; the
  furniture fold's opening line also had `.field-note`, which is *tucked
  against the field above it*, and wears the lead-in's class instead. The tests
  pin the **gesture** rather than the control (§15a) — each side has **its own**
  control, both stand in the **same fold as the Book title**, and there is **no
  second place** to choose — assertions that fail before §7b and after it
  alike.
  **§9y is three complaints of three different shapes**, from Ken the same
  morning. **A page of art replaces the page, not the kind**: *Import full
  page art…* is offered wherever a page prints type of its own
  (`partHasStyle`, every kind but a plate) and only the four whose placement
  is a `block` ever **read** `part.assetId` — so on a contents page the
  import was taken, the button changed its words to *Import other full page
  art…*, and the page went on printing its entries. §16a's lesson pointed the
  other way and it is the worse half: **a gate that accepts what the printer
  never learned to draw**, where a refusal at least says something. One guard
  in `partOwnBlocks` asks `partPlacement(kind) !== 'block'` — **a predicate
  rather than a second list of kinds** — the four that already work are left
  byte for byte as they were, the rest take **the plate**, the one art markup
  since §8, and **the page keeps the side it would have taken** (a contents
  page a recto, a copyright page a verso), the art replacing the page and not
  its place; it is a **mode rather than a deletion**, `partModeOf` reading the
  asset back and *Set the words instead* putting the entries back. **The
  division in force is a fact about the story**: measured before a line was
  written, the recto set to *The story’s title* printed **Contents**, because
  the part's own name sat in the slot `headTextFor` reads the division from —
  one field carrying two facts, with the story's own pages right throughout,
  which is why it showed on one page and read as the setting not working.
  `divisionOf` reads **`partId`**, which `bookPageRows` has read for exactly
  this since §9h, so a part's page carries **no** division title and a side
  set to it prints nothing rather than something else under its name
  (`describeHeadTops`' refusal to invent a title, one layer down) — which also
  stops the leak that let *Contents* reach a page of the story at all, a block
  with no title of its own leaving the last one standing. The **cost is named
  rather than hidden**: a foreword's second page and an index's pages lose a
  running head nobody asked for, it having been the default recto content
  finding the part's name in the division's slot; *Words of your own* is
  untouched, being the one content a part's page still carries because the
  writer said exactly what to print. **Both titles are typed where the choice
  is made**, which is §7c's own argument finished — the tops choose between
  two titles and only one could be typed there, and an imported book is named
  after its file **and so is each story in it**, so the right-hand top printed
  `ken-harbour` with nowhere on that screen to say otherwise.
  `DivisionTitleRow` writes `updateMarker`, **one field with two doors**
  (§16d) rather than a second string for the running head, and **it says which
  division it names** — the one the **page in hand** is in, a box that
  silently renamed whatever story happened to be first being a control acting
  on something nobody is looking at. **And a blank page from the button a
  writer presses to put a page in**: the act is §9r's and unchanged, and what
  was missing is the **route** — it stood on the page's own dialog and a
  part's panel, so a writer at **+ Add** correctly concluded it was not there,
  §15c and §16b's lesson a fifth time. It is **one act read where it lands**
  like the picture above it in the same menu, so on a page a chapter opens on
  the leaf goes in front of the **opening** and the numeral, the name and the
  first words move on together, which is Ken's *so the chapter opening moves a
  page*; it reads the one `blankOffer` the panel reads and so cannot offer
  what the panel refuses, §9r's absorption included — which needed
  `blankOffer` to **say why** in the two cases it answered with silence, a
  greyed menu item with no reason in its title being the fault `pictureOffer`
  was written to remove, with the panel leaving that sentence off where the
  picture above it has just said the same thing (the fact said twice being its
  own fault). Driving it caught the sentence that **claimed a page in hand
  when there was none** — where a writer opening Book settings after an import
  stands — and one this change made: *The title is on the contents page…* was
  unambiguous with one title box and a question with two, so it says *the
  book’s title*. Deliberately absent and named: a **sixth head content for the
  page's own name** (nobody's ask; the division's slot now means the division)
  and a **blank page as a part of its own**, a part having nowhere to stand
  between two pages of the story (§9i) and so being a second idea of what a
  blank page is.
  **The chapter openings got the same treatment**, from Ken
  straight after: two gaps, both §7a's shape pointed at the next fold down.
  **The face was three generic names and one of them lied** — *manuscript*,
  *serif*, *sans*, so an opening could not be set in the book's own face by
  name nor in two of the faces the book offers, and `manuscript` **secretly
  meant the book's face** inside a book, `chapterStyleFor` overriding
  `--chapter-face` *after* `chapterStyleAttr` had decided it, so the word on
  the screen and the type on the page disagreed. The list is the running
  heads' now and the override is gone: `chapterStyleVars` takes the body face
  and resolves it, which is `partStyleVars`' shape and one answer instead of
  two. Nothing about an existing book changes — `manuscript` still resolves to
  the body face where there is a book, being the older spelling of the same
  intent, and `serif` still parses, kept out of the offered list as history
  rather than as a second answer. **The opening's drop was hard-coded and the
  screen admitted it**: `.bk-opening` was `calc(var(--bk-lead) * 8)` and the
  room said *a chapter that opens above its first paragraph keeps the book's
  own opening depth*, which is an admission and not a setting, exactly like
  *nothing about them is typed here*. `openingLines` is that number, and the
  two drops sit together — the leaf's in **inches**, being a page of its own,
  and the opening's in **lines of the body**, because what it has to look
  right against is the text under it. **The epigraph and the dedication got it too**, from Ken:
  three things were withheld from **exactly those two kinds** while the half
  title and the title page had them, and a fourth was broken. **The lines under
  the words** were `kind === 'title_page'` alone, so an attribution or a second
  line could not be set apart from the words above it; they take the title
  page's own shape (the first line is the words, everything under it the lines
  under them) and **start as those words**, so a page made before this is
  unchanged — the title page's tracked capitals would have been absurd on a
  dedication. **A rule** was `words ? null`, excluded for no reason books
  agree with. **A page of art** sat inside the half-title/title-page branch and
  is lifted to every *designed* page, the words being in the picture whichever
  page it is. And **the one option they did have was dead**: driving the real
  page found the variable arriving on the box and nothing moving, because the
  stylesheet said `.bk-display .bk-words p` with a **descendant combinator**
  while `bk-display` and `bk-words` are two classes on **one element** — so the
  rule had never matched and the *words* control had been doing nothing since it
  shipped (the neighbours are fine, `.bk-book-title` and `.bk-author` really
  being children). One space deleted; the defaults are what the dead rule fell
  back to, so nothing existing moves. **And the copyright page**, from Ken, which was the one
  designed page with **no style at all** — `partHasStyle` refused it, so the
  section never appeared, and its whole look was three declarations in the
  stylesheet (ranged left, at the foot, `0.8em`): no face, size, case, weight,
  tracking or rule. It is a designed page now with one difference that is the
  page rather than a choice: **it hangs at the foot**, a notice floating a third
  of the way down not being a copyright page and the block being long enough
  that a drop from the head would push it off, so the template and the drop are
  **absent** on it (*absent rather than greyed*) with a
  sentence saying where the page sits, while everything about its type is the
  writer's. Nine point where the stylesheet said `0.8em` — the running heads'
  rule again, furniture not growing because the body did. **And the contents
  page and the index**, from Ken, the last two with the same gap: their whole
  look was `.bk-part-title` at `1.3em` in tracked capitals over entries at
  whatever the body happened to be, so a book in a sans face printed a serif
  contents heading. The predicate is a **rule rather than a list** now — a
  part is designed where its page **prints type of its own**, which is not a
  plate (a picture) and not the prose parts (a foreword's body *is* the book's
  body text and should stay it) — and `partHangsAtFoot` became
  **`partPlacement`**, there being three answers rather than two: `block`,
  `foot`, `flows`. **The contents and the index flow**, running to as many
  pages as they need, so there is no single block on a page to place and the
  template and the drop are absent for the copyright page's reason. The
  **title** style is the heading and the **line** style is the entries — the
  same pair said of a list rather than a second vocabulary — and it sits on the
  **wrapper**, so the entries take it by inheritance and a sub-entry's `0.92em`
  stays a share of the entry rather than of the body. Fourteen point over
  eleven, the running heads' caveat a second time: a book whose body is not
  eleven point is the one thing that reads differently. **And the index's
  letter dividers**, from Ken straight after — the one thing left on that page
  whose look was not the writer's: `.bk-index-letter` was `font-weight: 700`
  and nothing else, so an A and a B were **the entries in bold**, taking their
  size, case, tracking and slope. It is the running heads' argument a **third**
  time and lands the same way — a divider is **a line of type**, so `divider`
  is a third `LineStyle` on the part rather than a new vocabulary, overriding
  every property the wrapper hands down instead of inheriting most of them, and
  an index sets **three** lines where a contents page sets two.
  `partHasDividers` is a **predicate rather than `kind === 'index'` in the
  component**, the print and the dialog having to agree about which page has
  them, and a contents page being in the book's own order has nothing to divide
  it by. The default is what the stylesheet drew (bold at the reading size), so
  an untouched index is unchanged; from here the size is the divider's own,
  which is the point — setting the entries to 9 pt leaves the letters where
  they are. **And the prose parts**, from Ken (*the about the author page needs
  the same style options*), which is the one of these that found a **wrong
  reason rather than a missing feature**: `partHasStyle` refused them because
  *a foreword's body is the book's body text and should stay it*, and that is
  **a statement about the default mistaken for one about the permission** —
  what a page should *start* as and whether a writer may depart from it are two
  questions. So the predicate collapses to **a part is designed unless it is a
  plate**, and `partPlacement` gains `prose` (a heading at the head, paragraphs
  running on, no block to place). Two things make it safe: **the style starts
  as the book's own** through a `base` `partStyleOf` now takes — the chapter
  opening for the heading, the body size for the words, both of them settings
  the writer may already have changed, so a static default would have moved an
  existing page the moment the control appeared — and **only what differs from
  that base is drawn**, so an untouched part carries no style on its blocks at
  all and the markup of an existing book is byte for byte what it was, which is
  what let the whole suite pass with one assertion edited. The words are
  **declarations on their own paragraphs** rather than the body rule learning to
  read a variable: `.bk-p` is the hottest rule in the book and the story has no
  business being reachable from a back-matter control, which a test asserts over
  every other paragraph. **§8a is pictures inside the story**, from Ken
  laying out a children's book, and the audit paid a **thirteenth** time:
  a picture inside the story **is a figure**, which the manuscript has had
  since addendum 16 §9 and which already stands where the writer put it —
  so it is two more readings of `figurePlacement` and no new record. A
  figure is now *across the measure*, *cut in at a side*, or **a page of
  its own**: `bookPlace: 'page'` with `bookSide`, whose block is `display`
  with `starts` at `page`, `verso` or `recto` — the cutter already
  understood all three — so **asking for a side may leave the page before
  it blank, which is what a facing illustration is**, and the screen says
  so rather than letting the blank read as a fault. It draws through the
  **art page's own markup**, one way for a picture to be a page wherever
  it came from. The **border** is `bookStandoff` in ems of the body size,
  and **only what differs from the default is stored**. The **box is drawn
  on the page** (*Draw the box…*, a drag over the spread): read against
  the **text block** rather than the paper, so the same drag means the
  same thing at any zoom or trim, and the **height is not taken** — a
  picture keeps its proportions, which is what a float does. *Put a
  picture here…* on the manuscript right-click is every prose format's
  now rather than the textbook's alone.
  **§8b is the text running round a cut-in picture**, from Ken (*the text
  below it is not wrapping around the picture, so it splits it and adds a big
  gap*): a four-line paragraph with a fifteen-line picture beside it and
  eleven lines of white under the words. **Two boxes were containing the
  float** and each was there for a reason that had stopped applying —
  `.bk-p.bk-has-inset` was `display: flow-root`, and every block is drawn in a
  `.bk-piece` of its measured height with `overflow: hidden`, both of which
  are formatting contexts. So cutting in was cutting into *one paragraph*,
  which is not what the words mean. **Only a split piece is clipped now**:
  clipping is what a split is *for*, so `PagePiece` carries `cut` and the page
  clips that piece alone; a whole block is drawn whole and the float reaches
  the paragraphs after it, with a heading, a break, a figure and a page of its
  own all **clearing**. **The reach is a measurement** (§4's rule pointed at a
  float) — the domain has no font metrics, so `measureBlocks` reads the
  picture's own box and hands `layPages` a `Wraps` map beside the line counts,
  and the cutter keeps a picture and the text round it on one page or the next
  page's text runs full measure where it was measured narrowed. **Measurement
  needed no change at all**: the measure box has always set the blocks as
  consecutive siblings, exactly as the page does, so the paragraphs after a
  picture already measured narrowed by it — the float was simply never allowed
  to reach them.
  **§8c is a graphic set over the page**, from Ken (*add a vector graphic …
  anywhere on the page, and then they can resize that also. But it has a
  transparent background*), and the audit paid a **fifteenth** time: it is a
  **figure**, and `free` is a fifth `FigurePlace` — the library, the
  attributes, the rail, the inspector and `placeBookFigure` are all reused, so
  what is new is one value and what it means. What it means is that it **takes
  no room in the flow**: everything else is in the text's way and the cutter
  knows about it, while this is set over the page with nothing moving to make
  space, which is why several may ride one block and why it is offered on a
  blank leaf too. **It rides a paragraph and is placed against the page**, and
  the two are not in tension — a page is not a record, so anchoring to page
  nine would be wrong the moment a word is added, while `x`, `y` and `span`
  are fractions of the **page** because *anywhere on the page* includes the
  margins. **Nothing draws a background and nothing prints a caption**, which
  is the whole of *transparent*; an SVG needed no new reader. **Moving it is
  not drawing a box** — a figure in the text has no place until a box is
  drawn, a free graphic is already on the page — so the handle goes straight
  over it and says *45% of the page* where an inset says *of the measure*.
  `FigureInset` **omits** `x` and `y` rather than inheriting them, an inset's
  place being the paragraph's.
  **§9n is the designed page on one screen**, from Ken's *Half title page
  panel (redesign)* handoff, and the audit paid an **eighteenth** time:
  nearly every control it asks for was already stored under a name that
  means the same thing — the template table, the drop, the alignment, the
  face, a `LineStyle`'s size/case/style/tracking, the rule, *Back to the
  page's own look* — and `partTemplateOf` was already the **reading** the
  handoff asks for by name. What was missing is the **shape**, and three
  decisions carry it. **A template is a height**: the first five conflated
  two questions (*High and left*, *Low and right* each carried an
  alignment), so ranging a page left made it *Custom* though it sat exactly
  where *Classic* put it, and choosing a template moved the block across the
  page — now four heights, an alignment control beside them, and
  `partTemplateOf` asks the **drop alone**. The default drop moves **30 →
  33**, the one place a page nobody set changes, because at 30 a fresh book
  reads *Custom · placed by hand*, which is a lie about the page and makes
  the template row useless out of the box. **The mode is a reading**:
  `partModeOf` says whether the page carries the words, a logotype or a page
  of art, so the tiles cannot disagree with what prints, and a tile is
  **the act** (it opens the picker, or takes the picture off) rather than a
  flag beside the picture. The half title takes a logotype now as the title
  page always has — `logoAssetId` on the part, with
  `settings.titlePage.titleImage` the **older spelling of the same intent**,
  still honoured where a part carries none (`template`/`layout`'s shape, no
  migration, no page moved). And **Cancel means cancel**: the screen saves
  as you type, because a look is tuned against the sheet beside it, so the
  part as it stood when the screen opened is held and Cancel puts it back.
  Three smaller ones: `partChanges` counts **leaf by leaf** (*1 change* over
  a page that had been taken apart is a figure nobody can check), comparing
  the resolved style against the same style with nothing stored so a field
  set back to its default by hand is not a change; the navigator counts
  **sheets** rather than printed numbers, the front matter counting in roman
  and the story in arabic so *page i of 9* would put two numbering systems
  in one sentence; and which pages get this screen is
  `partPlacement(kind) === 'block'`, §7a's own predicate, so there is no
  second list of kinds. Driving it caught the fault of the day: the room's
  `h3` is a tracked-capitals section label, so *Typography* was shouted and
  *Upper third* came back as UPPER THIRD — a template nobody named, from a
  rule this screen never wrote and **inherited anyway**, which is the
  quietest way a screen says something it did not write.
  **§15b is the two the copyright page still owed**, from Ken re-sending the
  handoff (*I'm not sure if I gave you this spec because the copyright page
  hasn't changed*) — which was **§15a's fault rather than a missing
  feature**, the dialog having been reachable from one gesture out of two.
  With that fixed, §15.5's two leftovers are built. **The barcode's
  sharpness is a reading**: the same picture is fine at 1.5in and too coarse
  at 3in, so `barcodeResolution` counts the dots at the width it is *placed*
  and narrowing the barcode clears the warning by itself; the sentence names
  the number, the width and the way out, a warning that does not say what
  would fix it being one a writer can only ignore, and a **vector is not
  warned about** rather than warned about with a made-up number. The box
  takes a dragged file and Browse… does the same, both through the room's
  one reader. **A saved order is the same shape as a built-in**, so
  `presetOf` takes the four and the writer's own as one list and nothing
  below is told saved ones exist; it is still a reading (moving one element
  makes the page *Custom* by itself) and it keeps the **arrangement and
  never the words** — an order is a house style and a copyright notice is
  one book's.
  **§15c is that a route is not a detour**, from Ken looking at the part
  dialog open on Copyright: *it still does not show in the update*. §15a was
  right about the fault and half right about the fix — it gave the part
  dialog the missing button, so the double-click **reaches** the new screen,
  a route rather than a second copy. What it did not ask is **what the route
  passes through**: the page the gesture lands on first is the one the new
  screen replaces, and a writer standing on the old free-text box does not
  read *there is a button that would take me somewhere better*; they read
  that nothing changed. So §9n's line is drawn again — **a copyright page
  opens its own screen**, from the rail, the spread and the inspector alike,
  with the older dialog never in front of it. **A route is honest only where
  what it passes through is not the thing it routes away from** (the
  inspector is a panel about a selection; the part dialog was a rival, since
  it held a control for the very thing the new screen sets). And **what the
  older screen alone could do had to come with it**: PAGE STYLE was the only
  way to set this page's face and the small print's case, weight, slope and
  tracking, so *The small print* now holds all of it, writing to
  `partStyleOf` exactly as before — routing past a screen without carrying
  its controls is how a fix loses a feature. Driving it caught what the
  tests could not: the section ran past the foot of the side column, so
  everything below *Small caps* was reachable only by a scroll nothing
  announced — which is the whole of why the type was moved in the first
  place.
  **§16 is the title page**, from Ken's own handoff, and the audit paid a
  **nineteenth** time in two directions at once: four of its seven elements
  were already printing (the title and the author are `bookNames`', the
  subtitle is `settings.titlePage.episode` — the older spelling — and the
  publisher is `settings.book.imprint`) and **two more were already typed, on
  the copyright page**, `publisher`/`publisherPlace`/`edition` having been
  fields on that record since §9k. Only the **contributor** had nowhere to
  live. Four decisions. **The publisher is the book's and is named once** — a
  title page and a copyright page naming different publishers is a mistake
  rather than a design, so `publisherOf` reads that record and the row offers
  *Edit on the copyright page*, §15c's route rather than a second copy.
  **An element switched off is not an element left empty** (§15's rule on the
  page in front of it), so each optional one has a switch and switching it
  off keeps its words; the defaults are exactly what the page printed before
  there were switches. **A template is a pair of heights** — on this page the
  title's height says nothing about whether the author is under it or half a
  page below — so `titleTemplateOf` asks both, and the handoff's fourth
  (*Flush left*, Classic ranged left) is **not built**, being the very
  conflation §9n removed; `authorDrop` is **null-means-under-the-title**, one
  field answering both of the handoff's controls (`minimumSetups`' shape a
  fifth time), and the default drop moves 33 → 36 so a fresh page reads
  *Stacked* rather than lying about being custom. And **the author, the
  subtitle and the publisher were one line of type and are three**: all read
  `--pt-line-*`, so setting the author set the imprint and a subtitle could
  not be italic while the author was small caps — §7a's running heads a
  **fourth** time; the subtitle's size is **derived** from the title's with
  nowhere to type one. The conventions (a recto, counted but unnumbered, the
  copyright page on its back) are **said rather than hidden**, and a missing
  publisher is **said, never refused**. Driving it caught the author's `2em`
  of stacked air carrying into its own group (Classic's author at 56% rather
  than the 52% set) and the inspector's older panel still offering this page
  the **one-height** templates, which on a page whose placement is a pair
  could only disagree — absent there now.
  **§16a is a barcode as the vendor sends it**, from Ken (*the ISBN barcode
  needs to be able to import a PDF … or an EPS file*). **The PDF is drawn
  once, on the way in**: a data URI of a PDF in an `<img>` draws nothing
  anywhere, so `readPdfPicture` renders page one at **600 dpi against the
  page's own size in points** and the library keeps an ordinary picture —
  nothing downstream learns PDFs exist, and `barcodeResolution` reads the
  dots it is given (a 2in vendor file lands at 1200 × 600 and reads *600
  dpi*, falling to 400 at 3in). **EPS is refused with the one-step fix
  named**, nothing here being able to rasterise PostScript and a stored EPS
  being an empty box in the preview, the book and the eBook alike. **One
  reading where there were nine**: `pictureRefusal` replaces nine
  hand-written `startsWith('image/')` gates and `PICTURE_ACCEPT` nine
  `accept="image/*"` attributes, a gate beside the reader otherwise going on
  refusing what the reader has learned to draw. **And it found a fault in
  code it did not write**: pdf.js 6 calls
  `Map.prototype.getOrInsertComputed`, which landed in V8 *after* this app's
  Chromium, so `getPage` throws on a writer's machine and **the PDF script
  importer had been broken the same way** with every test green — nothing in
  the suite loads pdf.js. `pdf-runtime.ts` is one place that loads the
  library, owns the worker and supplies the missing method; both readers ask
  it, which also removed a second copy of the worker setup.
  **§16b is the route that predates the screen**, from Ken the day §16
  shipped (*the title page dialogue box not showing — probably same problem
  as copyright had*), and he named it before looking. **`File ▸ Title page…`
  opened the screenplay's front page** — Written by, Contact, Draft date — on
  a book, that command having existed since long before books did and nothing
  ever having asked it what it was opening; the panel §16 had just built was
  one double-click away in the Layout room and read as unbuilt from the only
  route the menu documents. On a book it now opens **the book's** title page,
  which is the room's own screen (its preview is the page as the book sets it
  and its navigator turns to the next, so it needs the laid pages — §9d's
  rule from the other end); `openOnKind` asks the room, keyed on **arriving**
  rather than on the kind, so closing the dialog and staying does not reopen
  it. Three of these in three days is worth naming: **when a new screen
  replaces an old one, the old screen's routes are the feature** — §15c found
  a route that passed *through* the page it replaced and this one that had
  never heard of it, both times with the screen working, every test passing
  and the writer correctly concluding nothing had shipped. So §15a's rule
  grows a clause: **a route needs a test per gesture, and per menu item**, a
  menu command being the most durable route in the program and the least
  likely to be revisited. A sweep of the other nineteen commands found no
  second case.
  **§16c is that a logotype replaces the title, not the page**, from Ken on
  his own book (*the new title page box is not coming through*) — he was on
  the new screen, with his title page set as **full-page art**, where it drew
  three tiles and nothing else. **§9n hid the elements and the type wherever
  the page carried a picture**, which is right on the half title (a logotype
  there *is* the whole content) and wrong on the title page, where it stands
  where the title would and **six of the seven go on printing** — so the
  print drew things the screen would not let anybody reach. Only **art**
  really has nothing to set, bleeding to the trim with the words in the
  artwork; the title's row now says a logotype stands there and offers the
  title back. And art mode is **absent with the reason said** — it explained
  nothing, so a writer who had just specified seven elements found a panel
  that looked unbuilt, which is what Ken reported about a screen working as
  designed. The lesson is §16b's one layer in: **a mode is a route too** —
  §15c and §16b found ways *in* that missed the new screen, this a state *of*
  it that showed none of it, and all three read identically from the writer's
  chair while the feature was there and working.
  **§16d is that a route is not a field**, from Ken re-sending the handoff
  unchanged (*here is what it is supposed to be*), and the divergence was one
  decision of mine: **§16 made six of the seven rows read-only** with a button
  through to wherever the value is typed, on the ground that a value should be
  named once, where the handoff's §8.1 asks in plain words for *editing the
  title or author here updates Book settings, and the reverse*. **Two-way sync
  is not a second answer** — a box on the row writes the **same field**, so
  there is one value with two doors — and what I built was a misapplication
  rather than a stricter reading: §15c's *route rather than a second copy* is
  about **screens** (do not build a second panel that sets the same thing) and
  says nothing against a second control onto one field. A route in a row's
  place cannot show the value as an editable thing, throws the writer out of
  the page they are setting, and makes a seven-row panel a list of links. Every
  row is a real input now, writing where the value lives — title, subtitle and
  author through `setTitlePage` (the call Book settings makes), the contributor
  onto this page's record, the publisher, place and edition onto the copyright
  page's — with the handoff's **Name / Logo** pair and its *Title and author
  stay in sync with Book settings* line, which is the argument for the boxes
  said on the screen. **And *Flush left* is built after all**: §16 dropped it
  as §9n's conflation returning, and the way to keep both is to make the
  **reading** ask all three numbers rather than to drop the arrangement —
  Classic is 30/52 centred and Flush left is 30/52 left, so each names one
  whole arrangement, nothing is stored, the alignment keeps its own control,
  and ranging a Classic page left reads as *Flush left*, which is what it now
  is. The lesson beside §16b's: **a rule about screens is not a rule about
  controls**, and applied one level down it turned a panel into a set of doors.
  **§16e is three faults in one panel, all of them typing**, from Ken using
  §16d's boxes (*when I try to enter something in the subtitle box, it just
  kicks me out of the box*; *the publisher location won't allow input*; *the
  author name does not allow input*) — three reports, **two causes**, and
  both are rules rather than slips. **A component declared inside a component
  is a new type on every render**: `ElementInput` lived in `Body`, so React
  saw a different component each keystroke, unmounted the subtree and mounted
  a fresh one, and the `<input>` a writer was typing into was thrown away with
  the caret in it — called as a function rather than mounted, the markup joins
  `Body`'s own tree and the element is reconciled in place. A sweep found no
  second one. And **a reading says what will print; a field says what was
  typed**: `titlePageOf` and `publisherOf` trim every value and put the book's
  own name in where nothing is typed, which is right for ink and wrong for a
  box — bound to one, a **trailing space is trimmed off on the way back** so
  the space bar does nothing and *Portland, OR* cannot be typed, and a
  **fallback arrives as the value** so the box shows the project's author as
  though somebody had typed it, typing appends to it and clearing it hands it
  straight back. `titlePageTyped` and `publisherTyped` are the other half of
  the pair, the readings stay for the sheet, and the fallback is the
  **placeholder**, where it says what the page will use without pretending to
  be the writer's words. It is `partStyleOf`'s and `bookPresetOf`'s rule
  pointed at a form. **And the title's size says what it sizes**, from Ken in
  the same breath (*there needs to be a font size for the title text*): it was
  there and read *Size*, on a panel listing seven elements, beside an *Author
  size* that named itself — the case control one row down had been reading
  `isTitle ? 'Title case' : 'Case'` all along, so this is the same rule on the
  row above it, with a line saying the subtitle is set from it.
  **§17 is the back matter**, from Ken's handoff for seven pages after the
  story — acknowledgements, appendix, glossary, bibliography, index, about
  the author and reader extras — and the audit paid a **twentieth** time,
  this one mostly shell. **The screen exists** (§9n and §16 built the
  handoff's own shape, which it says itself: *identical in structure to the
  Half title and Title page panels*), **sections 2 and 3 exist** (a part's
  `PartStyle` has carried the heading's line, the alignment and the rule
  since §7a), and **five of the seven pages exist as part kinds** — the
  index being addendum 10 whole, which is the handoff's *Build from the
  manuscript* tile already built and already better than its promise, the
  page numbers being a reading. So `BackMatterDialog.tsx` is **one shell
  with a first section per page**, sections 2 and 3 written once because
  *how deep is Standard* must not have seven answers. Four things the
  cutter has always understood could now be asked for. **The page's own
  side and its own number** — `layPages` has taken `starts` and `folio` on
  every block since §4 and every prose part took a recto whether it wanted
  one or not; both default to what they already did. **The sink, with a
  fourth step nobody asked for**: the depth is `drop`, which a prose part
  **stored and never read**, so making it a control was the day it could
  move an existing foreword — §7a's rule (a style starts as exactly what
  the page prints) puts **At the head** before Shallow, Standard and Deep
  and makes it the default, the three named steps being `CHAPTER_SINKS`
  read through `sinks.ts` rather than a second table, and a hand-set depth
  lighting none. It is **absent on a page that flows**, `partPlacement`'s
  own predicate. **The sign-off is a field rather than a last paragraph**
  (the page ranges it right in italic, and a writer who typed it as a
  paragraph could not say so), switching it off **keeps its words**, and it
  prints as a paragraph with `role: 'sign_off'` — a field narrow enough to
  name its one page being honester than a general one nobody can read,
  `copyrightPosition`'s precedent. **About the author holds neither the
  name nor the biography**: the name is the book's through `bookNames`
  (§16d's one value, two doors) and the biography **is `part.text`**, a
  `bio` beside it having been written and deleted because it would strand
  what an author had already typed; the photograph is **the figure and the
  inset a sixteenth time** (*above* a figure across the measure, *beside*
  the very inset §8 cuts pictures in with), and where it goes and what
  shape it is are **absent until there is a photograph**. **Columns were
  built and taken out**: `PartStyle` had a `columns` and the stylesheet a
  `.bk-cols-2` that nothing emitted — a two-column page is a change to the
  **cutter** (the measurement and the lines per page both halve) rather
  than a declaration, and a control storing a number the book never reads
  is a control that lies. Driving the real room found the fault of the day
  and it is this room's own: **the sink replaced the book's opening depth
  instead of adding to it**, so *Shallow* moved the heading a quarter of
  the way **up** from where *At the head* drew it; `.bk-opening` is
  `calc(… + var(--pt-sink, 0in))` now, in **inches** because a percentage
  padding resolves against the containing block's *width* even at the top
  (§9g) — and it found the navigator keeping the column's scroll, so ›
  landed halfway down the next page, which on the screen is
  indistinguishable from the turn not working. The other five first
  sections are stages of their own, **said rather than left blank**;
  addendum 20 §17 carries the order.
  **§17a is the other five, and pulling from the text**, from Ken in the
  middle of building them (*any functions in the back matter that can be
  pulled from the text? Let's have a function and a button that says pull
  from text*). **Two of the seven can, one already does, and four cannot**,
  and saying which is most of the feature: the button is **absent rather
  than greyed** on the five, with the reason in its place, a press that can
  only refuse being one a writer never trusts again. A **glossary** takes
  the terms the book itself marks — a heading marked for the **index**, or a
  short run set **bold**, which is how non-fiction names a term on first use
  (over four words is emphasis, and a glossary of sentences is worse than
  none). A **bibliography** takes the research notes carrying a `source`,
  addendum 16 §2's one field a nonfiction author cannot work without. The
  **index** already is the reading and has been since addendum 10, so a
  button there would be a second and worse copy. Three rules keep it honest:
  **it never writes a definition** (the definition is the work and the term
  is the tedium; a generated one is a sentence the author did not write
  standing under their name), **it adds and never overwrites** so a second
  press changes nothing and an edited definition cannot be lost, and it
  **reads marks rather than guessing**. The five panels: an **appendix**
  whose label is a **reading** from where it falls (the chapter number's rule
  a seventh time, with nowhere to type *Appendix C*); a **glossary** whose
  letter headings are **absent while the list is unsorted**, letters over an
  unsorted list heading groups of one; a **bibliography** set live in
  Chicago, MLA or APA where **a free-text entry is kept exactly as written**
  and shown as one box rather than five, a style being a rule about *fields*
  and an entry with none being unrestylable without inventing them; an
  **index** whose section is a statement rather than a control; and **reader
  extras** as four kinds, *Also by* taking the book's author as a reading.
  **What a list page prints is its records** — `partBlocks` reads a
  glossary's, a bibliography's and an extra's paragraphs off them, so the
  panel and the page cannot disagree, and a term's `lead` is its own field
  rather than an inline mark because **small capitals is not something an
  inline mark spells** and the definition after it keeps the writer's own
  italics. And the **§3 defaults table corrects §17 an hour after it
  shipped**: all seven had been given *At the head* on §7a's rule, and the
  correction is the half worth keeping — **that rule is about not moving
  work somebody did, and is not a reason to withhold a design from a page
  that never had one**, which is what a handoff is for; *At the head* stays
  as the fourth step and the prose pages that are **not** among the seven get
  `drop: 0` explicitly so none of them moves. Deliberately absent and said:
  §2's **file importers** (BibTeX, RIS, CSL-JSON, CSV, a .docx table, a
  static-page-number index and *Match them to tags*), the **QR code** at
  export, a **preview chapter** from another project, and the **two-column
  index** — which is a change to the *cutter*, the measurement and the lines
  per page both halving, so `columns` was built, found to be read by nothing
  and **taken out rather than left as a control that lies**.
  **§17b is collecting into the back matter while reading**, from Ken (*for
  the appendix and the glossary and the index in the book view as you're
  reading it you can pick a word and when you use the right click menu you
  can say add to appendix add to index add to glossary*), and **one of the
  three was already built** — *Index this…* has been on the manuscript's
  right-click since addendum 10 §6, and it is the better half of the three, a
  mark anchored to the passage with the page number read off the pagination.
  So this is the other two, `back-matter-capture.ts`, built to its shape, and
  the existing one **renamed to match**: three acts of one kind should read
  as three, and *Index this…* beside *Add to the glossary…* reads as two
  sorts of thing. Three decisions. **The act makes the page** — a writer who
  picks a word and asks for it in the glossary is telling you the book has
  one, so refusing for want of a page and sending them to Layout is §4b's
  mistake, an act having to make the reading true rather than require it.
  **A word for the two that list words, the passage for the one that holds
  prose** — an index entry and a glossary term are things a reader looks up
  while an appendix holds *material*, which is the thing a writer would
  otherwise get wrong once and distrust afterwards, so the menu says which is
  which **under each label** (`note` on the item, which §6b built for exactly
  this) rather than leaving it to be found by pressing. And **a term already
  listed is said, never doubled**, `glossaryCaptureOffer` refusing in a
  sentence and `captureToGlossary` refusing it again, `trackRemoval`'s shape.
  `CollectIntoBackMatter` is **one screen for the two**, one act with two
  destinations; the index keeps its own, which asks for a heading, a
  sub-heading and whether the discussion is principal, none of which either of
  these has. The appendix picker is **absent where the book has none or one**.
  Driving it caught the fault of the day and it is a wording one: the screen
  said *Start a glossary with “X” in it* and then, under it, *The book has no
  glossary yet. This makes one, at the back* — **two sentences saying one
  thing**, which reads as two facts; the page it would make is part of what a
  press would do, so it is said in the same breath.
  **§9o is what a fold hides**, from Ken (*when you collapse a story, it only
  collapses the first chapter. It needs to collapse the entire story until the
  next one… it still shows the opening page even when you collapse it*), and
  **both halves are one fault**: the room's own rule going unread. §9a settled
  that **containment is depth, never a heading**, and the fold never asked
  about depth — it hid a row's **pages** and nothing else, so closing a story
  hid the one page the story row owns and left every chapter under it, and all
  of *their* pages, standing. Measured on three stories of three chapters: the
  rail was nineteen rows and closing every story took it to nineteen. The
  opening page is the same fault from the other end — `pagesUnder` gives a
  page **one** owner (§9m), so where the first chapter has a row the opening
  page is **that chapter's**, and a chapter row that never hides is an opening
  page that never hides; whether the story or its first chapter owns it turns
  on whether the chapter is titled, which is why it looked like it half worked
  on the second story. `visibleRows` reads depth — **a closed division hides
  every row after it that is deeper, until the next row at its own level or
  above** — and the pages go because a hidden row draws nothing, so there is
  no second rule about pages. Two things came with it: the arrow is **absent
  rather than dead** where nothing is under a row (`rowHasUnder`), which the
  row's own comment had claimed since §9h while every chapter and section got
  one regardless; and it is labelled **what is under** rather than *the pages
  of*, a story holding its chapters as well as its opening page. **A novel
  changes too** and it is said rather than special-cased: a novel's chapters
  have pictures under them (§9l), so closing one now hides its pictures, which
  is the same rule and means an illustrated book opens on its chapters rather
  than on every picture in them. Four existing tests asserted the old
  behaviour and were **updated rather than worked around**, which is the
  honest signal that the rule changed.
  **§9p is a picture on a chapter's page**, from Ken — four reports in one
  message, three fixed and the fourth a limit rather than a slip. **A picture
  on the page a chapter opens on split the chapter in two**: the room's rule
  is *before the element the page opens with* (§9a), and on an opening page
  that element is the chapter's **first paragraph**, a `chapter_opening` being
  emitted by the **unit** and not a manuscript element at all — so the figure
  landed between the numeral and the words, three pages doing the work of two.
  *Before the opening* cannot be said with a `beforeElementId`, so it is said
  where the opening is made: **a page-figure at the head of a unit is emitted
  before the chapter opens**, one branch, nothing stored, the figure keeping
  the chapter it is in (§9l's rail). **A page that only opens a chapter
  offered nothing** is the same cause from the other end — `pagePlace` answers
  with a body block, an opening is not one, and the room greys its picture
  buttons on exactly that answer, so chapter one's own page had every button
  dead with nothing saying why; the chapter's **first element** is the answer
  now. **The drawing tool would not go down**: `finish()` has five ways out
  and only the successful one cleared `drawing`, and while it is armed every
  press on the spread returns *before* selecting anything — so a press that
  drew nothing left the writer unable to choose a page or a picture, with no
  way back if the box that would carry the ✗ was never made; it is the divide
  tools' idiom (addendum 21 §10), **the tool puts itself down when the act is
  over**. **§9q is the fourth**, and it is the cutter rather than
  the placement: an illustration facing text cut the facing page short. It was
  **measured before it was fixed, because the obvious fix is the wrong one** —
  the chosen page opened with the *tail of a paragraph that began on the page
  before*, and putting the picture after that paragraph instead leaves the
  next page holding a two-line tail and a bigger hole; both leave white
  because the cutter ended the page wherever it met a plate. So the rule is
  one sentence: **a plate reached with room still on the page waits for the
  next leaf while the text goes on filling this one**, and the paragraph it
  interrupts **resumes after the picture** — a reader turns from a full page
  of prose, past the plate, and back into the same sentence, which is what an
  illustrated book does and the only arrangement that leaves no hole.
  `Cursor` gains `held`, the plates a page set aside. Three rules keep it
  honest: **only a plate may wait** (`floats` — a chapter opening that floated
  would open in the middle of the page before it), **a plate's own back goes
  with it** (`backOf`, or a picture asked to leave its reverse blank is parted
  from that reverse), and **the side it asked for is kept**. It **moves plates
  already placed**, which is why it was put to Ken before it was built rather
  than after; and nothing in the suite covered a plate reached mid-page — the
  change passed 2317 green tests without one moving — so it is pinned now.
  **§17c is importing a back-matter page**, from Ken (*for the appendix and
  the glossary and the index, you need an option to import that as text or
  import that as a PDF and it'll just maintain the formatting*), and the
  decision it rests on is that **those are two different promises keeping two
  different things**. **Text becomes records** — a glossary's terms, an
  appendix's paragraphs, an index's headings — and the book sets them in its
  own face, so *maintain the formatting* means the **structure** (which line
  is a term and which its definition, where a paragraph breaks, which entry
  hangs under another) and cannot mean the source's type, which belongs to
  another book. **A PDF becomes pages**, read literally, the only honest way
  to keep somebody else's typesetting being to keep their pages: art pages
  drawn once at print resolution as §16a brings a barcode in, with the cost
  **said rather than discovered** — it is then a picture of a glossary rather
  than a glossary, no running head, not searchable, and it will not reflow in
  the eBook. And the third thing, which a writer would not think of: **an
  imported index's page numbers are another book's**, addendum 10 §3 being
  that none is stored anywhere, so a text index **keeps the headings and drops
  the numbers** and arrives as a **worklist** — every old heading with how
  many places in this manuscript say it. It marks nothing (`findForIndex`'s
  rule: a search helps somebody mark and marks nothing, filing every hit being
  a concordance), **done is read off the marks** so marking a passage strikes
  the row with nothing run, and a heading this book never mentions is **said
  rather than hidden**, being the most useful row on the list.
  `back-matter-import.ts` is the module; `readPdfPages` is the **same
  `drawPage` the barcode uses** at 300 dpi rather than 600, a whole leaf of
  type at 600 being megabytes a page inside the project file, and two
  functions that turn a PDF page into a picture being two answers to how sharp
  a page is. Both ways are **two steps** — read, said, then a press — it
  **adds and never overwrites** (§17a), and **every line that became nothing
  is accounted for on the screen** (§4's rule). Driving it caught a collision:
  the dismiss button said **Cancel**, which the dialog's own footer already
  owns for *put the whole page back*; it says **Forget that file**.
  **§17d is leaving the back of a page blank**, from Ken (*on the title page,
  there needs to be an option to leave the back of the page blank, because it
  could be a printed page on different paper*), and **the mechanism was
  already there one level down** — §9i put `bookBackBlank` on a manuscript
  element for a picture — so this is the same question asked of a **part**,
  `backBlank` on it being the whole of the data and no migration, parts living
  in `settings.book.parts`. Two rules, both already written: **the back of a
  leaf is its other side** (§9j, Ken's own correction), so the page takes a
  **recto** and the blank really is behind it; and the blank is `display`,
  `folio: false` and **counted**, counting being what the cutter does to
  everything. **Absent on a page that flows** (`partTakesBlankBack` is
  `partPlacement`'s own predicate, not a second list of kinds), and the
  default is false, so the whole suite passed unedited — the proof no existing
  book moves. One thing had to be **unsaid**: the title page's panel stated
  *The copyright page goes on its back* as a fixed convention, and it is a
  choice now. Driving it found the replacement wrong too — a copyright page is
  a **verso**, so blanking the title page's back sends it to the next
  **left-hand** page, two leaves on, a second blank falling out of the
  pagination; one block is inserted and the convention does the rest, the
  screen says *the next left-hand page*, and a test pins the pair so the
  second blank is not later "fixed" as a fault — **which §17e overturns**.
  **§9ai is the measure box carrying the pictures**, from Ken the day after
  §9ag (*it keeps crashing when I try to enter the ISBN in the copyright
  dialogue box*). §9ag made a burst of typing settle into **one** laying and
  **never asked what a laying costs** — which turns out to depend on the one
  thing no fixture in the room has: pictures. Laying the book is
  `box.innerHTML = every block of it`, and the comment over that line has said
  since §4 that **a picture's lines come from its own shape rather than from
  the box**; it is true and it was half a sentence, because a `display` block
  measures as a whole page and a `figure` block measures through
  `pictureLines` — **neither of them looks at the box at all** — and the
  picture went in anyway, to be parsed, decoded and thrown away unread, every
  time. Measured on a hundred-page novel with three 4 MB illustrations:
  **16.10 MB of markup against 0.07, and 159 ms a laying against 7**, with
  every measurement identical to the pixel, which is what makes it a fault
  rather than a trade; driven in the real room on the same book the biggest
  write falls **16.1 MB → 0.07** and a laying **228 ms → 10**. Three pictures
  is a modest book; at six or eight the laying writes thirty or forty
  megabytes of base64 per burst with Chrome decoding every one, and that is
  the tab going down. **It is the block that is left out, not the picture
  inside it**, and driving the first fix in the real room is what taught that:
  blanking `context.pictures` missed most of them, a picture reaching the
  markup by **three** roads — a figure's from the context, a chapter leaf's
  baked into `block.chapter.image` by `chapterLeafContent`, the title page's
  and the imprint's from their own records — so where a block's height is
  settled without the box being read, its item is written **empty**, which
  cannot miss a road and is honest about the reason: the box is never read for
  these, so there is nothing to put in it. The item stays, the blocks and the
  items being read side by side. Everything else is drawn exactly as before,
  which is the half that matters — **where the box is read, the box gets the
  picture**: a cut-in picture's reach really is read off its own box, and a
  barcode really is inside a page whose words are measured. The test pins what
  is **written** rather than what comes back (a test's document has no
  layout), and its last assertion is the whole of it — **what is written does
  not grow with the picture**, so a book of plates costs the measurement no
  more than a book of none.
  **§9ah is the button the policy refused**, from Ken with three screenshots
  (*the actual save to PDF button doesn't actually do anything… I wasn't able
  to save it in a file that I could open*), and **it really did nothing**: a
  window opened with `window.open('')` is `about:blank`, which **inherits its
  opener's content policy**, and the preview's is `script-src 'self'` — *no
  inline scripts*, which `preview-gate.ts`'s own comment says in those words —
  while the banner's one control was `<button onclick="window.print()">`.
  Driven against the preview served with that exact header, the popup's console
  carries *Refused to execute inline event handler* and `print` is called
  **nought** times. The half worth keeping is why nobody saw it: **`style-src`
  carries `'unsafe-inline'` and `script-src` does not**, so the `<style>` was
  taken and the handler refused — **one inline thing allowed and one forbidden,
  so it drew perfectly and could not act**, which is the hardest kind of fault
  to report and the easiest to take for your own mistake. The handler is
  attached from the opener now, a closure made in this window being **this
  window's script**, and the markup carries none at all. **The second half
  follows from the first**: the window used to open and print itself in the
  same breath, so the banner — the one place that says which destination makes
  a file — stood **behind the dialog the destination is chosen in**, and with
  the button dead that was the only way anybody reached the choice. His
  screenshot shows what he picked with nothing to go on: *Microsoft Print to
  PDF*, headers still on, `about:blank` and `1/107` on the page. So **the
  dialog comes after the words rather than over them** — *Export the book…*
  opens the window and waits, the button is the act, *Print…* keeps its dialog
  because a printer is what that one asks for — and the banner says the **why**,
  the trap being that *Microsoft Print to PDF* reads like the right answer when
  everything on that list but the browser's own *Save as PDF* is a printer, and
  a printer prints on its own paper. It opens by admitting the limit that puts
  a writer in a print dialog at all, that being the question the dialog raises.
  **And the sentence was not true**: `path` answered *your browser's Save as
  PDF* — a sentence in a field that means a file on disk — so the room read out
  `Exported 46 pages to your browser's Save as PDF` before a byte was written
  and whether or not one ever was; **a null path is nothing written** and
  `sayExport` is the one place that says what either answer means, there having
  been two copies of those words. **Deliberately not built**: a PDF writer of
  our own, the pages being laid by the browser's own line breaker because the
  domain has no font metrics, so ours would position every glyph itself and
  embed only the fonts it had — a book set in Garamond printed in Times, which
  is *what is seen is what prints* broken by a second typesetter. **And
  `TEST2.pdf` is not claimed as fixed**, nothing here being able to drive a
  Windows printer driver; what was measured instead is everything up to the
  dialog — at the moment the window prints, the document is `complete`, all 46
  pages are laid and `document.fonts.status` is `loaded`, so the content is not
  a race. Looking at it caught the room's own argument said about its own
  banner, the destination sentence running **200 characters to the line** at
  1440. The test that stood here asserted the window's *words* and that it
  printed itself and **never asked whether its one control could be pressed** —
  §15a a further time — so the fake window now records what is attached to its
  button, presses it, and fails on an `onclick` written back into the markup.
  **§9ag is the typing that re-laid the whole book**, from Ken (*when I try to
  enter the copyright info, the typing is slow and sticky and then the page
  shuts down*), and **it was measured before a line was written**: on an
  imported 46-page novel, **115 ms a character** with a long task on the main
  thread for every keystroke — 67 of them, **4,879 ms of blocked main thread
  for 67 characters**, and his own book is 97 pages. *Shuts down* is what a
  browser does to a tab whose main thread never comes back. **Nothing about
  the copyright page is at fault**: laying the book is `box.innerHTML = every
  block of it` plus a forced layout and the cutter's walk, and the copyright
  page, the title page, the chapter openings, the part dialogs and Book
  settings **all live in `settings.book`**, every one of them saving as you
  type because a look is tuned against the sheet beside it — so a fix on one
  screen would have been the wrong shape and the laying is the thing that was
  wrong. **Three faults.** The key **read the manuscript** —
  `JSON.stringify` over the units, every beat's whole manuscript, the markers,
  the assets and the index, rebuilt on every change to the document and never
  needing a word of it, since **a mutation rebuilds one collection and shares
  the rest** (addendum 02 §6c, which undo's whole-document stack rests on), so
  a collection that is the same object is one nothing has touched;
  `useIdentityKey` compares references, which is `isWritersAct`'s own argument
  and **stricter as well as cheaper**, catching a field no list happened to
  name. The **fonts pass ran on every keystroke** — §6b's second laying is for
  a font decoding after the first layout and was keyed on the **laying** key,
  so the whole cost was paid **twice over**; it is keyed on the fonts now, and
  that key is **named rather than held by identity**, the one place here where
  identity is wrong because `setBookSettings` runs the record through
  `bookSettingsSchema.parse` and every nested array in it is new after every
  write — measured, that brought the second laying straight back. And **the
  laying itself** settles: a burst collapses into one, `SETTLE_MS` 180,
  **nothing about what is written changes** and only the picture waits. **The
  settle is self-measuring and counted in blocks**, which is the half worth
  keeping: the first draft timed the last laying and let anything under a
  frame through, making the room's behaviour **a fact about how fast the
  machine is** — the threshold flapped and one test passed or failed depending
  on the run, and **a flaky suite is not a fix**. A block is what gets written
  into the measure box, so **how many there are is the size of the job**, the
  same on every machine and every run. **The number is measured rather than
  reasoned about, which took three goes**: the novel is **106 blocks** and
  every fixture in the whole room's suite is **13 or fewer**, and the first
  guess was **160 — above the novel**, so the settle never engaged at all and
  only re-measuring caught it. Driven on the same 67 characters: **67 long
  tasks and 4,879 ms blocked became 3 and 215 ms**, twenty-three times less,
  with the words landing in full, the spread catching up when the typing stops
  and a single act on a big book still showing its result. The whole room's
  suite passed **unedited**, which is the proof a short book is untouched.
  **§9af is the box a writer drew, and the box they can move**, from Ken on
  the drawn box (*it doesn't allow me to move the box anywhere. It doesn't
  allow me to resize it. And it pops the box on the wrong page… I was trying
  on page 85. It ended up putting the box on page 84… but then erased a big
  chunk of text*), and then the most useful line in the report — *when I
  delete the box, all the text comes back*. **Five faults, every one of them a
  clause of that paragraph**, and because the gesture is a drag the
  measurements in the real room *are* the test for that half. **Every slide
  threw the drawn width away**: `placeBookFigure`'s inset branch read
  `INSET_SPAN.default` where the line above it reads the element's own, and
  `onSlide` passes a placement carrying nothing but `place` — so a box dropped
  at 46% came back at **40%**, which is in his own screenshot (`1.67 × 3.21 in
  · 40% of the measure`, and 1.67in is exactly 40% of a 6 × 9's measure), *40%
  being not a width anybody chose but this constant*; the argument is
  `boxHeight`'s two lines up, that **a default is the answer for a figure that
  has never been given one and never for a caller that did not mention the
  field**. **The marks swallowed the handle** — the ✗ ＋ ✓ are in the middle
  because Ken asked for them there (§9d), and measured, three 30px circles
  with their gaps are **106px across a box that is often 137px wide**, leaving
  fifteen pixels of grab either side and nothing in the middle, with **✗
  first**: so *it doesn't allow me to move the box* and *when I delete the
  box, all the text comes back* are **one press reported twice**. It is a
  **threshold rather than a target** now (a press anywhere may become a slide
  and a mark acts only where the pointer did not travel), with ＋ ✓ ✗ so the
  act that takes it away is not the one under the first finger — and driving
  it caught the fault the fix introduced, which is the keeper: **a captured
  pointer retargets its events**, so taking capture on pointer-down made the
  slide work and **stopped every mark working**, the `click` landing on the
  box rather than the button under the hand; capture is taken at the
  threshold, where it also stops a drag ending in a press. **A corner set the
  width and never the height** (46% → 60% with the height pinned at 1.87in):
  §9m's *only the width is dragged, the height follows the picture* is **right
  about a box with a picture in it and silent about an empty one**, which is
  the only kind a corner is dragged on, so an empty box takes both from the
  drag. **A drag too small to be a box** made one — the floor was eight pixels
  across and nothing down, and the band clamps anything under a fifth of the
  measure *up* to a fifth, so a twitch while dismissing the tool became a 20%
  box in a place nobody chose. And **the head of a page was the tail of
  something that began on the page before**, which is *it pops the box on the
  wrong page* and is not about the drag at all: a page very often opens with a
  paragraph the cutter split, `pagePlace`'s `elementId` was the first body
  block tail or not, and everything built on it puts its thing **in front of**
  the element — measured, *Put a blank sheet here…* on page 12 took **page 11
  from 1,538 characters to 781**. **The head of a page is the first thing that
  begins on it**; a tail is the head of nothing, and where the page is nothing
  but a tail the tail is still the answer rather than silence (§9aa's fault)
  with `elementBegins` naming the page it reaches so the room says so before
  the press. It is **one reading**, `bookPageRows` having kept its own copy —
  *which is `pagePlace`'s answer for one sheet*, said in that field's own doc
  while skipping neither a stand-in nor a tail. **And §9q's own suite caught
  what that would have broken**: a picture that is **a page of its own is
  *reached* rather than placed**, waiting for the next leaf, so anchored in
  front of a tail it is reached on the page before and takes *this* page with
  that page left as full as it was — anchored at the first paragraph beginning
  here it would take the **next** one, every plate a page late. So
  `topElement` is the other position, **two positions rather than two
  answers**, `pictureOffer` carries both and **no caller chooses**
  (`movePictureTo` reads the picture's own placement); on every page that does
  not open with half a paragraph the two are the same element, which is why no
  book moves and why §9q's assertions are byte for byte what they were. A
  blank sheet now lands **after that page's own words** (page 12 keeps its 757
  characters and the sheet is 13–14) — of two imperfect answers for a page
  that cannot be broken mid-paragraph, the one where nothing already written
  moves — and that is **deliberately not said on the screen**, most pages of a
  novel opening with a tail so the sentence would stand on most pages of the
  book (§8a's lesson). *It erased a big chunk of text* is the box doing its
  work and Ken answered it himself: driven, a 46% box takes page 12 from 3,015
  characters to 1,367 and ✗ puts it back to 3,015 exactly, which the handle's
  **tooltip** now says, that being where this control's help already lives
  rather than a line standing on every box forever.
  **§9ae is half a sheet, and the page's own route first**, from Ken in three
  messages (*we also need the ability to shift a page to the left or right. So
  when you select a page, it will shift half a page… if it's on the left-hand
  side, it'll swap it to the right-facing page*; *when I go to add a picture to
  that page, there needs to be some kind of warning or ask if you want to make
  this a chapter page… it adds the picture in the right place. But moves that
  text to the next page*; *make the set this as a story page at the top of the
  dialog box*). The smallest has a rule under it: *Set this story's page…*
  stood **under** four picture buttons, so on a page a story opens the one
  control that says what the page **is** was the last thing on the screen —
  addendum 02 §4a's ordering argument the wrong way round, and what the test
  pins is the **order**, the control never having been missing. **A sheet
  moves nothing and a shift moves everything**: §9ad's argument is that two
  pages cannot change a side, and this is its complement and the only other
  thing a writer can want in the same place, so the two write **one field** and
  the field counts **pages** rather than leaves — a second field for the half
  would be two records of one number, with `SHEET` the one place that says how
  many pages a sheet is and `true` still reading as a whole one, so nothing is
  migrated. **On and back are not two directions on the page**, both landing it
  on the other side because parity flips either way; what differs is whether
  the book grows or shrinks. **Measuring corrected the sentence**: the first
  draft said a shift *moves every page after it with it*, and driven over three
  stories it is taken up by the **next** division the book holds on a
  right-hand page — six of twelve openings cost a page and six cost none, the
  pages in between swapping sides either way — so the note says *as far as the
  next opening the book holds on a right-hand page* and the test asserts the
  **side**, the length not being the ask. **And where a rule holds the page the
  shift frees the rule**, which is the half that was first answered with a
  refusal and answered wrongly: a division forced onto a right-hand page has
  the verso in front of it left empty already, so one blank page there is
  absorbed and nothing moves — true, and on a book whose chapters all open
  recto (the default, and Ken's) it made the control refuse on **every page a
  writer would reach for**. *Move this page to the other side* is one thing a
  writer wants and what moves such a page is the **rule**, which §9x already
  made a per-chapter field, so the shift writes `opensRecto` instead of a
  blank: one control, one sentence, two mechanisms underneath, and which
  applies is the room's business rather than the writer's. **The picture says
  what it will do before the press** — §9p's act is right (a picture of its own
  stands in front of the opening, which is where a facing illustration belongs)
  and the room said so only behind the `?`, so the consequence arrived after
  the press while the other act (art **on** the opening, which moves nothing)
  was a button away with nothing joining the two; it is **one note with two
  readings** and never two, a leaf already in front meaning the picture fills
  that and the opening does not move at all. Driving it caught **the reason
  vanishing with the buttons** — the shift section was gated on its two
  controls, so on a page the book holds, the commonest case, the screen said
  nothing: *absent rather than greyed* is a rule about the control and never
  about the sentence that explains it (§9w). **Named rather than fixed**: the
  stale-build notice is in the DOM at 1440 × 47 while a room is open and
  **painted over by it** (`z-index: 40`), addendum 29 §2's *a room covers the
  menu bar* pointed at the one bar that says why the program is behaving oddly;
  and the **drawn box**, which lands at the top rather than where it was
  dragged, at full measure rather than the width drawn, on the facing page, and
  cannot be moved or resized afterwards — a report against §9z's gesture rather
  than against the sheet.
  **§9ad is that a blank page is a sheet**, from Ken looking at §9ac in his
  own book (*I think the problem is, when you enter a blank page, it's entering
  a blank half page… if you insert a blank page, it's blank on front and back,
  like a separating page, and then you can place information or whatever, or
  change that page into a chapter page or a story page*), and **the keeper is
  that §9ac read a specification as a complaint**: *it's adding a front and
  back page… it's not just adding one side or the other* was him saying what a
  blank page **should** be, and §9ac measured the +2/+0 that press really cost
  and spent its whole design making one leaf **one page**, standing the
  chapter's recto rule down to do it. **When a report and a requirement are the
  same sentence, the measurement tells you what is happening and not what was
  asked for.** So a blank page is **two pages** and what the writer then puts
  on it goes on the front with the back left blank, which is what a separating
  sheet is and why *you can place information on it* needed nothing new. Two
  pages is also the half §9ac was reaching for: **an even number cannot change
  which side anything after it is on**, so the recto rule is left exactly where
  it was (§9ac's suppression taken back) and the arithmetic is the same on
  every parity — measured over fifteen arrangements at every count, **+2 a
  sheet, the opening down by exactly two, and the same side of the paper**,
  three things §9ac could assert none of. **Nothing forces the first blank onto
  a recto**: it would take the recto the page after it wanted and cost a
  **third** page on half the parities (§9ac's own fault with the opposite sign)
  and buys a reader nothing, the blanks falling in the same places either way.
  The offer counts **sheets** (two rows carry the mark, so `blankOffer` halves
  them) and says so before the press, a × on **either** page takes the whole
  sheet, and **a picture put on a sheet keeps the sheet** — one sheet off and
  the figure's own back left blank, two pages out and two back in, the same act
  in the story and in the front matter. §9w's *a picture will stand a page
  earlier* is **silenced on the writer's own sheet**, where the picture lands
  exactly where they pointed and the sentence named the cutter's gap the act
  never touches. Driven at 1440×900 on three imported stories: one press takes
  the rail to **Page 8 Blank · Page 9 Blank · Page 10 Blank** with *Falling*
  still opening on a right-hand page, moved 9 → 11; a picture on the sheet puts
  the art on 9 with 10 still blank and the book no longer. Every assertion that
  spelled the half-leaf out was **rewritten rather than worked around**, in six
  files.
  **§9ac is the pages in between**, from Ken in one message about one
  afternoon (*I tried to add a page and then it added it on the wrong page… It
  erased the in-between page* … *there's no pages in between and no way to put
  pages in between. It also merged story two and three together into one story
  for some reason… It shouldn't merge these stories ever. When you add a blank
  page, it should just shift everything down. So it's adding a front and back
  page… And you should be able to just put as many pages in between as you
  want. Then you can be able to turn a blank page into a chapter page*), and
  **both of his readings are one fault measured from either side**: on a
  faithful collection, asking for one blank leaf in front of a story that opens
  on a right-hand page grew the book by **two** pages in five of fifteen
  arrangements and by **nothing** in the other ten — the same press, two
  results, and which one a writer got decided by where the words happened to
  fall. **A story is never run together with the one before it**:
  `divisionRemoval` is a reading now (`trackRemoval`'s shape) and
  `removeDivision` refuses the same thing again, with `holdsWholeWorks` the one
  place that knows the difference — a chapter is a division *of* a novel, so
  merging two is an editorial act and is untouched, while a story in a
  collection and an episode of a series are **whole works that happen to be
  bound beside others**; an **empty** one still goes, which was §7's whole ask,
  and the × is **disabled with the reason in its title rather than absent**,
  absence being what read as *there's no way to delete those pages*. **A leaf
  the writer puts in stands the automatic recto rule down**, so each one is
  exactly a page and what follows moves down by one — kept where the page
  leaves its own **back** blank, a back having to be the other side of the same
  sheet (§9j) — and the one case that is not uniform is **said before the
  press**, the first leaf where a gap already stands taking that gap's place
  and making it the writer's, after which it has a ×, takes a picture and can
  be added to. §9r **refused** wherever a leaf already stood, which was right
  about the fact and wrong about the answer: it left the one gap in a book
  where a writer most wants a page of their own with nothing on offer at all.
  **`blankBefore` is a count** on all three records that carry it with `true`
  its older spelling (nothing migrated, no book moved), `leavesBefore` the one
  reading and `MAX_BLANK_LEAVES` the ceiling; the offer carries `leaves`,
  `fewer` and `note`, the Add menu **only ever adds**, and one leaf is taken
  away by the page's own × (§9x). **A blank page becomes a chapter page**
  through a break started on the section it stands in front of: §9ab read the
  *row's* `opensUnitId`, which on a leaf is nothing at all, so `PagePlace`
  carries it and §9aa's walk forward answers — which also fills it in on a page
  carrying a chapter opening and nothing else. And driving found a fault in
  shipped code with nothing to do with blank pages: **`ContextMenu` closed
  itself.** A press on a button inside a scrolling panel scrolls that panel —
  the browser bringing the focused thing into view, in the **next frame**,
  after the menu has opened and its effect has run — so on a rail anybody had
  scrolled the *+ Add* menu shut a frame after it opened: **twenty-one items
  with the rail at the top and nought with a page halfway down it chosen**, the
  rail going 206 → 0 in the same breath. From the writer's chair a menu that
  flashes and goes is a menu with nothing in it, which is §9ab's *in the menu,
  there's no way to add a chapter page* said about a menu that had the item all
  along — and it was true of **every** menu opened from a scrolled panel, so
  the guard is the menu's rather than each opener's (a scroll closes it from
  the frame after it has settled), with *+ Add* declining the focus a mouse
  press gives it so the rail keeps its place. Driven at 1440×900: three presses
  take the book 14 → 14 → 15 → 16 with the rail reading **Page 8 Blank, Page 9
  Blank, Page 10 Blank** and *Falling* opening on 11, taking one away gives 15,
  and the × on that story refuses in both places with the three stories
  standing. Six assertions spelling out the old behaviour were **rewritten
  rather than worked around**, each having pinned the fault as a requirement.
  **§9ab is a break you can make, and a page you can put in anywhere**, from
  Ken in four messages about one afternoon (*I should be able to insert a page
  at any point. That page can be anything. It can be a chapter page. It can be
  a picture page. It can be a blank page. Right now, it's locking me out if
  it's a blank page* … *in the menu, there's no way to add a chapter page,
  which might solve the problem* … *the story is still there, but it now no
  longer shows up in the left menu bar* … *each story needs to be held together
  not merged with other stories*). **Measured first on three imported
  stories**: the × on a story's own page answers *the break goes, the words
  stay* — honest, and §9x put it there deliberately — and the book then reads
  *In For A Pound gone from the Layout rail, gone from the Stories rail, every
  word of it still in the book*, its six pages filed under the story after it.
  **Two faults, the same one from two ends.** The break had a × and **no
  inverse**: nothing anywhere could start a division on writing that exists,
  *+ New story* making a new empty section at the end, so one press took a
  story out with no way back — the one thing a room full of × buttons may never
  have. `divisionStart`/`startDivision` are `divisionRemoval`/`removeDivision`'s
  exact inverses in `trackRemoval`'s shape, and **a division begins where a
  section begins** is the one rule (a marker sits on a unit, so starting one
  mid-section is splitting the writing, which is the manuscript's act);
  `opensUnitId` joins `BookPageRow` for it, `unitId` being carried forward and
  so answering the other question. **It opens its own page, because it arrives
  unnamed** — the name went with the marker, and a row reading *Story* where
  *The Harbour* was is the loss reported twice — which is §9u's *a page made
  opens*, and a division's page **is** its chapter page, so it is also the item
  he asked for by name. And **writing no division claims is listed rather than
  merged**, at depth 0 because it is inside nothing: `unplacedSections` **was
  already that reading** (addendum 22 §8) with four tests as its only callers,
  so it is `unclaimedUnits` narrowed to a collection now, one answer, silent
  where a book has no divisions at all (a novel nobody cut into chapters is the
  story) and loud on a collection, whose writing always belongs to a story. The
  Stories rail says it too with the same act beside it. **+ Add inserts where
  you are** (it appended to the end of its half, so a page added on page vi
  landed after the index and had to be dragged back — §9aa's own detour one
  menu over), and **§9aa's front-matter refusal was the lock-out he reported**,
  naming that detour as a sentence: a leaf there has no record to hang a
  picture from and **has a position**, so `newPageBefore` puts the page of art
  exactly there, taking the leaf as `takesLeaf` does in the story. Driving
  caught the half that would have shipped broken — **the panel gated its
  picture buttons on `offer.spot`** and this answer names no record, so the
  front leaf drew **no buttons at all** while the domain answered perfectly:
  whether a picture may be put here is whether anything **refuses** it, never
  whether the offer names a record. **The back of the page is a tick** (his
  own ask), addendum 02 §4a's switch exactly — a label that is the act it
  would perform says nothing about the state, and pressing it is the one thing
  that changes the answer; every other back-blank in the room was already a
  checkbox. Driven at 1440×900: the × leaves I, II, III standing as their own
  rows, the Add menu offers *Start a story here… — The 3 sections from here to
  the next story become one story*, and after it the rail is **identical to the
  import**; a page of art asked for on the leaf between the half title and the
  title page lands on page ii with the book still 18 pages.
  **§9aa is every page being a page you can put something on**, from Ken (*I'm
  trying to put a picture on a page that is blank and there's nothing I can do
  to edit it… I want to put it on the page after, which is before the next
  chapter… Every page should be editable… it should be on the page that I
  set*). **Measured first**: on his novel every chapter runs a page and the
  recto rule leaves the verso after it empty, so a leaf stands between every
  pair of chapters — exactly where an illustration facing a chapter belongs —
  and that leaf's screen carried **one sentence and one button**, the sentence
  sending him to the page *after* it to do by hand what the cutter would then
  undo: **two redirections to land where he pointed in the first place**. The
  fix is **`pagePlace`'s own sentence finished** — *a press on a page is
  answered by reading what is on it*, **and where nothing is on it, by reading
  what it stands in front of**, which is the same position, a page of its own
  taking the next page there is and so **filling an empty leaf rather than
  adding one** (§9w). It lives in `pagePlace` for the reason that settles every
  question of this shape here: **every act built on it is covered the day it is
  written**, where a reading only `pictureOffer` asked would leave the next one
  broken again; `standsBefore` says which page the answer came off, so a caller
  asking what a page **is** can still tell it from what may go on it. Three
  things are **not** carried from the page ahead — `opensAlone` (the chapter
  does not open here, and the back of its own page is two sides of paper away),
  and a **part** at all (a part's picture is its own art or an inset in its
  words, so a leaf given one would draw on the page ahead; the walk stops there
  and the refusal **names the route**, *+ Add puts a page of art in*) — while
  `opensMarkerId` **is**, §9t's hoist having to know the leaf stands in front of
  a division's whole opening. **A leaf and a page of its own are the same page
  said two ways** (§9i's own sentence), so somebody who asked for a leaf and
  then says what stands on it **meant one page**: `takesLeaf` names the record
  and the act clears the leaf as the picture goes in, since left in it slides
  behind the picture and reads as the picture landing a page early. A leaf
  carries **a page of its own and nothing else** — a box is cut into words and
  a graphic set over them, so on a page with none both would ride a block that
  is on the page ahead, **absent rather than greyed** in the panel and the Add
  menu alike — a **leaf kept empty on purpose is refused naming the switch**,
  and a **second blank is refused with the reason**. *Set any page as a chapter
  page* is answered by the **route**: the leaf exists because the chapter after
  it opens recto and that rule is on that chapter's own page, so *Set the next
  chapter's page…* stands here, read off `place.opensMarkerId` rather than the
  second walk it kept before, in `nounsFor`'s word rather than *chapter*
  outright. Driven at 1440×900: the picture lands on **page 4** facing chapter
  3, the book still 26 pages; a leaf put in by hand reads *Illustration* with
  the book staying at 28 rather than 29; and walking all twenty page rows,
  every blank leaf of the story offers the picture and the route. Looking at it
  caught **the same fact said twice** — *the leaf in front of this page is
  empty* and *a blank page already stands in front of this one* are set on the
  identical condition (§9y one sentence along), so the second is left to the
  Add menu's greyed title. **Named rather than half-built**: a *designed* page
  standing alone mid-story, which is a chapter page without a chapter and so is
  either a chapter break (cutting the writing, the Outliner's) or §9i's named
  blocker, a part that can stand between two pages of the story.
  **§9z is a picture landing where it is drawn**, from Ken (*I was trying to
  fill the bottom of a last page of a section with a picture but it doesn't
  allow me to move the picture around or place it somewhere, it places it and
  then it's just stuck there… I need the ability to move the picture around
  drop it the text will adjust or if there's no text on that page then it can
  just fill that portion of the page*) — **one gesture with three faults under
  it, and none of them about the picture**. **Where it goes**: a figure has
  always been anchored **before** an element, which is every position in the
  writing but one — **after the last words on the page**, which is exactly the
  foot of a page whose text runs short and exactly what he was reaching for, so
  the position he wanted was the only one the module could not express;
  `blockUnder` had the same hole from the other end, falling through to the
  last piece and so meaning *before the last paragraph*, a line higher up. A
  `FigureAnchor` says which end and `moveFigureTo` is **one act** (*before* and
  *after* are the same insertion with the index one apart, and two functions
  would be two answers to where a picture goes), with `moveFigureBefore` that
  act with `after` false. **And `onDrawn` never asked at all** — it anchored
  every box at the element the page *opens with*, so the whole vertical half of
  the drag was thrown away and a box drawn at the foot appeared at the top,
  which is the whole of *it places it and then it's just stuck there*; it reads
  the same `blockUnder` the handle slides by, so drawing a box and dragging one
  cannot disagree about what a height means, with `pagePlace`'s walk forward
  still the answer where the block under the pointer is not a manuscript
  element (§9s's stood-in title, a chapter opening). **What it is**: a drawn
  box was **always cut into the text** whatever its width — its own comment
  said so — so a box drawn right across the measure was clamped to
  `INSET_SPAN.max` and called *cut in at the left*, a picture that cannot be
  what it was drawn as; `drawnFigurePlace` reads the share and **the band
  already says where the line is**, past the widest an inset may be there
  being no text to cut into, so the number is the band's own and nothing new
  decides it. **How big it is** is the half that made the first two invisible:
  an empty box is measured by `pictureLines`, which answered **a third of a
  page** for every box with no picture yet, so one drawn to fill the white
  under a section's closing words did not fit there and the cutter moved it on
  — the markup drew it at the size of the drag and **the measurement, which is
  what the cutter reads, had never heard of the drag**, so the box on the
  screen and the hole the page kept for it were two different sizes.
  `boxHeight` is the drawn height as a share of the measure, so the aspect
  ratio and the measurement are **one number read twice**; it is read **only
  while the box is empty** (the moment a picture arrives its proportions
  decide, §9m unchanged) and kept through every place a picture can take, being
  the size the box was dragged to rather than anything about the arrangement,
  with nothing drawn still reading as a third of a page — every box made before
  this, which is why the suite passed with three assertions edited and those
  only because the placement gained a field. **Driving it found two more no
  test could.** `finish()` **mixed zoomed and unzoomed pixels** — the box is
  measured unzoomed two lines above and the text block was read straight off
  its client rect, so every figure taken from the two was out by the zoom,
  which is 1 only when a writer has typed a number in: at *Fit* a modest box
  read as full width and the side it cut in at was decided against a midpoint
  in the wrong units, `measureOn` having divided by the zoom since it was
  written and this being the one place that did not. And **`moveFigureTo` put
  the picture down more than once**, inserting wherever the anchor was found,
  so a document holding one id in two beats came back with **two pictures** —
  one act making a second copy, the one failure a move may never have; the
  first match is the move now, nothing refusing a repeated id so the act does
  not depend on one. Driven at 1440×900 on an imported novel: a box drawn in
  the white under chapter one's last line lands at the foot of page 1 at the
  size it was drawn (4.19 × 0.89 in, across the measure) and a picture put in
  sets across the measure under the last line; a narrow box drawn beside the
  third paragraph cuts in at the right with the text running round it, and
  dragging that one down to the foot takes it out of the text, stands it
  across the measure and the text closes up. **Deliberately not changed**: an
  inset with nothing left to cut into stands **across the measure** and so
  draws full width rather than at its own span, which is §8's own rule since
  the inset was built — a picture at the very end has no words to run beside
  it — and is not written back onto the record, which would be storing what
  `bookBlocks` already answers.
  **§17e is every page accounted for, and the words on a dedication**, from Ken
  in one message (*I added the title page and said, leave the back of it blank,
  but it left an additional page blank*; *all pages need to be accounted for
  blank or not and blank pages need to be able to be added and removed easily
  and show up in the outliner in the left*; *when I add a dedication page, it
  doesn't allow me to actually add any text to it*), and the first two are **one
  report counted twice**. **The arithmetic was correct and he was still right**:
  measured first, a novel's front matter is 26 sheets and the back-blank makes
  it 28 either way — everything after the leaf moves on by one and the contents
  page opens on a right-hand page, so a blank falls in front of it — and what
  was wrong is **which leaves**. §17d forced the copyright page to a `verso` to
  keep *the back of the title page*, and **the force bought nothing where the
  convention holds** (a title page is a recto one page long, so the page after
  it is a verso anyway); where it bit is exactly where the writer asked for
  something else — with a blank behind the title page the next leaf is a recto,
  the force skipped it, and the two blanks fell **side by side**, a spread with
  nothing on either page, which no book does by accident. It takes the next page
  now, §17d's own assertion **rewritten rather than worked around** (it pinned
  where the copyright page landed and never what the reader sees), and the
  remaining +2 is **said before the press**. **The second half is the more
  important one**: a book that grew by two leaves could not be asked where they
  had gone, because **a part claimed no pages at all** — §9m made a division's
  pages a range and the front matter never got the same treatment, so the leaf
  between the half title and the title page, and the back-blank itself, were
  under no row, listed nowhere and had no ×, which is §9w's and §9x's stray page
  a third time. `pagesUnder` claims a part's pages the way it claims a
  division's and `rowHasUnder` folds a part **only where it holds more than the
  page its row already named**, so a half title stays one row; driven, Title page
  *iii* folds onto *Page ii Blank · Page iii Page · Page iv Blank*. Two faults
  then showed that only a row could show. **The × on the leaf he had asked for
  refused**: §9i wrote `pageRemoval`'s back-blank branch for a **picture**,
  §17d then gave a part the same switch and §9r a chapter page, and neither
  reached it — so the one leaf in the book somebody had deliberately asked for
  was the one with no act, under a sentence naming the recto rule, the reason
  for a different leaf two pages away. One asymmetry caused it: `setBlankPage`
  reads which of three collections an id names and says in its own comment that
  **which of them an id names is a fact the caller should not have to carry**,
  while `setBackBlank` — the same act said of the other side of the leaf —
  walked the manuscript alone; it reads all three now, so `pageRemoval` needs no
  third branch and the act is the same act (driven: 26 → 28 → 26). **And the
  sentence named a picture that was not there**, `blankBack` being one flag for
  two things, so `page_back` is a fourth `BlankReason` — and asking the page in
  front which it is, is **not** the guess §9w removed, the block having already
  said this leaf is a back and the page in front only saying what it is the back
  **of**. A third came from reading the screen: **the refusal named the wrong
  page**, `sayBlankReason` being one reading for the help text (which stands on
  the **leaf's** own screen) and both refusals (which stand on **the page the
  leaf is in front of**), so *the page after it opens on a right-hand page* read
  on the title page's card as a claim about the copyright page; the voice is
  **asked for rather than guessed**, in one function rather than two copies of
  four reasons, and only `recto` goes actively wrong either way, which is why it
  survived. **The dedication was a route carried without what the screen it
  replaced alone could do**: `part.text` has printed since §5 and the box that
  wrote it was `PartFields`', which stood in the inspector until §9u deleted the
  column after §9n had routed the double-click to the designed page's screen —
  **§15c's own rule failing in the other direction**, that section having found
  a route passing *through* the screen it replaced and its sentence (*routing
  past a screen without carrying its controls is how a fix loses a feature*)
  being true here of a dedication's words. `partCarriesOwnWords` is **a rule
  rather than a list of kinds** (a `block` that carries `text` and is not the
  copyright page, which prints its own record), so a dedication and an epigraph
  get the box while the half title and the title page do not, their words being
  `bookNames`' — §16d's distinction from the other side, this being two fields
  rather than one field with two doors. Driving it caught the wording: the first
  tile read **Title text — set in type from the book's title** over a box
  holding a dedication, the half title's vocabulary reaching a page it does not
  describe (§6c's sweep in copy rather than in a noun); it reads the same name
  the field below it does, from one place. What the tests pin is the **gesture**
  (§15a), which is what the section is about three times over — a writer who
  adds a dedication must be able to type into the screen the act opens, a leaf a
  writer asked for must have an act on its row, and a book that grows must be
  able to say where.
  **§9r is a blank page wherever you want**, from Ken (*the chapter page we
  have a blank on the back, and you should be able to enter a blank page
  wherever you want*), then, a minute later, *tried to put a blank page on the
  chapter one page and it wouldn't allow me*. **Wherever was the whole ask and
  the whole gap**: §9i built the writer's own blank on a **manuscript
  element**, which is right — a page is not a record, so a blank moves when the
  words move — and it made the act's reach exactly the manuscript's, the panel
  gating the button on `place.elementId`, so a leaf could go before a paragraph
  of the story and **nowhere else**: not between the title page and the
  copyright page, not before an appendix, and not on the page a chapter opens
  on. That last is **§9p's fault a second time** — a chapter opening is emitted
  by the **unit** and not by an element, so *before the opening* cannot be said
  with a `beforeElementId` at all, and hung on the chapter's first element the
  leaf lands **between the numeral and the words**; §9p found it for pictures,
  and for blanks it showed as the control being **absent**, which reads as the
  feature not being there. So the act keeps its shape and grows two more places
  to live, each on the record that owns the page: `blankBefore` on a **part**
  (beside §17d's `backBlank`), and `blankBefore` + `backBlank` on the **chapter
  page record**, the same `chapterPageSchema` that has carried the summary, the
  template and the picture, emitted **around the opening**. **`blankSpot` is
  the one reading that decides what a press means** and the order in it is the
  fix — `page.blankFor ?? place.opensMarkerId ?? place.elementId ??
  place.partId` — the marker **before** the element so a chapter's page answers
  for the chapter rather than for its first paragraph, and `blankFor` before
  everything so a leaf says which page asked for it and can be taken away
  again; `setBlankPage` looks the id up across the three collections, which is
  what lets one button serve a part, a chapter and a paragraph without the
  screen knowing which it has (*one act read where it lands*). `PagePlace`
  gained `opensMarkerId` and `opensAlone`, both read **off the laid page**
  rather than from the block's `display` flag, and that distinction cost an
  hour: my first gate asked `opensOnLeaf`, true only where the page was given a
  device, a summary or an epigraph — while a chapter page carrying nothing but
  its title still **stands alone**, which is exactly the shape of Ken's
  stories, so the control appeared on **none** of his chapters;
  `page.pieces.length === 1` is the fact the screen needs and it is a fact
  about the page. The back-blank is offered **only where the opening stands
  alone**, a page carrying the chapter's first words having no back to leave.
  Two pages stay **absent**, §9i's rule kept: the blanks the **cutter** left
  are nobody's to remove there and the page's screen already says which of the
  three reasons a page is blank. Driving the room found the last of it and it
  is a **route** fault of §15c's and §16b's kind — the control was right and
  unreachable in the front matter, because selecting a part row shows the
  **part's** panel and not the page's — so it is in three places now, all
  writing the same field, which is *a second control onto one field* (§16d)
  rather than a second answer. And it caught the half of §9r worth keeping:
  **a blank block takes the next page**, and a chapter opening on a right-hand
  page has already left the verso in front of it empty, so a leaf asked for
  there **fills the cutter's gap and the book does not grow** — a press that
  changes no page a writer can see, which reads exactly like *it wouldn't
  allow me*. The obvious repair is wrong: before a recto page a second blank
  costs **two**, so asking for one leaf would give three, and **the absorption
  is correct typography**. So the act is unchanged and the screen **says what
  is already true before the press** — `blankOffer` in `trackRemoval`'s shape
  (the spot, the button's words, or the refusal), the control **absent with
  the reason in its place** where a leaf already stands in front, never
  refused where that leaf is the writer's own since its page is the only place
  it can be found again; `partBlankOffer` asks it of a **part**, because the
  other two surfaces set the field from the part and a screen toggling it
  blind would go on absorbing silently. On Ken's collection it is offered on
  the half title, the copyright page, the contents and the back matter, and
  refused on the **title page**, whose predecessor is the half title's own
  blank back.
  **§9s is the page that could not be edited**, from Ken in two reports with
  **one cause**: *there still needs to be on the chapter page the option to
  make the back of that page blank*, and *when I select page two and I try to
  make it blank, that doesn't work… there's something about that opening
  formatted page that doesn't allow you to edit it. It also doesn't allow me to
  put a picture… I should be able to double click that page and put a blank
  page or a picture there or a vector graphic. And then that page two goes to
  page three. So if I want to open with a picture, I can.* §9l stands a
  section's own title in where the manuscript carries no heading — a book
  imported before §9j, which is his — and **the block it makes is not a
  manuscript element**: its id names the *unit*. Headings are body blocks, so
  `pagePlace` answered a press with the **stand-in**, and every act built on
  that answer looks the id up in the manuscript (`setBlankPage` walks the three
  collections, `placeFigure` finds the beat that holds the element) — so all of
  them found nothing and **returned the document unchanged**. Not an error and
  not a refusal: the page simply did not respond, which is why it read as one
  nothing could be done to. `BookBlock` carries **`standsIn`** now and
  `pagePlace` answers with the first **real** element, and two rules follow.
  **What is anchored to it is emitted in front of the stand-in** — the blank
  already was, so the leaf lands before the numeral and the whole opening moves
  on together (*that page two goes to page three*), while a **page-figure** was
  drawn after it, so the stand-in **waits** for the pictures in front of it and
  is flushed before the first block that is not one (and at the end of the
  unit, so a section of nothing but pictures still prints its numeral) — §9p's
  rule for a chapter with a marker, said for a chapter without one. And
  **§9p's own fallback had the same hole one page over**: a page carrying only
  a chapter opening walks forward for the next body block, which on this book
  is the *following* section's stand-in. Nothing a book **prints** changes;
  this is a fix to what a page *answers*, pinned by a test that the stand-in is
  still drawn, still three of them, still in the same place. The other half is
  §15c and §16b's lesson a **fourth** time: §9r put both leaves on the Layout
  room's **page panel** and not on the screen that *is* the chapter page — the
  one *File ▸ Chapter page…* documents — so they are in `PagePlacementFields`
  now, writing through that dialog's own `patch`, and the gate is the same one,
  **`standsAlone` being a fact about the laid page**, so the dialog takes the
  room's laid pages rather than keeping a second, coarser reading that could
  disagree with the panel an inch away; opened over the workspace there are no
  laid pages and the control is **shown rather than hidden** (§16c).
  **§9t is a picture on the numeral's page**, from Ken on his own collection
  (*where the Roman numeral one, that page, I go to add a picture of that page,
  which should shift that Roman numeral to the following page. But instead it
  adds the picture on the opposite of the chapter page with the In For A Pound
  graphic*). It is **§9p's hoist reaching one page too far**, from a shape §9p
  never met: a collection's first section **opens twice** — the story's own art
  page and then its numeral, two pages of one unit (addendum 22 §6) — while
  §9p's *a page-figure at the head of a unit is emitted before the chapter
  opens* was written for a chapter whose opening and first words share a page,
  where there is nowhere else for a picture to be. Here there is, **between the
  two**, which is where the writing already puts it. So the hoist asks whether
  anything else would stand between the picture and the opening and refuses
  where the unit carries **a division heading of its own** — a heading element,
  or the title §9l stands in where the manuscript has none, which is his book;
  a novel is unchanged and §9p's own suite passed untouched, which is the
  proof. Building it found the second half **in code §9s had just written**:
  §9s made the stand-in wait for page-figures, but a page-figure also
  *consumed* the section head, so a unit with a **real** heading got a stand-in
  as well and the page drew two numerals. The deferral is gone and the rule is
  simpler than what it replaced — **a picture that is a page of its own does
  not open the section**: it stands in front of what does, the head stays
  pending, and the numeral (real or stood in) is emitted after the picture. One
  condition rather than a held-back block, answering both asks.
  **§9u is the column, removed**, from Ken (*since we can double click any of
  the pages and it opens up the dialog box, let's remove the right-hand menu.
  There's no need for it. It's just redundant*). He is right and §9f had got
  half way: the inspector was the selection's, and what it held was **the
  screen a double-click opens** — a second copy of one screen, costing a third
  of a laptop window, which since §9e is a third less book. The deletion is one
  line and **the repairs are the work**, because a column that answers a single
  press hides every gap in the double-click. **Two rows opened nothing at all**:
  a **section** (a chapter inside a story, addendum 22 §6) and a **picture**
  are not records with screens of their own, so both open the page they stand
  on — the section through `openPage`, which already routes a page to whatever
  owns it, and the picture **not** through it, a picture not being a page and
  the page it stands on very often being a chapter's opening, whose leaf says
  nothing about a picture cut into the text under it. **A page's dialog could
  not name most pictures**: a page row's `figureId` names only a picture that
  *is* a page, so the dialog is about the picture **in hand** where it stands
  on this page and falls back to the page's own — and `pageOf` had the same
  hole one layer down, a **free** graphic riding a block without being one, so
  its row carried no page number and had nothing to open. **A chapter's opening
  page lost its own acts**: §9j sent it straight to the chapter's leaf, right
  while the column still answered a press with the page's acts and stranding
  them without it, so the special case is gone and §9j's own words are kept
  (*if I double-click any page, the page setup dialog box should pop up with
  all the options for that page*) while §9l's **route** stays — *Set this
  chapter's page…* one press on, a door rather than a second copy, the
  chapter's own row still opening its leaf directly. And **a page made answered
  with a rail row**, so adding a part now opens it. Two dead panels came out
  with it: `PartFields` held a **second set of fields for the half title and
  the title page** (`partPlacement` calls both a block, so both have opened the
  designed-page screen since §9n) and a button through to the copyright page's
  screen (§15c sends the double-click straight there) — both reachable from the
  column and nowhere else. **A route that only one surface can reach is a
  feature nobody finds; when that surface goes, what it alone could do is
  either carried or deleted, never left.**
  **§9v is what the contents lists, and a reorder it follows**, from Ken in
  one message (*you need to be able to select in the menu what is going to be
  in the table of contents… Or that can be done in the contents dialog box*;
  *when you reorder anything, in that left menu it dynamically updates — right
  now it updates but you have to erase and reload the page*). **The reorder is
  one line and the line is what the laying watches**: the rail reads the file
  and redrew at once, while the contents, the running heads and every page
  number come off the **laying**, whose key listed a unit's id, title and
  `inScript` and **not where it falls** — so a chapter dragged rekeys the units
  it moved without touching a word, nothing in the key moved, and the room went
  on drawing the book in the order it used to be in (measured: the rail put
  FALLING above SIMPLE PLEASURES and the page still read *SIMPLE PLEASURES 9,
  FALLING 13*). `orderKey`, `trackId` and `kind` join it. The lesson is the
  room's own from the other end — **two readings of one document, and only one
  of them told when the document moves**. **The ticks are on the contents
  page's own screen** rather than in the rail, which Ken offered first and
  which cannot be it: the rail lists the *book*, where a story's chapters are a
  fold away, so ticking down it means opening every fold to see what is being
  ticked, while here **the list is the contents itself** — every entry in the
  book's order at its own depth with the page it would carry, beside the page
  the ticks make. Three decisions. **Only what is off is written down**
  (`contentsOut` holds the ids *not* listed, because a contents page lists the
  book and a chapter written tomorrow belongs on it without being asked, where
  a list of what is in would silently drop it). **A row is named by its record
  and never by its block** — a division by its marker, a section by its unit, a
  part by the part — so a tick survives the book being re-laid and an id naming
  nothing is ignored, which is what lets a chapter be deleted with nothing run.
  And **every row comes back either way**, carrying `listed`, so the screen can
  draw what is off and offer it back while the print skips it; a list of what is
  on could not, a row taken off having nowhere to be found. It also answers
  something nobody had reported: a collection whose first section is titled as
  the story lists that story **twice**, which is the manuscript saying the title
  twice and so the importer's business rather than the contents page's — the
  writer unticks the repeat, which is what the feature is for. Driving it caught
  the part dialog's two columns being one scrolling box, so the list of entries
  carried the page it is checked against off the top; the preview is **sticky**
  now, which every long panel wanted and only this one made plain.
  **§9w is the page as a row of the rail**, from Ken on an imported
  collection in four reports with one fact under them: **a page of the book
  was the only thing in this room nothing could be done to**. §9a put a × on
  every row and meant it; the page rows came afterwards (§9h) as a fold
  *under* a row rather than as rows, so they carried neither a × nor a grip
  and nothing said they would not. A page is still **not a record**, so what
  a × takes is **what the writer put on it** — a blank leaf they asked for,
  or the picture that *is* the page, both acts already built and reachable
  only from the page's own dialog — and `pageRemoval` is the one reading in
  `trackRemoval`'s shape. **The refusals are the more important half**,
  because a page nobody can work out how to be rid of is what he reported:
  the cutter's leaf is not the writer's to remove (§9i) and says which reason
  it is, a division's opening page is not a page to remove but a **break**
  whose row is one line above, and a page of the story's words goes by
  cutting the words on the Write page. Then the picture, where **three
  screens each decided for themselves whether one could go here**: the Add
  menu refused on a page with nothing of the book on it, **+ Picture**
  carried the same words in its title and **acted anyway**, and what it did
  was put an art page at the **back of the book** — measured, a picture asked
  for on page two arrived on page nine. `pictureOffer` is the one reading and
  the fallthrough is gone, which also ends §8c's claim that a vector graphic
  is offered on every page, a leaf being where the cutter stopped and so
  having nothing for a picture to stand before. Two true facts about the
  cutter then make a picture land elsewhere and neither was said: **an empty
  leaf in front of a page is filled rather than added to** (correct
  typography, and from the writer's chair *it snaps it before page one for
  some reason*, so it is **said before the press** and names the page, §9r's
  own answer pointed at a picture), and **a division's own opening page is
  not the page its first element is on** where it opens twice — §9t rightly
  stopped the hoist for the numeral's page and the unnoticed cost was that a
  picture asked for on the **story's** page landed between the two as well.
  Which opening the writer meant is **not derivable**; they said it by
  pointing at a page, so `bookBeforeOpening` carries it, the hoist reads it
  instead of guessing, and nothing written before this carries it, which is
  why no book moves and the suite passed unedited. **A picture drags**: the
  row said *it is moved by drawing its box on another page*, true of the
  **box** and taken to settle the drag as well — *which page* is a different
  question and the rail is where it is asked, landing on `moveFigureBefore`,
  the act the redraw already ran. Both drops go through `movePictureTo` and
  ask the **offer** rather than the row's own `elementId`, which on a
  division's opening page is nothing at all, so the drop refused on exactly
  the page a picture is dragged onto. **One sentence, and it says why**: *The
  page in front of this one is already blank. Its own page says why* is two
  sentences whose second has no referent — the page in front *is* a page —
  and the three reasons lived in the **page's own help text**, which is why
  the refusal could not reach them; `blankReason` is that reading and both
  refusals name it. Driving showed the reading was **a guess** (it asked what
  stood on the page before, so a picture there meant *this is its back*,
  wrong exactly where a picture opens a division), so the block says so —
  and that found a fault in code §9w did not write: **the back leaf was
  emitted on the element path and not on the hoist path**, so a picture in
  front of a chapter lost it, invisibly, because a recto after a recto leaves
  the verso empty anyway. And **every page is accounted for**: a page
  standing *in front of* the first division belonged to nobody and could not
  be reached from the rail at all — the plainest reading of his *stray page…
  in between the story and the front matter* — so pages no row claims are
  held and given to the next division. Driven at 1440×900 on his own state;
  three faults only looking caught, the keeper being that the asking rule was
  **correct and overruled by a later rule of equal specificity** (addendum 02
  §4a in this room), fixed by making the rule about the **state** beat the
  rule about the **kind** rather than by moving it. No migration.
  **§9x is that × being absent on every page of his book**, from Ken sending
  §9w's report back **word for word** — one thing eight times now. **The
  deploy was innocent** (checked rather than offered: the bundle on the site
  is the one §9w built, and §9a's stale-page notice would have said so
  otherwise), so it was **the reading**. §9w built `pageRemoval` with four
  answers and made the × **absent** on two of them — a page of the story's
  words and a page a division opens on — which between them are **every page
  a story has**: measured on his own state, pages one to five each carried
  none. *Absent rather than greyed* is right about a control that can only
  refuse and §9w read it as *and so there is no control*, never asking the
  question underneath — **what can a × on a page honestly do?** Every page has
  an answer: a writer's blank leaf, a picture, **the words on the page cut
  from the manuscript**, the back-blank taken off the picture in front, that
  chapter no longer opening on a right-hand page, or the break itself
  (`removeDivision`, the row's own act — **two controls onto one act are not
  two answers**, §16d). The one page that really has none is a part's, which
  has a row with a × above it, and that is **disabled with the reason in its
  title rather than absent**, because absence is what read as *there's no way
  to delete those pages*. **The stray page is the submission header**: driven
  on a story as a writer hands one over, the first sheet printed *The Harbour ·
  K. Shank · 114 Harbour Road · … · about 4,200 words* — writing as far as the
  manuscript is concerned, so nobody's to remove in Research, the Outliner or
  the rail, and not the story, so nothing in the room would take it out; the
  ask counts it (*6 paragraphs go…*) and afterwards the sheet reads *The
  Harbour* and nothing else. **Only what stands whole on the page** (a split
  paragraph runs on, and *the words on this page* has to mean this page), and
  **a leaf the cutter left is removed by removing its reason** — which needed
  the only new field, `opensRecto` on the chapter page, **nullable,
  null-means-the-book's** (`dropInches`' shape, no migration, nothing moves),
  and can shorten the book by **more than one page**, `blankOffer`'s
  absorption from the other end. His *very small dialogue box… put a picture,
  draw a box for a picture, add a vector graphic* is the page's own screen,
  which offered pictures and nothing else (§9h, written before a page could be
  taken away): it carries the act now, off the same reading, asked inline.
  Looking at it caught this project's oldest fault a fourth time — **`.danger`
  has no bare rule on this stylesheet**, so the act drew exactly like the five
  constructive buttons above it (`.muted`'s trap, addendum 09 §14a). Six of
  §9w's assertions were **rewritten rather than worked around**, all six
  asserting the absence this corrects, and the reason the first report came
  back unanswered is that **not one of them asked whether a writer could reach
  the act** — the new one walks every page of the book and fails if any row
  lacks a ×.
  **§8b of addendum 08 is getting a deleted cast back**, from Ken (*I
  accidentally deleted all the characters and I don't know how to get those
  back… we need to have something that defines and organizes in that
  character screen, major characters*), and driving it found the cause
  exactly: the Character Creator section was drawn **only where the cast had
  somebody in it**, so deleting the last person took the whole module off
  the menu — no way to make another and nothing saying where the old ones
  had gone, while the Graveyard quietly held all three. **A feature that
  vanishes when its list is empty is one a writer cannot get back into.** It
  stands now whatever the cast, with *+ New character* and, where people are
  buried, a line saying how many are in the Graveyard — said **there**,
  because somebody who has just lost a cast is looking at where it used to
  be. The organizing half needed no new data: `castByCategory` has grouped
  the cast under the writer's own headings since the categories were built,
  and the menu threw the groups away with a `flatMap`, so a project that had
  said who its leads were showed one undifferentiated list. **An empty
  heading is dropped in the menu and kept in the cast panel**, which is not
  a contradiction: the panel is where a writer *files* somebody, so an empty
  heading there is where the next one goes, while the menu is a list of
  people to click into and a heading over nobody points at nothing.
  **§9a is the rail as one linear tree**, from Ken after using the room —
  *this has become way too complicated to make this workable… this should
  be simple linear workflow… there shouldn't be all this extra wording* —
  and he read the old rail back in his own words, *art page, picture, story
  page above the first paragraph, story page, picture facing*. He was right,
  and the reason is worth keeping: §9's rail grew a heading per half and,
  between every pair of chapters, a **second row that existed only to carry
  two buttons and a sentence**, none of which says where anything is in the
  book. `bookRows` in `packages/domain/src/book-rail.ts` is **one list, one
  row per thing, in the order it is bound**, held there by two rules.
  **Containment is depth, never a heading** — the front matter, the story and
  the back matter are not three lists, they are the order, and the only
  nesting is a picture under the chapter it is in. And **a row is its name
  and its page and nothing else**: no note, no state, no pair of buttons,
  what a row *is* said by where it sits, and a picture page named after its
  **picture** rather than after the words *Art page*. Nothing is stored, so
  cutting a chapter takes its pictures off the rail with nothing run. **A ×
  comes off every row** (*I added a new story on accident, and there's no
  way to get rid of it*): `removeBookRow` is one act for every kind, and
  `whatGoesWithRow` says what would go first — for a chapter the honest
  answer is that **the break goes and the words stay**, its sections joining
  the one before, *unless nothing is written in it*, which is the chapter
  added by accident and is a reading rather than a flag. **Select a page,
  add a picture to it**: a page is not a record, it is where the laying
  happened to cut, so `pagePlace` answers a press by reading what is *on*
  it, and a picture goes in **before the element the page opens with** — the
  page then opens with the picture and the words move down, which is the
  whole mechanism and stores nothing about pages. One act read where it
  lands (a figure in the story, an inset in a part with words, a page of its
  own where the page has neither), and the chosen page is **outlined on the
  spread** so nothing has to say in the margin which page is meant. **The
  box comes before the picture** now (*draw a box in a page and it will
  create a graphics box… and then add a graphic to it*): *Draw a box for a
  picture…* makes a figure with **no picture**, which the print stack has
  always drawn as a box holding its space — the words are *Picture goes
  here* rather than *Picture missing*, a box drawn on purpose not being a
  fault — and drawing it again on another page **moves the picture there**
  (`moveFigureBefore`) rather than lying about where it is. One drag, three
  landings the book already understood: a part within its half, a chapter
  with its sections, and **a picture page dropped on a chapter comes to face
  that chapter**; a figure in the writing is not draggable and says so. A
  double-click opens the one thing that sets that page, from the row or from
  the page on the spread, which are the same act.
  **§9b is turning the pages, and a rail you can read**, from Ken after
  setting a book. The rail opened at 288px, which fits *Copyright* and not
  *The Lamp and the Lighthouse*; it opens at **360** now, and only on a
  machine that has never dragged the divider, the width being remembered per
  machine. **A chapter inside a story did nothing when chosen** — every other
  row turns to its page and shows the page it opens on, and the Roman numerals
  under a story showed neither. The cause is the join addendum 22 §6 left
  open: the rail lists one of those by its **unit** while the block that opens
  it is the **heading element** and carries that element's id, so nothing on
  any laid page held the row's id. **`unitId` on `BookBlock`** joins them, set
  on the *first* block of each unit (so the page found is the one it opens on)
  and whatever that block is (a section with no heading still has a row), read
  by `pageOf` the way `partId` already joins a part's row to its page — no
  second reading, no unit-to-page map kept anywhere, nothing stored. **And the
  pages turn with an arrow**: a large one either side of the spread, the way
  pictures are turned on a web page, **beside** it rather than over it (a page
  being set is the thing to look at, and an arrow across its corner is in the
  way), with the scrubber left at the foot for moving a long way at once and
  the foot's own small ← and → **gone**, two answers to *turn the page* on one
  screen. Putting them beside the spread meant centring it in the viewport,
  which it had never been — it hugged the top, so the arrows sat well below
  the page they turn.
  **§6a is the six faces by name** — Garamond, Baskerville, Georgia, Caslon,
  Gill Sans, Lato — from Ken. §6's list names a **kind** and these name a
  **font**, and both belong for opposite reasons: a writer who knows they want
  Garamond should not have to work out that it is an old-style serif, and one
  who does not should not have to know what Garamond is. Offered **for a line
  of type as well as for the body, in one list** (a heading in *Garamond* and a
  page in *Garamond* being two fonts is the drift the room exists to stop), and
  each a **stack** headed by the font asked for — §12's open question unchanged,
  with **Lato and Caslon the two most likely to be missing**. The one part that
  is not cosmetic is the **character width** each carries: Garamond sets narrow
  at 0.44 em and Georgia wide at 0.50, which is why one wants a point more than
  the other and why moving a book from Georgia to Garamond gains characters to
  the line with the trim unchanged.
  **§6b is a font of the writer's own**, from Ken: *put an option to import a
  font … download a font, select it from a browse, and add it to your fonts*.
  It is **§12's first open question answered from the other end** — we ship no
  font files, a stack resolves to whatever is installed, and a writer who has
  licensed a face can hand it to their own book with **the file travelling in
  the project**, which is the whole point. Four decisions. **Importing never
  chooses the face** (two decisions, not one; the list offers *Use it*).
  **A face is a name or `font:<id>`** and `faceStackOf` is the **one place a
  face becomes type** — which mattered more than it looks, the part styles and
  the running heads having each carried their **own copy** of the face table,
  so an imported face would have set the story and left the front matter in
  whatever the copy held (§7a's argument where a second answer shows on the
  page). **A book whose font has gone still prints**: an imported face is its
  own family then a generic, a face naming a font that is not there falls all
  the way back, and the face is still stored so putting the file back brings
  the book back. And **the room waits for the font before believing its
  measurements** — a data URL decodes *after* the first layout, so the first
  measurement is of the fallback; `document.fonts.ready` and one more laying,
  and driving it proved the need, a display face taking a nine-sheet book to
  eleven. Capped at **4 MB** for `MAX_CHAPTER_IMAGE_BYTES`' reason, with the
  total said. Driving it found a fault in code it did not write: the
  renderer's **CSP allowed `data:` for images and nothing else**, so
  `font-src` fell through to `default-src 'self'` and every import failed with
  a network error — `font-src 'self' data:` is `img-src`'s own widening.
  **The eBook does not embed these** (§8's line since phase 1); the exported
  **PDF does**, the print document carrying the file inline from the builder
  the screen reads.
  **§9c is page settings**, from Ken looking at Book settings — *when you
  double click a page, these are the settings that need to be removed from book
  settings, and these are going to be page settings*. The line it draws is
  **placement against type**: where the picture sits, the rule, the drop and
  the air over the first paragraph are decisions about **one page** and a
  writer makes them page by page while looking at it; the face, the sizes, the
  case, the weight and the tracking stay **book-wide** for addendum 02 §12a's
  unchanged reason. The mechanism is the template's own shape — `rule`,
  `dropInches` and `openingLines` join it on the marker's page as **nullable,
  null meaning *use the book's*** — which is what makes an untouched page go on
  following the book when the book changes, where a copied number would freeze.
  `chapterPlacementOf` resolves them and the resolved placement rides on
  `ChapterPageContent`, so the print, the spread and the dialog's sheet draw
  the same page and a block with no placement draws exactly as it always did.
  The per-chapter **select** is gone (the tiles do it; two controls for one act
  are two answers), and the section **says which it is** — *This page follows
  the book*, or *This page is set on its own* with **Follow the book again**.
  **§9d is the custom graphic**, from Ken: *add custom graphic … the menu
  disappears and allows you to draw a box where you want the graphic, and then
  the text will move around it … you can slide it around and watch the text
  move around it … there will be an X or a check mark in the middle of the
  box*. Two halves existed (§9a's empty box, and choosing the picture after);
  what was missing is **sliding** and **the marks**. **The box being placed is
  drawn over the picture itself** — no ghost rectangle, the handle measured off
  the figure wherever the laying put it, so dragging moves the *figure*, the
  book is set again and the handle lands back on it. That is the whole of
  *watch the text move around it*, it costs a re-lay per drag, and it is what
  makes the gesture honest. **Sliding reads two things**: across the measure,
  the side it cuts in at; down the page, **which paragraph it rides in** — and
  the join is that a page's rendered children stand in the same order as its
  pieces, so the nth child is the nth piece's block and **the markup needs
  nothing added**; a `data-` attribute on every paragraph would change what the
  print and the eBook emit to answer a question only this room asks.
  **Placing is a state of the room and never of the figure**, so nothing is
  stored and a project saved mid-drag reads as a box standing where it was let
  go; **✗** is `removeBookFigure`, the only act that takes a box away, and the
  library's picture is untouched. *Add custom graphic…* stands in **This
  page**, closes the dialog when pressed (the box is drawn on the spread it was
  covering) and **✓** brings the page back with *Choose a picture…* waiting;
  it is **absent** from *File ▸ Chapter page…* over the workspace, there being
  no spread to draw on. That forced one change worth naming: **the Layout room
  now owns its chapter-page dialog** rather than handing the chapter to the
  workspace — fine while the dialog could do nothing the room had to help with,
  and wrong the moment it offered a control that draws on the spread behind
  it.
  **§9e is the spread fitting the window**, not from Ken but from opening the
  room and looking at it: the spread was drawn at a **stored 0.55** whatever
  window it was in, so a 1700-wide screen showed the book at under a third of
  the space it had and a 1280-wide laptop had to scroll the *same number*
  sideways — one figure, wrong in opposite directions on the two screens
  anybody uses. It is addendum 15 §15's *Whole story means the whole story
  fits* in another room, and lands the same way: **the size that fits is a
  reading**, `spreadFit` in `print-book.ts` over the geometry and the measured
  stage, stored nowhere, so widening the rail, resizing the window or changing
  the trim re-fits with nothing run. The stage's padding is set **inline from
  `SPREAD_INSET_PX`** rather than typed into the stylesheet as well, two
  numbers that must agree being two answers to how big a page may be drawn.
  Two decisions: **the fit is a full spread's whatever this sheet carries**
  (a half title stands alone, and fitting *that* page would draw it twice the
  size of every page after it — a book that changes size as it is turned is
  worse than one drawn small), and **a hand-set zoom is a different state that
  says so out loud** — `layout.pageZoom` is null-means-fit (`minimumSetups`'
  shape a fourth time) and the foot carries the word **Fit** as a statement
  while fitting and a **raised** Fit button once a number has been chosen,
  absent rather than greyed and raised rather than flat, because the same word
  drawn the same way in both states is two states that look alike. The key is
  **new**: the old `layout.zoom` held 0.55 on every machine that had opened the
  room, and that was not somebody choosing a zoom but the only size it could be
  read at.
  **§9f is the inspector**, from Ken after §9e: it was a fixed 320px column
  standing whether or not anything was chosen, and with nothing chosen it held
  **one paragraph** naming *+ Picture* and *Book settings…*, both of them
  labelled buttons already on the screen — a quarter of a 1280-wide window,
  which since §9e is a quarter less book (a page 211px wide with the column,
  370 without). **With nothing chosen there is no column**: the inspector is
  the selection's, which §9 said and the screen did not do, so *absent rather
  than greyed* pointed at a panel. What the paragraph said is one line under
  the rail cut to the two gestures a writer cannot see — *A page can be chosen
  on the spread too. A double-click opens it.* And **the column drags like the
  rail**: `useSplit` took a **`from: 'end'`** option so the same gesture sizes
  the pane *after* the divider, a second copy of the drag with its sign flipped
  being a second answer to how far the pointer moved; the spread re-fits as it
  moves, because §9e reads the stage rather than a number.
  **§9g is two numbers on the screen that were not the book's**, found by
  reading the room's dialogs. The **page count**: the bar said *13 pages* while
  the margin sentence beside it said *worked out from the trim and 9 pages* —
  `estimatedPages` breaks the circle (the gutter needs a count, the count needs
  the gutter) and `layBook` re-lays at the true count only when it lands in
  another tier of the band, so the guess survived into the sentences;
  `countedAt` stops it at the door, and nothing about the margins moves because
  the re-lay is skipped **exactly when** `insideFor` agrees at both counts and
  the inside margin is the only one a count reaches. The **chapter-page
  preview**: a letter-size sheet with fixed margins in Courier whatever the
  book was, under a comment reading *the shape it will print* — true when
  written, false from the day Layout existed, which is addendum 24 §5e's lesson
  one layer down (**a comment keeps its own copy of a rule as readily as a
  screen**). §9c had put the drop in that dialog *so a writer sets it while
  looking at the page*, and the page was eleven inches of typewriter paper.
  `chapterSheetVars` gives the sheet the book's trim, margins and face and
  `bookFaceOf` resolves the book's face on the leaf. Two details invisible when
  wrong: **a percentage padding resolves against the containing block's
  *width*** even at the top (the old sheet divided by the height and drew the
  drop at three quarters of where it meant to), and **the drop is from the top
  of the paper**, so the block's own padding carries the drop *less the top
  margin* over the text block's width. The drop-as-a-share moved out of
  `chapterStyleVars` — how tall the sheet is, is the sheet's business, and that
  is where the hard-coded eleven inches was hiding — as did the summary's face,
  Courier in a book as well as a manuscript where the reading face is the
  book's.
  **§9h is a page of the story being a thing you can choose**, from Ken after
  trying to put a full-page picture on a page he had picked (*it doesn't add
  the picture, but it seems to remove pages… trying to enter any information
  just changes title pages*). **One cause under all of it: a page of the story
  belonged to no record**, so a press on one fell through to whatever did own
  something — the part whose pages it sat among, or the chapter in force — and
  a picture asked for on page nine landed on chapter two's leaf, which
  paginates differently, which is the *pages disappear*. **`bookPageRows` gives
  every page a row** saying in two words what stands on it (*Chapter opens*,
  *Text*, *Picture*, *Blank*) with its chapter, its part and its figure; it is
  `pagePlace` said for every sheet at once, so nothing is stored and a chapter
  that grows a page grows a row with nothing run, and the rail folds a chapter
  open to show them (which chapter is open is about this minute and is
  remembered nowhere). **Choosing a page shows the page's own screen, which
  does pictures and nothing else** — what is on it, the two ways to put a
  picture there, and `FigureSection`'s place/side/width where there is one,
  reached from the page at last, saying *Nothing here changes the chapter or
  the book — only this page*. The double-click rule is now **what the page
  *is***: a part's page opens the part, the page a chapter opens on opens that
  chapter's page, and an ordinary page of the story is neither and goes in hand. And **how a division is numbered** (Numbers, Roman numerals,
  Letters, Words, a symbol, none) — a setting since the markers were built,
  reachable only by opening a marker on the **timeline** — is now in *Book
  settings ▸ openings*, beside the type those headings are set in, because it
  applies to every division and §9's rule puts what applies to the whole book
  where the whole book is set.
  **§9i is putting a page in, and the leaves that print nothing**, from Ken
  in three goes. It opens with a straight fault: §6's chapters inside a story
  are sections and the story's marker sits on the first, so `bookRows` sliced
  that row off — true of the **section** and false of the **chapter whose
  numeral is on it**, which is why a book of three numerals showed two and
  began at *II.* §9h's fold is now on **every division** rather than on a
  chapter, since a collection's numerals are sections, joined to their pages
  by the `unitId` §9b already put on the block. Then the drag: **an art page
  is a part and a part has nowhere to be between page six and page seven**,
  which is the whole of *it goes to the bottom* — a picture that is a page of
  its own is a **figure**, standing where it stands in the writing, so a drop
  on a page row is `plateIntoStory` (the figure made before the element the
  page opens with, the part removed: one picture in one place) and a figure
  already in the writing only moves, as `moveFigureBefore` has since the box
  could be redrawn. **Both halves of Ken's arithmetic were already true and
  neither was visible**: `layPages` counts every leaf unconditionally and only
  `shows` consults the folio, so a picture page has always been page seven
  printing nothing. What was missing is the leaf **behind** it —
  `bookBackBlank` on the element, the same shape as every other `book…`
  attribute the manuscript carries and never reads, putting a `blank` block
  after the picture's: `display` so it takes a page, `folio` off so it prints
  none, counted because counting is what the cutter does to everything. 44,
  45, 46, 47 with numbers on 44 and 47 alone. **The answer goes with the
  page** — `placeBookFigure` clears it when the picture stops being one, a
  cut-in picture having no back leaf and an invisible setting being the worse
  surprise. **A blank page the writer puts in is the same mechanism pointed
  the other way** (`bookBlankBefore`, a `blank` block *before* the element),
  so the words slide with nothing written to make them, and it is said of the
  **writing** rather than of a page — a page not being a record, so it moves
  when the writing moves and goes when the paragraph goes. The block carries
  `blankFor`, which is what lets the page's own screen offer to take it back:
  **a leaf the cutter left is not the writer's to remove there**, and a button
  that can only refuse is one that lies. Three blank pages, three reasons, and
  the screen says which — *you put it here*, *the back of the picture before
  it*, or *the page before a chapter that opens on a right-hand page* — with a
  button under the first alone.
  **§9j is the pages by their numbers, and the first chapter of a story**,
  from Ken using §9h and §9i on his own collection. **The first chapter had
  no opening**, from two one-liners each standing on a reason that had
  stopped being true. The **importer ate the numeral**: `materialiseScenes`
  drops a prose document's first heading because *the first heading is its
  title*, which is right for a document headed *In For A Pound* and wrong for
  one headed `I.` — a story called *I.* is not a story anybody named, it is
  the first chapter of one named by the file on disk, so `BARE_LABEL` decides
  and a bare numeral is kept like every other heading. And **the plan gave it
  no page**: `atSectionHead` was `chapters && !placed`, reading *the story's
  opening is this section's opening*, where they are two pages — the story's
  carries its title, the section's its numeral — so chapter one was the only
  chapter in the book that did not open. **Every page by its number**: three
  faults at once, and only the first visible. The number was **muted small
  grey out at the right margin**, so it leads the row now in a fixed column,
  a picture and a blank saying so in its place; a section's numeral **read
  *Text*** because a chapter inside a story opens with a heading rather than
  a `chapter_opening`; and **the unit in force ran past its own writing**, so
  the next story's opening and the blank leaf before the back matter were
  credited to the section before them — a new division ends the last one's
  run, and a division now lists the pages **no row under it lists**, where
  before every page of a story appeared twice. **A double-click opens any
  page**: §9h gave every kind of page an owner but not every kind a dialog,
  so an ordinary page of the story only went in hand, which on the screen is
  indistinguishable from nothing happening — and the dialog **holds nothing
  of its own**, rendering the same sections the inspector does, two copies
  being two answers to *what can I do to this page*. Which dialog opens is
  decided by **what is on the page** rather than by the chapter in force,
  since a chapter inside a story has no marker of its own and asking the
  chapter in force sent a writer who double-clicked the numeral to the
  *story's* page. **The back of a leaf is its other side** (Ken: *leaving a
  blank page just makes the next page blank, it's not the back of the page*),
  so a picture asked to leave its back blank takes a **recto** and the blank
  after it really is behind it — which is his own earlier arithmetic; *Which
  page* went with it, having asked a question the gesture had already
  answered. And **Delete** takes a picture out, from its panel or the key,
  the file staying in the library.
  **§9k is the three areas and the copyright page**, from Ken. **§9a took two
  headings out and this puts three back**, which only looks like a reversal:
  what §9a removed were rows carrying buttons and a sentence that said nothing
  about where anything was, and what a label says is the one thing no row
  can — **which part of the book you are in**, which is the fact the roman
  numerals in the margin exist to carry. They are **read and stored
  nowhere** (`halfOf` has decided a part's half since §5, `BookRow.half`
  carries it), so a part that changes half changes area with nothing run,
  which is Ken's *automatically populate*; the story is labelled too, two
  named halves around an unnamed middle reading as though the middle were
  left over. **A drop on an area asks for that half** and `partToHalf` mostly
  answers **no** — a copyright page is front matter *by being a copyright
  page*, so it is refused in a sentence rather than moved somewhere a book
  would print wrongly, and the one kind that really moves is an **art page**,
  which is what `inFront` exists for. The **copyright page** was the one page
  in the front matter whose content was a **block of free text**, where every
  other is either a reading or one thing said once; it is a dozen facts in a
  settled order, and typing them means knowing a convention the program
  knows. `copyright-page.ts` holds three decisions. **The fields are the page
  and a field with nothing in it prints nothing** (no blank *ISBN:* line, no
  separator left behind), with a **number per format** because a paperback
  and an eBook are different books to a retailer. **The number line is worked
  out and there is nowhere to type it** — a writer says which printing this
  is and the line drops a digit for each one after, typing it by hand being
  how a second printing claims to be the first, the same argument as the
  chapter number and the page number before it. And **an untouched page is
  untouched**: the record is null until the dialog is opened, so a book made
  before this prints exactly what it printed, `partStyleOf`'s rule (§7a)
  pointed at content rather than type — and starting carries the old words
  into *Anything else*. `copyrightLines` is the **one reading**, asked by the
  print, the spread and the dialog's own list. The **barcode** is a picture
  from the library at the bottom right, a *box for* a barcode rather than one
  the program draws, because a retail barcode encodes the **price** as well
  as the number and the book does not know it; **absent rather than boxed**
  with no picture, an empty rectangle being something that would print.
  **§9l is a row being a page, and the chapter that still would not open**,
  from Ken looking at §9j on his own book. §9j fixed the **importer** so a
  bare numeral is kept, and his book was imported before that — its first
  section has no heading element at all, and the rule that opens a chapter
  reads the manuscript, so it had nothing to act on. **One chapter opening
  differently from every other is a fault whichever way it was arrived at**,
  so the section's own title stands in: the same words the rail shows and the
  contents page lists. Two refusals — it does not **repair the manuscript**
  (writing a heading back into the words to fix a page is the one thing this
  room may never do) and it **invents nothing**, a section left unnamed
  opening its page and printing no heading as before. Then three faults in
  the rail, the first hiding the other two. **The number was the folio**: an
  illustration and a blank leaf are counted like every page and merely print
  none (§9i), so the two kinds of page a writer most needs to point at had no
  number at all — `counted` is the page's number printed or not, the reading
  the rail wanted and `folio` was never going to be. **And the row said what
  stands on it instead of which page it is** — *Text* is not the name of a
  page, it is what a page of a book contains — so a row reads **Page 4**,
  with what stands on it after the number only where that is anything but
  plain text, and *illustration* is Ken's word and the domain's now. **A
  picture was listed after the last chapter**, a figure carrying its story's
  marker and the story being the marker for every section in it, so a picture
  on page four stood below chapter thirteen; a figure carries its **section**
  too now. And the page dialog gains **the way through to whatever sets it** —
  the chapter's own page where the page carries a marker, *Book settings ▸
  openings* where it is a chapter inside a story, which §6 made a section
  deliberately and which has no page of its own: a **route rather than a
  second copy**, two screens disagreeing about how a chapter opens being the
  fault §6a, §7a and §9c each found in turn.
  **§9m is every page under its chapter, and a panel that says less**, from
  Ken after §9l and reported twice: *chapter one is still wrong, where it only
  has page two… chapter three has only one page and it really has four pages…
  and so every page is accounted for*. **The fold matched ids, and matching
  loses pages** — the rail lists a section only where it has a title (§6),
  so a story imported as a unit per paragraph has one titled unit carrying the
  numeral and untitled ones after it, whose pages matched no section row and
  fell back to the *story*; the numeral then folded open on the one page its
  heading stood on. It is why two chapters were right and two were not, which
  depends on how the writing happens to land in units and is not a fact about
  the book. So a division's pages are **a range rather than a set**:
  `pagesUnder` in `book-rail.ts` gives each laid page to the nearest division
  row at or before it — `divisionSpan`'s rule pointed at pages — so every page
  is under exactly one row **by construction** rather than by every unit
  happening to be listed. Three things went with it. **The instructional prose
  is a floating help box** (*all this extra text that's instructional can be a
  pop-up box, like a floating help box*): true and in the way, so it is behind
  a **?** that floats, nothing under it moving when it opens, anchored to the
  **section** rather than to its mark because a panel is the width there is —
  the first draft hung a 260px box off a mark at the panel's right edge, in the
  heading's own tracked capitals, and it ran off the left one. **Done is gone**
  (*when you hit done, nothing happens — you have to use the X on top*): it did
  nothing the × did not, and the line describing the picture went with it, the
  heading being the picture's own name now. And **how openings look is on the
  page rather than behind a door** (*set how openings look just gives you the
  book settings, and we need the graphic dialogue buttons included in this
  menu*) — §9l's *route rather than a second copy* was right about the copy and
  wrong about the door, since sending a writer to Book settings took away the
  picture controls they were standing beside; `ChapterStyleFields` is one
  component, so rendering it here is the same fields rather than a second
  answer. **The box is editable and a picture goes in from the box** (*it
  should be an editable box… draggable corners that maintain its squareness…
  there's nothing that allows you to actually put a graphic in the box area, it
  just says picture goes here*): the box being placed wears its size in inches
  and as a share of the measure — read off the **laid page** rather than off
  the drag — four corner grips and a **＋** beside the ✗ and the ✓. Only the
  **width** is dragged and the height follows from the picture's proportions,
  which is what keeps the box square-cornered and the picture unsquashed, and
  is why there is no *fill the box*: the box is never a shape the picture fails
  to fill.
  **§14 is the chapter opening layout**, from Ken's own *Chapter Opening
  Layout* handoff (a spec, a JSON of presets and an approved mockup): where the
  graphic goes, how the number is shown, how far down the page the chapter
  starts, how the first line is treated, with a live preview. **The audit paid
  a sixteenth time** — four of the handoff's six settings fields were already
  stored under other names (`numberStyle` is `markerNumbering`, which has
  offered all four of its options and three more since the markers were built;
  `sink` is `dropInches`; `graphicSize` is `graphicWidth`; `graphic` is
  `assetId`) and **five of its eight layouts are the four `CHAPTER_TEMPLATES`
  plus no graphic at all** — so what is new is the layout as one named thing,
  three arrangements nobody could draw, and the drop cap. Three decisions. **A
  layout is data and the renderer reads the data**: `CHAPTER_LAYOUTS` is a list
  of **slots** and the print walks it, so there is no `if (layout === 'mid')`
  in the print, the preview or the thumbnails — the handoff's *adding a layout
  needs only a new entry* kept by construction. **`layout` is the answer and
  `template` is its older spelling**: an existing book stores only where its
  graphic goes, so `layoutOf` reads that back (nothing is migrated, no book
  moves) and setting a layout **clears** the template rather than leaving two
  fields to disagree — `manuscript`/`serif`'s shape when the face list widened.
  **The named steps are read back, never stored**: Shallow/Standard/Deep are
  inches on the page, one button lights where the number matches, and a typed
  depth lights none rather than the nearest — `bookPresetOf`'s rule, and the
  same for S/M/L over `graphicWidth`. What the slot walk had to keep: the
  number, the rule and the title stay **one piece** inside `.bk-chapter-head`
  (what carries the book's optional rule), so the four older layouts emit byte
  for byte what they did and the suite passed with no print assertion edited —
  the proof the older spelling is unchanged. **Every layout carries the
  epigraph slot**, not only the epigraph one, an epigraph being something the
  writer typed on *that chapter* and a layout that dropped it losing their
  words for a reason nobody asked for; `epi` changes how it is set, never
  whether. A **page of art** stays apart from a **bleeding header** (a band
  with the heading under it is not a picture that *is* the page, which the book
  has drawn since `full_page`), so nine layouts rather than eight. The **first
  line** is the mechanism already being there a fifteenth time: `opensChapter`
  has been on the paragraph block since the book was first laid out, so a drop
  cap is a rendering of a paragraph the plan already marks and nothing new is
  stored; `firstLineCut` is the one rule the print and the preview both take,
  it cuts at a character rather than re-marking the text (a chapter opening on
  an italic phrase keeps it), the cap takes an opening quotation mark with it,
  and it is the **book's** and never a chapter's. `ChapterLayoutDialog.tsx` is
  the screen — **Chapter openings…** on the Layout bar and from a page's own
  panel — nine thumbnails from the same slot lists, the page beside them, in
  the app's **tokens** rather than the handoff's fixed hexes, because a screen
  painted in literal colours is the one screen that does not follow the
  writer's colour scheme. The preview shows the chapter's **own first words**
  under the opening (without them the sheet is a heading in space and the
  first-line control shows nothing), and a chapter opening on a leaf says the
  words are overleaf rather than drawing a page that does not exist. Changes
  apply as they are made (§12a's *a look is tuned against the sheet beside
  it*); *Every opening* is the one act that reaches work somebody did, so
  `describeApplyToAll` says how many chapters set on their own would go and the
  press asks inline. `ChapterLeaf` reads the slot list too, having kept a
  private template ladder that knew three arrangements and could not draw a
  fourth. Driving the real room caught the fault no test could: a bare
  `display: flex` on the dialog **beats the browser's own `display: none` for a
  closed `<dialog>`**, so it lay over the room and swallowed every click on the
  bar behind it; it is on `[open]` now.
  **§15 is the copyright page's elements**, from Ken's *Copyright Page dialog*
  handoff, the companion to §14's: each element its own box, switched on or
  off, edited and reordered, from one of four standard orders, with the page
  beside it. **The audit paid a seventeenth time** — ten of the twelve
  elements were already fields on §9k's record (the two that were not,
  permissions and the Library of Congress number, had been going into
  *Anything else*), and its alignment and type size are the part's own
  `LineStyle` — so what was missing is not the content but **the sequence**:
  `copyrightLines` walked a hard-coded run of `say(…)` calls and a writer who
  wanted the notice above the disclaimer could not have it. Three decisions.
  **An element turned off is not an element left empty** — they look alike on
  the page and mean different things (*I have no LCCN* against *I have one and
  this book does not print it*), so `hidden` is its own field and switching
  something off **keeps its words**, the graveyard's
  `archived`-is-not-`deletedAt` argument pointed at a page. **Which preset is
  in force is read back, never stored**: `presetOf` compares the order, the
  hidden set, the position and the alignment against the four and answers null
  for anything else, so moving one element reads *Custom* — `bookPresetOf`'s
  rule, which the handoff asks for by name. And **two of its controls are
  settings that already exist**, so the alignment and the type size write
  `partStyleOf` rather than a second pair of fields, with the section saying
  so. An empty `order` means the order this page has always printed in, so a
  book made before this is unchanged. Three things moved: the block may sit at
  the **top** or the **middle** as well as the foot (§7a hung it at the foot
  and nowhere else, which was right about the default and wrong to be the only
  answer); the **number line rides with the edition**, where a book prints it
  and what the handoff's element is called; and **a notice with nobody in it is
  owed**, since it prints either way — *Copyright © 2026* — which is why the
  footer must say it is unfinished rather than read as ready.
  `CopyrightPageDialog.tsx` wears §14's chrome (the same `chl-*` head, foot,
  sections and pills, `cr-*` only for what is this page's own), and a row's
  summary says what is there and what is missing **as such**, a `[HOLDER]`
  invented on the row being a placeholder the counter at the foot cannot see;
  an ISBN with a wrong check digit is marked and explained under the row while
  an **empty** one is not marked at all, being a number the writer has not got
  yet rather than a mistake.
  `addendum-21-word-import.md` is **Word import**, from Ken's *import a Word
  document and maintain the formatting, along with the font type and size*.
  **Built.** §1 is the audit: the script importer already had both halves
  (Final Draft's hand-written XML reader and the PDF's laid-out-line
  classifier), the research importer said in its own comment that it left a
  `.docx` to be reported as skipped, and the manuscript element had carried
  `attributes` since 0001 — so no migration. Two decisions carry it. **The
  host unzips and the domain reads** (§2): `unzip.ts` reads the central
  directory and inflates with the platform's `DecompressionStream`,
  `read-docx.ts` hands over the parts, and `import-docx.ts` decides what every
  paragraph is where it can be tested with a string; `xml-walk.ts` is the tag
  reader split out of `import-fdx.ts` and shared. **A script by its geometry,
  a book by its headings** (§4): a Word screenplay is laid out as the lines a
  PDF gives — a paragraph's indent is where its line starts, a centred one
  stands in the cue band — and goes through the same `readLaidOutLines`, so
  screenplay classification was not written twice; a book divides at its
  headings (`CHAPTER_HEAD` in `importing.ts`, shared with the builder's
  `chapterName` so the two agree about what *Chapter One: The Road* is called),
  and a chapter heading becomes a **story marker** rather than a slugline,
  with the number derived. Only a `.docx` is offered the book formats, and
  choosing one **reads the document again** rather than converting a script.
  **Formatting is kept as data and honoured where asked** (§3): `face`, `size`
  and `align` ride in the element's `attributes`, the manuscript print is
  untouched (a screenplay from Word still prints Courier on letter), and *As
  imported* is a face in the Script's gear (`IMPORTED_FACE`) and among
  `BOOK_FACES` in Layout, where `blockStyle` in `print-book.ts` sets each
  block in its own face with the size snapped to whole lines of the leading;
  alignment is kept under every face because it is about the words. Pictures
  become assets and figures. Driving it in Chromium found the found panel
  listing chapter headings as *places* and a picture drawn as a red warning;
  §8 says what is deliberately not read (tables as cells, no footnotes or
  tracked changes, a mid-sentence face change read as the paragraph's).
  **§10 is dividing what came in**, from Ken importing a short story and
  finding chapters in strange places and a page break at every paragraph:
  the manuscript carried a **typed page number at the foot of every page**
  and the bare-numeral rule made a chapter of each. `pageNumberParagraphs`
  drops integers that count up by one within a page's worth of words (900)
  of each other, three or more in a row — a chapter's worth of words
  between is what tells *1, 2, 3* the chapters from *1, 2, 3* the pages;
  `BARE_LABEL` (a numeral, roman numeral or number word alone on a line,
  centred or not) opens a chapter with an **empty title**, the number being
  derived; and `beatsFrom` makes **a beat of every paragraph** (Ken's
  second, plainer ask, replacing the 700-word passages: a paragraph is the
  unit a scene is split at and a beat dragged), a heading opening the beat
  after it and a scene break ending the one before, each titled with its
  opening words. And the
  tool: **Chapter** and **Passage** on the manuscript bar — press one, click
  where it starts, click where it ends, and it is cut and the tool puts
  itself down. `dividing.ts` builds `carveUnit`/`carveBeat` from two
  primitives, split-before and merge-in, so nothing about the words can
  change, and the tests read the manuscript back in order after every cut.
  `addendum-22-collections.md` is **Short stories and collections**, from
  Ken's ask for a collection of stories laid out as a book. **Built.** §1 is
  the audit and it paid a **tenth** time: a short-story project's unit was
  already a Section and its marker already the chapter-kind marker that
  carries a page, drives the contents and opens a chapter in Layout — so the
  whole of *a book full of stories divided into chapters* was standing, and
  what was missing was the **reading** and the two ways in. **A story is a
  marker over its sections** (§2): `isCollection` in `formats.ts`,
  `collection.ts` (`storiesOf`, `beginStory`, `appendImportedStory`), and
  nothing new stored, since a second record kept in step with the marker
  would be a second answer about where a story ends. Two words changed in
  `markers.ts`: `markerNoun` takes the format and a story is called
  **nothing** before its number (a numbered collection prints *3*, never
  *Story 3*), and a collection's default numbering is **none**, so the page
  carries the title once — which needed the empty label a marker with
  neither noun nor number now has, rather than borrowing its title. **The
  import asks what a document is** (§2), on this format alone: *one story*
  (the default — headings divide it into sections, the first names it, the
  rest stay headings in the words) or *a collection* (a story per heading),
  because Ken imported one story and got three; `appendImportedStory` reads
  the same way and no longer drops later headings. **The stories are down
  the right** (§3, `StoryRail.tsx`, *Window ▸ Stories*), the episode rail's
  shape with a story per row — one click goes to it, two open its own page,
  *+ New story* at the foot. *+ Story*
  on the bar starts a story **on a section of its own at the end** (§3), a
  story not being a division of its neighbour. *File ▸ Add stories to the
  collection…* (§4, `AddStoriesDialog.tsx`) takes several files, **one story
  each**, and a document's headings divide its story into sections and
  **never make stories** — the builder's per-heading markers are left out on
  purpose. `materialiseScenes` in `import-build.ts` is the one builder both
  importers call. **§4a is a series, or a collection, a file at a time**,
  from Ken wanting the program usable as a layout tool by an editor with a
  drawer of manuscripts: *Import a script…* takes several files, the first
  makes the project and on a series or a collection each after it is the
  next episode or story on a page of its own, **listed in the order they
  will go in** with arrows to change it; on any other format the rest are
  *said* to be left out rather than dropped. *Add episodes to the series…*
  is the collection's dialog reading its words off the format, and
  `appendImportedEpisode` in `series-import.ts` is `appendImportedStory`
  for a series — one episode marker whose title page **claims its number**,
  with `ensureFirstEpisode` giving a series built from its first script the
  episode it did not have, or the second would be *Episode 1*. The page
  between the parts is the marker's own page, so nothing new is drawn. The
  file readers are `read-import.ts`, shared by both dialogs. The Layout room needed no change (§5). The format is
  offered as *Short stories and collections* and the noun table calls the
  work a *Collection*.
  **§6 is chapters inside a story**, from Ken using it: *divide short stories
  into chapters at the Roman numerals*. Two things were wrong and only one
  was a design question. **Plain text was not being read at all**: the Word
  reader has divided at a chapter heading and a bare numeral since addendum
  21 §10, but a `.txt` went through a three-line splitter in the renderer
  that had never heard of either, so the story arrived as **one undivided
  block** with the numerals sitting in it as prose — a straight bug, and most
  of what he saw. `textToProse` in `packages/domain/src/import-text.ts` reads
  plain text the way `docxToProse` reads a document, and `CHAPTER_HEAD`,
  `BARE_LABEL` and `pageNumberParagraphs` moved into `importing.ts` so **both
  readers ask one rule**. Plain text carries no styles, so a line opens a
  division only by **what it says** and by standing alone — a story's title
  line stays prose, because nothing says otherwise and the file name has
  already named the story. Then the design: §2 says a story **is** a
  chapter-kind marker, so a chapter *within* one cannot be another — that is
  the *one story became three* mistake §2 exists to stop. It is the
  **section**, which has been the second level all along, and **nothing new
  is stored**: what makes a section read as a chapter is *where it falls*,
  its heading opening a new page. One branch in `bookBlocks`, and three
  readings follow without being told — the contents page lists it under its
  story (`bookContentsOf` for Layout, `contentsOf` for the print, **neither
  asking the format**: they ask the block, and *a heading that opens a page
  of its own is a division*, true by construction, so a novel's running
  headings stay out without either reading knowing what a novel is), the
  Layout rail sits it under its story at depth 1 and not draggable (moving a
  chapter inside a story is moving the writing, which is the Outliner's), and
  the × takes the break off with the words running on. Two print decisions: a
  chapter inside a story starts a **new page and never a forced recto** — the
  *story* keeps the book's recto rule, but a chapter doing the same leaves a
  blank verso between every numeral, which in a ten-page story is most of the
  paper — and the numeral **opens the way any chapter opens**, `.bk-opening`
  itself rather than a style beside it: the same drop down the page, the same
  centring, the number in the type the book sets for a chapter number. The
  first draft gave it a private style with a third of the drop and Ken asked
  for more space above; the fix was **deleting the style**, not enlarging a
  number in it, because *how far down the page does a chapter begin* is one
  question and two answers to it drift. A collection numbers nothing, so on the contents
  page the heading stands where a **title** stands rather than out in the
  number's column, which is where the first draft drew it and where it hung
  outside the text block.
  **§6a is the story titles as a setting**, from Ken: *the story titles
  should be adjustable with a setting*. They already were — the face, the
  sizes, the case, the weight and the tracking of a division's heading have
  lived in `settings.chapterPageStyle` since addendum 02 §12a — but Layout's
  *Book settings ▸ Story openings* held a **sentence** saying so and pointing
  at *File ▸ Chapter page…*, and a sentence pointing at another dialog is not
  a setting. `ChapterStyleFields` is that dialog's own section lifted into a
  component and rendered in both places, one component because two copies are
  two answers to *what does a heading look like*; §9's own rule decided it —
  what applies to the whole book belongs where the whole book is set. Naming
  the fold caught the rest: `LayoutWindow` and the chapter-page dialog each
  held a private `isCollection(format) ? 'Story' : 'Chapter'`, and five more
  places in Book settings said *chapter* outright (*a chapter's first
  paragraph*, *the chapter's title*, *a chapter opening shows its number*,
  *every chapter opens on a right-hand page*, the sentence under the running
  heads), every one of them wrong on a collection. `FormatNouns` now carries
  **`division` / `divisionPlural`** — Chapter, Story, Episode, Act — and they
  all read it; it is deliberately **not** `unit`, a collection's unit being a
  Section and its division a Story, which is the distinction §2 rests on, and
  a `series` entry joined at the same time because `defaultMarkerKind` has
  said *episode* since addendum 05 and the table had no word for it. The test
  walks the whole Book settings dialog on a collection and asserts *chapter*
  appears nowhere. One thing kept its own wording rather than reading the
  table: the *Modern* preset said *chapters on either page*, and a preset
  describes **type** rather than a format's vocabulary, so it says
  *openings* — true of every format, and no format-specific prose in the
  domain.
  **§7 is removing a story**, from Ken (*I added a story by accident… maybe a
  little X in the box when you hover over it… when you hit the X, it asks
  you, are you sure?*): the Layout rail grew a × for this complaint already,
  and the **Stories rail in the workspace** — where somebody who has just done
  it is actually standing — had not. `removeDivision` and `divisionRemoval` in
  `outline-binding.ts` are **one act and one sentence** beside `divisionSpan`,
  which already owns what a division covers, and `removeBookRow` /
  `whatGoesWithRow` call them rather than keeping a second copy — which also
  took out a private *story or chapter?* that `FormatNouns.division` exists to
  answer and §6a had missed. **Removing a story is not deleting the writing**:
  where nothing is written in it the story and its empty sections go (the
  accident, and a **reading** — a word in it changes the answer with nothing
  run), and where there are words only the break goes. Unifying the two rails
  found a **sentence that was not true** — removing the *first* story promised
  its sections would *join the one before*, and there is nothing before the
  first; the words survived either way, so the bug was the promise, and the
  Layout rail had been saying it too, one fix serving both. The × is **in the
  box, hidden until hover or focus** (hidden rather than absent, so the
  keyboard reaches it) and **asks inline** with that sentence beside it.
  **§8 is several stories at once**, from Ken in three messages about one
  import (*I imported three stories and… only two of them show up*; *it seems
  to have merged two stories that were imported at the same time… naming it
  with the second*; *it did all the chapter pages correct, but it didn't name
  them, it just gave them page numbers*). **One control was asked of the first
  document and applied to it alone**: §2's *one story or many* is a real
  question about a single file and the fieldset said so in its own legend —
  *what the **first** document is* — so with several files chosen the first
  was read by a rule the rest never saw, and the two halves of one import
  disagreed. Read as a **collection**, a document divided at numerals makes a
  story per numeral; a numeral is a bare label, `chapterName` reads one as
  **naming nothing** (the number is derived, addendum 02 §12a) and a
  collection **numbers nothing**, so `placedMarkers` gives it no label
  either — a run of stories with nothing on them, and where the first scene
  carried no heading, **no marker at all**. Every file after it went through
  `appendImportedStory`, which reads a document as **one** story and names it.
  And **a section no story claims is one nothing lists**: `storiesOf` reads
  the markers, so both rails skip it while the book draws its pages under the
  division that follows (addendum 20 §9w) — his *it imported the first story
  inside the second*, the first story present, editable, and named nowhere.
  Three things. **A bare numeral never begins a story**: `materialiseScenes`
  grows a third reading, `headings: 'stories'`, where a named heading begins
  one and a numeral stays a heading in the words exactly as `sections` keeps
  one, so not a word is lost and §6 goes on drawing it as a chapter of the
  story; `storyHeadings` is the one reading of which headings would begin
  one, so the screen offering *a collection* counts what the import would
  **make** rather than every heading. **A collection's first story begins at
  its first section** — the words in front of the first named heading are that
  story's opening rather than a story of their own, so the marker is pulled
  back rather than the words left outside every story, and a reading that
  found none makes the whole document one; it lives in `buildProjectFromImport`
  where a collection's markers are made rather than in a repair a caller must
  remember, `ensureFirstStory` having been written as `ensureFirstEpisode`'s
  twin and **deleted**, the builder already placing the marker in the
  one-story case and a second thing answering *which sections is this story*
  being a second answer. And **the question is put only where there is one**:
  several documents answer it (each file is a story, so the fieldset is absent
  and the first is read exactly as the rest), a document with no named heading
  answers it too (**absent with the reason in its place**, a second answer
  that produces the same thing — or nothing — being no choice), and a document
  with named headings is asked with the headings **named** rather than only
  counted. **Several at once is kept rather than withdrawn**: Ken offered *we
  shouldn't allow the stories to be imported together* and §4a built it for an
  editor with a drawer of manuscripts — the fault was never the togetherness,
  it was the first file being read by a control the others could not see. Two
  assertions waited on the fieldset over a document that has nothing to divide
  at and were **updated rather than worked around**. Driven on his own
  sequence: the Layout rail and the Stories rail both read *The Harbour · In
  For A Pound · Falling*, with no section outside a story.
  **§9 is a full blank sheet between stories**, from Ken in one sentence
  (*between stories, there needs to be a full blank sheet*), and **measuring
  it first is what made the report legible**: his book already had a blank
  page in that place, so the complaint only parses once you see that the gap
  and the separation **fall in exactly the same place and mean opposite
  things**. That page is the verso the recto rule leaves — *the back of the
  page the last story is printed on* — so a reader turning it has turned over
  the last leaf of what they were reading rather than been told anything
  ended. **A sheet is two pages** (addendum 20 §9ad) and that is what makes
  this a default rather than an option somebody has to find: an even number
  cannot change which side anything falls on, so measured over three stories
  every opening is the same opening, further on by the sheets in front of it
  and by nothing else, with the side of the paper identical — two pages a gap
  and the only figure that varies is the recto gap that was already there. It
  stands **in front of everything the next story brings with it** (its plates,
  the pictures facing its opening, the leaves the writer asked for), what it
  separates being the works; on a **collection and a series alone**
  (`holdsWholeWorks`, §2's reason — a chapter is a division *of* a novel and a
  reader turning from four to five has not finished anything); and it
  **defaults on**, which is the one place an existing book is laid differently
  from the day before, because he asked for it as a requirement and a
  separation a reader is meant to feel is not something to be switched on by
  whoever finds the control. Being neither the writer's leaf nor the cutter's
  it is a **third kind of blank**, so `BlankReason` gains `'between'`, **said
  by the block rather than inferred from the neighbours** for `blankBack`'s
  own reason (addendum 20 §9w): a reading that guessed could not tell it from
  the recto gap, which is the one it most needs telling from. And the × on it
  had to go somewhere honest — §9x's rule is that no page row is without one,
  and the obvious target, the book's setting, is **a control acting on
  something nobody is looking at**, a press on page ten taking the sheet from
  between every story at once; so `sheetBefore` is nullable on the work's own
  chapter page, **null meaning the book's**, which is `opensRecto`'s shape
  exactly — the control standing beside it in the same fold and the same kind
  of decision — and the × writes it for **this** story, saying so before the
  press. A picture asked for on it is **refused** for the back of a picture's
  reason (it exists in order to have nothing on it) with the refusal naming
  the × one press away rather than a setting in another dialog. The tick is
  under *Every story opens on a right-hand page*, those two being the whole of
  what a reader meets at a division, **absent rather than greyed** off a
  format with no whole works, and its note says the thing the tick cannot:
  the first story gets none. `sayBlankReason`'s new voice takes the format's
  own plural from the room, with a default of *works* that is **true of every
  format that can reach the reason** rather than the likelier of two. Driven
  at 1440×900 on his three documents: *The Harbour* ends on page 4, a verso,
  so pages 5–6 are one leaf blank on both sides and *In For A Pound* still
  opens on 7; *In For A Pound* ends on page 9, a recto, so leaf 11–12 is the
  sheet, page 10 is the back of page 9, and *Falling* still opens on 13, with
  a working × on every blank page. One assertion — *a book nobody has asked
  anything of is laid exactly as it was* — pinned a rule this changes on
  purpose and was **rewritten rather than worked around**.
  **§9a is which side of the leaf a picture page falls on**, from Ken inside a
  longer report (*at the end of the story, I tried to add a picture on the
  back of a page. But when I added the picture, it only would add it on the
  right-hand side of the page. I wanted the picture to be on page 66*), whose
  screenshot is the fault in one row — **Page 66 Blank · Page 67 Illustration ·
  Page 68 Blank**. **The cause is one line**: `leafToItself` — *the writer
  asked for a blank back* — beat the side **outright** in `elementBlock`, so
  ticking that switch moved the picture to the next right-hand page, **a
  control about what is behind a page deciding which page it is** with nothing
  saying so; and §9j had taken the *Which page* control out, for the good
  reason that it asked a question the gesture had already answered, so after it
  there was **no way to ask for a left-hand page at all** and the tick was the
  only thing left that could move a picture between sides. **§9j was right
  about *which page* and wrong about *which side***, those being two questions
  — where the picture stands in the writing is what the press already said, and
  which side of the paper that page is is a thing only the writer can want — so
  the control returns as *Side of the leaf* (**Wherever it falls · A left-hand
  page · A right-hand page**) and the back-blank switch becomes the **default
  rather than the override**: where no side is asked for a picture leaving its
  back blank still takes a recto, which is why no book moves and why the whole
  suite passed unedited. **And the back goes where the back is** — a leaf is a
  recto and the verso behind it, so the other side of a picture on a left-hand
  page is the page **in front** of it, §9j's own rule (Ken's correction, *the
  back of a leaf is the other side of that sheet*) read in the direction it was
  never read in; `backLeafSide` says which, the blank takes a **recto** when it
  goes in front so the two really are one sheet rather than landing a page out,
  and the sentence under the switch names the page in front rather than
  claiming a right-hand page whatever is set. Two readings had to learn to look
  **both ways**, each written when a back could only follow: `blankReason`,
  which called a verso picture's own back *the page in front of it is set to
  leave its back blank* — a different leaf's reason entirely — and
  `pageRemoval`, whose × then reached nothing. Two assertions pinned §9j's
  removal and were **rewritten rather than worked around**. **Named rather than
  built**, from the same message: **dragging a page up and down to renumber
  it** — a page of the story's words is where the cutter broke and cannot move,
  what is on it being the continuation of a paragraph, while a page that
  carries a **record** can (a picture page has dragged since §9w, and a blank
  leaf the writer put in could), which is the honest half and its own piece of
  work.
  **§7a is the episode rail**, from Ken, and the rail was the easy half:
  wiring it found that an episode marker's kind is `episode` and
  **`chapterSpan` read `chapter` outright**, so an episode spanned to the end
  of the series and removing one would have taken every scene after it. The
  name had already stretched — a collection's *stories* are chapter-kind, so
  `collection.ts` called `chapterSpan` for a story and carried a comment
  explaining why — so it is **`divisionSpan`** now, ending at the next marker
  **of the marker's own kind**: identical for every caller that existed (all
  of them chapter-kind) and correct for the one that was not.
  `addendum-23-ebook-export.md` is **eBook export**, from Ken's own *eBook
  Export Engine* dev spec: one EPUB 3.3 from the laid-out book, with store
  presets for Kindle, Apple, NOOK, Kobo, Google Play, Draft2Digital and
  IngramSpark. **Phases 1 to 4 built**; §8 says what is not (EPUBCheck
  in-app, footnotes, fonts, media overlays, retailer APIs, any conformance
  claim). §1 is the audit and it
  paid an **eleventh** time: the spec's *intermediate representation* is
  `bookBlocks` (addendum 20 §5), so `ebook.ts` is a **second reader of the
  same blocks** — a file per part and per chapter (per story in a
  collection), semantic XHTML by construction (escaped, void tags closed,
  a scene break one separator paragraph and never empty ones), and the
  desktop test parses every file as XML to prove it. **Nothing about a page
  survives** and the log says so — no folio, running head, blank verso,
  trim or face. **The stores are rules, not renderers** (§3,
  `ebook-presets.ts`): limits and switches read by the preflight and
  nothing else, so a retailer moving a number is a line to edit. Metadata
  lives in `settings.book.ebook` (no migration) and falls back to what the
  project knows — title page, imprint, synopsis, key art as cover — so a
  second export says the same as the first. `zip-write.ts` is the reader's
  other half, the `mimetype` first and stored, deflate by
  `CompressionStream` through a `ReadableStream` (a test runner's `Blob`
  does not stream; the desktop's `unzip.ts` inflates the same way for the
  same reason), and `platform.d.ts` declares the few globals the domain
  leans on without pulling the DOM library in. `ebook-preflight.ts` asks
  what a store's checker asks first and **says it cannot run EPUBCheck**
  rather than pretending. *Export as eBook…* is in the Layout bar; the
  dialog is the preflight, errors hold the button, and `saveExport` on the
  bridge makes a *Title - eBook Export* folder holding the EPUB, the cover
  beside it, `export-report.html` and `metadata.json`. **Phase 3** (§9) is
  the *Preview* tab — `ebook-preview.ts` shows the package's **own files**
  at the size of a Kindle, a Kobo, a phone or a tablet, the stylesheet
  inlined and the pictures put back, a reflowable section set in columns
  the width of the screen and turned one at a time, which is what a reading
  system does and not what any one does exactly, said at the foot —
  `packagedCheck`, Ken's *preflight again after packaging*, which reads the
  central directory back (mimetype first, stored and exact; every file once;
  lengths and checksums as written) and inflates nothing; the HTML report;
  Kindle Previewer opened where `main/kindle-previewer.ts` finds it
  installed, absent in the browser; and `ebook-corpus.test.ts`, whose books
  all pass **EPUBCheck 5.2.1 with 0/0**. **Phase 4** (§10, §11) is the
  **fixed-layout book**, `ebook-fixed.ts`, a **third reader — of the pages**
  rather than the blocks: one XHTML per laid page at the trim from the same
  `renderBookPage` the screen draws, sides on the spine, the room's own
  stylesheet, offered only once the room has laid the pages, its two limits
  said rather than hidden (faces not embedded, so lines may fall differently
  within a page; a book of text is warned against in Ken's words, and each
  store's stance is a `fixedLayout` rule). `ebook.ts` was split for it:
  `imageBank`, `coverOf`, `accessibilityMeta` and `finishPackage` serve
  both. And **every accessibility claim is read off the package** —
  `alternativeText` only when no picture still owes a description, a
  picture owing one unless the writer typed it (`altText`, editable from
  the dialog's *Pictures* list) or marked the **figure** decorative
  (`markFigureDecorative`, on the element, since one picture can be an
  ornament here and a figure there); no conformance claim, because a
  certification is not a reading. The browser preview's *Export the book…*
  goes through the browser's print dialog, the only road to a file there,
  and Ken's screenshot showed what that costs when a printer rather than
  *Save as PDF* is chosen — Letter paper, a date and `about:blank` stamped
  by the browser, nothing saying what the thing was — so the print window
  now carries a screen-only banner naming the document and what to choose,
  and its tab is the file name.
  `addendum-24-graveyard.md` is **the graveyard**, from Ken: *anything that
  gets removed or deleted, instead of deleting it permanently, it goes to the
  graveyard, just in case you accidentally delete something, you can restore
  it*. **Built**, scoped to **Research's own records** — the seven a writer
  meets as a row in a list with a delete, and the ones with no other safety
  net. §1 is the decision it rests on, and the audit set it up: **six of the
  seven already carry `archived`**, so reusing it would have been the shortest
  change in the file and would have been wrong — **archived is a writer saying
  they are done with something, the graveyard is a writer saying they did not
  mean that**. Two intentions, so two fields; one field would put a
  deliberately archived setup beside an accidentally deleted note and make
  *Restore* mean two things on one list. It is addendum 09 §2's trap read from
  the other end: **a state is not a mistake**. §2 is the mechanism: deleting
  stamps `deletedAt` and **nothing leaves its collection**, which is what makes
  restoring a promise the module can keep — every usage link, story link and
  tag still points at an id that still exists, so putting something back is
  *clearing a field* rather than reassembling a record and everything that
  referred to it. It follows that **a delete must stop cutting what hangs off
  the record**: `removeThread` took its nodes and arrows and `removeCharacter`
  took its links, and a thread restored without its moments is an empty name —
  so those are `destroyThread`/`destroyCharacter` now and **only the graveyard
  calls them**. The cost is that every list must not show the buried, so
  **`living` is the one predicate** and each module's own reading applies it
  (`castByCategory`, `locationsInOrder`, `themesInOrder`, `motifsInOrder`,
  `threadsInOrder`, `setupsBoard`, the four research readings) — a missed
  filter is then a failing test rather than a deleted note still on the shelf.
  §3: **the graveyard is a reading**, newest first, stored nowhere — the sixth
  time a fact about the work is a reading rather than a column. §4 is the
  screen, last in the research menu under the folders, and **the two acts that
  destroy are the two that ask**; nothing ages out on a timer. §5 is what is
  deliberately absent: the manuscript (a scene has snapshots) and a story or
  chapter break (removing one deletes nothing, so there is nothing to bury).
  Notes and setups
  had no delete when it shipped and one was not invented unasked; Ken then
  asked, so **§5a** is `deleteResearchItem` and `deleteSetupPayoff` — the first
  delete either has ever had, which is the right order, a shelf with only
  *archive* on it being the safer screen while there was nowhere for a mistake
  to land. **Delete stands beside Archive rather than replacing it**, §1
  arriving in the interface, and each asks once saying **where the record is
  going** rather than warning. **§5b is a fault in the first version**, found
  building §5a: `emptyGraveyard` and `forgetOne` filtered the collections and
  nothing else, so emptying left a story link pointing at a character who no
  longer existed. Burying keeps all of that on purpose; **destroying has to
  take it**, so `withoutWhatPointedAt` is written **once and generically** (a
  story link that refers to it, a usage link it owns, a theme–motif link that
  names it — none of it varies by kind), which is also why it lives in
  `graveyard.ts` and imports nothing: a per-module destroyer would have to be
  reached from here, and those modules already import this one.
  **§5c is characters and locations**, from Ken — and half of it was already
  standing, which is worth saying rather than rebuilding: **a location has had
  a delete with its own ask since the module was built**, and it has gone to
  the graveyard since §2. The character gap was not where it looked. The
  delete **existed and asked nothing** (`CastPanel`'s × removed somebody on one
  click), which was survivable while the answer was *gone* and is worse now,
  because a control that silently does something reversible teaches a writer to
  distrust the one that does not. And it was **in the wrong place**: the cast
  panel is inside the Characters folder while the side menu's *Character
  Creator* section is where a writer meets the cast, so the × is on the menu
  row too, in the folders' own shape, with the question under the row because
  the menu is too narrow to put a sentence beside one. The sentence itself is
  now **the graveyard's** — five screens had written *it goes to the graveyard*
  for themselves, which is five answers waiting to disagree, so
  `describeDeleting` is the one copy and both facts in it are the module's:
  nothing here is destroyed, and **nothing here is manuscript** (deleting a
  character leaves every cue, deleting a location leaves every heading), which
  is what a writer most needs to hear and what no screen should promise on its
  own. `hangingOn` is the same reading `withoutWhatPointedAt` applies, so what
  the sentence says is carried can only be what restoring gives back; a screen
  may still put **its own** fact in front of it, as the locations panel does
  with how many scenes name the place. Driving the real room caught two things
  1656 tests did not: the cast row is a four-column grid, so the question was
  laid out five words to the line in a 120px cell, and **deleting somebody
  while their Creator was open left the room pointed at them** — nothing lit in
  the menu, a nameless folder in the middle — so the selection falls back to
  where the writer came from and the Creator's lookup asks `living`.
  **§5d is themes and motifs**, from Ken — and there was one, *Delete this
  theme* in the detail, so the ask is really about **where a delete lives**.
  The answer his last four asks have converged on is **on the row of the thing
  it deletes**, hidden until the row is pointed at, asking inline; the old
  control in the detail is **gone rather than kept beside it**, two controls
  for one act on one screen being two answers to *how do I get rid of this*.
  Locations moved the same way in the same change, being the last list with
  its delete in a detail pane. `.item-row`/`.item-x` are the shape and
  `.row-ask` the question under a narrow row, one rule for the side menu and
  the lists alike. **Driving it caught the thing worth more than the
  feature**: deleting a theme *left it on the list*, because `ThemesPanel` read
  `file.themes` rather than `themesInOrder` and a buried record keeps its place
  in the collection (§2). Five more readings had the same hole
  (`motifsOfTheme`, `themesOfMotif`, `thematicWorkIn`, `describeThematics`,
  `thematicTracks`) plus the tagging menu and the research menu's count — so a
  deleted theme was on the list, on the timeline, under its motif, in the count
  and in the menu a writer tags from. The lesson is that **applying the
  predicate in a module's main reading is not applying it in the module**. The
  cast had it worse, their delete being an hour old: six places wrote
  `!person.archived` for themselves, which was the whole answer while a delete
  really deleted, so `workingCast` — *not deleted and not put away* — is now
  the one reading the map, the arc track, the voices, the cross-arc offers, a
  Sculptor card's cast and the colour order ask. What pins it is a test that
  walks **every** reading rather than the list the delete came off.
  **§5e is plots and threads**, from Ken, and both had a delete that was wrong
  in a different way. **A thread's was a fold away and its sentence had stopped
  being true** — *N moments go with it. The writing stays*, which was right
  when written and became a lie the day burying started **keeping** the moments
  so restoring could give the thread back whole; it is on the row now, saying
  `describeDeleting`, which is the one-sentence argument made concrete: a
  screen that writes its own copy goes on saying it long after the module has
  changed its mind. **A plot's asked nothing and cut the writing** — the × on
  the timeline's track head removed the track *and every scene and beat on it*
  on one click with the whole warning in a `title`, the most destructive
  control in the product behaving like the least, while Research ▸ Plots (where
  somebody who made a plot by accident looks) had none at all. **A track is not
  a graveyard record and will not become one**: burying a plot would have to
  bury its scenes, and the manuscript is deliberately out of there — so
  `packages/domain/src/tracks.ts` keeps the room's promise another way, **the
  plot goes and the writing stays**. `dissolveTrack` moves its scenes to
  another track at the story positions they already hold (a scene's position is
  the project's, not the track's) and is the offer made first; cutting a
  subplot whole is still there as the *second* button, saying how many scenes
  it takes. `trackRemoval` is the one reading both screens ask, so the timeline
  and the Research list cannot promise different things, and the last track is
  **refused with a sentence** with no × at all, a button that can only refuse
  being one that lies.
  **§5f is setups and payoffs**, from Ken — and there was one, §5a's, *beside
  Archive in the detail*, where he did not find it. It is on the row now, and
  the thing worth keeping is the **pattern in four asks running**: each time
  the answer was *it exists, in the wrong place*, so **where a writer looks for
  a delete is the row of the thing, not the pane that describes it**. §5a was
  right about which control it should stand beside and wrong that the pair
  should be anywhere together — Archive and Delete are **not** a pair, putting
  a resolved payoff away being a decision about the work and deleting the
  record a decision about the record, which is §1's own distinction. So
  Archive stays in the detail and the × goes on the row: not a compromise, two
  acts landing where each belongs.
  **§5g is notes and folders**, from Ken, and they are two different answers.
  A **note's** delete was §5a's, in the detail beside *Put away*; it is on the
  **card** now, the × in its corner, because somebody wanting rid of a note is
  looking at the note. A **folder is a shelf, not work**: it has had a delete
  all along and `removeResearchCategory` has always moved everything up to
  where the folder was, so deleting one **takes nothing away** — §5e's plot
  rule a second time — which is why a folder is **not** a graveyard kind and
  will not become one, there being nothing to restore. What was missing was
  **saying so before the press**: the whole explanation lived in a `title`
  attribute (*what is in it moves up*), the answer to *what happened to my
  notes* given where nobody reads it. `folderRemoval` is that sentence — what
  moves, how much and which shelf it lands on — and it says the two refusals
  the act already threw. Driving the screen caught the sentence disagreeing
  with itself (*1 note move to Ideas*). **This is where the pattern stops
  paying**: every Research record now deletes the same way, so the next ask of
  this shape should find the control already in the right place.
  **§5h is locations again**, from Ken, and §5g's promise half held: the × has
  been on the location's row since §5d and works — it was simply not **where a
  location is made**. **The scene's own dialog is the one screen that can put a
  place in the library** (addendum 14 §5, so that a writer is not sent to
  Research to name a house) and it could not take one out, so a name typed
  wrong while writing meant a trip to another room to undo — §5f's fault from
  the other end. The × is on the picker now, and three of the module's own
  rules give it its shape: **it never touches the heading** (a location fills a
  heading in and never owns one, so the sentence says *This scene's heading
  keeps the name* **first**, ahead of the graveyard's), **there is nothing to
  un-choose** (which place a scene uses is read from its heading, so the picker
  needs no *none* and a buried record just stops matching), and it is **absent
  where the scene names no prepared place**. Two things came out of building it
  that no test could see. The research menu's Locations count read
  `file.locations` and filtered `archived` itself — the last surface in the
  room doing its own counting — so a **deleted place went on being counted**
  there after leaving every list: §5d's lesson one surface late, a count being
  a reading. And the picker was the fourth child of a **three-column grid**, so
  it fell into a 110px cell and laid the question out three words to the line —
  the cast row's fault (§5c) in another grid; it spans the row now, which is
  also truer, the library not being one of the three fields of a heading.
  **§5i is characters again**, from Ken, and §5c's delete works — driving the
  room, MARA leaves the menu when the × is pressed. **She did not leave the
  program**: six renderer surfaces still listed her — Read Back's voices, the
  Related Elements picker, the character map's *Focus on*, the review's
  filters, the manuscript right-click's cast and the Relationships tab's
  *other person* — every one of them writing `!person.archived` for itself.
  **This is §5d's lesson a third time, and the third time is the one worth
  writing down**: §5d fixed six *domain* readings with `workingCast` and §5h
  fixed one *count*, and neither looked at the renderer, where the same six
  words had been typed six more times. So the rule is not *apply the predicate
  in the module* — too narrow — but **a component may not decide who is in the
  cast**: a screen that writes its own filter over `file.characters` holds a
  second answer and goes on giving it after the module has changed its mind.
  Two counts went with it for §5h's reason (Setups & payoffs counted the
  buried in the research menu and in its own *Active (N)* tab, both filtering
  the collection instead of asking `setupsBoard`), and the Related picker was
  offering deleted **notes and setups** too — three private filters in one
  list, now `onlyLiving` and `workingCast`, because linking to a buried record
  makes a link the graveyard then has to carry.
  `cast-surfaces.test.tsx` renders **every** component that lists a person and
  asserts a deleted one is off it; the domain had such a test since §5d and the
  renderer had none, which is why six surfaces could be wrong with the suite
  green.
  **§5j is setups and payoffs again**, from Ken, and §5f's × on the row works —
  driving the room, the record goes and the menu count falls. **The promise
  stayed everywhere else**: a deleted setup went on drawing its arc across the
  timeline, counting among what the project owes on the home page, riding into
  the next episode's *Still owed* note and showing in the scene that carried
  it — four readings, every one writing `!record.archived` for itself, which is
  §5i's fault in the next module a day later. `workingSetups` is
  `workingCast`'s twin, and the rule is now stated for everything rather than
  for components: **no reading decides for itself which records exist** — a
  module owns one function that says what it has (`workingCast`,
  `workingSetups`, `locationsInOrder`, `themesInOrder`) and everything else,
  in the domain or on a screen, asks it. One reading is deliberately
  **`onlyLiving` rather than `workingSetups`**: `unresolvedSetupsPayoffs`,
  which answers *what does this project still owe*, where an archived but
  unresolved record has always counted — §1's distinction, and the thing that
  stops this becoming a blanket filter applied without thinking.
  `setups-surfaces.test.ts` is `cast-surfaces`' domain twin, and each
  assertion checks the record **was** there before the delete, so a reading
  that never showed anything cannot pass by accident.
  **§5k is research notes again**, from Ken, and §5g's × on the card works —
  the card goes and the question is the graveyard's. **And the folder still
  said two**: `researchTree`'s counts down the side menu, `ideasIn` (the room's
  brainstorming boxes) and `themeThreads` (the theme rows on the timeline) each
  wrote `!item.archived` for themselves. The count is the one that matters
  most, being **the number beside the shelf the writer just deleted from** —
  the reply to the press, an inch away from it, saying nothing happened.
  `workingNotes` is the third of these after `workingCast` and
  `workingSetups`, and together they are what §5j's rule asks for: a module
  owns one function that says which records it has, and every reading asks it.
  The shape is now boringly the same each time, which is the point — a fourth
  module with this fault should take ten minutes and a fifth should not exist.
  `notes-surfaces.test.ts` walks all four readings.
  **§5l is locations again**, from Ken, and the sweep found **nothing** — the
  first time in four modules, every locations surface already asking
  `locationsInOrder`, which is what `workingCast`/`workingSetups`/`workingNotes`
  were for. What it found instead is the **opposite** fault and a worse one:
  `placesWithoutRecords` — *a place named in the script that has no record*,
  offered so a writer can adopt headings already typed — built its known names
  from the **living**, so deleting MILLER HOUSE while a heading still said
  `INT. MILLER HOUSE - DAY` offered *Make a record*, and pressing it made a
  **second** MILLER HOUSE beside the buried one; restore the first and there
  are two of one name with `locationOfScene` picking whichever sorts first. So
  the rule has an edge worth stating: **a reading over the writer's records
  asks the module's one function; a reading over the *manuscript* asks the
  whole collection** — the names come off headings, which a delete never
  touches, so *is this already recorded* must count the buried, or the delete
  becomes a way to duplicate a record and break §2's promise. What that stops
  offering is **said rather than dropped**: `buriedPlacesInScript` is its own
  list, *Deleted, but still in the script*, where the act is **Restore** rather
  than *Make a record*, there being a record with its descriptions, defaults
  and notes still on it.
  **§5m is themes and motifs again**, from Ken, and the sweep found **nothing**
  a second time running — everything asks `themesInOrder`/`motifsInOrder`. What
  it found is **§5l's fault in a module where the name is free text**, and
  worse for it: both screens that make one of these take a **typed name** (the
  manuscript's *Tag a theme or a motif…* and the panel's box), and neither
  could see that *Grief* was in the graveyard, so typing it again made a
  **second** Grief with its own occurrence list — where locations at least had
  a heading tying the two together, here nothing would ever reconcile them.
  `buriedThematicNamed` is the reading both screens ask, the act is **Restore**
  said before the press (*Put it back* on the button), case and space are
  ignored because a writer retyping from memory is not promising to match
  capitals, and the **kind is not**, two kinds all the way down meaning a motif
  called Grief is not this theme. It also found **a sentence that had stopped
  being true in a comment**: `removeTheme`'s doc said *take a theme away, and
  its occurrences with it*, right while a delete destroyed and false the day
  burying started keeping them — §5e's thread sentence one layer down, a
  comment writing its own copy of the rule as readily as a screen and saying it
  just as long.
  **§5n is plots and threads again**, from Ken, and §5e built both — the plot's
  × on the track head and in Research asking in `trackRemoval`'s words with
  `dissolveTrack` offered first, the thread's × on its row. **The plots half
  has nothing further to answer**: a track is not a graveyard kind and will not
  become one, so there is no buried track for a reading to miss and no name a
  writer can retype into a rival. The threads sweep was the third clean module
  running — except **one count**, in the place the last three asks teach you to
  look first: the research menu's Links entry wrote `!one.archived` for itself,
  so a deleted thread went on being counted an inch from the × that deleted it.
  §5h's locations count and §5k's folder counts a third time, and the pattern
  is that the fault keeps landing on a **count** rather than a list — a list is
  somebody's reading and a count looks like arithmetic, so it is the thing a
  component feels entitled to do for itself. The rest is **§5m's duplicate by
  typed name with the worse consequence**: a theme's rival starts empty beside
  an empty one, a thread's starts empty beside one holding **the whole
  history**, because §2 keeps a buried thread's moments so restoring gives it
  back whole — so the writer who retypes *The key* gets a thread that does not
  know where the key was ever seen, and restoring the first leaves two of one
  name with every moment on the wrong one. The decision worth keeping is
  **where the check goes**: §5m had to put it in both components because each
  called `addTheme` directly, while threads have one act that means *use this
  thread, or make one by this name* — so `buriedThreadNamed` is checked
  **inside `captureToThread`** and no caller can forget it, the panel's own
  form (which does not go through it) saying the same words with *Put it back*
  on the button. The general shape: **where a single domain act means "this one
  or a new one by this name", the check belongs in the act; only where the
  screens each build the record themselves does it belong on the screens.**
  Deliberately left alone: `resolveRef` looks a thread up **by id over the
  whole collection**, as it does a character, a note and a setup, because that
  is not a listing of what the writer has but the display of a link that still
  exists pointing at a record that still exists — *Missing element* there would
  be the one thing the graveyard promises is untrue.
  **§5o is characters a third time, and it closes the module.** §5c built the
  delete, §5i swept the six renderer surfaces that *listed* a person, and this
  found the half neither looked at: the readings that start at the
  **manuscript** and arrive at a person. `peopleSpeakingIn`, `scriptPresence`
  and `castForNewEpisode` each walk the cues, ask `charactersCalled`, then
  write `!person.archived` for themselves — so a deleted character went on
  speaking in her beat, standing in the review and riding into the next
  episode's cast while being off every list in the program. The fix is one
  reading rather than three filters, and its shape is **§5l's edge, which turns
  out to be about this module more than about locations**: *is this cue
  somebody the project knows* is a question about the **script**, so
  `charactersCalled` reads the **whole collection** and must (`notedCast` would
  otherwise file a second MARA beside the buried one — the delete becoming a
  duplicate again); *who is speaking here* is a question about the **cast**, so
  `castCalled` is that one narrowed to the working cast. The pair sit beside
  each other in `characters.ts` with the distinction written between them,
  which is the only way it survives the next reader.
  A **fourth** turned up only by driving the real room with 2100 tests green:
  `castNeverSpoken` — *in the cast, not yet speaking* — filtered the collection
  itself, so the Character review drew a deleted MARA under that heading a
  second after she left the menu beside it; the plainest case of the lot and
  the easiest to miss, because the word *cast* is in its name and it still went
  to `file.characters`. `cast-script-surfaces.test.ts` walks all six — the four
  that must lose her and the two that must keep her, each asserting she **was**
  there first.
  **The graveyard is done**: every deletable record has a delete on its own
  row, every reading over the writer's records asks its module's one function,
  every reading over the manuscript asks the whole collection, and both halves
  are pinned by a surfaces test per module.
  `addendum-25-character-creator-revision.md` is **the Character Creator
  revised**, from Ken's handoff package (a spec, five mockups and a second dev
  spec). It is a revision of a **built** module — addendum 08 and all fourteen
  of its stages — and §1 is the audit, which paid a **twenty-first** time and
  harder than usual: **the handoff's own headline decision had already been
  made here independently**, its seven tabs having been four since addendum 08
  stage 2 for the same reasons. Seventeen more of its asks are standing under
  another name. **All twelve stages of §4 are built**; §4a says what each
  does. Four decisions carry it. **The arc's shape is said *and* read** —
  addendum 08 §5 made it a reading and the handoff asks for a toggle, and both
  are right about different moments (an arc with no points has no shape to
  read, a finished arc's shape is a fact about its points), so the toggle
  stores an **intention**, `arcShape` goes on reading, and **where they
  disagree the screen says so**, which is addendum 13's `movementOf` pointed
  at an arc. **`origin` is taken, so a moment is `found`** — `origin` has
  meant *who made it, in a room* since addendum 07 stage 4 and addendum 16 §2
  had to separate `source` from it for the same reason; `found` is a fact
  about provenance and **never a status**, a planned moment and a found one
  being used or on deck by the same rule. **A colour is read, never stored**,
  so the handoff's `avatarColor` is not built and `castColours` came out of
  `story-threads.ts` as the one place the avatars, the timeline and the
  threads all ask. And **nothing here stores a status**, which is addendum 08
  §2 arriving on a summary: a bar written down would go on saying *7 used*
  after the scene was cut. Stage 1 is the record (`role` as six chips plus
  free text, `background` behind a fold, the writer's own fields as a **list
  rather than a map** because the id is what makes a rename an edit; migration
  0053). Stage 2 is `character-glance.ts` — *At a glance* and *Up next*, both
  readings, the latter **naming the trait rather than counting across all of
  them** and **offering rather than warning**, its two buttons **routes to the
  Character review's own modes** rather than reports of their own. Stage 3 is
  the filter bar, whose **figures are the whole character's whichever tab is
  pressed** (a bar whose own figures changed as it was pressed would be
  unreadable) and under which a trait with nothing left **drops out**; plus
  red counts on every trait row, `found`, and **`conflictsWith` said once and
  read both ways** — storing the pair on both traits would be two records of
  one fact, free to disagree the moment one is edited (migration 0054). Stage
  4 is the **Story panel**, the scenes down the right of the Traits tab as
  somewhere to put a moment, and it stores nothing: who is in a scene is read
  off the cues (`castCalled`'s rule, so MARABEL's lines are not MARA's) and
  what is pinned where off the usage links, so a cue lights a row with nothing
  run. A scene they are not in is **dimmed and never dropped** and says *not
  in scene*; **the division is carried forward** from the nearest marker at or
  before, `divisionSpan`'s rule pointed at a list, because a marker sits on
  the scene a chapter opens on and reading it per unit left every other scene
  in the chapter blank — the very question the column answers. A drop lands on
  the scene's **first beat** and a scene with no beats **takes no drop**, a
  link with nowhere to anchor being one that would be broken the moment it was
  made; only what is waiting is draggable; and it is `carry-work.ts` and
  `pinUsage` unchanged, **a third way in and not a third answer**. Stage 5 is
  `character-arc-graph.ts` — the shape toggle, the chapter ruler, the connected
  arc and the key — where §2's decision arrives: the toggle stores an
  **intention** (migration 0055, nullable because *not said* is a third state),
  `arcShape` goes on reading, nothing consults the intention to decide the
  shape, and `describeArcDisagreement` is **said only where they part** and
  **states both and picks neither**, either being possibly the one that is
  wrong. The graph is readings all the way down: the ruler is the **divisions
  where there are any and the scenes where there are none** (a script with no
  acts still has a spine), a mark stands where its scene stands, its division
  is **carried forward** from the nearest marker at or before (`divisionSpan`
  a second time in this addendum — asking per unit blanked every point after
  the chapter's first scene), and how high it stands is **addendum 13 §1 one
  module over**: a setback goes down because *setback* means down, the word is
  the record and the height exists so there is something to draw, with no
  number shown, asked for or typeable, **one mark making no claim** and *on
  deck* **not a position of zero**. The joined arcs are read from the links and
  drawn as **level lines rather than second curves**, two curves inviting a
  comparison of heights each normalised against its own arc; *Open their arc*
  is **absent rather than greyed** and opens them **on the Arc tab**, a button
  that landed on their Overview being a route that does not do what it says.
  Stage 6 is **relationships**: there was one free-text `evolution` and the
  handoff asks for what that paragraph is trying to say, a sequence of states
  each anchored to a scene. **The paragraph stays as the older spelling** —
  where there are steps they show, where there are none it stands, and taking
  the last step away brings it back, which is `template`/`layout`'s rule
  pointed at content rather than type. **A step is anchored to the scene and
  never to a chapter number** (migration 0056, JSON in the row by a location's
  prepared descriptions' precedent), so the chapter is read from where the
  scene falls — `divisionSpan` a **third** time in this addendum — and there
  is nowhere to type *Ch 7*; **a step with no scene is planned rather than
  placed** and is listed after what is, `arcBoard`'s split for its own reason.
  And **the map is the map**: `CharacterMap` itself rendered beside the list
  with an `initialFocus`, rather than a second drawing, so the two cannot
  disagree about who is joined to whom — an **opening state rather than a
  fixed one**, and pressing a person there opens them **plainly** on whatever
  tab they were last left on, where stage 5's *Open their arc* names a tab
  because its label does (`onOpenCharacter` takes the tab, so the act decides
  rather than the route). Driving it caught the placement fault: `.charmap` is
  `flex: 1` with its canvas `min-height: 0`, right in a room of its own and a
  thousand pixels tall in ordinary flow.
  Stage 7 is the **margin mark** and **search across the cast**.
  `passage-marks.ts` is the mark, and the decision is that **the ask is the
  Character Creator's and the reading deliberately is not**: a mark that showed
  characterization alone would stand beside a paragraph carrying a theme, an
  index heading and a promise saying nothing about any of them — a mark that
  lies about what it means. `usage_links` has been the polymorphic anchor since
  this module was built and four modules since have widened it, so **one
  reading answers for all of them** and a module built next month is marked the
  day it anchors to an element; the book index is one more reader rather than a
  second answer. **Nothing is stored** (cutting the passage takes the mark), **a
  beat-wide pin is not marked** (no `elementId` means *somewhere in this
  scene*, and marking the first paragraph would invent a position), and **every
  mark is named rather than counted**, the point of a margin being to tell
  without going anywhere. The search half is **the audit paying again**:
  `reviewRows` with no `characterId` has searched the whole cast since addendum
  08 stage 10, while the research box — *Search titles, notes and tags* — meant
  it, so *coal tongs* found nothing though it is a moment under a trait; this
  is a **second reader of one reading**, absent rather than empty and capped at
  twelve. Driving it caught the placement: the right gutter was tried first and
  **measuring killed it**, the side column ending at 425px with the mark
  landing at 421, under the divider.
  Stage 8 is the **vocabulary** and the header. The handoff's own decision —
  *a moment in the interface, a `CharacterizationItem` in the data*, the word
  a writer uses and the word the schema uses answering different questions —
  so the tab is *Traits & Moments*, the button *+ Moment*, the manuscript's
  right-click *Make this a character moment…* and the readings *3 moments for
  “Miserly” are still on deck*, with nothing in the data moved. What makes it
  worth a **test** rather than a rename is addendum 16 §6c's lesson, so
  `creator-vocabulary.test.tsx` walks the whole rendered screen on every tab,
  **attributes included**, and asserts the older words are nowhere on it.
  Writing it found the restyle's one real fault: **the tabs were a `nav` of
  buttons carrying `aria-current="page"`**, which announces *the current page*
  about something that is not one — a `role="tablist"` now, §4a's switch
  argument. The header gained **the avatar the handoff draws**, its colour
  `castColours` (read, never stored) and its initials a reading, a **ring
  rather than a disc** because a filled circle in somebody's colour competes
  with the name beside it. And the **one-column card stack was weighed and
  refused**: the shelf holds four controls per trait the card cannot, and what
  the mockup is *for* — the red counts always in front of you — is on every
  row already.
  **Stage 9 (§4b) is that refusal overruled by Ken the same day, and the
  correction is the part worth keeping**: it was **an argument about where the
  controls go, dressed up as an argument about the layout**. *What layout does
  the screen have* and *where does a trait's settings live* are two questions,
  and the handoff had already answered the second — it draws a **⋯** on every
  card head, for exactly those four — so the controls were never the price of
  the layout. Every trait is a card now, one under the next, with its moments
  inside it, which is the thing the shelf could not do at all: **every trait's
  red count and every trait's moments on the screen at once**, where before
  they were a column of numbers you pressed one at a time to read behind.
  Three rules: **a card is open by default and folding is about this minute**
  (nothing stored, addendum 20 §9h's rail), **a head's counts are the whole
  trait's** whatever the filter bar shows (`filterBoard`'s rule about the bar
  pointed one level down — a card reading *1 on deck* because the bar says *On
  deck* tells you what you just asked for), and **the unfiled pile is absent
  where there is nothing unfiled**, its only route being the Overview's *File
  them*, which appears only when there is something in it. `Shelf` survives
  with a changed meaning and the rename is the point: it was *which trait is
  showing*, and in a stack every trait is, so it is a **destination** — the
  route opens that card and brings it into view, then lets go, or a card
  routed to could not be folded again. Driving it caught three things 727
  green tests could not: the `found while writing` badge is `nowrap` and the
  words were `min-width: 0`, so at 1280 a row read as **a badge about a moment
  standing where the moment should be** (it wraps under the words now); *why
  it matters* was a full-width box, one on the shelf and nine down a stack, so
  it is a line of italic prose that draws its box when typed in; and
  **`.empty-state` is 48px of padding and a centred sentence** — right filling
  a column, absurd nine deep, nine untouched traits drawing a page and a half
  of *Nothing shows this yet.* The sentence is **gone rather than shrunk**,
  the head's `—` already saying it and the placeholder doing the rest, which
  now reads *what shows it* rather than *another*, there being no other one
  yet. `creator-stack.test.tsx` pins the shape and not the styling, ending on
  the thing the overrule was about: **all four of the shelf's controls are
  still reachable behind the ⋯**.
  **Stage 10 (§4c) is what the record is called, and the left-hand list**,
  from Ken in one message. Two of the five renames were about more than a
  label. **Character type** was *How much of the story*, which **describes the
  question and never names the answer** — the control has always written
  `categoryId`, the heading `castByCategory` groups the research menu by, so
  picking one filed somebody under a heading on the left and nothing said so:
  the audit paying a **twenty-second** time, the mechanism built and general
  and merely narrow in vocabulary. Ken's three are what a new project seeds,
  **singular**, because one of them is what a person *is* rather than a shelf
  they are on (*Main character* is a sentence about somebody; *Main
  characters* is a label on a drawer), with *Extra* the trade's word for what
  was *Background*. **An existing project keeps its own headings**, which is
  `defaultCharacterCategories`' own rule rather than an oversight — they are
  the writer's, and a heading appearing in a finished script because the
  software changed its mind would be the software rearranging somebody's cast
  — so they are renamed by hand in the cast panel. Renaming them found the
  fault: **the four names were written down twice**, the importer's
  `headingFor` holding its own copy (deliberately naming what it wants, so
  arithmetic on how many headings there are cannot refile a tier), so the
  rename left it asking for headings that no longer existed and quietly
  filing everybody under the last one; `CHARACTER_TYPES` is the one list now.
  A test helper made it worse and is fixed too — `cast` filed under `null`
  when it could not find its heading, so three episode tests failed as
  **mysteriously empty casts** rather than as a fixture saying what was wrong
  with it: **a fixture that cannot find what it was asked for throws**. The
  other four are labels — **Character description** (the fold that was
  *Background & look*, and the `look` field in it), **Backstory** (`history`),
  **Links** (`tags`, which nothing moved in the data) — with two neighbours
  named rather than quietly left: *Links* is also the research menu's word for
  story threads, and *Character description* now sits under the *Who they are*
  prose box. **The left-hand list is the one already there**: the research
  menu has grouped the cast since §8b and could not say so, the heading being
  drawn only where there was more than one group, so a cast filed entirely as
  main characters said nothing about being one; a **second** list inside the
  Creator was weighed and not built, standing an inch from the first being the
  fault addendum 20 §9u had just removed from Layout. Driving it caught this
  stage's own: the first draft headed every real type and not *Not filed*,
  and **a group with no heading takes the one above it**, so an untyped Victor
  Marsh sat under BACKGROUND CHARACTERS reading as one — it is all of the
  headings or none. And the rail is headed **Characterizations**, Ken's word
  and the one place §8's sweep to *moment* is deliberately not applied: the
  tab is about a **trait** and the moments under it, while the rail is
  everything that characterizes somebody — those moments, the arc, the notes —
  and no one of them is a moment; the vocabulary test strips the rail and
  holds everywhere else.
  **Stage 11 (§4d) is the cast that would not appear**, from Ken's bug report
  (*the characters that are in the script are not recognized… and I added two
  new characters and neither of them show up*). **The second half reproduced
  and is one line**: *+ New character* asked with `window.prompt`, and
  **Electron does not implement one** — it writes *prompt() is and will not be
  supported.* to a console no writer sees and returns nothing — so on the
  desktop build the button did nothing at all, silently, every time. It
  survived because it works perfectly in the browser preview, which is where
  it was driven. The rule it breaks is the room's own: **an act asks for what
  it needs where it stands**, the way a folder, a trait, a story and an order
  are named; the row *is* the act until pressed, Escape and an empty blur put
  it away, Enter makes them and opens them. The copyright page's *Save as
  preset…* had the same fault and went in the same change — **there is no
  `window.prompt` left in the program**, and the test throws if anything
  reaches for one, which is the only way it cannot come back. **The first half
  did not reproduce**: driven through the real readers a Final Draft script
  and a PDF at ordinary screenplay geometry both give up their cast and file
  it, and the probe that said otherwise was **a fixture written in inches
  where the reader wants points** — worth recording, since it nearly became a
  bug report about working code. So the answer is the one that holds whatever
  went wrong: **the script still says who speaks**. `cuesWithoutCharacter` has
  answered *which names speak and have no record* since addendum 08 stage 13
  and `notedCast` has filed them for longer; what was missing was anywhere to
  press, so *+ Add 3 names from the script* stands under the cast, **absent
  the moment there is nobody left to add**. One thing in the report is named
  rather than fixed: the cast is under **Character Creator** while **Folders ▸
  Characters** is a research shelf that will always read 0 for a cast, and two
  things called Characters in one menu is a fair complaint that renaming
  either would reach further than this fix should.
  **Stage 12 (§4e) is the arc as a line you fill in**, from Ken (*that is
  going to be like a timeline view… where the character begins as a box you
  could fill out, and by default the end of the character arc… then you can
  double click on the line and it will create another point… and you can also
  click into that box and add a link*). **The audit paid a twenty-third time,
  inside the record itself**: `beginning` and `ending` have been fields on
  `characterArcSchema` since the Arc Builder was built and the moments between
  are `arcPoints` in their order, so none of it is new data — what was wrong is
  that the tab drew it as **two loose textareas with the whole spine stacked
  between them**, the same information arranged so nobody could see it was a
  journey. **The line between two boxes is the act**: `addArcPoint` appends,
  which is right for a form at the foot of a list and useless for a gesture
  meaning *here*, so `insertArcPoint` takes an index and the key is worked out
  between the neighbours; a gap is a real button as well as a double-click
  target, the only way the keyboard reaches a gesture described with a mouse.
  **Driving it settled the design question and the first answer was wrong** —
  ordered `arcBoard`'s way (everything written first, then what is on deck),
  double-clicking between the first two boxes put the moment **at the far
  end**, because a moment nobody has written sorts after every one that is,
  and *a gesture that means here and lands somewhere else is a gesture that
  does not work*. So this is the one place the module keeps two orders on one
  screen, deliberately: **the line is the writer's arrangement and the lists
  below are the manuscript's**, *what is the shape of this journey* and *how
  far along is it* being two questions; each stop still carries the board's
  colour and the scene it is pinned in, so the manuscript's answer travels
  with a stop rather than deciding where it stands. **A link hangs on a moment
  and never on a state** — *who they are at the start* is a condition rather
  than an event, so the two ends carry no link control and **say why** — and
  what a moment joins to is the script, a theme or a motif, which needed
  **`theme` and `motif` to join `storyEntityTypeSchema`**, the fifth time that
  list has been the whole answer after `arc_point` and `thread_node`: no table,
  no migration, no second kind of link, and **two entries never one** (addendum
  12 §2). A link to something cut keeps its row struck through. Stage 5's graph
  is **kept and moved below the line**, the order being the argument for both:
  the writer arranges the journey on the line and the graph reads the result
  back.
  **Stage 13 (§4f) is the arc line before there is an arc**, from Ken sending
  §4e's ask again **word for word** — which in this project has meant one thing
  four times (§15c, §16b, §16c, §4d) and meant it again. Driving the room named
  it: for a character with **no arc record** the tab drew a sentence and a
  *Start an arc* button and `.arc-stop` returned `[]`, so there was no line at
  all — and since **every character starts without an arc**, that was not an
  edge case but the only state most writers ever meet the tab in, which from
  Ken's chair is indistinguishable from the feature never having been built.
  **No arc yet is not no line**: `arcTimeline` returns the two ends whether or
  not there is a record, because a character with no arc still begins somewhere
  and still becomes something. **Nothing is created to draw it** — `beginArc`
  has been idempotent since the Arc Builder, so it doubles as *ensure* and runs
  at the first **act** (typing into *Begins*, or putting a moment in) rather
  than at the first look, and a cast of forty extras still carries no arc rows;
  that is how addendum 08 §9's *never require an arc* is kept, and the whole
  stage is the distinction that the rule is about **not making a record** and
  had been read as *not showing what one is*. The **Start an arc button is gone
  rather than kept beside it**, the line being the way in and two ways to start
  being two answers. Driving it again found two more of one rule: **a
  placeholder names the question rather than answering it** — §4e's example
  sentences sat close enough to the reading colour that the tab opened on *two
  filled boxes*, and they named a pronoun, so a character with no arc opened on
  somebody else's sentence about *her*; they are Ken's own two questions now
  (*Who they are when we meet them*, *Who they are by the end*) and the `+
  Point` field one control down had the same fault — and the **notes box moved
  under the line**, a tab opening on a four-row free-text box saying an arc is a
  paragraph, which is the arrangement §4e was built to replace.
  **Stage 14 (§4g) is the line that fits the pane**, from Ken sending §4e's ask
  a **third** time in the same words — and the lesson is that **both earlier
  readings were about the plumbing while the ask is about the picture**
  (*like a timeline view*). Driving it found no route fault: from an empty cast
  the whole journey works. So it was **measured**, and the measurement is the
  report — `.arc-stop` was a **fixed 176px** in a `flex` strip, so seven stops
  ran 1508px through a 944px track and the last two moments **and *Becomes*
  itself** sat off the right edge of the screen behind an overlay scrollbar that
  draws nothing until the pointer is already in the strip, while two ends alone
  huddled into the left third with a **46px** dash between them: two cards and a
  hyphen, not a line. **A timeline fits the space it is given** — addendum 15
  §15's *whole story means the whole story fits* and addendum 20 §9e's *the size
  that fits is a reading* in a third room, the same fixed number where a share
  of the measure belongs — so a stop is `flex: 1 1 0` floored at 110px and
  capped at 220px and a gap **takes what the stops do not**, which puts seven
  stops inside the track and stands *Begins* at one edge and *Becomes* at the
  other. That half is not decoration: **the line is the gesture**, so making it
  long is the same change as making *double-click on the line* reachable, and
  the `+` is faint rather than invisible for the same reason. Past about six
  moments on a laptop it **scrolls and says so** (a thin scrollbar, and the
  chosen stop brought into view — addendum 18 stage 4's own fix). Building it
  caught **a host asked rather than assumed**: the new `scrollIntoView` threw in
  jsdom and an effect that throws takes the tab down, and the room already had
  the guard in two places while **two newer copies had not asked it** — this one
  and §4b's card scroll — the *second answer* argument pointed at a browser API.
  The keeper: **when the same words come back a third time, stop reading them as
  a broken mechanism and read them as a description of a picture** — twice they
  named something unreachable, the third time something reachable that did not
  look like what was asked for, and only measuring told them apart, every test
  being green through all three.
  §2 records
  where this diverges from the handoff and why; §5 is the one thing
  deliberately not built (§21's AI suggestions, which the handoff does not ask
  for).
  `addendum-26-note-sorter.md` is the **Note Sorter**, from Ken's own dev spec
  and its UI handoff (*a new ability to sort notes. Quickly. And easily from
  whatever source*). **Built**; §13 says what each stage does. The audit paid a
  **twenty-fourth** time and paid most of the module: §19's data model names
  four records and **two already exist** — a sorting category *is* a
  `research_category` and a card *is* a `research_item` — so the data work is
  two tables and four columns (migration 0057), while §16's *cards become
  attached notes, and outline items link back to their cards* is
  **`addResearchRow`** whole (addendum 06 §5), which is why *after sending, the
  cards stay in the sorter* needed nothing at all; §17's *attach to a theme* is
  `story_links`, the dictation is `startDictation`, and a Word document arrives
  through **`docxToMarkdown`**, written for the note importer and already
  exactly what a page somebody is about to read and highlight should look like.
  That convenience is also the module's one real risk and it is the graveyard's
  exactly: if a card is a research item then every research reading that never
  heard of the sorter will list it, so the predicate is applied **before the
  first surface rather than after the fifth** (addendum 24 §5j) and it lives in
  **research's own readings** — `researchCategoriesInOrder` filters
  `sessionId === null` and `shelvedItems` joins `workingNotes` in
  `selectors.ts` — with deliberately **no `shelfCategories` of this module's
  own**, a second name for one reading being the first step to a second answer;
  `sorter-surfaces.test.ts` is `cast-surfaces`' third sibling and walks every
  research reading rather than the ones this module touches. Four rules carry
  it. **The source is immutable and sorting never touches it**, so *Show
  original source* is a read rather than a reconstruction — which is why §19's
  stored `extractedText` is **not built**, a snapshot beside an immutable source
  being able only to agree with `text.slice(from, to)` or be wrong about it.
  **Processed is a reading**: `coverageOf` counts it back from the cards' ranges
  every time, so deleting a card un-greys its passage with nothing run and two
  cards over one stretch make one run, the sixth time a fact about the work is a
  reading rather than a column. **The press is the act and the drag is the
  browser's** — the first draft made the page `draggable` and measuring the real
  browser showed what that costs, a `draggable` element not being able to have
  text selected inside it at all, so the first of *read, highlight, drag, drop*
  did not work; the attribute is gone, Chromium drags a selection of its own
  accord, and what the room supplies is a **button per category** carrying
  `extractOffer`'s sentence, which is also the only path a keyboard can reach.
  And **there is no writing mode**, the handoff asking for one on the sitting to
  set the Send mapping while the project has had a `format` since the first
  migration: `sendLadder` reads it off the format (a chapter where the format
  has one, otherwise the unit, and the next noun down under it), so a textbook
  sends Chapters and Sections and a screenplay Scenes and Beats with nothing
  naming a level; `send_mode` was written into 0057, found to be read by nothing
  and **taken out in 0058** rather than left as a field that lies (`columns` on
  a part's style, addendum 20 §17). The room is the **seventh**
  (`NoteSorterWindow.tsx`, `ROOM_PANES`), on **every** format unlike Layout, a
  **Notes** button on the title bar and *Window ▸ Note Sorter in its own
  window*, with four tabs — Gather, Sort, Refine, Send to Outliner — and **no
  dialog while sorting**, a dropped passage becoming a card at once named from
  its first seven words. Driving the real room caught the fault of the day
  **twice in one shape**: *Hide sorted* and *Unsorted only* drew the same 358
  characters, and once that was fixed *Everything* and *Grey sorted* drew the
  same 762, because the stylesheet greyed unconditionally — **four controls have
  to mean four things or one of them lies**, so Everything is now the source
  undifferentiated, Hide leaves a mark **in place** and Unsorted only runs what
  is left together. It also found the chosen card drawn dark on dark, `button:
  hover` being one specificity point above a bare class and the base button
  raised since addendum 20 §9 — §4a's lesson pointed at specificity rather than
  source order — and three of six stacks past the right edge of a 1500px window,
  which is why **a category with nothing filed in it is a chip** (a reading, and
  it becomes a stack the moment something lands in it) and the stacks **wrap**
  rather than scrolling as the mockup does: you cannot drag a passage onto
  something that is not on the screen. The **unsorted pile** is a real category
  marked `note_unsorted` and seeded by `beginSession`, because a card must have
  a home and the thing that needs it is a *delete*; it has no × and no rename,
  absent with the reason said, and **Merge into… is Delete with a different
  target**, `removeSortCategory` taking *where the cards go*. **Nothing is
  created by looking** (addendum 25 §4f): a project with no sitting opens on
  Gather and the first thing put in begins it. **§14 is the auto-sort
  suggestions**, from Ken straight after: spec §15's three functions — Suggest
  Categories, Suggest Destination, Auto-Sort Suggestions — as **one scorer**,
  and the divergence worth keeping is that the scorer is a **reading rather
  than a model call**. The argument is not thrift: for *this* question the
  writer has already given the answer, since asking a model *which of these six
  categories does this paragraph belong in* gets general knowledge about the
  words while asking the sitting gets **what this writer did with these
  categories half an hour ago** — they made *Dialogue* and filed three passages
  in it, so the fourth that talks the same way belongs there **because of those
  three**, which a model cannot see and is the only thing worth seeing. Four
  things follow: it **says why** in something checkable (*1 card uses
  “villain”, “morning” in Character*, a fact about their own filing, where a
  category named with no reason is what gets a panel switched off after the
  second wrong guess); **nothing moves until you approve is true by
  construction**, there being no suggestion record to write or clean up, so
  extracting the passage stops it being suggested with nothing run
  (`coverageOf`'s rule one layer up); it is **testable rather than merely
  demonstrable** where the AI routes this program has have still never been run
  live; and it **costs nothing and needs no account**, so there is no cap to hit
  and no network to be without. **§14a is a model for the one it is better
  at**, from Ken after §14 shipped, and the case is one sentence: **the count
  can only offer a word that repeats, and a grouping's name is very often a word
  that appears in none of the passages** — the notes say *villain*,
  *antagonist*, *the man burning the village*, and the category is called
  **Antagonists**, which no count will ever produce. The other two stay the
  reading's, *which of my six categories does this go in* having been answered
  by the writer filing three things half an hour ago. **The shape is the
  permission** a third time (addendum 07 §12, addendum 16 §10):
  `suggestedCategoriesSchema` is **names with a sentence** and has no field for
  a passage, a range, a card or a category id, so a model that decided to sort
  the notes has nowhere to put the answer — spec §15's *should not silently
  reorganize* kept by the type, with a test handing the schema a reply carrying
  `categoryId`, `cardIds`, `from`, `to` and `apply` and watching all five fall
  off. **What leaves the machine is said beside the press** (*Sends the unsorted
  passages and your category names. Nothing is filed.*), it being the paragraphs
  and the names with no ids and nothing read from the database. **The two halves
  are one list, counted first** — `mergeIdeas` putting the read ideas before the
  suggested ones so a writer meets what they can **check** before what they can
  only **judge**, dropping a name a category already has or the reading already
  offers (a model agreeing with the count is not a second idea), and marking
  which half said it on the row for `found`'s reason (addendum 25 §2). The rest
  is the learning aid's pattern: `ai-note-categories.ts`,
  `/api/ai/note-categories` with a `GET` saying whether it can be had,
  `resolveCaller`, **its own rate-limit bucket** so a morning of sorting does
  not use up somebody's chapter summaries, and the three bridges. The button is
  **absent rather than greyed** with the reason said once, and it may be absent
  without leaving a hole because **the panel is complete without it** — offline,
  unlicensed or in a build with no cloud, the sorter suggests exactly as §14
  describes. **The model call has not been run live**, addendum 16 §6b's caveat
  for its reason; what is proved is everything either side of it, driven with
  the bridge answering as the route does — the button appearing only when the
  status allows, `{ passages, categories }` and nothing else crossing the
  boundary, a taken name dropped, a surviving one marked *suggested*, and the
  press making a category with nothing in it, which the panel then draws as a
  **chip**. A category is taught by its **cards and by its own
  name, kept apart** (without the name the panel is silent until somebody has
  done by hand the work it exists to save; without the separation it says *1
  card uses “dialogue”* about a category nothing is filed in). Whether a row is
  shown is **a rule rather than a number**, and the first draft had a number: a
  floor on `strength` is a floor on a **density**, so the same evidence fell
  below it in a longer paragraph and an obviously-Dialogue paragraph went
  unoffered at 0.125 while a shorter one cleared at 0.167 — a threshold on a
  density is a threshold on paragraph length wearing a disguise. `worthSaying`
  asks about the **evidence**: two words, or one that is the category's own name
  or that two of its cards share, and in the single-word cases a word no other
  category knows — both clauses earned on the screen, the first draft having
  accepted any unique word and duly proposed a paragraph about *revision* for
  **Character** because one card there happened to contain *write*, which is an
  accident rather than evidence. Four rules hold the placements: **only what is
  unsorted** (`piecesOf`, the same reading the greying uses), **a paragraph at a
  time** (what a writer highlights; half a sentence would make approving worse
  than doing it by hand), **one category per passage** (two being a question
  rather than a suggestion), and approving is `extractToCategory` and nothing
  else, so an approved suggestion is indistinguishable afterwards from a
  passage dragged across. **Suggest Categories proposes a name and never makes
  one** — pressing it makes the category **empty**, after which the passages
  suggest themselves into it, making it *and* filling it being the *silently
  reorganize* the spec forbids. The panel sits **under the stacks in Sort**
  rather than in Refine where the handoff draws it, because by the time a
  writer is refining every card is filed and it would have nothing to say,
  while here approving a row greys the passage an inch to the left. The
  **switch is per machine and dismissing is about this minute**. Driving it
  caught three of one kind: the **dismissal sentence lied** (*nothing here looks
  enough like any of your categories*, said to somebody who had just dismissed
  four things that did — `describeSuggestions` is told how many were put aside
  and there is a way back), **Approve was below the panel's own scroll**
  (addendum 20 §15c's fault in a smaller box; the list scrolls and the head and
  acts do not), and the **switch's accessible name was *On*** — addendum 02
  §4a's switch exactly, *off* meaning nothing on its own and neither does *on*,
  so it is named for what it switches. A fourth the tests caught and it is the
  switch being real: turning it off in one test reached every test after it,
  a preference being per machine and jsdom's storage persisting. §15 names what
  is still absent — undo in a popped-out room (every room's, and addendum 02
  §8's) and dragging a card across to another category.
  **§16a is the standard categories a sitting opens with**, from Ken (*I would
  like the note sorter to have categories set up… character setting dialogue.
  theme idea set up and payoff scene beat and other standard categories for
  storytelling*), read as a **list** rather than as an ask for a dialog that
  sets up characters — the sentence runs as one and ends *other standard
  categories for storytelling*, which only that reading finishes.
  `seedCategoriesFor` is the list and `beginSession` hands it over beside the
  unsorted pile, for the pile's own reason: the thing that needs it is the
  writer's **first drop**, and a screen that asks somebody to invent a taxonomy
  before they may sort anything is the screen this module exists to replace.
  Three rules. **Every seed names something the program already has somewhere
  to put** — Character is the Character Creator's, Setting is Locations',
  Theme is Themes & Motifs', Setup & payoff is that module's, Plot is a track,
  Idea is the Ideas shelf — so a category is the first half of a journey the
  rest of the program finishes rather than a taxonomy invented for one room,
  and each carries a `description` saying where that kind of note ends up;
  **Dialogue is the one exception and it is Ken's**, writers keeping notes
  about dialogue with no record for it. **Nothing names a unit itself**
  (addendum 16 §6c): the two structural seeds read `nounsFor`, so a screenplay
  gets *Scene* and *Beat*, a novel *Chapter* and *Passage*, a textbook
  *Section* and *Subsection*. And **absent rather than renamed** where a format
  has none — a textbook has no cast, no locations, no cues and no setups, so it
  gets Concept, Example and Figure instead. They arrive **empty**, which buys
  two things: §8 draws a category with nothing in it as a **chip**, so a fresh
  sitting is a row of chips rather than ten empty stacks, and `scoreCategories`
  is taught by a name, so §14's panel has something to say before anybody has
  filed anything by hand. Two faults the seeds made visible rather than caused:
  **`addSortCategory` was making a rival by name** (addendum 24 §5n's rule —
  the check belongs in the **act** — which §16a turned from tidy to necessary,
  a writer typing *Character* having got an empty one beside the full one with
  the suggestion engine least able to tell them apart, since it is taught by
  the name), and **Send offered every empty category as a chapter** (measured:
  *12 chapters · 5 notes* on a sitting two passages old), so **a category with
  nothing anywhere under it is not a row of the book** and the screen says so.
  **§16b is the handoff's own screens**, from Ken (*It doesn't look like you
  use the UI mockups*) — and he was right in a way worth naming precisely:
  **the mockups had been read for structure and not for surface**. The four
  steps, the two-panel split and its divider, stacks and chips, the four
  display modes, the cream index-card colours, the tick tree and the outline
  preview all came from the handoff, and the reading stopped there, so a
  writer saw a working room that did not look like the comps. The correction is
  a **visual restyle in place**, addendum 02 §4a's shape: every binding,
  reading and promise unchanged, the whole domain suite through it untouched
  but for the seeds' counts. **The bar is one row and a step is a numeral in a
  ring** — which needs the number and the label to be *two elements rather than
  one string*, and that is what makes the numeral `aria-hidden`, so a tab's
  accessible name is *Gather* and the tablist says which of four it is;
  sixteen assertions named the old spelling and were updated rather than worked
  around. The handoff's `VC WRITER` half of the lockup is deliberately not
  repeated, the application's own title bar being an inch above. Measured at
  1440 the row was one squeeze short (the last step under the progress rail,
  *+ Sitting* on two lines), so **the steps and the search never shrink** and
  what gives way is what is merely nice to have, in order: the room's name, the
  sitting's, the progress said in words. **Undo is on the bar and absent rather
  than dead** in a window of its own, the history being the workspace's — §15's
  gap named rather than papered over with a control that can only refuse.
  **Gather is four tiles and a loud fifth**, where it had been three framed
  boxes one of which was a raw `<input type=file>` reading *Choose Files · No
  file chosen*; **Paste text and Type directly are one control through two
  doors** (addendum 20 §16d), what differs being what the writer means to do,
  where two *boxes* would have been the second answer — plus the dashed drop
  zone, §6's promise at the foot of the sources and the gold **Start sorting**
  under it. **A card carries its lineage on its face** (*Brainstorm ¶3*, in
  mono, `whereFrom` and stored nowhere), which is the single thing that makes
  it an index card rather than a coloured box. **A tag is a thing you take
  off**, so pills with a ✕ rather than a comma-separated line. **The card's
  acts are one row at the top** — Split · Merge · Move to… · Also show in…,
  with *made* and *edited* at the right — because the acts are what you *do* to
  a card and the fields are what it *is*; **Merge lives once**, there rather
  than also under the sequence. **A comment is a third field and the record had
  nowhere for it** (migration 0059): `body` is the words that travel, `source`
  is where the fact came from, and this is *pair with the Hans Gruber
  example?*, which belongs to neither. **The outline preview is numbered and
  the numbers are a reading**, so unticking a category renumbers what is left
  with nothing run — and a card gets none, an attached note carrying none in
  the Outliner. **The waveform is decoration and says so where it is written**,
  no speech API here reporting a level, so it moves while the recogniser runs
  and stands still when it does not. The lesson is this project's oldest one
  pointed at a picture: **a handoff is read twice — once for what the screen
  must do and once for what it must look like** — and doing the first alone
  produces a room that passes every test, keeps every promise, and reads to the
  person who asked for it as though the mockups were never opened.
  `addendum-05-short-form.md` is the short-form module: the AV sheet in
  place of the Script, the storyboard on the timeline, playback, and the two
  documents it prints. **All eight stages are built** — §9 says what each one
  does.
  `addendum-29-saving.md` is **save as, and save a copy**, from Ken (*the
  ability in every single module to be able to save as, where you can save it
  as a location. Save a copy should give you the ability to save a copy that
  gives a version in that location. And it should save the location of that
  file so it can re-find it*). **Built.** It opens on a fault of the plainest
  kind: `File ▸ Save a copy…` has existed since the menus were built, carried
  `Ctrl+Shift+S`, was never greyed, never errored — and ran
  `project.saveNow()`, an ordinary save to the same file with no dialog and
  nothing copied, so **the act was its own label's opposite**. Addendum 20
  §16b's lesson a second time (*a menu command is the most durable route in
  the program and the least likely to be revisited*), and **worse than an
  unbuilt feature**, an unbuilt one being absent where this one answered: a
  writer pressed it, saw *Saved*, and could not find out there was no copy
  until they went looking for a file that was never written. **The two acts
  differ in exactly one thing and it is not the file they write** — both ask
  for a place and write the whole document there, and what differs is *which
  file you are working in afterwards*, which is why there is one domain module
  (`saving.ts`), one handler, one bridge method and one `saveAs(kind)` with
  **the difference a single branch**: a save-as adopts what comes back, a copy
  does not. The sentences say what each act's fear is about — save as names
  **what happens to the file left behind** (a writer expecting a *move* and
  getting a copy has two files and believes they have one), a copy names **what
  happens to the one in hand**. **A copy says it is one**: `copyTitle` is the
  only thing either act changes about the document and never the file the
  writer stays in, because Ken's word for what this makes is a *version* and a
  version you cannot tell from the original is not one — the file name would
  carry it on the desktop, but the Projects screen, the recents, the running
  heads, the contents page and the eBook metadata all name the book by its
  **title**; it does not stack, a copy of *Lamp copy* being *Lamp copy*.
  **The location needed no new record** — both acts call the same
  `rememberRecent` an open and a create already call, so Ken's third sentence
  was answered by anything at all being written, and `describeSavedTo` **names
  the place rather than only the act**, *Saved* answering nothing about finding
  it again, with the path said exactly as the host gave it (a shortened path is
  one you cannot search your own disk for). **What a place is, is the host's**:
  `window.vcwriter` is deliberately identical in both so it may not be sniffed,
  so the renderer asks one question and the host answers with where it landed —
  a folder on the desktop, the preview's own library in the browser, where
  `pathFor` has refused to collide since it was written. **The preview half is
  not a nicety**: leaving the two items dead there because a browser has no
  folders is addendum 09 §15's `ok([])` exactly, and the `browser://` in the
  path is **said rather than hidden**, being the one thing somebody needs to
  know about a copy made there. **What is written is the document in hand**,
  `printing.ts`'s rule at the disk — proved by renaming a beat through the
  Inspector and copying a second later, the copy holding *Renamed a moment ago*
  while the original on disk still held *Opening beat*. **Every single module**
  is the rooms: a popped-out room has **no menu bar at all**, and §8's rule is
  that it must not do less than the panel it came out of — but **a room does not
  write the file**, holding the document and owning no path, so a room that
  wrote one would leave two windows disagreeing about where the project is and a
  save-as would move the workspace's file without the workspace knowing. So the
  room **asks**: a `command` message carrying a **name and never a document**,
  which cannot become a second way to change the writing and does nothing at all
  unrecognised; the new path reaches every room for free, the link's `doc`
  having carried `path` since it was built. **The keys rather than a bar**
  (addendum 02 §6c's answer for undo — the program's acts and not a focused
  field's), nothing said in the room afterwards, a room not being able to know
  whether the dialog was dismissed. Shift+S is the save-as and **Alt+S the
  copy**, the rarer act and the one whose accelerator pressed by accident should
  not change where somebody is writing. Driving it caught the one worth
  keeping: **a dismissed dialog is not a failure and must not paint one** — the
  writer changed their mind, and *could not save* would read as a fault in the
  program. §10 names what is deliberately absent.
  **§2 is the rooms, and the keys not being enough**, from Ken sending §1's ask
  back **word for word** the day it shipped — which in this project has meant one
  thing six times (addendum 20 §15c, §16b, §16c, addendum 25 §4d, §4f) and meant
  it again. Measured in the real preview before a line was written: **a room
  covers the menu bar**, so in all five rooms the File button is in the DOM and
  painted over by the room's own chrome (Research by its search box, Layout and
  the Sculptor by `sculptor-bar`, the Note Sorter by its tabs, the Outliner by
  its tools) while `Ctrl+Shift+S` fired in every one. **So the act worked, every
  test passed, and there was no way to see it was there.** §1's argument that
  the keys were enough — *the program's acts and not a focused field's*, addendum
  02 §6c's reason for undo — is **right about where the act belongs and wrong
  about whether anybody can find it**: undo's keys are the two every writer
  already knows, and nothing about a room says a save-as is behind one. The
  sharper half is about the asking: §1 ended by offering Ken the choice (*if
  you'd rather have a visible button in each room, say so*) and he answered by
  re-sending the ask — **a question about whether the feature is finished is not
  the writer's to answer**, he said *in every single module* the first time, and
  offering a choice between a built thing and a discoverable one is offering to
  leave it unfinished. `RoomSave.tsx` is **one component in five bars** beside
  each room's `PopOutButton`: a `Save ▾` opening the program's own
  `ContextMenu` with both items read from `saveOffer`, so a room says exactly
  what the File menu says. It **builds no menu of its own** (`printing.ts`'s
  reason), **writes no file** (§7 — it relays and the workspace acts), and is
  **absent where a host hands nothing down** (`onPopOut`'s idiom) rather than a
  control that could only refuse. `room-save-surfaces.test.tsx` is **the test §1
  did not have, and its absence is the whole story** — §1's tests proved the acts
  and not one asked whether a writer could reach them, so a sixth room without a
  Save control now fails there rather than shipping. **Named rather than fixed**:
  a room covers the *whole* menu bar, so Editor, Reports, Window and Help are
  unreachable from one too, which is a separate decision about what a room is.
  `addendum-30-game-studio-link.md` is **a game being built in VC Game
  Studio**, from Ken (*on the project page, the video game tab needs to be a
  link to VC Game Studio*), and the answer was **written down in another
  repository rather than needing to be designed**: `kshank999-wq/vc_game_studio`
  carries his own direction of 25 September 2026 — *VC Game Studio is its own
  program, not a mode inside VC Writer; VC Writer carries only a link* — and
  names the site, **vc-gamestudio.com**, which resolves today. Measured first:
  the project page draws eight 150×146 cards, every one an `aria-pressed`
  toggle, and pressing **Video game** made a VC Writer game project. **The card
  stays where it stands and stops being a choice** — taking it off the grid is
  the plainer reading and the wrong one, a writer who comes here to write a game
  and finds nothing concluding the answer is nothing (addendum 08 §8b) — so it
  is **a route rather than a format**, and **a door says it is one**: an anchor,
  no `aria-pressed`, **flat where every other card is raised** (addendum 20 §9's
  raise means *press me and something happens here*), a ↗, and a line naming the
  program and the address rather than the parts, *Scenes and beats* being the
  wrong answer about a format this program does not start and the address being
  said under the label rather than left in a hover nobody sees. `builtElsewhere`
  in `formats.ts` is the one place that knows it, **one host with the URL read
  off it** so there is one address rather than four. **It decides starting and
  nothing else**, which is the half easy to get wrong by doing too much:
  `isInteractive` is untouched, `'game'` stays in the schema and addendum 18
  goes on working, so what is withdrawn is a **way in** and never a feature —
  the distinction between a format this program cannot handle and one another
  program handles better. **Four surfaces start a project and all four ask**
  `startsHere`: the card on the project page, **absent** on the phone (nothing
  there could open VC Game Studio and the project would be made in the wrong
  program) and in the website's picker, and *video game* no longer a kind that
  can be **said** — it falls to §11's refusal, which says the list again, the
  right answer from a pocket where the way to a game is a website. The
  narrowing reaches **what may be made and not what may be named**, so
  `formatSpokenName('game')` is still *Game*, a project made before this having
  to be named on the phone's own list. Leaving the other three would have
  shipped a page saying games are built elsewhere beside three screens still
  making them, and three private copies of the eight formats already existed
  between them. Driven at 1440×900: the card is an `A` with
  `href="https://vc-gamestudio.com"`, no `aria-pressed`, `box-shadow: none`,
  **150×146 like every other card**, a press opens a tab and leaves the format
  on *Screenplay*, and under a light scheme it reads `rgb(26, 127, 55)` — the
  **scheme's tokens rather than a copy of Gold's values**, addendum 02 §23a's
  fault one screen over, checked rather than assumed. **§2a is Ken's own answer
  and it reverses §2's argument** (*or we can create a separate button and
  advertisement on that screen saying, need to write a narrative interaction
  script. See VC Game Studio*): §2 spent **three decisions** making one card
  announce that it was not like its seven neighbours — an anchor, no
  `aria-pressed`, flat rather than raised — and every one of them is the price
  of standing a door in a row of toggles, where **outside the grid it has to
  announce nothing**, nothing about it claiming to be a format. So the card is
  **gone rather than kept beside the advertisement**, two things on one screen
  pointing at VC Game Studio being two answers to *where do I write a game* and
  the one inside the grid being the one that has to lie about what it is; the
  grid is **seven cards and every one of them is a choice**, which a test
  asserts by walking them. What §2 was right about is that the answer must stay
  **findable from the formats**, so it is at the **foot of the New project
  panel** — a writer scanning for *Video game* and not finding it looks around
  in the same glance — and deliberately **not between the grid and Create
  project**, nothing standing between choosing a format and pressing the
  button. **The words are Ken's** (copy is not a reading, and copy typed twice
  is two advertisements), the program and the address are still
  `builtElsewhere`'s, and the button is **raised like every other act on this
  screen**, what says it leaves being the ↗ and the address under it rather
  than a different shape. Looking at it caught the
  one thing no test could: **the address broke at its own hyphen**, `vc-` over
  `gamestudio.com`, which a reader cannot tell from `vcgamestudio.com`; an
  address is one word. In Electron it needs **no bridge** —
  `setWindowOpenHandler` has sent every `target="_blank"` to `shell.openExternal`
  since the window was built, identically in both hosts, so the renderer writes
  an `<a>` and nothing else. §6 names what is not built: the link goes to the
  **home page** rather than to the no-save teaser, a route being only a route
  where it exists and the home page being the one page certain to be there.
  `addendum-31-discount-codes.md` is **discount codes**, from Ken (*there needs
  to be the ability to give discount codes, create discount codes in a checkout
  screen and for advertising*), and the audit answers the first of the three
  before a line is written: `allow_promotion_codes: true` has been on the
  checkout session since it was written, so **Stripe's own page has always
  shown an *Add promotion code* field** and a code made in the dashboard has
  always worked. What was missing is **making one** and **advertising it**.
  **Stripe is the till, so the discount lives there** — `pricing.ts`'s rule on
  the other half of the transaction — which is why there is **no table and no
  migration**: no stored percentage, no copied expiry, no redemption counter, so
  a code withdrawn in Stripe stops working here with nothing run and the admin
  screen is a window onto the one set rather than a second set to keep in step.
  What the domain holds is the part that is not Stripe's (`discounts.ts`): the
  one spelling of a code, what the offer says, what is owed, the advertised
  link and the refusal. **A coupon is the discount and a promotion code is the
  word you say**, Stripe's own split kept rather than flattened because one
  coupon can carry several codes, which is how the podcast and the newsletter
  are told apart. **One refusal for every way a code can fail** — unknown,
  expired, used up, switched off — a customer doing the same thing about all of
  them and the sentence that told them apart being the one that tells a stranger
  which codes exist. **The shape is the permission** a fourth time: the checkout
  body takes the **word** and has no field for a percentage, an amount, a coupon
  or a promotion-code id, with a test that hands it six such fields and watches
  them fall off — and whose first assertion **reads the route's own source**,
  a test whose subject has drifted being worse than none. A code that is not
  redeemable is **refused rather than quietly dropped**, somebody who followed
  an advertisement and is charged in full without being told having been
  overcharged as far as they are concerned. **The advertising half is the link**,
  and building it found the fault of the day: `?code=` is **this site's own
  sign-in parameter**, which `strayAuthRedirect` forwards to the auth callback,
  so the first draft's advertised link took every reader to *your sign-in link
  has expired* with the discount never mentioned — the page perfect and
  unreachable, found only by driving the real site. `DISCOUNT_PARAM` is
  `discount`, the **third** name this project has stepped around (`origin` taken
  so a moment is `found`; `Standing` taken so a node's is a `Situation`), the
  rule being that **the collision is with a word, so the fix is a word**, with
  two tests pinning it. Driving also caught **four dead classes** — `.panel`,
  `.table`, `.link` and a bare `.muted`, none of which has a rule on this site
  (addendum 09 §14a's trap again), so *Remove* drew as a native grey browser
  button inside a sentence — and **a control behind a scrollbar that draws
  nothing**: the advertisement column took the whole un-wrapped URL, ran the
  table to 1018px inside a 944px box and put *Switch off*, the one control that
  withdraws a code, 82px past the edge (addendum 19 §10). Two wrong fixes before
  the measurement settled it — the cell needed a **cap and not a floor**, a floor
  never having been what held it open, and it needed the table's own `.wrap`,
  its cells being `nowrap` by default. One tidy came with it: `formatPrice` and
  `formatMoney` were two private copies in modules that reach Stripe or the
  database, so a screen wanting to write `$10` dragged a server client into the
  browser; they are `money.ts` now, **kept apart rather than merged** because a
  price is advertised and a figure is accounted for. §8 names what is not done:
  **the Stripe half has never been run live** (no keys here), nothing is deleted
  (switched off, the graveyard's reason), no per-customer codes, and a code is
  not carried through a mid-purchase sign-in.
  **§9 is the free purchase**, from Ken (*make a test code and run it through
  checkout*), which **cannot be run from here and found a shipped bug anyway**:
  `STRIPE_SECRET_KEY` is a Vercel *sensitive* variable whose value the API
  returns to nobody, there is no key in this container, none may enter this
  repository and Ken must not be asked to paste one — so what could be done was
  work out **what that test would meet**. A test that costs nothing is a
  **100%-off code**, which is not a contrivance but a **review copy**, and
  everything up to the till was already right (`newDiscountRefusal` allows
  exactly 100, `priceWith` answers zero, the screen makes it). **The webhook
  dropped it on the floor**: the gate was `payment_status === 'paid'` and
  **Stripe answers `no_payment_required` where the total is zero**, so a
  100%-off checkout completed, the buyer saw the success page, and the event was
  claimed, skipped and marked processed — **no order, no licence, no email and
  no error either**, which is what makes it the bad kind, nothing in the program
  ever reporting it and the only person to find out being the buyer holding a
  receipt for nothing; every test passed over it because every test used a paid
  session. `purchaseSettled` is the one reading of Stripe's three words and
  lives in `discounts.ts` because **a discount is the only way a purchase here
  reaches nothing**; it is `appleState`'s rule on the other shop (addendum 09
  §14) — **a word this build has never heard of is not a reason to hand anything
  over** — so `unpaid` and everything unknown are refused. **Fulfilment needed
  no change at all**, which is why the fix is one line: `amount_cents` is
  `check (>= 0)`, the payment intent is nullable and `fulfillCheckout` already
  took null — **the money path was built general and the gate in front of it was
  not**. A code taking everything off now **says so before the press** (*Nothing
  is charged and no card is asked for, and the licence is still issued*), said
  only where it is certain — a percentage of 100 says it and a fixed amount does
  not, this module not holding the price. And the gate is pinned by **reading
  the route's own source**, §4's idiom pointed at a webhook, a Stripe signature
  not being forgeable in a test. The test Ken asked for is now one minute and no
  money: a code at **100% off, limit 1**, followed by its own Copy link.
  `addendum-32-desktop-subscription.md` is **the desktop subscription**, from
  Ken (*we are switching to 19.99 mo subscription base and 199.99 yearly
  subscription*), and **the audit paid a twenty-seventh time**: four of the
  things a subscription needs were already standing — `license_status` has
  carried **`expired`** since 0002 and nothing ever wrote it,
  `licenses.expires_at` has been a column since 0002 and nothing ever wrote it,
  the webhook has handled `customer.subscription.*` since the Writers Room
  seat, and `DisplayPrice.recurring` has been read off Stripe since
  `pricing.ts` was written. So **a subscription is not a second kind of
  entitlement**: it is the licence this program already has, with its expiry
  finally written down — and because `decideActivation`, `canDownloadPlatform`,
  the download route, the account page and the admin console all ask
  `license.status`, **pointing a lapse at that one field carries it everywhere
  with nothing else told**, the whole enforcement change being that two callers
  now ask `licenseLive`, which reads the status *and* the date. Migration 0066
  is one column, `licenses.stripe_subscription_id`, because **a renewal extends
  the licence it already has** — twelve invoices a year through the birth path
  would give a writer twelve serials. **A plan is a word, never a price** (the
  body takes `monthly` or `yearly` and has no field for a price id, an amount or
  an interval — the shape is the permission a fifth time), and **no price
  appears anywhere in the repository**, `pricing.ts`'s rule, with the yearly
  saving a **reading** over the two figures rather than a badge somebody typed.
  **`past_due` entitles, deliberately** — an expired card is not somebody
  leaving and Stripe is still retrying, addendum 07 §23's refusal — while
  `canceled`, `unpaid`, `paused` and **any word this build has never heard of**
  do not, `appleState`'s rule on a third shop. **The date is read as well as the
  status**, because a webhook is a message that may not arrive and a date in
  hand beats one that never came; **a licence with no expiry never lapses**,
  which is every row written before today. **A subscription says what it is
  for**: desktop plans and room seats arrive as the same events, so the handler
  routes on the metadata each checkout stamped and one that says neither is
  **left alone rather than written somewhere**.
  `STRIPE_PRICE_ID_DESKTOP` is **gone rather than kept as an older spelling**,
  this project's usual move, because a one-off price in a subscription checkout
  fails at Stripe with a message about modes that says nothing about what to
  fix; it is `STRIPE_PRICE_ID_MONTHLY` and `STRIPE_PRICE_ID_YEARLY`, both
  recurring, both on one product. **What a lapse reaches** is
  `DESKTOP_LAPSE_PROMISE` and it **describes what the program already did**: an
  activated copy goes on opening, printing and exporting, nothing local having
  ever asked the server for permission to write a word, and what stops is taking
  a **new** machine plus the parts that ask vc-writer.com for themselves — the
  desktop going read-only at a lapse is a **separate and bigger decision, named
  rather than half-built**. The name `LAPSE_PROMISE` was **taken** (the Writers
  Room's), the fourth time here after `origin`→`found`, `Standing`→`Situation`
  and `code`→`discount`, and the keeper is **how it was found**: a star
  re-export conflict is a *runtime* fault, so the domain built, 2666 tests
  stayed green and the buying page returned a 500 — only running it found it.
  Driving caught three more the tests could not, two on one card: **the price
  drew at 14px** (`.plan-option span` is two selectors and beats a single
  `.plan-figure` wherever it sits — specificity rather than source order, and it
  took measuring the computed size, both figures being legible), **`per
  yearSave 17%`** ran together (an `inline-block` after an inline span, where a
  `margin-top` does nothing), and the two cards' headings sat **15px apart**
  because a `<button>` centres its own content and only one card has a saving
  line. Plus the wording: *After payment* and *Continue to payment* had survived
  from the purchase onto a page that now sells a subscription. §7 names what is
  not done — **the Stripe half has never been run live**, **nobody is being
  migrated because `orders`, `licenses` and `stripe_webhook_events` are
  measurably empty**, no proration or plan switching in the app (Stripe's
  Customer Portal does both and the account page should link to it), and no
  trial.
  **§8 is read-only at a lapse**, from Ken (*make the lapse read-only on the
  desktop*), which **overrules §4's own decision** to name it rather than build
  it. The build is small and the design is the whole of it. **One place
  refuses**: every change to the document is a pure function of the document and
  every one goes through the same `update`, which is the fact addendum 02 §6c's
  undo rests on, so `useProject` takes a `writable` and some hundreds of
  `project.update(…)` calls **needed no change at all** — an act built next
  month is refused the day it is written. The satellite needs its own and it is
  not a duplicate: `useLinkedProject` applies a mutation **locally before
  proposing it**, so a room that did not know would draw a paragraph and have
  the hub wipe it, and **a writer watching their words vanish is worse than one
  told they cannot type them**; the standing is a fact about the **machine**, so
  every window asks the machine rather than the hub (addendum 29 §2's rule from
  the other end). Two things are deliberately **not** guarded — the **flush**,
  so writing already in hand still reaches the disk (losing the last few seconds
  of a sentence to a webhook that arrived mid-paragraph is the one failure this
  must never cause), and **`replace`**, a cloud merge having nowhere else to
  land; undo and redo **are** refused, nothing being changeable so there being
  nothing to take back. **It is a record and not a live answer**: the desktop has
  never held a licence standing, which is exactly why §4 could say a lapse
  touched nothing local, and *a writer on a train must not be refused their own
  manuscript because the machine could not ask* — so `GET
  /api/licenses/standing` gives a status and a date (no admin client and no new
  policy: a customer has read their own licence rows since 0002, over cookie or
  bearer alike), `license-check.ts` writes it down with the day it was given,
  and the renderer reads it with the domain's `writingStanding`, the route
  saying **nothing about what a lapse means** so the rule has one home; **a
  failure to reach the server changes nothing at all**, none of offline, signed
  out, a 500 or an unparseable body being evidence that anybody stopped paying.
  The order of the clauses **is** the design and most of them exist to let
  somebody write: **read-only is a lapse and never an absence** (an account with
  no licence reads null, so a copy never activated writes as it always has),
  **a refusal is announced before it bites** (`seenLapsedAt` is stamped once and
  carried forward, or every check would start the week over, with
  `WRITING_GRACE_DAYS` the week and a live answer clearing it so a second lapse
  gets a second week), and **being unable to ask is not a lapse** — past
  `STANDING_GOOD_FOR_DAYS` the record is a month-old measurement of something
  that changes weekly, so read-only lifts and is a **fresh refusal rather than a
  remembered one**, a writer whose network is blocked or who renewed on their
  phone not being locked out of their own book; that notice says the licence
  ended and **nothing about read-only**, which the copy can no longer claim. It
  is the **inverse of `appleState`'s rule rather than a contradiction**: for a
  shop an unknown word is no reason to hand anything over, for the writing
  surface it is no reason to take anything away, granting an entitlement and
  confiscating work in progress not being one act. `WritingNotice` is **one
  component for the warning and the refusal**, the notice bar every other
  message wears with the refusal a modifier, and **a warning may be dismissed
  and a refusal may not** — the explanation of a program that will not take a
  keystroke being the one notice a writer must be able to find at any moment; it
  is on the **Welcome screen** too, somebody who starts a project and then
  cannot type a word having been trapped by a screen that knew and did not say.
  The **browser preview answers *no record*** rather than refusing, a browser
  not being a licensed install and the one thing this must never do being to
  make `/preview` read-only. Driven at 1440×900: the lapsed bar is a red
  `alert` at 1440 × 57 with Renew, Check again and **no Dismiss**, and typing
  ` XYZ` left the title reading *Opening beat*; within the week a muted
  `status` bar at 47px **with** Dismiss and the typing landed; paid up, no bar
  and the typing landed. Worth recording because it could have gone the other
  way: every field here is a **controlled React input**, so an `onChange` that
  does nothing makes React restore the value and the character never appears —
  there is no `contentEditable` anywhere, which is what would have left typed
  words sitting on screen unsaved, and that was **checked rather than assumed**.
  §8.6 names what is deliberately absent: a read-only copy still creates
  projects, opens, prints, exports and saves a copy elsewhere, and **nothing is
  disabled or greyed** — the bar explains and the fields simply do not take,
  disabling several hundred inputs being a second answer to one question in
  every component in the renderer.
  **§9 is tax, per sale**, from Ken settling a question put to him while this
  addendum was being built (*I will use the stripe tax service that is per
  sale*) — so `automatic_tax` stays on, which is what the code already did, and
  **reading the two call sites against that decision found something neither of
  them said**. **A single charge is rated once and a subscription is re-rated
  every month**, with no browser and no buyer in front of it, from the address
  saved on the **Customer** — and with no valid location there the renewal
  invoice **stays in draft**, which is the quietest version yet of the failure
  this project keeps finding: the subscription goes on reading active, the card
  is never charged, nothing errors, and the first to know is whoever reconciles
  the account (addendum 31 §9's webhook gate one step earlier). Two one-line
  consequences. **`billing_address_collection` is `required` rather than
  `auto`**, `auto` letting Checkout decide an address is unnecessary — a fair
  judgement about one payment and the wrong one about a subscription, since
  what it declines to collect is what every later invoice is computed from. And
  **a session naming an existing customer must write the address back**, which
  is the half that was actually broken: `room-billing.ts` passes `customer`
  where the owner has one, and with no `customer_update` Checkout computes from
  **the address already on that Customer** and discards the one typed at the
  checkout — a Customer made by an earlier purchase very often carrying none,
  so the seat subscription is exactly the case that would have gone to draft.
  `customer_update: { address: 'auto' }` goes **inside that branch**, Stripe
  refusing the field without a `customer`, so moving it up beside
  `automatic_tax` would break every seat checkout for a room whose owner has no
  Stripe customer — which is why the test **pins the pairing in both
  directions**; the desktop route names an email, so Checkout makes the Customer
  and saves the address itself, and must carry no `customer_update` at all.
  Pinned by **reading both sources** (addendum 31 §4's and §9's idiom) for their
  reason — a session cannot be created in a test and **both faults are silent
  and late**, the first charge being perfectly correct either way. **The Stripe
  half has still never been run live**, and the dashboard side is Ken's and
  **named rather than assumed**: an **origin address**, a **registration**
  wherever tax is to be collected, and a **tax code** on the product, without
  which software is rated as the default category.
  `addendum-33-import.md` is **Import**, from Ken in one message (*remove those
  two — import a script, add stories to a collection — from the files menu and
  just put Import… This will open a center dialog box that asks you what you're
  importing*), and the audit paid a **twenty-eighth** time and paid nearly all
  of it: his Roman numerals are addendum 22 §6, the *options on how to divide
  it up into chapters* are the four signals `opensChapter` has read since the
  Word importer was built, *one long beat* is the other arm of an `if`
  `materialiseScenes` already had, *reorder how the stories are and insert
  chapter pages* is the Layout rail (addendum 20 §9a), and notes and graphics
  are the Research importer and the library. So almost nothing here is a
  mechanism. What is new is **the question, asked first** — and four places
  where asking it first made a standing default wrong. **The question comes
  before the file**: every importer this program has had asked for the document
  first and the kind of thing afterwards, a dialog headed *Import a script*
  with a *Format* select two thirds of the way down it, opened by somebody
  bringing in a novel — backwards twice over, the title saying the wrong thing
  before a word is read and the control that decides what is made being the one
  nobody looks at. `import-plan.ts` is the list of answers and **names no
  screen**, so a kind added to it is a row the day it is written; what falls out
  is that **the format select is unnecessary on every kind that already
  answered**, absent on a novel, a book and a collection and kept only for a
  script, which is four formats. **Two headings, because a row cannot carry the
  fact** (addendum 20 §9k): *is this going to replace what I am looking at* is
  the one question a writer has here and saying it on all eight rows is saying
  it eight times, so they stand under **A new project** and **Into this
  project**, with the second group **absent rather than greyed** when nothing is
  open and the reason said in its place; **and because the heading says it the
  rows do not**, from Ken (*just call it graphics*) — *Graphics, into the
  library* under a heading reading *Into this project* is the fact said twice,
  and a label that repeats its heading has nothing of its own to say, so the
  clause came off all four and where each goes moved into its note. A row is
  offered **only where it can land** — graphics on a prose format alone,
  Research ▸ Graphics being every book's and no script's, so the row would
  otherwise route to a shelf the menu does not draw. The four marks are **what the reader can actually see** rather
  than options invented for a screen, and `ALL_CHAPTER_MARKS` is exactly what it
  did before there was a choice, which is why the whole import suite passed
  unedited; **what each combination costs is read off the document rather than
  estimated**, turning one off re-reading the manuscript and moving the figure —
  the only way to tell a book whose numerals are chapters from one whose
  numerals are page numbers (driven: 3 → 2 → 1) — and with every mark off it
  **comes in whole**, with the sentence naming the way out rather than leaving
  somebody holding one undivided chapter. **One long beat** is a **per-format
  default rather than a change of mind**: addendum 21 §10 made a beat of every
  paragraph at Ken's own earlier ask, right for a short story worked over scene
  by scene and wrong for four hundred pages arriving as four hundred beats, so
  `defaultSplit` gives a novel and a book one beat per chapter and keeps the
  collection's paragraph beats. **A collection lands in Layout**, his *in
  between, it will create the layout*, and it is **a route rather than a
  feature** — `landsInLayout` lives in the domain so the sentence said before
  the press and the room that opens cannot disagree. Driving it found four
  faults no test could. **A heading is not a place**: `summarise` reads
  locations off the scene headings, which in a manuscript are the chapters, so a
  novel drew *Where it happens* over CHAPTER ONE with *1 scene* beside it **and
  filed all three under Research ▸ Locations** — an instructional book escaping
  it only because its menu has no Locations folder, an absence doing a job
  nobody asked it to do; prose files none now and the panel lists **The
  chapters**, which is the list a writer wants there. **Nothing names a unit
  itself** (addendum 16 §6c): three literal *chapter*s went in and all three
  stood an inch from a figure reading the noun table, so a collection drew **3
  Sections** over *3 chapters here*. **A mark is a sentence, not a switch on a
  bar** — the marks borrowed `.check`, 10px tracked capitals and gold once
  ticked, drawing A HEADING over A LINE THE DOCUMENT ITSELF STYLES AS A
  TOP-LEVEL HEADING with all four on so the colour distinguished nothing. And
  **a control was promised below that was not below**, the waiting screen
  reading *you say where the chapters are below* over a fieldset that only
  exists once a file has been read (addendum 10 §8, in a tense), plus
  `describeMarks` lowercasing *the word Chapter* into *the word chapter* and
  dropping the one thing the reader looks for. **Deliberately absent**: a
  **Media shelf** — his *under media. And graphics* is one place said twice, and
  a second shelf for pictures would be a second answer to where a picture is —
  and **no route to Layout from a novel or a book**, those arriving as one
  document whose order is the document's. **§8 is driving it on a novel**,
  from Ken (*let's test the import with a novel*) on a manuscript built to be
  what a writer hands over — a title page, a byline, ten chapters divided four
  different ways, a scene break, an illustration, a passage in another face and
  a typed page number at the foot of every page — and it found three faults,
  the first two being one fault counted twice. **A byline is rarely the bare
  word *by***: the reader matched `^by …` alone, so *a novel by K. Shank* was
  left standing, and on a novel the first thing in the document is a chapter —
  so the front matter **became chapter one** and *Chapter One: The Road*
  arrived as chapter two, every chapter after it printing one too high; what
  may precede *by* is now a short closed list of the words a title page
  carries, *she had been working by the light of one lamp* being a sentence.
  **Nothing stored may claim a derived number**: the timeline drew the fault on
  two rows an inch apart, the markers row reading **CHAPTER 1 · THE ROAD** over
  a chapters row reading **Chapter 2**, which is `sequenceLabel` — a positional
  `Chapter ${index + 1}` the importer wrote on every unit, addendum 16 §15's
  argument arriving from the importer rather than from a box — so a screenplay
  keeps `Sc. 4` (a real convention nothing derives) and a chapter stores none;
  only a new import changes. **And a chapter is named once**, the marker having
  carried `chapterName`'s *The Road* while the unit kept the raw *Chapter One:
  The Road*, so those two rows disagreed about the name as well, an untitled
  chapter now reading **Untitled** because its number is the whole of its name.
  **And the list clipped** — `.import-list` had `max-height: 168px` over a list
  already capped at twelve rows, so ten chapters drew eight with the last two
  behind an overlay scrollbar that paints nothing until the pointer is in the
  box (addendum 19 §10, 25 §4g), on the one screen a writer uses to decide
  whether the reader found their chapters: **the cap is the limit, not a
  scrollbar**. What was right: each mark divides on its own (5, 7, 3 and 2;
  10 with all four), the twenty page numbers are dropped and **said**, the
  illustration comes in, the face and size of a set-apart passage are kept, and
  each chapter arrives as one passage.
  **§9 is the part of the program that was no longer there**, from Ken on the
  deployed site (*I go to import a collection of short stories, I get an error
  that says failed to fetch dynamically imported module. I tried to import a
  Word doc .docx*), and **nothing was wrong with the import**: the Word reader
  was fetched when first needed, Vite names a chunk by a **hash of its
  contents**, and a deployment replaces every chunk — so a tab open since
  before the last one asks for a file that is no longer on the server, and
  pressing Import was merely the first thing in that tab to need a part of the
  program it had not already loaded. **It could not be seen from inside one
  build**, which is why every test passed and why driving it found nothing:
  there is no stale page until there is a *second* deployment. Reproduced by
  serving two builds of the same source in turn as two deployments, opening the
  page against the first and swapping — *Failed to fetch dynamically imported
  module: /preview/assets/read-docx-BKO8tlPd.js*, word for word, a chunk name
  said to somebody who has just chosen a file; the deployed chunk was checked
  directly and is fine (200, right type, right bytes), so the build, the copy
  and the gate are all innocent and **a thing that existed stopped existing**,
  which is the one failure a content hash guarantees. Two halves, and the
  second fixes his report. **A split has to buy something**: `read-docx` is
  2.8 kB against a 1.2 MB bundle, so it is a plain import now in all four
  places that read a Word document and a `.docx` needs no network at all; **pdf.js is a megabyte and a half** and stays
  split, so there the failure is **said rather than thrown** —
  `late-module.ts` is the one place and `STALE_PAGE_REFUSAL` the one sentence,
  naming the usual cause and the whole of the fix (*VC Writer was most likely
  updated after this page was opened. Reload the page and try again*), *most
  likely* because a dropped connection reads the same from here and reloading
  is right either way. `late` wraps the `import()` **and nothing else**, which
  is what makes that reading honest: the modules behind it do no work at load,
  so anything out of it is the fetch rather than the module, and the browser's
  own wording goes to the console where a chunk name is of use. **A reader
  loaded late again would look exactly like this never having been fixed**, so
  it is asserted off the source — the test walks every renderer file and
  refuses `import('…read-docx')` anywhere and a bare `await import(` outside
  `late`, addendum 31 §4's and 32 §9's idiom, both failing by being *absent*.
  Driven again across the same two deployments: the stories come in on a stale
  page and a PDF chosen on that page says the sentence. **Named rather than
  built**: the preview's build label carries a timestamp and rides in the main
  chunk, so **every deployment rotates every hash even when nothing changed**,
  which makes the window as wide as it can be — narrowing it means a second
  fetch to save a reload, and a deployment that really does change the reader
  rotates its hash whatever is done about the label.
  **§9a is a page that has outlived its deployment saying so**, from Ken
  sending §9's report back **word for word** — one thing seven times now. The
  audit was paid first and found nothing left to fix in the import: the
  deployed bundle is byte for byte the fixed one (its `read-pdf` chunk rebuilt
  locally from the deployment's own build label and fetched at that exact
  hash — 200, importing the fixed `main`), **no Word-reader chunk exists in it
  at all**, no dynamic import of that reader survives in the renderer, and the
  site's one service worker is scoped to `/notes/app` and cannot touch
  `/preview`, so a reload really does reach the new build. So §9 was right
  about the fault and **wrong about where it stopped**: it ended by telling him
  to reload, which is an instruction rather than a fix — addendum 29 §2's *a
  question about whether the feature is finished is not the writer's to
  answer* — and `late`'s sentence is honest but arrives **after** a writer has
  chosen a file and been turned away. `use-build-standing.ts` is the half that
  arrives first. **It measures rather than guesses**: the page asks for its own
  entry script, the one file it is certain its deployment had, and a flat
  refusal is the answer — no build id, no version endpoint, nothing stored and
  nothing on the server to keep in step. **It asks when the window is returned
  to**, the moment a writer is about to act and the one moment a request costs
  nothing anybody notices (a timer would ask while they type; and coming back
  to the tab *is* Ken's own case). Three refusals stop it crying wolf, a notice
  wrong once being one nobody reads on the day it is right: **only a 404 or a
  410 counts** (a 500, a timeout or no network is the page failing to ask —
  addendum 32 §8's *being unable to ask is not a lapse*), **nothing where the
  page came off a disk** (the desktop's renderer is on the machine), and **at
  most once a minute**. `StaleBuildNotice` wears `WritingNotice`'s bar for its
  reason — one bar for every message, so only what it *means* differs — and
  **the button is the act**, reloading needing nothing done first since the
  project has flushed on `beforeunload` since it was written; it may be
  dismissed, being news rather than a refusal. `.writing-notice-acts` became
  **`.notice-acts`**, a layout named for the lapse being one the next bar
  copies rather than wears. Driven across two deployments of the fixed source:
  a fresh page carries no bar, a deployment lands and coming back to the window
  draws a 47px `status` bar at the top of 1440, Reload lands on the new entry
  chunk with the bar gone, and the collection import reads the Word document on
  the page it landed on (3 sections, 12 paragraphs, no alert). The surfaces
  test is §9's missing one in addendum 29 §2's shape: **every window that
  carries the lapse bar must carry this one**, so a third window added later
  fails there rather than shipping silent.
  **§10 is the import that erased a finished story**, from Ken, and it is the
  worst report this project has had (*I just finished editing and adding
  pictures and everything to a story… instead of adding it at the end it
  erased everything I did and all my work is gone*). **`adoptImport` called
  `project.replace`, which is the cloud merge's door and keeps the path** — so
  a second book imported with one open was written into the open project's own
  **file**, and three things made it final: nothing asked (the heading says *A
  new project*, true of the document and not of the file it landed in),
  nothing could take it back (`replace` calls `forget()`, rightly — a merge
  from the cloud is not this writer's act), and **nothing had a copy**, the
  desktop keeping rolling snapshots beside the project while the preview — the
  build Ken uses — answers `listSnapshots` with `ok([])`, addendum 09 §15's
  lesson where it is not a feature reading as unbuilt but **the safety net not
  being there**. So **a new project is a project**: `createProject` takes a
  document now (one optional field in the preload type, the main handler and
  the browser bridge) and `createFrom` goes through `runOpen`, which **flushes
  what is open first**, so the project in front of the writer is saved and left
  where it is and the document that arrived gets a file of its own — which
  fixes a second case nobody reported, an import from the **welcome screen**
  calling `replace` with no path at all, so the autosave had nowhere to write
  and the project existed in memory and nowhere else. The chooser says it once
  under the heading rather than on four rows (addendum 20 §9k), and
  `addImported` **refuses what it cannot be sure of** — `update` writes what it
  is given into whatever is open, so an append that would land on another
  project changes nothing at all. **The next story is the same dialog**:
  *More stories* and *More episodes* had a screen of their own, 236 lines that
  read a document and had **none of the controls this one grew** (no marks, no
  passage split, nothing to say where a story divides), which is two answers to
  what an import is and is why Ken asked for *the same formatting dialog box* —
  one now, with the kind saying where it lands, so the round is the code path
  the second file of a multi-file import already took. Three decisions: **what
  has landed is held by the workspace** (the first landing turns a window with
  no project into one with a project, a different tree, so React builds the
  dialog again between the rounds and state kept there is lost exactly where
  *Import another* is pressed), **another round waits for the project to be
  open** (an append sent before the window stands in it would be written over
  the project still open — refused rather than raced), and **what landed is
  named off the project rather than off the files**, driving it having
  announced *The Harbour* as **ken-harbour** an inch from a rail that said
  otherwise. Driven at 1440×900: the dialog stays up reading *The Harbour is
  in. 1 story in the collection now*, a second document through *Import another
  story…* gives *2 stories*, and then the act that lost the work — a novel
  imported with that collection open — leaves **both** projects in the
  browser's own library, the collection still carrying its story. Looking at it
  caught *2 storys*, which is what `${noun}s` gives. **Deliberately not built
  and named**: snapshots in the preview, the cause being gone and the net still
  absent.
  **§10a is the name a writer gives it**, from Ken with his library on the
  screen (*I named the project Dylan's Tales. But in the save, it's calling it
  the name of the first script. And if there's one existing, then it makes a
  two and a three. But it's not maintaining the name that I give it when I
  create the project*), and **driving it first is what told the two halves
  apart**: a collection named *Dylan's Tales* with one story imported through
  *A new project ▸ A collection of short stories* leaves the bar reading **In
  For A Pound**, while the same import through *Into this project ▸ More
  stories* leaves it reading **Dylan's Tales** with the story in it. So the row
  he reached for made a **second** project named after his document and left
  the one he had named behind, empty — his `IN_FOR_A_POUND_STAGE_final.vcw`,
  ` 2`, ` 3` exactly. **An import made a project and never asked what it was
  called**, which is a gap rather than a slip: *every other way of making a
  project asks for a title* (the New project panel will not create one without
  it, that being *the first decision of the work* in its own words) and this
  took the document's own title or the name of the file on disk, which on a
  collection names the whole book after its first story. The name reaches
  further than any other field — the file on disk through `suggestedFileName`,
  the library row, the running heads, the contents page and the eBook's
  metadata, `bookNames` falling back to it — so **Project name** is the first
  field under *What to make of it* (addendum 02 §4a's ordering, what a thing is
  before what is done to it) and `nameProject` is **one act in the domain**
  rather than a spread object written wherever somebody needs it. Two rules
  keep it from changing anything else: **empty means what the document says**,
  so it is a placeholder rather than a demand and an untouched import is byte
  for byte what it was, and it names **the project and nothing in it**, the
  first story keeping the title it came in under because a collection is not
  its first story. **And the row he reached for was named for the wrong
  thing**: the rows under *A new project* are named for *what is being
  imported* while the one that fills the project he had just made is named for
  *the act*, so the obvious press for somebody holding a collection of short
  stories is the one that makes a second project. The act is right and the
  sentence was missing — `projectUntouched` is **`seedOnly`'s shape** (addendum
  28 §4d), identifying a project by **what has happened to it rather than by
  what it is called**, every name here being the program's or the writer's and
  neither saying whether work has begun (one unit, nothing written, nothing
  filed, no division, no plan; any one of them makes it somebody's project, so
  nothing anybody made is caught by it, and it un-hides itself the moment a
  word is typed) — and where it holds the chooser says so **in the writer's own
  words** and **points at the row rather than being a second one**: *“Dylan's
  Tales” has nothing in it yet. This makes a second project beside it — the
  rows under* Into this project *fill the one you have*, a **route and only
  where the route exists** (addendum 10 §8), silent where there is no such row.
  What it still costs is **said rather than hidden**: pressing the new-project
  row anyway gives `Dylan's Tales.vcw` and `Dylan's Tales 2.vcw` with the
  second the real one, `freeName` keeping them apart because **nothing already
  in the folder is replaced** (addendum 34), and the empty one is the writer's
  to delete. Filling the open project from a row standing under *A new project*
  was **weighed and refused**: the heading's own sentence promises a file of its
  own, and one press that does two different things depending on hidden state is
  what this room removes rather than adds.
  **§11 is the numerals, and a name typed once**, from Ken in the same message
  (*I merged two sections and made it one chapter. I would like it to
  automatically update the title headings if they're Roman numerals… if you
  rename it in the chapter portion, it should rename that heading also*). A
  story imported from a manuscript is divided at its numerals (addendum 21
  §10) and those numerals arrive as **heading elements in the writing**, which
  is right — they are what the document said — and the cost is that the book
  holds a stored copy of something derived, with the unit's title and the
  heading it opens with two strings nothing kept in step. `section-numbers.ts`
  is two rules. **A bare numeral is the program's counting and is kept in
  step**, and nothing else is: a heading with words in it is the writer's, and
  renumbering *The Lighthouse* would be this program rewriting somebody's
  manuscript, which Layout's own rule forbids outright. The style is **read
  back off what is there** (roman or arabic, capitals or not, the stop or not),
  the count **restarts at each division** — `divisionSpan`'s rule over units, so
  chapter one of the second story is chapter one — and it runs at the two acts
  that change how many chapters a division has rather than as a command,
  *automatically* being the ask. **A name is typed once**: renaming a chapter
  renames the heading it opens with **where the two were saying the same
  thing**, leaves a heading the writer made differ alone, and does nothing
  where a unit has no heading (§9l already stands the title in); it lives in
  `updateUnit` beside `retitlePlans` for that function's own stated reason —
  *rename it in either place and it is renamed in both* — so every surface gets
  it without being told. `sectionLabel` is named that because `labelFor` is the
  Writers Room's, the **sixth** name stepped around and the second the compiler
  caught rather than a reader. Driven: the chapter's Title in the Inspector read
  *The Harbour*, typing *The Lighthouse* changed the heading in the manuscript
  beside it, and the chapters headed I, II and III were untouched.
  **§12 is the recovery points the preview did not keep**, from Ken after §10
  (*do the preview saved snapshots*) — §10's own named gap, and addendum 09
  §15's shape a third time in its worst instance: not a feature reading as
  unbuilt but **the safety net not being there** on the one build he uses.
  **The caller was asking all along**, `useProject` having set `snapshot: true`
  every twentieth save since autosave was written while the bridge took the
  flag and did nothing with it. The moment there are two hosts keeping copies,
  **which may be thrown away has to live in one place** — the only part of this
  whose mistakes are invisible until somebody wants the copy that is gone — so
  `snapshots.ts` holds `IRREPLACEABLE` (a pre-upgrade file and the state a
  merge overwrote exist nowhere else) and `snapshotsToDrop`, and the desktop's
  hand-written `pruneSnapshots` asks it with **its own suite unedited and
  green**, which is the proof the two agree. **What is not shared is how much
  room there is**: a disk shrugs at thirty copies and a browser's quota is
  shared with every other site, so the preview passes a **budget in bytes**,
  and **the newest is never dropped by it** — a copy too big for the whole
  budget is still the one a writer wants. `RecoveryReason` is named that
  because **`SnapshotReason` is taken** by `entities/revision.ts`, whose
  `snapshots` collection sits in every project document and which nothing has
  ever written (a recovery point being a copy beside a project rather than a
  row inside it), the **seventh** name stepped around. The preview keeps them
  in a second object store at **database version 2** — the upgrade adds a
  store and touches no project, pinned by seeding a version-1 database — and a
  point holds **the bytes rather than the object**, which is what the desktop
  keeps and what lets an older build's point be read by this one. Three rules
  carry the writing of one: **a recovery point must never cost somebody their
  save** (the quota may refuse at any moment, so it is tried, pruned against,
  tried once more, and then the project is saved and nothing is said — a notice
  about the net while the work landed being a fault report about something that
  did not fail), **pruning runs after the new point is in** (making room first
  drops a copy that is still the best there is if the write then fails), and
  **restoring is itself reversible**, what the writer has now being kept first.
  Two more one-liners: a point **before a format upgrade** rewrites anything,
  and **deleting a project takes its points**, keeping them making the row's
  own *this cannot be undone in a browser* untrue and leaving copies nothing
  could reach. `describeRecoveryPoints` is **one copy of the promise read off
  the path** (`describePhoneShelf`'s rule): on a disk they sit beside the
  project, and in a browser **they are in that browser**, clearing the site's
  data taking them — addendum 29 §1's `browser://` said rather than hidden.
  **And looking at it caught the other half**: the page opened on *Overwritten
  by a sync — nothing has been overwritten*, a heading above the thing the
  writer came for on a host that has no sync and never will; absent there now
  and kept on the desktop. Driven in the real preview: a save asking for a
  point leaves *Autosave · 7 KB*, and **Restore** brought *The Lamp* and its
  logline back from a document that had been wrecked and saved over, with the
  wrecked state then on the list and restorable in turn. **Still not done and
  named**: the preview keeps no copy **off this machine** — a browser's storage
  is one a writer can clear and a private window never had, *Download .vcw*
  being the only copy that leaves it and a press somebody has to remember.
  `addendum-34-project-folder.md` is **where new projects go**, from Ken (*when
  creating your project, there needs to be on that page the ability to set that
  file location and it'll save it in a file or a cloud drive and remember where
  it is. So when you open VC Writer, that it'll be able to find that
  location*), and the audit paid a **twenty-ninth** time with the half that
  makes the report worth reading properly: **the question was always asked** —
  creating a project has opened a save dialog since the application was
  written, written where the writer said and put the file on the recent list.
  So what is new is not a mechanism but **three things wrong about where the
  question is asked**: it is **not on the page** (the dialog opens after Create
  is pressed, over a panel that never mentioned where anything goes, so the
  folder could be set and never seen — §9's own shape in another room), it was
  **never remembered** (the default was `Documents/VC Writer` every time, so
  saving into Dropbox once left the next project still opening at Documents —
  the clause of his sentence with nothing behind it), and **Open started
  nowhere** (`project:open` passed no `defaultPath` at all, which is his last
  sentence word for word). **A cloud drive is a folder**: iCloud Drive,
  Dropbox, OneDrive and Google Drive each appear as an ordinary directory, so
  this needs no account and no API, and saying so on the screen is both the
  truth and the whole feature. **The folder is the machine's** — a fact about
  this computer rather than the document, so it lives beside the recents in
  `userData` and never in a project file — and **it is remembered by being
  used**: creating a project somewhere and saving one somewhere both say where
  this writer keeps their work, while *opening* one does not, a colleague's
  file read out of Downloads not being a reason to move where your own books
  are written. **One question asked once**, so the save dialog on Create is
  **gone** (two controls for one act are two answers, and the one removed is
  the one that appeared over a screen that had not mentioned it), the file
  named through `suggestedFileName` which the create handler had been
  duplicating with a private regular expression. **Nothing already in the
  folder is replaced**, the one rule here a writer would not forgive being
  wrong once, and the audit paid again inside it — the browser's library has
  numbered its own keys that way since it was written, so `freeName` is **one
  reading both hosts ask**. The row stands **between the format and the
  button**, which is addendum 30 §2a read properly rather than broken: nothing
  that is *not part of making the project* may stand there, and where it is
  written is part of making it. **Three states and the third is the one that
  matters** — the path with a *Change…* press; *This browser’s own storage*
  with the reason and **no press**; and **no row at all** where the host cannot
  answer, which is not defensive habit but a fault driving found: two existing
  fixtures stub the bridge without the method and the first draft **blanked the
  whole Welcome screen** on them (addendum 25 §4g — an effect that throws takes
  the screen down), on the one screen that is somebody's only way into their
  work, so they now pass by drawing nothing rather than by an edited test.
  **`ProjectHome` was taken** by addendum 17's project home page — the fifth
  name stepped around after `origin`→`found`, `Standing`→`Situation`,
  `code`→`discount` and `LAPSE_PROMISE`, and **the first caught by the
  compiler**: a clashing *type* is refused at the door where addendum 32 §7's
  clashing *value* through a star export compiled, passed 2,666 tests and
  returned a 500. Driven at 1440×900 on both hosts: the desktop row at 630×101
  with the folder in full, *Change…* taking it to an iCloud Drive path; the
  preview saying what it does with nothing to press; nothing past the panel
  either side (row edge 1035 inside 1056) and a long path **breaking rather
  than truncating**. Looking at it caught what no test did — the path drew in
  `--muted` inherited from the recents list, where **here the path is the
  value** rather than an annotation beside a file name, so `.path` is the
  general rule now and the row reads it at the body colour. §8 names what is
  deliberately absent: **no cloud account and no second kind of location**, the
  day this program grows its own idea of a cloud drive being the day there are
  two answers to where a book is.

## Before pushing

    cd packages/domain && pnpm typecheck && pnpm test && pnpm build
    cd apps/desktop   && pnpm typecheck && pnpm test && pnpm build
    cd apps/web       && pnpm typecheck
    cd apps/mobile    && pnpm typecheck && pnpm test

Screenshot the real thing when the change is visual: build the renderer,
serve `apps/desktop/out/renderer`, and drive it in Chromium with the preload
bridge stubbed. Looking at it catches what tests do not.

## Conventions

- Develop on `claude/vc-writer-dev-spec-ymc7zy`. Push to `main` only when
  Ken says so.
- The beat's internal title is authoring metadata and never enters the
  manuscript (spec §5.3, §19).
- The writing rules follow Final Draft: Return starts the next line in the
  continuing style, Tab re-types the line you are on.
