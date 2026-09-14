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
  reads like it does. Applied through 0046.
- `docs/spec/` — the master spec and `addendum-02-workspace.md`, which
  describes the workspace as built. Keep it current with the code. Its **§12a**
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
  **Scenes … to …** pair in the map's bar: a lane is a *subplot* and a range is a
  *stretch of the script*, so *who is in act two* is a question the lane cannot
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
  timeline lane is **a row per payoff** rather than one row of everything: rings
  for the setups, a diamond for the payoff, a rule between them so the gap is
  what you see, and a point that falls after drawn dashed and red where it
  actually is. No migration — an `excerpt` on each point and `minimumSetups` on
  the record live in the project document.
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
