# API contracts

## HTTP — vc-writer.com

All routes run on Node, are dynamic, and hold their authority server-side.
Nothing about entitlement is decided by the client.

### `POST /api/checkout`

Starts a Stripe Checkout session.

```jsonc
// request
{ "platform": "windows" | "macos", "email": "buyer@example.com" }  // email optional when signed in
// 200
{ "url": "https://checkout.stripe.com/…" }
// 400 — unknown platform · 500 — Stripe rejected the session
{ "error": "A platform of \"windows\" or \"macos\" is required" }
```

The price is chosen server-side from `STRIPE_PRICE_ID_DESKTOP`. The platform
and the signed-in user id ride in session metadata for the webhook to read.

### `POST /api/stripe/webhook`

The only place a paid entitlement is created.

- Verifies the `stripe-signature` header against `STRIPE_WEBHOOK_SECRET`;
  an unsigned or mis-signed request is a 400.
- Claims `event.id` in `stripe_webhook_events`. A redelivery of an event that
  already completed returns `{ received: true, duplicate: true }` without
  re-running fulfillment; a redelivery of one that *failed* is allowed through,
  which is what Stripe's retry is for.
- `checkout.session.completed` with `payment_status: "paid"` → upsert the order
  on the checkout session id, insert the license on the order id, send the
  confirmation email once.
- `charge.refunded` / `charge.dispute.created` → move the order and revoke the
  license.
- Email failure is logged to `email_events` and never fails the webhook: the
  license already exists, and a 500 would make Stripe retry a completed
  purchase.

Events this endpoint does not handle are acknowledged and ignored.

### `GET /api/downloads/[platform]`

Authorises one download.

```jsonc
// 200
{
  "url": "https://…signed…",     // expires in RELEASE_DOWNLOAD_TTL_SECONDS
  "version": "1.0.0",
  "sha256": "…",
  "minimumOsVersion": "11.0",
  "expiresInSeconds": 900
}
// 401 not signed in · 403 no entitlement for this platform
// 404 unknown platform, or no published build yet
```

The license is re-checked on every call. There is no permanently public
installer URL anywhere in the system.

### `GET /api/releases`

Version metadata for the desktop updater. Deliberately carries no download URL.

```jsonc
{
  "builds": [
    { "platform": "windows", "version": "1.0.0", "minimumOsVersion": "10.0.19041",
      "releaseNotes": "…", "publishedAt": "…", "sha256": "…" }
  ]
}
```

### `POST /api/ai/scene-review`

The Final Editor's structural pass (§8.2). Authenticated by session cookie
from the website or a bearer token from the desktop application; either way the
caller must hold an **active license**, because every request costs real money.

```jsonc
// request — only the scene's own text; nothing else about the project
{ "sceneText": "SCENE HEADING: INT. LIGHTHOUSE - NIGHT\n…", "position": "Scene 14 of 62", "format": "screenplay" }
// 200
{ "verdict": { "opening": "…", "change": "…", "turn": null, "valueShift": "none",
               "purpose": "…", "concerns": ["…"], "model": "claude-opus-5" } }
// 401 not signed in · 403 no active license · 502 the read failed
// 503 AI review is not configured on this deployment
```

The response shape has no field that could carry replacement prose: the pass
reads, it does not rewrite. `ANTHROPIC_API_KEY` lives here and never ships in
an installer.

### `POST /api/licenses/activate`

Activate an installation against a license (§3.3). Session cookie or desktop
bearer token; a serial alone is never enough, because activation is scoped to
licenses on the authenticated account.

```jsonc
// request
{ "serial": "VCW-…", "deviceFingerprint": "…", "deviceName": "Kevin's laptop",
  "platform": "windows", "appVersion": "1.0.0" }
// 200
{ "activated": true, "reason": "new_device" | "already_active" | "reactivated" }
// 409 — well formed, correct caller, no seat free; the message says how to fix it
{ "error": "This license is on 2 of 2 devices. Free a seat from My Account and try again." }
```

### `GET` / `DELETE /api/licenses/devices`

The account's devices, and freeing a seat — the lost-device replacement flow.
Deactivation marks the record rather than deleting it, so the history survives.

### `POST /api/telemetry`

An error report from the desktop application or the website (§14). Accepted
signed in or not — a crash before sign-in is still worth knowing about — and
always answered `202`, including when the insert fails: a retry loop on a crash
path is worse than a lost report.

```jsonc
// request — this is the whole schema; there is no field for project content
{ "appVersion": "1.0.0", "platform": "windows", "osVersion": "10.0.19045",
  "errorName": "TypeError", "errorMessage": "x is not a function",
  "stack": "…    at saveProject (<path>:412:19)", "surface": "main" }
// 202
{ "received": true }
// 400 — not a report
```

