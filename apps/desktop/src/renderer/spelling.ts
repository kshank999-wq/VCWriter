import nspell from 'nspell';
import aff from './dictionary/en.aff?raw';
import dic from './dictionary/en.dic?raw';

/**
 * Spelling and the thesaurus for every right-click menu in the program (from
 * Ken: *when you right click, it should give you suggestions, thesaurus, and
 * all that, just like the word processor… across every module*).
 *
 * **Why a dictionary of our own.** The menus used to ask Electron's in-page
 * checker (`webFrame.isWordMisspelled`). That checker only has a dictionary
 * where Electron uses Hunspell; on macOS and Windows the red underline comes
 * from the operating system instead, so the underline was there and the menu
 * was told the word was fine, and offered nothing. Here the menu reads an
 * English Hunspell dictionary bundled with the app (dictionary-en, MIT/BSD,
 * see `dictionary/LICENSE-dictionary-en`), the same on every platform and in
 * the browser preview. The thesaurus is Moby Thesaurus II (public domain),
 * cut to sixteen synonyms a word ranked by closeness, and loaded after start-up.
 *
 * The words a writer adds are kept on this machine and also handed to the
 * operating system's dictionary, so its underline goes too.
 */

type Checker = ReturnType<typeof nspell>;
let checker: Checker | null = null;
const PERSONAL_KEY = 'vcwriter.dictionary.personal';
const projectWords = new Set<string>();

const personal = (): string[] => {
  try {
    const raw = localStorage.getItem(PERSONAL_KEY);
    const words = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(words) ? words.filter((one): one is string => typeof one === 'string') : [];
  } catch {
    return [];
  }
};

/** The dictionary, built the first time it is asked for (about a fifth of a second). */
const ready = (): Checker => {
  if (checker) return checker;
  checker = nspell(aff, dic);
  for (const word of personal()) checker.add(word);
  for (const word of projectWords) checker.add(word);
  return checker;
};

let thesaurus: Map<string, string[]> | null = null;
let loadingThesaurus: Promise<void> | null = null;

/** The thesaurus, read from its own file the first time it is wanted. */
export const loadThesaurus = (): Promise<void> => {
  if (thesaurus) return Promise.resolve();
  loadingThesaurus ??= import('./dictionary/thesaurus.txt?raw').then((module) => {
    const map = new Map<string, string[]>();
    for (const line of module.default.split('\n')) {
      const bar = line.indexOf('|');
      if (bar > 0) map.set(line.slice(0, bar), line.slice(bar + 1).split(','));
    }
    thesaurus = map;
  });
  return loadingThesaurus;
};

/** Build the dictionary and read the thesaurus while nothing else is happening, so the first right-click is instant. */
export const warmSpelling = (): void => {
  const go = () => {
    try {
      ready();
    } catch {
      // A menu asked later builds it then.
    }
    void loadThesaurus().catch(() => undefined);
  };
  const idle = (window as unknown as { requestIdleCallback?: (run: () => void) => void }).requestIdleCallback;
  if (idle) idle(go);
  else setTimeout(go, 1500);
};

/**
 * The project's own names are words: a character, a place. Called with the
 * cast and the places whenever they change.
 */
export const setProjectWords = (words: Iterable<string>): void => {
  const next = new Set<string>();
  for (const name of words) for (const part of name.split(/[\s\-–—/]+/)) if (part.trim().length > 1) next.add(part.trim());
  for (const word of next) if (!projectWords.has(word)) checker?.add(word);
  for (const word of projectWords) if (!next.has(word)) checker?.remove(word);
  projectWords.clear();
  for (const word of next) projectWords.add(word);
};

const LETTERS = /^[\p{L}][\p{L}'’-]*$/u;

/** Whether a word is misspelled, and what it might be. Numbers, initials and odd tokens are never flagged. */
export const checkWord = (raw: string): { misspelled: boolean; suggestions: string[] } => {
  const word = raw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '').replace(/’/g, "'");
  if (word.length < 2 || !LETTERS.test(word)) return { misspelled: false, suggestions: [] };
  const spell = ready();
  if (spell.correct(word)) return { misspelled: false, suggestions: [] };
  // A screenplay's cues and sluglines are in capitals: check them as words.
  if (word === word.toUpperCase() && spell.correct(word.toLowerCase())) return { misspelled: false, suggestions: [] };
  if (word === word.toUpperCase() && spell.correct(word[0] + word.slice(1).toLowerCase())) return { misspelled: false, suggestions: [] };
  const suggestions = spell.suggest(word).slice(0, 6);
  const shaped = word === word.toUpperCase() ? suggestions.map((one) => one.toUpperCase()) : suggestions;
  return { misspelled: true, suggestions: shaped };
};

/** A word added to the dictionary, here and in the operating system's. */
export const addToDictionary = (word: string): void => {
  const clean = word.trim();
  if (!clean) return;
  ready().add(clean);
  try {
    const words = new Set(personal());
    words.add(clean);
    localStorage.setItem(PERSONAL_KEY, JSON.stringify([...words].slice(-5000)));
  } catch {
    // Kept for this session only.
  }
  void window.vcwriter?.spelling?.addWord(clean);
};

/** Ignore it for this session: added to the checker, not saved. */
export const ignoreWord = (word: string): void => {
  if (word.trim()) ready().add(word.trim());
};

const STEMS: [RegExp, string][] = [
  [/ies$/, 'y'],
  [/ied$/, 'y'],
  [/ing$/, ''],
  [/ing$/, 'e'],
  [/ed$/, ''],
  [/ed$/, 'e'],
  [/es$/, ''],
  [/s$/, ''],
  [/ly$/, ''],
];

/**
 * Words that mean much the same, best first, up to `limit`. Tries the word,
 * then simple stems of it (*walking* finds *walk*), and keeps the writer's
 * capitalisation.
 */
export const synonymsOf = (raw: string, limit = 8): string[] => {
  const word = raw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
  if (word.length < 2 || !LETTERS.test(word)) return [];
  const lower = word.toLowerCase();
  if (!thesaurus) {
    // Not read yet: the next right-click will have it.
    void loadThesaurus().catch(() => undefined);
    return [];
  }
  const book = thesaurus;
  const lookup = (key: string): string[] => book.get(key) ?? [];
  let found = lookup(lower);
  if (found.length === 0) {
    for (const [ending, put] of STEMS) {
      if (!ending.test(lower)) continue;
      found = lookup(lower.replace(ending, put));
      if (found.length > 0) break;
    }
  }
  const seen = new Set<string>([lower]);
  const out: string[] = [];
  for (const one of found) {
    const key = one.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(one);
    if (out.length >= limit) break;
  }
  const capital = word[0] === word[0]?.toUpperCase() && word.slice(1) === word.slice(1).toLowerCase();
  const allCaps = word.length > 1 && word === word.toUpperCase();
  return out.map((one) => (allCaps ? one.toUpperCase() : capital ? one[0]!.toUpperCase() + one.slice(1) : one));
};
