// Builds src/renderer/dictionary/verbs.json, the verb dictionary (editor spec
// §4, from Ken, 19 November: *a verb dictionary… right-click on a word and
// open up a verb dictionary or thesaurus to replace weak verbs*), from
// Princeton's WordNet 3.1 verbs.
//
//   node scripts/build-verbs.mjs /path/to/wordnet/dict
//
// (The `wordnet-db` package on npm carries the dict folder.) WordNet's licence
// allows this with its notice kept: dictionary/LICENSE-wordnet.
//
// What a writer replacing a weak verb wants is the more specific ways of
// doing the same thing — WordNet's troponyms: walk → stride, amble, trudge,
// stagger. For each verb, its first senses: what the sense means, its
// synonyms, and those stronger verbs.
//
// Shape: { s: [[meaning, synonyms[], stronger[]], …], i: { verb: [sense, …] } }
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dict = process.argv[2];
if (!dict) throw new Error('Pass the WordNet dict folder');
const MAX_SENSES = 5;
const MAX_MEANING = 100;
const MAX_STRONGER = 30;

const synsets = new Map();
for (const line of readFileSync(join(dict, 'data.verb'), 'utf8').split('\n')) {
  if (!line || line.startsWith('  ')) continue;
  const [head, glossRaw = ''] = line.split(' | ');
  const parts = head.trim().split(' ');
  const count = parseInt(parts[3], 16);
  const words = [];
  for (let k = 0; k < count; k += 1) words.push(parts[4 + k * 2].replace(/\(.*\)$/, '').replace(/_/g, ' '));
  let at = 4 + count * 2;
  const pointers = Number(parts[at]);
  at += 1;
  const tropo = [];
  for (let k = 0; k < pointers; k += 1) {
    const [symbol, target, targetPos] = parts.slice(at, at + 3);
    if (symbol === '~' && targetPos === 'v') tropo.push(target);
    at += 4;
  }
  let meaning = glossRaw.split(';')[0].replace(/"/g, '').trim();
  if (meaning.length > MAX_MEANING) meaning = `${meaning.slice(0, MAX_MEANING - 1).replace(/\s+\S*$/, '')}…`;
  synsets.set(parts[0], { meaning, words, tropo });
}

// How often each verb is used: WordNet's sense-tagged counts, summed per word
// (index.sense). Common verbs first — *stride* before *lollop*.
// Counted per meaning, not per word: *make* is common, but rarely as a way of
// going somewhere.
const used = new Map();
for (const line of readFileSync(join(dict, 'index.sense'), 'utf8').split('\n')) {
  const [key, offset, , count] = line.split(' ');
  if (!key || !key.includes('%2:')) continue;
  const verb = key.slice(0, key.indexOf('%')).replace(/_/g, ' ');
  used.set(`${verb} ${offset}`, Number(count || 0));
}
const often = (word, offset) => used.get(`${word} ${offset}`) ?? 0;

const keep = new Map();
const index = {};
for (const line of readFileSync(join(dict, 'index.verb'), 'utf8').split('\n')) {
  if (!line || line.startsWith('  ')) continue;
  const parts = line.trim().split(' ');
  const verb = parts[0].replace(/_/g, ' ');
  // Single words only: the menu replaces one word.
  if (verb.includes(' ') || !/^[a-z]+$/.test(verb)) continue;
  const senses = Number(parts[2]);
  const pointerCount = Number(parts[3]);
  const offsets = parts.slice(6 + pointerCount, 6 + pointerCount + senses).slice(0, MAX_SENSES);
  index[verb] = offsets.map((offset) => {
    if (!keep.has(offset)) keep.set(offset, keep.size);
    return keep.get(offset);
  });
}

const single = (word) => /^[a-z]+$/.test(word);
const table = [];
for (const [offset, id] of keep) {
  const one = synsets.get(offset);
  const synonyms = one.words.filter(single);
  // Two levels down — walk → stride, and march → goose-step — the commoner
  // first, and the nearer before the further where they are as common.
  const found = new Map();
  const seen = new Set(synonyms);
  for (const [level, offsets] of [[0, one.tropo], [1, one.tropo.flatMap((o) => synsets.get(o)?.tropo ?? [])]]) {
    for (const target of offsets) {
      for (const word of synsets.get(target)?.words.slice(0, 2) ?? []) {
        if (!single(word) || seen.has(word) || found.has(word)) continue;
        found.set(word, (often(word, target) + 0.5) * (level === 0 ? 1 : 0.5));
      }
    }
  }
  const stronger = [...found.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_STRONGER)
    .map(([word]) => word);
  synonyms.sort((a, b) => often(b, offset) - often(a, offset));
  table[id] = [one.meaning, synonyms, stronger];
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'renderer', 'dictionary', 'verbs.json');
const json = JSON.stringify({ s: table, i: index });
writeFileSync(out, json);
console.log(`${Object.keys(index).length} verbs, ${table.length} senses, ${(json.length / 1e6).toFixed(2)} MB → ${out}`);
