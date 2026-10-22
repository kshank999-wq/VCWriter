import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { addBeat, addResearchCategory, addResearchItem, addUnit, updateBeat, updateResearchItem } from './mutations.js';
import { deleteExtract } from './extracts.js';
import { defaultElementType } from './editing.js';
import { isInstructional, isProseFormat, isWordProcessor } from './formats.js';
import { researchCategoriesInOrder, unitsInStoryOrder } from './selectors.js';
import type { Extract, ExtractKind, ExtractReceipt, TransferArea } from './entities/extract.js';
import type { SystemCategoryKey } from './entities/research.js';
import type { ProjectFile } from './project-file.js';
import type { ExtractId, ManuscriptElementId, ResearchCategoryId, ResearchItemId } from './ids.js';

/**
 * **Sending extracts to a project** (addendum 42 §10, the WP spec's §7).
 *
 * An extract goes into this project or another one, as the kind of thing its
 * category says it is: a character note onto the Characters shelf, a scene as
 * a scene, a beat as a beat. What has no shelf of its own goes onto Notes,
 * which is made if the project has none — never dropped, and the preview says
 * so before anything is written (WP spec TR-02).
 *
 * `planTransfer` is the preview and `applyTransfer` the writing; both are pure
 * and take the target as a whole file, so the same code sends to the open
 * project and to one read from disk. The target is written first and the
 * receipts recorded after (`recordTransfer`), so a write that fails leaves
 * nothing to say it happened and a retry makes no second copy (TR-03).
 */

export type TransferAction = 'copy' | 'move';

/** Where each kind of extract lands, by the target shelf's system key. */
const SHELF_FOR: Partial<Record<ExtractKind, SystemCategoryKey>> = {
  character: 'characters',
  characterization: 'characters',
  location: 'locations',
  object: 'props',
  plot_point: 'plot_points',
  idea: 'ideas',
  setup: 'setups_payoffs',
  payoff: 'setups_payoffs',
};

const SHELF_NAMES: Partial<Record<SystemCategoryKey, string>> = {
  characters: 'Characters',
  locations: 'Locations',
  props: 'Props',
  plot_points: 'Plot Points',
  ideas: 'Ideas',
  setups_payoffs: 'Setups & Payoffs',
  notes: 'Notes',
};

/**
 * **Where the writer says it goes** (WP spec §7.1: *destination VC module,
 * target area/type, new versus existing item*). Without one, an extract goes
 * where its category's default shelf, or else its kind, says.
 *
 * - A research shelf already in the target, by id, or a new one by name.
 *   Either can be told to add to an existing item there instead of making a
 *   new one: `append` puts the words after the item's own, and `replace`
 *   puts them in place of them, which the dialog asks about first.
 * - A new scene (a chapter in prose), or a beat in a given scene.
 */
export type DestinationChoice =
  | { area: 'research'; shelfId: string; into?: { itemId: string; mode: 'append' | 'replace' } | null }
  | { area: 'research'; shelfName: string }
  | { area: 'scene' }
  | { area: 'beat'; unitId: string }
  /** The end of the target's own document, for outline rows (addendum 42 §13). */
  | { area: 'document' };

export interface DestinationOption {
  key: string;
  label: string;
}

const isProseTarget = (target: ProjectFile): boolean => isProseFormat(target.project.format);

/** Every place in the target an extract can go, as the dialog's list offers them. */
export const destinationOptions = (target: ProjectFile): DestinationOption[] => {
  const shelves = researchCategoriesInOrder(target).map((category) => ({
    key: `shelf:${category.id}`,
    label: `Research › ${category.name}`,
  }));
  if (!takesScenes(target)) return shelves;
  return [
    ...shelves,
    { key: 'scene', label: isProseTarget(target) ? 'A new chapter' : 'A new scene' },
    ...unitsInStoryOrder(target).map((unit, index) => ({
      key: `beat:${unit.id}`,
      label: `A beat in “${unit.title || `${isProseTarget(target) ? 'Chapter' : 'Scene'} ${index + 1}`}”`,
    })),
  ];
};

/** The choice a list key stands for. */
export const choiceFromKey = (key: string): DestinationChoice | null => {
  if (key === 'scene') return { area: 'scene' };
  if (key === 'document') return { area: 'document' };
  if (key.startsWith('shelf:')) return { area: 'research', shelfId: key.slice(6) };
  if (key.startsWith('new-shelf:')) return { area: 'research', shelfName: key.slice(10) };
  if (key.startsWith('beat:')) return { area: 'beat', unitId: key.slice(5) };
  return null;
};

