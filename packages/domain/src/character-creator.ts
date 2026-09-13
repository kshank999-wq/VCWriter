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

// -------------------------------------------------------- plan -> story

/**
 * Where a piece of character work has turned up, read against the manuscript
 * now.
 *
 * `gone` links are **kept in this list** rather than filtered out of it. The
 * item has already gone red by itself (§2), and a writer who sees that wants to
 * know *why* — a row saying the scene it was in is no longer there answers the
 * question, and offers them the tidy-up. Silently dropping the row would leave
 * them with a colour and no explanation.
 */
export interface UsageAppearance {
  link: UsageLink;
  standing: UsageStanding;
  /** The scene, for reading and for getting back to it. */
  unitTitle: string;
  beatTitle: string;
  /** The words, where the writer pointed at a line rather than the whole beat. */
  quote: string;
}

export const USAGE_STANDING_WORDS: Record<UsageStanding, string> = {
  used: 'In the writing',
  // §3.2: the quote and the manuscript diverge the moment somebody improves the
  // sentence. Still linked, still green — the row just says so.
  rewritten: 'The line has changed since',
  gone: 'That writing is no longer there',
};

export const whereItAppears = (input: {
  owner: { kind: UsageLink['ownerKind']; id: string };
  file: ProjectFile;
}): UsageAppearance[] => {
  const { file } = input;
  const order = new Map(
    [...file.units]
      .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1))
      .map((unit, index) => [unit.id as string, index] as const),
  );

  return file.usageLinks
    .filter((link) => link.ownerKind === input.owner.kind && link.ownerId === input.owner.id)
    .map((link): UsageAppearance => {
      const beat = file.beats.find((one) => (one.id as string) === (link.beatId as string));
      const unit = beat ? file.units.find((one) => (one.id as string) === (beat.unitId as string)) : undefined;
      return {
        link,
        standing: usageStanding(link, file),
        unitTitle: unit ? `${unit.sequenceLabel} ${unit.title}`.trim() || 'Untitled scene' : '',
        beatTitle: beat ? beat.title : '',
        quote: link.quote,
      };
    })
    .sort((a, b) => {
      const left = order.get(
        (file.beats.find((one) => (one.id as string) === (a.link.beatId as string))?.unitId as string) ?? '',
      );
      const right = order.get(
        (file.beats.find((one) => (one.id as string) === (b.link.beatId as string))?.unitId as string) ?? '',
      );
      // Whatever is still in the story comes first, in the story's own order;
      // links to writing that has gone fall to the bottom.
      if (left === undefined && right === undefined) return 0;
      if (left === undefined) return 1;
      if (right === undefined) return -1;
      return left - right;
    });
};

/** The scenes and their beats, in story order, for a picker. */
export const placesToPin = (
  file: ProjectFile,
): { unit: ProjectFile['units'][number]; beats: ProjectFile['beats'] }[] =>
  [...file.units]
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1))
    .map((unit) => ({
      unit,
      beats: file.beats
        .filter((beat) => (beat.unitId as string) === (unit.id as string))
        .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1)),
    }));

/**
 * The lines in a beat a writer could point at.
 *
 * Empty ones are left out: the quote is what makes the row readable without
 * opening the scene (§3.2), and pointing at a blank line gives a row that says
 * nothing. Pinning to the whole beat is always available instead.
 */
export const quotableLines = (
  file: ProjectFile,
  beatId: BeatId,
): { id: ManuscriptElementId; kind: string; text: string }[] => {
  const beat = file.beats.find((one) => (one.id as string) === (beatId as string));
  if (!beat) return [];
  return beat.manuscript.elements
    .filter((element) => element.text.trim().length > 0)
    .map((element) => ({ id: element.id, kind: element.type, text: element.text }));
};

/**
 * Pin a piece of character work to a place in the manuscript — the act that
 * turns it green (§6).
 *
 * **The scene is worked out from the beat rather than asked for**, because a
 * link naming a beat in one scene and a scene it is not in would be a link that
 * navigates somewhere wrong, and there is no reason to let a caller make one.
 *
 * The quote is copied from the line when a line is named, and is empty when the
 * whole beat is. It is written once, here, and never read as the anchor.
 *
 * Pinning the same thing to the same place twice does nothing and returns the
 * link that is already there — the same rule as the database's unique, so the
 * two cannot disagree.
 */
