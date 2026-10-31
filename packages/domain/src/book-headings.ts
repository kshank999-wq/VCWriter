import { structureNumbers } from './numbering.js';
import { isInstructional } from './formats.js';
import type { Beat, StructuralUnit } from './entities/structure.js';
import type { ProjectFile } from './project-file.js';

/**
 * **A book's section and subsection headings, in its manuscript** (from Ken:
 * *it just needs to look like the manuscript. So you have the chapter, and
 * then you'll have section 1.1, which is "Why do you want to be a writer?"
 * Then you'll have all the little subsections as titles… And you need the
 * option to be able to turn those on or off… And those section numbers will
 * be to the left and bold. Title case.*).
 *
 * On an instructional book each section and subsection prints its number and
 * its title, the number bold and to the left, the title in title case; a
 * heading switched off (`headingShown`) prints nothing, so two can be read as
 * one. Nothing is stored: the number is `structureNumbers`', the words the
 * section's and subsection's own titles.
 */

const SMALL = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'as', 'at', 'by', 'in', 'of', 'off', 'on', 'per', 'to', 'up', 'via', 'vs']);

/**
 * Title case as a book sets it: every word capitalised but the small ones in
 * the middle. A word already in capitals is left as typed — an acronym or a
 * heading the writer set in capitals on purpose.
 */
export const titleCase = (text: string): string => {
  const words = text.trim().split(/(\s+)/);
  const real = words.filter((word) => word.trim().length > 0);
  let seen = 0;
  return words
    .map((word) => {
      if (word.trim().length === 0) return word;
      const position = seen++;
      const letters = word.replace(/[^\p{L}]/gu, '');
      if (letters.length > 1 && letters === letters.toUpperCase()) return word;
      const bare = word.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
      const edge = position === 0 || position === real.length - 1;
      if (!edge && SMALL.has(bare)) return word.toLowerCase();
      return word.replace(/\p{L}/u, (first) => first.toUpperCase());
    })
    .join('');
};

/** Whether this book prints section and subsection headings at all. */
export const printsBookHeadings = (file: ProjectFile): boolean => isInstructional(file.project.format);

export interface BookHeading {
  level: 'section' | 'subsection';
  number: string;
  title: string;
  shown: boolean;
}

/** A section's heading: its number and its title in title case. */
export const sectionHeading = (file: ProjectFile, unit: StructuralUnit, numbers = structureNumbers(file)): BookHeading => ({
  level: 'section',
  number: numbers.units.get(unit.id as string) ?? '',
  title: titleCase(unit.title),
  shown: unit.headingShown !== false && unit.title.trim().length > 0,
});

/** A subsection's heading: its number and its title in title case. */
export const subsectionHeading = (file: ProjectFile, beat: Beat, numbers = structureNumbers(file)): BookHeading => ({
  level: 'subsection',
  number: numbers.subs.get(beat.id as string) ?? '',
  title: titleCase(beat.title),
  shown: beat.headingShown !== false && beat.title.trim().length > 0,
});

/** The heading as the manuscript carries it, the number bold: `**1.1** Why Do You Want to Write?` */
export const headingLine = (heading: BookHeading): string =>
  heading.number ? `**${heading.number}** ${heading.title}` : heading.title;
