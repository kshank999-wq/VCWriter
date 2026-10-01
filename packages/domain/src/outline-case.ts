import type { ProjectFile } from './project-file.js';
import type { Outline, OutlineItem } from './entities/outline.js';
import type { OutlineId, OutlineItemId } from './ids.js';
import { outlinesOf, updateItem } from './outline.js';

/**
 * How an outline's rows are named (addendum 19 §10).
 *
 * From Ken: *I want the sections and subsections along with the chapters to be
 * in title case, or sentence case, you can choose between in a setting.*
 *
 * **It casts the words rather than how they are drawn**, and that is the whole
 * decision. The obvious build is `text-transform` on the row — which is what
 * was there, and what the complaint is about: the Outliner drew a chapter in
 * capitals while the project stored *Mathematics and its parts* and the book
 * printed it that way, so the outline, the timeline, the contents page and the
 * chapter page were four answers to one name. A case that lives in a
 * stylesheet is a case the book does not print.
 *
 * It is the opposite of addendum 02 §12a, deliberately and for a stated
 * reason: there the look belongs to the book and the letters are the writer's,
 * because a chapter page's type is not its words. Here the row's name **is**
 * what travels — promoting a row carries its title into the marker, the unit
 * or the beat — so casting it is casting the thing itself.
 */
export const OUTLINE_CASES = ['as_typed', 'title', 'sentence'] as const;
export type OutlineCase = (typeof OUTLINE_CASES)[number];

/** What each is called, in one place, so no screen writes its own. */
export const OUTLINE_CASE_WORDS: Record<OutlineCase, string> = {
  as_typed: 'As typed',
  title: 'Title Case',
  sentence: 'Sentence case',
};

/**
 * The words a title leaves lowercase, between its first and its last.
 *
 * The standard short list: articles, coordinating conjunctions and the
 * prepositions of four letters or fewer. Longer prepositions (*between*,
 * *through*, *without*) are capitalised, which is what every house style
 * agrees on.
 */
const SMALL = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'if', 'in', 'into',
  'nor', 'of', 'off', 'on', 'onto', 'or', 'over', 'per', 'so', 'the', 'to',
  'up', 'via', 'vs', 'with', 'yet',
]);

/** The letters in a word, with punctuation and digits dropped. */
const lettersIn = (word: string): string => word.replace(/[^\p{L}]/gu, '');

/**
 * A word the setting leaves exactly as typed.
 *
 * Two kinds, and both are the writer saying something the rule cannot:
 *
 *  - **A word in capitals.** *NASA*, *PDF*, *I*. Nothing here can tell an
 *    abbreviation from somebody shouting, and shouting is theirs to do — so
 *    neither is touched. (This is why the old `text-transform` had to go
 *    rather than be turned into a setting: it could not tell them apart
 *    either, and simply shouted everything.)
 *  - **A word with a capital after its first letter.** *iPhone*, *McDonald*,
 *    *pH*. A capital in the middle of a word is never an accident.
 */
const asTyped = (word: string): boolean => {
  const letters = lettersIn(word);
  if (letters.length === 0) return true;
  if (letters === letters.toLocaleUpperCase()) return true;
  return /\p{Lu}/u.test(letters.slice(1));
};

/** Up-case the first letter, wherever the punctuation lets it fall. */
const up = (word: string): string => {
  const at = word.search(/\p{L}/u);
  if (at < 0) return word;
  return word.slice(0, at) + word[at]!.toLocaleUpperCase() + word.slice(at + 1);
};

