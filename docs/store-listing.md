# VC Writer Notes — the store listings

Every field the App Store and Google Play ask for, filled in, plus the short
list of things only Ken can do. Addendum 27 §13.

The copy below is the **answer**, not a suggestion to be rewritten in the
console: a listing typed twice is two listings, and the one in the console is
the one people read. Paste it.

For the accounts themselves — enrolling, the paid-app agreements, the two
subscription products and the keys vc-writer.com needs to verify a purchase —
see **`docs/store-setup.md`**.

---

## 1. The app, in the words both stores want

| Field | Value |
| --- | --- |
| Name (App Store, 30 max) | `VC Writer Notes` |
| Name (Play, 30 max) | `VC Writer Notes` |
| Subtitle (App Store, 30 max) | `Dictate ideas while you walk` |
| Short description (Play, 80 max) | `A voice notebook for writers. Catch the idea; place it at your desk later.` |
| Bundle id / package | `com.vcwriter.notes` |
| Primary category | Productivity |
| Secondary category (App Store) | Utilities |
| Content rating | Everyone / 4+ |
| Price | Free to download |
| In-app purchases | **Two auto-renewing subscriptions** (addendum 27 §14) |
| — Yearly | `com.vcwriter.notes.yearly` · **$49.99 / year** · display name **Notes — a year** |
| — Monthly | `com.vcwriter.notes.monthly` · **$4.99 / month** · display name **Notes — a month** |
| Subscription group (App Store) | `VC Writer Notes` — both plans in one group, so a reader may move between them |
| Support URL | `https://vc-writer.com` |
| Support email | `support@vc-writer.com` |
| Marketing URL | `https://vc-writer.com` |
| Privacy policy URL | `https://vc-writer.com/privacy` |
| Terms of Use / EULA URL | `https://vc-writer.com/terms` |
| Copyright | `© 2026 VC Writer` |

App Store Connect asks for the EULA under **App Information ▸ License
Agreement**: choose *Custom* and paste the terms URL above, or leave Apple's
standard EULA selected — the page says Apple's agreement also applies and
governs where the two differ, so either answer is consistent. The purchase
screen in the app links to both documents whichever is chosen, which is what
guideline 3.1.2 actually asks for.

Both product ids are `NOTES_PRODUCTS` in `packages/domain/src/notes-plan.ts`,
which is the one list the app asks the shop for and the server maps a receipt
back through — a third copy typed into a console under another spelling is a
receipt the server will refuse. The **price a reader sees is the shop's own**,
localised; the figures above are what the products are set to and what
vc-writer.com advertises.

Both stores ask what the subscription unlocks and what happens when it lapses.
The answer, in the words the app and the website both use: it unlocks sending
notes from the phone and syncing them to VC Writer on the desktop; when it
lapses, **every note already sent stays readable and anything already filed
into a project is part of the project** — what stops is sending new ones. VC
Writer for Windows and macOS is a separate one-off purchase, made on
vc-writer.com, and is not affected.

### Description (both stores)

```
An idea arrives on a walk. VC Writer Notes catches it.

Say "dictate idea" and start talking. Say "dictate done" and it is filed,
written down on the phone before it is sent, so a walk out of signal loses
nothing. Say "dictate character, Tom" and the note knows who it is about.
Everything is by voice, because a notebook you have to look at is one you do
not use.

It does one thing on purpose. The phone captures; the desk places. There is no
folder tree here, no cast list, no outline to fight with on a four-inch screen
— those are on VC Writer on your computer, where the note arrives in an inbox
you drag into a chapter, a character, an outline or a board.

  • Hands free. Say a category, say the note, say done. It beeps to tell you
    it heard, and it answers commands rather than reading your own sentences
    back at you.
  • Works with no signal. Speech is turned into text on the phone itself
    wherever your phone can, and a note is saved before it is ever sent.
  • Say a group once and it sticks, so an hour's walk arrives already divided.
  • Start a project by voice. "Dictate new project, The Lamp, a novel."
  • Type instead, whenever you would rather.
  • Review and correct anything still waiting, from the phone.
  • Choose which of your projects appear here. Unticking hides; it never
    deletes anything, anywhere.

VC Writer Notes needs a VC Writer account. The desktop application — story
structure, drafting, the Story Sculptor, the Outliner, book layout and eBook
export — is at vc-writer.com.
```

### Keywords (App Store, 100 characters including commas)

