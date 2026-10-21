# VC Writer Notes

The phone app: a voice notebook that captures a thought while you walk. The
desktop decides where it goes (addendum 09 §1, addendum 27).

It is sold by in-app purchase — $49.99 a year or $4.99 a month (addendum 27
§14). **`docs/store-setup.md`** is how the two store accounts, the two
subscription products and the four server keys are set up; **`docs/store-listing.md`**
is what goes in the listing fields.

```sh
pnpm --filter @vcwriter/mobile start        # Expo dev server
pnpm --filter @vcwriter/mobile typecheck
pnpm --filter @vcwriter/mobile test
```

Speech recognition is native, so **Expo Go cannot run this app** — it needs a
development build (`eas build --profile development`) or a local
`expo run:ios` / `expo run:android` on a machine with Xcode or the Android SDK.

## Configuration

Three values, all of them public by design: `EXPO_PUBLIC_SITE`,
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. For builds
they are in `eas.json`, so every EAS build has them with nothing to set up.
Locally they go in `apps/mobile/.env` (git-ignored; copy `.env.example`).

The Supabase **anon key** is publishable. It is in every web page this
project serves, and row level security is what protects the data, not the
key. Rotating it means changing `eas.json` and making a new build.

**Nothing else belongs here.** The service role key, the Stripe keys, the
Anthropic key and the Resend key are the website's and never travel to a phone:
this app reaches the database only through `/api/notes`, signed with the
person's own session token.

## Building

The project must exist on Ken's Expo account before any of this works:

```sh
npx eas login
npx eas init          # writes extra.eas.projectId into app.json
```

| Profile | What it is for |
| --- | --- |
| `development` | A dev client with the debugger attached; **iOS simulator** (so: a Mac), Android APK |
| `preview` | An installable build for a real device, not through a store |
| `production` | App Store / Play Store; app bundle on Android, version auto-incremented |

**To put it on an iPhone, use `preview`.** `development` is simulator-only on
iOS and wants a Mac; `preview` builds for the device and installs from a link.
EAS builds on Apple hardware in the cloud, so **no Mac is needed** — which is
the whole reason an iOS app ships from this repository at all.

```sh
npx eas device:create                          # once, per phone
npx eas build --profile preview --platform ios
```

`device:create` registers the handset against the developer account — a short
profile to install, then the build comes back as a QR code. No App Store
listing and no in-app-purchase products are involved: an internal build is not
a submission. A purchase cannot be completed in one, for the same reason; see
`docs/store-setup.md` §4b for what it can and cannot show.

```sh
npx eas build --profile development --platform ios
npx eas build --profile production  --platform all
npx eas submit  --profile production --platform ios
```

**For the App Store, use GitHub instead:** Actions → **Notes iOS release** →
Run workflow. It builds with EAS, sets up signing the first time, and uploads
the build to App Store Connect, where it appears under TestFlight. The secrets
it needs are listed in `docs/store-setup.md` §1.8.

`eas submit` asks for what it needs at the prompt and stores nothing here. The
`submit` block in `eas.json` is deliberately empty for that reason.

### Signing

**No signing key belongs in this repository, ever.** Let EAS generate and hold
the iOS distribution certificate and the Android keystore (`eas credentials`),
or keep them offline. A leaked Android upload key cannot be revoked without
Google's help; a committed one is leaked.

### The monorepo

`metro.config.js` is Expo's default, which already understands a pnpm
workspace. Turning off Metro's hierarchical lookup, as this app once did,
breaks the build under pnpm. A package's own dependencies live beside it in
the store, and the bundler stops being able to find them.

The versions of `react-native` and the other native modules are the ones Expo
57 ships with (`expo/bundledNativeModules.json`). A version ahead of Expo's
(React Native 0.87 against Expo 57's 0.86) bundles nothing. `npx expo export
--platform ios` builds the same JavaScript bundle EAS does, on Linux, in about
a minute. Run it after changing a dependency.

`@vcwriter/domain` is consumed as its **built `dist`**, so EAS runs
`eas-build-post-install` (in `package.json`) to build it before the bundler
starts. Locally, run `pnpm --filter @vcwriter/domain build` after changing the
domain.

## What is not done

It has **never been run on a device**. This repository's CI is Linux; an iOS
build wants macOS or EAS, and neither has been done. What is proved is that it
typechecks, its tests pass, its dependencies resolve, and every rule it follows
is the domain's — the same code, under the same tests, as the website.

Store accounts are Ken's to make: Apple Developer Program ($99/yr), Google Play
($25 once, plus twelve testers for fourteen days before a new personal account
may publish to production). `docs/store-listing.md` has every field both
consoles ask for.
