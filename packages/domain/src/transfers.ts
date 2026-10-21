import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { addBeat, addResearchCategory, addResearchItem, addUnit, updateBeat } from './mutations.js';
import { deleteExtract } from './extracts.js';
import { defaultElementType } from './editing.js';
import { isInstructional, isProseFormat, isWordProcessor } from './formats.js';
import { unitsInStoryOrder } from './selectors.js';
import type { Extract, ExtractKind, ExtractReceipt, TransferArea } from './entities/extract.js';
import type { SystemCategoryKey } from './entities/research.js';
import type { ProjectFile } from './project-file.js';
import type { ExtractId, ManuscriptElementId, ResearchCategoryId } from './ids.js';

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
  target.researchCategories.find((category) => category.systemKey === key && !category.archived) ?? null;

/** A story project with a track to put a scene on. Documents and instructional books have shelves only. */
const takesScenes = (target: ProjectFile): boolean =>
  !isWordProcessor(target.project.format) && !isInstructional(target.project.format) && target.tracks.length > 0;

const lastUnit = (target: ProjectFile) => {
  const units = unitsInStoryOrder(target);
  return units[units.length - 1] ?? null;
};

/** Where one extract goes in the target, without writing anything. */
const destinationOf = (
  source: ProjectFile,
  extract: Extract,
  target: ProjectFile,
): { area: TransferArea; areaName: string; shelf: SystemCategoryKey | null; fallback: boolean } => {
  const kind = kindOf(source, extract);
  if ((kind === 'scene' || kind === 'beat') && takesScenes(target)) {
    const unit = lastUnit(target);
    if (kind === 'scene' && !isProseFormat(target.project.format)) {
      return { area: 'scene', areaName: 'A new scene', shelf: null, fallback: false };
    }
    if (kind === 'scene' && isProseFormat(target.project.format) && unit === null) {
      return { area: 'scene', areaName: 'A new chapter', shelf: null, fallback: false };
    }
    return {
      area: unit === null ? 'scene' : 'beat',
      areaName: unit === null ? 'A new scene' : `A beat in “${unit.title || 'the last scene'}”`,
      shelf: null,
      fallback: false,
    };
  }
  const wanted = SHELF_FOR[kind];
  const shelf = wanted && liveShelf(target, wanted) ? wanted : 'notes';
  const existing = liveShelf(target, shelf);
  return {
    area: 'research',
    areaName: `Research › ${existing?.name ?? SHELF_NAMES[shelf] ?? 'Notes'}`,
    shelf,
    fallback: shelf === 'notes' && wanted !== undefined,
  };
};

const receiptFor = (extract: Extract, projectId: string): ExtractReceipt | null =>
  extract.sentTo.find((receipt) => receipt.projectId === projectId) ?? null;

/**
 * The preview: where each extract will go, and which have gone there before.
 * It is the send itself, done on a copy and thrown away, so the preview cannot
 * say one thing and the send do another.
 */
export const planTransfer = (source: ProjectFile, extractIds: readonly string[], target: ProjectFile): TransferPlan => {
  const trial = applyTransfer(source, extractIds, target, { again: true });
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
          fallback: destinationOf(source, extract, target).fallback,
          already: receiptFor(extract, target.project.id),
        },
      ];
    }),
  };
};

const shelfId = (file: ProjectFile, key: SystemCategoryKey): { file: ProjectFile; id: ResearchCategoryId } => {
  const found = liveShelf(file, key);
  if (found) return { file, id: found.id };
  const made = addResearchCategory(file, { name: SHELF_NAMES[key] ?? 'Notes' });
  return {
    file: {
      ...made.file,
      researchCategories: made.file.researchCategories.map((category) =>
        category.id === made.category.id ? { ...category, systemKey: key } : category,
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

export interface TransferResult {
  /** The target with everything written into it. */
  target: ProjectFile;
  receipts: Map<string, ExtractReceipt>;
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
  options: { path?: string | null; again?: boolean } = {},
): TransferResult => {
  let next = target;
  const receipts = new Map<string, ExtractReceipt>();
  const documentTitle = (extract: Extract): string =>
    source.documents.find((document) => document.id === extract.documentId)?.title || source.project.title;

  for (const extractId of extractIds) {
    const extract = source.extracts.find((one) => one.id === extractId);
    if (!extract) continue;
    if (!options.again && receiptFor(extract, target.project.id)) continue;
    const where = destinationOf(source, extract, next);
    let resultId: string;
    let areaName = where.areaName;

    if (where.area === 'research') {
      const shelf = shelfId(next, where.shelf ?? 'notes');
      next = addResearchItem(shelf.file, {
        categoryId: shelf.id,
        title: extract.title,
        body: extract.textPlain,
        tags: extract.tags,
        source:
          source.project.id === target.project.id
            ? `From “${documentTitle(extract)}”`
            : `From “${documentTitle(extract)}” in ${source.project.title}`,
        origin: 'import',
      });
      resultId = next.researchItems[next.researchItems.length - 1]!.id;
      areaName = `Research › ${next.researchCategories.find((category) => category.id === shelf.id)?.name ?? 'Notes'}`;
    } else {
      let unit = where.area === 'beat' ? lastUnit(next) : null;
      if (unit === null) {
        const made = addUnit(next, { trackId: next.tracks[0]!.id, title: extract.title });
        next = made.file;
        unit = made.unit;
      }
      const made = addBeat(next, { unitId: unit.id, title: where.area === 'beat' ? extract.title : '' });
      next = updateBeat(made.file, made.beat.id, { manuscript: segmentOf(next, extract.textPlain) });
      resultId = where.area === 'scene' ? unit.id : made.beat.id;
    }

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
  return { target: next, receipts };
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
