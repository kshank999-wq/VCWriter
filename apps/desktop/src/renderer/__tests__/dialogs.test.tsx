// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addSetupPayoff,
  addSetupPoint,
  createProjectFile,
  manuscriptElements,
  ref,
  updateBeat,
  type BeatId,
  type ProjectFile,
  type StructuralUnitId,
} from '@vcwriter/domain';
import { SceneDialog } from '../components/SceneDialog';
import { BeatDialog } from '../components/BeatDialog';
import { MasterTimeline } from '../components/MasterTimeline';
import { StoryView } from '../components/StoryView';

/**
 * The scene and beat pop-ups (addendum 02 §4), and how they open.
 */

afterEach(cleanup);

const el = (type: 'scene_heading' | 'action' | 'character' | 'dialogue', text: string) => ({
  id: crypto.randomUUID() as never,
  type,
  text,
  characterId: null,
  attributes: {},
});

/** One scene, one beat: Mike speaks; an envelope is set up in the beat. */
const scene = (format: 'screenplay' | 'novel' = 'screenplay') => {
  let file = createProjectFile({ title: 'Faith', format });
  const beat = file.beats[0]!;
  file = updateBeat(file, beat.id, {
    title: 'Home life',
    manuscript: { elements: [el('scene_heading', 'INT. KITCHEN - MORNING'), el('character', 'MIKE'), el('dialogue', 'Morning.')] },
  });
  file = addSetupPayoff(file, { title: 'The envelope' });
  file = addSetupPoint(file, { setupPayoffId: file.setupsPayoffs[0]!.id, description: 'On the counter', location: ref('beat', beat.id) });
  return file;
};

function Harness({
  initial,
  children,
}: {
  initial: ProjectFile;
  children: (file: ProjectFile, update: (mutate: (current: ProjectFile) => ProjectFile) => void) => React.ReactNode;
}) {
  const [file, setFile] = useState(initial);
  return <>{children(file, (mutate) => setFile((current) => mutate(current)))}</>;
}

describe('scene pop-up', () => {
  it('names the scene top centre, reads the slugline, lists the cast and the promises, and switches the scene off', () => {
    let latest = scene();
    const unitId = latest.units[0]!.id;
    render(
      <Harness initial={latest}>
        {(file, update) => {
          latest = file;
          return <SceneDialog file={file} unitId={unitId} onClose={() => undefined} onUpdate={update} />;
        }}
      </Harness>,
    );

    expect((screen.getByLabelText('Scene name') as HTMLInputElement).value).toBe('Opening Scene');
    expect((screen.getByLabelText('Setting') as HTMLSelectElement).value).toBe('INT.');
    expect((screen.getByLabelText('Location') as HTMLInputElement).value).toBe('KITCHEN');
    expect((screen.getByLabelText('Time') as HTMLSelectElement).value).toBe('MORNING');

    const side = within(screen.getByLabelText('In this scene'));
    expect(side.getByText('MIKE')).toBeDefined();
    expect(side.getByText('The envelope')).toBeDefined();
    expect(side.getByText('setup')).toBeDefined();

    // The heading fields write back to the script's first scene heading.
    fireEvent.change(screen.getByLabelText('Setting'), { target: { value: 'EXT.' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Back porch' } });
    fireEvent.blur(screen.getByLabelText('Location'));
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: 'NIGHT' } });
    expect(latest.beats[0]!.manuscript.elements[0]!.text).toBe('EXT. BACK PORCH - NIGHT');

    // Off: the scene leaves the manuscript and stays in the structure.
    fireEvent.click(screen.getByLabelText('In script'));
    expect(latest.units[0]!.inScript).toBe(false);
    expect(manuscriptElements(latest)).toHaveLength(0);
    expect(latest.units).toHaveLength(1);
    expect(screen.getByText('Off')).toBeDefined();
  });

  it('has no slugline for a novel', () => {
    const file = scene('novel');
    render(<SceneDialog file={file} unitId={file.units[0]!.id} onClose={() => undefined} onUpdate={() => undefined} />);
    expect(screen.getByLabelText('Chapter name')).toBeDefined();
    expect(screen.queryByLabelText('Location')).toBeNull();
  });
});

