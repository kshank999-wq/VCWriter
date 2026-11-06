/**
 * Story Sculptor 2.0's typed cards (addendum 03 v2 §4).
 *
 * One table says what each type is called, its colour, its short label (so
 * colour is never the only signal), the details it asks for, and how deep in
 * the story it usually sits. Everything else reads from here.
 */

export const SCULPT_TYPES = ['frame', 'plot_point', 'scene', 'character', 'action', 'beat', 'note', 'custom'] as const;
export type SculptType = (typeof SCULPT_TYPES)[number];

export interface SculptTypeInfo {
  type: SculptType;
  name: string;
  plural: string;
  /** The colour token's default (v2 §4). */
  colour: string;
  /** Two letters on every card, for a writer who cannot tell the colours apart. */
  badge: string;
  /** The details the inspector offers. */
  fields: readonly string[];
  /**
   * How deep this type usually sits, for *Collapse to level* by name (v2 §6):
   * a branch folds at a card whose rank is at or past the chosen type's.
   */
  rank: number;
}

export const SCULPT_TYPE_INFO: Record<SculptType, SculptTypeInfo> = {
  frame: {
    type: 'frame',
    name: 'Frame',
    plural: 'Frames',
    colour: '#4f46e5',
    badge: 'FR',
    fields: ['Story order', 'Purpose', 'Summary', 'Polarity', 'Arc'],
    rank: 0,
  },
  plot_point: {
    type: 'plot_point',
    name: 'Plot point',
    plural: 'Plot points',
    colour: '#7c3aed',
    badge: 'PP',
    fields: ['Stakes', 'Cause', 'Effect'],
    rank: 1,
  },
  scene: {
    type: 'scene',
    name: 'Scene',
    plural: 'Scenes',
    colour: '#2563eb',
    badge: 'SC',
    fields: ['Slugline', 'Purpose', 'Summary', 'Sequence'],
    rank: 2,
  },
  character: {
    type: 'character',
    name: 'Character',
    plural: 'Characters',
    colour: '#d97706',
    badge: 'CH',
    fields: ['Scene objective', 'Emotional state'],
    rank: 3,
  },
  action: {
    type: 'action',
    name: 'Action',
    plural: 'Actions',
    colour: '#e8603c',
    badge: 'AC',
    fields: ['Verb', 'Target', 'Outcome'],
    rank: 4,
  },
  beat: {
    type: 'beat',
    name: 'Beat',
    plural: 'Beats',
    colour: '#0d9488',
    badge: 'BT',
    fields: ['Rhythm', 'Turn', 'Polarity'],
    rank: 4,
  },
  note: {
    type: 'note',
    name: 'Note',
    plural: 'Notes',
    colour: '#6b7280',
    badge: 'NT',
    fields: [],
    rank: 5,
  },
  custom: {
    type: 'custom',
    name: 'Custom',
    plural: 'Custom',
    colour: '#64748b',
    badge: 'CU',
    fields: [],
    rank: 5,
  },
};

export const isSculptType = (value: string): value is SculptType => (SCULPT_TYPES as readonly string[]).includes(value);

/** The type's entry, falling back to Note for anything the table does not know. */
export const sculptTypeInfo = (type: string): SculptTypeInfo => SCULPT_TYPE_INFO[isSculptType(type) ? type : 'note'];

/** What a card's type is called, using a custom type's own name where it has one. */
export const sculptTypeName = (type: string, subtype = ''): string =>
  (type === 'custom' || type === 'note') && subtype.trim() ? subtype.trim() : sculptTypeInfo(type).name;

/** The presets for *Collapse to level* (v2 §6), in the order the toolbar offers them. */
export const SCULPT_LEVEL_PRESETS: readonly { type: SculptType; name: string }[] = [
  { type: 'frame', name: 'Frame' },
  { type: 'scene', name: 'Scene' },
  { type: 'character', name: 'Character' },
  { type: 'action', name: 'Action' },
];

/** The semantic links (v2 §7). */
export const SCULPT_LINK_TYPES = [
  { type: 'related', name: 'Related to', directed: false },
  { type: 'causes', name: 'Causes', directed: true },
  { type: 'appears_in', name: 'Appears in', directed: true },
  { type: 'setup_payoff', name: 'Sets up / pays off', directed: true },
  { type: 'conflict', name: 'Conflict', directed: false },
  { type: 'influence', name: 'Influences', directed: true },
  { type: 'custom', name: 'Custom', directed: true },
] as const;

export const sculptLinkTypeName = (type: string): string =>
  SCULPT_LINK_TYPES.find((one) => one.type === type)?.name ?? 'Related to';
