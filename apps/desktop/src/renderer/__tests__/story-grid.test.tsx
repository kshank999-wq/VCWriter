// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addUnit,
  createProjectFile,
  findUnit,
  setSceneGrid,
  storyGridOf,
  storyGridRows,
  unitsInStoryOrder,
  type ProjectFile,
  type SceneGrid,
  type StructuralUnitId,
} from '@vcwriter/domain';
import { EditorPanel } from '../components/EditorPanel';
import { ValueGraph } from '../components/ValueGraph';

/**
 * The Story Grid's global layer through the interface (addendum 04 §3).
 *
 * The method itself is tested in the domain. What these cover is the part a
 * writer meets: that saying what the story is fills the list, that naming a
 * scene against a line marks it kept, that the count on the tab is the count
 * of what is answered, and that a line of one's own can be added and removed.
 */

afterEach(cleanup);

/** The Final Editor asks the bridge a question the moment its tab opens. */
const bridge = () => {
  (window as unknown as { vcwriter: unknown }).vcwriter = {
    sceneReviewStatus: async () => ({ ok: true, data: { available: false, reason: 'Sign in' } }),
    reviewScene: async () => ({ ok: false, error: 'Sign in' }),
  };
};

function Harness({ onFile, onGoToUnit }: { onFile?(file: ProjectFile): void; onGoToUnit?(id: StructuralUnitId): void }) {
  const [file, setFile] = useState(() => createProjectFile({ title: 'Blackout', format: 'screenplay' }));
  onFile?.(file);
  return (
    <EditorPanel
      file={file}
      currentUnitId={file.units[0]!.id}
      openOn="grid"
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      {...(onGoToUnit ? { onGoToUnit } : {})}
    />
  );
}

const chooseThriller = () =>
  fireEvent.change(screen.getByLabelText('Global genre'), { target: { value: 'thriller' } });

