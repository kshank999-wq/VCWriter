import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { addBeat, addCharacter, addSetupPayoff, addSetupPoint, addUnit, updateBeat } from '../mutations.js';
import { applyFinding, runDailyEditor, summariseFindings } from '../editor-daily.js';
import { runFinalEditor, sceneTextForReview, type SceneVerdict } from '../editor-final.js';
import { newId } from '../ids.js';
import type { ManuscriptElement, ManuscriptElementType } from '../entities/manuscript.js';
import type { ManuscriptElementId } from '../ids.js';
import type { ProjectFile } from '../project-file.js';

const element = (type: ManuscriptElementType, text: string): ManuscriptElement => ({
  id: newId<ManuscriptElementId>(),
  type,
  text,
  characterId: null,
  attributes: {},
});

const withScene = (elements: ManuscriptElement[]): ProjectFile => {
  const file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
  return updateBeat(file, file.beats[0]!.id, { manuscript: { elements }, status: 'written' });
};

const kinds = (file: ProjectFile) => runDailyEditor(file).map((finding) => finding.kind);

describe('daily editor mechanics', () => {
  it('finds a doubled word and offers the fix', () => {
    const file = withScene([element('action', 'She opens the the door.')]);
    const findings = runDailyEditor(file);
    const repeated = findings.find((finding) => finding.kind === 'repeated_word');

    expect(repeated?.severity).toBe('error');
    expect(repeated?.excerpt).toBe('the the');
    expect(applyFinding(file, repeated!).beats[0]?.manuscript.elements[0]?.text).toBe('She opens the door.');
  });

  it('leaves legitimate repeats alone', () => {
    expect(kinds(withScene([element('action', 'She had had enough.')]))).not.toContain('repeated_word');
  });

  it('finds doubled spaces and trailing whitespace, and fixes them', () => {
    const file = withScene([element('action', 'Rain  hammers the glass.   ')]);
    const findings = runDailyEditor(file);

    expect(findings.map((finding) => finding.kind)).toContain('double_space');
    expect(findings.map((finding) => finding.kind)).toContain('trailing_space');

    const fixed = applyFinding(file, findings.find((finding) => finding.kind === 'trailing_space')!);
    expect(fixed.beats[0]?.manuscript.elements[0]?.text).toBe('Rain  hammers the glass.');
  });

  it('flags brackets that do not close', () => {
    expect(kinds(withScene([element('action', 'She looks at him (for a long time.')]))).toContain(
      'unbalanced_bracket',
    );
  });

  it('says nothing about clean text', () => {
    const file = withScene([element('action', 'Rain hammers the glass. She turns away.')]);
    expect(runDailyEditor(file)).toHaveLength(0);
  });
});

describe('daily editor style', () => {
  it('separates opinions from errors', () => {
    const file = withScene([
      element('action', 'She opens the the door.'),
      element('action', 'He begins to walk slowly, carefully, quietly towards the light.'),
    ]);

    const summary = summariseFindings(runDailyEditor(file));
    expect(summary.errors).toBe(1);
    expect(summary.style).toBeGreaterThan(0);
    // Only the unambiguous fix is offered as one-click.
    expect(summary.fixable).toBe(1);
  });

  it('can be run without style checks at all', () => {
    const file = withScene([element('action', 'He begins to walk slowly, carefully, quietly on.')]);
    expect(runDailyEditor(file, { includeStyle: false })).toHaveLength(0);
  });

  it('flags passive constructions, hedged action and camera directions', () => {
    const found = kinds(
      withScene([
        element('action', 'The door was opened by someone unseen.'),
        element('action', 'He starts to run.'),
        element('action', 'We see the lamp turn.'),
      ]),
    );

    expect(found).toContain('passive_voice');
    expect(found).toContain('hedged_action');
    expect(found).toContain('camera_direction');
  });

  it('flags a long sentence at the configured threshold', () => {
    const long = `${'word '.repeat(40)}ends here.`;
    expect(kinds(withScene([element('action', long)]))).toContain('long_sentence');
    expect(
      runDailyEditor(withScene([element('action', long)]), { longSentenceWords: 100 }).map((f) => f.kind),
    ).not.toContain('long_sentence');
  });

  it('flags a character cue that is not in the cast, because read-back needs one', () => {
    let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    file = addCharacter(file, { name: 'Marisol' });
    file = updateBeat(file, file.beats[0]!.id, {
      manuscript: {
        elements: [element('character', 'MARISOL'), element('character', 'THE STRANGER')],
      },
    });

    const cues = runDailyEditor(file).filter((finding) => finding.kind === 'unknown_character_cue');
    expect(cues).toHaveLength(1);
    expect(cues[0]?.message).toContain('THE STRANGER');
  });

  it('can be scoped to one beat', () => {
    let file = withScene([element('action', 'She opens the the door.')]);
    const second = addBeat(file, { unitId: file.units[0]!.id });
    file = updateBeat(second.file, second.beat.id, {
      manuscript: { elements: [element('action', 'He he waits.')] },
    });

    expect(runDailyEditor(file)).toHaveLength(2);
    expect(runDailyEditor(file, { beatId: second.beat.id })).toHaveLength(1);
  });
});

