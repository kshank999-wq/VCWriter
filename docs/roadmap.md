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

## Phase 4 — Notes and sync ▸ built

| Deliverable | Status |
| --- | --- |
| Mobile companion | Done — VC Writer Notes, an installable web app at `/notes`, works on iOS and Android with no app store |
| Typed and dictated capture | Done — browser speech API where it exists; the interface says to use the keyboard mic where it does not |
| Offline-tolerant capture | Done — IndexedDB first, send second; nothing leaves the queue until the server acknowledges it |
| Categorisation | Done — the writer picks a destination on the phone, stored separately from any classifier guess |
| Approval queue | Done — desktop review with a suggested destination, Approve / Later / Discard, raw capture always kept |
| Project sync | Done — pull, merge, push, with per-record rules and named conflicts |
| Desktop sign-in | Done — six-digit email code, session encrypted with the OS keychain |

Remaining before Phase 4 closes: no AI classifier is wired up yet, so
`inference` is always empty and every capture arrives with the writer's own
choice — the approval queue already handles both. Audio is not uploaded (the
`captures` bucket exists but dictation is transcribed on the device). The
sync and sign-in paths need a run on real hardware; the merge logic is tested,
the Supabase round trip is not.

## Phase 5 — Editor and voice ▸ built

| Deliverable | Status |
| --- | --- |
| Daily Editor | Done — mechanics, readability and habit checks, deterministic and offline, with per-finding Fix and Dismiss |
| Final Editor | Done — per-scene page geometry, cast and shape, plus structural findings; the AI pass adds the reading of whether a scene turns |
| AI structural read | Done — runs on vc-writer.com behind a license check, never in the installed application |
| Text-to-speech voices | Done — system voices, described where known, unknown where not |
| Per-character assignment and playback | Done — a scene plays as a conversation, "Suggest a cast" fills an unvoiced cast |
| Speech-to-text | Partial — real in VC Writer Notes on a phone; on the desktop the workspace points at system dictation, because Electron ships no working speech-recognition API |

Remaining before Phase 5 closes: no capture classifier is wired up yet (the
approval queue handles its absence), the AI pass has never run against the
live API from this environment, and read-back has no pause/resume or
line-level navigation — only play and stop.

## Phase 6 — Commerce ▸ built

| Deliverable | Status |
| --- | --- |
| Store and account | Done — price read from Stripe, platform picker, purchase history, downloads, "email me my license again" |
| Stripe checkout and webhooks | Done — server-chosen price, Stripe Tax, idempotent fulfillment with the money path under test |
| Entitlements and licenses | Done — revocation on refund, platform entitlement honoured, device slots freed by deactivation |
| Resend email | Done — templates in their own versioned module, version recorded with each delivery |
| Windows/Mac selection | Done — recorded on the order without restricting the license |
| Secure downloads | Done — license re-checked per request, short-lived signed URLs |
| Release administration | Done — `/admin/releases`, direct-to-storage installer upload, activate/retire per platform and channel |

Remaining before Phase 6 closes: configuration rather than code — live Stripe
keys and a price, the webhook endpoint registered with Stripe, Stripe Tax
switched on in the dashboard, a verified Resend sending domain, and
`is_admin` set on the first administrator's profile row.

## Phase 7 — Release operations ▸ built, minus the certificates

| Deliverable | Status |
| --- | --- |
| Update and release metadata | Done — release catalogue, admin publishing, checksums computed in CI |
| In-app updater | Done — checks, refuses a build the OS cannot run, downloads through the entitlement check, verifies the checksum, discards a mismatch |
| Re-download portal | Done — My Account, signed URLs per request |
| Activation management | Done — activate, reclaim a seat, free a seat yourself, all rules tested |
| Support tooling | Done — `/admin/support`: licenses, devices, orders, email delivery, and the actions for each |
| Error reporting | Done — opt-in, off by default; paths and addresses redacted on both sides; grouped triage at `/admin/errors` |
| Signed Windows installer | Blocked — needs a certificate that must be bought against a verified identity |
| Signed and notarised Mac build | Blocked — needs an Apple Developer membership and a Developer ID certificate |

The pipeline expects both sets of credentials, uses them when present, and
produces a clearly-marked unsigned build when they are absent. The runbook for
obtaining and wiring them is [docs/code-signing.md](code-signing.md).

Error reporting (§14) is built as a privacy decision before a diagnostics one.
It is off until the writer turns it on, the report has no field for manuscript
content and the table has no column for one, and file paths, URLs and email
addresses are stripped from the message and the stack — by the desktop before
sending and by the route again on arrival, because an older build with a weaker
redactor should not be able to write a path into the database. Stack frames
survive redaction, so triage still gets function names and line numbers.
`/admin/errors` groups reports by failure rather than listing them, since the
useful question is what is breaking and for how many people.

Remaining before Phase 7 closes: the certificates themselves, and one
end-to-end run on real hardware (purchase → download → install → activate →
update).

## Phase 8 — Hardening

Cross-platform QA, performance, sync conflicts, backup and recovery, security
review, accessibility, release readiness.