export const pinUsage = (
  file: ProjectFile,
  input: {
    ownerKind: UsageLink['ownerKind'];
    ownerId: string;
    beatId: BeatId;
    elementId?: ManuscriptElementId | null;
  },
): { file: ProjectFile; link: UsageLink | null } => {
  const beat = file.beats.find((one) => (one.id as string) === (input.beatId as string));
  if (!beat) return { file, link: null };

  const elementId = input.elementId ?? null;
  const element = elementId
    ? beat.manuscript.elements.find((one) => one.id === elementId)
    : undefined;
  if (elementId && !element) return { file, link: null };

  const already = file.usageLinks.find(
    (link) =>
      link.ownerKind === input.ownerKind &&
      link.ownerId === input.ownerId &&
      (link.beatId as string) === (input.beatId as string) &&
      (link.elementId as string | null) === (elementId as string | null),
  );
  if (already) return { file, link: already };

  const at = nowIso();
  const link = usageLinkSchema.parse({
    id: newId<UsageLinkId>(),
    projectId: file.project.id,
    ownerKind: input.ownerKind,
    ownerId: input.ownerId,
    unitId: beat.unitId,
    beatId: input.beatId,
    elementId,
    quote: element ? element.text : '',
    createdAt: at,
    updatedAt: at,
  });

  return { file: { ...file, usageLinks: [...file.usageLinks, link] }, link };
};

/**
 * Take a pin out.
 *
 * **Nothing in the manuscript is touched.** Unpinning says *this is not where
 * that idea landed after all*; the writing stays exactly as it is, and the item
 * goes back on deck if that was its only place.
 */
export const unpinUsage = (file: ProjectFile, linkId: UsageLinkId): ProjectFile => ({
  ...file,
  usageLinks: file.usageLinks.filter((link) => (link.id as string) !== (linkId as string)),
});

// -------------------------------------------------------- story -> plan

/**
 * Who is in a beat, as ids, for offering the likely person first.
 *
 * Matched off the cues the way the episode cast already is, and a *guess about
 * ordering, never a filter*: somebody can be characterized in a beat they never
 * speak in — an action line about what they left behind is characterization —
 * so everybody stays offered and these just come first.
 */
export const peopleInBeat = (file: ProjectFile, beatId: BeatId): CharacterId[] => {
  const beat = file.beats.find((one) => (one.id as string) === (beatId as string));
  if (!beat) return [];
  const spoken = beat.manuscript.elements
    .filter((element) => element.type === 'character')
    .map((element) => element.text.trim().toUpperCase());
  if (spoken.length === 0) return [];

  return file.characters
    .filter(
      (character) =>
        !character.archived &&
        [character.name, ...character.aliases].some((name) =>
          spoken.some((cue) => name.trim().length > 0 && cue.startsWith(name.trim().toUpperCase())),
        ),
    )
    .map((character) => character.id);
};

/**
 * Characterization caught while writing: made, filed and pinned in one go
 * (addendum 08 §6, §7 — story → plan).
 *
 * **An item made this way is green the moment it exists**, and that is the
 * point rather than a convenience. The writer is not recording a plan; they are
 * noticing that what they have just written *is* characterization, and a module
 * that made them write it down and then go and say where it was would be asking
 * them to file their own work.
 *
 * A trait can be named here and is made if it is new, because §7 is explicit
 * that the fast path must not stop to make somebody choose a folder first — and
 * no trait at all is fine too, since unfiled is a real place (§1).
 *
 * **The text and the quote are different things on purpose.** The item is what
 * the writer says the behaviour is, which is often a generalisation of the
 * line — *leaves a small tip* from *she counts out four coins* — while the quote
 * is the line as it stands. Forcing them to be the same would either put stage
 * directions in the plan or stop somebody from thinking while they file.
 */
