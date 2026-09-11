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
  part of the change, not afterwards.
- `docs/spec/` — the master spec and `addendum-02-workspace.md`, which
  describes the workspace as built. Keep it current with the code.
  `addendum-03-story-sculptor.md` is the Story Sculptor node canvas: stages
  1–7 (the board and its two nodes, the structure column, the layout rule
  with scenes, beats, the columns the writer defines, binding a node to a real
  scene, and the writer's own labelled connections) are built — §16 says what
  they do — and §14.4 lists what is left: folding, focus, filters, search and
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
  merge. **Specified; stage 0 built.** §1 and §2 are the rules it all hangs
  off — one writer's work is never destroyed by another's, and a collaborator
  gets the whole program rather than a web editor. §3 says how much of it the
  product already has (the Room is `/preview` grown up; membership widens
  `owns_project` rather than adding a second set of policies; several writers
  side by side is the pane windowing that exists). §4 is stage 0, now built:
  boards and outlines sync, nested in the document and flat in the database,
  with `planParts`/`withPlanParts` in `sync-mapping.ts` the one place that
  knows the difference. §15 is the build order.
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
