# Addendum 46 — The Edit Check and the verb dictionary

From Ken, 19 November 2026, with the *VC Writer Editor Refinement
Development Spec v1.0*: *we want to have a limited editor. We're not trying to
help people write their books. I'm very against cheating. But we do want help
in all the basic editing with point of view, grammar, let you know when things
are a little bit off. And I would also like to put in a verb dictionary.*

Asked whether this needs an AI service, the answer was no for this step: every
check here runs on the computer, offline, at no cost per use. An optional AI
"deep point-of-view check" may follow later under the spec's §7 rules —
structured findings only, no field that can carry replacement prose, opt-in.

This is a refinement of the Editors page, not a second editor: its first tab,
once **Daily**, is now the **Edit Check**, and the Daily Editor's rules feed it.

## 1. The verb dictionary (right-click)

- `scripts/build-verbs.mjs` builds `dictionary/verbs.json` (~1 MB) from
  Princeton's WordNet 3.1 verbs: for each verb, its first five senses, each
  with what it means, its synonyms and its **stronger verbs** — WordNet's
  troponyms, two levels down, ranked by how often each is used in that sense
  (walk → stumble, pace, stagger, march; look → glance, peer, gaze, stare).
  WordNet's licence is in `dictionary/LICENSE-wordnet` and the credits.
- `verb-dictionary.ts` (domain) finds the verb a word is a form of (*walked*,
  *strode*, *stopped*, *tried*) and gives every replacement the same form and
  capitals.
- The right-click menu over any word (`TextMenu.wordEntries`, so the Write
  page and every text box) leads with **Stronger verbs for "walked"** and a
  **Verb dictionary…** panel of every meaning. A click replaces that one word.
  The Moby thesaurus's synonyms follow, as before.

## 2. The Edit Check

**Run Edit Check** (whole project, current section or current beat) builds a
review and changes nothing (§6). The review is kept in the project's settings
(`editorReview`), never in the manuscript; the profile (`editor`) holds prose
or screenwriting rules, spelling dialect, point of view, tense, viewpoint
characters and per-section overrides.

Findings come from three places, merged, the same words flagged twice by two
checkers counted once:

- **Harper** (Apache-2.0), a grammar checker running in the app as
  WebAssembly (`grammar-check.ts`): spelling in the chosen dialect, agreement,
  wrong word forms, doubled words. A capitalised unknown word is asked about
  as a possible name, never "corrected"; in speech, a spelling is asked about
  as possibly the character's voice. Harper's long-sentence, spacing,
  unclosed-quote, Oxford-comma and ellipsis rules are off (the Edit Check has
  its own, or they are house style).
- **The Edit Check's own rules** (`edit-rules.ts`): punctuation (spaces,
  doubled marks, the comma before a speech tag, unbalanced quotes, a
  paragraph with no closing mark); style and clarity (passive voice as a note,
  weak qualifiers, a general verb carried by an adverb, wordy phrases,
  clichés, long sentences, repeated openings and words, even rhythm); point
  of view and tense by profile (another mind in first person, narrator shifts,
  head-hopping against the viewpoint characters in third limited, inner
  states in objective, tense slips); and screenplay format.
- **The Daily Editor's rules** not duplicated above (filter words, hedged
  action, camera directions, common misspellings, *could of*, a script's
  shape). Its "likely typo" guess is left out: Harper's spelling replaces it.

Craft rules read narration only; quoted speech and script dialogue are the
characters'. Only an **error** may carry a fix, and only a narrow one (three
words, no sentence) — `isNarrowFix`, checked again where it is applied.

## 3. The review screen

Queue down the left (grouped by category, filtered by open, new since last
check, deferred, done, and by error / possible concern / note); the passage
across the middle, the words highlighted, about a page of context on request,
editable where it stands; down the right why it was flagged, the rule, how
sure, and **Accept fix** (mechanical only), **Edit it yourself**, **Dismiss**,
**Mark intentional**, **Defer**, *Add to the project dictionary*, *Stop
checking this rule* (and a way to switch it back on). Keys: ↑ ↓ (or K J), A,
E, D, I, F. **Go to manuscript** and back returns to the same finding.

Decisions are kept by rule, line and words, so they outlive a re-check and
lapse when the words change; a finding whose words have gone is marked stale
and cannot be fixed. There is no "fix all": every change is the writer's,
one at a time.

When a project opens with open items from the last check, a dismissible bar
offers **Continue review** or **Start writing**.

## 4. Not in this step

The optional AI check; pacing advisories beyond scene-length and long-action
rules; per-section overrides in the screen itself (the profile holds them);
review reporting.
