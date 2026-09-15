/**
 * Where the sections of the workspace sit, and which of them are out
 * (addendum 02 §8).
 *
 * The workspace has four places a section can be: the tall column down one
 * side, the two stacked halves of the stage beside it, and the narrow column
 * on the far side. Which section is in which is the writer's business, not
 * the program's — someone cutting a sequence wants the lanes big and the
 * script small, someone drafting wants the opposite — so the arrangement is
 * a preference, and any section can be swapped with any other.
 *
 * A section can also leave the workspace entirely for a window of its own,
 * which is what makes a second monitor useful. That is the `PaneKey` below:
 * the four sections plus research and any number of beats, each of which
 * keys on its own id so two beats can be open at once.
 */

import { isProseFormat, nounsFor, type ProjectFormat } from '@vcwriter/domain';

export type PaneId = 'script' | 'viewer' | 'lanes' | 'inspector';
export type SlotId = 'left' | 'top' | 'bottom' | 'right';

export type Arrangement = Record<SlotId, PaneId>;

export const PANE_IDS: PaneId[] = ['script', 'viewer', 'lanes', 'inspector'];
export const SLOT_IDS: SlotId[] = ['left', 'top', 'bottom', 'right'];

export const DEFAULT_ARRANGEMENT: Arrangement = {
  left: 'script',
  top: 'viewer',
  bottom: 'lanes',
  right: 'inspector',
};

export const PANE_NAMES: Record<PaneId, string> = {
  script: 'Script',
  viewer: 'Timeline & Viewer',
  lanes: 'Plot lanes',
  inspector: 'Inspector',
};

/**
 * The sections, named for the format in hand.
 *
 * A novel and a short story are written as a manuscript, not a script, and
 * the section that shows the finished pages is called what the work is
 * called (spec §6.4). Nothing else changes: it is the same section doing the
 * same thing, under the name its writer uses for it.
 */
export const paneNamesFor = (format: ProjectFormat | null): Record<PaneId, string> => {
  // Read from the format's own nouns, so a new prose format names its pages
  // without this file being told it exists (addendum 16 §1).
  if (format && isProseFormat(format)) return { ...PANE_NAMES, script: nounsFor(format).manuscript };
  // Short form is written on a sheet, not in a script, and the strip under it
  // is a timeline rather than a set of plot lanes — a commercial has no
  // subplot to lane (addendum 05 §1, §3).
  if (format === 'short_form') return { ...PANE_NAMES, script: 'Sheet', lanes: 'Timeline' };
  return PANE_NAMES;
};

/** What the finished pages are called in this format. */
export const scriptWordFor = (format: ProjectFormat | null): string => {
  if (format && isProseFormat(format)) return nounsFor(format).manuscript.toLowerCase();
  if (format === 'short_form') return 'sheet';
  return 'script';
};

export const SLOT_NAMES: Record<SlotId, string> = {
  left: 'Side column',
  top: 'Stage, top',
  bottom: 'Stage, bottom',
  right: 'Far column',
};

/** Which place a section is currently in. */
export const slotOf = (arrangement: Arrangement, pane: PaneId): SlotId =>
  (SLOT_IDS.find((slot) => arrangement[slot] === pane) ?? 'left') as SlotId;

/**
 * Put a section in a place. Whatever was there takes the place it came from,
 * so the four sections stay in the four places and nothing is ever displaced
 * into nowhere.
 */
export const movePane = (arrangement: Arrangement, pane: PaneId, to: SlotId): Arrangement => {
  const from = slotOf(arrangement, pane);
  if (from === to) return arrangement;
  return { ...arrangement, [from]: arrangement[to], [to]: pane };
};

/**
 * A remembered arrangement, made safe. A preference written by an older
 * version — or by hand — must not be able to lose a section or show one
 * twice, so anything that is not a complete permutation falls back.
 */
export const normaliseArrangement = (value: unknown): Arrangement => {
  if (!value || typeof value !== 'object') return DEFAULT_ARRANGEMENT;
  const candidate = value as Record<string, unknown>;
  const seen = new Set<string>();
  for (const slot of SLOT_IDS) {
    const pane = candidate[slot];
    if (typeof pane !== 'string' || !PANE_IDS.includes(pane as PaneId) || seen.has(pane)) {
      return DEFAULT_ARRANGEMENT;
    }
    seen.add(pane);
  }
  return { ...(candidate as unknown as Arrangement) };
};

// ------------------------------------------------------------ windows of one

/**
 * A section in a window of its own. Beats carry the beat's id.
 *
 * The three rooms — research, the Outliner and the Story Sculptor — are here
 * for the same reason the four sections are: each is a whole screen's work
 * done *beside* the writing rather than in it, which is exactly what a second
 * monitor is for. They cover the whole workspace when they are opened over
 * it, so a writer with two screens was covering the script to look at the
 * board they were building it from.
 */
export type PaneKey = PaneId | 'research' | 'outliner' | 'sculptor' | `beat:${string}`;

/** The rooms: whole screens rather than sections of the workspace. */
export const ROOM_PANES = ['research', 'outliner', 'sculptor'] as const;
export type RoomPane = (typeof ROOM_PANES)[number];

export const isRoomPane = (pane: string): pane is RoomPane =>
  (ROOM_PANES as readonly string[]).includes(pane);

export const beatPane = (beatId: string): PaneKey => `beat:${beatId}`;

export const beatIdOf = (pane: string): string | null =>
  pane.startsWith('beat:') ? pane.slice('beat:'.length) : null;

/** What each room is called, in the one place that decides it. */
export const ROOM_NAMES: Record<RoomPane, string> = {
  research: 'Research',
  outliner: 'Outliner',
  sculptor: 'Story Sculptor',
};

/** What a window of this section calls itself, before the project is known. */
export const paneTitle = (pane: string, format: ProjectFormat | null = null): string => {
  if (isRoomPane(pane)) return ROOM_NAMES[pane];
  if (beatIdOf(pane)) return 'Beat';
  return paneNamesFor(format)[pane as PaneId] ?? 'VC Writer';
};
