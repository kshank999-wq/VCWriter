# VC Writer

Story development, research, outlining, drafting, editing and read-back for
screenwriters and novelists — a desktop application for Windows 10/11 and
macOS, a mobile capture companion, and the store that sells and delivers it.

Built from the [master development specification](docs/spec/vc-writer-master-development-spec.md)
(4 September 2026).

## Repository layout

| Package | What it is |
| --- | --- |
| [`packages/domain`](packages/domain) | The platform-neutral domain model. Story structure, research, links, setups/payoffs, manuscript elements, capture and commerce entities, plus the project file format and its migrations. Desktop, mobile and web all build on this one model. |
| [`packages/supabase`](packages/supabase) | Database schema, row level security policies and storage layout. |
| [`apps/desktop`](apps/desktop) | The Electron desktop application for Windows and macOS. |
| [`apps/web`](apps/web) | vc-writer.com — marketing, accounts, Stripe checkout, license delivery and installer downloads. Deployed on Vercel. |

## Getting started

```bash
pnpm install
pnpm -r build          # builds the domain package the apps depend on
pnpm dev:desktop       # Electron app with hot reload
pnpm dev:web           # vc-writer.com at http://localhost:3000
```

Copy `.env.example` to `apps/web/.env.local` and fill in the Supabase, Stripe
and Resend values. No credential belongs in the repository.

```bash
pnpm -r typecheck
pnpm -r test
```

## The rules this codebase keeps

These come straight from the specification and are enforced in code, in the
database, or both — not left to convention:

- **A beat lives inside a scene or chapter.** There is no API and no column
  that allows a beat to float loose in a plot lane (§19).
- **A beat's internal title is authoring metadata.** It renders only when a
  caller explicitly asks for an annotated reference copy, never in the
  delivered manuscript (§5.3, §6).
- **Story relationships are typed links between stable ids**, not text copied
  into several records, so an edit propagates everywhere (§7.4).
- **"Used" and "archived" are reversible states**, never deletes (§7.2, §7.3).
- **The project format is platform-neutral and versioned.** A project written
  on Windows opens on macOS; a file from a newer build is refused with an
  explanation rather than silently losing data (§3.1).
- **Entitlement is server-authoritative.** Licenses are created only by the
  Stripe webhook, and installers are handed out as short-lived signed URLs
  after an entitlement check — never a public URL (§12, §19).
- **A retried Stripe webhook cannot mint a second license.** Unique
  constraints, not application-level guesswork, make fulfillment idempotent
  (§17).

## Documentation

| Document | Contents |
| --- | --- |
| [Architecture](docs/architecture.md) | How the pieces fit, and why each boundary is where it is |
| [Roadmap](docs/roadmap.md) | The eight delivery phases and what is built so far |
| [Epics and user stories](docs/epics-and-user-stories.md) | The specification as deliverable work with acceptance criteria |
| [API contracts](docs/api-contracts.md) | HTTP endpoints and desktop IPC channels |
| [Deployment](docs/deployment.md) | Live services, environment variables, domain, Stripe and release wiring |
| [Decisions](docs/decisions) | Architecture decision records |
| [Master specification](docs/spec/vc-writer-master-development-spec.md) | The source document |