export const captureFromScript = (
  file: ProjectFile,
  input: {
    characterId: CharacterId;
    /** File it under one that exists… */
    traitId?: CharacterTraitId | null;
    /** …or name one, made here and now. Ignored when `traitId` is given. */
    newTraitName?: string;
    text: string;
    beatId: BeatId;
    elementId?: ManuscriptElementId | null;
  },
): { file: ProjectFile; item: CharacterizationItem | null } => {
  const text = input.text.trim();
  if (text.length === 0) return { file, item: null };
  if (!file.beats.some((beat) => (beat.id as string) === (input.beatId as string))) {
    return { file, item: null };
  }

  let next = file;
  let traitId = input.traitId ?? null;

  if (!traitId && (input.newTraitName ?? '').trim().length > 0) {
    const made = addTrait(next, { characterId: input.characterId, name: input.newTraitName! });
    next = made.file;
    traitId = made.trait?.id ?? null;
  }

  const added = addCharacterization(next, {
    characterId: input.characterId,
    traitId,
    text,
  });
  if (!added.item) return { file, item: null };

  const pinned = pinUsage(added.file, {
    ownerKind: 'characterization',
    ownerId: added.item.id as string,
    beatId: input.beatId,
    elementId: input.elementId ?? null,
  });

  // The pin is the whole reason this path exists. If it could not be made the
  // item would be born on deck, in a beat the writer is looking at, which is
  // the one confusing outcome — so nothing is kept at all.
  if (!pinned.link) return { file, item: null };

  return { file: pinned.file, item: added.item };
};

// ------------------------------------------------------------- the arc, built

/**
 * The points that carry the weight, drawn heavier than the rest.
 *
 * A turning point is §8's; the other three are §9's refusal spine. They are
 * marked here rather than in a component because *which moments are decisive*
 * is a statement about drama, not about styling.
 */
export const DECISIVE_KINDS: readonly ArcPointKind[] = [
  'turning_point',
  'opportunity',
  'refusal',
  'doubling_down',
];

export const isDecisive = (kind: ArcPointKind): boolean => DECISIVE_KINDS.includes(kind);

/** One point of an arc, with where it stands against the manuscript. */
export interface ArcPointRow {
  point: ArcPoint;
  used: boolean;
  colour: UsageColour;
  /** The scene it is in, when it is in one. */
  unitTitle: string | null;
}

/**
 * A character's arc, ready to draw (addendum 08 §8).
 *
 * **Two groups, and the split is the honest one**: what is in the story sits in
 * the *story's* order, and what is still on deck sits in the writer's. Once a
 * point is written, the manuscript decides where it falls — an arc read in the
 * order somebody thought of the points is not a reading of the story — so
 * moving a placed point up and down would be a control that lies. What is not
 * written yet is theirs to order, and that is where the arrows are.
 */
export interface ArcBoard {
  arc: CharacterArc | null;
  placed: ArcPointRow[];
  onDeck: ArcPointRow[];
  shape: ArcShape;
  /** §9: was this character ever given a real chance to change? */
  offered: boolean;
}

export const arcBoard = (input: { characterId: string; file: ProjectFile }): ArcBoard => {
  const { file } = input;
  const arc =
    file.characterArcs.find((one) => (one.characterId as string) === input.characterId) ?? null;
  const points = file.arcPoints.filter(
    (point) => (point.characterId as string) === input.characterId,
  );

  const rows = arcInStoryOrder({ points, links: file.usageLinks, file }).map((entry) => {
    const used = isUsed({ kind: 'arc_point', id: entry.point.id as string }, file.usageLinks, file);
    const unit = entry.unitId ? file.units.find((one) => (one.id as string) === entry.unitId) : undefined;
    return {
      point: entry.point,
      used,
      colour: usageColour({ retired: entry.point.retired, used }),
      unitTitle: unit ? `${unit.sequenceLabel} ${unit.title}`.trim() || 'Untitled scene' : null,
      where: entry.where,
    };
  });

  return {
    arc,
    placed: rows.filter((row) => row.where !== null).map(({ where: _where, ...row }) => row),
    onDeck: rows.filter((row) => row.where === null).map(({ where: _where, ...row }) => row),
    shape: arcShape({ arc, points }),
    offered: wasOffered(points),
  };
};

