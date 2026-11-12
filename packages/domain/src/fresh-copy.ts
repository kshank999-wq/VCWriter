import { newId } from './ids.js';
import { parseProjectFile, type ProjectFile } from './project-file.js';

/**
 * **A project with every id made new** — the copy a sample opens as (from Ken,
 * 12 November: *sample projects … that you can load*).
 *
 * A sample file is the same bytes for everybody, and every scene, beat, note
 * and the project itself is stored in the account under its id, so two writers
 * opening one sample, or one writer opening it twice, would be two projects
 * claiming the same rows. Each id in the file is given a new one, the same new
 * one wherever it appears, so every reference inside the project still points
 * at what it pointed at. The words are untouched: nothing a writer types looks
 * like an id.
 */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export const freshCopy = (file: ProjectFile): ProjectFile => {
  const renamed = new Map<string, string>();
  const text = JSON.stringify(file).replace(UUID, (id) => {
    const key = id.toLowerCase();
    let next = renamed.get(key);
    if (!next) {
      next = newId<never>() as unknown as string;
      renamed.set(key, next);
    }
    return next;
  });
  return parseProjectFile(JSON.parse(text));
};
