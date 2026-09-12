import { z } from 'zod';
import { id, nowIso, orderKey, timestamps } from './entities/common.js';
import { storyEntityRefSchema } from './entities/links.js';
import { orderKeyBetween } from './ordering.js';
import { newId } from './ids.js';
import type {
  ArcPointId,
  BeatId,
  CharacterArcId,
  CharacterId,
  CharacterRelationshipId,
  CharacterTraitId,
  CharacterizationItemId,
  ManuscriptElementId,
  ProjectId,
  StructuralUnitId,
  UsageLinkId,
} from './ids.js';
import type { ProjectFile } from './project-file.js';

/**
 * The Character Creator (addendum 08).
 *
 * **A trait is not characterization**, and that one sentence decides the shape
 * of this file. *Greedy* is telling; *leaves an embarrassingly small tip* is
 * showing, and it is the thing a writer can put in a scene. So the unit of work
 * is the **characterization item**, and a trait is a folder for the ways a
 * quality gets shown.
 *
 * **Used is a reading and retired is a fact.** Whether an item has appeared in
 * the manuscript is derived from its usage links every time it is asked —
 * nothing sets it, so nothing can set it wrongly, and §17's hardest line
 * (*deleting the linked content returns it to unused*) is free rather than
 * implemented. Whether the writer has *decided* to leave it unused is an
 * intention no reading of the manuscript can discover, so that one is stored.
 */

// --------------------------------------------------------------- the records

export const TRAIT_TONES = ['positive', 'negative', 'neutral', 'unsaid'] as const;
export const traitToneSchema = z.enum(TRAIT_TONES);
export type TraitTone = (typeof TRAIT_TONES)[number];

/**
 * The tones, as they are offered to the writer.
 *
 * `unsaid` is first in the list the interface shows and is the default, so
 * choosing a reading is something somebody does on purpose rather than
 * something they fail to avoid (§4).
 */
export const TRAIT_TONE_WORDS: Record<TraitTone, string> = {
  unsaid: 'Not saying',
  positive: 'A virtue',
  negative: 'A flaw',
  neutral: 'Neither',
};

/**
 * A quality, and how much of the character it is.
 *
 * **`unsaid` is the default tone and it is the important one.** §4: whether a
 * trait is good or bad stays the writer's to decide and is never imposed —
 * *loyal* is a virtue until somebody is loyal to the wrong person. A schema
 * that made tone required would be the software having an opinion about a
 * character.
 *
 * Contradictory traits are allowed and expected: believable people behave
 * differently under different conditions, so nothing here objects to a
 * character who is both generous and grasping.
 */
export const characterTraitSchema = z.object({
  id: id<CharacterTraitId>(),
  projectId: id<ProjectId>(),
  characterId: id<CharacterId>(),
  name: z.string().min(1),
  /** The writer's own grouping — *under pressure*, *at home*. Free text. */
  kind: z.string().default(''),
  /** How much of the character this is, 1–5. Not a score of the character. */
  prominence: z.number().int().min(1).max(5).default(3),
  tone: traitToneSchema.default('unsaid'),
  /** Why it matters — the thing that makes the trait worth dramatising. */
  notes: z.string().default(''),
  orderKey: orderKey(),
  archived: z.boolean().default(false),
  ...timestamps,
});
export type CharacterTrait = z.infer<typeof characterTraitSchema>;

/**
 * One concrete way a trait is shown. **The unit of work** (addendum 08 §1).
 *
 * An item with no usage links is not an error and not a warning: it is *on
 * deck*, waiting for a scene that suits it, which is most of what this module
 * holds most of the time.
 */
