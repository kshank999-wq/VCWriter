// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createProjectFile, type ProjectFile, type ProjectFormat } from '@vcwriter/domain';
import { ResearchWindow } from '../components/ResearchWindow';

/**
 * **The Character Creator, in Research, in every story format** (from Ken:
 * *the screenplay, the series or episodic, the novel, the stage play, and
 * short stories and collections have the character creator module in it, in
 * the research section*).
 *
 * Pinned rather than assumed: the room offers the module on every format but
 * an instructional book, and a later change that narrowed that rule would
 * take a writer's cast away from them silently. So each of the five is driven
 * the whole way — the section is there, a character is made from it, and the
 * Creator opens on them — beside the map and the review that read the cast.
 */

afterEach(cleanup);

function Harness({ start }: { start: ProjectFile }) {
  const [file, setFile] = useState(start);
  return (
    <ResearchWindow
      file={file}
      open
      currentBeatId={null}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      onClose={() => undefined}
    />
  );
}

const STORY_FORMATS: [ProjectFormat, string][] = [
  ['screenplay', 'Screenplay'],
  ['series', 'Series or episodic'],
  ['novel', 'Novel'],
  ['stage_play', 'Stage play'],
  ['short_story', 'Short stories and collections'],
];

describe('the Character Creator in Research', () => {
  for (const [format, name] of STORY_FORMATS) {
    it(`is in a ${name}, and opens on a character made there`, () => {
      render(<Harness start={createProjectFile({ title: 'The Lamp', format })} />);
      expect(screen.getByRole('heading', { name: 'Character Creator' })).toBeTruthy();
      expect(screen.getByText('Character map')).toBeTruthy();
      expect(screen.getByText('Character review')).toBeTruthy();

      fireEvent.click(screen.getByText('+ New character'));
      const who = screen.getByLabelText('Who?');
      fireEvent.change(who, { target: { value: 'Sarah' } });
      fireEvent.submit(who.closest('form') as HTMLFormElement);

      // The Creator itself, on the person just made.
      const creator = document.querySelector('.creator');
      expect(creator).not.toBeNull();
      expect(creator?.querySelector('.creator-head')?.textContent).toContain('Sarah');
    });
  }

  it('is not offered on an instructional book, which has no cast', () => {
    render(<Harness start={createProjectFile({ title: 'Statics', format: 'instructional' })} />);
    expect(screen.queryByRole('heading', { name: 'Character Creator' })).toBeNull();
  });
});