describe('the Story Grid tab', () => {
  it('is a third tab of the Editors page, and opens when the menu names it', () => {
    bridge();
    render(<Harness />);
    const tabs = within(screen.getByRole('tablist', { name: 'Editor' })).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Daily (0)', 'Final (2)', 'Story Grid (0/0)']);
    expect(tabs[2]?.getAttribute('aria-selected')).toBe('true');
  });

  it('says nothing until the writer says what the story is', () => {
    bridge();
    render(<Harness />);
    expect(screen.getByText(/this fills with what that genre owes/i)).toBeTruthy();
    expect(screen.queryByText('What the story owes')).toBeNull();
  });

  it('fills the list from the genre, and suggests its value', () => {
    bridge();
    render(<Harness />);
    chooseThriller();

    expect(screen.getByDisplayValue('The hero at the mercy of the villain')).toBeTruthy();
    expect(screen.getByDisplayValue('A ticking clock')).toBeTruthy();
    // The value is the genre's until the writer types their own.
    expect((screen.getByLabelText('Global value') as HTMLInputElement).value).toBe('Life / damnation');
  });

  it('marks a line kept when a scene is named against it, and counts it', () => {
    bridge();
    let file: ProjectFile | null = null;
    render(<Harness onFile={(next) => (file = next)} />);
    chooseThriller();

    const unitId = file!.units[0]!.id as string;
    fireEvent.change(screen.getByLabelText('Which scene keeps: The hero at the mercy of the villain'), {
      target: { value: unitId },
    });

    expect(screen.getByText('1 of 5 answered')).toBeTruthy();
    const tabs = within(screen.getByRole('tablist', { name: 'Editor' })).getAllByRole('tab');
    expect(tabs[2]?.textContent).toBe('Story Grid (1/9)');
  });

  it('goes to the scene that keeps a promise', () => {
    bridge();
    let file: ProjectFile | null = null;
    const went: string[] = [];
    render(<Harness onFile={(next) => (file = next)} onGoToUnit={(id) => went.push(id as string)} />);
    chooseThriller();

    const unitId = file!.units[0]!.id as string;
    expect(screen.queryByRole('button', { name: /^Go to / })).toBeNull();

    fireEvent.change(screen.getByLabelText('Which scene keeps: A ticking clock'), {
      target: { value: unitId },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Go to / }));
    expect(went).toEqual([unitId]);
  });

  it('takes a line of the writer’s own, and lets it go again', () => {
    bridge();
    let file: ProjectFile | null = null;
    render(<Harness onFile={(next) => (file = next)} />);
    chooseThriller();

    const before = storyGridOf(file!).promises.length;
    fireEvent.click(screen.getAllByRole('button', { name: '+ One of your own' })[0]!);
    expect(storyGridOf(file!).promises).toHaveLength(before + 1);

    fireEvent.click(screen.getByRole('button', { name: 'Remove: unnamed' }));
    expect(storyGridOf(file!).promises).toHaveLength(before);
  });

  it('rewords a line without disturbing what it is answered by', () => {
    bridge();
    let file: ProjectFile | null = null;
    render(<Harness onFile={(next) => (file = next)} />);
    chooseThriller();

    const unitId = file!.units[0]!.id as string;
    fireEvent.change(screen.getByLabelText('Which scene keeps: A false ally'), { target: { value: unitId } });
    fireEvent.change(screen.getByLabelText('What is owed: A false ally'), {
      target: { value: 'A friend who is not one' },
    });

    const promise = storyGridOf(file!).promises.find((entry) => entry.text === 'A friend who is not one');
    expect(promise?.unitId).toBe(unitId);
  });

  it('offers to start the list again once there is one', () => {
    bridge();
    let file: ProjectFile | null = null;
    render(<Harness onFile={(next) => (file = next)} />);
    expect(screen.queryByRole('button', { name: 'Start the list again' })).toBeNull();

    chooseThriller();
    fireEvent.change(screen.getByLabelText('What is owed: A false ally'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start the list again' }));

    expect(storyGridOf(file!).promises.some((entry) => entry.text === 'Mine')).toBe(false);
    expect(storyGridOf(file!).promises.some((entry) => entry.text === 'A false ally')).toBe(true);
  });
});

describe('the five commandments', () => {
  it('asks the story its five, whether or not a genre has been chosen', () => {
    bridge();
    let file: ProjectFile | null = null;
    render(<Harness onFile={(next) => (file = next)} />);

    expect(screen.getByText('The five commandments')).toBeTruthy();
    expect(screen.getByText('0 of 5 for the story')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Crisis, for the story'), {
      target: { value: 'Tell the truth and lose her, or keep her and lie' },
    });
    expect(storyGridOf(file!).story.crisis).toContain('lose her');
    expect(screen.getByText('1 of 5 for the story')).toBeTruthy();
  });

  it('has nothing to ask of the acts until the act breaks are marked', () => {
    bridge();
    render(<Harness />);
    const acts = screen.getByRole('tab', { name: /^Each act/ });
    expect(acts.textContent).toBe('Each act (0)');
    expect((acts as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks each scene the same five in the grid, and the complication is the turn', () => {
    bridge();
    let file: ProjectFile | null = null;
    render(<Harness onFile={(next) => (file = next)} />);

    const unitId = file!.units[0]!.id;
    const label = file!.units[0]!.title;

    fireEvent.change(screen.getByLabelText(`Progressive complication, ${label}`), {
      target: { value: 'She reads the log' },
    });
    // The Final Editor's grid has always asked for the turn. Same field.
    expect(findUnit(file!, unitId)?.grid.turn).toBe('She reads the log');

    fireEvent.change(screen.getByLabelText(`Resolution, ${label}`), { target: { value: 'The door stays shut' } });
    expect(findUnit(file!, unitId)?.grid.resolution).toBe('The door stays shut');
  });
});

describe('the grid itself', () => {
  it('is one row per scene, and says how many are showing', () => {
    bridge();
    let file: ProjectFile | null = null;
    render(<Harness onFile={(next) => (file = next)} />);

    const rows = document.querySelectorAll('.grid-table tbody tr');
    expect(rows).toHaveLength(file!.units.length);
    expect(screen.getByText(`${file!.units.length} ${file!.units.length === 1 ? 'scene' : 'scenes'}`)).toBeTruthy();
  });

  it('takes the story event and what is at stake, on the scene', () => {
    bridge();
    let file: ProjectFile | null = null;
    render(<Harness onFile={(next) => (file = next)} />);
    const label = file!.units[0]!.title;

    fireEvent.change(screen.getByLabelText(`What happens in ${label}`), { target: { value: 'The lamp fails' } });
    fireEvent.change(screen.getByLabelText(`What is at stake in ${label}`), { target: { value: 'light / dark' } });

    const unit = findUnit(file!, file!.units[0]!.id);
    expect(unit?.grid.event).toBe('The lamp fails');
    expect(unit?.grid.value).toBe('light / dark');
  });

  it('draws the shift as a mark, and marks a scene that does not move', () => {
    bridge();
    let file: ProjectFile | null = null;
    render(<Harness onFile={(next) => (file = next)} />);
    const label = file!.units[0]!.title;

    const shift = screen.getByLabelText(`Which way ${label} moves`);
    expect([...(shift as HTMLSelectElement).options].map((option) => option.text)).toEqual(['·', '+', '−', '±', '=']);

    fireEvent.change(shift, { target: { value: 'flat' } });
    expect(findUnit(file!, file!.units[0]!.id)?.grid.polarity).toBe('flat');
    expect(document.querySelectorAll('.grid-table tr.flat')).toHaveLength(1);
  });

  it('filters to the scenes that do not turn, and counts what is left', () => {
    bridge();
    let file: ProjectFile | null = null;
    render(<Harness onFile={(next) => (file = next)} />);
    const all = file!.units.length;
    const label = file!.units[0]!.title;

    fireEvent.change(screen.getByLabelText(`Progressive complication, ${label}`), { target: { value: 'It turns' } });
    fireEvent.change(screen.getByLabelText('Which scenes to show'), { target: { value: 'no_turn' } });

    expect(document.querySelectorAll('.grid-table tbody tr')).toHaveLength(all - 1);
    expect(screen.getByText(`${all - 1} of ${all}`)).toBeTruthy();
  });

  it('goes to a scene from its row', () => {
    bridge();
    let file: ProjectFile | null = null;
    const went: string[] = [];
    render(<Harness onFile={(next) => (file = next)} onGoToUnit={(id) => went.push(id as string)} />);

    const row = document.querySelector('.grid-table tbody tr th button') as HTMLButtonElement;
    fireEvent.click(row);
    expect(went).toEqual([file!.units[0]!.id as string]);
  });
});

/**
 * The value graph (addendum 04 §6): the polarity column, plotted. The
 * arithmetic is tested in the domain; what matters here is what a writer
 * sees, and that clicking a point goes to the scene.
 */
describe('the value graph', () => {
  const withScenes = (...shifts: SceneGrid['polarity'][]): ProjectFile => {
    let file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
    for (let extra = 1; extra < shifts.length; extra += 1) {
      file = addUnit(file, { laneId: file.lanes[0]!.id, title: `Scene ${extra + 1}` }).file;
    }
    unitsInStoryOrder(file).forEach((unit, index) => {
      const polarity = shifts[index];
      if (polarity) file = setSceneGrid(file, unit.id, { polarity });
    });
    return file;
  };

  const graph = (file: ProjectFile, onGoToUnit?: (id: StructuralUnitId) => void) =>
    render(<ValueGraph rows={storyGridRows(file)} {...(onGoToUnit ? { onGoToUnit } : {})} />);

  it('draws a point for every scene, and says how many are answered', () => {
    graph(withScenes('up', 'down', '', 'up'));
    expect(document.querySelectorAll('.value-point')).toHaveLength(4);
    expect(screen.getByText('3 of 4 scenes')).toBeTruthy();
  });

  it('draws a scene nobody has answered hollow, so the difference is visible', () => {
    graph(withScenes('up', '', 'up'));
    expect(document.querySelectorAll('.value-point.unsaid')).toHaveLength(1);
  });

  it('is not drawn at all where there is nothing to draw a line between', () => {
    const { container } = graph(withScenes('up'));
    expect(container.querySelector('.value-graph')).toBeNull();
  });

  it('goes to the scene when a point is clicked', () => {
    const went: StructuralUnitId[] = [];
    const file = withScenes('up', 'down', 'up');
    graph(file, (id) => went.push(id));
    fireEvent.click(document.querySelectorAll('.value-point circle')[1]!);
    expect(went).toEqual([unitsInStoryOrder(file)[1]?.id]);
  });

  it('says when a story never falls below where it started, and nothing when it turns', () => {
    graph(withScenes('up', 'up', 'up', 'up'));
    expect(screen.getByText(/never falls below/)).toBeTruthy();
    cleanup();

    graph(withScenes('down', 'up', 'down', 'up'));
    expect(document.querySelector('.value-note')).toBeNull();
  });
});