/** The items on one shelf of the target, for *add to an existing item*. */
export const itemsOnShelf = (target: ProjectFile, shelfId: string) =>
  target.researchItems.filter((item) => item.categoryId === shelfId);

export interface TransferStep {
  extractId: string;
  title: string;
  /** The bin it is in, as the writer named it. */
  categoryName: string;
  area: TransferArea;
  /** Where in the target, in words: *Characters*, *a new scene*, *a beat in "The Harbour"*. */
  areaName: string;
  /** Sent to Notes because the target has no place of its own for this kind. */
  fallback: boolean;
  /** An earlier send of this extract to the same project. */
  already: ExtractReceipt | null;
  /** The list key of where it goes, so the dialog's list can show it chosen. */
  key: string;
}

export interface TransferPlan {
  projectId: string;
  projectTitle: string;
  steps: TransferStep[];
}

const kindOf = (source: ProjectFile, extract: Extract): ExtractKind =>
  source.extractCategories.find((category) => category.id === extract.categoryId)?.kind ?? 'other';

const categoryNameOf = (source: ProjectFile, extract: Extract): string =>
  source.extractCategories.find((category) => category.id === extract.categoryId)?.label ?? '';

const liveShelf = (target: ProjectFile, key: SystemCategoryKey) =>
  researchCategoriesInOrder(target).find((category) => category.systemKey === key) ?? null;

