# Setting up the two stores, and the keys the server needs

Notes is sold by in-app purchase (addendum 27 §14) — $49.99 a year or $4.99 a
month — so both shops have to be set up before a single subscription can be
bought. This is the order to do it in, what blocks what, and exactly which
values end up in Vercel.

**No key in this document, ever.** Every value below is pasted straight from
the console into Vercel's environment-variable screen. Nothing goes in this
repository, in a chat message, or in a file. If a key is ever pasted somewhere
it should not be, revoke it in the console and make a new one — both shops let
you, and neither charges for it.

---

## 0. What the code already expects

These are not choices; they are what is compiled in, so the consoles have to
match them exactly.

| Thing | Value | Where it comes from |
| --- | --- | --- |
| Bundle id (iOS) | `com.vcwriter.notes` | `apps/mobile/app.json` |
| Package name (Android) | `com.vcwriter.notes` | `apps/mobile/app.json` |
| Yearly product id | `com.vcwriter.notes.yearly` | `NOTES_PRODUCTS`, `packages/domain/src/notes-plan.ts` |
| Monthly product id | `com.vcwriter.notes.monthly` | `NOTES_PRODUCTS`, same file |
| Yearly price | $49.99 | `NOTES_PRICE_WORDS` (the website's advertised figure) |
| Monthly price | $4.99 | `NOTES_PRICE_WORDS` |

A product id typed differently in a console is a receipt the server will
refuse — `planKindOf` answers null for an id it does not know and the purchase
route replies *That purchase is not a Notes subscription*. Copy and paste them.

---

## 1. Apple — you have an account, but probably not the right one

**An Apple ID is not an Apple Developer account.** Selling anything needs
enrolment in the **Apple Developer Program**, which is **$99 a year**.

### 1.1 Enrol

<https://developer.apple.com/programs/enroll/> — sign in with your Apple ID.
It asks which you are:

- **Individual / Sole proprietor.** Fast (often same day). The App Store shows
  your **own legal name** as the seller.
- **Organization.** Shows the company name. Needs a **D-U-N-S number** for the
  legal entity (free from Dun & Bradstreet, takes up to two weeks), plus a
  legal-entity check.

This is worth a minute's thought because **it cannot be changed later without
transferring the app**: whatever you choose is the name under everyone's
receipt. If *VC Writer* is a company you want on the store page, do the
organization route and start the D-U-N-S request today, because it is the
longest pole here. If it is you, individual is fine and you can carry on
within a day.

### 1.2 Agree to sell — the step that actually blocks money

App Store Connect → **Business** (older wording: *Agreements, Tax, and
Banking*).

1. Accept the **Paid Applications** agreement.
2. Add a **bank account** for payouts.
3. Complete the **tax forms** for every region you intend to sell in (at
   minimum the US one; Apple prompts for the rest).

Until this section reads **Active**, subscriptions cannot be created, let alone
sold. Most people find this out late. Do it first.

### 1.3 Register the App ID

Developer portal → **Certificates, Identifiers & Profiles** → **Identifiers** →
**+** → App IDs → App.

- Bundle ID: **explicit**, `com.vcwriter.notes`
- Capabilities: tick **In-App Purchase**

(If you run `eas build` first, Expo offers to register this for you. Either way
is fine — it just has to exist and be exactly that string.)

### 1.4 Create the app record

App Store Connect → **Apps** → **+** → New App.

- Platform: iOS
- Name: **VC Writer Notes**
- Primary language: English (U.S.)
- Bundle ID: the one above
- SKU: anything unique and private — `vcwriter-notes` is fine

Everything the listing asks for (subtitle, description, keywords, categories,
support URL, privacy policy URL) is written out in `docs/store-listing.md`.
The privacy policy URL is <https://vc-writer.com/privacy>, which is live.

### 1.5 Create the two subscriptions

App Store Connect → your app → **Monetization → Subscriptions**.

1. Create a **subscription group**. Call it **VC Writer Notes**. Both plans go
   in the one group, which is what lets somebody move between monthly and
   yearly rather than ending up paying for both.
2. In it, create two **auto-renewable subscriptions**:

   | Reference name | Product ID | Duration | Price |
   | --- | --- | --- | --- |
   | Notes — a year | `com.vcwriter.notes.yearly` | 1 year | $49.99 |
   | Notes — a month | `com.vcwriter.notes.monthly` | 1 month | $4.99 |

3. Each needs a **localisation** — a display name and description shown on the
   purchase sheet. Suggested:
   - *Notes — a year* · "Dictate ideas on the move and sync them to VC Writer
     on your desktop. Renews once a year."
   - *Notes — a month* · "Dictate ideas on the move and sync them to VC Writer
     on your desktop. Renews every month."
4. Each needs a **review screenshot** of the purchase screen before it can be
   submitted — which means it comes after the first build is on a device.

Apple reviews the **first** subscription alongside the first build of the app.
After that, adding one is quick.

### 1.6 Generate the App Store Server API key

This is what lets vc-writer.com ask Apple whether a receipt is real.

App Store Connect → **Users and Access** → **Integrations** → **In-App
Purchase** → **+**.

- Name it something you will recognise: `vc-writer.com server`.
- Press Generate, then **download the `.p8` file**. Apple lets you download it
  **once**. If you lose it, revoke and make another.

From that same page write down:

- **Key ID** — the short code beside the key, e.g. `2X9ABC3DEF`
- **Issuer ID** — a UUID at the top of the page, the same for every key

Note it must be an **In-App Purchase** key. A plain App Store Connect API key
is a different thing and the server will get a 401 with it.

### 1.7 The four Apple values for Vercel

| Variable | What to paste |
| --- | --- |
| `APPLE_IAP_ISSUER_ID` | the Issuer ID UUID |
| `APPLE_IAP_KEY_ID` | the Key ID |
| `APPLE_IAP_PRIVATE_KEY` | the **entire contents** of the `.p8` file, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines |
| `APPLE_IAP_BUNDLE_ID` | `com.vcwriter.notes` — optional; the code defaults to this, so only set it if the bundle id ever changes |

The `.p8` is several lines. Vercel's box takes a multi-line paste; if whatever
you paste from flattens it into one line with `\n` in it, that works too — the
server accepts both spellings.

---

## 2. Google Play — starting from nothing

### 2.1 Register

1. Sign in to <https://play.google.com/console/signup> with a Google account.
   Use one you will keep — the console is tied to it. A dedicated account
   (e.g. a `vcwriter@` address) is worth making rather than a personal Gmail
   you might one day lose access to.
2. Choose **Personal** or **Organization**, on the same reasoning as Apple's:
   an organization shows the company as developer and needs a **D-U-N-S
   number**.
3. Pay the **$25 one-off** registration fee. Unlike Apple it is not annual.
4. **Verify your identity.** Google asks for a government ID (personal) or
   entity documents (organization), plus an address and phone. This takes
   anywhere from a day to a couple of weeks and everything else waits on it.

### 2.2 The closed-testing rule — read this before planning dates

For **new personal developer accounts**, Google requires a **closed test with
at least 12 testers who have been opted in continuously for 14 days** before
you can apply for production access. It is a real fourteen days of wall clock,
and it is the single longest item in this whole document.

Two consequences worth acting on now:

- If you register as an **organization**, this requirement does not apply.
  That alone may be worth the D-U-N-S paperwork.
- If you register as a personal account, **start the closed test as early as
  you can** — it can run while everything else is still being set up, and the
  twelve testers can be anybody with a Google account (friends, other writers,
  a second account of your own does not count).

### 2.3 Payments profile

Play Console → **Setup → Payments profile**. Create or link a Google payments
profile with a bank account and tax details. Same as Apple's step 1.2: no
selling until it exists.

### 2.4 Create the app

Play Console → **Create app**.

- App name: **VC Writer Notes**
- Default language: English (United States)
- App or game: App
- Free or paid: **Free** (the app is free to download; the subscription is
  in-app)
- Package name is fixed when you upload the first build: `com.vcwriter.notes`

### 2.5 Create the two subscriptions

Play Console → your app → **Monetize → Products → Subscriptions**.

| Product ID | Name | Base plan | Price |
| --- | --- | --- | --- |
| `com.vcwriter.notes.yearly` | Notes — a year | auto-renewing, **P1Y** | $49.99 |
| `com.vcwriter.notes.monthly` | Notes — a month | auto-renewing, **P1M** | $4.99 |

Google splits this into a *subscription* and a *base plan* under it; the
product id is on the subscription and the renewal period is on the base plan.
Activate both base plans — a subscription with no active base plan returns
nothing to the app and the purchase screen shows one plan where there should
be two.

### 2.6 Service account for the Play Developer API

This is Google's equivalent of Apple's `.p8`, and it is more steps because it
lives in Google Cloud rather than in Play.

1. **Google Cloud Console** → create a project (e.g. `vc-writer`).
2. **APIs & Services → Library** → enable **Google Play Android Developer API**.
3. **APIs & Services → Credentials** → **Create credentials → Service
   account**. Name it `vc-writer-play`. No roles are needed at the Cloud level.
4. Open the service account → **Keys → Add key → Create new key → JSON**. A
   `.json` file downloads. This is the secret.
5. **Play Console → Setup → API access.** Link the Cloud project you made.
   The service account appears in the list.
6. Grant it access: **Users and permissions** → find the service account's
   email (`vc-writer-play@…iam.gserviceaccount.com`) → give it, for this app:
   - **View app information and download bulk reports**
   - **View financial data, orders, and cancellation survey responses**

   That is all it needs. It never has to manage releases, so do not give it
   more than that.

Permission changes can take a few minutes to take effect; a fresh service
account answering 401 for a moment is normal.

### 2.7 The two Google values for Vercel

| Variable | What to paste |
| --- | --- |
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | the **whole contents of the JSON file**, as one value |
| `GOOGLE_PLAY_PACKAGE` | `com.vcwriter.notes` — optional, the code defaults to it |

Paste the JSON exactly as downloaded, braces and all. The code parses it and
un-escapes the private key inside, so it does not matter whether the newlines
survive the paste.

---

## 3. Everything that goes into Vercel

Vercel → the **vcwriter** project → **Settings → Environment Variables**. Set
each for **Production** (and Preview too, if you want to test there).

| Variable | Needed for | Example shape |
| --- | --- | --- |
| `APPLE_IAP_ISSUER_ID` | verifying Apple purchases | `57246542-96fe-1a63-e053-0824d011072a` |
| `APPLE_IAP_KEY_ID` | " | `2X9ABC3DEF` |
| `APPLE_IAP_PRIVATE_KEY` | " | `-----BEGIN PRIVATE KEY-----…` |
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | verifying Play purchases | `{"type":"service_account",…}` |
| `NEXT_PUBLIC_APP_STORE_URL` | the badge on vc-writer.com/notes | `https://apps.apple.com/app/id0000000000` |
| `NEXT_PUBLIC_PLAY_STORE_URL` | " | `https://play.google.com/store/apps/details?id=com.vcwriter.notes` |

**Redeploy after setting them** — Vercel reads environment variables at build
and at boot, so an existing deployment does not pick them up on its own.

The two `NEXT_PUBLIC_…_URL` ones are **not secret** and are the last things to
set, once the apps have store pages. Until they are set, `/notes` says Notes is
in review rather than showing a link that 404s, and *Open Notes in this
browser* is the page's one filled button.

### What happens before they are set

Nothing breaks. `askStore` refuses with *This deployment cannot check
subscriptions with the App Store yet — nothing is wrong with your purchase*,
and no account is entitled by a receipt nobody checked. That is deliberate: a
deployment that cannot verify refuses rather than trusting the phone, because
the alternative is a paid app that is quietly free.

### Testing that they work

Once Apple's are in, a sandbox purchase from a TestFlight build should come
back from `POST /api/notes/purchase` with a plan rather than an error, and
`GET /api/notes/plan` should then say *Notes — a year, through the App Store.
Renews …*. The row it writes is in `notes_subscriptions` with `environment`
reading `sandbox`, which is how support can tell a test purchase from a sale.

---

## 4. The order to do it in

Roughly longest-lead-time first, because two of these are waits rather than
work.

1. **Today.** Apple Developer Program enrolment ($99). If you are going the
   organization route on either store, request the **D-U-N-S number** now — it
   is the longest wait of all.
2. **Today.** Google Play registration ($25) and identity verification.
3. **As soon as Play lets you.** If it is a personal account, get the closed
   test started — the **14 days with 12 testers** runs in the background while
   everything else happens.
4. **Both shops, before anything else can be sold.** Apple's Paid Applications
   agreement + bank + tax; Google's payments profile.
5. Create the app records and the four subscription products.
6. Generate the Apple key and the Google service account; put the four secrets
   in Vercel and redeploy.
7. Build and upload with EAS (`apps/mobile/README.md` has the commands), take
   the five screenshots `docs/store-listing.md` names, and submit.
8. When both apps are live, set the two store URLs in Vercel and redeploy. The
   badges appear on <https://vc-writer.com/notes> by themselves.

## 5. What this costs to run

- Apple: **$99 a year**, and **15%** of each subscription for the first year of
  a given subscriber, then 15% still (Apple's Small Business Programme is 15%
  under $1M a year — apply for it, it is not automatic).
- Google: **$25 once**, and **15%** on subscriptions.

So $49.99 a year nets about **$42.49**, and $4.99 a month about **$4.24**,
before the annual Apple fee. Worth knowing before the price is advertised
anywhere it is hard to change.

---

*Console wording moves — Apple renamed *Agreements, Tax, and Banking* to
*Business*, and Play has reorganised *Monetize* more than once. Where a menu
name here does not match what you see, the thing it names still exists under a
near neighbour. The values in §0 and §3 are the ones that must match exactly,
and those come from this repository rather than from a console.*
