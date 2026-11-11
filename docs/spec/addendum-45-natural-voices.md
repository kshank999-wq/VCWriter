# Addendum 45 — Natural voices for read-back

From Ken, 8 November: *I want to get nice voices for the readback function.
The ones we're using now sound like robots.* He had found a site selling a
"free forever" text-to-speech API. Its voice names and parameters are those of
Microsoft Edge's built-in Read Aloud service, which nobody is licensed to
resell. It allows ten requests a minute and sends the manuscript to a third
party, so we did not build on it. Read back now offers natural voices that run
on the writer's own computer.

## 1. What the writer sees

- **Read back, not yet installed:** a box offers *Get natural voices*:
  about 100 MB, free, runs on this computer, works offline, and sends nothing
  anywhere. Clicking it downloads with a progress bar.
- **Installed:** the box says so and offers **Remove**.
- **The voice lists:** the narrator and every character list the fourteen
  natural voices first (*Heart (natural) · American · female*), then the
  system voices.
- **Defaults:** **George**, a British male, becomes the default narrator,
  after Ken's choice of Daniel among the system voices.
- **Suggest a cast:** casts from the natural voices first.
- **Highlighting:** the word being read is lit as before. The model gives no
  word timings, so the highlight follows how far through the line's sound
  playback is, with each word weighted by its length (`wordAtFraction`).
- **Fallback:** a natural voice on a computer without the voices installed
  is read by the system voice, as is any line the natural voice fails on.
- **Browser preview:** there is no natural-voices bridge, so nothing about
  them shows and read-back uses the browser's voices.

## 2. The model

**Kokoro-82M v1.0** (Apache 2.0), in the 8-bit ONNX build
(`onnx-community/Kokoro-82M-v1.0-ONNX`, `onnx/model_quantized.onnx`, 92 MB).

We offer the fourteen voices its model card grades C or better
(`NATURAL_VOICES`):

- **American female:** Heart, Bella, Nicole, Aoede, Kore, Sarah, Nova
- **American male:** Michael, Fenrir, Puck
- **British female:** Emma, Isabella
- **British male:** George, Fable

The rest sound broken. Each voice is a small style file, one 256-number style
per line length.

On a 2020s laptop a line takes about a second to generate. Read back
generates the next line while the current one plays, so a scene runs without
pauses once it has started; the first line waits for the model to load
(about 2–3 s).

## 3. How it is built

- **`packages/domain/src/natural-voices.ts`** holds the pure parts:
  - the catalogue and the files to fetch
  - the text normalisation (titles, years, times, money, decimals)
  - the split into words and punctuation
  - the reference phoneme fixes
  - the symbol table lookup and style offset
  - the split of long passages into sentences
  - the word-highlight position

  Ported from kokoro-js (Apache 2.0); tested in `natural-voices.test.ts`.
- **`apps/desktop/src/main/natural-voices-engine.ts`** turns words into
  phonemes with eSpeak NG (the `phonemizer` package) and runs the model with
  `onnxruntime-node`. Its output matches kokoro-js sample for sample. It is
  plain Node, so `natural-voices-engine.test.ts` drives it against a real
  model when `VCW_NATURAL_MODEL` points at one.
- **`natural-voices-worker.ts`** runs the engine in an Electron **utility
  process**, so generating a line never holds up the window.
- **`natural-voices.ts`** (main) fetches the files on request with
  Electron's `net`, which honours the system proxy. They go to
  `userData/natural-voices/kokoro-82m-v1.0/`, each written to `.part` and
  renamed. A manifest is written last, so an interrupted download is never
  taken as installed. It also exposes `naturalVoices:status | install |
  remove | speak`; `speak` returns mono Float32 samples at 24 kHz.
- **`apps/desktop/src/renderer/natural-voices.ts`** holds
  `useNaturalVoices` and `NaturalPlayer`, which plays through Web Audio and
  keeps the last forty lines so a replay is instant.
