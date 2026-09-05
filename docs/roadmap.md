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

## Phase 2 — Story structure

Research categories, lanes, scene/chapter containers, beats, drag-reorder,
links, setups/payoffs, used/unused workflow.

The model, the ordering primitives and the database tables are all in place.
This phase is the interaction work: drag and drop, the related-elements panel,
the research browser, the setups/payoffs board and the used bin.

## Phase 3 — Writing

Screenplay and novel writing workspaces, beat-to-manuscript mapping, focus
mode, print preview, PDF export.

The manuscript element list and the renderer exist; the screenplay pagination
engine, element cycling on Tab/Enter and the PDF exporter do not.

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
