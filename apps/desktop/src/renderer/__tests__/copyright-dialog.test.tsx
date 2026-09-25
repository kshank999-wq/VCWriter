// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  copyrightOf,
  copyrightOrder,
  createProjectFile,
  partStyleOf,
  partsOf,
  type ProjectFile,
} from '@vcwriter/domain';

import { CopyrightPageDialog } from '../components/CopyrightPageDialog';

/**
 * The copyright page dialog (addendum 20 §15, from Ken's handoff). What these
 * pin is that the **order and the switches reach the page**, and that turning
 * an element off keeps its words — the distinction the whole thing rests on.
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

const book = (): ProjectFile => createProjectFile({ title: 'The Lamp', format: 'novel', author: 'M. Shank' });
const copyrightPart = (file: ProjectFile) => partsOf(file).find((part) => part.kind === 'copyright')!;

function Harness({ onFile }: { onFile?: (file: ProjectFile) => void }) {
  const [file, setFile] = useState(book);
  return (
    <CopyrightPageDialog
      file={file}
      part={copyrightPart(file)}
      onUpdate={(change) =>
        setFile((current) => {
          const next = change(current);
          onFile?.(next);
          return next;
        })
      }
      onClose={() => undefined}
      onPickBarcode={() => undefined}
      onDropBarcode={() => undefined}
    />
  );
}

describe('the copyright page', () => {
  it('lists every element, with the two a book may not print without marked', () => {
    render(<Harness />);
    expect(screen.getByText('Fiction disclaimer')).toBeTruthy();
    expect(screen.getByText('Library of Congress')).toBeTruthy();
    // The required two carry a badge instead of a switch.
    expect(screen.getAllByText('Required')).toHaveLength(2);
    expect(screen.queryByLabelText('Show Copyright notice')).toBeNull();
    expect(screen.getByLabelText('Show Fiction disclaimer')).toBeTruthy();
  });

  it('moves an element, and says so for a reader who cannot see it', () => {
    let seen: ProjectFile | null = null;
    render(<Harness onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByLabelText('Move Copyright notice up'));
    const page = copyrightOf(copyrightPart(seen as unknown as ProjectFile))!;
    expect(copyrightOrder(page)[0]).toBe('notice');
    expect(screen.getByText(/Copyright notice moved to 1 of/)).toBeTruthy();
  });

  it('keeps an element’s words when it is switched off', () => {
    let seen: ProjectFile | null = null;
    render(<Harness onFile={(file) => (seen = file)} />);
    // Type something into the disclaimer, then switch it off.
    fireEvent.click(screen.getByRole('button', { name: /^Fiction disclaimer/ }));
    fireEvent.change(screen.getByLabelText('Fiction disclaimer'), { target: { value: 'A work of fiction.' } });
    fireEvent.click(screen.getByLabelText('Show Fiction disclaimer'));
    const page = copyrightOf(copyrightPart(seen as unknown as ProjectFile))!;
    expect(page.hidden).toContain('disclaimer');
    // The words are still there, which is what makes this different from
    // clearing the field — and is the whole reason both exist.
    expect(page.disclaimer).toBe('A work of fiction.');
  });

  it('takes a standard order, and says which one is in force', () => {
    let seen: ProjectFile | null = null;
    render(<Harness onFile={(file) => (seen = file)} />);
    expect(screen.getByText('Trade standard order')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Indie minimal' }));
    const file = seen as unknown as ProjectFile;
    const page = copyrightOf(copyrightPart(file))!;
    expect(page.position).toBe('middle');
    expect(page.hidden).toContain('lccn');
    // The alignment goes to the page's own style, not to a second field.
    expect(partStyleOf(copyrightPart(file)).align).toBe('center');
  });

  it('reads Custom once the writer moves something', () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('Move Permissions up'));
    expect(screen.getByText('Custom order')).toBeTruthy();
  });

  it('writes the type size to the page’s own style', () => {
    let seen: ProjectFile | null = null;
    render(<Harness onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByRole('button', { name: '10 pt' }));
    expect(partStyleOf(copyrightPart(seen as unknown as ProjectFile)).title.size).toBe(10);
  });

  it('marks a book number whose check digit does not add up, and says nothing about an empty one', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /^ISBNs/ }));
    fireEvent.click(screen.getByRole('button', { name: '+ Another number' }));
    const box = screen.getByLabelText('Number 1');
    // Empty is not a mistake — it is a number the writer has not got yet.
    expect(box.getAttribute('aria-invalid')).not.toBe('true');
    fireEvent.change(box, { target: { value: '9780306406158' } });
    expect(screen.getByLabelText('Number 1').getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(screen.getByLabelText('Number 1'), { target: { value: '978-0-306-40615-7' } });
    expect(screen.getByLabelText('Number 1').getAttribute('aria-invalid')).not.toBe('true');
  });

  it('draws the page from the reading the printed book asks', () => {
    render(<Harness />);
    const sheet = document.querySelector('.cr-sheet') as HTMLElement;
    expect(within(sheet).getByText('The Lamp')).toBeTruthy();
    expect(within(sheet).getByText(/Copyright © .* M\. Shank/)).toBeTruthy();
    // Switching one off takes it off the page.
    expect(within(sheet).getByText('All rights reserved.')).toBeTruthy();
  });

  it('says how much is still to fill in', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /^Credits/ }));
    fireEvent.change(screen.getByLabelText('Credits'), { target: { value: 'Cover by [NAME]' } });
    expect(screen.getByText('1 thing still to fill in')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Credits'), { target: { value: 'Cover by Ada' } });
    expect(screen.getByText('Nothing left to fill in')).toBeTruthy();
  });
});
