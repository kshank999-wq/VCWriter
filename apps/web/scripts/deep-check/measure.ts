/**
 * Measures the AI deep check (addendum 47): what it costs per 1,000 words
 * and whether its findings are worth it, on public-domain passages.
 *
 *   node scripts/deep-check/measure.ts [effort…]
 *
 * The key is read from VCW_ANTHROPIC_KEY (a cloud session keeps the name
 * ANTHROPIC_API_KEY for its own use and does not pass it on), or from
 * ANTHROPIC_API_KEY where that is set.
 *
 * Effort defaults to medium; pass `low medium` to compare. Writes
 * `results-<date>.json` beside this file (not committed) and prints a table.
 * `eveline-planted.txt` carries five slips planted in Joyce's story
 * (`planted.json`); the report says which were caught.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { DEEP_CHECK_MODEL, runDeepCheck, type DeepCheckLine, type DeepCheckRequest } from '../../src/lib/deep-check.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, 'passages', name), 'utf8');

const linesOf = (name: string, script = false): DeepCheckLine[] =>
  read(name)
    .split('\n')
    .filter((one) => one.trim())
    .map((text, index) => {
      if (!script) return { id: `${name}:${index}`, text };
      const match = /^(\w+): (.*)$/.exec(text);
      return { id: `${name}:${index}`, type: match?.[1], text: match?.[2] ?? text };
    });

const CASES: { name: string; request: Omit<DeepCheckRequest, 'effort'> }[] = [
  { name: 'great-expectations-1.txt', request: { format: 'prose', pointOfView: 'first', tense: 'past', lines: linesOf('great-expectations-1.txt') } },
  { name: 'eveline.txt', request: { format: 'prose', pointOfView: 'third-limited', viewpoint: ['Eveline'], tense: 'past', lines: linesOf('eveline.txt') } },
  { name: 'eveline-planted.txt', request: { format: 'prose', pointOfView: 'third-limited', viewpoint: ['Eveline'], tense: 'past', lines: linesOf('eveline-planted.txt') } },
  { name: 'night-of-the-living-dead.txt', request: { format: 'screenplay', lines: linesOf('night-of-the-living-dead.txt', true) } },
];

const planted: Record<string, { check: string; quote: string; what: string }[]> = JSON.parse(read('planted.json'));
const flat = (text: string) => text.replace(/[‘’]/g, "'").replace(/\s+/g, ' ').toLowerCase();

const efforts = (process.argv.slice(2).length ? process.argv.slice(2) : ['medium']) as NonNullable<DeepCheckRequest['effort']>[];
const apiKey = process.env.VCW_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Neither VCW_ANTHROPIC_KEY nor ANTHROPIC_API_KEY is set.');
  process.exit(1);
}
const client = new Anthropic({ apiKey });

const results = [];
for (const effort of efforts) {
  for (const one of CASES) {
    const started = Date.now();
    const result = await runDeepCheck({ ...one.request, effort }, client);
    const seconds = (Date.now() - started) / 1000;
    const per1000 = (result.costDollars / result.words) * 1000;
    const plants = planted[one.name] ?? [];
    const caught = plants.filter((plant) =>
      result.findings.some((finding) => flat(plant.quote).includes(flat(finding.quote)) || flat(finding.quote).includes(flat(plant.quote))),
    );
    results.push({ effort, passage: one.name, seconds, per1000, caught: caught.map((plant) => plant.what), missed: plants.filter((plant) => !caught.includes(plant)).map((plant) => plant.what), ...result });
    console.log(
      [
        effort.padEnd(6),
        one.name.padEnd(30),
        `${result.words} words`,
        `in ${result.usage.inputTokens} / out ${result.usage.outputTokens} tokens`,
        `$${result.costDollars.toFixed(4)}`,
        `$${per1000.toFixed(4)} per 1,000 words (batch $${(per1000 / 2).toFixed(4)})`,
        `${result.findings.length} findings, ${result.dropped.length} dropped`,
        plants.length ? `planted ${caught.length}/${plants.length}` : '',
        `${seconds.toFixed(0)}s`,
      ].join(' | '),
    );
    for (const finding of result.findings) {
      console.log(`    [${finding.check} ${finding.severity} ${finding.confidence}] “${finding.quote}” — ${finding.message}`);
    }
    for (const drop of result.dropped) console.log(`    DROPPED (${drop.reason}): “${drop.finding.quote}” — ${drop.finding.message}`);
  }
}

const file = join(here, `results-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(file, JSON.stringify({ model: DEEP_CHECK_MODEL, results }, null, 2));
console.log(`\nWritten to ${file}`);
