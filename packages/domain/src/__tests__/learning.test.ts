import { describe, expect, it } from 'vitest';
import {
  acceptSuggestion,
  aidFor,
  aidStanding,
  aidsOn,
  addBeat,
  addUnit,
  approveAid,
  createProjectFile,
  describeAids,
  discardSuggestion,
  fromRows,
  orphanedAids,
  printedAidsOn,
  sectionTextFor,
  sectionsWorthAiding,
  suggestAid,
  toRows,
  updateBeat,
  writeAid,
  type ManuscriptElementId,
  type ProjectFile,
} from '../index.js';

/**
 * Learning aids (addendum 16 §10).
 *
 * §10 makes three demands and the tests below are mostly about the third,
 * because it is the one that costs somebody an afternoon when it is wrong:
 * **regeneration must not overwrite author-edited content.** Here that is kept
 * structurally — regeneration writes to a field the author's words are not in —
 * so these hold the structure rather than a promise.
 */

const para = (text: string) => ({
  id: crypto.randomUUID() as ManuscriptElementId,
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

const book = () => {
  let file: ProjectFile = createProjectFile({ title: 'Teaching Statistics', format: 'instructional' });
  const chapter = addUnit(file, { laneId: file.lanes[0]!.id, title: 'Sampling' });
  const beat = addBeat(chapter.file, { unitId: chapter.unit.id, title: 'What a sample is' });
  file = updateBeat(beat.file, beat.beat.id, {
    manuscript: {
      elements: [
        para('A sample stands in for a population.'),
        para('The sampling distribution of the mean is narrower than the population.'),
      ],
    },
  });
  return { file, beatId: beat.beat.id };
};

describe('an aid is the author’s', () => {
  it('is empty and unapproved when it is made', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'summary');
    expect(made.aid.text).toBe('');
    expect(made.aid.approved).toBe(false);
    // Optional, so nothing is written yet is a fact rather than a fault.
    expect(aidStanding(made.aid).says).toBe('Nothing written yet.');
  });

  it('returns the same aid when asked for twice', () => {
    const { file, beatId } = book();
    const first = aidFor(file, beatId, 'summary');
    const second = aidFor(first.file, beatId, 'summary');
    expect(second.aid.id).toBe(first.aid.id);
    expect(second.file.learningAids).toHaveLength(1);
  });

  it('prints only once the author approves it', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'summary');
    let current = writeAid(made.file, made.aid.id, { text: 'Samples estimate populations.' });
    // Written is not the same as in the book.
    expect(printedAidsOn(current, beatId)).toHaveLength(0);

    current = approveAid(current, made.aid.id);
    expect(printedAidsOn(current, beatId)).toHaveLength(1);
  });

  it('keeps every word when it is taken back out of the book', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'summary');
    let current = writeAid(made.file, made.aid.id, { text: 'Samples estimate populations.' });
    current = approveAid(current, made.aid.id);
    current = approveAid(current, made.aid.id, false);

    expect(printedAidsOn(current, beatId)).toHaveLength(0);
    expect(current.learningAids[0]!.text).toBe('Samples estimate populations.');
  });

  it('never prints an approved aid with nothing in it', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'summary');
    const current = approveAid(made.file, made.aid.id);
    expect(printedAidsOn(current, beatId)).toHaveLength(0);
  });
});

describe('regeneration cannot overwrite an edit', () => {
  it('writes to the suggestion and leaves the author’s words alone', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'summary');
    let current = writeAid(made.file, made.aid.id, { text: 'What the author wrote.' });

    current = suggestAid(current, made.aid.id, { text: 'What the machine offered.', questions: [] });
    const aid = current.learningAids[0]!;
    // The whole rule, in one assertion.
    expect(aid.text).toBe('What the author wrote.');
    expect(aid.suggestion).toBe('What the machine offered.');
  });

  it('is safe to run a hundred times', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'summary');
    let current = writeAid(made.file, made.aid.id, { text: 'What the author wrote.' });
    for (let at = 0; at < 100; at += 1) {
      current = suggestAid(current, made.aid.id, { text: `Attempt ${at}`, questions: [] });
    }
    expect(current.learningAids[0]!.text).toBe('What the author wrote.');
  });

  it('never approves its own work', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'summary');
    const current = suggestAid(made.file, made.aid.id, { text: 'Offered.', questions: [] });
    expect(current.learningAids[0]!.approved).toBe(false);
    expect(printedAidsOn(current, beatId)).toHaveLength(0);
  });

  it('drops anything a model tried to send that is not a suggestion', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'summary');
    let current = writeAid(made.file, made.aid.id, { text: 'Mine.' });

    // The shape is the permission: there is no field for these, so they go.
    current = suggestAid(current, made.aid.id, {
      text: 'Offered.',
      questions: [],
      approved: true,
      beatId: 'somewhere-else',
    } as never);

    const aid = current.learningAids[0]!;
    expect(aid.approved).toBe(false);
    expect(aid.beatId).toBe(beatId);
    expect(aid.text).toBe('Mine.');
  });
});

