import { BARE_LABEL } from './importing.js';
import { unitsInStoryOrder } from './selectors.js';
import type { ProjectFile } from './project-file.js';
import type { StructuralUnitId } from './ids.js';

/**
 * **The numerals a chapter is headed with** (addendum 33 §11, from Ken: *I
 * merged two sections and made it one chapter. I would like it to
 * automatically update the title headings if they're Roman numerals. And
 * currently, in the actual passage, you have to rename it in the heading. If
 * you rename it in the chapter portion, it should rename that heading also*).
 *
 * A story imported from a manuscript is divided at its numerals (addendum 21
 * §10), and those numerals arrive as **heading elements in the writing** —
 * which is right, because they are what the document said. The cost is that
 * the book then holds a stored copy of something derived: *which chapter this
 * is*. Merge two and the rest count I, III, IV; and the unit's title and the
 * heading it opens with are two strings nothing kept in step, so a chapter
 * renamed in the rail still printed its old name on the page.
 *
 * Two rules, and the whole module is them.
 *
 * **A bare numeral is the program's counting and is kept in step.** Nothing
 * else is: a heading with words in it is the writer's, and renumbering *The
 * Lighthouse* would be this program rewriting somebody's manuscript, which
 * Layout's own rule forbids outright. The style is read back from what is
 * there — roman or arabic, capitals or not, the full stop or not — so a book
 * set in lower-case roman stays in lower-case roman and nothing here decides
 * what a numeral looks like.
 *
 * **A name is typed once.** Renaming a chapter renames the heading it opens
 * with, where the two were saying the same thing; where the writer has made
 * them differ, they are theirs and neither is touched. It lives in
 * `updateUnit` beside `retitlePlans`, which is the same sentence about a
 * board: *rename it in either place and it is renamed in both*.
 */

/** How a bare label is written, read back off one rather than chosen here. */
export interface LabelStyle {
  kind: 'roman' | 'arabic' | 'word';
  /** Upper case, for a roman numeral or a word. */
  caps: boolean;
  /** A full stop after it, as a manuscript usually sets one. */
  dot: boolean;
}

const ROMAN: ReadonlyArray<[number, string]> = [
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'],
  [5, 'V'], [4, 'IV'], [1, 'I'],
];

const WORDS = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty',
];

const roman = (value: number): string => {
  let left = value;
  let out = '';
  for (const [size, letters] of ROMAN) {
    while (left >= size) {
      out += letters;
      left -= size;
    }
  }
  return out;
};

/**
 * What kind of label this line is, or null where it is not one at all.
 *
 * **A roman numeral and a word are told apart by shape**, never by meaning: a
 * line of I, V, X, L and C is roman, a run of digits is arabic, and anything
 * else `BARE_LABEL` accepts is a number said in words.
 */
export const labelStyle = (text: string): LabelStyle | null => {
  const trimmed = text.trim();
  if (!BARE_LABEL.test(trimmed)) return null;
  const dot = trimmed.endsWith('.');
  const body = (dot ? trimmed.slice(0, -1) : trimmed).trim();
  if (!body) return null;
  if (/^[0-9]+$/.test(body)) return { kind: 'arabic', caps: false, dot };
  if (/^[ivxlc]+$/i.test(body)) return { kind: 'roman', caps: body === body.toUpperCase(), dot };
  return { kind: 'word', caps: body[0] === body[0]?.toUpperCase(), dot };
};

/**
 * The label a position would carry, in the style the chapter already wears.
 *
 * Named `sectionLabel` because `labelFor` is the Writers Room's, for an
 * assignment — the sixth name this project has stepped around (`origin` →
 * `found`, `Standing` → `Situation`, `code` → `discount`, `LAPSE_PROMISE`,
 * `ProjectHome`), and the second the compiler caught rather than a reader.
 */
