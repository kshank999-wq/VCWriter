/**
 * **The verb dictionary** (editor spec §4, from Ken, 19 November: *a verb
 * dictionary… so you can right-click on a word and open up a verb dictionary
 * or thesaurus to replace weak verbs*).
 *
 * The data is WordNet's verbs (built by the desktop's `scripts/build-verbs.mjs`):
 * for each verb, its first senses, each with what it means, its synonyms and
 * its **stronger verbs** — the more specific ways of doing the same thing
 * (walk → pace, stagger, march, shuffle). This module reads that data and does
 * the one thing a menu needs beyond looking up: it finds the verb a word is a
 * form of (*walked* → *walk*, *strode* → *stride*) and puts the replacement in
 * the same form (*walked* → *staggered*, *walks* → *staggers*). It changes one
 * word; it never writes a sentence (spec §2).
 */

export interface VerbData {
  /** Senses: what it means, synonyms, stronger verbs. */
  s: ReadonlyArray<readonly [string, readonly string[], readonly string[]]>;
  /** Each verb's senses, most usual first. */
  i: Readonly<Record<string, readonly number[]>>;
}

export interface VerbSense {
  meaning: string;
  synonyms: string[];
  stronger: string[];
}

/** The form a verb is in, to give a replacement the same one. */
export type VerbForm = 'base' | 'third' | 'past' | 'participle' | 'ing';

/**
 * Irregular verbs: base, past, past participle. The common ones, and those
 * the stronger-verb lists reach for (stride, slink, swing).
 */
