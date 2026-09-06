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

## Vercel — needs a hand in the dashboard

**The site has never deployed.** Nothing built in this repository is live at
vc-writer.com until the steps below are done. This section records what was
actually found, because it is not what an earlier version of this document
said.

### Three projects point at this repository

Read on 6 September 2026, in team `kshank999-5979` (`team_u7MT4rqOzxUsxMI5gdYsbVN0`):

| Project | Id | Framework | Latest production deploy |
| --- | --- | --- | --- |
| `vcwriter` | `prj_z0vZdzTLvCSKneSNuhT17KnOC8Cq` | Next.js, root `apps/web` | ERROR |
| `vc-writer` | `prj_43SNHcINsBwiCthZ83DclRNEVJDG` | none detected | ERROR, no logs retained |
| `desktop` | `prj_hzQ7i8zM1KdWOLJyGF8n1TVdT7FR` | Vite, aimed at the Electron app | ERROR |

**Keep `vcwriter`. Delete the other two.** `desktop` is the source of the
"No Output Directory named `dist`" error that started this: `dist` is Vite's
default output, and `apps/desktop` is an Electron application that must never
be deployed to a web host. `vc-writer` has no framework detected and no build
that got far enough to log anything.

An earlier version of this section reported that the connector could create
projects but not read them back. That was wrong, and the cause was a query
mistake rather than a permissions one: passing the **team id** to the
project-listing endpoint returned a partial list (four of ten projects, none
of them this repository's), while passing the **team slug** `kshank999-5979`
returned all ten. Use the slug.

### Why the `vcwriter` build failed

Not a settings problem. That project's Root Directory is already `apps/web`,
the workspace install linked and compiled `@vcwriter/domain` through its
`prepare` script, Next.js 14.2.35 was detected, and `next build` compiled
successfully. It then died collecting page data:

```
TypeError: Invalid URL
  code: 'ERR_INVALID_URL',
  input: 'NEXT_PUBLIC_SITE_URL'
> Build error occurred
Error: Failed to collect page data for /_not-found
```

`NEXT_PUBLIC_SITE_URL` had been given the variable's own *name* as its value.
`app/layout.tsx` builds `metadataBase: new URL(env.siteUrl)` at module scope,
so one malformed value took down every page in the build.

`env.siteUrl` no longer permits that: a value that is not an absolute http(s)
URL is refused, warned about by name, and replaced with `https://vc-writer.com`
(`apps/web/src/lib/env.ts`, covered by `src/lib/__tests__/env.test.ts`). It
also strips a trailing slash, which would otherwise double in every emailed
link and Stripe redirect. A typo in a dashboard can no longer fail a build —
but it is still a typo, so fix the value too.

Note the shape of this mistake rather than just the instance. Pasting a
variable's name into its value field fails differently for each variable, and
only this one failed loudly at build time: `STRIPE_SECRET_KEY` or
`RESEND_API_KEY` filled in the same way would deploy green and fail at the
first purchase.

**What to do, once, in the dashboard (https://vercel.com):**

1. Delete the `vc-writer` and `desktop` projects. Keep `vcwriter`.
2. In `vcwriter`: Settings → Environment Variables → set
   `NEXT_PUBLIC_SITE_URL` to `https://vc-writer.com`, and check every other
   variable's *value* is the secret and not a repeat of its name.
3. Settings → Git → **Production Branch: `main`**. The first connection
   defaulted to `claude/vc-writer-dev-spec-ymc7zy`; both branches carry the
   same commits today, but `main` is the one meant to be deployable.
4. Confirm Settings → General → **Root Directory: `apps/web`**, with "include
   files outside the root directory" left enabled — the build needs the
   workspace root so `pnpm install` can link and build `@vcwriter/domain`.
   `apps/web/vercel.json` pins the framework to Next.js so the preset cannot
   be misdetected.
5. Deployments → Redeploy. Optionally add `ELECTRON_SKIP_BINARY_DOWNLOAD=1`
   first — the workspace install pulls the Electron binary otherwise, which
   the site never uses.
6. Settings → Domains → add `vc-writer.com` and `www.vc-writer.com` (see the
   Domain section).

After that, every push to `main` deploys. CI (`.github/workflows/ci.yml`)
runs the full suite on the same push; Vercel does not wait for it, so a red
CI run is the signal to look at, not a failed deploy.

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

## Domain — vc-writer.com

1. Vercel → the project → Settings → Domains → add `vc-writer.com` and
   `www.vc-writer.com`, redirecting `www` to the apex.
2. Point DNS at Vercel (an `A` record for the apex, `CNAME` for `www`, per the
   values Vercel shows).
3. Set `NEXT_PUBLIC_SITE_URL=https://vc-writer.com` in Production.

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

## Supabase auth redirect URLs

Supabase → Authentication → URL configuration:

- Site URL: `https://vc-writer.com`
- Redirect allow list: `https://vc-writer.com/auth/callback`,
  `http://localhost:3000/auth/callback`, and the Vercel preview pattern.

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
