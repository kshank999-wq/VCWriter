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
  reads like it does. Applied through 0050.
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
  stored. What is left is Writers Room. §8, the export as an outline, is **withdrawn**
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
  worked out first, then put on the track. **Stage 0 is built; stages 1–5 of
  §9 are not** — §12 fills a stage at a time, and stage 0's entry is there:
  the × off every row, **Delete** and **Add to track** on the toolbar acting
  on the selection, and an ask that says what goes (`whatGoesWithRows`,
  `rowsRemovalQuestion`, `rowsRemovalComfort` in `outline.ts`) with *Just
  unbind it* offered when a chosen row is already in the book. Building it
  found three more §6c survivors in the Outliner's panel (*in the script* on a
  book) and a *1 rows* tally. §1 is the audit and it paid a
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
