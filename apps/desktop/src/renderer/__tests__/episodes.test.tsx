// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  addCharacter,
  addEpisode,
  castOf,
  characterCategoriesInOrder,
  createProjectFile,
  episodes,
  updateCharacter,
  type Episode,
  type ProjectFile,
} from '@vcwriter/domain';
import { EpisodeRail } from '../components/EpisodeRail';
import { NewEpisodeDialog } from '../components/NewEpisodeDialog';
import { CastPanel } from '../components/CastPanel';
import { menusFor } from '../menus';

/**
 * The episode rail, starting an episode, and the cast under its headings
 * (addendum 02 §16, §17).
 */

afterEach(cleanup);

const series = (): ProjectFile => createProjectFile({ title: 'The Lighthouse', format: 'series' });

const cast = (file: ProjectFile, name: string, heading: string): ProjectFile => {
  const category = characterCategoriesInOrder(file).find((entry) => entry.name === heading);
  const withPerson = addCharacter(file, { name });
  const person = withPerson.characters[withPerson.characters.length - 1]!;
  return updateCharacter(withPerson, person.id, { categoryId: category?.id ?? null });
};

/** A component holding a project in state, so a panel can actually change it. */
function Holding({
  start,
  children,
}: {
  start: ProjectFile;
  children(file: ProjectFile, update: (mutate: (current: ProjectFile) => ProjectFile) => void): JSX.Element;
}) {
  const [file, setFile] = useState(start);
  return children(file, (mutate) => setFile((current) => mutate(current)));
}

