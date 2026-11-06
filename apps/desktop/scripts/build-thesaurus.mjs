// Builds src/renderer/dictionary/thesaurus.txt from Moby Thesaurus II
// (mthesaur.txt, Project Gutenberg ebook #3202, public domain).
//
//   node scripts/build-thesaurus.mjs /path/to/mthesaur.txt
//
// One line per root word: `root|syn,syn,…`. Kept to single words and short
// phrases, at most 16 a word, ranked by closeness: how many synonyms the two
// words share (cosine of their lists), more for words that list each other,
// single words before phrases.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('Pass the path to mthesaur.txt');
const raw = readFileSync(source, 'utf8').split(/\r?\n/).filter(Boolean);
const lists = new Map();
for (const line of raw) {
  const [root, ...rest] = line.split(',');
  if (!root || /\s/.test(root.trim()) && root.trim().split(/\s+/).length > 2) continue;
  lists.set(root.trim().toLowerCase(), rest.map((one) => one.trim()).filter(Boolean));
}
const sets = new Map([...lists].map(([root, words]) => [root, new Set(words.map((one) => one.toLowerCase()))]));
const lines = [];
for (const [root, words] of lists) {
  if (/[^a-z' -]/.test(root)) continue;
  const mine = sets.get(root);
  const kept = words
    .filter((word) => word.toLowerCase() !== root && /^[A-Za-z' -]+$/.test(word) && word.split(/\s+/).length <= 2)
    .map((word, index) => {
      const theirs = sets.get(word.toLowerCase());
      let shared = 0;
      if (theirs) {
        const [small, large] = theirs.size < mine.size ? [theirs, mine] : [mine, theirs];
        for (const one of small) if (large.has(one)) shared += 1;
      }
      const closeness = theirs ? shared / Math.sqrt(mine.size * theirs.size) : 0;
      const mutual = theirs?.has(root) ? 0.15 : 0;
      const phrase = /\s/.test(word) ? -0.2 : 0;
      return { word, index, score: closeness + mutual + phrase };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 16)
    .map((one) => one.word);
  if (kept.length > 0) lines.push(`${root}|${kept.join(',')}`);
}
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'renderer', 'dictionary', 'thesaurus.txt');
writeFileSync(out, `${lines.join('\n')}\n`);
console.log(`${lines.length} words, ${(Buffer.byteLength(lines.join('\n')) / 1e6).toFixed(2)} MB → ${out}`);
