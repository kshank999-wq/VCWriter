import { choicesOf, elementsOf, resourcesOf, statesOf } from './narrative.js';
import { depths, reachable } from './narrative-eval.js';
import { narrativeFindings } from './narrative-check.js';
import { sayElementRule, sayRuleLine } from './narrative-rules.js';
import { describeEconomy, economyOf } from './narrative-economy.js';
import { describeCell, endingsOf, isScored, outcomeMatrix, unreachableEndings } from './narrative-endings.js';
import { describeRun, replayRun, runsOf } from './narrative-run.js';
import { isEnding } from './narrative-endings.js';
import { beatsInStoryOrder } from './selectors.js';
import type { ProjectFile } from './project-file.js';

/**
 * Interactive Narrative: export and reports (addendum 18, stage 9 — §17, §18).
 *
 * The audit an eighth time, and the cheapest of the nine stages because of it:
 * **nine of §18's ten reports are readings that already exist.** The choice and
 * consequence report is `sayRuleLine` per choice; the spine report is the story
 * order; branch and convergence is the map's `waysIn`/`waysOut`; resources are
 * stage 6's economy; weapons and ammunition are stage 3's check beside it;
 * relationships are the Character Creator's, built two modules ago; the ending
 * matrix is stage 8; errors are `narrativeFindings`; and a saved playthrough is
 * `replayRun`. Not one of them needed a new reading.
 *
 * So a report here is **a reading shaped into rows, and nothing else**. There
 * is no report table, no *generate* button and nothing cached: ask twice after
 * cutting a choice and the second answer is different. Which is also what makes
 * the export honest — §17's JSON is the same records the screens read, so a
 * developer consuming it outside VC Writer cannot be given something the
 * designer was never shown.
 *
 * The tenth report is **absent rather than faked**: §18 asks for a *quest
 * dependency report* and there are no quests. §7's table calls a Quest a small
 * state machine and says a setup-and-payoff is not close enough; until one
 * exists, a report about them would be an empty table implying a feature.
 */

// ---------------------------------------------------------------- the shape

export interface NarrativeReport {
  id: string;
  title: string;
  /** What the report is for, in a line. */
  note: string;
  columns: string[];
  rows: string[][];
  /** Said where there is nothing to report, instead of an empty table. */
  emptyWord: string;
}

const yes = (value: boolean): string => (value ? 'yes' : '');

// -------------------------------------------------------------- the reports

/** §18.1. Every choice, with what it needs, what it changes and where it goes. */
export const choiceReport = (file: ProjectFile): NarrativeReport => ({
  id: 'choices',
  title: 'Choices and consequences',
  note: 'Every choice in the game, as the rule builder reads it back.',
  columns: ['At', 'Choice', 'Rule'],
  rows: choicesOf(file).map((choice) => [
    elementsOf(file).find((one) => one.id === choice.elementId)?.name || 'an unnamed node',
    choice.name || choice.text || 'an unnamed choice',
    sayRuleLine(file, choice),
  ]),
  emptyWord: 'No choices yet.',
});

/**
 * §18.2. The critical path: the spine, and what the designer marked mandatory.
 *
 * The spine is the manuscript (§3), so this is the story order with the graph
 * read against it — not a second list somebody has to keep in step.
 */
export const spineReport = (file: ProjectFile): NarrativeReport => {
  const beats = beatsInStoryOrder(file);
  const at = new Map(beats.map((beat, index) => [beat.id as string, index + 1]));
  const bound = elementsOf(file)
    .filter((one) => one.boundBeatId && at.has(one.boundBeatId as string))
    .sort((a, b) => at.get(a.boundBeatId as string)! - at.get(b.boundBeatId as string)!);
  const mandatory = elementsOf(file).filter((one) => one.mandatory && !bound.includes(one));

  return {
    id: 'spine',
    title: 'Critical path',
    note: 'What the manuscript puts on the spine, in its order, and anything else marked mandatory.',
    columns: ['#', 'Node', 'Kind', 'Mandatory'],
    rows: [
      ...bound.map((one, index) => [
        String(index + 1),
        one.name || 'an unnamed node',
        one.kind,
        yes(one.mandatory),
      ]),
      ...mandatory.map((one) => ['—', one.name || 'an unnamed node', one.kind, 'yes']),
    ],
    emptyWord: 'Nothing is bound to the manuscript and nothing is marked mandatory.',
  };
};

