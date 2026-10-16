// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import {
  createProjectFile,
  paginateProject,
  setElementOverride,
  setScriptFormat,
  updateBeat,
  type ProjectFile,
  type ProjectFormat,
} from '@vcwriter/domain';
import { BeatBody } from '../components/BeatBody';
import { Paper } from '../components/Paper';

/**
 * **The cue centred on the writing screen** (addendum 40): the page and the
 * print centred a stage play's cue from addendum 37, and the screen a writer
 * writes on set it flush at its indent.
 */

afterEach(cleanup);

const el = (type: string, text: string) => ({
  id: crypto.randomUUID() as never,
  type: type as never,
  text,
  characterId: null,
  attributes: {},
});

const script = (format: ProjectFormat): ProjectFile => {
  const file = createProjectFile({ title: 'The Lamp', format });
  return updateBeat(file, file.beats[0]!.id, {
    manuscript: { elements: [el('scene_heading', 'Scene One'), el('character', 'Sarah'), el('dialogue', 'Well.')] },
  });
};

const rowClasses = (file: ProjectFile, type: string): string =>
  (render(<BeatBody file={file} beat={file.beats[0]!} onUpdate={() => undefined} />).container.querySelector(
    `.element-${type}`,
  ) as HTMLElement | null)?.className ?? '';

describe('the writing screen', () => {
  it('centres a stage play’s cue and heading, as the page does', () => {
    const play = setScriptFormat(script('stage_play'), 'stage_us_modern');
    expect(rowClasses(play, 'character')).toContain('centred');
    cleanup();
    expect(rowClasses(play, 'scene_heading')).toContain('centred');
    cleanup();
    expect(rowClasses(play, 'dialogue')).not.toContain('centred');
  });

  it('leaves a screenplay’s cue at its fixed column', () => {
    expect(rowClasses(script('screenplay'), 'character')).not.toContain('centred');
  });

  it('follows the writer’s own change in Customise', () => {
    const play = setElementOverride(setScriptFormat(script('stage_play'), 'stage_us_modern'), 'character', { centred: false });
    expect(rowClasses(play, 'character')).not.toContain('centred');
  });
});

describe('the preview’s pages', () => {
  it('centre a centred line in its own column', () => {
    const play = setScriptFormat(script('stage_play'), 'stage_us_modern');
    const { container } = render(<Paper pages={paginateProject(play)} />);
    const cue = container.querySelector('.paper-line.character') as HTMLElement;
    expect(cue.style.textAlign).toBe('center');
    expect(cue.style.width).toBe('60ch');
    const speech = container.querySelector('.paper-line.dialogue') as HTMLElement;
    expect(speech.style.textAlign).toBe('');
  });
});