describe('the episode rail', () => {
  it('is drawn for a series and for nothing else', () => {
    const { container } = render(
      <EpisodeRail
        file={createProjectFile({ title: 'A feature', format: 'screenplay' })}
        open
        onOpen={() => {}}
        currentUnitId={null}
        onGo={() => {}}
        onNew={() => {}}
      />,
    );
    expect(container.querySelector('.episode-rail')).toBeNull();
  });

  it('lists every episode with its number, its name and what is in it', () => {
    let file = cast(series(), 'MAEVE', 'Main characters');
    file = addEpisode(file, { title: 'Pilot' }).file;
    file = addEpisode(file, { title: 'The Wreck' }).file;

    render(
      <EpisodeRail file={file} open onOpen={() => {}} currentUnitId={null} onGo={() => {}} onNew={() => {}} />,
    );
    const rows = document.querySelectorAll('.episode-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('EPISODE 1');
    expect(rows[0]?.textContent).toContain('Pilot');
    expect(rows[1]?.textContent).toContain('EPISODE 2');
    // The cast that carried over is named on the row.
    expect(rows[1]?.textContent).toContain('MAEVE');
  });

  it('marks the episode the workspace is in, and goes to one when it is chosen', () => {
    let file = addEpisode(series(), { title: 'Pilot' }).file;
    file = addEpisode(file, { title: 'The Wreck' }).file;
    const [first, second] = episodes(file);

    const went: Episode[] = [];
    render(
      <EpisodeRail
        file={file}
        open
        onOpen={() => {}}
        currentUnitId={second!.units[0]!.id}
        onGo={(episode) => went.push(episode)}
        onNew={() => {}}
      />,
    );
    expect(document.querySelectorAll('.episode-row')[1]?.className).toContain('current');

    fireEvent.click(screen.getByText('Pilot'));
    expect(went[0]?.title).toBe(first!.title);
  });

  it('is a tab and nothing more while it is shut', () => {
    render(
      <EpisodeRail file={series()} open={false} onOpen={() => {}} currentUnitId={null} onGo={() => {}} onNew={() => {}} />,
    );
    expect(screen.getByText('Episodes')).toBeTruthy();
    expect(document.querySelector('.episode-rail-body')).toBeNull();
  });
});

describe('starting an episode', () => {
  it('asks for a name and what comes over, and says what will and will not', () => {
    let file = cast(series(), 'MAEVE', 'Main characters');
    file = cast(file, 'THE FERRYMAN', 'Minor characters');

    render(
      <NewEpisodeDialog file={file} open onClose={() => {}} onCreate={() => {}} onGo={() => {}} />,
    );
    expect(screen.getByLabelText('Episode name')).toBeTruthy();
    expect(screen.getByLabelText('Main characters')).toBeTruthy();
    expect(screen.getByLabelText('Recurring characters')).toBeTruthy();
    expect(screen.getByLabelText('Minor characters')).toBeTruthy();
    expect(screen.getByText(/None of the writing does/)).toBeTruthy();
  });

  it('creates the episode with the cast that was ticked, and leaves the rest', () => {
    const start = cast(cast(series(), 'MAEVE', 'Main characters'), 'THE FERRYMAN', 'Minor characters');
    let seen: ProjectFile = start;

    render(
      <Holding start={start}>
        {(file, update) => {
          seen = file;
          return <NewEpisodeDialog file={file} open onClose={() => {}} onCreate={update} onGo={() => {}} />;
        }}
      </Holding>,
    );

    fireEvent.change(screen.getByLabelText('Episode name'), { target: { value: 'Pilot' } });
    // The mains carry over; the guest parts do not, and neither does whoever
    // happened to speak.
    const tick = (label: string, on: boolean) => {
      const box = screen.getByLabelText(label) as HTMLInputElement;
      if (box.checked !== on) fireEvent.click(box);
    };
    tick('Main characters', true);
    tick('Recurring characters', false);
    tick('Minor characters', false);
    tick('Whoever spoke last episode', false);

    fireEvent.click(screen.getByRole('button', { name: /start episode/i }));

    const made = episodes(seen);
    expect(made).toHaveLength(1);
    expect(made[0]?.title).toBe('Pilot');
    expect(made[0]?.label).toBe('EPISODE 1');
    // A clear slate: its own scene, one empty beat.
    expect(made[0]?.beats).toHaveLength(1);
    expect(made[0]?.beats[0]?.manuscript.elements).toEqual([]);
    expect(castOf(seen, made[0]!).map((person) => person.name)).toEqual(['MAEVE']);
  });

  it('is on the File menu in a series, and nowhere else', () => {
    const commands = (format: Parameters<typeof menusFor>[0]) =>
      menusFor(format).flatMap((menu) => menu.items.filter(Boolean).map((item) => item!.command));

    expect(commands('series')).toContain('file.new.episode');
    // An episode is not a kind of project; it is a thing you do inside one.
    // A menu that offers it in a novel is a menu that lies.
    expect(commands('novel')).not.toContain('file.new.episode');
    expect(commands('screenplay')).not.toContain('file.new.episode');
    expect(commands(null)).not.toContain('file.new.episode');

    // And a new project is one item, whatever is open.
    expect(commands('series')).toContain('file.new');
    expect(commands(null)).toContain('file.new');
    expect(commands(null).filter((command) => command.startsWith('file.new'))).toEqual(['file.new']);

    expect(commands('series')).toContain('window.episodes');
  });
});

describe('the cast under its headings', () => {
  it('shows a series’ three headings, and the unfiled last', () => {
    let file = cast(series(), 'MAEVE', 'Main characters');
    file = addCharacter(file, { name: 'PORTER' });

    render(<CastPanel file={file} onUpdate={() => {}} />);
    const headings = [...document.querySelectorAll('.cast-group-name')].map((node) => node.textContent);
    expect(headings).toEqual(['Main characters', 'Recurring characters', 'Minor characters', 'Not filed']);
  });

  it('files someone under another heading, and keeps them when a heading goes', () => {
    const start = cast(series(), 'MAEVE', 'Main characters');
    let seen: ProjectFile = start;

    render(
      <Holding start={start}>
        {(file, update) => {
          seen = file;
          return (
            <CastPanel
              file={file}
              onUpdate={(mutate) => update(mutate)}
            />
          );
        }}
      </Holding>,
    );

    const recurring = characterCategoriesInOrder(start).find((entry) => entry.name === 'Recurring characters')!;
    fireEvent.change(screen.getByLabelText('Heading for MAEVE'), { target: { value: recurring.id } });
    expect(seen.characters[0]?.categoryId).toBe(recurring.id);

    fireEvent.click(screen.getByLabelText('Remove the heading Recurring characters'));
    // The heading is gone; MAEVE is not.
    expect(seen.characterCategories.map((entry) => entry.name)).not.toContain('Recurring characters');
    expect(seen.characters.map((person) => person.name)).toEqual(['MAEVE']);
    expect(seen.characters[0]?.categoryId).toBeNull();
  });

  it('adds a heading of the writer’s own', () => {
    let seen: ProjectFile = series();
    render(
      <Holding start={series()}>
        {(file, update) => {
          seen = file;
          return <CastPanel file={file} onUpdate={update} />;
        }}
      </Holding>,
    );

    fireEvent.change(screen.getByLabelText('New heading'), { target: { value: 'The precinct' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Heading' }));
    expect(seen.characterCategories.map((entry) => entry.name)).toContain('The precinct');
  });
});
