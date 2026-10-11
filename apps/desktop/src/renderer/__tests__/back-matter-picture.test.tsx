// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  addPart,
  createProjectFile,
  partTakesInsets,
  partsOf,
  type BookPart,
  type ProjectFile,
} from '@vcwriter/domain';
import { BackMatterDialog } from '../components/BackMatterDialog';

/**
 * **A picture on a back-matter page** (addendum 20 §19a, from Ken: *on the
 * reader's extra page there needs to be the ability to add a picture*).
 *
 * It was **built and unreachable**: `partTakesInsets` has said yes to every
 * prose part since §8, `addPartInset` cuts the picture into the words, and
 * `PartPictures` is the panel that does it — rendered only in the part
 * dialog, which a back-matter page has not opened since §17 gave it a screen
 * of its own. §15c's own rule failing in the direction it warns about.
 *
 * So what this pins is the **gesture** (§15a): the panel is on the screen
 * that page opens, and a kind that takes a picture gets one.
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

const withPart = (kind: BookPart['kind']) => {
  const made = addPart(createProjectFile({ title: 'The Lamp', format: 'novel', author: 'K. Shank' }), kind);
  return { file: made.file, partId: made.partId as string };
};

function Screen({ initial, partId, slot }: { initial: ProjectFile; partId: string; slot: boolean }) {
  const [file, setFile] = useState(initial);
  const part = partsOf(file).find((one) => one.id === partId) ?? null;
  return (
    <BackMatterDialog
      file={file}
      part={part}
      laying={null}
      onUpdate={(mutate) => setFile((current) => mutate(current))}
      onClose={() => undefined}
      onPickPhoto={() => undefined}
      onTurn={() => undefined}
      pictures={slot && part && partTakesInsets(part.kind) ? <div data-testid="pictures">Pictures</div> : null}
    />
  );
}

describe('the back matter’s own screen', () => {
  it('takes the room’s picture panel, where the page can carry one', () => {
    // The domain has said yes since §8; what was missing is this.
    expect(partTakesInsets('reader_extra')).toBe(true);
    const { file, partId } = withPart('reader_extra');
    render(<Screen initial={file} partId={partId} slot />);
    const dialog = document.querySelector('dialog') as HTMLElement;
    expect(within(dialog).getByTestId('pictures')).toBeTruthy();
  });

  it('is a slot, so there is one panel rather than a second written here', () => {
    /**
     * The half that can fail silently: a panel that never arrives because the
     * node was not passed down looks exactly like the feature not being there
     * (addendum 09 §8c, §15a).
     */
    const { file, partId } = withPart('reader_extra');
    render(<Screen initial={file} partId={partId} slot={false} />);
    expect(screen.queryByTestId('pictures')).toBeNull();
  });

  it('is absent on a page that carries no words to cut into', () => {
    expect(partTakesInsets('index')).toBe(false);
    const { file, partId } = withPart('index');
    render(<Screen initial={file} partId={partId} slot />);
    expect(screen.queryByTestId('pictures')).toBeNull();
  });
});
