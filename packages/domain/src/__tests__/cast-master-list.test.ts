import { describe, expect, it } from 'vitest';
import {
  addCharacter,
  createProjectFile,
  knowsCharacter,
  notedCast,
  spokenNames,
  updateBeat,
  updateCharacter,
  type ProjectFile,
} from '../index.js';

/**
 * The cast is a master list (addendum 02 §16): every name the script speaks
 * with is in it, whether it was typed into a cue or entered in Research.
 */

const el = (type: string, text: string) => ({
  id: crypto.randomUUID() as never,
  type: type as never,
  text,
  characterId: null,
  attributes: {},
});

const script = (...elements: ReturnType<typeof el>[]): ProjectFile => {
  const file = createProjectFile({ title: 'The Lighthouse', format: 'screenplay' });
  return updateBeat(file, file.beats[0]!.id, { manuscript: { elements } });
};

describe('a name typed into the script', () => {
  it('joins the cast, unfiled, without being entered twice', () => {
    const file = script(el('character', 'MAEVE'), el('dialogue', 'Not tonight.'));
    expect(file.characters).toHaveLength(0);

    const noted = notedCast(file);
    expect(noted.characters.map((person) => person.name)).toEqual(['MAEVE']);
    // Unfiled: a name in a script is a character before anyone has decided
    // how important they are.
    expect(noted.characters[0]?.categoryId).toBeNull();
  });

  it('is one person however the cue is marked', () => {
    const file = script(
      el('character', 'MAEVE'),
      el('dialogue', 'Not tonight.'),
      el('character', 'MAEVE (V.O.)'),
      el('dialogue', 'Or ever.'),
      el('character', "MAEVE (CONT'D)"),
      el('dialogue', 'Well?'),
    );
    expect(spokenNames(file)).toEqual(['MAEVE']);
    expect(notedCast(file).characters).toHaveLength(1);
  });

  it('is added once, however many times the pass runs', () => {
    const once = notedCast(script(el('character', 'MAEVE'), el('dialogue', 'No.')));
    expect(notedCast(once)).toBe(once);
    expect(notedCast(notedCast(once)).characters).toHaveLength(1);
  });

  it('is not added again because the cast knows them by another name', () => {
    let file = script(el('character', 'THE KEEPER'), el('dialogue', 'Aye.'));
    file = addCharacter(file, { name: 'Alec Rowe' });
    file = updateCharacter(file, file.characters[0]!.id, { aliases: ['THE KEEPER'] });

    expect(knowsCharacter(file, 'THE KEEPER')?.name).toBe('Alec Rowe');
    expect(notedCast(file).characters).toHaveLength(1);
  });

  it('never removes anyone when the line is cut', () => {
    const withCue = notedCast(script(el('character', 'MAEVE'), el('dialogue', 'No.')));
    const cut = updateBeat(withCue, withCue.beats[0]!.id, { manuscript: { elements: [el('action', 'Rain.')] } });
    // Deleting a line is not saying the character never existed.
    expect(notedCast(cut).characters.map((person) => person.name)).toEqual(['MAEVE']);
  });

  it('ignores an empty cue and a blank one', () => {
    expect(notedCast(script(el('character', '   '), el('dialogue', 'No.'))).characters).toHaveLength(0);
  });

  it('reads the script in story order, so the cast reads in the order it speaks', () => {
    const file = script(
      el('character', 'THE KEEPER'),
      el('dialogue', 'Aye.'),
      el('character', 'MAEVE'),
      el('dialogue', 'No.'),
    );
    expect(notedCast(file).characters.map((person) => person.name)).toEqual(['THE KEEPER', 'MAEVE']);
  });
});
