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

A project named **`vc-writer`** already exists in the account but is not
connected to a Git repository, so it does not deploy on push yet. Connect it in
the dashboard — Project → Settings → Git → Connect Git Repository →
`kshank999-wq/VCWriter`, production branch `main`.

Root directory: **`apps/web`**. Framework preset: Next.js. Leave "include files
outside the root directory" enabled — the build needs the workspace root so
`pnpm install` can link and build `@vcwriter/domain` (its `prepare` script
compiles it).

Environment variables, all environments unless noted:

| Variable | Value / source | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kpviyoqhmzignjyvixws.supabase.co` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/publishable | Public; bound by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service role | **Secret.** Bypasses RLS. Server only |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys | **Secret** |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → the vc-writer.com endpoint | **Secret**. Different per environment |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → API keys | Public |
| `STRIPE_PRICE_ID_DESKTOP` | Stripe → Products → VC Writer Desktop | The server-chosen price |
| `RESEND_API_KEY` | Resend → API keys | **Secret** |
| `ANTHROPIC_API_KEY` | Anthropic Console | **Secret.** Absent means the Final Editor's AI read returns 503 and its deterministic pass still works |
| `RESEND_FROM_ADDRESS` | `VC Writer <noreply@vc-writer.com>` | Needs a verified domain |
| `RELEASE_BUCKET` | `releases` | |
| `RELEASE_DOWNLOAD_TTL_SECONDS` | `900` | Signed installer URL lifetime |
| `NEXT_PUBLIC_SITE_URL` | `https://vc-writer.com` (preview: the preview URL) | Used for Stripe return URLs and auth redirects |

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
