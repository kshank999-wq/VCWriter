// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  captureItemSchema,
  createProjectFile,
  newId,
  type CaptureItem,
  type CaptureItemId,
  type UserId,
} from '@vcwriter/domain';
import { MobileInbox } from '../components/MobileInbox';

/**
 * The mobile inbox, divided by the groups somebody said on a walk (addendum
 * 09 §12).
 *
 * What can go wrong here is not the division — the domain is tested for that —
 * but a screen that receives it and draws none of it, which reads exactly like
 * the feature not being there. That is `cast-surfaces`' shape, and the reason
 * this file exists rather than a third assertion in the domain suite.
 */

let tick = 0;
const said = (group: string | null, category = 'idea', text = 'a poster with nobody on it'): CaptureItem =>
  captureItemSchema.parse({
    id: newId<CaptureItemId>(),
    userId: newId<UserId>(),
    source: 'mobile_voice',
    capturedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, (tick += 1))).toISOString(),
    rawText: text,
    category,
    subcategory: group,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

const draw = (captures: CaptureItem[], onFileGroup = vi.fn()) => {
  const file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  render(
    <MobileInbox
      file={file}
      captures={captures}
      loading={false}
      error={null}
      draggingId={null}
      onDragStart={vi.fn()}
      onDragEnd={vi.fn()}
      onAcceptSuggestion={vi.fn()}
      onReject={vi.fn()}
      onRefresh={vi.fn()}
      onPlace={vi.fn()}
      onFileGroup={onFileGroup}
    />,
  );
  return { file, onFileGroup };
};

afterEach(cleanup);

describe('the inbox, divided by what was said on the walk', () => {
  it('heads each group and offers to make its folder', () => {
    draw([said('Marketing'), said('Marketing', 'idea', 'a trailer'), said(null)]);

    expect(screen.getByRole('heading', { name: 'Marketing' })).toBeTruthy();
    // The press says what it would do: make the folder, under the category's
    // own, and how many notes go with it.
    const button = screen.getByRole('button', { name: /Make Marketing and file all 2/ });
    expect(button.getAttribute('title')).toBe('Make Marketing under Ideas and file 2 notes into it');
    // The notes nobody grouped are listed and headed, and carry no button:
    // there is no folder to make out of *no group*.
    expect(screen.getByRole('heading', { name: 'No group' })).toBeTruthy();
  });

  it('draws no divisions at all where nobody said a group', () => {
    // A single heading reading *No group* over everything divides nothing.
    draw([said(null), said(null)]);
    expect(screen.queryByRole('heading', { name: 'No group' })).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('hands the press the category and the word, and nothing else', () => {
    const onFileGroup = vi.fn();
    draw([said('Marketing'), said('Marketing', 'idea', 'a trailer')], onFileGroup);
    fireEvent.click(screen.getByRole('button', { name: /Make Marketing and file all 2/ }));
    expect(onFileGroup).toHaveBeenCalledWith('idea', 'Marketing');
  });

  it('names the structural groups in the format’s own words', () => {
    // The desktop has always known the format and had never passed it, so a
    // scene note was headed *Scene or chapter* on a screenplay that has scenes.
    draw([said(null, 'unit', 'the kitchen, before anybody arrives')]);
    expect(screen.getByRole('heading', { name: /Scene/ })).toBeTruthy();
    expect(screen.queryByText(/Scene or chapter/)).toBeNull();
  });
});
