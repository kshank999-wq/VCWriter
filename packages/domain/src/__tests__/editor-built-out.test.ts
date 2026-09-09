import { describe, expect, it } from 'vitest';
import {
  allowWord,
  applyFindings,
  createProjectFile,
  groupFindings,
  runDailyEditor,
  setEditorRule,
  updateBeat,
  type EditorFinding,
  type ProjectFile,
} from '../index.js';

/**
 * The Daily Editor, built out (spec §8.1): punctuation, spelling as far as it
 * can honestly be told, and the mistakes that are only mistakes because of
 * where a line sits.
 */

const el = (type: string, text: string) => ({
  id: crypto.randomUUID() as never,
  type: type as never,
  text,
  characterId: null,
  attributes: {},
});

const script = (...elements: ReturnType<typeof el>[]): ProjectFile => {
  const file = createProjectFile({ title: 'The Lighthouse', format: 'screenplay' });
  return updateBeat(file, file.beats[0]!.id, { manuscript: { elements } });
};

const kinds = (file: ProjectFile, options = {}) =>
  runDailyEditor(file, options).map((finding) => finding.kind);

const only = (file: ProjectFile, kind: string): EditorFinding[] =>
  runDailyEditor(file).filter((finding) => finding.kind === kind);

describe('punctuation', () => {
  it('finds a space before punctuation and offers the fix', () => {
    const file = script(el('action', 'She climbs , slowly .'));
    const found = only(file, 'space_before_punctuation');
    expect(found).toHaveLength(2);
    expect(applyFindings(file, found).beats[0]?.manuscript.elements[0]?.text).toBe('She climbs, slowly.');
  });

  it('finds doubled punctuation, and leaves an ellipsis alone', () => {
    const file = script(el('action', 'Wait,, what?? She stops... and waits..'));
    const found = only(file, 'doubled_punctuation');
    // The comma, the question marks and the two-dot stop — not the ellipsis.
    expect(found.map((finding) => finding.excerpt)).toEqual([',,', '??', '..']);
    expect(applyFindings(file, found).beats[0]?.manuscript.elements[0]?.text).toBe(
      'Wait, what? She stops... and waits…',
    );
  });

  it('finds a straight quote only where the manuscript is otherwise curly', () => {
    // Curly by weight of use, so the straight one stands out.
    const curly = script(el('action', '“Yes,” she said. “Quite.” “Really.” "No."'));
    expect(kinds(curly)).toContain('straight_quote');

    // A manuscript typed with straight quotes throughout is a choice.
    const straight = script(el('action', '"Yes," she said. "Quite."'));
    expect(kinds(straight)).not.toContain('straight_quote');
  });

  it('finds a hyphen doing a dash’s job, and leaves a slugline’s alone', () => {
    const file = script(
      el('scene_heading', 'INT. SANCHEZ HOME - KITCHEN - MORNING'),
      el('action', 'She waited - and waited.'),
    );
    const found = only(file, 'spaced_hyphen');
    expect(found).toHaveLength(1);
    expect(applyFindings(file, found).beats[0]?.manuscript.elements[1]?.text).toBe('She waited—and waited.');
  });
});

describe('spelling, as far as it can be told', () => {
  it('finds the misspellings a keyboard actually makes', () => {
    const file = script(el('action', 'She definately recieved teh letter.'));
    const found = only(file, 'misspelling');
    expect(found).toHaveLength(3);
    expect(applyFindings(file, found).beats[0]?.manuscript.elements[0]?.text).toBe(
      'She definitely received the letter.',
    );
  });

  it('knows “could of” is always “could have”', () => {
    const file = script(el('action', 'She could of gone. He should of known.'));
    const found = only(file, 'modal_of');
    expect(found).toHaveLength(2);
    expect(applyFindings(file, found).beats[0]?.manuscript.elements[0]?.text).toBe(
      'She could have gone. He should have known.',
    );
  });

  it('flags a word used once that is one keystroke from one used often', () => {
    const file = script(
      el('action', 'The lantern is lit. The lantern is out. The lantern is lit again.'),
      el('action', 'She checks the lantren.'),
    );
    const found = only(file, 'likely_typo');
    expect(found).toHaveLength(1);
    expect(found[0]?.excerpt).toBe('lantren');
    expect(found[0]?.replacement).toBe('lantern');
  });

  it('does not call an inflection or a rare-but-real word a typo', () => {
    const file = script(
      el('action', 'The stair is dark. The stair is cold. The stair is long.'),
      // A plural is not a typo, and a word nothing resembles is not either.
      el('action', 'She climbs the stairs past the bathysphere.'),
    );
    expect(kinds(file)).not.toContain('likely_typo');
  });

  it('never calls a character’s name a typo', () => {
    let file = script(
      el('action', 'The lantern is lit. The lantern is out. The lantern is lit.'),
      el('character', 'LANTREN'),
      el('dialogue', 'Again.'),
    );
    file = { ...file, characters: [{ ...(file.characters[0] ?? {}) } as never] };
    const named = runDailyEditor({
      ...file,
      characters: [
        {
          id: 'c1' as never,
          projectId: file.project.id,
          name: 'LANTREN',
          aliases: [],
          description: '',
          arcNotes: '',
          researchItemId: null,
          categoryId: null,
          voice: null,
          archived: false,
          createdAt: file.project.createdAt,
          updatedAt: file.project.updatedAt,
        },
      ],
    });
    expect(named.map((finding) => finding.kind)).not.toContain('likely_typo');
  });
});

