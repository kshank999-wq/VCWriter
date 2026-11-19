import { describe, expect, it } from 'vitest';
import { inflectVerb, lookUpVerb, strongerVerbsFor, verbOf, type VerbData } from '../index.js';

/** A little of the WordNet data, in its shape. */
const data: VerbData = {
  s: [
    ['use one’s feet to advance', ['walk'], ['stumble', 'pace', 'stagger', 'stride', 'shuffle']],
    ['perceive with attention', ['look'], ['glance', 'peer', 'gaze', 'stare']],
    ['give a certain impression', ['look', 'appear', 'seem'], ['loom', 'glow']],
    ['stop moving', ['stop', 'halt'], ['freeze']],
    ['make an effort', ['try', 'seek'], ['strive']],
  ],
  i: { walk: [0], look: [1, 2], stride: [0], stop: [3], try: [4], hope: [4], stumble: [0], go: [0] },
};

describe('the verb dictionary', () => {
  it('finds the verb a word is a form of', () => {
    expect(verbOf(data, 'walked')).toEqual({ base: 'walk', form: 'past' });
    expect(verbOf(data, 'walks')).toEqual({ base: 'walk', form: 'third' });
    expect(verbOf(data, 'looking')).toEqual({ base: 'look', form: 'ing' });
    expect(verbOf(data, 'strode')).toEqual({ base: 'stride', form: 'past' });
    expect(verbOf(data, 'went')).toEqual({ base: 'go', form: 'past' });
    expect(verbOf(data, 'stopped')).toEqual({ base: 'stop', form: 'past' });
    expect(verbOf(data, 'tried')).toEqual({ base: 'try', form: 'past' });
    expect(verbOf(data, 'hoping')).toEqual({ base: 'hope', form: 'ing' });
    expect(verbOf(data, 'table')).toBeNull();
  });

  it('puts a replacement in the same form', () => {
    expect(inflectVerb('stagger', 'past')).toBe('staggered');
    expect(inflectVerb('stride', 'past')).toBe('strode');
    expect(inflectVerb('shuffle', 'ing')).toBe('shuffling');
    expect(inflectVerb('stop', 'ing')).toBe('stopping');
    expect(inflectVerb('glance', 'third')).toBe('glances');
    expect(inflectVerb('try', 'third')).toBe('tries');
  });

  it('offers stronger verbs in the word’s own form and capitals', () => {
    expect(strongerVerbsFor(data, 'walked', 4)).toEqual(['stumbled', 'paced', 'staggered', 'strode']);
    expect(strongerVerbsFor(data, 'Looked', 4)).toEqual(['Glanced', 'Loomed', 'Peered', 'Glowed']);
    const found = lookUpVerb(data, 'looking')!;
    expect(found.senses[1]!.synonyms).toEqual(['appearing', 'seeming']);
    expect(strongerVerbsFor(data, 'chair')).toEqual([]);
  });
});
