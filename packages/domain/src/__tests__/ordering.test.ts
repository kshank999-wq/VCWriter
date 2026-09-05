import { describe, expect, it } from 'vitest';
import { initialOrderKeys, orderKeyBetween, orderKeyForIndex, sortByOrderKey, OrderKeyError } from '../ordering.js';

describe('order keys', () => {
  it('produces a key between two bounds', () => {
    const a = orderKeyBetween(null, null);
    const b = orderKeyBetween(a, null);
    const middle = orderKeyBetween(a, b);
    expect(a < middle).toBe(true);
    expect(middle < b).toBe(true);
  });

  it('supports repeated insertion at the same position without collision', () => {
    let lower = orderKeyBetween(null, null);
    const upper = orderKeyBetween(lower, null);
    const generated = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const key = orderKeyBetween(lower, upper);
      expect(lower < key && key < upper).toBe(true);
      expect(generated.has(key)).toBe(false);
      generated.add(key);
      lower = key;
    }
  });

  it('supports repeated insertion at the head of a list', () => {
    let head = orderKeyBetween(null, null);
    for (let i = 0; i < 100; i += 1) {
      const key = orderKeyBetween(null, head);
      expect(key < head).toBe(true);
      head = key;
    }
  });

  it('rejects an inverted range', () => {
    const a = orderKeyBetween(null, null);
    const b = orderKeyBetween(a, null);
    expect(() => orderKeyBetween(b, a)).toThrow(OrderKeyError);
  });

  it('spreads initial keys in ascending order', () => {
    const keys = initialOrderKeys(6);
    expect(keys).toHaveLength(6);
    expect([...keys].sort()).toEqual(keys);
  });

  it('places an item at a requested index', () => {
    const items = initialOrderKeys(3).map((orderKey, index) => ({ id: `id-${index}`, orderKey }));
    const inserted = { id: 'inserted', orderKey: orderKeyForIndex(items, 1) };
    const sorted = sortByOrderKey([...items, inserted]);
    expect(sorted.map((item) => item.id)).toEqual(['id-0', 'inserted', 'id-1', 'id-2']);
  });
});