/**
 * Start somebody's arc. One per character, and asking twice returns the one
 * they have rather than making a second.
 *
 * **Nothing requires this** (§9): most characters in most scripts have no arc,
 * and a module that made one for everybody would fill the screen with empty
 * journeys nobody asked for.
 */
export const beginArc = (
  file: ProjectFile,
  characterId: CharacterId,
): { file: ProjectFile; arc: CharacterArc | null } => {
  if (!file.characters.some((person) => (person.id as string) === (characterId as string))) {
    return { file, arc: null };
  }
  const already = file.characterArcs.find(
    (one) => (one.characterId as string) === (characterId as string),
  );
  if (already) return { file, arc: already };

  const at = nowIso();
  const arc = characterArcSchema.parse({
    id: newId<CharacterArcId>(),
    projectId: file.project.id,
    characterId,
    createdAt: at,
    updatedAt: at,
  });
  return { file: { ...file, characterArcs: [...file.characterArcs, arc] }, arc };
};

export const updateArc = (
  file: ProjectFile,
  arcId: CharacterArcId,
  patch: Partial<Pick<CharacterArc, 'beginning' | 'need' | 'ending'>>,
): ProjectFile => ({
  ...file,
  characterArcs: file.characterArcs.map((arc) =>
    (arc.id as string) === (arcId as string) ? stamp({ ...arc, ...patch }) : arc,
  ),
});

/**
 * The arc taken away, and its points with it.
 *
 * Unlike a trait, whose characterization survives it (§1), a point has no
 * meaning without the journey it is a point of — *she is offered the money back
 * and takes it anyway* is a sentence about an arc. This matches the database,
 * where `arc_points` cascades from `character_arcs`.
 */
export const removeArc = (file: ProjectFile, arcId: CharacterArcId): ProjectFile => {
  const doomed = new Set(
    file.arcPoints
      .filter((point) => (point.arcId as string) === (arcId as string))
      .map((point) => point.id as string),
  );
  return {
    ...file,
    characterArcs: file.characterArcs.filter((arc) => (arc.id as string) !== (arcId as string)),
    arcPoints: file.arcPoints.filter((point) => !doomed.has(point.id as string)),
    usageLinks: file.usageLinks.filter(
      (link) => !(link.ownerKind === 'arc_point' && doomed.has(link.ownerId)),
    ),
  };
};

export const addArcPoint = (
  file: ProjectFile,
  input: { arcId: CharacterArcId; kind?: ArcPointKind; text: string; notes?: string },
): { file: ProjectFile; point: ArcPoint | null } => {
  const text = input.text.trim();
  if (text.length === 0) return { file, point: null };
  const arc = file.characterArcs.find((one) => (one.id as string) === (input.arcId as string));
  if (!arc) return { file, point: null };

  const at = nowIso();
  const point = arcPointSchema.parse({
    id: newId<ArcPointId>(),
    projectId: file.project.id,
    arcId: arc.id,
    // Carried as well as the arc, because nearly every reading of a point
    // starts from the character rather than from their journey.
    characterId: arc.characterId,
    kind: input.kind ?? 'movement',
    text,
    notes: input.notes ?? '',
    orderKey: lastKey(file.arcPoints.filter((one) => (one.arcId as string) === (arc.id as string))),
    createdAt: at,
    updatedAt: at,
  });

  return { file: { ...file, arcPoints: [...file.arcPoints, point] }, point };
};

export const updateArcPoint = (
  file: ProjectFile,
  pointId: ArcPointId,
  patch: Partial<Pick<ArcPoint, 'kind' | 'text' | 'notes' | 'retired'>>,
): ProjectFile => ({
  ...file,
  arcPoints: file.arcPoints.map((point) =>
    (point.id as string) === (pointId as string) ? stamp({ ...point, ...patch }) : point,
  ),
});

export const removeArcPoint = (file: ProjectFile, pointId: ArcPointId): ProjectFile => ({
  ...file,
  arcPoints: file.arcPoints.filter((point) => (point.id as string) !== (pointId as string)),
  usageLinks: file.usageLinks.filter(
    (link) => !(link.ownerKind === 'arc_point' && link.ownerId === (pointId as string)),
  ),
});