/**
 * How much of somebody's typing the cast may undo.
 *
 * **`named` adds capitals and never takes one away**, which is what keeps the
 * setting from fighting the writer. The fault it fixes was visible on the
 * first screen it was driven on: under *Sentence case* a note reading *Pair
 * with the Hans Gruber example* came back as *hans gruber*, and no rule can
 * tell a surname from an ordinary word — so a writer who put the capitals
 * back would have had them taken off again the moment they left the box,
 * every time, which is a control that undoes you.
 *
 * So lowering is the **act's** and never the room's: choosing the case names
 * the whole outline in it, both directions, once, and undo takes it back in a
 * keystroke; a row typed afterwards is only brought up to match. A capital in
 * an outline is something somebody typed on purpose, and the only moment it
 * is safe to drop one is the moment they ask for it.
 */
type Reach = 'cast' | 'named';

/** Does this word already begin with a capital the writer put there? */
const alreadyUp = (word: string): boolean => {
  const letters = lettersIn(word);
  return letters.length > 0 && letters[0] === letters[0]!.toLocaleUpperCase();
};

/**
 * A run of words cast together.
 *
 * Written once and read twice: a title's words, and the parts of a hyphenated
 * word — *state-of-the-art* is the same question asked one level down, and a
 * second copy of the rule there would be free to disagree with this one.
 */
const castRun = (
  parts: string[],
  how: OutlineCase,
  firstIsFirst: boolean,
  lastIsLast: boolean,
  reach: Reach,
): string[] =>
  parts.map((part, index) => {
    if (asTyped(part)) return part;
    if (reach === 'named' && alreadyUp(part)) return part;
    const isFirst = index === 0 && firstIsFirst;
    const isLast = index === parts.length - 1 && lastIsLast;
    const plain = reach === 'cast' ? part.toLocaleLowerCase() : part;
    const small = SMALL.has(lettersIn(plain).toLocaleLowerCase());
    if (how === 'sentence') return isFirst ? up(plain) : plain;
    if (isFirst || isLast) return up(plain);
    return small ? plain : up(plain);
  });

/**
 * A word, cast — its hyphen parts read as a run of their own.
 *
 * **A run of one has to know its place in the title**, which is what both
 * flags carry: without them a single word is the first and the last word of
 * its own run and takes a capital whatever it is, so *and* was capitalised in
 * every title. A rule written for a list has to be given the list's ends
 * rather than deriving them from the piece in hand.
 */
const castWord = (
  word: string,
  how: OutlineCase,
  isFirst: boolean,
  isLast: boolean,
  reach: Reach,
): string =>
  castRun(word.includes('-') ? word.split('-') : [word], how, isFirst, isLast, reach).join(
    word.includes('-') ? '-' : '',
  );

/** A word that closes a part of a title: *Division:* before its subtitle. */
const closes = (word: string): boolean => /[:;.?!]$/.test(word);

/**
 * A name in the case asked for.
 *
 * **Title case**: every word capitalised but the small ones, with the first
 * and the last always capitalised. **Sentence case**: the first word
 * capitalised and the rest lowered. **As typed** changes nothing at all, which
 * is the default, so no outline made before this moves.
 *
 * **A colon starts a new title and does not start a new sentence**, which is
 * the one place the two differ beyond their own rule: *Division: The Long Way*
 * is a title and a subtitle, two things each with a first word, while
 * *Division: the long way* is one sentence with one. A chapter named with a
 * colon is the commonest title there is, so getting this wrong would be
 * visible on the first book anybody set.
 *
 * The spacing is the writer's: words are cast where they stand and the gaps
 * between them are left exactly as they were found.
 */
export const castName = (name: string, how: OutlineCase, reach: Reach = 'cast'): string => {
  if (how === 'as_typed' || name.trim() === '') return name;
  const pieces = name.split(/(\s+)/);
  const words = pieces.filter((piece) => !/^\s*$/.test(piece));
  if (words.length === 0) return name;
  let seen = -1;
  return pieces
    .map((piece) => {
      if (/^\s*$/.test(piece)) return piece;
      seen += 1;
      const index = seen;
      const before = words[index - 1];
      const opens = index === 0 || (how === 'title' && before !== undefined && closes(before));
      const ends = index === words.length - 1 || (how === 'title' && closes(piece));
      return castWord(piece, how, opens, ends, reach);
    })
    .join('');
};

