// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beginStory, createProjectFile, storiesOf, type ProjectFile } from '@vcwriter/domain';
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

const choose = (files: File[]) => {
  const picker = screen.getByLabelText('Story files') as HTMLInputElement;
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

  it('is on the File menu of a collection and nowhere else', () => {
    const commandsFor = (format: 'short_story' | 'novel') =>
      menusFor(format).flatMap((menu) => menu.items.filter(Boolean).map((item) => item!.command));
    expect(commandsFor('short_story')).toContain('file.importStories');
    expect(commandsFor('novel')).not.toContain('file.importStories');
  });
});
