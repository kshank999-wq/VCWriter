import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { addChoice, addElement, addResource, addState, updateChoice, updateElement } from '../narrative.js';
import { recordStep, startRun } from '../narrative-run.js';
import {
  branchReport,
  choiceReport,
  describeNarrativeExport,
  endingReport,
  findingsReport,
  narrativeExport,
  narrativeJson,
  narrativeReports,
  nodeReport,
  playthroughReport,
  reportToCsv,
  resourceReport,
  spineReport,
  weaponReport,
} from '../narrative-reports.js';
import { renderNarrativeReportHtml, suggestedNarrativeFileName } from '../print-narrative.js';
import type { Effect } from '../entities/narrative.js';
import type { ProjectFile } from '../project-file.js';

/**
 * Interactive Narrative, stage 9 (addendum 18 §17, §18).
 *
 * Two claims. **A report is a reading shaped into rows**, so cutting a choice
 * changes what it says with nothing run. And **the export is the records with
 * their own ids** (§21), so an adapter can say *this is the same node the
 * designer was looking at*.
 */

const game = (): ProjectFile => createProjectFile({ title: 'The Reactor', format: 'game' });

const effect = (one: Partial<Effect> & Pick<Effect, 'kind' | 'targetId'>): Effect => ({
  value: '',
  timing: 'immediate',
  note: '',
  ...one,
});

const reactor = () => {
  let file = game();
  const card = addResource(file, { name: 'Keycard', kind: 'key_item', initial: 0 });
  file = card.file;
  const trust = addState(file, { key: 'trust_mara', kind: 'number', initial: '0' });
  file = trust.file;

  const desk = addElement(file, { name: 'The desk' });
  file = desk.file;
  const door = addElement(file, { name: 'The server door' });
  file = door.file;
  const stays = addElement(file, { name: 'She stays' });
  file = updateElement(stays.file, stays.element.id, {
    kind: 'ending',
    contributors: [
      { condition: { subject: 'state', subjectId: trust.state.id as string, op: 'at_least', value: '40' }, weight: 20, note: '' },
    ],
    threshold: 20,
  });

  const take = addChoice(file, { elementId: desk.element.id, name: 'Take the keycard', toElementId: door.element.id });
  file = updateChoice(take.file, take.choice.id, {
    effects: [effect({ kind: 'grant', targetId: card.resource.id as string, value: '1' })],
  });
  file = addChoice(file, { elementId: door.element.id, name: 'Walk through', toElementId: stays.element.id }).file;

  return { file, take: take.choice.id, deskId: desk.element.id, cardId: card.resource.id };
};

describe('a report is a reading', () => {
  it('says what the rule builder says, because it is the same reading', () => {
    const made = reactor();
    const report = choiceReport(made.file);
    expect(report.rows[0]).toEqual([
      'The desk',
      'Take the keycard',
      'WHEN always → DO give 1 Keycard → GO TO The server door',
    ]);
  });

  /** Cut the effect and the report changes, with nothing run. */
  it('follows the graph rather than a stored copy', () => {
    const made = reactor();
    const edited = updateChoice(made.file, made.take, { effects: [] });
    expect(choiceReport(edited).rows[0]![2]).toBe('WHEN always → GO TO The server door');
  });

  it('says what is empty rather than drawing an empty table', () => {
    const report = choiceReport(game());
    expect(report.rows).toEqual([]);
    expect(report.emptyWord).toBe('No choices yet.');
  });

  it('reads the resources, the weapons, the endings and the errors', () => {
    const made = reactor();
    expect(resourceReport(made.file).rows[0]![0]).toBe('Keycard');
    expect(weaponReport(made.file).rows).toEqual([]);
    expect(endingReport(made.file).rows[0]).toEqual(['Needs a score of', '20']);
    expect(findingsReport(made.file).columns).toEqual(['Check', 'What it says']);
    expect(nodeReport(made.file).rows).toHaveLength(3);
    expect(branchReport(made.file).emptyWord).toContain('straight line');
  });

  it('reads the spine off the manuscript', () => {
    const made = reactor();
    const report = spineReport(made.file);
    // Nothing is bound to a beat in this fixture, so it says so.
    expect(report.rows).toEqual([]);
    expect(report.emptyWord).toContain('Nothing is bound to the manuscript');
  });

  it('replays a saved path into a row', () => {
    const made = reactor();
    const begun = startRun(made.file, { name: 'The honest route' })!;
    const file = recordStep(begun.file, begun.run.id, made.take).file;
    expect(playthroughReport(file).rows[0]).toEqual([
      'The honest route',
      'The desk',
      '1',
      '1 choice — stops at The server door.',
    ]);
  });
});

