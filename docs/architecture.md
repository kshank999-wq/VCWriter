# Architecture

## The shape of the system

```
                    ┌──────────────────────────┐
                    │   packages/domain        │
                    │   story model, project   │
                    │   file format, rules     │
                    └───────────┬──────────────┘
                 ┌──────────────┼───────────────┐
                 │              │               │
     ┌───────────▼───┐  ┌───────▼──────┐  ┌─────▼──────────┐
     │ apps/desktop  │  │  apps/web    │  │ VC Writer Notes│
     │ Electron      │  │  Next.js /   │  │ (mobile, later)│
     │ Win + macOS   │  │  Vercel      │  │                │
     └───────┬───────┘  └───────┬──────┘  └─────┬──────────┘
             │                  │               │
             └──────────┬───────┴───────────────┘
                        │
              ┌─────────▼──────────┐
              │ Supabase           │
              │ Postgres + RLS     │
              │ auth, storage      │
              └────────────────────┘
```

Spec §14 asks for one shared domain model rather than a product-logic fork per
platform. `packages/domain` is that model: it owns the entities, the rules that
must hold about them, the project document format and its migrations. Every
other package is a delivery surface over it.

## Why the boundaries sit where they do

### The domain package holds rules, not just types

It would have been cheaper to declare a handful of interfaces and let each app
enforce the specification's rules its own way. That is exactly how a beat ends
up floating in a lane on mobile and nested under a scene on desktop. So the
rules live in one place and are expressed as code that cannot be bypassed:

- `Beat.unitId` is a required, branded id — the type system rejects a beat with
  no container, and `addBeat` refuses a container that does not exist.
- Rendering is a function of the manuscript element list. `renderBeat` emits the
  internal beat title only when `includeBeatTitles` is passed, so "the label is
  not manuscript text" is enforced at the one place text is produced.
- `markResearchUsed` and `restoreResearchItem` are inverses. Nothing deletes.

### The project document is the unit of portability

A VC Writer project is one JSON document validated by a schema, carrying a
`formatVersion` and an explicit migration chain. That is what makes §3.1's
promise — a project created on Windows opens on macOS — a property of the
format rather than a hope about two codebases. Loading a file from a *newer*
build fails with a message telling the writer to update, because dropping
fields the reader does not understand is data loss.

The same shape maps onto Supabase rows for sync, so the desktop's local file
and the cloud copy are not two different models.

### Ordering is fractional, not positional

Lanes, scenes, chapters and beats are reordered constantly. An integer
`position` column means a drag rewrites every sibling, which is slow, noisy in
version control, and hostile to the optimistic local editing and sync merge
that §14 requires. Every ordered row instead carries an `orderKey` string, and
inserting between two neighbours writes only the row that moved. See
[`ordering.ts`](../packages/domain/src/ordering.ts).

### The renderer is untrusted

The Electron window runs with context isolation on, node integration off, and a
preload script that exposes a fixed list of typed channels — no generic
`invoke(channel, …)`. All file system access is in the main process, and any
document arriving from the renderer is re-validated before it is written. The
renderer is where third-party UI code and, later, AI provider responses live;
it should not be able to reach the disk directly.

### Entitlement is server-authoritative

Nothing about a purchase is decided by the client. `/api/checkout` starts a
Stripe session with a server-chosen price; the webhook is the only place a
license is created; `/api/downloads/[platform]` re-checks the license on every
request and returns a signed URL that expires in minutes. A leaked download
link is useless shortly after it leaks, and revoking a license takes effect on
the next click rather than whenever a cached URL happens to expire.

Idempotency is delegated to the database rather than to application logic:
`orders.stripe_checkout_session_id` and `licenses.order_id` are unique, so two
concurrent webhook retries collide in Postgres instead of racing.

## Provider abstractions

Spec §18 lists the decisions that must stay reversible. Each is behind data or
an interface rather than baked in:

| Decision | How it stays configurable |
| --- | --- |
| Text-to-speech vendor | `VoiceAssignment` stores `providerId` + `voiceId`; the manuscript never references a vendor |
| Speech-to-text / NLU | `CaptureItem.inference` records the proposal and the model that made it; the raw capture is retained |
| One purchase → both installers | `licenses.entitled_platforms` is data, not a rule in code |
| Minimum macOS version, installer formats | `release_builds.minimum_os_version` and electron-builder config |
| Export formats beyond PDF | Export is a renderer over the manuscript element list |

## What is deliberately not built yet

Phase 1 is the foundation. The screenplay pagination engine, the Daily and
Final editors, dictation, TTS playback, the mobile companion and the sync
merge are later phases — but each has its seat reserved in the model
(`ManuscriptElement`, `VoiceAssignment`, `CaptureItem`, `Snapshot`), so adding
them does not require a migration of anything already written.
