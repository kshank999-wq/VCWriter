# Addendum 01 — Administration console

Status: approved for build, 7 September 2026. Extends §2 of the master
specification, whose "Backend / Admin" surface lists *accounts, licenses,
builds, purchases, email delivery, project sync, operational controls* but
specifies only the release tooling (§3.2). This addendum specifies the rest
of that surface as a console inside the website.

## 1. Objective

One place, behind the site's own sign-in, where the person running VC Writer
can see how the business is doing and act on a customer's account — without
opening the database, and without the console becoming a second copy of the
systems that already do these jobs well.

## 2. What it is not

The console does not handle money. Refunds, disputes, payouts, tax and
invoices stay in the **Stripe dashboard**, which is built and audited for
them. The console shows the state of an order and links to its Stripe
record; it never moves funds. Sign-in configuration stays in Supabase and
email infrastructure in Resend, for the same reason.

The console also never shows manuscript content. Nothing in the data model
that reaches it carries a customer's writing, and no page or endpoint here
may query the story tables.

## 3. Access

There is no separate administrator login. An administrator signs in as any
customer does; `profiles.is_admin` is what the pages check, on every request,
through `currentAdmin()`. The site header shows an **Admin** link only to
administrators; the pages refuse everyone else regardless of the link.

Every write the console performs goes through a server route that re-checks
`is_admin`. No client-side check is trusted.

## 4. Structure

A sub-navigation across the top of every `/admin` page:

| Route | Page | Purpose |
| --- | --- | --- |
| `/admin` | **Dashboard** | The numbers that matter today, and where anything is wrong |
| `/admin/customers` | **Customers** | Every account, searchable; opens the customer's record |
| `/admin/support` | **Customer record** | One customer: purchases, licence, devices, emails, and the actions on them |
| `/admin/orders` | **Orders** | Every order, filterable by status, linked to Stripe |
| `/admin/emails` | **Email** | Every transactional email the system sent, delivered or failed |
| `/admin/releases` | **Releases** | Existing: builds per platform |
| `/admin/errors` | **Errors** | Existing: crash reports from the application |

## 5. Dashboard

Stat tiles, in this order, each with the period stated on the tile:

| Tile | Definition |
| --- | --- |
| Revenue, 30 days | Sum of `orders.amount_cents` where `status = 'paid'` and `paid_at` in the last 30 days, per currency |
| Revenue, 7 days | Same, 7 days |
| Orders, 30 days | Count of paid orders |
| Refunds and disputes, 30 days | Count of orders with `status in ('refunded', 'disputed')` updated in the period — the tile is *marked* when non-zero |
| Active licences | Count of `licenses` with `status = 'active'` |
| Activated devices | Count of `device_activations` with `deactivated_at is null`, split Windows / macOS |
| Failed emails, 7 days | Count of `email_events` with `status = 'failed'` — marked when non-zero |
| Crash reports, 7 days | Count of `error_reports` in the period — marked when non-zero |
| Current build | The active build per platform from `release_builds`, or "none published" |

Beneath the tiles: the ten most recent orders and the ten most recent
failed emails, each row linking to the customer's record. A marked tile is
the console's only alerting; there are no notifications.

## 6. Customers

A list of `profiles`, newest first, with a search box that matches email and
display name (case-insensitive substring). Each row: email, joined date,
number of orders, licence status, active devices, administrator flag. The
row opens the customer's record.

The customer record is the existing Support console, reached with the email
pre-filled so it loads without a second search.

## 7. Orders

A list of `orders`, newest first, filterable by status. Each row: date,
customer email (linking to the record), amount and currency, status,
platform chosen, and a link to the checkout session in Stripe when a
`stripe_checkout_session_id` is present. Nothing on this page changes an
order; a refund is done in Stripe and arrives here through the webhook.

## 8. Email

A list of `email_events`, newest first, filterable by status. Each row:
date, customer email, template, status, provider message id, and the error
text when delivery failed. From the customer's record a licence email can
be sent again; this page is for seeing the pattern across customers — a
provider outage, a template that stopped rendering.

## 9. Actions on a customer

All existing, all on the customer record, all re-checking `is_admin` on the
server:

- **Resend licence email** — sends the licence reminder to the account's
  email and records an `email_events` row.
- **Revoke / restore licence** — sets `licenses.status`; a revoked licence
  fails activation and the running application's next licence check.
- **Free a seat** — sets `device_activations.deactivated_at`, releasing one
  of the licence's activations.

No action deletes a row. Every one leaves the previous state recoverable.

## 10. Data access

Pages read through the service-role client, because the tables involved are
deliberately closed to every client role by row-level security. Aggregation
is done in the application over bounded result sets rather than with
database views, because the volumes are small and a view would be a second
place for the definitions in §5 to drift from. When a tile's query stops
being cheap, that is the moment to add a view for that tile — not before.

## 11. Acceptance

- A non-administrator requesting any `/admin` page or `/api/admin` route is
  refused, whether or not they are signed in.
- Every number on the dashboard can be reproduced by the SQL its definition
  in §5 implies, against the same tables.
- A customer found in the list opens to a record showing their purchases,
  licence, devices and emails, and the three actions work from there.
- Every order row with a Stripe session id links to that session in the
  Stripe dashboard.
- No page or route under `/admin` selects from `projects`, `lanes`,
  `structural_units`, `beats`, `research_*`, `characters`, `story_links`,
  `setups_payoffs`, `snapshots`, or `capture_items`.
