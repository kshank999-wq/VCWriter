// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beginStory, createProjectFile, episodes, importChoices, storiesOf, type ProjectFile } from '@vcwriter/domain';
import { ImportDialog } from '../components/ImportDialog';
import { menusFor } from '../menus';
import { buildDocx, wordParagraph } from './zip-fixture';

/**
 * A collection of stories (addendum 22): adding stories from files, and the
 * menu item that offers it on a collection alone.
 *
 * **One dialog since addendum 33 §10.** *More stories* and *More episodes*
 * had a screen of their own, with none of the controls the import dialog
 * grew — no marks, no passage split, nothing to say where a story divides —
 * and Ken asked for *the same formatting dialog box*. Two screens that import
 * a story are two answers to what an import is, so these drive the one that
 * is left, with the kind saying where it lands.
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

/** The dialog as the workspace renders it, with nothing landed yet. */
const adding = (file: ProjectFile, made: ProjectFile[], kind: 'stories' | 'episodes' = 'stories') =>
  render(
    <ImportDialog
      open
      kind={kind}
      file={file}
      landed={null}
      onClose={() => {}}
      onImported={(next) => made.push(next)}
      onAdded={(next) => made.push(next)}
    />,
  );

describe('adding stories to a collection', () => {
  it('reads each file as a story, lists them, and adds them after the last', async () => {
    const start = beginStory(createProjectFile({ title: 'Tales', format: 'short_story' }), { title: 'The Road' }).file;
    const made: ProjectFile[] = [];
    adding(start, made);
    expect((screen.getByRole('button', { name: 'Add to the end' }) as HTMLButtonElement).disabled).toBe(true);

    choose([
      fileNamed('harbour.docx', HARBOUR()),
      fileNamed('the-lamp.txt', 'The lamp had been in the family.\n\nIt was the first thing she reached for.'),
      fileNamed('notes.pdf', 'x'),
    ]);
    await screen.findByLabelText('Files in order');
    expect(document.querySelector('.import-order')?.textContent).toContain('The Harbour');
    expect(document.querySelector('.import-order')?.textContent).toContain('the-lamp');
    expect(screen.getByText(/notes.pdf: That is not a Word document or a text file/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Add to the end' }));
    await waitFor(() => expect(made).toHaveLength(1));
    const stories = storiesOf(made[0]!);
    expect(stories.map((story) => story.placed.marker.title)).toEqual(['The Road', 'The Harbour', 'the-lamp']);
    expect(stories[1]?.sections.map((unit) => unit.title)).toEqual(['I', 'II']);
    expect(stories[2]?.sections).toHaveLength(1);
  });

  it('puts the stories in the order the arrows say', async () => {
    const start = createProjectFile({ title: 'Tales', format: 'short_story' });
    const made: ProjectFile[] = [];
    adding(start, made);
    choose([fileNamed('harbour.docx', HARBOUR()), fileNamed('the-lamp.txt', 'The lamp had been in the family.')]);
    await screen.findByLabelText('Files in order');
    fireEvent.click(screen.getByRole('button', { name: 'Move the-lamp up' }));
    expect([...document.querySelectorAll('.import-order-title')].map((node) => node.textContent)).toEqual([
      '1. the-lamp',
      '2. The Harbour',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to the end' }));
    await waitFor(() => expect(made).toHaveLength(1));
    // The seeded section the project is born with is still ahead of them.
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
    adding(start, made, 'episodes');
    expect(screen.getByLabelText('Add episodes to the series')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Add to the end' }) as HTMLButtonElement).disabled).toBe(true);

    choose(
      [
        fileNamed('pilot.fdx', FDX('PILOT', 'INT. PRECINCT - NIGHT', 'MAEVE')),
        fileNamed('wreck.fdx', FDX('THE WRECK', 'EXT. HARBOUR - DAY', 'DR HALE')),
        fileNamed('notes.txt', 'x'),
      ],
      'Episode files',
    );
    await screen.findByLabelText('Files in order');
    expect(screen.getByText(/notes.txt: That is not a Final Draft document/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Add to the end' }));
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

/**
 * **The next story** (addendum 33 §10, from Ken: *there needs to be a button
 * for next story. And when you add it, it adds it onto the end… this will
 * allow you to bring in finished works*).
 *
 * What is pinned is the round, because the fault it replaces was a second
 * import **making a second book**: the dialog stays up, says what is in, and
 * the file chosen next goes on the end of what it just made.
 */
describe('one story at a time', () => {
  it('stays open after the first and says what the collection holds', async () => {
    const made: ProjectFile[] = [];
    const view = render(
      <ImportDialog
        open
        kind="collection"
        file={null}
        landed={null}
        onClose={() => {}}
        onImported={(next, names) => made.push(next) && names}
        onAdded={(next) => made.push(next)}
      />,
    );
    choose([fileNamed('harbour.docx', HARBOUR())]);
    await screen.findByText(/What the document is/);
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(made).toHaveLength(1));

    // The workspace hands back what landed, exactly as it does on the screen.
    const first = made[0]!;
    view.rerender(
      <ImportDialog
        open
        kind="collection"
        file={first}
        landed={{ file: first, names: ['The Harbour'] }}
        onClose={() => {}}
        onImported={(next) => made.push(next)}
        onAdded={(next) => made.push(next)}
      />,
    );
    expect(document.querySelector('.import-landed')?.textContent).toContain('The Harbour');
    expect(screen.getByRole('button', { name: 'Import another story…' })).toBeTruthy();
  });

  it('adds the next document to the end rather than making a second book', async () => {
    const first = beginStory(createProjectFile({ title: 'Tales', format: 'short_story' }), { title: 'The Road' }).file;
    const made: ProjectFile[] = [];
    render(
      <ImportDialog
        open
        kind="collection"
        file={first}
        landed={{ file: first, names: ['The Road'] }}
        onClose={() => {}}
        onImported={(next) => made.push(next)}
        onAdded={(next) => made.push(next)}
      />,
    );
    choose([fileNamed('harbour.docx', HARBOUR())]);
    await screen.findByText(/What the document is/);
    fireEvent.click(screen.getByRole('button', { name: 'Add to the end' }));
    await waitFor(() => expect(made).toHaveLength(1));
    // The same project, one story longer — never a new one, which is what
    // overwrote a finished story.
    expect(made[0]!.project.id).toBe(first.project.id);
    expect(storiesOf(made[0]!).map((story) => story.placed.marker.title)).toEqual(['The Road', 'The Harbour']);
  });
});
