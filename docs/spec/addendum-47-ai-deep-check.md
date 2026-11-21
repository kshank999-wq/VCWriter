# Addendum 47 — The AI deep check and edit credits

From Ken, 20 November 2026: the AI edit features are a separate, paid extra,
bought as credits marked up as a revenue stream. *It will not do any
rewriting.* The model is **Opus 5.5**, and whatever the Opus level becomes
(5.6, 5.7) — one constant, `DEEP_CHECK_MODEL` in `apps/web/src/lib/deep-check.ts`.

## What it checks

What the Edit Check's rules (addendum 46) cannot judge: point of view
(head-hopping, unearned knowledge, omniscient drift, told apart from free
indirect style), unclear pronouns, continuity within the passage, telling at
a dramatised moment, dialogue voices and attribution, pacing, setups dropped.

## Never rewrites

The response has no field for replacement wording. `guardFindings` drops a
finding whose quote is not on its line, or whose explanation quotes four or
more words the passage lacks, or reads as replacement advice. Dropped
findings are counted. Marketing line: **AI editing that never rewrites. No
cheaters.**

## Credits

- Packs of **$5, $10 and $20**, one-time Stripe payments, bought from the
  account page and from **Edit → Buy edit credits…** in the app.
- Set by Ken, 20 November 2026, after the measurement below (round numbers;
  this replaces the earlier floor of $0.25 per 1,000 words):

  | Pack | Words checked | Per 1,000 words |
  | --- | --- | --- |
  | $5 | 20,000 | $0.25 |
  | $10 | 50,000 | $0.20 |
  | $20 | 100,000 | $0.20 |

- A credit is 1,000 words checked. Each run is charged at least 1,000 words,
  then rounded up to the next 250, which covers the fixed instructions every
  run carries (about 1,900 tokens, $0.008). The app shows an estimate before
  each run.
- The check runs on the server (the key never ships in an installer), opt-in,
  with a plain statement that the passage is sent to Anthropic for the check.

## As built (21 November 2026)

- **Ledger** (migration 0090, `edit_credit_entries`): one row per purchase,
  check, refund or reversal, in words; the balance is the sum. Writers read
  their own rows; only the server writes. `spend_edit_credits` takes a lock
  per writer and refuses a check the balance cannot cover.
- **Buying**: the account page's *Edit credits* section
  (`account/edit-credits.tsx`) starts a one-time Stripe Checkout naming only
  the pack id (`/api/edit-credits/checkout`); the webhook adds the words once
  per checkout (`kind: edit-credits` in the metadata) and takes them back on
  a refund or dispute. Tax is Stripe Tax, added on top.
- **In the app**: *Editor → Edit Check*, *AI check…* and *Buy edit credits…*
  (which opens the account page). The Edit Check has an **AI check…** button
  beside *Run Edit Check*: it shows words, cost in credits and balance, says
  the passage goes to Anthropic, and runs scene by scene
  (`splitIntoRuns`: a scene whole up to 6,000 words; short scenes share a
  run), with *Stop after this part*.
- **The run** (`/api/ai/deep-check`): charged first, refunded if the check
  fails, its token cost written on its ledger row.
- **In the review**: findings are `source: 'ai'`, a possible concern or a note,
  never a fix. They replace the last AI check's findings on the same lines,
  and they survive a re-run of the Edit Check while their words are unchanged
  (they were paid for). Continuity and dropped setups are a new category,
  *Story & continuity*.

## Measuring

`apps/web/scripts/deep-check/measure.ts` runs the check on public-domain
passages (Great Expectations ch. 1, Joyce's *Eveline* plain and with five
planted slips listed in `planted.json`, the Night of the Living Dead sample)
and reports cost per 1,000 words, the half-price batch cost, and which planted
slips were caught. Needs the key as `VCW_ANTHROPIC_API_KEY` (or `VCW_ANTHROPIC_KEY`) in the cloud environment (a session does not pass `ANTHROPIC_API_KEY` on).

### Measured, 20 November 2026

Opus 5.5 at list price ($4 / $20 per million tokens), one run per passage:

| Passage | Words | Low | Medium |
| --- | --- | --- | --- |
| Great Expectations ch. 1 | 1,815 | $0.0103 | $0.0103 |
| Eveline | 1,818 | $0.0153 | $0.0216 |
| Eveline, planted | 1,886 | $0.0159 | $0.0207 |
| Night of the Living Dead | 398 | $0.0614 | $0.0743 |

Cost per 1,000 words; batch is half. Prose runs about 2¢ per 1,000 words at
medium, so even the $0.20 packs are about ten times cost. Short passages cost
more per word because of the fixed instructions, hence the per-run minimum.

Planted slips: 4 of 5 caught at both efforts, all at high confidence — the
three point-of-view slips and the morning sun. The planted pronoun ("He would
read it in the morning") was missed both times; the check instead flagged a
real ambiguity in Joyce's own text ("Whenever he showed the photograph…").
Nothing was flagged in Dickens; nothing was dropped by the no-rewrite guard.
In the screenplay it caught the television that was never set up.

Weak spots: pronouns; notes that complain of where an excerpt ends (Johnny's
fate, the cemetery man); Dickens came back with 10 output tokens in a second,
so it barely thought before finding nothing. Low effort adds noise for little
saving. **Default effort: medium.** Four passages and five plants is a small
sample: add more before quoting a catch rate.

`costOf` prices cache reads at 0.1× input; Opus 5.5 charges 0.05×. No run used
the cache, so these figures stand, but fix it before caching is turned on.
