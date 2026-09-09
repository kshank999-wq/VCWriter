# Deployment and service wiring

The live services for VC Writer, and exactly what has to be set where.

## Services

| Service | Resource | Identifier |
| --- | --- | --- |
| Supabase | Project `VCWriter`, region `us-west-2` | `kpviyoqhmzignjyvixws` |
| Supabase | API URL | `https://kpviyoqhmzignjyvixws.supabase.co` |
| GitHub | Repository | `kshank999-wq/VCWriter` |
| Vercel | Team | `kshank999-5979's projects` |
| Domain | Production site | `vc-writer.com` |

## Supabase — done

Migrations `0001`–`0005` are applied to the hosted project. That covers every
table, enum, index, trigger and row level security policy, the auth → profile
bootstrap, the three private storage buckets and the database-linter hardening.

To apply future migrations:

```bash
supabase link --project-ref kpviyoqhmzignjyvixws
supabase db push
```

Two linter findings are intentional and expected to stay:

- `email_events` and `stripe_webhook_events` have RLS enabled with no policies.
  They are written and read only by the service role from server-side handlers,
  so no client role can reach them at all.
- `owns_project` is a `SECURITY DEFINER` function executable by `authenticated`.
  Every story table's RLS policy calls it as the invoking role, so it must be.
  It answers only "does the caller own this project id"; `anon` and `public`
  have been revoked.

## Vercel

**Live at https://vc-writer.com** since 7 September 2026, from `main`.

One project, in team `kshank999-5979` (`team_u7MT4rqOzxUsxMI5gdYsbVN0`):

| | |
| --- | --- |
| Project | `vcwriter` — `prj_z0vZdzTLvCSKneSNuhT17KnOC8Cq` |
| Framework | Next.js, Root Directory `apps/web` |
| Production branch | `main` |
| Domains | `vc-writer.com`, `www.vc-writer.com` (registered and DNS-managed in Vercel), plus `vcwriter.vercel.app` |

Every push to `main` deploys. CI (`.github/workflows/ci.yml`) runs the full
suite on the same push; Vercel does not wait for it, so a red CI run is the
signal to look at, not a failed deploy. Pushes to other branches get preview
deployments at `vcwriter-git-<branch>-kshank999-5979s-projects.vercel.app`.

### How it got here — the two things that went wrong

Recorded because both are the kind of mistake that recurs.

**Three projects were wired to one repository.** Connecting the repo from
the Vercel dashboard created extra projects along the way: `desktop`, set to
the Vite preset and aimed at `apps/desktop`, and `vc-writer`, with no
framework detected. `desktop` was the source of the very first failure —
"No Output Directory named `dist`" — because `dist` is Vite's default output
and `apps/desktop` is an Electron application, which cannot be a website at
all. Neither project contained any code; a Vercel project is a set of build
settings pointing at a repository. Both were deleted on 7 September. If a
future push fires more than one build, this has happened again.

**A variable's name was pasted in as its value.** With Root Directory
correct and the workspace install working, `next build` compiled cleanly and
then died collecting page data:

```
TypeError: Invalid URL
  code: 'ERR_INVALID_URL',
  input: 'NEXT_PUBLIC_SITE_URL'
```

`app/layout.tsx` builds `metadataBase: new URL(env.siteUrl)` at module
scope, so that one value took down every page. `env.siteUrl` now refuses
anything that is not an absolute http(s) URL, warns naming the variable,
and falls back to `https://vc-writer.com` (`apps/web/src/lib/env.ts`,
tested in `src/lib/__tests__/env.test.ts`). A typo in a dashboard can no
longer fail a build.

The shape matters more than the instance: only this variable fails loudly
at build time. `STRIPE_SECRET_KEY` or `RESEND_API_KEY` filled in the same
way would deploy green and fail at the first purchase. When something works
in the build and fails in use, check the *values*.

### On reading the project from the connector

Pass the **team slug** (`kshank999-5979`) to the Vercel connector's
project-listing endpoint, not the team id. The id returned a partial list
that omitted this repository's projects entirely, which looked like a
permissions problem and was not.

### Browser preview

The desktop application's interface is also served at
**https://vc-writer.com/preview**, for administrators only, so a change
pushed to `main` can be tried at the next refresh instead of after a
download and an install. It is the same renderer the desktop runs, built by
plain Vite (`apps/desktop/vite.preview.config.ts`) with a bridge that keeps
projects in the browser's IndexedDB (`src/renderer/browser-bridge.ts`)
instead of on disk. The site's `prebuild` script (`scripts/build-preview.mjs`)
builds it and copies it under `public/preview/`, which is git-ignored.

What it is for: seeing and using the interface. What it is not: the product.
There is no cloud, no licence, no updater, and PDF export is the browser's
print dialog. **Download .vcw** on the strip at the bottom left saves the
open project as a file the desktop application opens; **Open a project
file…** on the welcome screen imports one.

Access is decided in `src/middleware.ts` from the signed-in user's
`profiles.is_admin`, the same flag the admin console uses; anyone else is
sent to sign in. The page carries its own content security policy (a Vite
bundle has no nonce to carry) and `Cache-Control: no-store`, so a refresh is
always the newest deployment. The gate refreshes the session cookie, or a
preview session expires while it is being used and never renews itself.

**The gate is on the page, not on the bundle's files.** They are
content-hashed artifacts of code that ships in the installer anyway, their
names are only knowable from the page, and gating them cost two round trips
to Supabase per chunk. Worse, a chunk fetched *late* — the PDF reader is
imported at the moment Import is clicked, which may be an hour after the
page loaded — was redirected to the sign-in page as soon as the token
expired, and a dynamic import handed an HTML document fails with "Failed to
fetch dynamically imported module". Being ungated, they are also cached
`immutable`, which the page cannot be.

