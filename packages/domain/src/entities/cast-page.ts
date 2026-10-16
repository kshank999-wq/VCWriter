import { z } from 'zod';
import { id } from './common.js';
import type { CharacterId } from '../ids.js';

/**
 * **The cast page** (addendum 38 §4, Ken's *Stage Play Formatting Engine*
 * spec §5).
 *
 * The page a play opens with after its title: who is in it, a line about each,
 * and where and when it is set. Addendum 37 left it named and unbuilt, saying
 * what it asks beyond the readings already standing — doubling, a playing age,
 * a vocal range and an *include in cast* tick per role — "is the Character
 * Creator's record widened". This is that widening, and nothing more.
 */

/**
 * What one person is **on the cast page** — which is not what they are in the
 * story. `description` on the character is the writer's note to themselves;
 * this is the one line a director reads. `background.age` is how old they are
 * in the story; `playingAge` is the range an actor cast in the role is.
 *
 * One object rather than five fields on the character, because it is one
 * group on one screen, every field in it is optional together, and it is
 * stored as one column.
 */
export const castingSchema = z.object({
  /**
   * Whether the role is listed. **On by default**: a character is in the
   * cast unless somebody says otherwise, and the ones taken off are the
   * offstage voice, the man in the photograph, the crowd.
   */
  include: z.boolean().default(true),
  /** The line under the name: *her brother, a schoolteacher*. */
  description: z.string().default(''),
  /** The range an actor is cast at: *40s*, *late 20s to 30s*. */
  playingAge: z.string().default(''),
  /** A musical's: *Mezzo-soprano*, *Baritone (A2–F4)*. */
  vocalRange: z.string().default(''),
  /**
   * **Played by the same actor as** this other role. One link per role and
   * read both ways, so a company of three playing nine parts is three chains
   * and nobody types the same doubling twice (`castPageOf` gathers them).
   */
  doubles: id<CharacterId>().nullable().default(null),
});
export type Casting = z.infer<typeof castingSchema>;

/** The order the roles are listed in. */
export const CAST_ORDERS = ['appearance', 'importance'] as const;
export type CastOrder = (typeof CAST_ORDERS)[number];

/**
 * The page's own words — everything on it that is not a role. Held in the
 * project's settings beside the title page, because it is a page of the
 * document and not a fact about any one person.
 */
export const castPageSchema = z.object({
  /** Empty means *Characters*, which is what the page is usually headed. */
  heading: z.string().default(''),
  /**
   * **In order of appearance**, which is the convention and the default; or
   * by the headings the cast is filed under (main, then the rest), which is
   * how a large company is often listed.
   */
  order: z.enum(CAST_ORDERS).default('appearance'),
  /** *The present. Late autumn.* Under the roles, headed TIME. */
  time: z.string().default(''),
  /** *A kitchen in Duluth.* Headed PLACE. */
  place: z.string().default(''),
  /** Anything else the page must say: *The play runs without an interval.* */
  notes: z.string().default(''),
});
export type CastPageSettings = z.infer<typeof castPageSchema>;
