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
