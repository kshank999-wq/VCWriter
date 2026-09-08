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

/** A section in a window of its own. Beats carry the beat's id. */
export type PaneKey = PaneId | 'research' | `beat:${string}`;

export const beatPane = (beatId: string): PaneKey => `beat:${beatId}`;

export const beatIdOf = (pane: string): string | null =>
  pane.startsWith('beat:') ? pane.slice('beat:'.length) : null;

/** What a window of this section calls itself, before the project is known. */
export const paneTitle = (pane: string): string => {
  if (pane === 'research') return 'Research';
  if (beatIdOf(pane)) return 'Beat';
  return PANE_NAMES[pane as PaneId] ?? 'VC Writer';
};