const shelfNamed = (target: ProjectFile, name: string) =>
  researchCategoriesInOrder(target).find((category) => category.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? null;

/** A story project with a track to put a scene on. Documents and instructional books have shelves only. */
const takesScenes = (target: ProjectFile): boolean =>
  !isWordProcessor(target.project.format) && !isInstructional(target.project.format) && target.tracks.length > 0;

const lastUnit = (target: ProjectFile) => {
  const units = unitsInStoryOrder(target);
  return units[units.length - 1] ?? null;
};

/** Where one extract goes, resolved: what `applyTransfer` acts on. */
export interface Resolved {
  area: TransferArea;
  areaName: string;
  key: string;
  /** For research: the shelf, by id where it exists, else by key or name to be made. */
  shelf: { id: string } | { systemKey: SystemCategoryKey } | { name: string } | null;
  /** For a beat: the scene it goes into; null is the last one. */
  unitId: string | null;
  into: { itemId: string; mode: 'append' | 'replace' } | null;
  fallback: boolean;
}

const researchTo = (
  target: ProjectFile,
  shelf: { id: string } | { systemKey: SystemCategoryKey } | { name: string },
  fallback = false,
  into: Resolved['into'] = null,
): Resolved => {
  const found =
    'id' in shelf
      ? target.researchCategories.find((category) => category.id === shelf.id) ?? null
      : 'systemKey' in shelf
        ? liveShelf(target, shelf.systemKey)
        : shelfNamed(target, shelf.name);
  const name = found?.name ?? ('name' in shelf ? shelf.name.trim() : 'systemKey' in shelf ? SHELF_NAMES[shelf.systemKey] ?? 'Notes' : 'Notes');
  const item = into ? target.researchItems.find((one) => one.id === into.itemId) ?? null : null;
  return {
    area: 'research',
    areaName: `Research › ${name}${item ? ` › “${item.title}” (${into!.mode === 'append' ? 'added to' : 'replaced'})` : ''}`,
    key: found ? `shelf:${found.id}` : `new-shelf:${name}`,
    shelf: found ? { id: found.id } : shelf,
    unitId: null,
    into: item ? into : null,
    fallback,
  };
};

const sceneTo = (target: ProjectFile): Resolved => ({
  area: 'scene',
  areaName: isProseTarget(target) ? 'A new chapter' : 'A new scene',
  key: 'scene',
  shelf: null,
  unitId: null,
  into: null,
  fallback: false,
});

const beatTo = (target: ProjectFile, unitId: string | null): Resolved => {
  const unit = (unitId ? target.units.find((one) => one.id === unitId) : null) ?? lastUnit(target);
  if (!unit) return sceneTo(target);
  return {
    area: 'beat',
    areaName: `A beat in “${unit.title || (isProseTarget(target) ? 'the last chapter' : 'the last scene')}”`,
    key: `beat:${unit.id}`,
    shelf: null,
    unitId: unit.id,
    into: null,
    fallback: false,
  };
};

/** Where one extract goes in the target, without writing anything. */
const destinationOf = (source: ProjectFile, extract: Extract, target: ProjectFile, choice?: DestinationChoice | null): Resolved => {
  if (choice) {
    if (choice.area === 'scene' && takesScenes(target)) return sceneTo(target);
    if (choice.area === 'beat' && takesScenes(target)) return beatTo(target, choice.unitId);
    if (choice.area === 'research' && 'shelfId' in choice && target.researchCategories.some((one) => one.id === choice.shelfId)) {
      return researchTo(target, { id: choice.shelfId }, false, choice.into ?? null);
    }
    if (choice.area === 'research' && 'shelfName' in choice && choice.shelfName.trim()) {
      return researchTo(target, { name: choice.shelfName });
    }
  }
  const category = source.extractCategories.find((one) => one.id === extract.categoryId);
  // The category's own default shelf (WP spec §5: *default destination*), by name.
  if (category?.targetShelf) return researchTo(target, { name: category.targetShelf });
  const kind = kindOf(source, extract);
  if ((kind === 'scene' || kind === 'beat') && takesScenes(target)) {
    if (kind === 'scene' && (!isProseTarget(target) || lastUnit(target) === null)) return sceneTo(target);
    return beatTo(target, null);
  }
  const wanted = SHELF_FOR[kind];
  const key = wanted && liveShelf(target, wanted) ? wanted : 'notes';
  return researchTo(target, { systemKey: key }, key === 'notes' && wanted !== undefined);
};

const receiptFor = (extract: Extract, projectId: string): ExtractReceipt | null =>
  extract.sentTo.find((receipt) => receipt.projectId === projectId) ?? null;

/**
 * The preview: where each extract will go, and which have gone there before.
 * It is the send itself, done on a copy and thrown away, so the preview cannot
 * say one thing and the send do another.
 */
export const planTransfer = (
  source: ProjectFile,
  extractIds: readonly string[],
  target: ProjectFile,
  choices: Readonly<Record<string, DestinationChoice>> = {},
): TransferPlan => {
  const trial = applyTransfer(source, extractIds, target, { again: true, choices });
  return {
    projectId: target.project.id,
    projectTitle: target.project.title,
    steps: extractIds.flatMap((extractId) => {
      const extract = source.extracts.find((one) => one.id === extractId);
      const receipt = trial.receipts.get(extractId);
      if (!extract || !receipt) return [];
      return [
        {
          extractId,
          title: extract.title,
          categoryName: categoryNameOf(source, extract),
          area: receipt.area,
          areaName: receipt.areaName,
          fallback: destinationOf(source, extract, target, choices[extractId]).fallback,
          already: receiptFor(extract, target.project.id),
          key: trial.keys.get(extractId) ?? '',
        },
      ];
    }),
  };
};

/** The shelf's id in the file, making it first where it is not there yet. */
const shelfIdIn = (file: ProjectFile, shelf: NonNullable<Resolved['shelf']>): { file: ProjectFile; id: ResearchCategoryId } => {
  if ('id' in shelf) return { file, id: shelf.id as ResearchCategoryId };
  const found = 'systemKey' in shelf ? liveShelf(file, shelf.systemKey) : shelfNamed(file, shelf.name);
  if (found) return { file, id: found.id };
  const name = 'systemKey' in shelf ? SHELF_NAMES[shelf.systemKey] ?? 'Notes' : shelf.name.trim().slice(0, 120);
  const made = addResearchCategory(file, { name });
  if (!('systemKey' in shelf)) return { file: made.file, id: made.category.id };
  return {
    file: {
      ...made.file,
      researchCategories: made.file.researchCategories.map((category) =>
        category.id === made.category.id ? { ...category, systemKey: shelf.systemKey } : category,
      ),
    },
    id: made.category.id,
  };
};

const segmentOf = (target: ProjectFile, text: string) => ({
  elements: text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({
      id: newId<ManuscriptElementId>(),
      type: defaultElementType(target.project.format),
      text: line,
      characterId: null,
      attributes: {},
    })),
});

/**
 * Words onto a research shelf: a new item, or added to or put in place of an
 * existing one's (WP spec §9). What both extracts and outline rows do when
 * their destination is a shelf.
 */
