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
  updateBeat,
  updateCharacter,
  type Episode,
  type ProjectFile,
} from '@vcwriter/domain';
import { EpisodeRail } from '../components/EpisodeRail';
import { NewEpisodeDialog } from '../components/NewEpisodeDialog';
import { CastPanel } from '../components/CastPanel';
import { PagePreview } from '../components/PagePreview';
import { TitlePageDialog } from '../components/TitlePageDialog';
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
        onOpenTitlePage={() => {}}
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
      <EpisodeRail file={file} open onOpen={() => {}} currentUnitId={null} onGo={() => {}} onOpenTitlePage={() => {}} onNew={() => {}} />,
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
        onOpenTitlePage={() => {}}
        onNew={() => {}}
      />,
    );
    expect(document.querySelectorAll('.episode-row')[1]?.className).toContain('current');

    fireEvent.click(screen.getByText('Pilot'));
    expect(went[0]?.title).toBe(first!.title);
  });

  it('is a tab and nothing more while it is shut', () => {
    render(
      <EpisodeRail file={series()} open={false} onOpen={() => {}} currentUnitId={null} onGo={() => {}} onOpenTitlePage={() => {}} onNew={() => {}} />,
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

/**
 * The Preview shows the pages that will print, and an episode's own front
 * page is one of them (addendum 02 §17).
 */
describe('an episode’s front page in the preview', () => {
  const twoEpisodes = (): ProjectFile => {
    let file = createProjectFile({ title: 'The Lighthouse', format: 'series', author: 'K. Shank' });
    for (const title of ['Pilot', 'The Wreck']) {
      const made = addEpisode(file, { title });
      file = updateBeat(made.file, made.episode.beats[0]!.id, {
        manuscript: {
          elements: [
            {
              id: `${made.episode.marker.id}-a` as never,
              type: 'action',
              text: 'The lamp turns.',
              characterId: null,
              attributes: {},
            },
          ],
        },
      });
    }
    return file;
  };

  const preview = (file: ProjectFile, includeTitlePage = true) =>
    render(
      <PagePreview
        file={file}
        unitId={null}
        includeBeatTitles={false}
        onToggleBeatTitles={() => undefined}
        includeChapterPages
        onToggleChapterPages={() => undefined}
        includeTitlePage={includeTitlePage}
        includeContentsPage
        onExportPdf={() => undefined}
        onPrint={() => undefined}
        busy={false}
        message={null}
      />,
    );

  it('draws one at the head of each episode, with the series’ credit on it', () => {
    preview(twoEpisodes());
    const first = screen.getByLabelText('Title page: Episode 1');
    expect(screen.getByLabelText('Title page: Episode 2')).toBeDefined();
    // The title and the credit come from the series where the episode is silent.
    expect(within(first).getByText('The Lighthouse')).toBeDefined();
    expect(screen.getAllByText('K. Shank')).toHaveLength(2);
  });

  it('draws none of them when the title page is switched off', () => {
    preview(twoEpisodes(), false);
    expect(screen.queryByLabelText('Title page: Episode 1')).toBeNull();
  });
});

/**
 * An episode is numbered on its own front page, and two of them cannot carry
 * the same number (addendum 02 §17).
 */
describe('numbering an episode on its front page', () => {
  const twoEpisodes = (): ProjectFile => {
    let file = createProjectFile({ title: 'The Lighthouse', format: 'series' });
    file = addEpisode(file, { title: 'Pilot' }).file;
    file = addEpisode(file, { title: 'The Wreck' }).file;
    return file;
  };

  /** The second episode's page, open, over a project held in state. */
  function Editing({ start }: { start: ProjectFile }) {
    const [file, setFile] = useState(start);
    const second = episodes(file)[1]!;
    return (
      <>
        <p data-testid="numbers">{episodes(file).map((episode) => episode.number).join(',')}</p>
        <TitlePageDialog
          file={file}
          episode={second}
          open
          onClose={() => undefined}
          onUpdate={(mutate) => setFile((current) => mutate(current))}
        />
      </>
    );
  }

  it('says which episode already has the number, and will not commit it', () => {
    render(<Editing start={twoEpisodes()} />);
    const field = screen.getByLabelText('Episode') as HTMLInputElement;
    expect(field.value).toBe('Episode 2');

    fireEvent.change(field, { target: { value: 'Episode 1' } });
    expect(screen.getByText(/EPISODE 1 already carries that number/)).toBeDefined();

    const update = screen.getByRole('button', { name: 'Update page' }) as HTMLButtonElement;
    expect(update.disabled).toBe(true);
    fireEvent.click(update);
    // Nothing was written: the two episodes are still one and two.
    expect(screen.getByTestId('numbers').textContent).toBe('1,2');
  });

  it('takes a free number, and the episode is that number from then on', () => {
    render(<Editing start={twoEpisodes()} />);
    fireEvent.change(screen.getByLabelText('Episode'), { target: { value: 'Episode 7 — The Wreck' } });
    expect(screen.queryByText(/already carries that number/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Update page' }));
    expect(screen.getByTestId('numbers').textContent).toBe('1,7');
  });
});

/**
 * The list at the front of a season's stack (addendum 02 §17).
 */
describe('the contents page in the preview', () => {
  const seriesOf = (count: number): ProjectFile => {
    let file = createProjectFile({ title: 'The Lighthouse', format: 'series' });
    for (const title of ['Pilot', 'The Wreck', 'Blue Water'].slice(0, count)) {
      const made = addEpisode(file, { title });
      file = updateBeat(made.file, made.episode.beats[0]!.id, {
        manuscript: {
          elements: [
            {
              id: `${made.episode.marker.id}-a` as never,
              type: 'action',
              text: 'The lamp turns.',
              characterId: null,
              attributes: {},
            },
          ],
        },
      });
    }
    return file;
  };

  const preview = (file: ProjectFile, includeContentsPage = true) =>
    render(
      <PagePreview
        file={file}
        unitId={null}
        includeBeatTitles={false}
        onToggleBeatTitles={() => undefined}
        includeChapterPages
        onToggleChapterPages={() => undefined}
        includeTitlePage
        includeContentsPage={includeContentsPage}
        onExportPdf={() => undefined}
        onPrint={() => undefined}
        busy={false}
        message={null}
      />,
    );

  it('opens the stack, listing every episode and how long it runs', () => {
    preview(seriesOf(3));
    const sheet = screen.getByLabelText('Contents');
    expect(within(sheet).getByText('The Lighthouse')).toBeDefined();
    expect(within(sheet).getByText('EPISODE 2')).toBeDefined();
    expect(within(sheet).getByText('Blue Water')).toBeDefined();
    expect(within(sheet).getAllByText('1 page')).toHaveLength(3);
  });

  it('is not drawn for one episode, or when it is switched off', () => {
    preview(seriesOf(1));
    expect(screen.queryByLabelText('Contents')).toBeNull();
    cleanup();

    preview(seriesOf(3), false);
    expect(screen.queryByLabelText('Contents')).toBeNull();
    // The covers are its own switch, and are still there.
    expect(screen.getByLabelText('Title page: Episode 1')).toBeDefined();
  });
});
