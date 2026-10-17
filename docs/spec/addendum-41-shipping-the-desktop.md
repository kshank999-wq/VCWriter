# Addendum 41: Shipping the desktop app

From Ken: *I have the artifact signing for Microsoft Azure available now, so
let's go ahead and set up a Mac and PC installable downloadable and the
licensing.*

## 1. Measured first

Most of this already existed. Four things did not.

| Needed | Already standing |
| --- | --- |
| Packaging for both platforms | `desktop-release.yml`: Windows and macOS in separate jobs, each uploaded independently |
| Windows signing through Azure | Wired in since September. It signs as soon as the `AZURE_*` secrets exist. The 16 September run built Windows **unsigned** because they did not exist yet. |
| macOS signing and notarisation | The 16 September run **signed with the Developer ID**: the job builds its own keychain, and the Apple secrets are present |
| A private release store | The `releases` bucket (private) and `release_builds` (one active build per platform and channel) |
| Licensing | Addendums 27–32: Stripe checkout for the monthly and yearly plans, the webhook, licences with an expiry, device activation, read-only mode at a lapse, licence-checked signed downloads, and an updater that verifies checksums |

What was missing:

1. **Publishing was a placeholder.** The job printed "intentionally manual".
   Getting a release out meant downloading two installers from GitHub and
   uploading them again in a browser, one of them about 250 MB.
2. **Nothing proved a build was signed.** A missing secret produced a warning
   in the middle of a log, and the result was an installer that looked
   finished.
3. **The Mac build was two files for a catalogue with room for one.** The
   build made Apple-silicon and Intel installers, but the catalogue, the
   download route and the updater each handle one file per platform.
4. **No way to manage the subscription.** Addendum 32 §7 named the Customer
   Portal link as the next thing to build.

## 2. The release, automatic up to the last switch

- **The tag is the version.** `v1.2.0` is packaged as 1.2.0, so the installer
  name, the app's About box, the catalogue row and the updater's comparison
  all read the number the operator typed. A hyphen (`-beta.1`) means the beta
  channel.
- **One universal Mac installer.** It runs natively on Apple silicon and on
  Intel, and a writer cannot download the wrong one. File names are fixed:
  `VC-Writer-<version>-Setup.exe` and `VC-Writer-<version>-mac.dmg`.
- **The publish job** uploads each installer to the private bucket, then
  records it **inactive** with its size and SHA-256. Activation stays a human
  act at `/admin/releases` (spec §17), so a build is installed by someone
  before any customer can download it. A version that is already live is
  refused rather than overwritten: changing the bytes under a live row would
  hand customers a file whose checksum the updater rejects.

## 3. Proof, not hope

After packaging, each installer is checked the way the customer's computer
will check it:

- **Windows:** `Get-AuthenticodeSignature`.
- **macOS:** `codesign --verify --deep --strict`, and `spctl` must report
  *Notarized Developer ID*, not just *accepted*. An un-notarised Developer ID
  build is accepted on the machine that built it and refused on a fresh one.
  The stapled ticket is checked too.

A **tagged** release fails outright if either check fails, so nothing unsigned
can reach the publish job. A manual run only warns, so an unsigned build can
still be made for testing.

Two smaller fixes: `signingHashAlgorithms` moved to `signtoolOptions` (the
25.x deprecation), and `author` was added to `package.json`, since the Windows
installer reads it as the publisher.

## 4. Licensing: Manage subscription

The account page now shows when each subscription licence renews, and has a
**Manage subscription** button beside *Email me my licence again*. It opens
Stripe's Customer Portal, where the writer can change their card, switch
between monthly and yearly, cancel, or see receipts. That is the same portal
the Writers Room seat subscription has used since addendum 07, and the webhook
already handles every change it makes (addendum 32 §1).

`/api/account/billing` reads the Stripe customer from the writer's own paid
orders. Nothing is taken from the request, so a writer can only ever open
their own billing.

## 5. What only Ken can do

These are listed in `docs/code-signing.md` under *What is left*:

1. Set the six `AZURE_*` secrets. Signing then turns on by itself.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the `release`
   environment.
3. Raise Supabase Storage's upload size limit above the Mac installer's size.
4. Push a tag, install both builds, and activate them at `/admin/releases`.
5. Make one live purchase end to end.