- **Packaging:** `onnxruntime-node` is unpacked from the archive, since a
  native library cannot load from inside it. Each installer keeps only its
  own platform's build of it (about 35 MB). The Mac universal build lists the
  library under `x64ArchFiles`, because both architectures already ship side
  by side.

Not done in this test version: the Document workspace's *Read aloud* and the
Sculptor's board player still use the system voices.

## 4. To settle before release

**The phoneme step uses eSpeak NG, which is GPL-3.0.** The `phonemizer`
package is labelled Apache 2.0, but it is eSpeak NG compiled to WebAssembly,
so the GPL is what governs it. Shipping it inside a closed-source paid app
needs either a legal opinion that this use is acceptable, or a replacement:

- **misaki's English pronouncing lexicons** (Apache 2.0, already in Kokoro's
  phoneme set), with a fallback for words not in them. This is the
  recommended route.
- **A licensed G2P library.**

The interface (`phonemesOf` in the engine) is one function, so the swap
touches nothing else.

**Decision (Ken, 11 November): keep eSpeak NG.** No commercial licence for
it can be bought: it has many authors and is offered only under the GPL. Ken
weighed the replacement above (misaki's lexicons, slightly weaker on unusual
names) against the risk, judged the risk low, and keeps eSpeak NG without
seeking legal advice. The replacement stays the way out if that ever changes:
it is one function.

**Open-source credits.** What the GPL and the other licences ask for in any
case is done:

- `apps/desktop/scripts/credits.mjs` walks every package the installer
  carries (the main process's dependencies and what the renderer bundles) and
  writes `apps/desktop/licenses/THIRD-PARTY-NOTICES.txt`, with each package's
  licence text, `licenses/GPL-3.0.txt`, and `apps/web/src/lib/credits.json`.
  Things that are not npm packages — eSpeak NG, the Kokoro voices, the
  spelling dictionary, the thesaurus — are listed by hand in it.
- electron-builder copies `licenses/` into the installed program as
  `resources/licenses`.
- **Help → Open-source credits** opens vc-writer.com/credits, linked from
  the site footer too, which names eSpeak NG and where its source is.
- `src/main/__tests__/credits.test.ts` runs the script with `--check`, so a
  dependency change that is not re-credited fails the tests. Run
  `node scripts/credits.mjs` in `apps/desktop` to bring it up to date.

## 5. More voices from elsewhere

From Ken: *giving customers the option to get more voices somewhere else for
themselves … they could go pay and the voices can be integrated.*

A voice assignment already stores a provider id and an opaque voice id, so a
writer's own account with a cloud voice service fits without changing the
project file. The plan:

- a provider per service (ElevenLabs, Microsoft Azure Speech, OpenAI)
- the writer's API key stored with Electron `safeStorage`, never synced
- the service's voices listed after the natural ones, marked with the service

Lines read by such a provider leave the computer for that service, so its
box says so plainly. This is not built yet.

## 6. Mac and Windows system voices compared

**Windows** gives apps only the old SAPI voices: David, Zira and Mark. Its
newer *natural* voices are kept for Narrator and Edge.

**A Mac** offers Premium and Enhanced voices to apps once downloaded in
System Settings ▸ Accessibility ▸ Spoken Content. They are much better, but
most writers never download them.

The natural voices are the same on both, which is the point.

## 7. In the Read back box

From Ken, after trying 1.0.21: *the voices sound much better, but I can't get
to them. They're smashed down at the bottom … the box doesn't stretch … it
says all the Google voices.*

- **The box stretches:** it has a resize grip at its corner. Everything under
  its bar scrolls as one panel. Each part keeps its own height, rather than
  each being squeezed to a sliver with its own scrollbar.
- **The script takes a share of the box:** about a third of the window by
  default, and its own corner makes it taller.
- **Once natural voices are installed, only they are listed.** A tick, *Also
  list this computer's own voices*, brings the system and browser voices back,
  and is remembered. A system voice already given to someone stays in the
  lists so the choice still shows.
- **In the browser preview**, which cannot run natural voices, the panel says
  they come with the desktop app.
