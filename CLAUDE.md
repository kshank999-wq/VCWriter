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
  reads like it does. Applied through 0040.
- `docs/spec/` — the master spec and `addendum-02-workspace.md`, which
  describes the workspace as built. Keep it current with the code.
  `addendum-03-story-sculptor.md` is the Story Sculptor node canvas: stages
  1–7 (the board and its two nodes, the structure column, the layout rule
  with scenes, beats, the columns the writer defines, binding a node to a real
  scene, and the writer's own labelled connections) are built — §16 says what
  they do — plus the card revision: a card opens as a dialog with its notes and
  who is in it, the × asks before anything goes (`whatGoesWith` in
  `sculptor.ts` says what would), and the research shelf folds out from the
  left (§5, §9) — and §14.4 lists what is left: folding, focus, filters, search and
  a mini-map, then Writers Room. §8, the export as an outline, is **withdrawn**
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
  merge. **All twelve stages of §15 are built.** §20 names what §14 still describes and nobody has built: email notification, recurring seat billing, and a per-room AI spending cap. §1 and §2 are the rules it all hangs
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
  §19 says what each built stage does; §15 is the build order.
  `addendum-08-character-creator.md` is the Character Creator, the first module
  of the Research room, from Ken's own dev spec. **Stages 0–4 built** —
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
  screen (`CharacterCreator.tsx`, reached from **Build** beside somebody in the
  Characters folder): traits down the side and the *ways one of them gets shown*
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
  the item keeps the writer's reading and the pin keeps the page's words. §3
  says what already exists and is only being widened; §8 is the
  build order; §3.4 says why there is deliberately no module framework yet; §10
  says what each built stage does.
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
