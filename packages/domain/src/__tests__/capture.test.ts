import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { captureItemSchema, type CaptureItem } from '../entities/capture.js';
import {
  approveCapture,
  captureTitle,
  deferCapture,
  needsReview,
  rejectCapture,
  suggestRouting,
} from '../capture-approval.js';
import { DomainError } from '../mutations.js';
import { newId, type CaptureItemId, type UserId } from '../ids.js';

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
