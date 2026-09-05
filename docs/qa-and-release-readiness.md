# QA matrix and release readiness

Phase 8. What the automated suite covers, what only a person on real hardware
can cover, and what has to be true before a first release.

## What is automated

| Guard | Where | Catches |
| --- | --- | --- |
| Domain suite (175 tests) | `packages/domain` | Every rule about structure, pagination, merging, licensing, redaction — the logic all three platforms share |
| Cross-platform suite | CI on `windows-latest` and `macos-latest` | Anything that quietly depends on the host: path separators, line endings, timezone, filename casing |
| Performance floors | `packages/domain/src/__tests__/performance.test.ts` | A change that makes an operation quadratic on a 600-beat project. Not a benchmark — a tripwire |
| Content security policy | `pnpm --filter @vcwriter/web check:csp` | Scripts blocked in a real browser. Nothing else in the suite can see this |
| Typecheck, build | CI | The ordinary things |

Run the whole lot locally with `pnpm -r typecheck && pnpm -r test && pnpm -r build`.
The CSP check needs the site built first and is a separate command because it
starts a server and drives a browser.

## The cross-platform matrix

The project format is platform-neutral by design (§3.1), and CI runs the domain
and project-store suites on all three operating systems, so a file written on
one opens on another. What CI cannot do is launch the application.

| Target | Version | Why it is in the matrix |
| --- | --- | --- |
| Windows 10 | 22H2 (build 19045) | The oldest supported build; `minimumOsVersion` on the release row must match |
| Windows 11 | 23H2 or later | Different window chrome, different SmartScreen behaviour |
| macOS | 11 Big Sur | The floor set in `electron-builder.yml` |
| macOS | 14 or later, Apple silicon | The common case; also where notarisation and Gatekeeper are strictest |
| macOS | Intel | The `x64` artifact is built and must be checked at least once |

## What only a person can check

Everything below needs the application launched on real hardware. None of it is
covered by any test in this repository, and it should be worked through once
per platform before a release.

### Opening and writing

- [ ] The application launches. **Note:** the renderer now runs with
      `sandbox: true`; this was verified by inspecting the built preload, not
      by launching it, so this line is not a formality.
- [ ] Create a project, write in a beat, close the app, reopen it — the writing
      is there.
- [ ] Kill the process mid-sentence. Reopen. The file is intact and at most one
      autosave interval was lost.
- [ ] A project created on Windows opens on macOS and vice versa.
- [ ] Focus mode (Ctrl/Cmd+Shift+F) and Escape.

### Keyboard and screen reader

- [ ] Tab reaches every control on the structure board, and the focus ring is
      visible on each.
- [ ] Alt+↑/↓ reorders a lane, a scene and a beat. Alt+Shift+↑/↓ moves a scene
      between lanes and a beat between scenes.
- [ ] Narrator (Windows) or VoiceOver (macOS) announces lane and scene names,
      and reads the reorder handle's instructions.
- [ ] The app is usable at 150% and 200% system text scaling.

### Recovery

- [ ] Restore a snapshot; confirm the version you had is snapshotted first.
- [ ] Force a sync conflict by editing the same beat on two machines. Confirm:
      the status line names what was overwritten, Recovery shows the losing
      text, and putting it back works and survives the next sync.
- [ ] Confirm a `pre_sync` snapshot was written before the conflicted merge.

### Print and export

- [ ] Export a PDF and check pagination against the page count in the header.
- [ ] Print to a real printer or a PDF printer.
- [ ] Beat titles are absent unless explicitly included (§5.3).

### Commerce, end to end, on live keys

- [ ] Buy on live Stripe keys, on each platform's download page.
- [ ] Exactly one license exists afterwards. Replay the webhook and confirm
      still exactly one.
- [ ] The confirmation email arrives with the right platform and serial.
- [ ] Sign in later and re-download.
- [ ] Activate on two machines; the third is refused with a message that says
      how to free a seat. Free one and activate again.
- [ ] Refund the purchase and confirm the license is revoked.

### Update

- [ ] With an older version installed, the updater offers the new one.
- [ ] A build whose `minimumOsVersion` is above the machine is not offered.
- [ ] Corrupt the published checksum and confirm the download is refused and
      discarded rather than installed.

## Before a first release

Ordered, because some of these block others.

1. [ ] Rotate the Supabase database password (exposed in a Drive document
       during Phase 1).
2. [ ] Obtain the Windows signing certificate and the Apple Developer
       membership; set the CI secrets. See [code-signing.md](code-signing.md).
3. [ ] Tag a release; confirm both platforms package and that `spctl` and
       `Get-AuthenticodeSignature` come back clean.
4. [ ] Work the manual matrix above on each target.
5. [ ] Add rate limiting to the unauthenticated routes
       ([security-review.md](security-review.md) lists which).
6. [ ] Upload the installers at `/admin/releases`, verify the checksums, then
       activate them.
7. [ ] One live purchase → download → install → activate → update, on real
       hardware, on both platforms.