export const characterizationItemSchema = z.object({
  id: id<CharacterizationItemId>(),
  projectId: id<ProjectId>(),
  characterId: id<CharacterId>(),
  /** The trait it demonstrates. Null for something noticed before it is filed. */
  traitId: id<CharacterTraitId>().nullable().default(null),
  /** What happens — an action, a habit, a choice, a prop, a way of speaking. */
  text: z.string().min(1),
  notes: z.string().default(''),
  /**
   * Deliberately left out of the story (§17).
   *
   * Stored rather than derived, because it is an *intention*: no reading of the
   * manuscript can tell an idea the writer has decided against from one they
   * have not got to yet, and a module that treated them alike would keep
   * nagging about a decision already made.
   */
  retired: z.boolean().default(false),
  orderKey: orderKey(),
  ...timestamps,
});
export type CharacterizationItem = z.infer<typeof characterizationItemSchema>;

/**
 * Where a piece of character work appears in the writing.
 *
 * **Anchored by id, with the words kept only as a quote** (§16, addendum 08
 * §3.2). The beat and the element both have stable ids that survive the story
 * being reordered; the passage is copied beside them so the row reads without
 * opening the scene, and never as the thing the link is made of.
 */
export const usageLinkSchema = z.object({
  id: id<UsageLinkId>(),
  projectId: id<ProjectId>(),
  /** What is being tracked: a characterization item, or an arc point. */
  ownerKind: z.enum(['characterization', 'arc_point']),
  ownerId: z.string(),
  /** The scene it is in, for getting back to it. */
  unitId: id<StructuralUnitId>().nullable().default(null),
  beatId: id<BeatId>(),
  /** The paragraph, where the writer pointed at one rather than the whole beat. */
  elementId: id<ManuscriptElementId>().nullable().default(null),
  /** The words as they were. For reading — never for finding. */
  quote: z.string().default(''),
  ...timestamps,
});
export type UsageLink = z.infer<typeof usageLinkSchema>;

// ------------------------------------------------------------------- the arc

/**
 * What kind of movement an arc point is.
 *
 * **`opportunity`, `refusal` and `doubling_down` are in this list rather than
 * in a system beside it** (addendum 08 §3.3). An arc is usually modelled as a
 * journey upward, and then a tragedy has to be forced through a shape built for
 * somebody else. A Scrooge and an antagonist use the same builder here; what
 * differs is which points they have.
 */
export const ARC_POINT_KINDS = [
  'movement',
  'setback',
  'discovery',
  'decision',
  'test',
  'turning_point',
  'opportunity',
  'refusal',
  'doubling_down',
] as const;
export const arcPointKindSchema = z.enum(ARC_POINT_KINDS);
export type ArcPointKind = (typeof ARC_POINT_KINDS)[number];

export const ARC_POINT_NAMES: Record<ArcPointKind, string> = {
  movement: 'A movement',
  setback: 'A setback',
  discovery: 'A discovery',
  decision: 'A decision',
  test: 'A test',
  turning_point: 'A turning point',
  opportunity: 'A chance to change',
  refusal: 'Refuses it',
  doubling_down: 'Doubles down',
};

export const characterArcSchema = z.object({
  id: id<CharacterArcId>(),
  projectId: id<ProjectId>(),
  characterId: id<CharacterId>(),
  /** Who they are at the start. */
  beginning: z.string().default(''),
  /** What they need to learn, confront, accept, reject or become. */
  need: z.string().default(''),
  /** Who they have become — or refused to become. */
  ending: z.string().default(''),
  ...timestamps,
});
export type CharacterArc = z.infer<typeof characterArcSchema>;

export const arcPointSchema = z.object({
  id: id<ArcPointId>(),
  projectId: id<ProjectId>(),
  arcId: id<CharacterArcId>(),
  characterId: id<CharacterId>(),
  kind: arcPointKindSchema.default('movement'),
  text: z.string().min(1),
  notes: z.string().default(''),
  /** Held back from the story on purpose, like a retired characterization. */
  retired: z.boolean().default(false),
  orderKey: orderKey(),
  ...timestamps,
});
export type ArcPoint = z.infer<typeof arcPointSchema>;

// --------------------------------------------------------- the relationship

export const RELATIONSHIP_KINDS = [
  'family',
  'romantic',
  'friend',
  'mentor',
  'rival',
  'enemy',
  'professional',
  'alliance',
  'dependency',
  'custom',
] as const;
export const relationshipKindSchema = z.enum(RELATIONSHIP_KINDS);
export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number];

