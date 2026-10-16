// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createProjectFile, hasFormatOverrides, layoutForFile, setScriptFormat, type ProjectFile } from '@vcwriter/domain';
import { FormatInspector } from '../components/FormatInspector';

/**
 * **Custom templates, where a writer can reach them** (addendum 39): the
 * override inspector, Restore defaults, and a template saved on one play and
 * applied to the next.
 */

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const play = (): ProjectFile =>
  setScriptFormat(createProjectFile({ title: 'The Lamp', format: 'stage_play' }), 'stage_us_modern');

function Harness({ start, onFile }: { start: ProjectFile; onFile(file: ProjectFile): void }) {
  const [file, setFile] = useState(start);
  onFile(file);
  return <FormatInspector file={file} open onClose={() => undefined} onUpdate={(mutate) => setFile(mutate)} />;
}

describe('the inspector', () => {
  it('changes one element at once, says so, and restores the preset', () => {
    let latest = play();
    render(<Harness start={latest} onFile={(file) => (latest = file)} />);
    fireEvent.change(screen.getByLabelText('Stage direction / action indent'), { target: { value: '20' } });
    expect(layoutForFile(latest).indent['action']).toBe(20);
    expect(document.querySelector('tr.changed th')?.textContent).toBe('Stage direction / action');

    // A cleared box is not a request for column 0.
    fireEvent.change(screen.getByLabelText('Dialogue width'), { target: { value: '' } });
    expect(layoutForFile(latest).width['dialogue']).toBe(60);

    fireEvent.click(screen.getByText('Restore defaults'));
    expect(hasFormatOverrides(latest)).toBe(false);
  });

  it('saves a template on one play and applies it to another', () => {
    let first = play();
    render(<Harness start={first} onFile={(file) => (first = file)} />);
    fireEvent.click(screen.getByLabelText('Character cue centred'));
    fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'Lyric house' } });
    fireEvent.click(screen.getByText('Save template'));
    expect(first.settings.formatOverrides.templateName).toBe('Lyric house');
    cleanup();

    let second = play();
    render(<Harness start={second} onFile={(file) => (second = file)} />);
    expect(screen.getByLabelText('Your templates').textContent).toContain('Lyric house');
    fireEvent.click(screen.getByText('Apply'));
    expect(layoutForFile(second).centred?.has('character')).toBe(false);
    expect(second.settings.formatOverrides.templateName).toBe('Lyric house');
  });
});
