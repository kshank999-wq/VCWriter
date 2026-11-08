import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUIDES } from '../help';
import { MODULE_PAGES } from '../modules';
import { TOOL_PAGES } from '../tools';

/**
 * The help guides (addendum 35 §9) hold together: every slug once, every
 * link to a guide that exists, every picture on disk, and the guides the
 * program's Help ▸ Guide for this screen opens are all here.
 */
const publicDir = resolve(__dirname, '..', '..', '..', 'public');
const slugs = new Set(GUIDES.map((guide) => guide.slug));

/** The slugs apps/desktop/src/renderer/help-links.ts can open. */
const OPENED_FROM_THE_PROGRAM = [
  'getting-started',
  'the-workspace',
  'saving-and-recovery',
  'layout',
  'story-sculptor',
  'outliner',
  'research',
  'read-back',
  'focus',
  'preview',
  'editors',
  'document',
];

describe('the help guides', () => {
  it('has each slug once', () => {
    expect(slugs.size).toBe(GUIDES.length);
  });

  it('links only to guides that exist', () => {
    for (const guide of GUIDES) {
      for (const next of guide.related ?? []) expect(slugs.has(next), `${guide.slug} → ${next}`).toBe(true);
    }
  });

  it('shows only pictures that exist', () => {
    const shots = GUIDES.flatMap((guide) => [guide.shot, ...guide.sections.map((section) => section.shot)]).filter(
      (shot): shot is NonNullable<typeof shot> => shot !== undefined,
    );
    for (const shot of shots) expect(existsSync(resolve(publicDir, `${shot}.jpg`)), shot).toBe(true);
  });

  it('has a guide for every module and everything the program opens', () => {
    for (const page of MODULE_PAGES) expect(slugs.has(page.slug), page.slug).toBe(true);
    for (const slug of OPENED_FROM_THE_PROGRAM) expect(slugs.has(slug), slug).toBe(true);
  });

  it('has something in every section', () => {
    for (const guide of GUIDES) {
      expect(guide.sections.length, guide.slug).toBeGreaterThan(0);
      for (const section of guide.sections) {
        expect((section.body?.length ?? 0) + (section.steps?.length ?? 0), `${guide.slug}: ${section.heading}`).toBeGreaterThan(0);
      }
    }
  });
});

/** The rooms' pages (addendum 35 §11) point at real pictures and real guides. */
describe('the tool pages', () => {
  it('show only pictures that exist and link to guides that exist', () => {
    for (const tool of TOOL_PAGES) {
      expect(slugs.has(tool.guide), tool.slug).toBe(true);
      for (const shot of [tool.shot, ...tool.features.map((feature) => feature.shot)]) {
        if (shot) expect(existsSync(resolve(publicDir, `${shot}.jpg`)), shot).toBe(true);
      }
    }
  });

  it('has each slug once', () => {
    expect(new Set(TOOL_PAGES.map((tool) => tool.slug)).size).toBe(TOOL_PAGES.length);
  });
});


/** The step-by-step boxes (addendum 35 §14) show only pictures that exist. */
describe('the walkthroughs', () => {
  it('show only pictures that exist, a few steps each', async () => {
    const { WALKTHROUGHS } = await import('../walkthroughs');
    for (const walk of WALKTHROUGHS) {
      expect(walk.steps.length, walk.slug).toBeGreaterThanOrEqual(3);
      for (const step of walk.steps) expect(existsSync(resolve(publicDir, `${step.shot}.jpg`)), step.shot).toBe(true);
    }
  });
});