/**
 * How one character stands towards another.
 *
 * **Directional, and that is the requirement rather than a detail** (§11): *A
 * trusts B while B is manipulating A* is two records, not one with a muddle in
 * it. Reading it the other way is a second row, which is also how the map draws
 * two different labels on one line.
 *
 * It is not a story link, though the module uses those elsewhere: §11 asks it to
 * carry a description, a *current state* and an *evolution*, and a link has none
 * of those and should not grow three fields every other link would leave empty
 * (addendum 08 §3.1).
 */
export const characterRelationshipSchema = z.object({
  id: id<CharacterRelationshipId>(),
  projectId: id<ProjectId>(),
  fromCharacterId: id<CharacterId>(),
  toCharacterId: id<CharacterId>(),
  kind: relationshipKindSchema.default('custom'),
  /** What the writer calls it, used when `kind` is custom and always shown. */
  label: z.string().default(''),
  description: z.string().default(''),
  /** Where it stands now. */
  state: z.string().default(''),
  /** How it changes across the story, where the writer tracks that. */
  evolution: z.string().default(''),
  ...timestamps,
});
export type CharacterRelationship = z.infer<typeof characterRelationshipSchema>;

/** The verbs a cross-character arc link can carry (§13). */
export const ARC_LINK_VERBS = [
  'causes',
  'influences',
  'challenges',
  'enables',
  'prevents',
  'reveals',
  'betrays',
  'inspires',
] as const;
export type ArcLinkVerb = (typeof ARC_LINK_VERBS)[number];

/**
 * A cross-character arc link, as a reference pair.
 *
 * **This one genuinely is a story link** (addendum 08 §3.1) — two references, a
 * verb and a note is exactly what `storyLinkSchema` already is, so nothing new
 * is built for it and it appears in the Related Elements box for free.
 */
export const arcPointRefSchema = storyEntityRefSchema.extend({ type: z.literal('arc_point') });

// ------------------------------------------------------- used, and not used

/** What a usage link is worth, looked at against the manuscript now. */
export type UsageStanding = 'used' | 'rewritten' | 'gone';

/**
 * Whether a link still points at something, and whether the words still match.
 *
 * Three answers rather than two, and the middle one is the point (addendum 08
 * §3.2): when the writer rewrites the line, the quote and the manuscript
 * diverge. **That is not a broken link.** It is a rewritten line, still in the
 * same beat, still showing the same trait — so it stays green and the row says
 * the words have changed. Going red there would punish somebody for writing.
 *
 * Only a target that is no longer in the document is `gone`.
 */
export const usageStanding = (link: UsageLink, file: ProjectFile): UsageStanding => {
  const beat = file.beats.find((one) => (one.id as string) === (link.beatId as string));
  if (!beat) return 'gone';

  if (link.elementId) {
    const element = beat.manuscript.elements.find((one) => one.id === link.elementId);
    if (!element) return 'gone';
    return element.text.trim() === link.quote.trim() ? 'used' : 'rewritten';
  }

  // A link to a whole beat has no line to compare, so it is used or it is gone.
  return 'used';
};

/** The links of one owner that still point at something. */
export const livingLinks = (
  links: readonly UsageLink[],
  owner: { kind: UsageLink['ownerKind']; id: string },
  file: ProjectFile,
): UsageLink[] =>
  links.filter(
    (link) =>
      link.ownerKind === owner.kind &&
      link.ownerId === owner.id &&
      usageStanding(link, file) !== 'gone',
  );

/**
 * Whether this has appeared in the writing.
 *
 * **Derived, always** (addendum 08 §2). Nothing stores this, so nothing can
 * store it wrongly: delete the beat and it goes red by itself, move the scene
 * and nothing changes at all, because the link is to an id and not a position.
 */
export const isUsed = (
  owner: { kind: UsageLink['ownerKind']; id: string },
  links: readonly UsageLink[],
  file: ProjectFile,
): boolean => livingLinks(links, owner, file).length > 0;

