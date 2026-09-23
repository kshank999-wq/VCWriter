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
- `packages/supabase/migrations` — apply new ones to the live project as
  part of the change, not afterwards. The Supabase connector can do it from
  here; afterwards run the advisors (`get_advisors`, security **and**
  performance) and fix what they raise, because they catch what the SQL
  reads like it does. Applied through 0052.
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
  lines, and never leaves a letter alone at the foot of a page. **Index this…**
  is on the manuscript right-click beside the Character Creator's (§6), and
  **Editor ▸ Index…** opens the fourth tab of the Editors page (§7) — which
  shows the three things the printed index cannot: the *marks* under a heading
  rather than only its numbers, **orphans** (a mark whose passage was cut, kept
  and struck through rather than silently dropped), and renaming a heading
  everywhere at once. Absent rather than greyed on a screenplay, everywhere: a
  format with no index has no index, and a disabled control says *not yet*.
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
  blade. **The chapter openings got the same treatment**, from Ken
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
  `addendum-05-short-form.md` is the short-form module: the AV sheet in
  place of the Script, the storyboard on the timeline, playback, and the two
  documents it prints. **All eight stages are built** — §9 says what each one
  does.

## Before pushing

    cd packages/domain && pnpm typecheck && pnpm test && pnpm build
    cd apps/desktop   && pnpm typecheck && pnpm test && pnpm build
    cd apps/web       && pnpm typecheck

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
