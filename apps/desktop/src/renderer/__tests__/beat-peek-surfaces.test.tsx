// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { beatsForUnit, createProjectFile, unitsInStoryOrder, updateBeat, type ProjectFile } from '@vcwriter/domain';

import { SceneDialog } from '../components/SceneDialog';

/**
 * **Every surface that draws a beat says which beat it is** (addendum 02 §4c).
 *
 * This is the half that makes the hover universal. The card itself is one
 * component over the whole window, so what can go wrong is not the card —
 * it is a screen that draws a beat and never says so, which reads exactly
 * like the feature not being there. `cast-surfaces` is the precedent: a test
 * per surface rather than a test of the one reading they all share.
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

const book = (): ProjectFile => {
  const file = createProjectFile({ title: 'Villain’s Tales', format: 'novel', author: 'M. Shank' });
  const unit = unitsInStoryOrder(file)[0]!;
  const beat = beatsForUnit(file, unit.id)[0]!;
  return updateBeat(file, beat.id, { title: 'The light goes out', summary: 'She climbs to the lamp room.' });
};

describe('the surfaces that draw a beat', () => {
  it('gives the scene dialog’s list the beat’s id', () => {
    const file = book();
    const unit = unitsInStoryOrder(file)[0]!;
    const beat = beatsForUnit(file, unit.id)[0]!;
    render(<SceneDialog file={file} unitId={unit.id} onClose={() => undefined} onUpdate={() => undefined} />);
    const row = screen.getByText('The light goes out').closest('[data-beat]');
    expect(row).not.toBeNull();
    expect(row?.getAttribute('data-beat')).toBe(beat.id as string);
  });
});
