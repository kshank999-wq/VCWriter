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

## Credits (to build after the measurement)

- Packs of **$5, $10 and $20**, one-time Stripe payments, bought from the
  account page and from **Edit → Buy edit credits…** in the app.
- Priced at **no less than $0.25 per 1,000 words** checked, against a cost
  measured at a few cents. The app shows an estimate before each run.
- The check runs on the server (the key never ships in an installer), opt-in,
  with a plain statement that the passage is sent to Anthropic for the check.

## Measuring

`apps/web/scripts/deep-check/measure.ts` runs the check on public-domain
passages (Great Expectations ch. 1, Joyce's *Eveline* plain and with five
planted slips listed in `planted.json`, the Night of the Living Dead sample)
and reports cost per 1,000 words, the half-price batch cost, and which planted
slips were caught. Needs `ANTHROPIC_API_KEY` in the environment.
