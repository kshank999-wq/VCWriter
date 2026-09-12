import Anthropic from '@anthropic-ai/sdk';
import { comparisonSchema, duplicatesSchema, type Comparison, type Duplicates } from '@vcwriter/domain';

/**
 * The room's readings (addendum 07 §14, stage 12).
 *
 * **The same AI service the rest of the product uses**, as §14 asks — one
 * vendor, one key, one place it can be rotated and metered — rather than a
 * second stack grown beside `ai.ts` because this is a different feature.
 *
 * **It never rewrites anybody's work, and the guarantee is structural.** Each
 * reading returns through a JSON schema with no field that can hold replacement
 * prose, so a model that decided to hand back a draft has nowhere to put it and
 * the parse drops it. The prompts say so as well, because a model that is told
 * why gives a better reading — but the prompt is the courtesy and the schema is
 * the rule.
 */

const MODEL = 'claude-opus-5';

let cached: Anthropic | null = null;
const client = (): Anthropic => {
  if (!cached) cached = new Anthropic();
  return cached;
};

export const isAiConfigured = (): boolean => Boolean(process.env['ANTHROPIC_API_KEY']);

export class RoomReadingError extends Error {}

// ------------------------------------------------------------- the schemas

const COMPARE_SCHEMA = {
  type: 'object',
  properties: {
    bothTrying: { type: 'string' },
    points: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          about: { type: 'string' },
          inFirst: { type: 'string' },
          inSecond: { type: 'string' },
          favours: { type: 'string', enum: ['first', 'second', 'neither'] },
        },
        required: ['about', 'inFirst', 'inSecond', 'favours'],
        additionalProperties: false,
      },
    },
    onlyInFirst: { type: 'array', items: { type: 'string' } },
    onlyInSecond: { type: 'array', items: { type: 'string' } },
  },
  required: ['bothTrying', 'points', 'onlyInFirst', 'onlyInSecond'],
  additionalProperties: false,
} as const;

const DUPLICATES_SCHEMA = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          itemIds: { type: 'array', items: { type: 'string' }, minItems: 2 },
          theSameIdea: { type: 'string' },
          butDifferent: { type: 'string' },
        },
        required: ['itemIds', 'theSameIdea', 'butDifferent'],
        additionalProperties: false,
      },
    },
  },
  required: ['groups'],
  additionalProperties: false,
} as const;

// ------------------------------------------------------------- the prompts

const COMPARE_SYSTEM = `You are reading two passes at the same material, written by two
different people in a writers' room, for the showrunner who has to choose.

**Do not write a merged version, and do not suggest replacement lines.** You are
not being asked to decide — the whole reason this room exists is that choosing
between two writers is a person's job. Say what differs and what each one does
better, quoting or describing the writers' own work rather than your own.

Be specific and be few. Four sharp observations are worth more than twelve
general ones, and a difference that would not change anybody's mind is not worth
a line. Where a point genuinely does not favour either pass, say "neither" — it
is a real answer and a common one, not a failure to decide.

"Only in" is for material that is in one and simply absent from the other: a
scene, a beat, a line of dialogue, a fact about a character. Not for differences
of degree, which are points.`;

const DUPLICATES_SYSTEM = `You are reading a writers' room's ideas, looking for the same
idea said twice by different people.

Group only what is genuinely the same idea. Two ideas about the same character
are not duplicates; two ideas that would produce the same scene are. When in
doubt, leave them apart — a room told that its two distinct ideas are one thing
loses one of them, and that is the loss this whole product exists to prevent.

Refer to items by the id given with each one, never by retyping their text: an
idea attributed to the wrong writer is worse than an idea nobody grouped.

Say what the shared idea is in one line, and where the two are not quite the
same, say what the difference is — often that difference is the reason to keep
both.`;

// --------------------------------------------------------------- the calls

const askFor = async <T>(input: {
  system: string;
  user: string;
  schema: unknown;
  parse: (body: unknown) => T;
}): Promise<T> => {
  const response = await client().messages.create({
    max_tokens: 16000,
    model: MODEL,
    system: input.system,
    thinking: { type: 'adaptive' },
    output_config: {
      // A room reading is a judgement about somebody's writing, not a hard
      // reasoning problem, and it is asked for interactively — the same
      // trade-off the scene read makes, for the same reason.
      effort: 'medium',
      format: { type: 'json_schema', schema: input.schema as Record<string, unknown> },
    },
    messages: [{ role: 'user', content: input.user }],
  });

  if (response.stop_reason === 'refusal') {
    throw new RoomReadingError('The reading was declined.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new RoomReadingError('The reading ran long and was cut off. Try a shorter pass.');
  }

  const text = response.content.find((block) => block.type === 'text');
  if (!text || text.type !== 'text') throw new RoomReadingError('The reading came back empty.');

  let body: unknown;
  try {
    body = JSON.parse(text.text);
  } catch {
    throw new RoomReadingError('The reading came back in a shape we could not read.');
  }

  try {
    // Parsed through the domain's schema as well as the model's. Two gates on
    // the same shape, and the second is the one that runs in the tests.
    return input.parse(body);
  } catch {
    throw new RoomReadingError('The reading came back in a shape we could not read.');
  }
};

export interface Pass {
  /** Whose it is, by name — the reading talks about people, not ids. */
  writer: string;
  label: string;
  text: string;
}

/**
 * Compare two passes at the same material.
 *
 * What goes to the model is the two texts and the writers' names, and nothing
 * else about the room: not the other contributions, not the comments, not who
 * has been assigned what. What leaves the room is what is being compared.
 */
export const compareTwo = async (input: { first: Pass; second: Pass }): Promise<Comparison> => {
  const body = [
    `The first pass is ${input.first.writer}'s — ${input.first.label}.`,
    '',
    input.first.text,
    '',
    '---',
    '',
    `The second pass is ${input.second.writer}'s — ${input.second.label}.`,
    '',
    input.second.text,
  ].join('\n');

  return askFor({
    system: COMPARE_SYSTEM,
    user: body,
    schema: COMPARE_SCHEMA,
    parse: (parsed) => comparisonSchema.parse(parsed),
  });
};

/** Find ideas the room has had twice. */
export const findDuplicates = async (input: {
  ideas: { id: string; writer: string; title: string; body: string }[];
}): Promise<Duplicates> => {
  const body = input.ideas
    .map((idea) =>
      [`id: ${idea.id}`, `from: ${idea.writer}`, idea.title, idea.body].filter(Boolean).join('\n'),
    )
    .join('\n\n---\n\n');

  return askFor({
    system: DUPLICATES_SYSTEM,
    user: body,
    schema: DUPLICATES_SCHEMA,
    parse: (parsed) => duplicatesSchema.parse(parsed),
  });
};
