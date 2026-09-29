import { describe, expect, it } from 'vitest';
import {
  describePhoneShelf,
  describeShelf,
  emptyShelf,
  onThisPhone,
  phoneShelfOffer,
  readShelf,
  setOnPhone,
  shelfRows,
  shownOnPhone,
} from '../capture-shelf.js';

/**
 * Which projects are on the phone (addendum 09 §13).
 *
 * The assertions worth having are the two rules the module rests on — that
 * only what is *off* is written down, and that nothing here can reach a
 * project — because both are invisible until they are wrong, and both are
 * wrong in the same direction: a writer's work quietly missing.
 */

const work = [
  { id: 'a', title: 'Blackout' },
  { id: 'b', title: 'The Lamp and the Lighthouse' },
  { id: 'c', title: 'In For A Pound' },
];

describe('what the phone shows', () => {
  it('shows everything until it is told otherwise', () => {
    expect(shownOnPhone(emptyShelf(), work)).toHaveLength(3);
    expect(describeShelf(emptyShelf(), work)).toBeNull();
  });

  it('keeps what is off, so work started tomorrow is on it', () => {
    const shelf = setOnPhone(emptyShelf(), 'b', false);
    expect(shelf.off).toEqual(['b']);

    // The project made after the choice was made — by voice, in a pocket.
    const later = [...work, { id: 'd', title: 'Named on a walk' }];
    expect(shownOnPhone(shelf, later).map((one) => one.id)).toEqual(['a', 'c', 'd']);
  });

  it('puts one back with the same act, and does not double up', () => {
    let shelf = setOnPhone(emptyShelf(), 'b', false);
    shelf = setOnPhone(shelf, 'b', false);
    expect(shelf.off).toEqual(['b']);

    shelf = setOnPhone(shelf, 'b', true);
    expect(onThisPhone(shelf, 'b')).toBe(true);
    expect(shelf.off).toEqual([]);
  });

  it('gives every project a row saying which way its tick sits', () => {
    const rows = shelfRows(setOnPhone(emptyShelf(), 'c', false), work);
    expect(rows.map((one) => [one.id, one.on])).toEqual([
      ['a', true],
      ['b', true],
      ['c', false],
    ]);
  });

  it('says what is off, and says nothing where nothing is', () => {
    expect(describeShelf(emptyShelf(), work)).toBeNull();
    expect(describeShelf(setOnPhone(emptyShelf(), 'a', false), work)).toBe('Blackout is off this phone.');
    const two = setOnPhone(setOnPhone(emptyShelf(), 'a', false), 'b', false);
    expect(describeShelf(two, work)).toBe('2 projects are off this phone.');
  });

  it('says what a tick would do before it is pressed', () => {
    const offer = phoneShelfOffer(emptyShelf(), work[0] as { id: string; title: string });
    expect(offer.on).toBe(true);
    expect(offer.act).toBe('Take Blackout off this phone');
    expect(offer.says).toContain('Nothing is deleted');

    const back = phoneShelfOffer(setOnPhone(emptyShelf(), 'a', false), work[0] as { id: string; title: string });
    expect(back.on).toBe(false);
    expect(back.act).toBe('Put Blackout back on this phone');
  });

  it('promises in one place that nothing here deletes anything', () => {
    // One copy, for addendum 24 §5c's reason: a screen writing this for itself
    // would go on promising it after the module changed its mind.
    expect(describePhoneShelf()).toContain('nothing here can delete one');
  });

  it('reads a device that has nothing, or nonsense, as everything on', () => {
    for (const stored of [null, '', 'not json', '{"off":"b"}', '[]']) {
      expect(readShelf(stored).off).toEqual([]);
    }
    expect(readShelf('{"off":["b"]}').off).toEqual(['b']);
  });
});
