import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import {
  CAPTURE_CATEGORIES,
  CAPTURE_CATEGORY_NAMES,
  captureItemSchema,
  type CaptureItem,
} from '../entities/capture.js';
import { captureFromRow } from '../sync-mapping.js';
import {
  approveCapture,
  captureTitle,
  deferCapture,
  inboxGroups,
  needsReview,
  rejectCapture,
  suggestRouting,
} from '../capture-approval.js';
import { addCharacter } from '../mutations.js';
import { DomainError } from '../mutations.js';
import { newId, type CaptureItemId, type CharacterId, type UserId } from '../ids.js';

const capture = (overrides: Partial<CaptureItem> = {}): CaptureItem =>
  captureItemSchema.parse({
    id: newId<CaptureItemId>(),
    userId: newId<UserId>(),
    source: 'mobile_voice',
    capturedAt: new Date().toISOString(),
    rawText: 'The keeper never says what happened to the previous one.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

const project = () => createProjectFile({ title: 'Lighthouse', format: 'screenplay' });

describe('routing a capture', () => {
  it('proposes the research category the classifier named', () => {
    const file = project();
    const suggestion = suggestRouting(
      file,
      capture({ inference: { categoryKey: 'plot_points', entityName: null, targetRef: null, confidence: 0.9, model: 'test' } }),
    );

    expect(suggestion.decision?.kind).toBe('research');
    const plotPoints = file.researchCategories.find((category) => category.systemKey === 'plot_points')!;
    expect(suggestion.decision).toMatchObject({ categoryId: plotPoints.id });
    expect(suggestion.reason).toContain('Plot Points');
  });

  it('proposes a character when the capture named one', () => {
    const suggestion = suggestRouting(
      project(),
      capture({
        rawText: 'Character Marisol — she never trusts anyone who arrives by boat.',
        inference: { categoryKey: 'characters', entityName: 'Marisol', targetRef: null, confidence: 0.95, model: 'test' },
      }),
    );

    expect(suggestion.decision).toEqual({ kind: 'character', name: 'Marisol' });
  });

  it('falls back to Ideas and says so when nothing was identified', () => {
    const suggestion = suggestRouting(project(), capture());
    expect(suggestion.decision?.kind).toBe('research');
    expect(suggestion.reason).toContain('No category identified');
    expect(suggestion.confidence).toBe(0);
  });

  it('prefers the destination the writer chose over the classifier guess', () => {
    const file = project();
    const characters = file.researchCategories.find((category) => category.systemKey === 'characters')!;
    const suggestion = suggestRouting(
      file,
      capture({
        requestedRouting: { kind: 'research', categoryKey: 'characters' },
        inference: { categoryKey: 'ideas', entityName: null, targetRef: null, confidence: 0.9, model: 'test' },
      }),
    );

    expect(suggestion.decision).toMatchObject({ kind: 'research', categoryId: characters.id });
    expect(suggestion.confidence).toBe(1);
    expect(suggestion.reason).toContain('You chose');
  });

  it('sends anything the classifier was unsure about to review', () => {
    const unsure = capture({
      inference: { categoryKey: 'ideas', entityName: null, targetRef: null, confidence: 0.3, model: 'test' },
    });
    const sure = capture({
      inference: { categoryKey: 'ideas', entityName: null, targetRef: null, confidence: 0.95, model: 'test' },
    });

    expect(needsReview(unsure)).toBe(true);
    expect(needsReview(sure)).toBe(false);
  });

  it('titles a capture from the named entity, or its first line', () => {
    expect(
      captureTitle(
        capture({ inference: { categoryKey: 'characters', entityName: 'Marisol', targetRef: null, confidence: 1, model: null } }),
      ),
    ).toBe('Marisol');
    expect(captureTitle(capture({ rawText: 'A short thought\nand more below' }))).toBe('A short thought');
  });
});

describe('approving a capture', () => {
  it('creates a research note carrying the captured text', () => {
    const file = project();
    const ideas = file.researchCategories.find((category) => category.systemKey === 'ideas')!;
    const item = capture();

    const result = approveCapture(file, item, { kind: 'research', categoryId: ideas.id });

    const created = result.file.researchItems[0]!;
    expect(created.body).toBe(item.rawText);
    expect(created.origin).toBe('mobile_capture');
    expect(created.usage).toBe('unused');
    expect(result.resultRef).toEqual({ type: 'research_item', id: created.id });
    expect(result.capture.status).toBe('approved');
    expect(result.capture.reviewedAt).not.toBeNull();
  });

  it('keeps the raw capture after approval, so a wrong call can be read back', () => {
    const file = project();
    const ideas = file.researchCategories.find((category) => category.systemKey === 'ideas')!;
    const item = capture();

    const result = approveCapture(file, item, { kind: 'research', categoryId: ideas.id });

    expect(result.capture.rawText).toBe(item.rawText);
  });

  it('creates a beat inside a scene when that is the decision', () => {
    const file = project();
    const unitId = file.units[0]!.id;
    const item = capture({ rawText: 'She finally asks him about the light.' });

    const result = approveCapture(file, item, { kind: 'beat', unitId, title: 'The question' });

    const created = result.file.beats.find((beat) => beat.title === 'The question')!;
    expect(created.unitId).toBe(unitId);
    expect(created.summary).toBe(item.rawText);
    expect(result.resultRef.type).toBe('beat');
  });

  it('creates a character', () => {
    const item = capture({
      inference: { categoryKey: 'characters', entityName: 'Marisol', targetRef: null, confidence: 0.9, model: 'test' },
    });
    const result = approveCapture(project(), item, { kind: 'character' });

    expect(result.file.characters[0]?.name).toBe('Marisol');
    expect(result.resultRef.type).toBe('character');
  });

  it('refuses to approve the same capture twice', () => {
    const file = project();
    const ideas = file.researchCategories.find((category) => category.systemKey === 'ideas')!;
    const approved = approveCapture(file, capture(), { kind: 'research', categoryId: ideas.id }).capture;

    expect(() => approveCapture(file, approved, { kind: 'research', categoryId: ideas.id })).toThrow(DomainError);
  });

  it('keeps the capture on rejection and on deferral', () => {
    const item = capture();
    const rejected = rejectCapture(item);
    expect(rejected.status).toBe('rejected');
    expect(rejected.rawText).toBe(item.rawText);

    expect(deferCapture(item).status).toBe('needs_review');
  });
});

/**
 * The companion app's two fields (addendum 09 §3.1, stage 0).
 *
 * The claim worth defending is §2's: **a category is not a destination.** One
 * says what kind of thought was spoken, the other says where in the project it
 * goes, and they are allowed to disagree — which is what happens every time a
 * writer drags a Character note into the Ideas folder because that is where it
 * really belonged.
 */
describe('what the phone says a note is', () => {
  it('carries the five categories and nothing else', () => {
    expect(CAPTURE_CATEGORIES).toEqual(['character', 'plot_point', 'idea', 'theme', 'arc']);
    expect(() => capture({ category: 'location' as never })).toThrow();
  });

  it('keeps the spoken name apart from anything a classifier guessed', () => {
    // subject_name is testimony; inference is a proposal. A row may carry both,
    // and they are not the same field wearing two hats.
    const one = capture({
      category: 'character',
      subjectName: 'MARISOL',
      inference: { categoryKey: 'ideas', entityName: 'the keeper', targetRef: null, confidence: 0.4, model: 'test' },
    });

    expect(one.subjectName).toBe('MARISOL');
    expect(one.inference?.entityName).toBe('the keeper');
  });

  it('is null on everything captured before the companion app existed', () => {
    const old = capture();
    expect(old.category).toBeNull();
    expect(old.subjectName).toBeNull();
  });

  it('lets the category and the destination disagree, which is the whole point', () => {
    const one = capture({
      category: 'character',
      requestedRouting: { kind: 'research', categoryKey: 'ideas' },
    });

    expect(one.category).toBe('character');
    expect(one.requestedRouting?.kind).toBe('research');
  });

  it('comes back off a database row with both fields intact', () => {
    const row = {
      id: newId<CaptureItemId>() as string,
      user_id: newId<UserId>() as string,
      project_id: null,
      source: 'mobile_voice',
      captured_at: new Date().toISOString(),
      raw_text: 'She never lets anyone drive.',
      audio_path: null,
      transcript_confidence: null,
      inference: null,
      requested_routing: null,
      category: 'arc',
      subject_name: 'MARISOL',
      status: 'pending',
      reviewed_at: null,
      result_type: null,
      result_id: null,
      synced_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const read = captureFromRow(row);
    expect(read.category).toBe('arc');
    expect(read.subjectName).toBe('MARISOL');
  });

  it('reads a row from before the columns existed without complaining', () => {
    const row = {
      id: newId<CaptureItemId>() as string,
      user_id: newId<UserId>() as string,
      project_id: null,
      source: 'mobile_text',
      captured_at: new Date().toISOString(),
      raw_text: 'A revolver in the drawer.',
      audio_path: null,
      transcript_confidence: null,
      inference: null,
      requested_routing: null,
      status: 'pending',
      reviewed_at: null,
      result_type: null,
      result_id: null,
      synced_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(captureFromRow(row).category).toBeNull();
  });

  it('has a name for each category, because a writer reads them', () => {
    expect(CAPTURE_CATEGORIES.map((one) => CAPTURE_CATEGORY_NAMES[one])).toEqual([
      'Character',
      'Plot Point',
      'Idea',
      'Theme',
      'Arc',
    ]);
  });
});

/**
 * The Mobile App inbox (addendum 09 §4, stage 1).
 *
 * The spoken category is **testimony**: it sits above anything a classifier
 * guessed and below a destination the writer actually chose. What it buys is a
 * sensible opening proposal, never a placement — §1's rule is that the desktop
 * places, and every one of these is something a person confirms.
 */
describe('what a spoken category proposes', () => {
  const cast = (name: string) => {
    const file = addCharacter(project(), { name });
    return { file, id: file.characters[file.characters.length - 1]!.id };
  };

  it('files a plot point in Plot Points, and says it was told to', () => {
    const file = project();
    const suggestion = suggestRouting(file, capture({ category: 'plot_point' }));

    const folder = file.researchCategories.find((one) => one.systemKey === 'plot_points')!;
    expect(suggestion.decision).toMatchObject({ kind: 'research', categoryId: folder.id });
    expect(suggestion.reason).toBe('You said Plot Point');
  });

  it('points a named Character note at the person who is already in the cast', () => {
    const { file, id } = cast('MARISOL');
    const suggestion = suggestRouting(file, capture({ category: 'character', subjectName: 'MARISOL' }));

    // About her — never a second Marisol.
    expect(suggestion.decision).toEqual({ kind: 'about_character', characterId: id });
    expect(suggestion.reason).toContain('already in the cast');
  });

  it('offers to make somebody the cast has never heard of', () => {
    const suggestion = suggestRouting(project(), capture({ category: 'character', subjectName: 'DEAKINS' }));
    expect(suggestion.decision).toEqual({ kind: 'character', name: 'DEAKINS' });
  });

  it('reads an arc note about a known person as being about them', () => {
    const { file, id } = cast('MARISOL');
    const suggestion = suggestRouting(file, capture({ category: 'arc', subjectName: 'Marisol' }));
    expect(suggestion.decision).toEqual({ kind: 'about_character', characterId: id });
  });

  it('sends an arc note naming nobody to Ideas, and says that is what it did', () => {
    // There is no Arcs folder and there is not going to be one. Saying where it
    // went matters more than the choice: the writer can move it in one drag.
    const suggestion = suggestRouting(project(), capture({ category: 'arc' }));
    expect(suggestion.reason).toContain('Ideas until you say otherwise');
  });

  it('does not make a character out of an arc note about somebody new', () => {
    const suggestion = suggestRouting(project(), capture({ category: 'arc', subjectName: 'NOBODY' }));
    expect(suggestion.decision?.kind).toBe('research');
  });

  it('is outranked by a destination the writer actually chose', () => {
    const file = project();
    const suggestion = suggestRouting(
      file,
      capture({ category: 'character', subjectName: 'MARISOL', requestedRouting: { kind: 'research', categoryKey: 'ideas' } }),
    );
    expect(suggestion.reason).toContain('You chose');
  });

  it('outranks what a classifier guessed, because one of them is testimony', () => {
    const file = project();
    const suggestion = suggestRouting(
      file,
      capture({
        category: 'theme',
        inference: { categoryKey: 'props', entityName: null, targetRef: null, confidence: 0.95, model: 'test' },
      }),
    );

    const themes = file.researchCategories.find((one) => one.systemKey === 'themes')!;
    expect(suggestion.decision).toMatchObject({ categoryId: themes.id });
  });
});

describe('a note dropped on somebody already in the cast', () => {
  it('files it against them rather than making a second one of them', () => {
    let file = addCharacter(project(), { name: 'MARISOL' });
    const marisol = file.characters[file.characters.length - 1]!;
    const note = capture({ category: 'character', subjectName: 'MARISOL', rawText: 'She never lets anyone drive.' });

    const result = approveCapture(file, note, { kind: 'about_character', characterId: marisol.id });
    file = result.file;

    expect(file.characters).toHaveLength(1);
    const made = file.researchItems[file.researchItems.length - 1]!;
    expect(made.body).toContain('never lets anyone drive');
    // Filed with the notes about people, and linked, so it turns up on her.
    const characters = file.researchCategories.find((one) => one.systemKey === 'characters')!;
    expect(made.categoryId).toBe(characters.id);
    expect(
      file.links.some((link) => link.from.id === (made.id as string) && link.to.id === (marisol.id as string)),
    ).toBe(true);
  });

  it('makes no characterization item, because that is not its call', () => {
    const file = addCharacter(project(), { name: 'MARISOL' });
    const marisol = file.characters[file.characters.length - 1]!;
    const result = approveCapture(file, capture(), { kind: 'about_character', characterId: marisol.id });

    expect(result.file.characterizationItems).toHaveLength(0);
    expect(result.file.characterTraits).toHaveLength(0);
  });

  it('refuses somebody who is not there', () => {
    expect(() =>
      approveCapture(project(), capture(), { kind: 'about_character', characterId: newId<CharacterId>() }),
    ).toThrow(DomainError);
  });
});

describe('the inbox', () => {
  it('groups by what was spoken, in the order the app offers them', () => {
    const groups = inboxGroups([
      capture({ category: 'theme' }),
      capture({ category: 'character' }),
      capture({ category: 'idea' }),
    ]);
    expect(groups.map((group) => group.name)).toEqual(['Character', 'Idea', 'Theme']);
  });

  it('keeps what named no category, rather than quietly dropping it', () => {
    const groups = inboxGroups([capture(), capture({ category: 'idea' })]);
    expect(groups.map((group) => group.name)).toEqual(['Idea', 'No category']);
  });

  it('is the tray of what is still waiting, so a decision already made leaves it', () => {
    const groups = inboxGroups([
      capture({ category: 'idea', status: 'approved' }),
      capture({ category: 'idea', status: 'rejected' }),
      capture({ category: 'idea', status: 'needs_review' }),
    ]);
    expect(groups[0]!.captures).toHaveLength(1);
  });

  it('puts the newest first, which is what somebody back at the desk wants', () => {
    const groups = inboxGroups([
      capture({ category: 'idea', rawText: 'older', capturedAt: '2026-01-01T00:00:00.000Z' }),
      capture({ category: 'idea', rawText: 'newer', capturedAt: '2026-06-01T00:00:00.000Z' }),
    ]);
    expect(groups[0]!.captures.map((one) => one.rawText)).toEqual(['newer', 'older']);
  });
});