Every text field is redacted again here — paths, URLs and email addresses —
even though the desktop redacted before sending. The sender is the least
trusted half, and an older build with a weaker redactor must not be able to
write a file path into the database. The table has no column for manuscript
content, so a field that arrived anyway would have nowhere to land.

Reporting is opt-in in the desktop application and off until the writer turns
it on.

### `GET /admin/errors`

Triage, grouped by failure rather than listed chronologically. Admin only.

### `GET` / `POST /api/admin/support`

Support console (§3.3). Look a customer up by email; act on licenses (resend,
revoke, restore), devices (free a seat) and see email delivery. Admin only.
Manuscript content is not reachable from any of it.

### `GET` / `POST` / `PUT /api/admin/releases`, `PATCH /api/admin/releases/[id]`

Release publishing (§3.2). `PUT` mints a signed upload URL so a large installer
goes straight from the browser to private storage; `POST` records the build
inactive; `PATCH` activates or retires it, scoped to one platform and channel.

### `GET /auth/callback?code=…&next=/account`

Exchanges a magic-link code for a session cookie and redirects. `next` is only
honoured when it is a path on this site.

---

## Desktop IPC

The preload script exposes exactly these channels on `window.vcwriter`. There
is no generic `invoke`, so the renderer's reach is this list and nothing else.
Every call returns `{ ok, data?, error? }` — failures are values, not thrown
exceptions crossing the bridge.

| Method | Purpose |
| --- | --- |
| `createProject({ title, format, author?, logline? })` | Save dialog, then write a new project document |
| `openProject()` | Open dialog, then load and validate |
| `openProjectAtPath(path)` | Load a recent project |
| `saveProject({ path, file, previousHash?, snapshot? })` | Validate, atomically replace, optionally snapshot. Returns `{ contentHash, written }`; `written: false` means the content was unchanged |
| `recentProjects()` | Up to ten recent project paths |
| `listSnapshots(path)` | Recovery points for a project, newest first |
| `restoreSnapshot({ path, snapshotId })` | Snapshot the current file, then restore |
| `exportPdf({ file, options })` | Render the print document and write a PDF. Returns `null` when the save dialog was cancelled |
| `print({ file, options })` | Send the same document to the system print dialog |
| `appInfo()` | Version and platform |
| `accountStatus()` | Whether sync is configured in this build, and who is signed in |
| `requestSignInCode(email)` | Ask Supabase to email a six-digit code |
| `verifySignInCode({ email, code })` | Exchange the code for a session, stored encrypted |
| `signOut()` | Clear the session locally and on the server |
| `syncProject({ file })` | Pull, merge, push. Returns the merged project, named conflicts and a summary |
| `listCaptures(projectId)` | Captures awaiting review for this project, plus unassigned ones |
| `resolveCapture(capture)` | Write back a review decision. Never touches `raw_text` |
| `reviewScene({ sceneText, position, format })` | Ask the Final Editor's AI pass to read one scene |
| `reportingSettings()` | Whether error reporting is on for this installation. Off until switched on |
| `setReporting(enabled)` | Store the choice. Returns what is actually stored, not what was clicked |
| `reportError({ name, message, stack })` | A renderer crash. The main process redacts it and decides whether to send |

`saveProject` re-validates the document against the project schema before it
touches disk: the renderer is the least trusted half of the application, and a
malformed document must never reach the file.

Sync is optional. In a build without Supabase keys, `accountStatus()` reports
`configured: false` and every other channel above still works — projects are
files on disk.

`exportPdf` and `print` take the *project*, not HTML. The main process
re-validates it and generates the print document itself, so the renderer can
never hand arbitrary markup to a window that will be rendered; that window runs
sandboxed with scripting disabled. `options` is `PrintOptions` —
`includeTitlePage` (default true), `includeBeatTitles` (default false, and the
only way a beat's internal title reaches a page), and `watermark`.

---

## Project file format

A VC Writer project (`.vcw`) is one JSON document:

```jsonc
{
  "formatVersion": 1,
  "generator": "vcwriter",
  "savedAt": "2026-09-05T00:00:00.000Z",
  "project": { … }, "settings": { … },
  "lanes": [ … ], "units": [ … ], "beats": [ … ],
  "researchCategories": [ … ], "researchItems": [ … ],
  "characters": [ … ], "links": [ … ], "setupsPayoffs": [ … ],
  "snapshots": [ … ]
}
```

Loading applies every migration between the file's `formatVersion` and the
build's, then validates. A file from a *newer* build is refused with a message
telling the writer to update — reading it partially would be data loss.