```
dictation,voice notes,writer,novel,screenplay,outline,story,speech to text,idea,notebook,capture
```

### What's new (first release)

```
The first release. Dictate a note on a walk; it is on your desk when you get
back.
```

---

## 2. App Store privacy — the nutrition labels

Answer these in App Store Connect ▸ App Privacy. Each one is checkable against
the code; the reasoning is in `apps/web/src/app/(site)/privacy/page.tsx`.

**Do you or your third-party partners collect data from this app? — Yes.**

| Data type | Collected | Linked to the user | Used for tracking | Purpose |
| --- | --- | --- | --- | --- |
| Email address | Yes | Yes | **No** | App Functionality (sign-in) |
| User Content — *Other User Content* (the notes) | Yes | Yes | **No** | App Functionality |
| Identifiers — User ID | Yes | Yes | **No** | App Functionality |
| Audio Data | **No** | — | — | Audio is never recorded, stored or transmitted |
| Usage Data, Diagnostics | **No** | — | — | The app has no analytics and sends no crash reports |
| Location, Contacts, Photos, Browsing History, Purchases, Search History, Sensitive Info, Financial Info, Health, Fitness, Contact Info other than email | **No** | — | — | Not collected |

**Tracking: No**, on every row. Nothing is shared with data brokers or used for
advertising, so **no App Tracking Transparency prompt** and no
`NSUserTrackingUsageDescription`.

The **privacy manifest** (`ios.privacyManifests` in `app.json`) declares the
four required-reason APIs the runtime uses: UserDefaults `CA92.1`, file
timestamp `C617.1`, system boot time `35F9.1`, disk space `E174.1`.

**Export compliance:** `ITSAppUsesNonExemptEncryption: false` is in `app.json`,
so the question is answered at build time rather than at every submission. The
app uses HTTPS and nothing else, which is the exemption.

**Account deletion (guideline 5.1.1(v)):** in the app, at **Projects ▸ Account
▸ Delete this account…**. It presses `POST /api/account/delete`, which removes
the sign-in and everything under it. Say so in the review notes.

---

## 3. Play Data safety

Play Console ▸ App content ▸ Data safety. The same facts, in Google's shape.

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | Yes |
| Is all of the user data collected by your app encrypted in transit? | Yes |
| Do you provide a way for users to request that their data be deleted? | Yes — in the app, at Projects ▸ Account ▸ Delete this account… |

Data types to declare, all **collected, not shared**, all **required**, none
used for advertising or analytics:

| Type | Purpose |
| --- | --- |
| Personal info ▸ Email address | Account management, App functionality |
| Personal info ▸ User IDs | Account management, App functionality |
| App activity ▸ Other user-generated content (the notes) | App functionality |

**Audio ▸ Voice or sound recordings: not collected.** The microphone is used
only while dictating and no recording is kept or sent. Say that in the
declaration's note.

Other Play forms:

- **Ads:** No.
- **Target audience:** 18+; not designed for children. No Families policy.
- **Content rating questionnaire:** no violence, no sexuality, no profanity, no
  controlled substances, no gambling, no user-to-user communication, no
  location sharing. Result should be Everyone / PEGI 3.
- **Government app:** No. **Financial features:** none. **Health:** none.
- **Permissions:** `RECORD_AUDIO` and `INTERNET`. If Play asks why the
  microphone is needed: *the app is a voice notebook; dictation is its only
  function.* No sensitive-permission declaration form applies.

---

## 4. Screenshots

**These cannot be produced from this repository and must not be faked.** They
need a real device or a simulator, and both stores require screenshots that
show the app as it actually runs — a mock-up is a rejection and, more to the
point, a lie about what a writer will see.

What to capture, once the app runs on a device — the same five on both
platforms, in this order, because it is the order somebody meets them:

1. **The project list.** Two or three projects, the last-used one marked.
2. **Dictating.** A note open mid-sentence, the microphone lit, the words
   standing in the largest type on the screen.
3. **Hands free.** The line naming the spoken commands, with a note filed
   under a category and a group.
4. **Review.** Three or four notes, one of them still waiting to be sent.
5. **Which projects.** The ticks, with the promise under them.

| Store | Sizes required |
| --- | --- |
| App Store | 6.9" iPhone (1320 × 2868 or 2868 × 1320) and 6.5" iPhone (1242 × 2688). **No iPad shots**: `ios.supportsTablet` is `false`, so the app is iPhone-only and Apple does not ask for them. |
| Play | Phone: 2–8 shots, 16:9 or 9:16, each 320–3840 px on its shortest side. Plus a **feature graphic**, 1024 × 500, and a 512 × 512 app icon. |

