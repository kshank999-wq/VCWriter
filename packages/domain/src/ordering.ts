/**
 * Fractional index ordering.
 *
 * Story structure is reordered constantly (spec §5.1, §5.2, §5.3: tracks,
 * scene/chapter containers and beats are all drag-reorderable). Renumbering
 * every sibling on each drag would rewrite whole scenes and fight sync
 * (spec §14: optimistic local editing with safe merge). Instead every ordered
 * row carries an `orderKey` string, and inserting between two neighbours only
 * writes the row that moved.
 *
 * Keys sort with plain lexicographic `<`. Based on the standard fractional
 * indexing midpoint algorithm; keys never end in the lowest digit so that a
 * midpoint always exists below any existing key.
 */

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;
const LOWEST = DIGITS[0] as string;

export class OrderKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderKeyError';
  }
}

const assertValidKey = (key: string, label: string): void => {
  if (key.length === 0) throw new OrderKeyError(`${label} order key must not be empty`);
  for (const char of key) {
    if (!DIGITS.includes(char)) throw new OrderKeyError(`${label} order key contains invalid character "${char}"`);
  }
  if (key.endsWith(LOWEST)) throw new OrderKeyError(`${label} order key must not end in "${LOWEST}"`);
};

const midpoint = (lower: string, upper: string | null): string => {
  if (upper !== null) {
    let shared = 0;
    while ((lower[shared] ?? LOWEST) === upper[shared]) shared += 1;
    if (shared > 0) return upper.slice(0, shared) + midpoint(lower.slice(shared), upper.slice(shared));
  }

  const digitLower = lower.length > 0 ? DIGITS.indexOf(lower[0] as string) : 0;
  const digitUpper = upper !== null ? DIGITS.indexOf(upper[0] as string) : BASE;

  if (digitUpper - digitLower > 1) {
    return DIGITS[Math.round(0.5 * (digitLower + digitUpper))] as string;
  }
  // The bounding digits are consecutive, so the new key must be longer.
  if (upper !== null && upper.length > 1) return upper.slice(0, 1);
  return (DIGITS[digitLower] as string) + midpoint(lower.slice(1), null);
};

/**
 * Produce a key that sorts strictly between `before` and `after`.
 * Pass `null` for either bound to insert at the head or tail of a list.
 */
export const orderKeyBetween = (before: string | null, after: string | null): string => {
  if (before !== null) assertValidKey(before, 'before');
  if (after !== null) assertValidKey(after, 'after');
  if (before !== null && after !== null && before >= after) {
    throw new OrderKeyError(`before ("${before}") must sort before after ("${after}")`);
  }
  return midpoint(before ?? '', after);
};

/** Keys for `count` evenly spread new items appended to an empty list. */
export const initialOrderKeys = (count: number): string[] => {
  const keys: string[] = [];
  let previous: string | null = null;
  for (let i = 0; i < count; i += 1) {
    previous = orderKeyBetween(previous, null);
    keys.push(previous);
  }
  return keys;
};

export interface Ordered {
  readonly orderKey: string;
}

/** Sort a list of ordered records; ties break on `id` so the order is total. */
export const sortByOrderKey = <T extends Ordered & { readonly id: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => (a.orderKey === b.orderKey ? a.id.localeCompare(b.id) : a.orderKey < b.orderKey ? -1 : 1));

/**
 * Key that places an item at `targetIndex` within `siblings` (already sorted).
 * `targetIndex === siblings.length` appends.
 */
export const orderKeyForIndex = (siblings: readonly Ordered[], targetIndex: number): string => {
  const index = Math.max(0, Math.min(targetIndex, siblings.length));
  const before = index > 0 ? (siblings[index - 1]?.orderKey ?? null) : null;
  const after = index < siblings.length ? (siblings[index]?.orderKey ?? null) : null;
  return safeKeyBetween(before, after);
};

/**
 * **A key between two neighbours that never refuses** (from Ken: *the Add all
 * to track function doesn't work… it's not transferring anything*).
 *
 * `orderKeyBetween` throws where the neighbours share a key, are out of order
 * or carry one it cannot read — and a project built up over months of imports,
 * sends and syncs can hold such a pair. One throw inside a promotion abandoned
 * the whole press, so nothing reached the track and nothing said why. This
 * falls back to the nearest key it *can* make: after the one before, before
 * the one after, or a fresh one — the record still lands, beside where it was
 * asked for, and callers that care about exact places re-key first.
 */
export const safeKeyBetween = (before: string | null, after: string | null): string => {
  for (const [low, high] of [
    [before, after],
    [before, null],
    [null, after],
    [null, null],
  ] as const) {
    try {
      return orderKeyBetween(low, high);
    } catch {
      // Try the next, looser pair.
    }
  }
  return orderKeyBetween(null, null);
};

/**
 * Whether a list's keys are all readable and strictly in order: what a key
 * between two of them needs. Where not, the caller re-keys the list as it is
 * drawn before placing anything in it.
 */
export const keysInOrder = (items: readonly Ordered[]): boolean =>
  items.every((item, index) => {
    if (!/^[0-9A-Za-z]+$/.test(item.orderKey) || item.orderKey.endsWith('0')) return false;
    return index === 0 || (items[index - 1] as Ordered).orderKey < item.orderKey;
  });