/**
 * Move a point that is not in the story yet, one place either way.
 *
 * **Only the unplaced ones move**, and the refusal is the point rather than a
 * limitation: a point that is written sits where the scene it is in sits, and
 * an arrow that pretended otherwise would put the arc in an order the script
 * does not have.
 */
export const moveArcPoint = (
  file: ProjectFile,
  pointId: ArcPointId,
  direction: 'up' | 'down',
): ProjectFile => {
  const point = file.arcPoints.find((one) => (one.id as string) === (pointId as string));
  if (!point) return file;
  if (isUsed({ kind: 'arc_point', id: pointId as string }, file.usageLinks, file)) return file;

  // Its neighbours are the other unplaced points of the same arc, in the
  // writer's own order — the placed ones are not in this queue at all.
  const queue = file.arcPoints
    .filter(
      (one) =>
        (one.arcId as string) === (point.arcId as string) &&
        !isUsed({ kind: 'arc_point', id: one.id as string }, file.usageLinks, file),
    )
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1));

  const at = queue.findIndex((one) => (one.id as string) === (pointId as string));
  const to = direction === 'up' ? at - 1 : at + 1;
  if (at < 0 || to < 0 || to >= queue.length) return file;

  const before = direction === 'up' ? (queue[to - 1]?.orderKey ?? null) : queue[to]!.orderKey;
  const after = direction === 'up' ? queue[to]!.orderKey : (queue[to + 1]?.orderKey ?? null);

  return {
    ...file,
    arcPoints: file.arcPoints.map((one) =>
      (one.id as string) === (pointId as string)
        ? stamp({ ...one, orderKey: orderKeyBetween(before, after) })
        : one,
    ),
  };
};

// -------------------------------------------------------- arc to plot (§10)

/** One piece of character work, seen from the scene rather than the character. */
export interface CharacterWork {
  kind: UsageLink['ownerKind'];
  id: string;
  characterId: CharacterId;
  characterName: string;
  /** What it says: the characterization, or the arc point. */
  text: string;
  /** For an arc point, what kind of moment it is. */
  pointKind: ArcPointKind | null;
  /** A trait's name, for a characterization filed under one. */
  traitName: string | null;
}

const workFromRecords = (
  file: ProjectFile,
  owner: { kind: UsageLink['ownerKind']; id: string },
): CharacterWork | null => {
  if (owner.kind === 'characterization') {
    const item = file.characterizationItems.find((one) => (one.id as string) === owner.id);
    if (!item) return null;
    const person = file.characters.find((one) => (one.id as string) === (item.characterId as string));
    const trait = file.characterTraits.find((one) => (one.id as string) === (item.traitId as string | null));
    return {
      kind: 'characterization',
      id: owner.id,
      characterId: item.characterId,
      characterName: person?.name ?? '',
      text: item.text,
      pointKind: null,
      traitName: trait?.name ?? null,
    };
  }

  const point = file.arcPoints.find((one) => (one.id as string) === owner.id);
  if (!point) return null;
  const person = file.characters.find((one) => (one.id as string) === (point.characterId as string));
  return {
    kind: 'arc_point',
    id: owner.id,
    characterId: point.characterId,
    characterName: person?.name ?? '',
    text: point.text,
    pointKind: point.kind,
    traitName: null,
  };
};

/**
 * The character work pinned to one beat (§10: *the related-elements panel
 * displays linked character arc points*).
 *
 * This is the module read from the other end. Everything else in the Creator
 * starts from a person and asks where their work landed; the writer in a scene
 * has the opposite question — *what is this beat carrying?* — and it is the same
 * rows read backwards, so there is nothing new stored to answer it.
 */
export const characterWorkIn = (file: ProjectFile, beatId: BeatId): CharacterWork[] =>
  file.usageLinks
    .filter((link) => (link.beatId as string) === (beatId as string))
    .map((link) => workFromRecords(file, { kind: link.ownerKind, id: link.ownerId }))
    .filter((work): work is CharacterWork => work !== null)
    .sort((a, b) =>
      a.characterName === b.characterName
        ? a.text.localeCompare(b.text)
        : a.characterName.localeCompare(b.characterName),
    );

