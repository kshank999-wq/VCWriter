/**
 * **The Edit Check's own rules** (editor spec §4, §7: *deterministic spelling,
 * punctuation, format and basic grammar checks should run locally*).
 *
 * Every rule here reads one line of the manuscript and says what it noticed:
 * where, why, how sure, and — only for a mechanical slip with one right
 * answer (a doubled space, a comma before a closing quote) — the few
 * characters that would fix it. **No rule writes a sentence** (§2): a craft
 * concern names the span and explains; the writer rewrites it.
 *
 * Craft rules read **narration only**: quoted speech in prose and every line
 * of dialogue in a script are the characters' own, and a fragment there is a
 * voice, not a fault (§2, the acceptance criteria's *quoted dialogue does not
 * by itself trigger a shift*). Spelling and grammar come from Harper in the
 * app and arrive as findings of the same shape.
 */

export type EditCategory =
  | 'spelling'
  | 'grammar'
  | 'punctuation'
  | 'structure'
  | 'pov'
  | 'clarity'
  | 'verbs'
  | 'style'
  | 'pacing'
  | 'story'
  | 'format';

export const EDIT_CATEGORY_NAMES: Record<EditCategory, string> = {
  spelling: 'Spelling',
  grammar: 'Grammar',
  punctuation: 'Punctuation',
  structure: 'Sentence structure',
  pov: 'Point of view & tense',
  clarity: 'Clarity & concision',
  verbs: 'Verbs & diction',
  style: 'Style & rhythm',
  pacing: 'Pacing & flow',
  story: 'Story & continuity',
  format: 'Format',
};

/** A mechanical error, a possible concern, or something worth knowing (§5). */
export type EditSeverity = 'error' | 'concern' | 'info';
export type EditConfidence = 'high' | 'medium' | 'low';

/** What one rule noticed in one line, before it is placed in the book. */
export interface RuleHit {
  ruleId: string;
  category: EditCategory;
  severity: EditSeverity;
  confidence: EditConfidence;
  /** Offsets into the line's text. */
  start: number;
  end: number;
  /** What it noticed, in a sentence. */
  message: string;
  /** The rule, for the detail pane: why this is usually worth a look. */
  rule: string;
  /**
   * The exact characters to put in place of the span, for a mechanical slip
   * only. Never more than a few words (`MAX_FIX_WORDS`).
   */
  fix?: string;
}

/** The longest fix any rule may offer: a word or two, never a sentence (§2, §7). */
export const MAX_FIX_WORDS = 3;

/** A fix that could not be a rewrite: short, one line, no sentence ending inside it. */
export const isNarrowFix = (fix: string): boolean =>
  fix.length <= 40 && !/\n/.test(fix) && fix.trim().split(/\s+/).filter(Boolean).length <= MAX_FIX_WORDS && !/[.!?]\s+\S/.test(fix);

export type PointOfView =
  | 'first_singular'
  | 'first_plural'
  | 'second'
  | 'third_limited'
  | 'third_rotating'
  | 'third_omniscient'
  | 'third_objective'
  | 'unspecified';

export const POV_NAMES: Record<PointOfView, string> = {
  first_singular: 'First person singular',
  first_plural: 'First person plural',
  second: 'Second person',
  third_limited: 'Third person limited — fixed',
  third_rotating: 'Third person limited — rotating',
  third_omniscient: 'Third person omniscient',
  third_objective: 'Third person objective',
  unspecified: 'Mixed / unspecified',
};

export type NarrativeTense = 'past' | 'present' | 'unspecified';

/** What the rules need to know about where a line stands. */
export interface LineContext {
  mode: 'prose' | 'screenplay';
  /** The manuscript line's type: paragraph, action, dialogue, scene_heading… */
  type: string;
  pov: PointOfView;
  tense: NarrativeTense;
  /** The approved viewpoint characters' names, for third person limited. */
  viewpoint: readonly string[];
  /** Every character's name in the project. */
  characters: readonly string[];
  /** Words the writer has said are right: names, invented words. */
  dictionary: ReadonlySet<string>;
}

// --------------------------------------------------------------- reading text

