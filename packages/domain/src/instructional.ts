import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { assetSchema } from './entities/asset.js';
import { INSTRUCTIONAL_RESEARCH_CATEGORIES } from './entities/research.js';
import { isInstructional } from './formats.js';
import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
import type { Asset } from './entities/asset.js';
import type { ManuscriptElement } from './entities/manuscript.js';
import type { ProjectFile } from './project-file.js';
import type { AssetId, BeatId, ManuscriptElementId, StructuralUnitId } from './ids.js';

/**
 * Instructional / Book Mode (addendum 16, from Ken's spec).
 *
 * The module is small because most of what the spec asks for already existed
 * under other names — a chapter is a structural unit, a section is a beat, a
 * content item is a manuscript element, a relationship is a story link. What
 * is here is the part that genuinely differs: **a picture that is part of the
 * book**.
 *
 * The decision that shapes all of it: **a figure is an element of the
 * manuscript, not an attachment to a section.** Putting it in the element list
 * is what gives it a place in the reading order for free — it paginates,
 * prints, travels when its section moves, and appears in Book View exactly
 * where it was put. A side table of *graphics attached to this chapter* would
 * have to re-derive an order the manuscript already knows, and would disagree
 * with it the first time somebody moved a paragraph.
 */

// ------------------------------------------------------------- the library

export const addGraphic = (
  file: ProjectFile,
  input: { name: string; data: string; width?: number; height?: number; caption?: string; altText?: string },
): { file: ProjectFile; asset: Asset } => {
  const at = nowIso();
  const asset = assetSchema.parse({
    id: newId<AssetId>(),
    projectId: file.project.id,
    kind: 'image',
    name: input.name,
    data: input.data,
    width: input.width ?? 0,
    height: input.height ?? 0,
    caption: input.caption ?? '',
    altText: input.altText ?? '',
    createdAt: at,
    updatedAt: at,
  });
  return { file: { ...file, assets: [...(file.assets ?? []), asset] }, asset };
};

export const updateGraphic = (
  file: ProjectFile,
  assetId: AssetId,
  patch: Partial<Pick<Asset, 'name' | 'caption' | 'altText'>>,
): ProjectFile => ({
  ...file,
  assets: (file.assets ?? []).map((asset) =>
    asset.id === assetId ? assetSchema.parse({ ...asset, ...patch, updatedAt: nowIso() }) : asset,
  ),
});

/**
 * Take a picture out of the library.
 *
 * **The figures that used it are left where they are**, struck through by
 * `placementsOf` reading a missing asset rather than silently vanishing from
 * the page. Deleting a picture is not the same act as deleting the places it
 * appeared, and a book that quietly lost three figures because one file was
 * tidied away is the outcome worth refusing. §12 asks for exactly this
 * separation of *remove from structure* and *delete*.
 */
export const removeGraphic = (file: ProjectFile, assetId: AssetId): ProjectFile => ({
  ...file,
  assets: (file.assets ?? []).filter((asset) => asset.id !== assetId),
});

/** Every picture the book holds, by name. */
export const graphicsInOrder = (file: ProjectFile): Asset[] =>
  (file.assets ?? [])
    .filter((asset) => asset.kind === 'image')
    .sort((a, b) => a.name.localeCompare(b.name));

// ---------------------------------------------------- putting one in the book

/**
 * Place a picture in the manuscript, at a point the author chose.
 *
 * The caption starts as the asset's own and is then the element's, which is
 * how one diagram can carry a general caption in the library and a specific
 * one where it is used — without the library's copy changing under the other
 * placements.
 *
 * `afterElementId` is where it goes; null puts it at the top of the section,
 * which is what dropping a graphic onto a section rather than into it means.
 */
export const placeFigure = (
  file: ProjectFile,
  input: { beatId: BeatId; assetId: AssetId; afterElementId?: ManuscriptElementId | null; caption?: string },
): ProjectFile => {
  const beat = file.beats.find((one) => one.id === input.beatId);
  const asset = (file.assets ?? []).find((one) => one.id === input.assetId);
  if (!beat || !asset) return file;

  const figure: ManuscriptElement = {
    id: newId<ManuscriptElementId>(),
    type: 'figure',
    text: input.caption ?? asset.caption,
    characterId: null,
    attributes: { assetId: asset.id as string },
  };

  const elements = beat.manuscript.elements;
  const after = input.afterElementId
    ? elements.findIndex((one) => (one.id as string) === (input.afterElementId as string))
    : -1;
  const at = after < 0 ? 0 : after + 1;

  return {
    ...file,
    beats: file.beats.map((one) =>
      one.id === beat.id
        ? {
            ...one,
            manuscript: { elements: [...elements.slice(0, at), figure, ...elements.slice(at)] },
            updatedAt: nowIso(),
          }
        : one,
    ),
  };
};