export type UsageColour = 'green' | 'red' | 'grey';

/**
 * The colour §6 asks for, with a third for what was set aside.
 *
 * Red means *not yet*, which is a normal and hopeful state — most of this
 * module is red most of the time. Grey means *decided against*, so it stops
 * counting as work outstanding without being deleted.
 */
export const usageColour = (input: {
  retired: boolean;
  used: boolean;
}): UsageColour => (input.retired ? 'grey' : input.used ? 'green' : 'red');

/** What the colour means, said to the writer rather than about the data. */
export const USAGE_WORDS: Record<UsageColour, string> = {
  green: 'In the writing',
  red: 'On deck',
  grey: 'Set aside',
};

// ---------------------------------------------------------- reading it back

/**
 * How much of the character a trait is, said in words.
 *
 * **Not a score of the character**, which is why none of these is a number the
 * writer could add up: a defining flaw and a defining virtue are both 5.
 */
export const PROMINENCE_WORDS: Record<number, string> = {
  1: 'Barely',
  2: 'Sometimes',
  3: 'Often',
  4: 'Strongly',
  5: 'Defining',
};

/** A trait with the ways it gets shown, which is the way round §1 asks for. */
export interface TraitWithItems {
  trait: CharacterTrait;
  items: { item: CharacterizationItem; used: boolean; colour: UsageColour }[];
  /** Nothing under it yet — an unfinished thought rather than an error (§1). */
  unshown: boolean;
}

/**
 * A character's traits, each holding its characterization.
 *
 * Returned this way round on purpose: the interface draws a trait *and what it
 * makes somebody do*, and a function that returned items with a trait attached
 * would make the telling the parent of the showing.
 */
export const characterizationOf = (input: {
  characterId: string;
  traits: readonly CharacterTrait[];
  items: readonly CharacterizationItem[];
  links: readonly UsageLink[];
  file: ProjectFile;
}): TraitWithItems[] =>
  input.traits
    .filter((trait) => (trait.characterId as string) === input.characterId && !trait.archived)
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1))
    .map((trait) => {
      const mine = input.items
        .filter((item) => (item.traitId as string | null) === (trait.id as string))
        .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1))
        .map((item) => {
          const used = isUsed({ kind: 'characterization', id: item.id as string }, input.links, input.file);
          return { item, used, colour: usageColour({ retired: item.retired, used }) };
        });
      return { trait, items: mine, unshown: mine.length === 0 };
    });

/**
 * Characterization noticed before it was filed under anything.
 *
 * The right-click workflow (§7) can make one of these in a second without
 * making the writer choose a trait first — so they have to have somewhere to be,
 * or the fast path would be the one that loses things.
 */
export const unfiledItems = (input: {
  characterId: string;
  items: readonly CharacterizationItem[];
}): CharacterizationItem[] =>
  input.items
    .filter((item) => (item.characterId as string) === input.characterId && item.traitId === null)
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1));

/** What is still on deck for one character — §6's summary, and §18's report. */
export const stillOnDeck = (input: {
  characterId: string;
  items: readonly CharacterizationItem[];
  points: readonly ArcPoint[];
  links: readonly UsageLink[];
  file: ProjectFile;
}): { characterization: CharacterizationItem[]; arc: ArcPoint[] } => ({
  characterization: input.items.filter(
    (item) =>
      (item.characterId as string) === input.characterId &&
      !item.retired &&
      !isUsed({ kind: 'characterization', id: item.id as string }, input.links, input.file),
  ),
  arc: input.points.filter(
    (point) =>
      (point.characterId as string) === input.characterId &&
      !point.retired &&
      !isUsed({ kind: 'arc_point', id: point.id as string }, input.links, input.file),
  ),
});

export const onDeckNote = (onDeck: { characterization: unknown[]; arc: unknown[] }): string => {
  const parts = [
    onDeck.characterization.length > 0
      ? `${onDeck.characterization.length} way${onDeck.characterization.length === 1 ? '' : 's'} to show them`
      : '',
    onDeck.arc.length > 0
      ? `${onDeck.arc.length} arc point${onDeck.arc.length === 1 ? '' : 's'}`
      : '',
  ].filter(Boolean);
  return parts.length === 0 ? 'Everything planned is in the writing.' : `${parts.join(' and ')} still on deck.`;
};