/**
 * What is still on deck for the people in a beat — §10's *unassigned queue*,
 * offered where the plot has just made an opportunity.
 *
 * **Whoever speaks here first, and then everybody**, for the same reason the
 * right-click orders its list that way (§7): a beat can be the right home for
 * work belonging to somebody who never says a word in it, so this sorts and
 * never filters. Retired work is left out, because it is a decision already
 * made and offering it again is the nagging §7 rules out.
 */
export const onDeckForBeat = (
  file: ProjectFile,
  beatId: BeatId,
): { here: CharacterWork[]; rest: CharacterWork[] } => {
  const speaking = new Set(peopleInBeat(file, beatId).map((id) => id as string));

  const waiting: CharacterWork[] = [
    ...file.characterizationItems
      .filter(
        (item) =>
          !item.retired &&
          !isUsed({ kind: 'characterization', id: item.id as string }, file.usageLinks, file),
      )
      .map((item) => workFromRecords(file, { kind: 'characterization', id: item.id as string })),
    ...file.arcPoints
      .filter(
        (point) =>
          !point.retired &&
          !isUsed({ kind: 'arc_point', id: point.id as string }, file.usageLinks, file),
      )
      .map((point) => workFromRecords(file, { kind: 'arc_point', id: point.id as string })),
  ].filter((work): work is CharacterWork => work !== null);

  const byName = (a: CharacterWork, b: CharacterWork) =>
    a.characterName === b.characterName
      ? a.text.localeCompare(b.text)
      : a.characterName.localeCompare(b.characterName);

  return {
    here: waiting.filter((work) => speaking.has(work.characterId as string)).sort(byName),
    rest: waiting.filter((work) => !speaking.has(work.characterId as string)).sort(byName),
  };
};

/** How a piece of work reads in a list that is not about one character. */
export const describeWork = (work: CharacterWork): string =>
  work.kind === 'arc_point'
    ? `${ARC_POINT_NAMES[work.pointKind ?? 'movement']}: ${work.text}`
    : work.traitName
      ? `${work.traitName} — ${work.text}`
      : work.text;

// ------------------------------------------------------- relationships (§11)

export const RELATIONSHIP_KIND_NAMES: Record<RelationshipKind, string> = {
  family: 'Family',
  romantic: 'Romantic',
  friend: 'Friend',
  mentor: 'Mentor',
  rival: 'Rival',
  enemy: 'Enemy',
  professional: 'Professional',
  alliance: 'Alliance',
  dependency: 'Dependency',
  custom: 'Something else',
};

/** What to call it: the writer's own label wins over the kind (§11). */
export const relationshipName = (relationship: CharacterRelationship): string =>
  relationship.label.trim().length > 0
    ? relationship.label.trim()
    : RELATIONSHIP_KIND_NAMES[relationship.kind];

/** One relationship, with the person at the other end of it. */
export interface RelationshipRow {
  relationship: CharacterRelationship;
  otherId: CharacterId;
  otherName: string;
  /** Whether the person at the other end has a reading of their own. */
  answered: boolean;
}

/**
 * How somebody stands towards other people, and how they stand towards them.
 *
 * **Two lists rather than one**, because §11's requirement is that the two
 * directions can disagree: *A trusts B while B is manipulating A* is two
 * records, and a screen that merged them would have to pick one to show and
 * lose the drama in the difference.
 *
 * `answered` marks an outgoing reading the other person has not returned. It is
 * **an offer and never a warning** — plenty of relationships are only worth
 * writing down from one side, and the module does not nag (§7).
 */
