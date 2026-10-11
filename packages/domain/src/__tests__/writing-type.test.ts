import { describe, expect, it } from 'vitest';
import {
  PARAGRAPH_ALIGNS,
  TEXT_INKS,
  addBeat,
  bookBlocks,
  bookSettingsOf,
  blockStyle,
  createProjectFile,
  geometryOf,
  isInkColour,
  lineTypeOf,
  maySetType,
  mayMarkText,
  setBookSettings,
  setByWriter,
  toggleInline,
  tracksInOrder,
  unitsInStoryOrder,
  updateBeat,
  withLineType,
  type BookRenderContext,
  type ManuscriptElement,
  type ProjectFile,
} from '../index.js';

/**
 * **How a line of the manuscript is set** (addendum 02 §19a, from Ken: *I
 * imported some text that was italicized and I realized that there's no way
 * to adjust the style of the text in the beats*).
 *
 * The audit's own claim is the first thing worth pinning: emphasis and the
 * paragraph's alignment and size were **already built and already printed**,
 * written by the Word importer and reachable by nobody. So most of what this
 * asserts is that nothing about them moved.
 */

const para = (text: string, attributes: ManuscriptElement['attributes'] = {}): ManuscriptElement => ({
  id: crypto.randomUUID() as never,
  type: 'paragraph',
  text,
  characterId: null,
  attributes,
});

describe('a mark is the selection’s', () => {
  it('is the act the keys already ran, which is why there is one of it', () => {
    /**
     * `toggleInline` has put emphasis on the selection since the beat editor
     * was written. The toolbar's buttons run **this**, so the two doors
     * cannot disagree — and a second implementation behind the buttons is
     * precisely the fault this project removes everywhere else.
     */
    const on = toggleInline('she lifted the lamp', 11, 14, 'italic');
    expect(on.text).toBe('she lifted *the* lamp');
    const off = toggleInline(on.text, on.selectionStart, on.selectionEnd, 'italic');
    expect(off.text).toBe('she lifted the lamp');
  });

  it('puts the marks round the words and not round the space after them', () => {
    /**
     * **Found by writing the test above.** A double-click selects a word
     * *and its trailing space* in every browser, which gave `*the *` — the
     * very thing the Word importer refuses when it writes emphasis back
     * (*the editor reads `** word**` as a stray asterisk*). It had been that
     * way since the editor was written and cost little while the only way in
     * was a key; the toolbar makes double-click-then-press the commonest
     * gesture there is.
     */
    expect(toggleInline('she lifted the lamp', 11, 15, 'italic').text).toBe('she lifted *the* lamp');
    // An empty selection is left alone: that is somebody asking for a pair
    // of marks to type between.
    expect(toggleInline('she lifted ', 11, 11, 'bold').text).toBe('she lifted ****');
  });

  it('is offered on every format, where the type is prose’s alone', () => {
    /**
     * Ken's own split: *especially for novels, short stories, and
     * instructional books. That will not be needed in scripts, episodic, or
     * short form.* Emphasis is Fountain's own and a screenplay uses it, so
     * three buttons for an act that already works everywhere cost a
     * screenwriter nothing; a paragraph set in 18 point and centred is not a
     * screenplay, so those are **absent rather than greyed** there.
     */
    expect(mayMarkText('screenplay')).toBe(true);
    expect(mayMarkText('novel')).toBe(true);
    expect(maySetType('novel')).toBe(true);
    expect(maySetType('short_story')).toBe(true);
    expect(maySetType('instructional')).toBe(true);
    expect(maySetType('screenplay')).toBe(false);
    expect(maySetType('episodic')).toBe(false);
    expect(maySetType('short_form')).toBe(false);
  });
});

