// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  aboutAuthorOf,
  acknowledgementsOf,
  addPart,
  backSinkOf,
  bibliographyOf,
  glossaryOf,
  readerExtraOf,
  isBackMatterPage,
  bookSettingsOf,
  chapterPageStyleSchema,
  createProjectFile,
  partStyleOf,
  partsOf,
  proseStyleBase,
  updatePart,
  type BookPart,
  type PartKind,
  type ProjectFile,
} from '@vcwriter/domain';

import { BackMatterDialog } from '../components/BackMatterDialog';

/**
 * The back matter's own screen (addendum 20 §17, from Ken's handoff).
 *
 * What these pin is the shape rather than the styling: one shell behind every
 * page, a first section that is the page's own, a navigator that steps
 * through the pages the **book has**, and Cancel putting back the page as it
 * stood when the screen opened.
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

/** A book carrying the two pages whose first section is built. */
const book = (): ProjectFile => {
  let file = createProjectFile({ title: 'Villain’s Tales', format: 'novel', author: 'M. Shank' });
  for (const kind of ['acknowledgements', 'appendix', 'glossary', 'bibliography', 'index', 'about_the_author', 'reader_extra'] as PartKind[]) {
    if (!partsOf(file).some((one) => one.kind === kind)) file = addPart(file, kind).file;
  }
  return file;
};

/** A book whose writer has marked one term, so the pull has something real. */
const withMark = (): ProjectFile => {
  const file = book();
  const beat = file.beats[0]!;
  return {
    ...file,
    indexMarks: [
      { id: 'm1', projectId: file.project.id, term: 'Fresnel lens', subTerm: '', beatId: beat.id, elementId: beat.manuscript.elements[0]?.id ?? 'e1', quote: '', principal: true, createdAt: '', updatedAt: '' },
    ] as never,
  };
};

const pageOf = (file: ProjectFile, kind: PartKind): BookPart => partsOf(file).find((one) => one.kind === kind)!;

const styleOf = (file: ProjectFile, part: BookPart) =>
  partStyleOf(part, proseStyleBase(chapterPageStyleSchema.parse(file.settings.chapterPageStyle ?? {}), bookSettingsOf(file).size));

function Harness({
  kind = 'acknowledgements' as PartKind,
  onFile,
  picked,
  turned,
  start,
}: {
  kind?: PartKind;
  onFile?: (file: ProjectFile) => void;
  picked?: string[];
  turned?: string[];
  start?: () => ProjectFile;
}) {
  const [file, setFile] = useState(start ?? book);
  const [at, setAt] = useState<PartKind | string>(kind);
  const part = partsOf(file).find((one) => one.id === at) ?? pageOf(file, kind);
  return (
    <BackMatterDialog
      file={file}
      part={part}
      laying={null}
      onUpdate={(change) =>
        setFile((current) => {
          const next = change(current);
          onFile?.(next);
          return next;
        })
      }
      onClose={() => undefined}
      onPickPhoto={(id) => picked?.push(id)}
      onTurn={(id) => {
        turned?.push(id);
        setAt(id);
      }}
    />
  );
}