const IRREGULAR: ReadonlyArray<readonly [string, string, string]> = [
  ['arise', 'arose', 'arisen'], ['awake', 'awoke', 'awoken'], ['be', 'was', 'been'], ['bear', 'bore', 'borne'],
  ['beat', 'beat', 'beaten'], ['become', 'became', 'become'], ['begin', 'began', 'begun'], ['bend', 'bent', 'bent'],
  ['bet', 'bet', 'bet'], ['bid', 'bid', 'bid'], ['bind', 'bound', 'bound'], ['bite', 'bit', 'bitten'],
  ['bleed', 'bled', 'bled'], ['blow', 'blew', 'blown'], ['break', 'broke', 'broken'], ['breed', 'bred', 'bred'],
  ['bring', 'brought', 'brought'], ['build', 'built', 'built'], ['burst', 'burst', 'burst'], ['buy', 'bought', 'bought'],
  ['cast', 'cast', 'cast'], ['catch', 'caught', 'caught'], ['choose', 'chose', 'chosen'], ['cling', 'clung', 'clung'],
  ['come', 'came', 'come'], ['cost', 'cost', 'cost'], ['creep', 'crept', 'crept'], ['cut', 'cut', 'cut'],
  ['deal', 'dealt', 'dealt'], ['dig', 'dug', 'dug'], ['dive', 'dove', 'dived'], ['do', 'did', 'done'],
  ['draw', 'drew', 'drawn'], ['drink', 'drank', 'drunk'], ['drive', 'drove', 'driven'], ['eat', 'ate', 'eaten'],
  ['fall', 'fell', 'fallen'], ['feed', 'fed', 'fed'], ['feel', 'felt', 'felt'], ['fight', 'fought', 'fought'],
  ['find', 'found', 'found'], ['flee', 'fled', 'fled'], ['fling', 'flung', 'flung'], ['fly', 'flew', 'flown'],
  ['forbid', 'forbade', 'forbidden'], ['forget', 'forgot', 'forgotten'], ['forgive', 'forgave', 'forgiven'],
  ['freeze', 'froze', 'frozen'], ['get', 'got', 'gotten'], ['give', 'gave', 'given'], ['go', 'went', 'gone'],
  ['grind', 'ground', 'ground'], ['grow', 'grew', 'grown'], ['hang', 'hung', 'hung'], ['have', 'had', 'had'],
  ['hear', 'heard', 'heard'], ['hide', 'hid', 'hidden'], ['hit', 'hit', 'hit'], ['hold', 'held', 'held'],
  ['hurt', 'hurt', 'hurt'], ['keep', 'kept', 'kept'], ['kneel', 'knelt', 'knelt'], ['know', 'knew', 'known'],
  ['lay', 'laid', 'laid'], ['lead', 'led', 'led'], ['lean', 'leaned', 'leaned'], ['leap', 'leapt', 'leapt'],
  ['leave', 'left', 'left'], ['lend', 'lent', 'lent'], ['let', 'let', 'let'], ['lie', 'lay', 'lain'],
  ['light', 'lit', 'lit'], ['lose', 'lost', 'lost'], ['make', 'made', 'made'], ['mean', 'meant', 'meant'],
  ['meet', 'met', 'met'], ['pay', 'paid', 'paid'], ['put', 'put', 'put'], ['quit', 'quit', 'quit'],
  ['read', 'read', 'read'], ['ride', 'rode', 'ridden'], ['ring', 'rang', 'rung'], ['rise', 'rose', 'risen'],
  ['run', 'ran', 'run'], ['say', 'said', 'said'], ['see', 'saw', 'seen'], ['seek', 'sought', 'sought'],
  ['sell', 'sold', 'sold'], ['send', 'sent', 'sent'], ['set', 'set', 'set'], ['shake', 'shook', 'shaken'],
  ['shed', 'shed', 'shed'], ['shine', 'shone', 'shone'], ['shoot', 'shot', 'shot'], ['show', 'showed', 'shown'],
  ['shrink', 'shrank', 'shrunk'], ['shut', 'shut', 'shut'], ['sing', 'sang', 'sung'], ['sink', 'sank', 'sunk'],
  ['sit', 'sat', 'sat'], ['slay', 'slew', 'slain'], ['sleep', 'slept', 'slept'], ['slide', 'slid', 'slid'],
  ['sling', 'slung', 'slung'], ['slink', 'slunk', 'slunk'], ['slit', 'slit', 'slit'], ['speak', 'spoke', 'spoken'],
  ['speed', 'sped', 'sped'], ['spend', 'spent', 'spent'], ['spin', 'spun', 'spun'], ['spit', 'spat', 'spat'],
  ['split', 'split', 'split'], ['spread', 'spread', 'spread'], ['spring', 'sprang', 'sprung'],
  ['stand', 'stood', 'stood'], ['steal', 'stole', 'stolen'], ['stick', 'stuck', 'stuck'], ['sting', 'stung', 'stung'],
  ['stink', 'stank', 'stunk'], ['stride', 'strode', 'stridden'], ['strike', 'struck', 'struck'],
  ['string', 'strung', 'strung'], ['strive', 'strove', 'striven'], ['swear', 'swore', 'sworn'],
  ['sweep', 'swept', 'swept'], ['swim', 'swam', 'swum'], ['swing', 'swung', 'swung'], ['take', 'took', 'taken'],
  ['teach', 'taught', 'taught'], ['tear', 'tore', 'torn'], ['tell', 'told', 'told'], ['think', 'thought', 'thought'],
  ['throw', 'threw', 'thrown'], ['thrust', 'thrust', 'thrust'], ['tread', 'trod', 'trodden'],
  ['understand', 'understood', 'understood'], ['wake', 'woke', 'woken'], ['wear', 'wore', 'worn'],
  ['weave', 'wove', 'woven'], ['weep', 'wept', 'wept'], ['win', 'won', 'won'], ['wind', 'wound', 'wound'],
  ['withdraw', 'withdrew', 'withdrawn'], ['wring', 'wrung', 'wrung'], ['write', 'wrote', 'written'],
];

const BY_BASE = new Map(IRREGULAR.map((one) => [one[0], one]));
const BY_FORM = new Map<string, { base: string; form: VerbForm }>();
for (const [base, past, participle] of IRREGULAR) {
  if (!BY_FORM.has(past)) BY_FORM.set(past, { base, form: 'past' });
  if (participle !== past && !BY_FORM.has(participle)) BY_FORM.set(participle, { base, form: 'participle' });
}
// *Be*, whose present forms are its own.
for (const [form, kind] of [['is', 'third'], ['are', 'base'], ['am', 'base'], ['were', 'past'], ['being', 'ing'], ['has', 'third']] as const) {
  BY_FORM.set(form, { base: form === 'has' ? 'have' : 'be', form: kind });
}

const VOWELS = /[aeiou]/;
const CONSONANT = /[^aeiouwxy]/;

/** Whether the last consonant doubles before -ed and -ing: *stop* → *stopped*, not *visit*. */
const doubles = (base: string): boolean =>
  base.length >= 3 &&
  CONSONANT.test(base.at(-1)!) &&
  VOWELS.test(base.at(-2)!) &&
  !VOWELS.test(base.at(-3)!) &&
  // One syllable: one vowel group.
  (base.match(/[aeiouy]+/g) ?? []).length === 1;