/** The case this project names its outline rows in. */
export const outlineCaseOf = (file: ProjectFile): OutlineCase => {
  const said = file.settings.outlineCase;
  return OUTLINE_CASES.includes(said as OutlineCase) ? (said as OutlineCase) : 'as_typed';
};

/**
 * Whether this row's name is the row's to cast.
 *
 * **A row that references research is read rather than typed** (§5): its name
 * belongs to the shelf, renaming it there renames it here, and casting it from
 * this side would be this room editing another room's record.
 */
export const mayCast = (item: OutlineItem): boolean => item.source?.type !== 'research_item';

/** Every row a change of case would rename, which is what the sentence counts. */
export const rowsCaseWouldChange = (file: ProjectFile, how: OutlineCase): OutlineItem[] =>
  outlinesOf(file).flatMap((outline) =>
    outline.items.filter((item) => mayCast(item) && castName(item.title, how) !== item.title),
  );

/**
 * What choosing this case would do, said before it can be asked for
 * (`trackRemoval`'s shape).
 */
export const describeOutlineCase = (file: ProjectFile, how: OutlineCase): string => {
  if (how === 'as_typed') return 'Names are left exactly as they are typed.';
  const what =
    how === 'title'
      ? 'Every word but the small ones takes a capital.'
      : 'The first word takes a capital and the rest do not.';
  const count = rowsCaseWouldChange(file, how).length;
  if (count === 0) return `${what} Nothing in the outline reads differently.`;
  return `${what} ${count === 1 ? '1 row is' : `${count} rows are`} renamed, and a promoted one renames what it is in the book.`;
};

/**
 * One row, brought up to the case — what a writer leaving a box runs.
 *
 * `named` rather than `cast`: it adds capitals and never takes one away, so a
 * surname typed into a note survives being left and re-entered. The act that
 * may lower is the setting itself.
 */
export const castRowName = (
  file: ProjectFile,
  outlineId: OutlineId,
  itemId: OutlineItemId,
  reach: Reach = 'named',
): ProjectFile => {
  const how = outlineCaseOf(file);
  if (how === 'as_typed') return file;
  const outline = outlinesOf(file).find((one) => (one.id as string) === (outlineId as string));
  const item = outline?.items.find((one) => (one.id as string) === (itemId as string));
  if (!outline || !item || !mayCast(item)) return file;
  const cast = castName(item.title, how, reach);
  if (cast === item.title) return file;
  // Through `updateItem`, so a promoted row renames the chapter, section or
  // beat it **is** — one object seen from two places, and a second path that
  // wrote the title directly would leave the book saying the older name.
  return updateItem(file, outline.id, item.id, { title: cast });
};

/**
 * Choose the case, and name the outline in it.
 *
 * **Changing the setting casts what is already there.** A setting that only
 * reached rows typed after it would do nothing on the screen when it was
 * pressed, which in this project reads exactly like a setting that does not
 * work — and the writer would have to visit four hundred rows to find out it
 * did. It is one act and undo takes it back in one keystroke (§6c).
 *
 * **This is the one thing that may lower a capital**, which is why `Reach` is
 * a pair rather than a flag nobody reads: a writer asking for sentence case
 * has asked for the capitals to come off, and a row they happen to leave
 * afterwards has not.
 */
export const setOutlineCase = (file: ProjectFile, how: OutlineCase): ProjectFile => {
  const settled: ProjectFile = { ...file, settings: { ...file.settings, outlineCase: how } };
  if (how === 'as_typed') return settled;
  return outlinesOf(settled).reduce<ProjectFile>((carried, outline: Outline) => {
    return outline.items.reduce<ProjectFile>(
      (inner, item) => castRowName(inner, outline.id, item.id, 'cast'),
      carried,
    );
  }, settled);
};
