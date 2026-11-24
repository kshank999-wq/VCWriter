# Addendum 48 — Updates, as VC Composer has them

From Ken, 23 November 2026: *VC Composer … has an updating software in it
that allows you to install, and it searches for updates. I want to have that
same exact feature in VC Writer.* Composer's design (its notes §53,
`desktop/src/licensing/Updater.*` and `UpdateWindow.*`) is followed point for
point; this replaces spec §3.3's "deliberate, never automatic" flow on the
Account page.

## What the writer sees

- **Help → Check for Updates…** opens a window: *This is VC Writer 1.0.60*,
  whether vc-writer.com has a newer build, **What's new** (the build's release
  notes), a progress bar while it downloads, **Install and Restart**, **Check
  Again**, **Later**, and **Install updates automatically** (on by default).
  Signed out, the button reads *Sign In to Install…* and takes them to the
  Account page: the download goes through the account. Once an update is
  downloaded the Help item reads **Install Update 1.0.61…**.
- **By itself**, eight seconds after start-up and right after signing in,
  VC Writer looks. Signed in, it downloads the update in the background; a bar
  at the top says *Downloading VC Writer 1.0.61: 40%*. Then:
  - automatic on, everything saved, nothing being read aloud or dictated, and
    no key or click for two minutes (`mayInstallUnasked`): it saves and
    installs at once;
  - automatic on otherwise: *it installs by itself the next time VC Writer
    starts*, with *Install and Restart* on the bar for now;
  - automatic off: *downloaded and ready to install*, *Install and Restart* or
    *Later*.
  - Signed out: *VC Writer 1.0.61 is available. Sign in to download it.*
- **The start after an install** says *VC Writer is updated to 1.0.61* — or
  that it did not install, why (the install log's last `FAILED:` line), with
  *Run the installer* (by hand) and *Show what happened* (the log). A failed
  install is never retried by itself; that could loop.
- The Account page's *Updates* section is the same panel.

An update never closes the app under the writer's hands: unasked, only when
they have stepped away with everything saved; otherwise at the next start.
Install and Restart always saves first.

## How

- `main/updater.ts`: check (`/api/releases`), download through the account
  (`/api/downloads/<platform>`, a short-lived signed link, spec §19) with
  progress, into the app's own `Updates` folder; the SHA-256 must match the
  catalogue or nothing is written. One installer is kept; `state.json` there
  remembers the setting, the download waiting (`ready`) and the install begun
  (`tried`), which the next start reads (`updateOutcome`).
- `main/update-install.ts`, what installing runs:
  - **Windows**: the signed NSIS installer with `/S --updated --force-run` —
    silent, over this copy where it was installed, shortcuts left as they are,
    and the new VC Writer opened when done. The app quits for it.
  - **macOS**: a script waits for this copy to quit, mounts the disk image,
    moves the old app aside, copies the new one in its place (putting the old
    one back if the copy fails), and opens it, logging each step. Where the
    app's folder cannot be written, the disk image is opened for a drag
    instead.
- `renderer/updates.tsx`: one store for the window, the bar and the Account
  page; the start-up flow; the idle rule.

Projects, settings and the natural voices live outside the app and are never
touched.

## The first update

A copy only updates itself this way from the first build that carries it.
Going from 1.0.60 to it is the old way, once: Account → Download update →
Install and restart. After that, each release published and made active
reaches writers by itself.

## Checks

`update-outcome.test.ts` (domain: the outcome, the failure reason, the idle
rule); `update-install.test.ts` (the Windows switches, and the Mac script run
for real against stand-ins for `hdiutil`, `ditto` and `open`: replaced and
opened, or the old app put back with the reason logged); `updates.test.tsx`
(the window, signing in, the background download, installing at start, the
report after an install). The installer itself runs only on a real Windows
or Mac: the first true test is one published build updating to the next.