/** A verb in the form given. */
export const inflectVerb = (base: string, form: VerbForm): string => {
  const irregular = BY_BASE.get(base);
  if (form === 'base') return base;
  if (form === 'past' && irregular) return irregular[1];
  if (form === 'participle' && irregular) return irregular[2];
  if (form === 'third') {
    if (base === 'have') return 'has';
    if (base === 'be') return 'is';
    if (/(s|x|z|ch|sh|o)$/.test(base)) return `${base}es`;
    if (/[^aeiou]y$/.test(base)) return `${base.slice(0, -1)}ies`;
    return `${base}s`;
  }
  if (form === 'ing') {
    if (/ie$/.test(base)) return `${base.slice(0, -2)}ying`;
    if (/[^e]e$/.test(base) && base !== 'be') return `${base.slice(0, -1)}ing`;
    if (doubles(base)) return `${base}${base.at(-1)}ing`;
    return `${base}ing`;
  }
  // Regular past and participle.
  if (/e$/.test(base)) return `${base}d`;
  if (/[^aeiou]y$/.test(base)) return `${base.slice(0, -1)}ied`;
  if (doubles(base)) return `${base}${base.at(-1)}ed`;
  return `${base}ed`;
};

/**
 * The verb a word is a form of, and which form, read against the
 * dictionary: *walked* → walk, past; *strode* → stride, past. Null where the
 * word is no verb the dictionary has.
 */
export const verbOf = (data: VerbData, raw: string): { base: string; form: VerbForm } | null => {
  const word = raw.toLowerCase().replace(/[’']/g, "'");
  const has = (base: string) => Object.prototype.hasOwnProperty.call(data.i, base);
  const irregular = BY_FORM.get(word);
  if (irregular && has(irregular.base)) return irregular;
  if (has(word)) return { base: word, form: 'base' };
  // Each likely base, kept only where putting it back in that form gives the
  // word exactly: *stopped* → stop, *hoped* → hope, *tried* → try.
  const forms: VerbForm[] = word.endsWith('ing') ? ['ing'] : word.endsWith('ed') ? ['past'] : word.endsWith('s') ? ['third'] : [];
  for (const form of forms) {
    const cut = form === 'ing' ? 3 : form === 'past' ? 2 : 1;
    const stem = word.slice(0, -cut);
    const candidates = [stem, `${stem}e`, stem.slice(0, -1), `${stem.slice(0, -1)}y`, `${stem.slice(0, -1)}ie`, `${stem.slice(0, -2)}ie`];
    for (const base of candidates) {
      if (base.length >= 2 && has(base) && inflectVerb(base, form) === word) return { base, form };
    }
  }
  return null;
};

/** A word in the writer's capitals: *Walked* → *Staggered*, *WALKED* → *STAGGERED*. */
export const inTheirCase = (like: string, word: string): string => {
  if (like.length > 1 && like === like.toUpperCase()) return word.toUpperCase();
  if (like[0] && like[0] === like[0].toUpperCase()) return word[0]!.toUpperCase() + word.slice(1);
  return word;
};

/**
 * Everything the verb dictionary has for a word, each verb already in the
 * form of the word it would replace. Null where the word is not a verb it has.
 */
export const lookUpVerb = (
  data: VerbData,
  raw: string,
): { base: string; form: VerbForm; senses: VerbSense[] } | null => {
  const found = verbOf(data, raw);
  if (!found) return null;
  const shaped = (verb: string) => inTheirCase(raw, inflectVerb(verb, found.form));
  const senses = (data.i[found.base] ?? []).map((id) => {
    const [meaning, synonyms, stronger] = data.s[id] ?? ['', [], []];
    return {
      meaning,
      synonyms: synonyms.filter((one) => one !== found.base).map(shaped),
      stronger: stronger.filter((one) => one !== found.base).map(shaped),
    };
  });
  return { ...found, senses };
};

/**
 * The stronger verbs for the menu: the first senses' first choices, each
 * once, up to `limit`.
 */
export const strongerVerbsFor = (data: VerbData, raw: string, limit = 8): string[] => {
  const found = lookUpVerb(data, raw);
  if (!found) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  // Round-robin across the first two senses, so *look* offers glance and seem alike.
  const lists = found.senses.slice(0, 2).map((one) => one.stronger);
  for (let k = 0; out.length < limit && lists.some((list) => k < list.length); k += 1) {
    for (const list of lists) {
      const word = list[k];
      if (word && !seen.has(word.toLowerCase())) {
        seen.add(word.toLowerCase());
        out.push(word);
        if (out.length >= limit) break;
      }
    }
  }
  return out;
};
