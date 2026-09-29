import type { NoteSessionId, ProjectFile } from '../index.js';

/**
 * A sitting with none of the standard categories in it (addendum 26 §16a).
 *
 * `beginSession` hands a new sitting the format's standard categories, which
 * is what a writer wants and what most of these tests do not: an assertion
 * about *these two categories* would otherwise be an assertion about the seed
 * list, and would have to be edited every time somebody adds a shelf. So the
 * tests that are about an act clear the seeds and make their own, and the
 * seeding itself is tested where it belongs, in `note-sorter.test.ts`.
 *
 * It is one function rather than one per file for the reason the domain keeps
 * repeating: three copies of a predicate is three answers, and the third is
 * the one nobody updates.
 *
 * A seed is *any category of this sitting that is not the unsorted pile* —
 * read off `systemKey` rather than off the names, so it cannot fall out of
 * step with `seedCategoriesFor`. It is therefore called before a test makes
 * categories of its own.
 */
export const withoutSeeds = (file: ProjectFile, sessionId: NoteSessionId): ProjectFile => ({
  ...file,
  researchCategories: file.researchCategories.filter(
    (one) => (one.sessionId as string) !== (sessionId as string) || one.systemKey !== null,
  ),
});
