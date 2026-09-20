// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beginStory, createProjectFile, type Story } from '@vcwriter/domain';
import { StoryRail } from '../components/StoryRail';

/**
 * The stories down the right of a collection (addendum 22 §3): the episode
 * rail's shape with a story in each row.
 */

afterEach(cleanup);

describe('the story rail', () => {
  it('is drawn for a collection and for nothing else', () => {
    const { container } = render(
      <StoryRail file={createProjectFile({ title: 'A novel', format: 'novel' })} open onOpen={() => {}} currentUnitId={null} onGo={() => {}} onOpenPage={() => {}} onNew={() => {}} />,
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
});
