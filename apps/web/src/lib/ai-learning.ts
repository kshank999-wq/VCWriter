import Anthropic from '@anthropic-ai/sdk';
import {
  aidTitle,
  learningSuggestionSchema,
  type LearningAidKind,
  type LearningSuggestion,
} from '@vcwriter/domain';

/**
 * Generating a learning aid from a section's own words (addendum 16 §10).
 *
 * **The shape is the permission**, the same trick the Writers Room's AI rests
 * on (addendum 07 §12). What comes back is a `LearningSuggestion` and nothing
 * else — there is no field in it for `approved`, none for which section this
 * belongs to, and none for the author's own text. A model that decided to
 * approve its own work, or to rewrite what the author had already written, has
 * nowhere to put it, and the domain's parse drops anything extra.
 *
 * What it is handed is the section's manuscript and nothing more: not the
 * chapter around it, not the author's research, not the rest of the book. A
 * summary that quietly drew on the next section is a summary promising the
 * reader something they have not been told yet.
 */

const MODEL = 'claude-opus-5';

let cached: Anthropic | null = null;
/** Resolves the key from the environment, as every other caller here does. */
const client = (): Anthropic => {
  if (!cached) cached = new Anthropic();
  return cached;
};

export const isConfigured = (): boolean => Boolean(process.env['ANTHROPIC_API_KEY']);

export class GenerationFailed extends Error {}

const SCHEMAS: Record<LearningAidKind, Record<string, unknown>> = {
  summary: {
    type: 'object',
    additionalProperties: false,
    required: ['text'],
    properties: {
      text: { type: 'string', description: 'The summary, as one or two short paragraphs.' },
    },
  },
  what_you_learned: {
    type: 'object',
    additionalProperties: false,
    required: ['text'],
    properties: {
      text: {
        type: 'string',
        description: 'The bullets, one per line, with no bullet characters or numbering.',
      },
    },
  },
  quiz: {
    type: 'object',
    additionalProperties: false,
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['prompt', 'answer'],
          properties: {
            prompt: { type: 'string' },
            answer: { type: 'string', description: 'May be empty where the book prints no answers.' },
          },
        },
      },
    },
  },
};

const INSTRUCTIONS: Record<LearningAidKind, string> = {
  summary:
    'Write the end-of-section summary. Two short paragraphs at most, in the same register as the ' +
    'section. Cover what the section actually established, in the order it established it.',
  what_you_learned:
    'Write the "what you learned" recap: one line per concept the section actually taught, ' +
    'phrased as a statement the reader can now make. Between three and seven lines. No bullet ' +
    'characters and no numbering — one concept a line and nothing else.',
  quiz:
    'Write review questions on the concepts this section actually covers. Between three and six. ' +
    'Each one should be answerable from the section alone. Give the answer where the section ' +
    'states it plainly, and leave the answer empty where the question is one for the reader to ' +
    'think about rather than recall.',
};

const SYSTEM = `You are helping an author prepare end-of-section material for an instructional book.

You are given one section of the book and nothing else. Write only about what that section
establishes: if something is not in the text you were given, it does not go in the aid, however
obviously true it is. The reader has not read the next section yet.

Match the book's own register and vocabulary. Do not introduce terminology the section has not
introduced, and do not explain the subject to the author — they wrote it.

What you write is a suggestion. The author reads it, edits it, and decides whether it goes in the
book; nothing you return is published as it stands.`;

export interface Generated {
  suggestion: LearningSuggestion;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Ask for one aid.
 *
 * Returns a plain `LearningSuggestion`. The caller records it with the domain's
 * `suggestAid`, which writes to the suggestion field and cannot reach the
 * author's text — so a generation that goes wrong costs a button press and
 * never a paragraph.
 */
export const generateAid = async (input: {
  kind: LearningAidKind;
  /** The section's own manuscript, from the domain's `sectionTextFor`. */
  sectionText: string;
  /** What the section is called, so the aid can be about something by name. */
  sectionTitle: string;
}): Promise<Generated> => {
  if (input.sectionText.trim().length === 0) {
    throw new GenerationFailed('There is nothing written in this section yet.');
  }

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    thinking: { type: 'adaptive' },
    output_config: {
      // Reading one section and recapping it is not a hard reasoning problem,
      // and it is asked for interactively — the same trade-off the room's
      // readings make, for the same reason.
      effort: 'medium',
      format: { type: 'json_schema', schema: SCHEMAS[input.kind] },
    },
    messages: [
      {
        role: 'user',
        content: [
          `${aidTitle(input.kind)} for the section "${input.sectionTitle}".`,
          '',
          INSTRUCTIONS[input.kind],
          '',
          'The section:',
          '',
          input.sectionText,
        ].join('\n'),
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new GenerationFailed('The request was declined.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new GenerationFailed('The reading ran long and was cut off. Try a shorter section.');
  }

  const block = response.content.find((one) => one.type === 'text');
  if (!block || block.type !== 'text') {
    throw new GenerationFailed('Nothing came back.');
  }

  let body: unknown;
  try {
    body = JSON.parse(block.text);
  } catch {
    throw new GenerationFailed('What came back was not in a shape we could read.');
  }

  try {
    // Parsed through the domain's schema as well as the model's — two gates on
    // the same shape, and the second is the one the tests run. It is also what
    // strips anything the model added that a suggestion has no field for.
    return {
      suggestion: learningSuggestionSchema.parse(body),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch {
    throw new GenerationFailed('What came back was not in a shape we could read.');
  }
};
