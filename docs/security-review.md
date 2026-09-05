# Security review

Phase 8. This is a review of what the system actually does, written against the
code rather than against intentions. Where something is weaker than it looks,
it says so.

## Trust boundaries

There are four, and each one assumes the side below it is hostile.

| Boundary | Who is trusted | What crosses it |
| --- | --- | --- |
| Renderer → main process | Nothing from the renderer | A fixed list of IPC channels; every project document is re-validated against the schema before it reaches disk or a print window |
| Desktop → vc-writer.com | A Supabase session token | Sync rows, capture reviews, one scene's text for AI review, a crash report |
| Browser → route handlers | A session cookie, or a Stripe signature | Every entitlement decision is made server-side and re-checked per request |
| Route handler → database | The service role, used deliberately | Commerce writes, release rows, error reports |

### The renderer is the least trusted half

`window.vcwriter` exposes named channels only. There is no generic
`invoke(channel, …)`, so the renderer's reach is exactly the list in
[api-contracts.md](api-contracts.md) and nothing else.

`saveProject` re-parses the document against `projectFileSchema` before it
touches the file, and `exportPdf`/`print` take the *project*, not HTML — the
main process builds the print document itself, so the renderer can never hand
arbitrary markup to a window that will render it. That print window runs
sandboxed with `javascript: false`.

The main window now runs with `sandbox: true` as well. The preload needs only
`contextBridge` and `ipcRenderer`; the built bundle's sole `require` is
`electron`, so there was nothing gained by leaving the sandbox off.

> **Needs a launch check.** The sandbox change was verified by inspecting the
> built preload, not by launching the application — Electron's binary is not
> downloadable in the build container. It belongs in the first end-to-end run
> on real hardware.

### Secrets

| Secret | Where it lives | Where it must never go |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel environment | Any client bundle, any installer |
| `ANTHROPIC_API_KEY` | Vercel environment | Any installer — this is why AI review is a route and not a direct call |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Vercel environment | Anywhere else |
| Supabase anon key | Public by design | — |
| The writer's refresh token | The OS keychain via `safeStorage` | Plain disk, unless no keychain exists — in which case it is marked `plain:` so a later run knows |

The repository contains no credentials. The one live secret known to have been
exposed is the Supabase database password, which appeared in a Drive document
search snippet during Phase 1; rotating it was recommended then and is still
worth doing.

## Web

### Content security policy

Set per request in `middleware.ts` with a fresh nonce, `strict-dynamic`, and no
`unsafe-inline` for scripts. The site loads no third-party scripts, fonts or
frames, so the strict policy costs nothing.

This has a consequence worth knowing before someone "optimises" it: **a
statically prerendered page cannot carry a per-request nonce.** Its HTML was
built before the nonce existed, and because `strict-dynamic` makes `'self'`
inert for scripts, the browser then refuses *every* script on the page. The
first version of this policy did exactly that to the landing page and the
sign-in page — verified in a real browser, not reasoned about — which is why
the root layout sets `export const dynamic = 'force-dynamic'`. Removing that
line silently breaks the two most important pages on the site.

Verify after any change to rendering or the policy:

```bash
pnpm --filter @vcwriter/web build && pnpm --filter @vcwriter/web start -p 3124
# then, in a browser or Playwright, load / /signin /download /notes /account
# and confirm zero "Refused to load the script" console errors.
```

`style-src` keeps `'unsafe-inline'`: React and Next set inline style
attributes, and there is no nonce mechanism for those.

### Other headers

`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, and HSTS with
`includeSubDomains; preload`, all in `next.config.mjs`. `frame-ancestors 'none'`
in the CSP covers modern browsers; `X-Frame-Options` covers the rest.

### Money

Entitlement is created in exactly one place — the Stripe webhook — and only
after the signature verifies. Idempotency is a database constraint (unique on
the checkout session id, unique on the order id), not application logic, so a
retried delivery cannot mint a second license even if two deliveries race.

`/api/checkout` chooses the price server-side from `STRIPE_PRICE_ID_DESKTOP`.
The client cannot name a price or an amount.

### Downloads

There is no permanently public installer URL. `/api/downloads/[platform]`
re-checks the license on every call and mints a signed URL that expires in
`RELEASE_DOWNLOAD_TTL_SECONDS`. `/api/releases` deliberately carries version
metadata and no URL.

### Row level security

Every table has RLS enabled. Four advisor findings stand, all reviewed:

| Finding | Verdict |
| --- | --- |
| `email_events` has RLS on and no policy | Intended: deny-all. Only the service role writes it. |
| `stripe_webhook_events` has RLS on and no policy | Same. |
| `is_admin()` is `SECURITY DEFINER` and callable by signed-in users | Needed by the policies that call it. It discloses only whether the caller is an admin, which they can already read from their own profile row. |
| `owns_project(uuid)` is `SECURITY DEFINER` and callable | Needed by the project policies. It answers only about the caller's own access. |

## Privacy

Error reports carry no manuscript content, no project titles and no file paths;
the schema has no column for any of them, and the redactor runs on the desktop
and again in the route. Reporting is off until the writer turns it on.

The AI scene review sends one scene's text and nothing else about the project.
The response shape has no field that could carry replacement prose.

The device fingerprint is a random per-installation salt hashed with the
machine name. There is deliberately no hardware serial or MAC address in it: a
licence check is not a reason to build an identifier that could follow someone
elsewhere.

## Known gaps

- **No rate limiting** on `/api/telemetry`, `/api/licenses/activate` or the
  sign-in routes. Supabase throttles auth email, and the AI route is behind a
  license check, so the exposure is noise and cost rather than compromise —
  but a burst of telemetry from one address would land in the table
  unthrottled. Worth adding before launch traffic.
- **The sandbox change is unverified at runtime** (above).
- **No dependency scanning in CI.** `pnpm audit` is not run on a schedule.
- **Signing credentials are absent**, so no build is currently signed. See
  [code-signing.md](code-signing.md). An unsigned build must never be published
  to the `stable` channel.