describe('final editor', () => {
  const twoScenes = (): ProjectFile => {
    let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    file = updateBeat(file, file.beats[0]!.id, {
      status: 'written',
      manuscript: {
        elements: [
          element('scene_heading', 'INT. LIGHTHOUSE - NIGHT'),
          element('action', 'Rain hammers the glass.'),
          element('character', 'MARISOL'),
          element('dialogue', 'You should not have come back.'),
        ],
      },
    });
    const created = addUnit(file, { laneId: file.lanes[0]!.id, title: 'The gallery' });
    file = created.file;
    const beat = addBeat(file, { unitId: created.unit.id });
    file = updateBeat(beat.file, beat.beat.id, {
      status: 'written',
      manuscript: {
        elements: [
          element('scene_heading', 'INT. LIGHTHOUSE - LATER'),
          element('action', 'The lamp turns.'),
        ],
      },
    });
    return file;
  };

  it('reports each scene with its real page geometry and cast', () => {
    const report = runFinalEditor(twoScenes());

    expect(report.scenes).toHaveLength(2);
    expect(report.scenes[0]?.speakers).toEqual(['MARISOL']);
    expect(report.scenes[0]?.location).toBe('LIGHTHOUSE');
    expect(report.scenes[0]?.dialogueLines).toBe(1);
    expect(report.totals.scenes).toBe(2);
  });

  it('notices two consecutive scenes in the same place', () => {
    const report = runFinalEditor(twoScenes());
    expect(report.findings.map((finding) => finding.kind)).toContain('repeated_location');
  });

  it('flags an empty scene as blocking', () => {
    const file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    const report = runFinalEditor(file);
    const empty = report.findings.find((finding) => finding.kind === 'empty_scene');

    expect(empty?.severity).toBe('blocking');
  });

  it('raises unresolved setups as obligations still owed', () => {
    let file = twoScenes();
    file = addSetupPayoff(file, { title: 'The revolver' });
    file = addSetupPoint(file, {
      setupPayoffId: file.setupsPayoffs[0]!.id,
      description: 'Drawer opens in act one',
      strength: 'written',
    });

    const finding = runFinalEditor(file).findings.find((entry) => entry.kind === 'unresolved_setup');
    expect(finding?.severity).toBe('blocking');
    expect(finding?.message).toContain('The revolver');
  });

  it('does not invent a verdict on whether a scene turns', () => {
    const report = runFinalEditor(twoScenes());
    expect(report.scenes.every((scene) => scene.aiVerdict === null)).toBe(true);
    expect(report.findings.map((finding) => finding.kind)).not.toContain('no_turn');
    expect(report.totals.reviewed).toBe(0);
  });

  it('uses an AI verdict when one has been supplied', () => {
    const file = twoScenes();
    const unitId = file.units[0]!.id;
    const verdict: SceneVerdict = {
      opening: 'She is alone.',
      change: 'Nothing changes.',
      turn: null,
      valueShift: 'none',
      purpose: 'Atmosphere only.',
      concerns: [],
      model: 'test',
    };

    const report = runFinalEditor(file, { verdicts: { [unitId]: verdict } });

    expect(report.totals.reviewed).toBe(1);
    expect(report.findings.some((finding) => finding.kind === 'no_turn')).toBe(true);
    expect(report.scenes[0]?.aiVerdict?.purpose).toBe('Atmosphere only.');
  });

  it('sends only the scene text for review, not the surrounding project', () => {
    const file = twoScenes();
    const text = sceneTextForReview(file, file.units[0]!.id);

    expect(text).toContain('You should not have come back.');
    expect(text).not.toContain('The lamp turns.');
    expect(text).not.toContain('Lighthouse project');
  });
});