const writeResearch = (
  file: ProjectFile,
  where: Resolved,
  words: { title: string; body: string; tags: readonly string[]; credit: string },
): { file: ProjectFile; resultId: string; areaName: string } => {
  if (where.into) {
    // Into an item that is already there: never silently, so the dialog has
    // asked, and the receipt says which.
    const item = file.researchItems.find((one) => one.id === where.into!.itemId)!;
    const body =
      where.into.mode === 'replace'
        ? words.body
        : [item.body.trimEnd(), words.body].filter((part) => part.length > 0).join('\n\n');
    return {
      file: updateResearchItem(file, item.id as ResearchItemId, {
        body,
        tags: [...new Set([...item.tags, ...words.tags])],
        ...(item.source ? {} : { source: words.credit }),
      }),
      resultId: item.id,
      areaName: where.areaName,
    };
  }
  const shelf = shelfIdIn(file, where.shelf ?? { systemKey: 'notes' });
  const next = addResearchItem(shelf.file, {
    categoryId: shelf.id,
    title: words.title,
    body: words.body,
    tags: [...words.tags],
    source: words.credit,
    origin: 'import',
  });
  return {
    file: next,
    resultId: next.researchItems[next.researchItems.length - 1]!.id,
    areaName: `Research › ${next.researchCategories.find((category) => category.id === shelf.id)?.name ?? 'Notes'}`,
  };
};

export interface TransferResult {
  /** The target with everything written into it. */
  target: ProjectFile;
  receipts: Map<string, ExtractReceipt>;
  /** Where each went, as a list key (`destinationOptions`). */
  keys: Map<string, string>;
}

/**
 * Write the extracts into the target. Those already sent there are skipped
 * unless `again` says otherwise: a second send is a second copy only when the
 * writer asked for one.
 */
export const applyTransfer = (
  source: ProjectFile,
  extractIds: readonly string[],
  target: ProjectFile,
  options: { path?: string | null; again?: boolean; choices?: Readonly<Record<string, DestinationChoice>> } = {},
): TransferResult => {
  let next = target;
  const receipts = new Map<string, ExtractReceipt>();
  const keys = new Map<string, string>();
  const documentTitle = (extract: Extract): string =>
    source.documents.find((document) => document.id === extract.documentId)?.title || source.project.title;

  for (const extractId of extractIds) {
    const extract = source.extracts.find((one) => one.id === extractId);
    if (!extract) continue;
    if (!options.again && receiptFor(extract, target.project.id)) continue;
    const where = destinationOf(source, extract, next, options.choices?.[extractId]);
    let resultId: string;
    let areaName = where.areaName;
    const credit =
      source.project.id === target.project.id
        ? `From “${documentTitle(extract)}”`
        : `From “${documentTitle(extract)}” in ${source.project.title}`;

    if (where.area === 'research') {
      const written = writeResearch(next, where, { title: extract.title, body: extract.textPlain, tags: extract.tags, credit });
      next = written.file;
      resultId = written.resultId;
      areaName = written.areaName;
    } else {
      let unit = where.area === 'beat' ? (next.units.find((one) => one.id === where.unitId) ?? lastUnit(next)) : null;
      if (unit === null) {
        const made = addUnit(next, { trackId: next.tracks[0]!.id, title: extract.title });
        next = made.file;
        unit = made.unit;
      }
      const made = addBeat(next, { unitId: unit.id, title: where.area === 'beat' ? extract.title : '' });
      next = updateBeat(made.file, made.beat.id, { manuscript: segmentOf(next, extract.textPlain) });
      resultId = where.area === 'scene' ? unit.id : made.beat.id;
    }

    keys.set(extractId, where.area === 'scene' ? 'scene' : where.area === 'beat' ? `beat:${where.unitId ?? ''}` : where.key);
    receipts.set(extractId, {
      projectId: target.project.id,
      projectTitle: target.project.title,
      path: options.path ?? null,
      area: where.area,
      areaName,
      resultId,
      at: nowIso(),
    });
  }
  return { target: next, receipts, keys };
};

/**
 * The receipts, recorded on the extracts once the target is safely written.
 * A move then takes the extracts out of the bins; the document's words are
 * never touched (WP spec §7.1).
 */
export const recordTransfer = (
  source: ProjectFile,
  receipts: ReadonlyMap<string, ExtractReceipt>,
  action: TransferAction,
): ProjectFile => {
  if (action === 'move') {
    return [...receipts.keys()].reduce((file, extractId) => deleteExtract(file, extractId as ExtractId), source);
  }
  const at = nowIso();
  return {
    ...source,
    extracts: source.extracts.map((extract) => {
      const receipt = receipts.get(extract.id);
      return receipt
        ? { ...extract, status: 'exported' as const, sentTo: [...extract.sentTo, receipt], updatedAt: at }
        : extract;
    }),
  };
};

/**
 * The pieces of a send that outline rows share with extracts
 * (`outline-transfer.ts`): one name, so the domain's public surface does not
 * grow a `lastUnit` that means something only here.
 */
export const transferInternals = {
  liveShelf,
  takesScenes,
  lastUnit,
  researchTo,
  sceneTo,
  beatTo,
  shelfIdIn,
  segmentOf,
  writeResearch,
  SHELF_NAMES,
};
