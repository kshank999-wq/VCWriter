// Open-source credits for the desktop program (addendum 45 §4).
//
//   node scripts/credits.mjs          writes the files below
//   node scripts/credits.mjs --check  fails if they are out of date (run by the tests)
//
// Walks every package the installed program carries — the main process's
// dependencies, which ship in node_modules, and the packages the renderer
// bundles (React, the domain's Zod) — and writes:
//
//   licenses/THIRD-PARTY-NOTICES.txt  every package with its own licence text,
//                                     shipped inside the installer
//   licenses/GPL-3.0.txt              the GPL, for eSpeak NG
//   ../web/src/lib/credits.json       the list behind vc-writer.com/credits
//
// Things that are not npm packages (eSpeak NG inside phonemizer, the Kokoro
// voices, the spelling dictionary, the thesaurus) are listed by hand in EXTRA.
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const desktop = join(here, '..');
const domain = join(desktop, '..', '..', 'packages', 'domain');
const web = join(desktop, '..', 'web');
const check = process.argv.includes('--check');

/** Finds a package the way Node does: up the folders from where it is asked for. */
const find = (name, from) => {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name, 'package.json');
    if (existsSync(candidate)) return dirname(realpathSync(candidate));
    if (dirname(dir) === dir) return null;
  }
};

const MIT = (holder) =>
  `MIT License\n\nCopyright (c) ${holder}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.`;

/** Packages published without their licence file: the text from their source repository. */
const MISSING_TEXT = {
  'onnxruntime-common': MIT('Microsoft Corporation'),
  'onnxruntime-node': MIT('Microsoft Corporation'),
};

const licenceText = (dir, name) => {
  const file = readdirSync(dir).find((one) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(one));
  return file ? readFileSync(join(dir, file), 'utf8').trim() : MISSING_TEXT[name] ?? null;
};

const urlOf = (pkg) => {
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const raw = pkg.homepage || repo || `https://www.npmjs.com/package/${pkg.name}`;
  return raw.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '').replace(/^github:/, 'https://github.com/');
};

const seen = new Map();
const walk = (name, from, { leaf = false } = {}) => {
  const dir = find(name, from);
  if (!dir) throw new Error(`Cannot find ${name} from ${from}`);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key)) return;
  const licence = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? (pkg.licenses ?? []).map((one) => one.type).join(' OR ');
  seen.set(key, { name: pkg.name, version: pkg.version, licence: licence || 'See the package', url: urlOf(pkg), text: licenceText(dir, pkg.name) });
  if (leaf) return;
  for (const dep of Object.keys(pkg.dependencies ?? {})) walk(dep, dir);
};

const own = JSON.parse(readFileSync(join(desktop, 'package.json'), 'utf8'));
for (const dep of Object.keys(own.dependencies ?? {})) walk(dep, desktop);
for (const dep of ['react', 'react-dom']) walk(dep, desktop);
walk('zod', domain);
// Electron's own npm dependencies only download it; the program it ships is
// credited by Electron, whose installer also carries LICENSES.chromium.html.
walk('electron', desktop, { leaf: true });

const EXTRA = [
  {
    name: 'eSpeak NG',
    version: '(inside phonemizer 1.2.1)',
    licence: 'GPL-3.0-or-later',
    url: 'https://github.com/espeak-ng/espeak-ng',
    note:
      'Turns words into speech sounds for the natural voices. It is included in the phonemizer package, compiled to WebAssembly. Its source code is at https://github.com/espeak-ng/espeak-ng, and the build used is at https://github.com/xenova/phonemizer.js. The full licence is in GPL-3.0.txt beside this file.',
  },
  {
    name: 'Kokoro-82M voices',
    version: 'v1.0',
    licence: 'Apache-2.0',
    url: 'https://huggingface.co/hexgrad/Kokoro-82M',
    note: 'The natural voices. Downloaded on request, not shipped in the installer. ONNX conversion by onnx-community (https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX). Text preparation ported from kokoro-js (Apache-2.0).',
  },
  {
    name: 'en_US Hunspell dictionary (SCOWL)',
    version: '2020.12.07',
    licence: 'MIT AND BSD-style',
    url: 'http://wordlist.aspell.net',
    note: 'The spelling dictionary.',
    text: readFileSync(join(desktop, 'src', 'renderer', 'dictionary', 'LICENSE-dictionary-en'), 'utf8').trim(),
  },
  {
    name: 'Moby Thesaurus II',
    version: 'Project Gutenberg #3202',
    licence: 'Public domain',
    url: 'https://www.gutenberg.org/ebooks/3202',
    note: 'The thesaurus, by Grady Ward.',
  },
];

const missing = [...seen.values()].filter((one) => !one.text).map((one) => one.name);
if (missing.length > 0) throw new Error(`No licence text for: ${missing.join(", ")}. Add it to MISSING_TEXT.`);
const packages = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
const all = [...EXTRA, ...packages];

const rule = '-'.repeat(78);
const notices = [
  'VC Writer — open-source credits',
  '',
  'VC Writer is built with the free and open-source software below, and thanks',
  'everyone who made it. Each entry gives its licence; the licence texts follow.',
  'The list is also at https://vc-writer.com/credits.',
  '',
  ...all.flatMap((one) => [
    rule,
    `${one.name} ${one.version}`,
    `Licence: ${one.licence}`,
    one.url,
    ...(one.note ? ['', one.note] : []),
    ...(one.text ? ['', one.text] : []),
    '',
  ]),
].join('\n');

const listing = JSON.stringify(
  all.map(({ name, version, licence, url, note }) => ({ name, version, licence, url, ...(note ? { note } : {}) })),
  null,
  2,
) + '\n';

const gpl = readFileSync(join(here, 'GPL-3.0.txt'), 'utf8');
const outputs = [
  [join(desktop, 'licenses', 'THIRD-PARTY-NOTICES.txt'), notices + '\n'],
  [join(desktop, 'licenses', 'GPL-3.0.txt'), gpl],
  [join(web, 'src', 'lib', 'credits.json'), listing],
];

if (check) {
  const stale = outputs.filter(([file, text]) => !existsSync(file) || readFileSync(file, 'utf8') !== text).map(([file]) => file);
  if (stale.length > 0) {
    console.error(`Out of date — run node scripts/credits.mjs:\n${stale.join('\n')}`);
    process.exit(1);
  }
  console.log(`Credits up to date: ${all.length} entries.`);
} else {
  for (const [file, text] of outputs) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  console.log(`Wrote credits for ${all.length} entries.`);
}