/** The stretches of a prose line that are narration, outside quotation marks. */
export const narrationSpans = (text: string): Array<[number, number]> => {
  const spans: Array<[number, number]> = [];
  let from = 0;
  let inside = false;
  for (let k = 0; k < text.length; k += 1) {
    const ch = text[k]!;
    const opens = ch === '“' || (ch === '"' && !inside);
    const closes = ch === '”' || (ch === '"' && inside);
    if (!inside && opens) {
      if (k > from) spans.push([from, k]);
      inside = true;
    } else if (inside && closes) {
      inside = false;
      from = k + 1;
    }
  }
  if (!inside && from < text.length) spans.push([from, text.length]);
  return spans;
};

/** Sentences of a stretch, with their offsets. */
export const sentencesOf = (text: string, base = 0): Array<{ start: number; end: number; text: string }> => {
  const out: Array<{ start: number; end: number; text: string }> = [];
  const re = /[^.!?…]+(?:[.!?…]+["”’)]*|$)/g;
  for (const match of text.matchAll(re)) {
    const raw = match[0];
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (!body) continue;
    const start = base + (match.index ?? 0) + lead;
    out.push({ start, end: start + body.length, text: body });
  }
  return out;
};

const wordsOf = (text: string, base = 0): Array<{ start: number; end: number; word: string }> =>
  [...text.matchAll(/[A-Za-z][A-Za-z'’-]*/g)].map((m) => ({ start: base + (m.index ?? 0), end: base + (m.index ?? 0) + m[0].length, word: m[0] }));

const hit = (h: RuleHit): RuleHit => {
  if (h.fix !== undefined && !isNarrowFix(h.fix)) {
    // Never offered: a fix that is not narrow is not a fix this editor makes.
    const { fix: _dropped, ...rest } = h;
    return rest;
  }
  return h;
};

// --------------------------------------------------------------- punctuation

const SAID = 'said|asked|replied|whispered|shouted|called|answered|muttered|murmured|cried|yelled|added|continued|explained|told';

const punctuation = (text: string, ctx: LineContext): RuleHit[] => {
  const out: RuleHit[] = [];
  for (const m of text.matchAll(/(\S)( {2,})(?=\S)/g)) {
    const start = (m.index ?? 0) + 1;
    out.push(hit({ ruleId: 'double-space', category: 'punctuation', severity: 'error', confidence: 'high', start, end: start + m[2]!.length, message: 'More than one space between words.', rule: 'One space separates words and sentences.', fix: ' ' }));
  }
  for (const m of text.matchAll(/(\w)( +)([,.;:!?])(?![.\d])/g)) {
    const start = (m.index ?? 0) + 1;
    out.push(hit({ ruleId: 'space-before-punctuation', category: 'punctuation', severity: 'error', confidence: 'high', start, end: start + m[2]!.length, message: 'A space before the punctuation mark.', rule: 'Commas, full stops and other marks follow the word directly.', fix: '' }));
  }
  for (const m of text.matchAll(/([a-z]),([A-Za-z])/g)) {
    const start = (m.index ?? 0) + 1;
    out.push(hit({ ruleId: 'space-after-comma', category: 'punctuation', severity: 'error', confidence: 'high', start, end: start + 1, message: 'No space after the comma.', rule: 'A comma is followed by a space.', fix: ', ' }));
  }
  for (const m of text.matchAll(/(?<![.]),,|(?<![.])\.\.(?!\.)/g)) {
    const start = m.index ?? 0;
    out.push(hit({ ruleId: 'doubled-mark', category: 'punctuation', severity: 'error', confidence: 'high', start, end: start + 2, message: 'The same mark twice.', rule: 'One comma or full stop is enough; three full stops make an ellipsis.', fix: m[0][0]! }));
  }
  if (ctx.mode === 'prose' && ctx.type === 'paragraph') {
    // "I don't know." she said → a comma: the tag continues the sentence.
    const re = new RegExp(`\\.(["”])(\\s+)(he|she|they|I|we|you|it|[A-Z][a-z]+)\\s+(${SAID})\\b`, 'g');
    for (const m of text.matchAll(re)) {
      const tagIsName = /^[A-Z]/.test(m[3]!) && !['I'].includes(m[3]!);
      // A capitalised name after a full stop may begin a new sentence; less sure.
      out.push(hit({ ruleId: 'dialogue-tag-comma', category: 'punctuation', severity: 'error', confidence: tagIsName ? 'medium' : 'high', start: m.index ?? 0, end: (m.index ?? 0) + 1, message: 'A full stop before the closing quote, then a speech tag.', rule: 'When a speech tag follows the words spoken, the quoted sentence ends with a comma inside the quotation marks: “I don’t know,” she said.', fix: ',' }));
    }
    const opens = (text.match(/“/g) ?? []).length;
    const closes = (text.match(/”/g) ?? []).length;
    const straight = (text.match(/"/g) ?? []).length;
    if (opens !== closes || straight % 2 === 1) {
      const at = Math.max(text.lastIndexOf('“'), text.lastIndexOf('"'));
      out.push(hit({ ruleId: 'unbalanced-quotes', category: 'punctuation', severity: 'concern', confidence: 'medium', start: Math.max(0, at), end: Math.max(0, at) + 1, message: 'The quotation marks in this paragraph do not pair up.', rule: 'Every opening quotation mark has a closing one — unless the speech carries on into the next paragraph, which opens with a quotation mark again.' }));
    }
    const trimmed = text.trimEnd();
    if (trimmed.length > 0 && /[A-Za-z0-9]$/.test(trimmed) && trimmed.split(/\s+/).length > 3) {
      out.push(hit({ ruleId: 'no-closing-punctuation', category: 'punctuation', severity: 'concern', confidence: 'medium', start: trimmed.length - 1, end: trimmed.length, message: 'The paragraph ends without punctuation.', rule: 'A paragraph usually ends with a full stop, question mark, exclamation mark, dash or ellipsis.' }));
    }
  }
  return out;
};

// --------------------------------------------------------------- style and clarity

const QUALIFIERS = ['very', 'really', 'quite', 'rather', 'somewhat', 'just', 'actually', 'basically', 'totally', 'completely', 'extremely', 'incredibly', 'literally'];
const WORDY: ReadonlyArray<readonly [string, string]> = [
  ['in order to', 'Usually says no more than “to”.'],
  ['due to the fact that', 'Usually says no more than “because”.'],
  ['at this point in time', 'Usually says no more than “now”.'],
  ['in spite of the fact that', 'Usually says no more than “although”.'],
  ['for the purpose of', 'Usually says no more than “to” or “for”.'],
  ['the fact that', 'Often leaves the sentence clearer when it goes.'],
  ['each and every', 'Says the same thing twice.'],
  ['first and foremost', 'Says the same thing twice.'],
  ['began to', 'The action often reads stronger simply happening.'],
  ['started to', 'The action often reads stronger simply happening.'],
  ['in the event that', 'Usually says no more than “if”.'],
  ['a number of', 'Often vaguer than the number itself, or “some”.'],
  ['there is no doubt that', 'Usually adds length rather than certainty.'],
  ['it is important to note that', 'Usually adds length; the point stands without it.'],
];
const CLICHES = [
  'at the end of the day', 'avoid like the plague', 'better late than never', 'calm before the storm', 'dead as a doornail',
  'easier said than done', 'every cloud has a silver lining', 'few and far between', 'heart of gold', 'in the nick of time',
  'last but not least', 'only time will tell', 'plenty of fish in the sea', 'read between the lines', 'scared to death',
  'sick as a dog', 'time stood still', 'think outside the box', 'white as a sheet', 'cold as ice', 'quiet as a mouse',
  'blood ran cold', 'heart skipped a beat', 'let out a breath she didn’t know she was holding', "let out a breath she didn't know she was holding",
  'a breath he didn’t know he was holding', "a breath he didn't know he was holding", 'all hell broke loose', 'without further ado',
  'needle in a haystack', 'fit as a fiddle', 'crystal clear', 'dark and stormy night', 'out of the blue', 'piece of cake',
  'the writing on the wall', 'twist of fate', 'when all is said and done', 'like a deer in the headlights', 'nerves of steel',
];
const IRREGULAR_PARTICIPLES = new Set([
  'been', 'born', 'borne', 'beaten', 'become', 'begun', 'bent', 'bitten', 'blown', 'broken', 'brought', 'built', 'bought', 'caught',
  'chosen', 'done', 'drawn', 'driven', 'eaten', 'fallen', 'fed', 'felt', 'fought', 'found', 'forgotten', 'forgiven', 'frozen',
  'given', 'gone', 'grown', 'hung', 'heard', 'hidden', 'held', 'hurt', 'kept', 'known', 'laid', 'led', 'left', 'lost', 'made',
  'meant', 'met', 'paid', 'put', 'read', 'ridden', 'risen', 'run', 'said', 'seen', 'sold', 'sent', 'set', 'shaken', 'shot',
  'shown', 'shut', 'sung', 'sunk', 'slain', 'spoken', 'spent', 'spun', 'spread', 'stolen', 'struck', 'sworn', 'swept', 'taken',
  'taught', 'torn', 'told', 'thought', 'thrown', 'understood', 'woken', 'worn', 'won', 'written', 'rung', 'sprung', 'flung',
  'clung', 'swung', 'stung', 'strung', 'wrung', 'drunk', 'shrunk', 'stuck', 'bound', 'ground', 'wound', 'dug', 'lit', 'slung',
]);
/** Words that are often general where a specific verb would show more. */
const GENERAL_VERBS = /^(walk|walked|walking|walks|went|go|goes|going|look|looked|looking|looks|move|moved|moving|moves|got|get|gets|getting|put|puts|putting|make|made|makes|making)$/i;
const ADVERB = /^[a-z]+ly$/i;
const NOT_ADVERBS = new Set(['only', 'early', 'family', 'reply', 'supply', 'apply', 'fly', 'belly', 'holy', 'ugly', 'lonely', 'lovely', 'friendly', 'likely', 'daily', 'silly', 'hilly', 'jelly', 'lily', 'ally', 'rally', 'bully', 'jolly', 'sly', 'july', 'italy', 'emily', 'kelly', 'molly', 'sally', 'holly', 'billy', 'willy']);

const COMMON = new Set(
  'the a an and or but of to in on at by for with from as is was were be been are it its it’s it\'s he she they them his her their we you i me my our your this that these those there then than so not no yes up down out over into onto just had has have do did does said says would could should will can may might must one two all any each very what when where which who whom why how if while back like now only also too again still even here more most some such own same other about after before through under around off upon'.split(' '),
);

const style = (text: string, spans: Array<[number, number]>): RuleHit[] => {
  const out: RuleHit[] = [];
  const lower = text.toLowerCase();
  for (const [from, to] of spans) {
    const part = lower.slice(from, to);
    const words = wordsOf(text.slice(from, to), from);
    for (let k = 0; k < words.length; k += 1) {
      const w = words[k]!;
      const word = w.word.toLowerCase();
      if (QUALIFIERS.includes(word)) {
        out.push({ ruleId: 'weak-qualifier', category: 'clarity', severity: 'info', confidence: 'medium', start: w.start, end: w.end, message: `“${w.word}” may be softening the sentence.`, rule: 'Qualifiers such as very, really and just often weaken the word they lean on; a more exact word usually needs none.' });
      }
      // Passive: a form of *be*, perhaps an adverb, then a past participle.
      if (/^(am|is|are|was|were|be|been|being)$/.test(word)) {
        let n = k + 1;
        if (words[n] && ADVERB.test(words[n]!.word) && !NOT_ADVERBS.has(words[n]!.word.toLowerCase())) n += 1;
        const next = words[n];
        if (next && (IRREGULAR_PARTICIPLES.has(next.word.toLowerCase()) || /[a-z]{2,}ed$/.test(next.word.toLowerCase()))) {
          const by = /\bby\b/.test(part.slice(next.end - from, next.end - from + 40));
          out.push({ ruleId: 'passive-voice', category: 'style', severity: 'info', confidence: by ? 'high' : 'low', start: w.start, end: next.end, message: 'Possibly passive voice.', rule: 'Passive voice puts the one acted on first and can hide who acts. It is often the right choice — this is a note, not an error.' });
        }
      }
      // A general verb leaning on an adverb: *walked slowly*.
      const following = words[k + 1];
      if (GENERAL_VERBS.test(w.word) && following && ADVERB.test(following.word) && !NOT_ADVERBS.has(following.word.toLowerCase())) {
        out.push({ ruleId: 'verb-adverb', category: 'verbs', severity: 'concern', confidence: 'medium', start: w.start, end: following.end, message: `“${w.word} ${following.word}” — a general verb carried by an adverb.`, rule: 'One specific verb often does the work of a general verb and an adverb. Right-click the verb for stronger verbs.' });
      }
    }
    for (const [phrase, why] of WORDY) {
      for (let at = part.indexOf(phrase); at !== -1; at = part.indexOf(phrase, at + phrase.length)) {
        if (/\w/.test(part[at - 1] ?? ' ') || /\w/.test(part[at + phrase.length] ?? ' ')) continue;
        out.push({ ruleId: 'wordy-phrase', category: 'clarity', severity: 'info', confidence: 'medium', start: from + at, end: from + at + phrase.length, message: `“${text.slice(from + at, from + at + phrase.length)}” — possibly wordy.`, rule: why });
      }
    }
    for (const phrase of CLICHES) {
      const at = part.indexOf(phrase);
      if (at === -1) continue;
      out.push({ ruleId: 'cliche', category: 'style', severity: 'concern', confidence: 'high', start: from + at, end: from + at + phrase.length, message: 'A familiar phrase — possibly a cliché.', rule: 'A phrase readers have met many times slides past them; something seen fresh lands harder. Keep it if the voice wants it.' });
    }
  }
  // Sentences: very long ones, and runs that open the same way or are the same length.
  const sentences = spans.flatMap(([from, to]) => sentencesOf(text.slice(from, to), from)).filter((s) => /[A-Za-z]/.test(s.text));
  const lengths = sentences.map((s) => s.text.split(/\s+/).length);
  sentences.forEach((s, k) => {
    if (lengths[k]! > 45) out.push({ ruleId: 'long-sentence', category: 'structure', severity: 'concern', confidence: 'medium', start: s.start, end: s.end, message: `A long sentence (${lengths[k]} words).`, rule: 'A very long sentence can lose the reader. It may be exactly what the moment wants; worth reading aloud.' });
  });
  for (let k = 2; k < sentences.length; k += 1) {
    const first = (s: { text: string }) => (s.text.match(/[A-Za-z'’]+/)?.[0] ?? '').toLowerCase();
    const a = first(sentences[k - 2]!);
    if (a && a === first(sentences[k - 1]!) && a === first(sentences[k]!) && !(k >= 3 && first(sentences[k - 3]!) === a)) {
      out.push({ ruleId: 'repeated-openings', category: 'style', severity: 'concern', confidence: 'medium', start: sentences[k - 2]!.start, end: sentences[k]!.end, message: `Three sentences in a row open with “${a}”.`, rule: 'Openings that repeat can make prose sound like a list, unless the repetition is deliberate.' });
    }
  }
  for (let k = 3; k < sentences.length; k += 1) {
    const run = lengths.slice(k - 3, k + 1);
    if (run.every((n) => n >= 6 && Math.abs(n - run[0]!) <= 2) && !(k >= 4 && Math.abs(lengths[k - 4]! - run[0]!) <= 2 && lengths[k - 4]! >= 6)) {
      out.push({ ruleId: 'even-rhythm', category: 'style', severity: 'info', confidence: 'low', start: sentences[k - 3]!.start, end: sentences[k]!.end, message: 'Four sentences of nearly the same length.', rule: 'Sentences of much the same length can make the rhythm flat; varying them changes the pace.' });
    }
  }
  // A notable word used twice close together.
  const seen = new Map<string, number>();
  const all = spans.flatMap(([from, to]) => wordsOf(text.slice(from, to), from));
  all.forEach((w, k) => {
    const word = w.word.toLowerCase().replace(/’/g, "'");
    // Names and capitalised terms repeat by nature; short words too.
    if (word.length < 6 || COMMON.has(word) || /^[A-Z]/.test(w.word)) return;
    const before = seen.get(word);
    if (before !== undefined && k - before <= 15) {
      out.push({ ruleId: 'repeated-word', category: 'style', severity: 'info', confidence: 'medium', start: w.start, end: w.end, message: `“${w.word}” again, ${k - before} words after the last.`, rule: 'A distinctive word repeated close by is often noticed by readers. Sometimes the echo is the point.' });
    }
    seen.set(word, k);
  });
  return out;
};

// --------------------------------------------------------------- point of view and tense

const INTERIOR = 'thought|felt|wondered|knew|realized|realised|wished|wanted|hoped|believed|remembered|feared|decided|worried|suspected|sensed|imagined';

const pointOfView = (text: string, spans: Array<[number, number]>, ctx: LineContext): RuleHit[] => {
  const out: RuleHit[] = [];
  const narration = spans.map(([from, to]) => ({ from, text: text.slice(from, to) }));
  const interior = new RegExp(`\\b(he|she|they|${ctx.characters.map(escape).join('|') || 'zzzz'})\\s+(${INTERIOR})\\b`, 'gi');
  for (const part of narration) {
    if (ctx.pov === 'first_singular' || ctx.pov === 'first_plural') {
      for (const m of part.text.matchAll(interior)) {
        const start = part.from + (m.index ?? 0);
        out.push({ ruleId: 'pov-other-mind', category: 'pov', severity: 'concern', confidence: 'medium', start, end: start + m[0].length, message: `The narration reports what “${m[1]}” ${m[2]} — inside another mind.`, rule: 'A first-person narrator knows only their own thoughts; another character’s feelings are seen or guessed, not known. Mark it intentional if the narrator is guessing.' });
      }
      const self = ctx.pov === 'first_singular' ? /\b(I|me|my|mine|myself)\b/ : /\b(we|us|our|ours|ourselves)\b/i;
      const other = ctx.pov === 'first_singular' ? /\b(we|us|our)\b/i : /\bI\b/;
      if (!self.test(part.text) && other.test(part.text) && part.text.split(/\s+/).length > 12) {
        const m = part.text.match(other)!;
        const start = part.from + (m.index ?? 0);
        out.push({ ruleId: 'pov-narrator-shift', category: 'pov', severity: 'concern', confidence: 'low', start, end: start + m[0].length, message: ctx.pov === 'first_singular' ? 'The narrator says “we” here rather than “I”.' : 'The narrator says “I” here rather than “we”.', rule: 'A narrator who changes person mid-story can unsettle the reader. Often it is deliberate.' });
      }
    }
    if (ctx.pov === 'second' && /\bI\b/.test(part.text)) {
      const m = part.text.match(/\bI\b/)!;
      const start = part.from + (m.index ?? 0);
      out.push({ ruleId: 'pov-second-first', category: 'pov', severity: 'concern', confidence: 'low', start, end: start + 1, message: '“I” in second-person narration.', rule: 'Second-person narration speaks to “you”; a narrating “I” outside dialogue may be a slip.' });
    }
    if (ctx.pov === 'third_limited' && ctx.viewpoint.length > 0) {
      const others = ctx.characters.filter((name) => !ctx.viewpoint.some((v) => v.toLowerCase() === name.toLowerCase()));
      if (others.length > 0) {
        const re = new RegExp(`\\b(${others.map(escape).join('|')})\\s+(${INTERIOR})\\b`, 'g');
        for (const m of part.text.matchAll(re)) {
          const start = part.from + (m.index ?? 0);
          out.push({ ruleId: 'pov-head-hop', category: 'pov', severity: 'concern', confidence: 'medium', start, end: start + m[0].length, message: `${m[1]} is not the viewpoint character, but the narration knows what ${m[1]} ${m[2]}.`, rule: `In third person limited the narration knows only what ${ctx.viewpoint.join(' or ')} can know. Another character’s inner life is shown through what they do and say — unless this is a planned change of viewpoint.` });
        }
      }
    }
    if (ctx.pov === 'third_objective') {
      for (const m of part.text.matchAll(interior)) {
        const start = part.from + (m.index ?? 0);
        out.push({ ruleId: 'pov-objective-interior', category: 'pov', severity: 'concern', confidence: 'medium', start, end: start + m[0].length, message: 'An objective narrator reporting an inner state.', rule: 'Objective narration reports only what could be seen and heard; thoughts and feelings come through action and speech.' });
      }
    }
    // Tense: present verbs in past narration, past in present.
    if (ctx.tense === 'past') {
      const re = /\b(he|she|it|I|we|they)\s+(is|are|am|has|does|says|walks|looks|goes|runs|knows|thinks|wants)\b/g;
      for (const m of part.text.matchAll(re)) {
        const start = part.from + (m.index ?? 0);
        out.push({ ruleId: 'tense-present-in-past', category: 'pov', severity: 'concern', confidence: 'low', start, end: start + m[0].length, message: 'Present tense in past-tense narration.', rule: 'A story told in the past tense keeps to it in narration; present tense for a lasting truth (“the river runs east”) is usually fine.' });
      }
    }
    if (ctx.tense === 'present') {
      const re = /\b(he|she|it|I|we|they)\s+(was|were|had|did|said|walked|looked|went|ran|knew|thought|wanted)\b/g;
      for (const m of part.text.matchAll(re)) {
        const start = part.from + (m.index ?? 0);
        out.push({ ruleId: 'tense-past-in-present', category: 'pov', severity: 'concern', confidence: 'low', start, end: start + m[0].length, message: 'Past tense in present-tense narration.', rule: 'A story told in the present keeps to it in narration; the past tense is right for what happened before the scene.' });
      }
    }
  }
  return out;
};

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// --------------------------------------------------------------- screenplay format

const screenplay = (text: string, ctx: LineContext): RuleHit[] => {
  const out: RuleHit[] = [];
  const trimmed = text.trim();
  if (!trimmed) return out;
  if (ctx.type === 'scene_heading') {
    if (!/^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.?|EXT\.?|EST\.?)\s/i.test(trimmed)) {
      out.push({ ruleId: 'scene-heading-start', category: 'format', severity: 'concern', confidence: 'high', start: 0, end: Math.min(text.length, 12), message: 'The scene heading does not open with INT. or EXT.', rule: 'A scene heading says where the scene is: INT. or EXT., the place, then the time — INT. FARMHOUSE - NIGHT.' });
    }
    if (trimmed !== trimmed.toUpperCase()) {
      out.push(hit({ ruleId: 'scene-heading-caps', category: 'format', severity: 'error', confidence: 'high', start: 0, end: text.length, message: 'The scene heading is not in capitals.', rule: 'Scene headings are set in capitals.', ...(text.split(/\s+/).length <= MAX_FIX_WORDS ? { fix: text.toUpperCase() } : {}) }));
    }
  }
  if (ctx.type === 'character' && trimmed !== trimmed.toUpperCase()) {
    out.push(hit({ ruleId: 'cue-caps', category: 'format', severity: 'error', confidence: 'high', start: 0, end: text.length, message: 'The character cue is not in capitals.', rule: 'A character’s name above their dialogue is set in capitals.', fix: text.toUpperCase() }));
  }
  if (ctx.type === 'transition' && trimmed !== trimmed.toUpperCase()) {
    out.push(hit({ ruleId: 'transition-caps', category: 'format', severity: 'error', confidence: 'high', start: 0, end: text.length, message: 'The transition is not in capitals.', rule: 'Transitions such as CUT TO: are set in capitals.', fix: text.toUpperCase() }));
  }
  if (ctx.type === 'parenthetical' && !/^\(.*\)$/.test(trimmed)) {
    out.push({ ruleId: 'parenthetical-brackets', category: 'format', severity: 'concern', confidence: 'medium', start: 0, end: text.length, message: 'The parenthetical is not in brackets.', rule: 'A parenthetical sits in round brackets under the character’s name: (quietly).' });
  }
  if (ctx.type === 'action') {
    const words = trimmed.split(/\s+/).length;
    if (words > 70) out.push({ ruleId: 'long-action', category: 'format', severity: 'concern', confidence: 'medium', start: 0, end: text.length, message: `A long action paragraph (${words} words).`, rule: 'Action reads fastest in short paragraphs — often three or four lines — each a new beat or image.' });
  }
  return out;
};

/**
 * Every rule, over one line. `checkNarration` is false for lines that are
 * speech throughout (a script's dialogue), where only the mechanical rules run.
 */
export const checkLine = (text: string, ctx: LineContext): RuleHit[] => {
  if (!text.trim()) return [];
  const out: RuleHit[] = [...punctuation(text, ctx)];
  if (ctx.mode === 'screenplay') {
    out.push(...screenplay(text, ctx));
    if (ctx.type === 'action') out.push(...style(text, [[0, text.length]]));
    return out;
  }
  if (ctx.type !== 'paragraph' && ctx.type !== 'blockquote') return out;
  const spans = narrationSpans(text);
  out.push(...style(text, spans), ...pointOfView(text, spans, ctx));
  return out;
};