/** Take a figure out of the manuscript. The picture stays in the library. */
export const removeFigure = (file: ProjectFile, beatId: BeatId, elementId: ManuscriptElementId): ProjectFile => ({
  ...file,
  beats: file.beats.map((one) =>
    one.id === beatId
      ? {
          ...one,
          manuscript: { elements: one.manuscript.elements.filter((el) => el.id !== elementId) },
          updatedAt: nowIso(),
        }
      : one,
  ),
});

/** Where a figure sits, and whether its picture is still there. */
export interface FigurePlacement {
  elementId: ManuscriptElementId;
  beatId: BeatId;
  unitId: StructuralUnitId;
  /** Story index of the chapter it falls in. */
  unitIndex: number;
  assetId: string;
  asset: Asset | null;
  caption: string;
  /**
   * What it prints as: Figure 1, Figure 2 — **counted in reading order every
   * time, never stored.** Moving a chapter renumbers every figure after it
   * with nothing run, which is the same absence the book index's page numbers
   * and the chapter numbers already rest on.
   */
  number: number;
}

/**
 * Every figure in the book, in the order a reader meets them.
 *
 * The reading that makes figure numbering work, and the one Book View draws
 * from. An `asset` of null is a figure whose picture was deleted: kept and
 * shown as missing, because the author is the one who decides whether the
 * words that referred to it should go too.
 */
export const figuresInOrder = (file: ProjectFile): FigurePlacement[] => {
  const found: FigurePlacement[] = [];
  const assets = new Map((file.assets ?? []).map((asset) => [asset.id as string, asset]));

  unitsInStoryOrder(file).forEach((unit, unitIndex) => {
    for (const beat of beatsForUnit(file, unit.id)) {
      for (const element of beat.manuscript.elements) {
        if (element.type !== 'figure') continue;
        const assetId = typeof element.attributes['assetId'] === 'string' ? element.attributes['assetId'] : '';
        found.push({
          elementId: element.id,
          beatId: beat.id,
          unitId: unit.id,
          unitIndex,
          assetId,
          asset: assets.get(assetId) ?? null,
          caption: element.text,
          number: found.length + 1,
        });
      }
    }
  });

  return found;
};

/** Where one picture appears, so removing it can say what it would cost. */
export const placementsOf = (file: ProjectFile, assetId: AssetId): FigurePlacement[] =>
  figuresInOrder(file).filter((one) => one.assetId === (assetId as string));

/**
 * Pictures nothing in the book uses.
 *
 * A fact, not a fault: a library is where material waits, and §3 is explicit
 * that research may stay unassigned. It is offered so an author can find what
 * they forgot, never to tell them off.
 */
export const unplacedGraphics = (file: ProjectFile): Asset[] => {
  const used = new Set(figuresInOrder(file).map((one) => one.assetId));
  return graphicsInOrder(file).filter((asset) => !used.has(asset.id as string));
};

/**
 * Figures with no alt text (§9).
 *
 * Checkable rather than an opinion, which is the only kind of warning this
 * project makes. A missing description is a fact about the record; whether a
 * given description is any good is not something software gets to say.
 */
export const figuresWithoutAltText = (file: ProjectFile): FigurePlacement[] =>
  figuresInOrder(file).filter((one) => one.asset !== null && one.asset.altText.trim().length === 0);

/** What the graphics library owes, in one line. */
export const describeGraphics = (file: ProjectFile): string => {
  const all = graphicsInOrder(file);
  if (all.length === 0) return 'No graphics yet.';
  const placed = figuresInOrder(file).length;
  const noAlt = figuresWithoutAltText(file).length;
  const parts = [`${all.length} ${all.length === 1 ? 'graphic' : 'graphics'} · ${placed} placed`];
  if (noAlt > 0) parts.push(`${noAlt} without a description`);
  return parts.join(' · ');
};

// ----------------------------------------------------------- the shelves

/**
 * The research shelves this project should have seeded.
 *
 * Read from the format rather than stored, so a project that predates the mode
 * is not left with a taxonomy nobody chose for it.
 */
export const shelvesFor = (file: ProjectFile) =>
  isInstructional(file.project.format) ? INSTRUCTIONAL_RESEARCH_CATEGORIES : [];

export { INSTRUCTIONAL_RESEARCH_CATEGORIES } from './entities/research.js';