describe('the type is the line’s', () => {
  it('says nothing until somebody says something', () => {
    const line = lineTypeOf(para('A lamp.'));
    expect(line).toEqual({ align: null, size: null, colour: null });
  });

  it('clears outright rather than writing a default', () => {
    /**
     * **Null clears**, which is what keeps this additive: a paragraph put
     * back to the book's own carries no attribute at all and prints byte for
     * byte as it did before anybody touched it — `partStyleOf`'s rule
     * pointed at a paragraph.
     */
    const centred = withLineType(para('A lamp.'), { align: 'center' });
    expect(centred.attributes['align']).toBe('center');
    const back = withLineType(centred, { align: null });
    expect('align' in back.attributes).toBe(false);
  });

  it('offers left beside the other three, because a book justifies', () => {
    /**
     * `setting()` kept only `center` and `right`, left being the default —
     * true of a book ranged left and false of the many that justify, where a
     * writer wanting one paragraph flush left has to be able to say so.
     */
    expect([...PARAGRAPH_ALIGNS]).toEqual(['left', 'center', 'right', 'justify']);
    expect(lineTypeOf(withLineType(para('A lamp.'), { align: 'left' })).align).toBe('left');
  });

  it('takes a colour it will print and refuses anything else', () => {
    expect(isInkColour('#b4232a')).toBe(true);
    expect(isInkColour('#abc')).toBe(true);
    expect(isInkColour('red')).toBe(false);
    expect(isInkColour('rgb(1,2,3)')).toBe(false);
    // A name that is not a colour never reaches the attributes at all.
    expect('color' in withLineType(para('A lamp.'), { colour: 'red' as never }).attributes).toBe(false);
  });

  it('offers no white and no black, an ink being read on paper', () => {
    /**
     * **An ink is chosen on one screen and read on another.** The writing
     * screen may be white on dark; the book is white paper always. So every
     * offered ink is a mid-tone, white would be a paragraph that vanishes
     * when it prints, and black is what the default already is.
     */
    for (const one of TEXT_INKS) {
      expect(isInkColour(one.value)).toBe(true);
      expect(one.value).not.toBe('#ffffff');
      expect(one.value).not.toBe('#000000');
    }
  });
});

describe('who set the size', () => {
  it('stamps the writer’s and leaves an import’s alone', () => {
    /**
     * `attributes.size` has meant *what the document said* since the Word
     * importer was built, and the book honours those only under the **As
     * imported** face. That rule is right about Word's accidental eleven
     * point on four hundred paragraphs and wrong about somebody who
     * deliberately pressed 18 — so one field carries the size and a second
     * says where it came from (`found`'s shape).
     */
    const imported = para('A lamp.', { size: 11 });
    expect(setByWriter(imported)).toBe(false);
    expect(lineTypeOf(imported).size).toBe(11);

    const chosen = withLineType(imported, { size: 18 });
    expect(setByWriter(chosen)).toBe(true);
    expect(lineTypeOf(chosen).size).toBe(18);

    // And the stamp comes off with the last size, never outliving it.
    const cleared = withLineType(chosen, { size: null });
    expect(setByWriter(cleared)).toBe(false);
    expect('size' in cleared.attributes).toBe(false);
  });

  it('does not claim a provenance about alignment or ink', () => {
    // Neither has an importer behind it that needs telling apart, so
    // stamping them would be a claim about fields that never had one.
    const set = withLineType(para('A lamp.'), { align: 'center', colour: '#b4232a' });
    expect(setByWriter(set)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// And what the printed page does with it
// ---------------------------------------------------------------------------

const novel = (text: string, attributes: ManuscriptElement['attributes']): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'K. Shank' });
  const first = unitsInStoryOrder(file)[0]!;
  const made = addBeat(file, { unitId: first.id, title: 'One' });
  file = updateBeat(made.file, made.beat.id, { manuscript: { elements: [para(text, attributes)] } as never });
  return file;
};

const inkFor = (file: ProjectFile): string => {
  const settings = bookSettingsOf(file);
  const context = {
    settings,
    geometry: geometryOf(settings, 40),
  } as BookRenderContext;
  const block = bookBlocks(file).find((one) => one.kind === 'paragraph' && one.text.includes('A lamp'))!;
  return blockStyle(block, context);
};

describe('what the page does with it', () => {
  it('ranges the paragraph and inks it', () => {
    expect(inkFor(novel('A lamp.', { align: 'center', color: '#b4232a' }))).toMatch(/text-align:center/);
    expect(inkFor(novel('A lamp.', { align: 'center', color: '#b4232a' }))).toMatch(/color:#b4232a/);
    // A paragraph nobody has set carries no style at all.
    expect(inkFor(novel('A lamp.', {}))).toBe('');
  });

  it('honours a size the writer chose whatever the book is set in', () => {
    /**
     * The half that would otherwise read as the control not working: a book
     * set in Garamond dropped every paragraph size, which is right for an
     * import and wrong for a press.
     */
    const chosen = novel('A lamp.', { size: 18, typeFrom: 'writer' });
    expect(inkFor(chosen)).toMatch(/font-size/);

    const imported = novel('A lamp.', { size: 18 });
    expect(inkFor(imported)).not.toMatch(/font-size/);

    // And under *As imported* the document's own is honoured exactly as it
    // always was, which is addendum 21 §3 unchanged.
    let file = imported;
    file = setBookSettings(file, { ...bookSettingsOf(file), face: 'imported' });
    const settings = bookSettingsOf(file);
    const block = bookBlocks(file).find((one) => one.kind === 'paragraph' && one.text.includes('A lamp'))!;
    expect(blockStyle(block, { settings, geometry: geometryOf(settings, 40) } as BookRenderContext)).toMatch(/font-size/);
  });
});
