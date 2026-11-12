import { freshCopy, parseProjectFile, type ProjectFile } from '@vcwriter/domain';
import list from './samples/samples.json';

/**
 * The sample projects, one per module (from Ken, 12 November: *sample
 * projects for each module … available as a sample that you can load*).
 *
 * Built by `apps/web/scripts/samples.mjs` from the demo projects the help
 * pictures are taken from, and carried in the program so a sample opens with
 * no connection. Each opens as a **new project**: the writer's copy, to change
 * as they like, never the sample itself.
 */
export interface Sample {
  format: string;
  file: string;
  title: string;
  author: string;
  about: string;
}

export const SAMPLES: readonly Sample[] = list as Sample[];

const files = import.meta.glob('./samples/*.vcw', { query: '?raw', import: 'default' });

/** A sample, read and parsed as a project file is. */
export const loadSample = async (sample: Sample): Promise<ProjectFile> => {
  const read = files[`./samples/${sample.file}`];
  if (!read) throw new Error(`The sample ${sample.title} is missing from this build.`);
  // New ids throughout, so each opening is a project of its own (`freshCopy`).
  return freshCopy(parseProjectFile(JSON.parse((await read()) as string)));
};