describe('the ten §18 asks for', () => {
  /**
   * Nine are readings that already existed; the tenth is **absent rather than
   * faked**, because there are no quests to report on.
   */
  it('offers nine, and no quest report', () => {
    const reports = narrativeReports(reactor().file);
    expect(reports.map((one) => one.id)).toEqual([
      'nodes',
      'choices',
      'spine',
      'branches',
      'resources',
      'weapons',
      'endings',
      'findings',
      'playthroughs',
    ]);
    expect(reports.some((one) => /quest/i.test(one.title))).toBe(false);
  });
});

describe('CSV', () => {
  it('quotes what a spreadsheet would otherwise misread', () => {
    const made = reactor();
    const csv = reportToCsv(choiceReport(made.file));
    expect(csv.split('\n')[0]).toBe('At,Choice,Rule');
    // The rule line has no comma here; one that did would be quoted.
    expect(reportToCsv({ ...choiceReport(made.file), rows: [['a,b', 'say "hi"', 'plain']] })).toContain(
      '"a,b","say ""hi""",plain',
    );
  });
});

describe('the export', () => {
  /** §21: nodes, relationships, conditions, effects, and **stable ids**. */
  it('is the records, with their own ids', () => {
    const made = reactor();
    const out = narrativeExport(made.file) as Record<string, any>;
    expect(out.format).toBe('vcwriter.narrative');
    expect(out.elements[0].id).toBe(made.deskId);
    expect(out.choices[0].id).toBe(made.take);
    expect(out.resources[0].id).toBe(made.cardId);
    // Conditions and effects travel as written.
    expect(out.choices[0].effects[0].kind).toBe('grant');
  });

  it('adds only what cannot be read without this program', () => {
    const made = reactor();
    const out = narrativeExport(made.file) as Record<string, any>;
    const desk = out.elements.find((one: any) => one.name === 'The desk');
    expect(desk.reachable).toBe(true);
    expect(desk.stepsFromStart).toBe(0);
    expect(out.elements.find((one: any) => one.name === 'She stays').isEnding).toBe(true);
  });

  it('is JSON a developer can parse', () => {
    const made = reactor();
    const parsed = JSON.parse(narrativeJson(made.file));
    expect(parsed.elements).toHaveLength(3);
    expect(describeNarrativeExport(made.file)).toBe('3 nodes · 2 choices · 2 states and resources, with their own ids.');
  });
});

describe('the printed report', () => {
  it('holds every report, and says what is empty', () => {
    const made = reactor();
    const html = renderNarrativeReportHtml(made.file, { includeTitlePage: false });
    expect(html).toContain('Narrative design report');
    expect(html).toContain('Choices and consequences');
    expect(html).toContain('Ending requirements');
    expect(html).toContain('Nothing branches and nothing converges');
    expect(suggestedNarrativeFileName(made.file)).toBe('The Reactor narrative design.pdf');
  });

  it('escapes what a designer typed', () => {
    let file = game();
    file = addElement(file, { name: '<script>alert(1)</script>' }).file;
    const html = renderNarrativeReportHtml(file, { includeTitlePage: false });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
