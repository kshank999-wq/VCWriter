import { z } from 'zod';
import { timestamps } from './common.js';

/**
 * What a game project says about itself (addendum 18 §2).
 *
 * **Most of §2.3 already had somewhere to live**, and the point of this record
 * is what it leaves out rather than what it holds:
 *
 * | §2.3 asks for | Where it lives |
 * | --- | --- |
 * | premise | `project.logline` and `project.synopsis`, since 0001 |
 * | major milestones, midpoint, climax, resolution | **story markers** — they are the acts, and they are already on the timeline in order |
 * | mandatory story nodes | a flag on the node, not a list here; a list would be a second answer to *is this one mandatory* |
 * | stakes, central conflict, player role, objective | here, because nothing else holds them |
 *
 * Writing the milestones down twice is the failure this project keeps finding
 * in other people's specs, and it is worth not committing on purpose.
 */

/**
 * The gameplay structure (§2.1).
 *
 * **Free text with suggestions, never an enum.** §2.1 says the selection
 * configures defaults and *never limits the designer*, and an enum is a limit
 * whatever the intention: the thirteenth genre is always the one somebody is
 * writing. The presets exist so the field is not a blank box.
 */
export const GAME_TYPES = [
  'First-person shooter',
  'Third-person action',
  'RPG',
  'Adventure',
  'Survival',
  'Horror',
  'Strategy',
  'Simulation',
  'Puzzle',
  'Visual novel',
  'Interactive drama',
  'Open world',
  'Mission-based',
] as const;

/**
 * How the story is shaped (§2.2).
 *
 * Free text for the same reason, and with a sharper one behind it: **nothing
 * in the module reads this.** The graph is whatever the designer draws — a
 * hub-and-spoke shape is a node with many edges out and back, and the engine
 * cannot tell it from a branch-and-converge and should not try. This is a note
 * to the humans about what they meant, and calling it anything else would
 * invite a validator that enforced it.
 */
export const NARRATIVE_STRUCTURES = [
  'Linear with optional branches',
  'Branching tree',
  'Branch and converge',
  'Hub and spoke',
  'Mission / quest network',
  'Open-world state-driven',
  'Multiple protagonists',
  'Custom hybrid',
] as const;

export const gameSetupSchema = z.object({
  /** §2.1. A preset, or whatever the designer typed instead. */
  gameType: z.string().default(''),
  /** §2.2. Said for the humans; nothing evaluates it. */
  structure: z.string().default(''),
  /** §2.3. Who the player is. */
  playerRole: z.string().default(''),
  /** §2.3. What they are trying to do. */
  objective: z.string().default(''),
  /** §2.3. What is in their way. */
  conflict: z.string().default(''),
  /** §2.3. What it costs to fail. */
  stakes: z.string().default(''),
  ...timestamps,
});
export type GameSetup = z.infer<typeof gameSetupSchema>;

/** A project that has said nothing about itself yet. */
export const emptyGameSetup = (at: string): GameSetup =>
  gameSetupSchema.parse({ createdAt: at, updatedAt: at });
