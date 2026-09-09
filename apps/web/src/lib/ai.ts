import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

/**
 * The AI structural pass behind the Final Editor (spec §8.2).
 *
 * It runs here, on the server, and not in the desktop application — an API key
 * shipped inside an installer is a key handed to every customer. §12.1 and §14
 * both say the same thing: external services sit behind a server layer with
 * environment-specific credentials.
 *
 * What it is asked to do is narrow on purpose. It reads one scene and answers
 * the questions §8.2 lists — what is true at the start, what changes, where
 * the turn is, whether the value moves — and it returns findings for the
 * writer to consider. It never rewrites anything: the response has no field
 * that could carry replacement prose.
 */

export const sceneVerdictSchema = z.object({
  opening: z.string().describe('What is true when the scene opens, in one sentence.'),
  change: z.string().describe('What is different by the end of the scene, in one sentence.'),
  turn: z
    .string()
    .nullable()
    .describe('The moment the scene turns, quoted or described. Null if the scene does not turn.'),
  valueShift: z
    .enum(['positive', 'negative', 'mixed', 'none'])
    .describe('Which way the scene value moves for the character who wants something.'),
  purpose: z.string().describe('What this scene is doing for the larger story, in one sentence.'),
  concerns: z
    .array(z.string())
    .describe('Specific, actionable concerns a story editor would raise. Empty if there are none.'),
});

export type SceneVerdictPayload = z.infer<typeof sceneVerdictSchema>;

/**
 * The same shape as a JSON schema for the model to fill in.
 *
 * Written out rather than derived with the SDK's `zodOutputFormat` helper,
 * which requires Zod 4 while this workspace shares Zod 3 with the domain
 * package. The zod schema above still validates what comes back, so the two
 * cannot drift silently — a mismatch fails the parse and surfaces as an error.
 */
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    opening: { type: 'string', description: 'What is true when the scene opens, in one sentence.' },
    change: { type: 'string', description: 'What is different by the end of the scene, in one sentence.' },
    turn: {
      type: ['string', 'null'],
      description: 'The moment the scene turns, quoted or described. Null if the scene does not turn.',
    },
    valueShift: {
      type: 'string',
      enum: ['positive', 'negative', 'mixed', 'none'],
      description: 'Which way the scene value moves for the character who wants something.',
    },
    purpose: { type: 'string', description: 'What this scene is doing for the larger story, in one sentence.' },
    concerns: {
      type: 'array',
      items: { type: 'string' },
      description: 'Specific, actionable concerns a story editor would raise. Empty if there are none.',
    },
  },
  required: ['opening', 'change', 'turn', 'valueShift', 'purpose', 'concerns'],
  additionalProperties: false,
} as const;

const MODEL = 'claude-opus-5';

const SYSTEM = `You are a story editor reading one scene from a work in progress.

Answer only about the scene you are given. Do not speculate about the rest of the
story, do not rewrite anything, and do not suggest replacement lines — the writer
asked for a read, not a draft.

Judge the scene as a scene: what is true at the start, what has changed by the end,
where it turns, and which way its value moves. A scene where nothing changes has a
valueShift of "none" and a null turn — say so plainly rather than finding a turn
that is not there. Keep concerns specific and few; three sharp observations are
worth more than ten general ones.`;

let cached: Anthropic | null = null;

export const isAiConfigured = (): boolean => Boolean(process.env['ANTHROPIC_API_KEY']);

const client = (): Anthropic => {
  if (!cached) cached = new Anthropic();
  return cached;
};

export interface SceneReviewRequest {
  /** The scene's own text. Nothing else about the project is sent. */
  sceneText: string;
  /** A short label so the model knows where it sits, e.g. "Scene 14 of 62". */
  position?: string;
  format: 'screenplay' | 'prose';
}

export interface SceneReviewResult extends SceneVerdictPayload {
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * What went wrong, said in a sentence a writer can act on.
 *
 * The SDK's own errors are for the operator, not the customer: a writer who
 * clicked "Read scene" needs to know whether to try again, wait, or tell us —
 * not which header was rejected. The detail still reaches the server log.
 */
export class SceneReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SceneReviewError';
  }
}

const explain = (cause: unknown): SceneReviewError => {
  if (cause instanceof Anthropic.RateLimitError) {
    return new SceneReviewError('The reader is busy just now. Try that scene again in a moment.');
  }
  if (cause instanceof Anthropic.AuthenticationError || cause instanceof Anthropic.PermissionDeniedError) {
    return new SceneReviewError('AI review is not set up correctly on the server. We have been told.');
  }
  if (cause instanceof Anthropic.APIConnectionTimeoutError) {
    return new SceneReviewError('The read took too long. Try again, or try a shorter scene.');
  }
  if (cause instanceof Anthropic.APIConnectionError) {
    return new SceneReviewError('The reader could not be reached. Check your connection and try again.');
  }
  if (cause instanceof Anthropic.APIError) {
    return new SceneReviewError('The structural read failed. Try again in a moment.');
  }
  return cause instanceof SceneReviewError ? cause : new SceneReviewError('The structural read failed.');
};

export const reviewScene = async (input: SceneReviewRequest): Promise<SceneReviewResult> => {
  try {
    return await ask(input);
  } catch (cause) {
    console.error('scene review failed', cause);
    throw explain(cause);
  }
};

const ask = async (input: SceneReviewRequest): Promise<SceneReviewResult> => {
  const response = await client().messages.create({
    // Thinking shares this budget with the answer, and the answer itself is a
    // few hundred tokens. Room to think is the point of the number.
    max_tokens: 16000,
    model: MODEL,
    system: SYSTEM,
    thinking: { type: 'adaptive' },
    output_config: {
      // A scene read is a judgement call, not a hard reasoning problem;
      // medium effort keeps it responsive and cheap enough to run per scene.
      effort: 'medium',
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [
      {
        role: 'user',
        content: [
          input.position ? `${input.position}.` : '',
          `This is ${input.format === 'prose' ? 'a chapter from a novel' : 'a scene from a screenplay'}.`,
          '',
          input.sceneText,
        ]
          .filter((line) => line.length > 0)
          .join('\n'),
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new SceneReviewError('The structural read was declined for this scene.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new SceneReviewError('The read ran long and was cut off. Try a shorter scene.');
  }

  const text = response.content.find((block) => block.type === 'text');
  if (!text || text.type !== 'text') {
    throw new SceneReviewError('The structural read came back empty.');
  }

  // Structured output makes malformed JSON unlikely, not impossible; a syntax
  // error here must read like every other failure, not like a stack trace.
  let body: unknown;
  try {
    body = JSON.parse(text.text);
  } catch {
    throw new SceneReviewError('The structural read came back in an unreadable shape.');
  }

  const parsed = sceneVerdictSchema.safeParse(body);
  if (!parsed.success) {
    throw new SceneReviewError('The structural read came back in an unreadable shape.');
  }

  return {
    ...parsed.data,
    model: response.model,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
};