/** §18.3. Where the story branches and where it comes back together. */
export const branchReport = (file: ProjectFile): NarrativeReport => {
  const rank = depths(file);
  return {
    id: 'branches',
    title: 'Branches and convergence',
    note: 'Nodes that open more than one way, and nodes that more than one way arrives at.',
    columns: ['Node', 'Ways in', 'Ways on', 'Steps from a start'],
    rows: elementsOf(file)
      .map((one) => ({
        element: one,
        waysIn: choicesOf(file).filter((choice) => choice.toElementId === one.id).length,
        waysOut: choicesOf(file).filter((choice) => choice.elementId === one.id && choice.toElementId).length,
      }))
      .filter((one) => one.waysIn > 1 || one.waysOut > 1)
      .map((one) => [
        one.element.name || 'an unnamed node',
        String(one.waysIn),
        String(one.waysOut),
        String(rank.get(one.element.id as string) ?? '—'),
      ]),
    emptyWord: 'Nothing branches and nothing converges: this is a straight line.',
  };
};

/** §18.5 and §18.6, which are one reading of the economy either way. */
export const resourceReport = (file: ProjectFile): NarrativeReport => ({
  id: 'resources',
  title: 'Resources',
  note: 'Where each one comes from, where it goes, and what needs it — read off the graph.',
  columns: ['Resource', 'Kind', 'Tier', 'Starts with', 'Sources', 'Sinks', 'Asked about', 'Reading'],
  rows: economyOf(file).map((economy) => [
    economy.resource.name || 'an unnamed resource',
    economy.resource.kind,
    economy.resource.tier > 0 ? String(economy.resource.tier) : '—',
    String(economy.resource.initial),
    String(economy.sources.length),
    String(economy.sinks.length),
    String(economy.gates.length),
    describeEconomy(economy),
  ]),
  emptyWord: 'No resources defined.',
});

/** §18.6's own half: a weapon and what feeds it. */
export const weaponReport = (file: ProjectFile): NarrativeReport => ({
  id: 'weapons',
  title: 'Weapons and ammunition',
  note: 'Every weapon, what feeds it, and whether the player is ever given any.',
  columns: ['Weapon', 'Ammunition', 'Ever granted', 'Starts with'],
  rows: economyOf(file)
    .filter((one) => one.resource.kind === 'weapon')
    .map((weapon) => {
      const feeds = weapon.feeds;
      const given = feeds.some((one) => (resourceEconomyOf(file, one.id as string)?.sources.length ?? 0) > 0);
      return [
        weapon.resource.name || 'an unnamed weapon',
        feeds.map((one) => one.name || 'an unnamed resource').join(', ') || 'none',
        feeds.length === 0 ? '—' : yes(given),
        feeds.map((one) => String(one.initial)).join(', ') || '—',
      ];
    }),
  emptyWord: 'No weapons defined.',
});

/** A small helper so the weapon report can ask about its ammunition by id. */
const resourceEconomyOf = (file: ProjectFile, resourceId: string) =>
  economyOf(file).find((one) => (one.resource.id as string) === resourceId) ?? null;

/** §18.8. The matrix, flattened into rows — the same reading the screen draws. */
export const endingReport = (file: ProjectFile): NarrativeReport => {
  const matrix = outcomeMatrix(file);
  return {
    id: 'endings',
    title: 'Ending requirements',
    note: 'What decides each ending: a requirement it cannot happen without, or a weight that counts towards it.',
    columns: ['What decides it', ...matrix.endings.map((one) => one.name || 'an unnamed ending')],
    rows: [
      [
        'Needs a score of',
        ...matrix.endings.map((one) => (isScored(one) ? String(one.threshold) : 'not scored')),
      ],
      ...matrix.rows.map((row) => [row.subject, ...row.cells.map((cell) => describeCell(file, cell))]),
    ],
    emptyWord: 'No endings yet.',
  };
};

/** §18.9. Stage 3, in a table. */
export const findingsReport = (file: ProjectFile): NarrativeReport => ({
  id: 'findings',
  title: 'Errors and dead ends',
  note: 'Every check, read from the graph as it stands. Nothing here is stored.',
  columns: ['Check', 'What it says'],
  rows: [
    ...narrativeFindings(file).map((one) => [one.check, one.says]),
    ...unreachableEndings(file).map((one) => ['ending_unearnable', one.says]),
  ],
  emptyWord: 'Nothing to report.',
});

/** §18.10. The saved paths, replayed against the graph as it stands now. */
export const playthroughReport = (file: ProjectFile): NarrativeReport => ({
  id: 'playthroughs',
  title: 'Saved playthroughs',
  note: 'Each kept path, walked again against the game as it is now.',
  columns: ['Path', 'Started at', 'Choices', 'Reading'],
  rows: runsOf(file).map((run) => {
    const played = replayRun(file, run);
    return [
      run.name || 'an unnamed path',
      elementsOf(file).find((one) => one.id === run.startedAt)?.name || 'a node that has gone',
      String(run.steps.length),
      describeRun(file, run),
    ];
  }),
  emptyWord: 'No paths kept yet.',
});

