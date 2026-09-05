# Roadmap

The eight phases from specification §16, with what exists today.

## Phase 1 — Foundation ▸ in progress

| Deliverable | Status |
| --- | --- |
| Repo architecture | Done — pnpm workspace, shared tsconfig, CI |
| Shared data model | Done — `packages/domain`, 26 unit tests |
| Supabase schema and auth | Done — migrations 0001–0005, RLS on every table, applied to the hosted project |
| Project CRUD | Done — create, open, recents, atomic save |
| Desktop shell | Done — Electron main/preload/renderer, structure board, beat workspace |
| Windows/macOS build pipeline | Done — electron-builder config, CI matrix; signing credentials outstanding |
| Autosave and recovery | Done — interval flush, content-hash skip, rolling snapshots, pre-migration snapshot |
| Web store shell | Done — marketing, platform picker, sign-in, account downloads |

Remaining before Phase 1 closes: code-signing certificates for both platforms,
the first published release build, and the desktop ↔ Supabase project sync
(the schema is ready; the client writes to the local file only).

## Phase 2 — Story structure ▸ built

| Deliverable | Status |
| --- | --- |
| Lanes, scene/chapter containers, beats | Done — nested board, collapse/expand, inline rename, cascading removal |
| Drag-reorder | Done — beats, containers and lanes, with edge drop indicators; keyboard equivalents for beats |
| Research categories | Done — create, rename, reorder, archive and restore |
| Used / unused workflow | Done — filter tabs, mark used against the open beat, restore, unconfirmed suggestions flagged |
| Setups and payoffs | Done — many setups per payoff, place a setup in the open beat, record payoff, reopen, archive |
| Links | Done — collapsible related-elements panel on the beat workspace; endpoints resolve at render time |

Remaining before Phase 2 closes: drag-reorder for research notes and
categories (they move by buttons and a category picker today), a
related-elements panel on scenes and characters as well as beats, and
lane-level story-order views such as a timeline across lanes.

## Phase 3 — Writing ▸ built

| Deliverable | Status |
| --- | --- |
| Screenplay and novel workspaces | Done — elements laid out at the real page geometry, Return/Tab element flow, character-cue completion |
| Beat-to-manuscript mapping | Done — a beat owns its elements; the internal title stays out of the manuscript |
| Focus mode | Done — Ctrl/Cmd+Shift+F, Escape to leave |
| Print preview | Done — renders the paginated pages themselves, so preview and export break pages identically |
| PDF export | Done — Chromium print-to-PDF in the main process from a re-validated project |
| Page layout engine | Done — 55-line screenplay pages at 60 characters, (MORE)/(CONT'D) dialogue splits, no stranded scene headings; 25-line double-spaced prose |

Remaining before Phase 3 closes: the export path needs a run on real hardware
(it cannot execute in a headless container), a title-page editor for the
credits block beyond title and author, and export formats beyond PDF —
Final Draft `.fdx` and Fountain are the obvious next two, and both are
renderers over the same element list.

## Phase 4 — Notes and sync

Mobile companion, typed and dictated capture, categorisation, approval queue,
project sync, offline-tolerant capture.

`capture_items` and the `CaptureItem` model are ready, including the confidence
and confirmation fields that keep AI classification a proposal.

## Phase 5 — Editor and voice

Daily Editor, Final Editor framework, speech-to-text, text-to-speech voices,
per-character voice assignment and playback.

`VoiceAssignment` and `speechSegmentsForUnit` already resolve a scene into
per-character speech segments; the provider adapter and the editors are the
work.

## Phase 6 — Commerce

Vercel store and account, Stripe checkout and webhooks, entitlements and
licenses, Resend email, Windows/Mac selection, secure downloads.

Built. What remains is configuration: live Stripe keys and price, the webhook
endpoint registered with Stripe, a verified Resend sending domain.

## Phase 7 — Release operations

Signed Windows installer, signed and notarised Mac build, update and release
metadata, re-download portal, activation management, telemetry and support
tooling.

The release catalogue, download authorisation and the packaging workflow exist.
Signing, notarisation, the in-app updater and device activation management are
outstanding.

## Phase 8 — Hardening

Cross-platform QA, performance, sync conflicts, backup and recovery, security
review, accessibility, release readiness.