describe('accepting is the explicit action', () => {
  it('takes the suggestion, and hands back what it replaced', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'summary');
    let current = writeAid(made.file, made.aid.id, { text: 'The old wording.' });
    current = suggestAid(current, made.aid.id, { text: 'The new wording.', questions: [] });

    const taken = acceptSuggestion(current, made.aid.id);
    expect(taken.file.learningAids[0]!.text).toBe('The new wording.');
    // So the interface can offer it back — an undo that has to be remembered
    // by somebody is not an undo.
    expect(taken.replaced!.text).toBe('The old wording.');
    // And the offer is cleared, so the screen stops offering what was taken.
    expect(taken.file.learningAids[0]!.suggestion).toBe('');
  });

  it('does not approve', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'summary');
    let current = suggestAid(made.file, made.aid.id, { text: 'Offered.', questions: [] });
    current = acceptSuggestion(current, made.aid.id).file;
    // Right words and goes in the book are different decisions.
    expect(current.learningAids[0]!.approved).toBe(false);
  });

  it('refuses when there is nothing on offer, rather than blanking the words', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'summary');
    const current = writeAid(made.file, made.aid.id, { text: 'Mine.' });

    const taken = acceptSuggestion(current, made.aid.id);
    expect(taken.replaced).toBeNull();
    expect(taken.file.learningAids[0]!.text).toBe('Mine.');
  });

  it('throws the suggestion away without touching the words', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'summary');
    let current = writeAid(made.file, made.aid.id, { text: 'Mine.' });
    current = suggestAid(current, made.aid.id, { text: 'Theirs.', questions: [] });
    current = discardSuggestion(current, made.aid.id);

    expect(current.learningAids[0]!.text).toBe('Mine.');
    expect(current.learningAids[0]!.suggestion).toBe('');
  });
});

describe('a quiz is not prose', () => {
  it('keeps questions rather than lines', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'quiz');
    const current = writeAid(made.file, made.aid.id, {
      questions: [
        { prompt: 'Why is the sampling distribution narrower?', answer: 'Averaging cancels error.' },
        { prompt: 'What does n increase do to the standard error?', answer: '' },
      ],
    });

    const aid = current.learningAids[0]!;
    expect(aid.questions).toHaveLength(2);
    // An answer may be empty: plenty of books put them at the back, or nowhere.
    expect(aid.questions[1]!.answer).toBe('');
    expect(aidStanding(aid).written).toBe(true);
  });

  it('accepts suggested questions into the questions, not into the text', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'quiz');
    let current = suggestAid(made.file, made.aid.id, {
      text: '',
      questions: [{ prompt: 'What is a sample?', answer: 'A part standing for the whole.' }],
    });
    current = acceptSuggestion(current, made.aid.id).file;

    const aid = current.learningAids[0]!;
    expect(aid.questions).toHaveLength(1);
    expect(aid.text).toBe('');
  });
});

describe('what a generation is given to read', () => {
  it('is the section’s own words and nothing else', () => {
    const { file, beatId } = book();
    const text = sectionTextFor(file, beatId);
    expect(text).toContain('A sample stands in for a population.');
    // Not the chapter around it, not the research, not the rest of the book.
    expect(text).not.toContain('Teaching Statistics');
  });

  it('lists the sections that have something to summarise', () => {
    const { file } = book();
    const worth = sectionsWorthAiding(file);
    // The starter section is empty, so it is not offered.
    expect(worth).toHaveLength(1);
    expect(worth[0]!.words).toBeGreaterThan(5);
  });
});

describe('the rest', () => {
  it('orders the aids the way §10 lists them', () => {
    const { file, beatId } = book();
    let current = aidFor(file, beatId, 'quiz').file;
    current = aidFor(current, beatId, 'summary').file;
    current = aidFor(current, beatId, 'what_you_learned').file;
    expect(aidsOn(current, beatId).map((one) => one.kind)).toEqual([
      'summary',
      'what_you_learned',
      'quiz',
    ]);
  });

  it('keeps an aid whose section was cut, because the words are the author’s', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'summary');
    const written = writeAid(made.file, made.aid.id, { text: 'Worth keeping.' });
    const cut = { ...written, beats: written.beats.filter((one) => one.id !== beatId) };

    expect(orphanedAids(cut)).toHaveLength(1);
    expect(cut.learningAids[0]!.text).toBe('Worth keeping.');
  });

  it('says what the book owes in one line', () => {
    const { file, beatId } = book();
    expect(describeAids(file)).toBe('No learning aids yet.');

    const made = aidFor(file, beatId, 'summary');
    let current = writeAid(made.file, made.aid.id, { text: 'Written.' });
    expect(describeAids(current)).toMatch(/1 aid · 1 not in the book yet/);

    current = approveAid(current, made.aid.id);
    expect(describeAids(current)).toBe('1 aid, all in the book.');
  });

  it('survives the round trip', () => {
    const { file, beatId } = book();
    const made = aidFor(file, beatId, 'quiz');
    let current = writeAid(made.file, made.aid.id, {
      questions: [{ prompt: 'Why?', answer: 'Because.' }],
    });
    current = suggestAid(current, made.aid.id, { text: '', questions: [{ prompt: 'And?', answer: '' }] });

    const back = fromRows(toRows(current));
    expect(back.learningAids[0]!.questions[0]!.prompt).toBe('Why?');
    expect(back.learningAids[0]!.suggestedQuestions[0]!.prompt).toBe('And?');
  });
});