/** Everything a node's own rules say — the inspector, as a table. */
export const nodeReport = (file: ProjectFile): NarrativeReport => {
  const found = reachable(file);
  return {
    id: 'nodes',
    title: 'Nodes',
    note: 'Every node, what lets the player be there, and what arriving changes.',
    columns: ['Node', 'Kind', 'Scene', 'Reachable', 'Being here', 'On arrival'],
    rows: elementsOf(file).map((one) => {
      const rule = sayElementRule(file, one);
      return [
        one.name || 'an unnamed node',
        isEnding(one) ? 'ending' : one.kind,
        one.boundBeatId ? 'bound' : '—',
        yes(found.has(one.id as string)),
        rule.when,
        rule.onArrival || '—',
      ];
    }),
    emptyWord: 'No nodes yet.',
  };
};

/**
 * Every report §18 asks for that this project can honestly answer.
 *
 * The **quest dependency report is absent**, because there are no quests: §7
 * calls a Quest a small state machine and says a setup-and-payoff is not close
 * enough, so a report about them would be an empty table implying a feature
 * that is not there. Absent rather than greyed, the same rule as everywhere
 * else. §18's *character and faction relationship* report is likewise not here,
 * and for the opposite reason — it is the **Character Creator's**, built two
 * modules ago, and a second copy of it under a different menu would be a second
 * answer about the same relationships.
 */
export const narrativeReports = (file: ProjectFile): NarrativeReport[] => [
  nodeReport(file),
  choiceReport(file),
  spineReport(file),
  branchReport(file),
  resourceReport(file),
  weaponReport(file),
  endingReport(file),
  findingsReport(file),
  playthroughReport(file),
];

// ------------------------------------------------------------------- export

/** A field, quoted the way a spreadsheet expects. */
const csvField = (value: string): string =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export const reportToCsv = (report: NarrativeReport): string =>
  [report.columns, ...report.rows].map((row) => row.map(csvField).join(',')).join('\n');

/**
 * §17's structured export: the design, engine-agnostic.
 *
 * It is **the records themselves, with their own ids** (§21's *preserves nodes,
 * relationships, conditions, effects, and stable IDs*) rather than a flattened
 * convenience shape — because an adapter targeting Unreal or Godot has to be
 * able to say *this is the same node the designer was looking at*, and a shape
 * invented for the export would be a second vocabulary to keep in step.
 *
 * What it adds to the records is only what cannot be read without this
 * program: which nodes are reachable and how far along they sit. Both are
 * computed here rather than stored, so the export cannot disagree with the
 * screen.
 */
export const narrativeExport = (file: ProjectFile): Record<string, unknown> => {
  const found = reachable(file);
  const rank = depths(file);
  return {
    format: 'vcwriter.narrative',
    version: 1,
    project: { id: file.project.id, title: file.project.title, logline: file.project.logline },
    setup: file.gameSetup ?? null,
    states: statesOf(file),
    resources: resourcesOf(file),
    elements: elementsOf(file).map((one) => ({
      ...one,
      // Readings, marked as such: an adapter should not have to walk the graph
      // to find out what this program already knows.
      reachable: found.has(one.id as string),
      stepsFromStart: rank.get(one.id as string) ?? null,
      isEnding: isEnding(one),
    })),
    choices: choicesOf(file),
    endings: endingsOf(file).map((one) => ({
      id: one.id,
      name: one.name,
      scored: isScored(one),
      threshold: one.threshold,
      requires: one.conditions,
      contributors: one.contributors,
    })),
    playthroughs: runsOf(file),
  };
};

export const narrativeJson = (file: ProjectFile): string => JSON.stringify(narrativeExport(file), null, 2);

/**
 * What the export holds, for the line above the button.
 *
 * Named for the narrative rather than plainly, because `describeExport` is
 * already the short-form module's — the third name this module has had to step
 * around, and the same reason as `Test` and `Situation`.
 */
export const describeNarrativeExport = (file: ProjectFile): string => {
  const carried = statesOf(file).length + resourcesOf(file).length;
  const parts = [
    `${elementsOf(file).length} node${elementsOf(file).length === 1 ? '' : 's'}`,
    `${choicesOf(file).length} choice${choicesOf(file).length === 1 ? '' : 's'}`,
    // "1 state and resources" is what the obvious plural gives, and it is the
    // kind of thing only reading the real output catches.
    `${carried} ${carried === 1 ? 'state or resource' : 'states and resources'}`,
  ];
  return `${parts.join(' · ')}, with their own ids.`;
};