// ------------------------------------------------------------- the arc, read

export type ArcShape = 'positive' | 'negative' | 'refused' | 'flat' | 'unstarted';

/**
 * What kind of arc this turned out to be.
 *
 * **Read back rather than declared.** Asking a writer to label an arc positive
 * or negative before writing it is asking them to decide the ending first, and
 * §9's whole point is that a character can be offered a change and turn it
 * down. So the shape is inferred from the points that exist: a refusal makes it
 * `refused` whatever else is there, because that is the defining dramatic event
 * once it happens.
 */
export const arcShape = (input: {
  arc: CharacterArc | null;
  points: readonly ArcPoint[];
}): ArcShape => {
  if (!input.arc) return 'unstarted';
  const kinds = new Set(input.points.map((point) => point.kind));

  if (kinds.has('refusal') || kinds.has('doubling_down')) return 'refused';
  if (input.points.length === 0) return input.arc.beginning || input.arc.ending ? 'flat' : 'unstarted';
  // An arc that ends where it began is a real and deliberate shape — the
  // character who is offered nothing and changes nothing — so it is named
  // rather than treated as an unfinished positive one.
  if (input.arc.ending.trim().length === 0) return 'flat';
  return kinds.has('setback') && !kinds.has('turning_point') ? 'negative' : 'positive';
};

export const ARC_SHAPE_WORDS: Record<ArcShape, string> = {
  positive: 'Changes',
  negative: 'Comes apart',
  refused: 'Is offered the change and refuses it',
  flat: 'Stays who they are',
  unstarted: 'No arc yet',
};

/** Whether this character was ever given a real chance to change (§9). */
export const wasOffered = (points: readonly ArcPoint[]): boolean =>
  points.some((point) => point.kind === 'opportunity');

/**
 * The arc in story order, which is not the order it was written in.
 *
 * An arc point is ordered by its own key until it is linked to a scene, and by
 * the *scene* once it is — because an arc read in the order the writer thought
 * of the points is not a reading of the story (§18's continuity review).
 */
export const arcInStoryOrder = (input: {
  points: readonly ArcPoint[];
  links: readonly UsageLink[];
  file: ProjectFile;
}): { point: ArcPoint; unitId: string | null; where: number | null }[] => {
  const unitOrder = new Map(
    [...input.file.units]
      .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1))
      .map((unit, index) => [unit.id as string, index] as const),
  );

  return input.points
    .map((point) => {
      const link = livingLinks(input.links, { kind: 'arc_point', id: point.id as string }, input.file)[0];
      const beat = link ? input.file.beats.find((one) => (one.id as string) === (link.beatId as string)) : undefined;
      const unitId = beat ? (beat.unitId as string) : null;
      return { point, unitId, where: unitId !== null ? (unitOrder.get(unitId) ?? null) : null };
    })
    .sort((a, b) => {
      // Everything placed in the story comes first, in the story's own order;
      // what is still on deck follows in the order the writer made it.
      if (a.where === null && b.where === null) return a.point.orderKey < b.point.orderKey ? -1 : 1;
      if (a.where === null) return 1;
      if (b.where === null) return -1;
      return a.where - b.where;
    });
};

// ------------------------------------------------------------- the screen

/** One piece of characterization, with the colour it is drawn in. */
export interface CharacterizationRow {
  item: CharacterizationItem;
  used: boolean;
  colour: UsageColour;
}

/**
 * Everything the Creator's Traits tab draws for one person, in one reading.
 *
 * The colour rule lives here rather than in the component for the reason the
 * whole module does: red and green are a *claim about the manuscript* (§2), and
 * a claim made in two places eventually gets made two different ways.
 */
export interface CharacterBoard {
  traits: TraitWithItems[];
  /** Noticed before it was filed — the right-click path's landing place (§7). */
  unfiled: CharacterizationRow[];
  counts: { shown: number; onDeck: number; setAside: number };
}