### Settings that must stay as they are

- Root Directory `apps/web`, with "include files outside the root
  directory" enabled — the build needs the workspace root so `pnpm install`
  can link and compile `@vcwriter/domain`. `apps/web/vercel.json` pins the
  framework to Next.js so the preset cannot be misdetected.
- The repository-root `vercel.json` deliberately fails any build that runs
  from the root, printing what to fix. It is only read when Root Directory
  is unset, so a healthy project never sees it.
- Optional: `ELECTRON_SKIP_BINARY_DOWNLOAD=1` in the environment — the
  workspace install pulls the Electron binary otherwise, which the site
  never uses.

Environment variables, all environments unless noted. **On key names:** the
Supabase dashboard now issues `sb_publishable_…` and `sb_secret_…` keys in
place of the old `anon` and `service_role` JWTs. They are the same two roles
under new names and supabase-js accepts them unchanged, so they go into the
same two variables below. (The old JWT keys still exist under API Keys →
"Legacy API keys" and also work; prefer the new ones.)

| Variable | Value / source | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kpviyoqhmzignjyvixws.supabase.co` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → the `sb_publishable_…` key | Public; bound by RLS. Supabase renamed "anon" to "publishable"; same role, same variable |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → the `sb_secret_…` key (eye icon to reveal) | **Secret.** Bypasses RLS. Server only. Supabase renamed "service_role" to "secret"; same role, same variable |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys | **Secret** |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → the vc-writer.com endpoint | **Secret**. Different per environment |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → API keys | Public |
| `STRIPE_PRICE_ID_DESKTOP` | Stripe → Products → VC Writer Desktop | The server-chosen price |
| `RESEND_API_KEY` | Resend → API keys | **Secret** |
| `ANTHROPIC_API_KEY` | Anthropic Console | **Secret.** Absent means the Final Editor's AI read returns 503 and its deterministic pass still works |
| `RESEND_FROM_ADDRESS` | `VC Writer <noreply@vc-writer.com>` | Needs a verified domain |
| `RELEASE_BUCKET` | `releases` | |
| `RELEASE_DOWNLOAD_TTL_SECONDS` | `900` | Signed installer URL lifetime |
| `NEXT_PUBLIC_SITE_URL` | `https://vc-writer.com` (preview: the preview URL) | Used for Stripe return URLs and auth redirects. Must include the scheme; a value that is not an absolute http(s) URL is warned about and ignored |

With the Vercel CLI instead of the dashboard:

```bash
vercel link                                  # from apps/web
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# …one per variable, per environment
```

## Domain — vc-writer.com — done

Attached to `vcwriter` on 7 September 2026. The domain is registered in
Vercel and Vercel manages its DNS, so there were no records to add by hand;
both `vc-writer.com` and `www.vc-writer.com` resolve to Vercel's edge and
`www` redirects to the apex. `NEXT_PUBLIC_SITE_URL` is
`https://vc-writer.com` in Production.

If the domain ever needs re-attaching: the project → Settings → Domains →
Add. Nothing else.

## Stripe

1. Create the product and price; put the price id in `STRIPE_PRICE_ID_DESKTOP`.
2. Add a webhook endpoint at `https://vc-writer.com/api/stripe/webhook`
   subscribed to `checkout.session.completed`, `charge.refunded` and
   `charge.dispute.created`.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

Also switch on **Stripe Tax** in the dashboard: checkout already sends
`automatic_tax`, but it only applies once the account has tax registrations
configured.

Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

The endpoint is safe to retry — it verifies the signature, claims the event id
and relies on unique constraints — so redelivering an event from the Stripe
dashboard is a valid way to test it.

## Resend

Verify `vc-writer.com` as a sending domain (Resend supplies the DKIM/SPF
records), then set `RESEND_API_KEY` and `RESEND_FROM_ADDRESS`. Purchase mail
failing is logged to `email_events` and never fails the purchase, so a
misconfigured sending domain shows up there rather than as a broken checkout.

## Supabase auth redirect URLs — done

Set on 7 September 2026 under Supabase → Authentication → URL configuration:

- Site URL: `https://vc-writer.com`
- Redirect allow list: `https://vc-writer.com/auth/callback`

These are the address of a page on *this* site, told to Supabase so a
sign-in link is permitted to send the user back there. They are typed into
that form; they are not pages on supabase.com. Worth adding when local
development starts: `http://localhost:3000/auth/callback`. This setting is
not readable through the Supabase connector, so a future session cannot
confirm it — a sign-in email that lands on `localhost` is the symptom of it
having been lost.

## Making yourself an administrator

Release management at `/admin/releases` is gated on a flag that signup never
grants. After signing in once so the account exists, set it in the Supabase SQL
editor:

```sql
update public.profiles
set is_admin = true
where lower(email) = lower('you@example.com');
```

Revoking it is the same statement with `false`, and takes effect on the next
request — the flag is checked per request rather than carried in a token.

## Release artifacts

`.github/workflows/desktop-release.yml` packages Windows and macOS on a `v*`
tag. Signing needs these repository secrets:

| Secret | Purpose |
| --- | --- |
| `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD` | Authenticode signing |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | Apple signing and notarisation |

Publishing a build is deliberately a separate step from packaging it: upload
the artifact to the private `releases` bucket, insert a `release_builds` row
for that platform with the object key and checksum, then set `active`. Only
then can customers download it — and only through a signed URL minted after an
entitlement check.

## Credential hygiene

No credential belongs in this repository, including in `.env.example`. The
Drive document `VC Writer / VCWriter passwords & api keys.docx` holds the
project's secrets; treat it as the source and copy values into Vercel, GitHub
and Supabase settings directly. If a key in it has ever been pasted somewhere
public, rotate it rather than reusing it.