describe('beat pop-up', () => {
  it('starts a revision as a copy, switches back, colours the beat, and lists what the beat holds', () => {
    let latest = scene();
    const beatId = latest.beats[0]!.id;
    render(
      <Harness initial={latest}>
        {(file, update) => {
          latest = file;
          return <BeatDialog file={file} beatId={beatId} onClose={() => undefined} onUpdate={update} />;
        }}
      </Harness>,
    );

    expect((screen.getByLabelText('Beat name') as HTMLInputElement).value).toBe('Home life');
    expect(screen.queryByLabelText('Location')).toBeNull();
    const side = within(screen.getByLabelText('In this beat'));
    expect(side.getByText('MIKE')).toBeDefined();
    expect(side.getByText('The envelope')).toBeDefined();

    // New revision…: named inline, then started as a copy of the working text.
    fireEvent.change(screen.getByLabelText('Revision'), { target: { value: '__new__' } });
    fireEvent.change(screen.getByLabelText('New revision name'), { target: { value: 'Tighter' } });
    fireEvent.click(screen.getByText('Start'));
    expect(latest.beats[0]!.revisionName).toBe('Tighter');
    expect(latest.beats[0]!.revisions.map((revision) => revision.name)).toEqual(['Draft 1']);
    expect(latest.beats[0]!.manuscript.elements).toHaveLength(3);

    const options = Array.from((screen.getByLabelText('Revision') as HTMLSelectElement).options).map((option) => option.text);
    expect(options).toEqual(['Tighter (current)', 'Draft 1', 'New revision…']);

    // Choosing the kept revision makes it the working one.
    fireEvent.change(screen.getByLabelText('Revision'), { target: { value: latest.beats[0]!.revisions[0]!.id } });
    expect(latest.beats[0]!.revisionName).toBe('Draft 1');
    expect(latest.beats[0]!.revisions.map((revision) => revision.name)).toEqual(['Tighter']);

    fireEvent.click(screen.getByLabelText('Colour #8b1c1c'));
    expect(latest.beats[0]!.color).toBe('#8b1c1c');
    fireEvent.click(screen.getByLabelText('No colour'));
    expect(latest.beats[0]!.color).toBeNull();

    fireEvent.click(screen.getByLabelText('Remove revision Tighter'));
    expect(latest.beats[0]!.revisions).toHaveLength(0);
  });
});

describe('opening the pop-ups', () => {
  it('opens the scene from its block and the beat from a double-click on its row', () => {
    const file = scene();
    const onOpenUnit = vi.fn<(id: StructuralUnitId) => void>();
    const onOpenBeat = vi.fn<(id: BeatId) => void>();
    render(
      <MasterTimeline
        file={file}
        selectedBeatId={file.beats[0]!.id}
        onSelectBeat={() => undefined}
        onUpdate={() => undefined}
        pixelsPerPage={160}
        onZoom={() => undefined}
        inspectorOpen={false}
        onToggleInspector={() => undefined}
        onAddScene={() => undefined}
        onAddBeat={() => undefined}
        onAddLane={() => undefined}
        onAddAct={() => undefined}
        onOpenLane={() => undefined}
        onOpenUnit={onOpenUnit}
        onOpenBeat={onOpenBeat}
      />,
    );
    fireEvent.click(screen.getByText('Opening Scene'));
    expect(onOpenUnit).toHaveBeenCalledWith(file.units[0]!.id);
    fireEvent.doubleClick(screen.getByText('Home life'));
    expect(onOpenBeat).toHaveBeenCalledWith(file.beats[0]!.id);
  });

  it('leaves a switched-off scene out of the Script and dims it on the timeline', () => {
    let file = scene();
    file = { ...file, units: file.units.map((unit) => ({ ...unit, inScript: false })) };
    const { container } = render(
      <>
        <StoryView
          file={file}
          selectedBeatId={null}
          onSelectBeat={() => undefined}
          onUpdate={() => undefined}
          focusMode={false}
          focusTitleBeatId={null}
          onTitleFocused={() => undefined}
          dictationShortcut={null}
        />
        <MasterTimeline
          file={file}
          selectedBeatId={null}
          onSelectBeat={() => undefined}
          onUpdate={() => undefined}
          pixelsPerPage={160}
          onZoom={() => undefined}
          inspectorOpen={false}
          onToggleInspector={() => undefined}
          onAddScene={() => undefined}
          onAddBeat={() => undefined}
          onAddLane={() => undefined}
          onAddAct={() => undefined}
          onOpenLane={() => undefined}
        />
      </>,
    );
    expect(container.querySelectorAll('.story .scene')).toHaveLength(0);
    expect(container.querySelectorAll('.block.off')).toHaveLength(1);
  });
});
