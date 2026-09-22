// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { addBeat, beginStory, createProjectFile, type Story } from '@vcwriter/domain';
import { StoryRail } from '../components/StoryRail';

/**
 * The stories down the right of a collection (addendum 22 §3): the episode
 * rail's shape with a story in each row.
 */

afterEach(cleanup);

describe('the story rail', () => {
  it('is drawn for a collection and for nothing else', () => {
    const { container } = render(
      <StoryRail file={createProjectFile({ title: 'A novel', format: 'novel' })} open onOpen={() => {}} currentUnitId={null} onGo={() => {}} onOpenPage={() => {}} onNew={() => {}} onRemove={() => {}} />,
    );
    expect(container.querySelector('.episode-rail')).toBeNull();
  });

  it('lists every story with its sections and words, goes to one, opens its page, and starts another', () => {
    let file = beginStory(createProjectFile({ title: 'Tales', format: 'short_story' }), { title: 'The Road' }).file;
    file = beginStory(file, { title: 'The Harbour' }).file;
    const went: string[] = [];
    const opened: string[] = [];
    let started = 0;
    render(
      <StoryRail
        file={file}
        open
        onOpen={() => {}}
        currentUnitId={null}
        onGo={(story: Story) => went.push(story.placed.marker.title)}
        onOpenPage={(story: Story) => opened.push(story.placed.marker.title)}
        onNew={() => {
          started += 1;
        }}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByLabelText('Stories')).toBeTruthy();
    expect(screen.getByText('The Road')).toBeTruthy();
    expect(screen.getByText('The Harbour')).toBeTruthy();
    expect(screen.getAllByText(/1 section · 0 words/)).toHaveLength(2);
    fireEvent.click(screen.getByText('The Harbour'));
    expect(went).toEqual(['The Harbour']);
    fireEvent.doubleClick(screen.getByText('The Road'));
    expect(opened).toEqual(['The Road']);
    fireEvent.click(screen.getByRole('button', { name: '+ New story' }));
    expect(started).toBe(1);
  });

  /**
   * From Ken: *I added a story by accident. I need the ability to remove a
   * story also. Maybe a little X in the box when you hover over it. And then
   * when you hit the X, it asks you, are you sure?*
   */
  it('asks before it removes, and says what would go', () => {
    let file = beginStory(createProjectFile({ title: 'Tales', format: 'short_story' }), { title: 'The Road' }).file;
    file = beginStory(file, { title: 'By Accident' }).file;
    const removed: string[] = [];
    render(
      <StoryRail
        file={file}
        open
        onOpen={() => {}}
        currentUnitId={null}
        onGo={() => {}}
        onOpenPage={() => {}}
        onNew={() => {}}
        onRemove={(story: Story) => removed.push(story.placed.marker.title)}
      />,
    );
    // The × is on the row and pressing it removes nothing on its own.
    fireEvent.click(screen.getByRole('button', { name: 'Remove By Accident' }));
    expect(removed).toEqual([]);
    // Nothing is written in it, so that is what it says.
    expect(screen.getByText(/Nothing is written in it/)).toBeTruthy();
    // Keeping it puts the × back and still removes nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(removed).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove By Accident' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(removed).toEqual(['By Accident']);
  });

  it('promises the words are safe where a story has been written in', () => {
    let file = beginStory(createProjectFile({ title: 'Tales', format: 'short_story' }), { title: 'The Road' }).file;
    const made = beginStory(file, { title: 'The Harbour' });
    file = made.file;
    const unit = made.unitId!;
    const made2 = addBeat(file, { unitId: unit, title: 'One' });
    file = {
      ...made2.file,
      beats: made2.file.beats.map((one) =>
        one.id === made2.beat.id
          ? { ...one, manuscript: { elements: [{ id: 'e1', type: 'action', text: 'The harbour was empty.', attributes: {} }] } }
          : one,
      ),
    } as typeof file;
    render(
      <StoryRail file={file} open onOpen={() => {}} currentUnitId={null} onGo={() => {}} onOpenPage={() => {}} onNew={() => {}} onRemove={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove The Harbour' }));
    expect(screen.getByText(/not a word is cut/)).toBeTruthy();
  });
});
