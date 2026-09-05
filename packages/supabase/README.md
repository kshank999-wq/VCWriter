# @vcwriter/supabase

Database schema, row level security policies and storage layout for VC Writer.

## Layout

| Migration | Contents |
| --- | --- |
| `0001_core_story_schema.sql` | Accounts, projects, lanes → scene/chapter units → beats, research, characters, story links, setups/payoffs, snapshots |
| `0002_commerce_and_releases.sql` | Orders, licenses, release builds, device activations, Stripe webhook log, email events |
| `0003_capture_and_sync.sql` | VC Writer Notes capture queue |

## Rules this schema enforces

- `beats.unit_id` is `NOT NULL` — a beat cannot exist outside a scene/chapter
  container (spec §19).
- `licenses.order_id` is `UNIQUE` — a retried Stripe webhook cannot mint a
  second license for one purchase (spec §17).
- One `active` release build per platform/channel, so "current build" is
  unambiguous and publishing a Windows build never disturbs the Mac artifact.
- Every story table is behind row level security keyed to project ownership.
  Commerce tables are read-only to customers and written only by the service
  role from server-side handlers.

## Storage buckets

| Bucket | Access | Contents |
| --- | --- | --- |
| `releases` | private | Signed Windows/macOS installers. Served only as short-lived signed URLs after an entitlement check. |
| `project-assets` | private | Poster/key art and other per-project uploads. |
| `captures` | private | Audio from VC Writer Notes voice capture. |

## Local development

```bash
supabase start          # local stack
supabase db reset       # apply every migration from scratch
supabase db push        # apply pending migrations to the linked project
```

## Applying to the hosted project

Migrations are applied through the Supabase CLI (`supabase db push`) or the
dashboard SQL editor, in filename order. Never edit an applied migration —
add a new one.