**iPhone only, and said rather than defaulted.** The app is a voice notebook
used on a walk with the phone in a pocket; an iPad build would be a second
layout to design, test and screenshot for a device nobody dictates into on the
move, and submitting one untested is how an app gets rejected for a screen
somebody never looked at. `supportsTablet: false` is the decision — it costs
nothing and can be turned on the day there is an iPad layout worth shipping.
(An iPhone app still installs and runs on an iPad, scaled.)

Both pieces of artwork exist and are committed:

- **The 512 × 512 Play icon** — `node brand/logo/icons.mjs` writes
  `apps/web/public/notes-icon-512.png` at exactly that size.
- **The 1024 × 500 feature graphic** — `brand/exports/notes-feature-1024x500.png`,
  rendered by `node brand/render.mjs notes-feature` from the
  `notes-feature-1024x500` board in `brand/artboards.html`. It is a 24-bit PNG
  with no alpha channel, which is the format Play asks for. The board's own
  comment says why it is composed as it is; the short version is that nothing
  which has to be read stands in the middle, where Play draws a play button
  over the graphic if a promo video is ever added.

---

## 5. What only Ken can do

None of this can be done from here, and none of it should be.

1. **Apple Developer Program** — $99 a year, and an enrolment that takes a day
   or two. An organisation enrolment needs a D-U-N-S number; an individual one
   does not.
2. **Google Play Developer** — $25 once. A **new personal** account must run a
   closed test with **at least 12 testers for 14 continuous days** before it may
   publish to production. Start that clock early; it is the longest pole here
   by a fortnight.
3. **An Expo account**, then `npx eas login` and `npx eas init` in
   `apps/mobile` — which writes the project id into `app.json` and is the one
   file change any of this needs.
4. **`support@vc-writer.com`** must be a mailbox somebody reads. Both stores
   publish it, and Apple emails review questions to it.
5. **The two EAS environment variables** (`apps/mobile/README.md` has the
   commands). Nothing else, and no key of any kind in this repository.
6. **Signing.** Let EAS hold the iOS certificate and the Android keystore.
   Never commit either.
7. **The screenshots** above, from a device. They are the one piece of this
   that cannot be made here.
8. **A sandbox Apple ID** and, on Play, the **licence testers** — so the
   reviewer and the twelve closed testers can buy the subscription without
   being charged. `docs/store-setup.md` §2.2a is the whole arrangement; it is
   two lists in two consoles and nothing in this repository.

---

## 6. Review notes to paste into both consoles

```
VC Writer Notes is the companion app to VC Writer, a desktop writing
application. It requires an existing VC Writer account; accounts are created
on vc-writer.com and cannot be created in the app.

A demo account is below. Sign in with the password, choose a project, and press
Dictate — or use the hands-free walk, where every command is prefixed with the
word "dictate" ("dictate idea", "dictate done").

THE SUBSCRIPTION. Notes is free to download and needs a subscription to send
notes from the phone to the account. The purchase screen is at Projects →
Subscribe, and it carries both plans at the prices this store reports, the
terms of use, the privacy policy and a Restore button. The demo account has no
subscription on purpose, so the purchase can be tested; a sandbox purchase on
it completes and the app then sends notes. Reading, correcting and deleting
notes already captured are never gated, which is why the rest of the app works
before anything is bought.

Microphone and speech recognition are used only while dictating, on an explicit
press. No audio is recorded, stored or transmitted.

Account deletion is in the app: Projects → Account → Delete this account…

Terms of use: https://vc-writer.com/terms
Privacy policy: https://vc-writer.com/privacy

Demo account: <email> / <password>
```

Fill the last line in the console, where the credential is stored by the store
rather than written down anywhere. Make the demo account a real one with two or
three projects on it, and nothing on it you would mind a reviewer reading.

**Leave the demo account unsubscribed.** The instinct is to comp it so the
reviewer never meets the paywall, and it is the wrong way round: a reviewer who
cannot find the in-app purchase cannot verify it, and *we were unable to locate
the in-app purchase* is itself a rejection. What they need is a paywall that
**works** — which it does, on a sandbox Apple ID or as a Play licence tester,
without being charged and without anything being granted by hand.