export const characterBoard = (input: {
  characterId: string;
  file: ProjectFile;
}): CharacterBoard => {
  const { file } = input;
  const traits = characterizationOf({
    characterId: input.characterId,
    traits: file.characterTraits,
    items: file.characterizationItems,
    links: file.usageLinks,
    file,
  });

  const unfiled = unfiledItems({ characterId: input.characterId, items: file.characterizationItems }).map(
    (item): CharacterizationRow => {
      const used = isUsed({ kind: 'characterization', id: item.id as string }, file.usageLinks, file);
      return { item, used, colour: usageColour({ retired: item.retired, used }) };
    },
  );

  const every = [...traits.flatMap((entry) => entry.items), ...unfiled];
  return {
    traits,
    unfiled,
    counts: {
      shown: every.filter((row) => row.colour === 'green').length,
      onDeck: every.filter((row) => row.colour === 'red').length,
      setAside: every.filter((row) => row.colour === 'grey').length,
    },
  };
};

/**
 * What the Overview says about how far along somebody is.
 *
 * **A count and never a verdict.** §7 narrows §10's *optional warnings* to the
 * one form that is information rather than pressure, and a character with
 * nothing written yet is at the start of the work rather than behind on it.
 */
export const characterStanding = (board: CharacterBoard): string => {
  const { shown, onDeck, setAside } = board.counts;
  if (shown + onDeck + setAside === 0) return 'Nothing written down for them yet.';
  const parts = [
    shown > 0 ? `${shown} in the writing` : '',
    onDeck > 0 ? `${onDeck} on deck` : '',
    setAside > 0 ? `${setAside} set aside` : '',
  ].filter(Boolean);
  return `${parts.join(', ')}.`;
};

// --------------------------------------------------------------- the edits

const stamp = <T extends { updatedAt: string }>(record: T): T => ({ ...record, updatedAt: nowIso() });

/** The key that puts a new record after everything already in a list. */
const lastKey = (existing: readonly { orderKey: string }[]): string => {
  const sorted = [...existing].sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1));
  return orderKeyBetween(sorted[sorted.length - 1]?.orderKey ?? null, null);
};

export const addTrait = (
  file: ProjectFile,
  input: {
    characterId: CharacterId;
    name: string;
    kind?: string;
    prominence?: number;
    tone?: TraitTone;
    notes?: string;
  },
): { file: ProjectFile; trait: CharacterTrait | null } => {
  const name = input.name.trim();
  if (name.length === 0) return { file, trait: null };
  if (!file.characters.some((person) => (person.id as string) === (input.characterId as string))) {
    return { file, trait: null };
  }

  const at = nowIso();
  const trait = characterTraitSchema.parse({
    id: newId<CharacterTraitId>(),
    projectId: file.project.id,
    characterId: input.characterId,
    name,
    kind: input.kind ?? '',
    prominence: input.prominence ?? 3,
    tone: input.tone ?? 'unsaid',
    notes: input.notes ?? '',
    orderKey: lastKey(
      file.characterTraits.filter((one) => (one.characterId as string) === (input.characterId as string)),
    ),
    createdAt: at,
    updatedAt: at,
  });

  return { file: { ...file, characterTraits: [...file.characterTraits, trait] }, trait };
};

export const updateTrait = (
  file: ProjectFile,
  traitId: CharacterTraitId,
  patch: Partial<Pick<CharacterTrait, 'name' | 'kind' | 'prominence' | 'tone' | 'notes' | 'archived'>>,
): ProjectFile => ({
  ...file,
  characterTraits: file.characterTraits.map((trait) =>
    (trait.id as string) === (traitId as string) ? stamp({ ...trait, ...patch }) : trait,
  ),
});

/**
 * A trait taken away — **and its characterization kept**.
 *
 * The folder goes; the writing in it is unfiled, not deleted, which is the
 * database's `on delete set null` said in the document (addendum 08 §10). A
 * writer who decides *greedy* was the wrong word for it has not decided that
 * the small tip was a bad idea, and unfiled is somewhere those ideas already
 * live because the right-click path (§7) puts them there.
 */