export const relationshipsOf = (input: {
  characterId: string;
  file: ProjectFile;
}): { outward: RelationshipRow[]; inward: RelationshipRow[] } => {
  const { file } = input;
  const nameOf = (id: string): string =>
    file.characters.find((one) => (one.id as string) === id)?.name ?? 'Somebody';

  const reverseExists = (from: string, to: string): boolean =>
    file.characterRelationships.some(
      (one) => (one.fromCharacterId as string) === to && (one.toCharacterId as string) === from,
    );

  const mine = file.characterRelationships.filter(
    (one) =>
      (one.fromCharacterId as string) === input.characterId ||
      (one.toCharacterId as string) === input.characterId,
  );

  const row = (relationship: CharacterRelationship, outward: boolean): RelationshipRow => {
    const otherId = outward ? relationship.toCharacterId : relationship.fromCharacterId;
    return {
      relationship,
      otherId,
      otherName: nameOf(otherId as string),
      answered: reverseExists(
        relationship.fromCharacterId as string,
        relationship.toCharacterId as string,
      ),
    };
  };

  const by = (a: RelationshipRow, b: RelationshipRow) => a.otherName.localeCompare(b.otherName);

  return {
    outward: mine
      .filter((one) => (one.fromCharacterId as string) === input.characterId)
      .map((one) => row(one, true))
      .sort(by),
    inward: mine
      .filter((one) => (one.toCharacterId as string) === input.characterId)
      .map((one) => row(one, false))
      .sort(by),
  };
};

/**
 * A reading of one person by another.
 *
 * **Directional, and the same pair may be read twice** — once each way — so the
 * only thing refused is a second identical reading, which is the database's
 * unique said again here. Nobody is in a relationship with themselves.
 */
export const relate = (
  file: ProjectFile,
  input: {
    fromCharacterId: CharacterId;
    toCharacterId: CharacterId;
    kind?: RelationshipKind;
    label?: string;
    description?: string;
    state?: string;
    evolution?: string;
  },
): { file: ProjectFile; relationship: CharacterRelationship | null } => {
  const from = input.fromCharacterId as string;
  const to = input.toCharacterId as string;
  if (from === to) return { file, relationship: null };
  const known = new Set(file.characters.map((person) => person.id as string));
  if (!known.has(from) || !known.has(to)) return { file, relationship: null };

  const kind = input.kind ?? 'custom';
  const label = (input.label ?? '').trim();
  const already = file.characterRelationships.find(
    (one) =>
      (one.fromCharacterId as string) === from &&
      (one.toCharacterId as string) === to &&
      one.kind === kind &&
      one.label.trim() === label,
  );
  if (already) return { file, relationship: already };

  const at = nowIso();
  const relationship = characterRelationshipSchema.parse({
    id: newId<CharacterRelationshipId>(),
    projectId: file.project.id,
    fromCharacterId: input.fromCharacterId,
    toCharacterId: input.toCharacterId,
    kind,
    label,
    description: input.description ?? '',
    state: input.state ?? '',
    evolution: input.evolution ?? '',
    createdAt: at,
    updatedAt: at,
  });

  return {
    file: { ...file, characterRelationships: [...file.characterRelationships, relationship] },
    relationship,
  };
};

export const updateRelationship = (
  file: ProjectFile,
  relationshipId: CharacterRelationshipId,
  patch: Partial<Pick<CharacterRelationship, 'kind' | 'label' | 'description' | 'state' | 'evolution'>>,
): ProjectFile => ({
  ...file,
  characterRelationships: file.characterRelationships.map((one) =>
    (one.id as string) === (relationshipId as string) ? stamp({ ...one, ...patch }) : one,
  ),
});

/**
 * One reading removed, and **only that one**: taking away how A sees B says
 * nothing about how B sees A, which is the whole reason these are two records.
 */
export const removeRelationship = (
  file: ProjectFile,
  relationshipId: CharacterRelationshipId,
): ProjectFile => ({
  ...file,
  characterRelationships: file.characterRelationships.filter(
    (one) => (one.id as string) !== (relationshipId as string),
  ),
});

/**
 * The same pair, read back the other way — an empty reading for the other
 * person to fill in, not a copy of this one.
 *
 * Copying the description across would be the module putting words in somebody
 * else's mouth, and the point of the second row is that it may say something
 * completely different.
 */
export const answerRelationship = (
  file: ProjectFile,
  relationshipId: CharacterRelationshipId,
): { file: ProjectFile; relationship: CharacterRelationship | null } => {
  const one = file.characterRelationships.find(
    (candidate) => (candidate.id as string) === (relationshipId as string),
  );
  if (!one) return { file, relationship: null };
  return relate(file, {
    fromCharacterId: one.toCharacterId,
    toCharacterId: one.fromCharacterId,
    kind: one.kind,
  });
};
