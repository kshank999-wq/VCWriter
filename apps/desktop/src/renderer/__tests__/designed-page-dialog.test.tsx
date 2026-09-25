// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  createProjectFile,
  partStyleOf,
  partTemplateOf,
  partsOf,
  setTitlePage,
  type ProjectFile,
} from '@vcwriter/domain';

import { DesignedPageDialog } from '../components/DesignedPageDialog';

/**
 * The designed page's own screen (addendum 20 §9n, from Ken's handoff).
 *
 * What these pin is the three decisions: the mode is read off the record,
 * a template is a **height** with the alignment beside it, and Cancel puts
 * back the page as it stood when the screen opened.
 */

beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

afterEach(cleanup);

const book = (): ProjectFile =>
  setTitlePage(createProjectFile({ title: 'Villain’s Tales', format: 'novel', author: 'M. Shank' }), {
    title: 'Villain’s Tales',
  });

const halfTitle = (file: ProjectFile) => partsOf(file).find((part) => part.kind === 'half_title')!;

function Harness({ onFile, picked }: { onFile?: (file: ProjectFile) => void; picked?: string[] }) {
  const [file, setFile] = useState(book);
  return (
    <DesignedPageDialog
      file={file}
      part={halfTitle(file)}
      laying={null}
      onUpdate={(change) =>
        setFile((current) => {
          const next = change(current);
          onFile?.(next);
          return next;
        })
      }
      onClose={() => undefined}
      onPickLogo={() => picked?.push('logo')}
      onPickArt={() => picked?.push('art')}
      onOpenBookSettings={() => picked?.push('settings')}
      onTurn={() => undefined}
    />
  );
}

describe('the designed page’s screen', () => {
  it('names the page, shows the book’s title read-only, and sends the writer to Book settings to change it', () => {
    const picked: string[] = [];
    render(<Harness picked={picked} />);
    expect(screen.getByText('Half title')).toBeTruthy();
    expect(screen.getByText('Villain’s Tales')).toBeTruthy();
    // The title is the **book's**, so there is one place to type it.
    expect(screen.queryByLabelText('Title')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit in Book settings' }));
    expect(picked).toEqual(['settings']);
  });

  it('reads the mode off the page, and a tile is the act rather than a flag', () => {
    const picked: string[] = [];
    render(<Harness picked={picked} />);
    expect(screen.getByRole('button', { name: /^Title text/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /^Logotype/ }));
    // Choosing it opens the picker: what the page carries is what decides
    // the mode, so nothing is set until a picture arrives.
    expect(picked).toEqual(['logo']);
    fireEvent.click(screen.getByRole('button', { name: /^Full-page art/ }));
    expect(picked).toEqual(['logo', 'art']);
  });

  it('places by height, and the alignment is its own control', () => {
    let seen: ProjectFile | null = null;
    render(<Harness onFile={(file) => (seen = file)} />);
    /* The name appears twice on purpose — on its thumbnail and as what is
       in force — so the one that says *which* is asked for by its place. */
    const inForce = () => document.querySelector('.dp-says')?.textContent ?? '';
    // A page nobody has touched reads as a template rather than as custom.
    expect(inForce()).toBe('Upper third');
    fireEvent.click(screen.getByRole('button', { name: /Low/ }));
    let style = partStyleOf(halfTitle(seen as unknown as ProjectFile));
    expect(style.drop).toBe(62);
    // Ranging it left leaves it where it is: the template is the height.
    fireEvent.click(screen.getByRole('button', { name: 'Left' }));
    style = partStyleOf(halfTitle(seen as unknown as ProjectFile));
    expect(style.align).toBe('left');
    expect(partTemplateOf(style)).toBe('low');
    expect(inForce()).toBe('Low');
  });

  it('reads Custom once the height is dragged, and says how far the page has been taken', () => {
    render(<Harness />);
    expect(screen.getByText('Matches the front-matter style')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Height on the page'), { target: { value: '44' } });
    expect(screen.getByText('Custom · placed by hand')).toBeTruthy();
    expect(screen.getByText('1 change from the front-matter style')).toBeTruthy();
    // Leaf by leaf, so a writer who set three things is told three.
    fireEvent.click(screen.getByRole('button', { name: 'Small caps' }));
    fireEvent.click(screen.getByRole('button', { name: 'Italic' }));
    expect(screen.getByText('3 changes from the front-matter style')).toBeTruthy();
  });

  it('puts the page back as it stood when the screen opened', () => {
    let seen: ProjectFile | null = null;
    render(<Harness onFile={(file) => (seen = file)} />);
    fireEvent.change(screen.getByLabelText('Height on the page'), { target: { value: '70' } });
    fireEvent.click(screen.getByRole('button', { name: 'Right' }));
    expect(partStyleOf(halfTitle(seen as unknown as ProjectFile)).drop).toBe(70);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const style = partStyleOf(halfTitle(seen as unknown as ProjectFile));
    expect(style.drop).toBe(33);
    expect(style.align).toBe('center');
  });

  it('clears the page’s own settings with Reset', () => {
    let seen: ProjectFile | null = null;
    render(<Harness onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Rule under the title' }));
    expect(partStyleOf(halfTitle(seen as unknown as ProjectFile)).rule).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reset to page style' }));
    expect(halfTitle(seen as unknown as ProjectFile).style).toEqual({});
    expect(screen.getByText('Matches the front-matter style')).toBeTruthy();
  });
});
