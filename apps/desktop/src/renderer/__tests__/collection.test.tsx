// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beginStory, createProjectFile, episodes, importChoices, storiesOf, type ProjectFile } from '@vcwriter/domain';
import { AddStoriesDialog } from '../components/AddStoriesDialog';
import { menusFor } from '../menus';
import { buildDocx, wordParagraph } from './zip-fixture';

/**
 * A collection of stories (addendum 22): adding stories from files, and the
 * menu item that offers it on a collection alone.
 */

afterEach(cleanup);

const fileNamed = (name: string, body: string | ArrayBuffer): File => {
  const made = new File([body], name);
  Object.defineProperty(made, 'text', { value: () => Promise.resolve(typeof body === 'string' ? body : '') });
  Object.defineProperty(made, 'arrayBuffer', {
    value: () => Promise.resolve(typeof body === 'string' ? new TextEncoder().encode(body).buffer : body),
  });
  return made;
};

const choose = (files: File[], label = 'Story files') => {
  const picker = screen.getByLabelText(label) as HTMLInputElement;
  Object.defineProperty(picker, 'files', { value: files, configurable: true });
  fireEvent.change(picker);
};

const HARBOUR = () =>
  buildDocx([
    wordParagraph('The Harbour', { style: 'Title' }),
    wordParagraph('I', { align: 'center' }),
    wordParagraph('Rain on the water.'),
    wordParagraph('II', { align: 'center' }),
    wordParagraph('Nobody came, and the tide went out.'),
  ]);

describe('adding stories to a collection', () => {
  it('reads each file as a story, lists them, and adds them after the last', async () => {
    const start = beginStory(createProjectFile({ title: 'Tales', format: 'short_story' }), { title: 'The Road' }).file;
    const made: ProjectFile[] = [];
    render(<AddStoriesDialog open file={start} onClose={() => {}} onAdded={(next) => made.push(next)} />);
    expect((screen.getByRole('button', { name: 'Add the story' }) as HTMLButtonElement).disabled).toBe(true);

    choose([fileNamed('harbour.docx', HARBOUR()), fileNamed('the-lamp.txt', 'The lamp had been in the family.\n\nIt was the first thing she reached for.'), fileNamed('notes.pdf', 'x')]);
    await screen.findByText('2 stories');
    expect(screen.getByText('The Harbour')).toBeTruthy();
    expect(document.querySelector('.import-list')?.textContent).toContain('2 sections · 11 words');
    expect(screen.getByText('the-lamp')).toBeTruthy();
    expect(screen.getByText(/notes.pdf is not a Word document or a text file/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Add 2 stories' }));
    await waitFor(() => expect(made).toHaveLength(1));
    const stories = storiesOf(made[0]!);
    expect(stories.map((story) => story.placed.marker.title)).toEqual(['The Road', 'The Harbour', 'the-lamp']);
    expect(stories[1]?.sections.map((unit) => unit.title)).toEqual(['I', 'II']);
    expect(stories[2]?.sections).toHaveLength(1);
  });

  it('puts the stories in the order the arrows say', async () => {
    const start = createProjectFile({ title: 'Tales', format: 'short_story' });
    const made: ProjectFile[] = [];
    render(<AddStoriesDialog open file={start} onClose={() => {}} onAdded={(next) => made.push(next)} />);
    choose([fileNamed('harbour.docx', HARBOUR()), fileNamed('the-lamp.txt', 'The lamp had been in the family.')]);
    await screen.findByText('2 stories');
    fireEvent.click(screen.getByRole('button', { name: 'Move the-lamp up' }));
    expect([...document.querySelectorAll('.import-order-title')].map((node) => node.textContent)).toEqual(['1. the-lamp', '2. The Harbour']);
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 stories' }));
    await waitFor(() => expect(made).toHaveLength(1));
    expect(storiesOf(made[0]!).map((story) => story.placed.marker.title)).toEqual(['the-lamp', 'The Harbour']);
  });

  it('is reached from the File menu’s one Import item, whatever the format', () => {
    // Addendum 33: two items became one, and which kinds are offered is
    // `importChoices`' answer rather than the menu's — so the menu says the
    // same thing everywhere and the chooser says what applies here.
    const items = (format: 'short_story' | 'novel' | 'series') =>
      menusFor(format).flatMap((menu) => menu.items.filter(Boolean).map((item) => [item!.command, item!.label]));
    for (const format of ['short_story', 'novel', 'series'] as const) {
      expect(items(format)).toContainEqual(['file.import', 'Import…']);
      expect(items(format).map(([command]) => command)).not.toContain('file.importStories');
    }
    expect(importChoices('short_story').map((choice) => choice.kind)).toContain('stories');
    expect(importChoices('series').map((choice) => choice.kind)).toContain('episodes');
    expect(importChoices('novel').map((choice) => choice.kind)).not.toContain('stories');
  });
});

const FDX = (title: string, heading: string, cue: string) => `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Version="5">
<Content>
<Paragraph Type="Scene Heading"><Text>${heading}</Text></Paragraph>
<Paragraph Type="Character"><Text>${cue}</Text></Paragraph>
<Paragraph Type="Dialogue"><Text>Again.</Text></Paragraph>
</Content>
<TitlePage><Content><Paragraph><Text>${title}</Text></Paragraph></Content></TitlePage>
</FinalDraft>`;

/**
 * A series a file at a time (addendum 22 §4a): the same dialog, reading
 * scripts, each becoming the next episode on a title page of its own.
 */
describe('adding episodes to a series', () => {
  it('reads each script as an episode after the last, numbered on its page', async () => {
    const start = createProjectFile({ title: 'Harbour', format: 'series' });
    const made: ProjectFile[] = [];
    render(<AddStoriesDialog open file={start} onClose={() => {}} onAdded={(next) => made.push(next)} />);
    expect(screen.getByLabelText('Add episodes to the series')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Add the episode' }) as HTMLButtonElement).disabled).toBe(true);

    choose([fileNamed('pilot.fdx', FDX('PILOT', 'INT. PRECINCT - NIGHT', 'MAEVE')), fileNamed('wreck.fdx', FDX('THE WRECK', 'EXT. HARBOUR - DAY', 'DR HALE')), fileNamed('notes.txt', 'x')], 'Episode files');
    await screen.findByText('2 episodes');
    expect(document.querySelector('.import-list')?.textContent).toContain('1 scene · 2 words');
    expect(screen.getByText(/notes.txt is not a Final Draft document/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Add 2 episodes' }));
    await waitFor(() => expect(made).toHaveLength(1));
    const all = episodes(made[0]!);
    expect(all.map((episode) => [episode.label, episode.title])).toEqual([
      ['EPISODE 1', 'PILOT'],
      ['EPISODE 2', 'THE WRECK'],
    ]);
    expect(all[1]?.marker.titlePage?.episode).toBe('Episode 2');
    expect(made[0]!.characters.map((person) => person.name)).toEqual(['MAEVE', 'DR HALE']);
  });
});