export const removeTrait = (file: ProjectFile, traitId: CharacterTraitId): ProjectFile => ({
  ...file,
  characterTraits: file.characterTraits.filter((trait) => (trait.id as string) !== (traitId as string)),
  characterizationItems: file.characterizationItems.map((item) =>
    (item.traitId as string | null) === (traitId as string) ? stamp({ ...item, traitId: null }) : item,
  ),
});

export const addCharacterization = (
  file: ProjectFile,
  input: {
    characterId: CharacterId;
    traitId?: CharacterTraitId | null;
    text: string;
    notes?: string;
  },
): { file: ProjectFile; item: CharacterizationItem | null } => {
  const text = input.text.trim();
  if (text.length === 0) return { file, item: null };
  if (!file.characters.some((person) => (person.id as string) === (input.characterId as string))) {
    return { file, item: null };
  }

  // A trait that is not this person's is not a folder for this person's work.
  const traitId =
    input.traitId &&
    file.characterTraits.some(
      (trait) =>
        (trait.id as string) === (input.traitId as string) &&
        (trait.characterId as string) === (input.characterId as string),
    )
      ? input.traitId
      : null;

  const at = nowIso();
  const item = characterizationItemSchema.parse({
    id: newId<CharacterizationItemId>(),
    projectId: file.project.id,
    characterId: input.characterId,
    traitId,
    text,
    notes: input.notes ?? '',
    orderKey: lastKey(
      file.characterizationItems.filter(
        (one) => (one.traitId as string | null) === (traitId as string | null),
      ),
    ),
    createdAt: at,
    updatedAt: at,
  });

  return { file: { ...file, characterizationItems: [...file.characterizationItems, item] }, item };
};

export const updateCharacterization = (
  file: ProjectFile,
  itemId: CharacterizationItemId,
  patch: Partial<Pick<CharacterizationItem, 'text' | 'notes' | 'retired'>>,
): ProjectFile => ({
  ...file,
  characterizationItems: file.characterizationItems.map((item) =>
    (item.id as string) === (itemId as string) ? stamp({ ...item, ...patch }) : item,
  ),
});

/** Move a piece of characterization into a trait, or back out of one. */
export const fileCharacterization = (
  file: ProjectFile,
  itemId: CharacterizationItemId,
  traitId: CharacterTraitId | null,
): ProjectFile => {
  const item = file.characterizationItems.find((one) => (one.id as string) === (itemId as string));
  if (!item) return file;
  if (
    traitId !== null &&
    !file.characterTraits.some(
      (trait) =>
        (trait.id as string) === (traitId as string) &&
        (trait.characterId as string) === (item.characterId as string),
    )
  ) {
    return file;
  }

  return {
    ...file,
    characterizationItems: file.characterizationItems.map((one) =>
      (one.id as string) === (itemId as string)
        ? stamp({ ...one, traitId, orderKey: lastKey(
            file.characterizationItems.filter(
              (other) =>
                (other.id as string) !== (itemId as string) &&
                (other.traitId as string | null) === (traitId as string | null),
            ),
          ) })
        : one,
    ),
  };
};

/**
 * A piece of characterization deleted outright, and its usage links with it.
 *
 * Deleting is not the same as setting aside, and the module offers both: this
 * is for something written by mistake, and `retired` is for an idea decided
 * against but worth keeping (§17). The links go because a link with no owner is
 * not a record of anything — which is the one direction the cascade runs, since
 * deleting the *writing* must never take the idea (§9).
 */
export const removeCharacterization = (
  file: ProjectFile,
  itemId: CharacterizationItemId,
): ProjectFile => ({
  ...file,
  characterizationItems: file.characterizationItems.filter(
    (item) => (item.id as string) !== (itemId as string),
  ),
  usageLinks: file.usageLinks.filter(
    (link) => !(link.ownerKind === 'characterization' && link.ownerId === (itemId as string)),
  ),
});