export const sectionLabel = (position: number, style: LabelStyle): string => {
  const body =
    style.kind === 'arabic'
      ? String(position)
      : style.kind === 'roman'
        ? style.caps
          ? roman(position)
          : roman(position).toLowerCase()
        : (WORDS[position] ?? String(position));
  const cased = style.kind === 'word' && !style.caps ? body.toLowerCase() : body;
  return style.dot ? `${cased}.` : cased;
};

/**
 * The divisions a story is counted in: each marker of the project's own
 * division kind starts the count again, and whatever stands before the first
 * one is a run of its own. It is `divisionSpan`'s rule read over units, which
 * is what makes chapter one of the second story chapter one rather than
 * chapter four.
 */
const runsOf = (file: ProjectFile): StructuralUnitId[][] => {
  const starts = new Set(file.markers.map((marker) => marker.unitId as string | null).filter(Boolean) as string[]);
  const runs: StructuralUnitId[][] = [];
  let run: StructuralUnitId[] = [];
  for (const unit of unitsInStoryOrder(file)) {
    if (starts.has(unit.id as string) && run.length > 0) {
      runs.push(run);
      run = [];
    }
    run.push(unit.id);
  }
  if (run.length > 0) runs.push(run);
  return runs;
};

/** The heading a unit opens with, where its first element is one. */
const openingHeading = (file: ProjectFile, unitId: StructuralUnitId) => {
  const beat = file.beats.find((one) => one.unitId === unitId && one.manuscript.elements.length > 0);
  const element = beat?.manuscript.elements[0];
  return element && element.type === 'heading' ? { beatId: beat!.id, element } : null;
};

const writeHeading = (file: ProjectFile, beatId: string, elementId: string, text: string): ProjectFile => ({
  ...file,
  beats: file.beats.map((beat) =>
    (beat.id as string) !== beatId
      ? beat
      : {
          ...beat,
          manuscript: {
            ...beat.manuscript,
            elements: beat.manuscript.elements.map((element) =>
              (element.id as string) === elementId ? { ...element, text } : element,
            ),
          },
        },
  ),
});

/**
 * **Put the numerals back in order** (§11). Run after anything that changes
 * how many chapters a division has — a merge, a chapter removed — so the
 * headings count 1, 2, 3 again with nothing for the writer to retype.
 *
 * It is deliberately narrow. Only a heading that **is** a bare numeral is
 * touched, only within its own division, and only where it is already out of
 * step; a division whose chapters carry titles is left exactly as it is, and
 * so is one where the writer has numbered them by hand in some other way.
 * Where the unit's title is that same numeral it travels with it, the two
 * being one name said twice (§11's other rule).
 */
export const renumberSections = (file: ProjectFile): ProjectFile => {
  let working = file;
  for (const run of runsOf(file)) {
    let position = 0;
    for (const unitId of run) {
      const head = openingHeading(working, unitId);
      if (!head) continue;
      const style = labelStyle(head.element.text);
      if (!style) continue;
      position += 1;
      const wanted = sectionLabel(position, style);
      if (wanted === head.element.text.trim()) continue;
      const was = head.element.text.trim();
      working = writeHeading(working, head.beatId as string, head.element.id as string, wanted);
      working = {
        ...working,
        units: working.units.map((unit) =>
          unit.id === unitId && unit.title.trim() === was ? { ...unit, title: wanted } : unit,
        ),
      };
    }
  }
  return working;
};

/**
 * **A name is typed once** (§11): renaming a chapter renames the heading it
 * opens with, where the heading was saying the same thing as the title.
 *
 * Where the writer has made them differ the heading is theirs — a manuscript
 * is not this program's to rewrite on the strength of a rename somewhere
 * else — and where a unit has no heading of its own there is nothing to keep
 * in step, §9l already standing the title in on the page.
 */
export const retitleHeading = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  was: string,
  title: string,
): ProjectFile => {
  const head = openingHeading(file, unitId);
  if (!head) return file;
  if (head.element.text.trim() !== was.trim()) return file;
  if (head.element.text.trim() === title.trim()) return file;
  return writeHeading(file, head.beatId as string, head.element.id as string, title);
};