describe('the back matter’s screen', () => {
  it('names the page and steps through the pages the book has', () => {
    const turned: string[] = [];
    const file = book();
    render(<Harness turned={turned} start={() => file} />);
    expect(screen.getByText('Acknowledgements')).toBeTruthy();
    // It counts the pages the **book has** rather than the seven the handoff
    // names: a navigator offering a page the book does not carry would lie.
    const pages = partsOf(file).filter((one) => isBackMatterPage(one.kind));
    const at = pages.findIndex((one) => one.kind === 'acknowledgements') + 1;
    expect(screen.getByText((_, node) => node?.textContent === `Back matter · ${at} of ${pages.length}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'The page after' }));
    expect(turned.length).toBe(1);
  });

  it('gives the acknowledgements a sign-off whose words survive switching it off', () => {
    let seen: ProjectFile | null = null;
    render(<Harness onFile={(file) => (seen = file)} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Sign-off line' }));
    fireEvent.change(screen.getByLabelText('Sign-off line text'), { target: { value: '— M. S.' } });
    const after = seen as unknown as ProjectFile;
    expect(acknowledgementsOf(pageOf(after, 'acknowledgements')).signOffText).toBe('— M. S.');
    fireEvent.click(screen.getByRole('switch', { name: 'Sign-off line' }));
    const off = seen as unknown as ProjectFile;
    expect(acknowledgementsOf(pageOf(off, 'acknowledgements')).signOff).toBe(false);
    expect(acknowledgementsOf(pageOf(off, 'acknowledgements')).signOffText).toBe('— M. S.');
  });

  it('writes the biography to the page’s words, there being no second place for them', () => {
    let seen: ProjectFile | null = null;
    render(<Harness kind={'about_the_author' as PartKind} onFile={(file) => (seen = file)} />);
    fireEvent.change(screen.getByLabelText('Biography'), { target: { value: 'She writes at night.' } });
    expect(pageOf(seen as unknown as ProjectFile, 'about_the_author').text).toBe('She writes at night.');
  });

  it('opens the room’s own picker, and asks nothing about a picture that is not there', () => {
    const picked: string[] = [];
    const file = book();
    render(<Harness kind={'about_the_author' as PartKind} picked={picked} start={() => file} />);
    // Where it goes and what shape it is are questions about a picture.
    expect(screen.queryByRole('group', { name: 'Where the photo goes' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'The photo’s shape' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Choose…' }));
    expect(picked).toEqual([pageOf(file, 'about_the_author').id]);
  });

  it('asks where the photograph goes once there is one, and drops the shape at None', () => {
    const start = () => {
      const file = book();
      return updatePart(file, pageOf(file, 'about_the_author').id, { about: { photoAssetId: 'photo-1' } });
    };
    render(<Harness kind={'about_the_author' as PartKind} start={start} />);
    expect(screen.queryByRole('group', { name: 'The photo’s shape' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(screen.queryByRole('group', { name: 'The photo’s shape' })).toBeNull();
  });

  it('sets the sink, starting where the handoff’s table puts the page', () => {
    let seen: ProjectFile | null = null;
    const file = book();
    render(<Harness onFile={(one) => (seen = one)} start={() => file} />);
    expect(screen.getByRole('button', { name: 'Standard' }).getAttribute('aria-pressed')).toBe('true');
    // *At the head* is the fourth step the handoff does not name: where every
    // prose page used to sit, one press away.
    fireEvent.click(screen.getByRole('button', { name: 'At the head' }));
    const after = seen as unknown as ProjectFile;
    expect(backSinkOf(styleOf(after, pageOf(after, 'acknowledgements')))).toBe('head');
  });

  it('offers no sink on a page that flows, there being no block on a page to place', () => {
    const file = book();
    const index = pageOf(file, 'index');
    render(<Harness kind={index.id as PartKind} start={() => file} />);
    expect(screen.queryByRole('group', { name: 'Sink' })).toBeNull();
  });

  it('puts the page back as it stood when Cancel is pressed', () => {
    let seen: ProjectFile | null = null;
    render(<Harness onFile={(file) => (seen = file)} />);
    fireEvent.change(screen.getByLabelText('Heading text'), { target: { value: 'With thanks' } });
    expect(pageOf(seen as unknown as ProjectFile, 'acknowledgements').title).toBe('With thanks');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(pageOf(seen as unknown as ProjectFile, 'acknowledgements').title).not.toBe('With thanks');
  });

  it('clears the style and never the words', () => {
    let seen: ProjectFile | null = null;
    const start = () => {
      const file = book();
      return updatePart(file, pageOf(file, 'acknowledgements').id, { text: 'Thank you.', style: { rule: true } });
    };
    render(<Harness onFile={(file) => (seen = file)} start={start} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset to page style' }));
    const after = pageOf(seen as unknown as ProjectFile, 'acknowledgements');
    expect(after.style).toEqual({});
    expect(after.text).toBe('Thank you.');
  });

  it('works an appendix’s label out from where it falls, with nowhere to type one', () => {
    const file = book();
    render(<Harness kind={pageOf(file, 'appendix').id as PartKind} start={() => file} />);
    expect(screen.getByText('Appendix A')).toBeTruthy();
    expect(screen.getByText(/The only appendix, so it is A/)).toBeTruthy();
    expect(screen.queryByLabelText('Appendix label')).toBeNull();
    expect(screen.getByRole('group', { name: 'Labels' })).toBeTruthy();
  });

  it('pulls the terms the book marks into the glossary, and refuses a second press', () => {
    let seen: ProjectFile | null = null;
    const start = withMark();
    render(<Harness kind={pageOf(start, 'glossary').id as PartKind} onFile={(one) => (seen = one)} start={() => start} />);
    expect(screen.getByText(/Add 1 term the book marks — Fresnel lens/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pull from the text' }));
    const after = seen as unknown as ProjectFile;
    expect(glossaryOf(pageOf(after, 'glossary')).terms.map((one) => one.term)).toEqual(['Fresnel lens']);
    // The definition is the work, and it is left to the writer.
    expect(glossaryOf(pageOf(after, 'glossary')).terms[0]?.definition).toBe('');
    expect(screen.queryByRole('button', { name: 'Pull from the text' })).toBeNull();
    expect(screen.getByText(/Every term the book marks is already here/)).toBeTruthy();
  });

  it('draws no pull button where the page has nothing to take, and says why', () => {
    const file = book();
    for (const [kind, says] of [
      ['index', /already read from the text/],
      ['acknowledgements', /Nobody but you/],
    ] as const) {
      cleanup();
      render(<Harness kind={pageOf(file, kind).id as PartKind} start={() => file} />);
      expect(screen.queryByRole('button', { name: 'Pull from the text' })).toBeNull();
      if (kind === 'index') expect(screen.getByText(says)).toBeTruthy();
    }
  });

  it('keeps a letter heading off an unsorted glossary, there being nothing to head', () => {
    const file = book();
    render(<Harness kind={pageOf(file, 'glossary').id as PartKind} start={() => file} />);
    expect(screen.getByRole('switch', { name: 'A letter over each group' })).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Sort A–Z' }));
    expect(screen.queryByRole('switch', { name: 'A letter over each group' })).toBeNull();
  });

  it('sets a bibliography’s style, and shows a free entry as one box rather than five', () => {
    let seen: ProjectFile | null = null;
    const start = () => {
      const file = book();
      return updatePart(file, pageOf(file, 'bibliography').id, {
        about: { sources: [{ id: '1', author: '', title: '', city: '', publisher: '', year: '', raw: 'A note in full.' }] },
      });
    };
    render(<Harness kind={'bibliography' as PartKind} onFile={(one) => (seen = one)} start={start} />);
    expect(screen.getByLabelText('The entry as written')).toBeTruthy();
    expect(screen.queryByLabelText('Publisher')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'APA' }));
    expect(bibliographyOf(pageOf(seen as unknown as ProjectFile, 'bibliography')).style).toBe('apa');
  });

  it('names a reader extra after the kind it is, and *Also by* after the author', () => {
    let seen: ProjectFile | null = null;
    const file = book();
    render(<Harness kind={pageOf(file, 'reader_extra').id as PartKind} onFile={(one) => (seen = one)} start={() => file} />);
    expect(screen.getByText(/It will be headed “Want More\?”/)).toBeTruthy();
    expect(screen.getByLabelText('Sign-up link')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Also by the author/ }));
    expect(readerExtraOf(pageOf(seen as unknown as ProjectFile, 'reader_extra')).kind).toBe('also_by');
    expect(screen.getByText(/It will be headed “Also by M. Shank”/)).toBeTruthy();
    // A newsletter's controls are the newsletter's: absent on another kind.
    expect(screen.queryByLabelText('Sign-up link')).toBeNull();
  });

  it('does not offer the two built sections on a page they are not about', () => {
    const file = book();
    render(<Harness kind={pageOf(file, 'index').id as PartKind} start={() => file} />);
    expect(screen.queryByRole('switch', { name: 'Sign-off line' })).toBeNull();
    expect(screen.queryByLabelText('Biography')).toBeNull();
    expect(aboutAuthorOf(pageOf(file, 'about_the_author')).photoAssetId).toBeNull();
  });
});
