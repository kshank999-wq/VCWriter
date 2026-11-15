// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { addBeat, avSheet, createProjectFile, updateBeat, type ProjectFile } from '@vcwriter/domain';
import { ShotPicker } from '../components/ShotPicker';
import { Inspector } from '../components/Inspector';
import { SegmentDialog } from '../components/ShotFields';
import { SHOT_TYPES } from '@vcwriter/domain';

/**
 * Short form's shots, as shots (from Ken, 15 November): a shot type and a
 * camera move that finish themselves as they are typed, a description, and
 * no screenplay furniture — no slugline, no track, no setups and payoffs.
 */

afterEach(cleanup);

const spot = (): ProjectFile => {
  let file = createProjectFile({ title: 'Spot', format: 'short_form' });
  file = updateBeat(file, file.beats[0]!.id, {
    manuscript: { elements: [{ id: 'e1' as never, type: 'action', text: 'SFX: Gulls.', characterId: null, attributes: {} }] },
    visual: 'Dawn on the harbour.',
  });
  return addBeat(file, { unitId: file.units[0]!.id, title: 'Two' }).file;
};

function Picker() {
  const [value, setValue] = useState('');
  return <ShotPicker label="Shot type" placeholder="Shot type" value={value} list={SHOT_TYPES} onChange={setValue} />;
}

function Stateful({ initial, render: draw }: { initial: ProjectFile; render(file: ProjectFile, update: (m: (f: ProjectFile) => ProjectFile) => void): React.ReactNode }) {
  const [file, setFile] = useState(initial);
  return <>{draw(file, (mutate) => setFile((current) => mutate(current)))}</>;
}

describe('the shot type box', () => {
  it('fills in the shot from its first letter, and offers the others', () => {
    render(<Picker />);
    const box = screen.getByRole('combobox', { name: 'Shot type' }) as HTMLInputElement;
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: 'c' } });
    expect(box.value).toBe('Cowboy shot');
    expect(screen.getByRole('option', { name: 'Close-up' })).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Close-up' }));
    expect(box.value).toBe('Close-up');
  });
});

describe('a short-form shot in the Inspector and the segment pop-up', () => {
  it('shows the shot’s type, move, description and audio, and no track or setups', () => {
    const file = spot();
    render(<Stateful initial={file} render={(current, update) => <Inspector file={current} selectedBeatId={current.beats[0]!.id} onUpdate={update} />} />);
    expect(screen.getByRole('heading', { name: 'Shot 1.1' })).toBeTruthy();
    expect(screen.queryByText(/^Track$/)).toBeNull();
    expect(screen.queryByText(/Setups/)).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Camera move of shot 1.1' }), { target: { value: 'Push in' } });
    expect((screen.getByRole('combobox', { name: 'Camera move of shot 1.1' }) as HTMLInputElement).value).toBe('Push in');
    expect((screen.getByLabelText('Description of shot 1.1') as HTMLTextAreaElement).value).toBe('Dawn on the harbour.');
  });

  it('lists every shot of the segment, and never writes a scene heading into the audio', () => {
    const file = spot();
    let latest = file;
    render(
      <Stateful
        initial={file}
        render={(current, update) => {
          latest = current;
          return <SegmentDialog file={current} unitId={current.units[0]!.id} onClose={() => undefined} onUpdate={update} />;
        }}
      />,
    );
    expect(screen.getByText('Shot 1.1')).toBeTruthy();
    expect(screen.getByText('Shot 1.2')).toBeTruthy();
    expect(screen.queryByText(/INT|EXT|Setups|Main Plot/)).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Shot type of shot 1.2' }), { target: { value: 'Wide shot' } });
    const rows = avSheet(latest).segments[0]!.rows;
    expect(rows[1]!.shotType).toBe('Wide shot');
    expect(rows[0]!.audio).toBe('SFX: Gulls.');
  });
});