describe('what a screenplay’s shape asks for', () => {
  it('finds a speech with nobody speaking it', () => {
    expect(kinds(script(el('action', 'Rain.'), el('dialogue', 'Not tonight.')))).toContain('orphan_dialogue');
    expect(
      kinds(script(el('character', 'MAEVE'), el('dialogue', 'Not tonight.'))),
    ).not.toContain('orphan_dialogue');
  });

  it('finds a cue with nothing under it', () => {
    expect(kinds(script(el('character', 'MAEVE'), el('action', 'She leaves.')))).toContain('cue_without_speech');
  });

  it('finds a slugline that does not say when', () => {
    expect(kinds(script(el('scene_heading', 'INT. LIGHTHOUSE')))).toContain('slug_without_time');
    expect(kinds(script(el('scene_heading', 'INT. LIGHTHOUSE - NIGHT')))).not.toContain('slug_without_time');
    // A secondary slug is a different thing and is left alone.
    expect(kinds(script(el('scene_heading', 'LATER')))).not.toContain('slug_without_time');
  });

  it('finds a parenthetical doing action’s work, and a wall of action', () => {
    const long = 'She turns away from him and looks out at the water for a long moment before answering';
    expect(kinds(script(el('character', 'MAEVE'), el('parenthetical', `(${long})`), el('dialogue', 'No.')))).toContain(
      'long_parenthetical',
    );

    const wall = Array.from({ length: 80 }, (_, index) => `word${index}`).join(' ');
    expect(kinds(script(el('action', wall)))).toContain('wall_of_action');
  });
});

describe('saying “that is not a mistake”', () => {
  it('switches a rule off for the project, and back on', () => {
    let file = script(el('action', 'She climbs , slowly.'));
    expect(kinds(file)).toContain('space_before_punctuation');

    file = setEditorRule(file, 'space_before_punctuation', false);
    expect(kinds(file)).not.toContain('space_before_punctuation');
    expect(file.settings.editorIgnoredRules).toContain('space_before_punctuation');

    file = setEditorRule(file, 'space_before_punctuation', true);
    expect(kinds(file)).toContain('space_before_punctuation');
  });

  it('takes a word’s word for it, once', () => {
    let file = script(
      el('action', 'The lantern is lit. The lantern is out. The lantern is lit.'),
      el('action', 'She checks the lantren.'),
    );
    expect(kinds(file)).toContain('likely_typo');

    file = allowWord(file, 'Lantren');
    expect(kinds(file)).not.toContain('likely_typo');
    // Saying it twice does not say it twice.
    expect(allowWord(file, 'lantren').settings.editorAllowedWords).toEqual(['lantren']);
  });
});

describe('working through them', () => {
  it('groups by rule, errors first and the commonest first inside', () => {
    const file = script(el('action', 'She climbs , slowly . She could of stayed.'));
    const groups = groupFindings(runDailyEditor(file));

    expect(groups[0]?.severity).toBe('error');
    expect(groups.map((group) => group.kind)).toContain('space_before_punctuation');
    const spaces = groups.find((group) => group.kind === 'space_before_punctuation')!;
    expect(spaces.findings).toHaveLength(2);
    expect(spaces.fixable).toBe(2);
    expect(spaces.label).toBe('A space before punctuation');
  });

  it('fixes every one of a kind at once, back to front so the offsets hold', () => {
    const file = script(el('action', 'She climbs , slowly , then stops , breathing .'));
    const found = only(file, 'space_before_punctuation');
    expect(found).toHaveLength(4);
    expect(applyFindings(file, found).beats[0]?.manuscript.elements[0]?.text).toBe(
      'She climbs, slowly, then stops, breathing.',
    );
  });

  it('applies nothing for findings that are only opinions', () => {
    const wall = Array.from({ length: 80 }, (_, index) => `word${index}`).join(' ');
    const file = script(el('action', wall));
    const found = only(file, 'wall_of_action');
    expect(found).toHaveLength(1);
    // An opinion carries no replacement, so there is nothing to apply.
    expect(applyFindings(file, found)).toBe(file);
  });
});
