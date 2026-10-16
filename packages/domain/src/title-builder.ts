import { placedMarkers } from './markers.js';
import { scriptFormatOf } from './pagination.js';
import type { ProjectFile } from './project-file.js';

/**
 * **The title-page builder** (addendum 38 §5, Ken's spec §5): the lines a
 * play's front page carries that a screenplay's does not, offered from what
 * the play already is rather than typed from memory.
 *
 * Offered, never imposed — the field is free text and these are chips beside
 * it, `CHARACTER_ROLES`' rule: *A Comedy in Two Acts* is a descriptor no list
 * would hold.
 */

const NUMBER_WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** Whether this play is set as a musical: the preset is what says so. */
export const isMusical = (file: ProjectFile): boolean =>
  scriptFormatOf(file.project.format, file.settings.scriptFormat) === 'stage_us_musical';

/** How many acts the play is divided into: its act markers, counted. */
export const actCount = (file: ProjectFile): number =>
  placedMarkers(file).filter((placed) => placed.marker.kind === 'act').length;

/**
 * What the work is, for the line under the title, **the play's own first**:
 * *A Play in Two Acts* where two act markers divide it, *A Musical* where the
 * musical preset sets it, then the usual others. A play with no act marked is
 * offered *in One Act*, which is what a play with no interval is.
 */
export const titleDescriptors = (file: ProjectFile): string[] => {
  const kind = isMusical(file) ? 'Musical' : 'Play';
  const acts = Math.max(1, actCount(file));
  const counted = `A ${kind} in ${NUMBER_WORDS[acts - 1] ?? String(acts)} Act${acts === 1 ? '' : 's'}`;
  const others = isMusical(file)
    ? ['A New Musical', 'A Musical in Two Acts', 'A Musical in One Act']
    : ['A Play in Two Acts', 'A Play in One Act', 'A Full-Length Play', 'A Comedy', 'A Drama'];
  return [counted, ...others.filter((one) => one !== counted)];
};

/** A musical's three writers, in the order its title page names them. */
export const MUSICAL_CREDIT_ROLES = ['Book by', 'Music by', 'Lyrics by'] as const;
