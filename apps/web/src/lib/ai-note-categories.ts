import Anthropic from '@anthropic-ai/sdk';
import { suggestedCategoriesSchema, type SuggestedCategories } from '@vcwriter/domain';

/**
 * Naming groupings for the Note Sorter (addendum 26 §14a).
 *
 * This is the **one** of spec §15's three functions a model is better at than
 * the sitting is. *Which of these six categories does this paragraph belong in*
 * is answered by what the writer has already filed, and §14 argues that at
 * length; *what would you call the thing these nine paragraphs have in common*
 * is not, because a reading can only offer a **word that repeats**, and a
 * grouping's name is very often a word that appears in none of them. The notes
 * say *villain*, *antagonist*, *the man burning the village* — and the category
 * is called **Antagonists**, which no count will ever produce.
 *
 * **The shape is the permission**, the third time (addendum 07 §12, addendum 16
 * §10). What comes back is a list of **names with a sentence** and nothing
 * else: `suggestedCategoriesSchema` has no field for a passage, a range, a card
 * or a category id, so a model that decided to sort the notes itself has
 * nowhere to put the answer. Spec §15's *AI should not silently reorganize
 * source material* is kept by the type rather than by care, and the screen's
 * press then makes an **empty** category exactly as the read ideas do.
 *
 * What goes up is the unsorted paragraphs and the category names — no ids, no
 * cards, no sources, no project — and the screen says so beside the button,
 * because a writer sending a page of private notes somewhere should be told
 * that is what the press does.
 */

const MODEL = 'claude-opus-5';

let cached: Anthropic | null = null;
const client = (): Anthropic => {
  if (!cached) cached = new Anthropic();
  return cached;
};

export const isConfigured = (): boolean => Boolean(process.env['ANTHROPIC_API_KEY']);

export class NamingFailed extends Error {}

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'because'],
        properties: {
          name: {
            type: 'string',
            description: 'What the category would be called. Two or three words at most.',
          },
          because: {
            type: 'string',
            description:
              'One sentence saying what the passages have in common, in the writer’s own terms.',
          },
        },
      },
    },
  },
};

const SYSTEM = `You are helping a writer sort a page of their own rough notes into categories.

You are given the passages they have not yet filed, and the names of the categories they have
already made. Your job is to name the groupings that are there and that they have no category for
yet — nothing else.

Name what is actually in the passages. If a grouping is not in the text you were given it does not
go in the list, however obviously it might belong in a book of this kind. Two or three words at
most, in the writer's own vocabulary and register, as a heading they would write themselves.

Do not propose a category that only one passage would go in; a category of one is a note. Do not
propose anything close in meaning to a category they already have — that is a placement, not a new
grouping, and the program works those out itself.

Say nothing at all rather than pad the list. Returning two good names is a better answer than six.

You are not sorting anything. You return names and a sentence each; the writer decides whether any
category is made, and nothing you return files a single passage.`;

export interface Named {
  suggested: SuggestedCategories;
  inputTokens: number;
  outputTokens: number;
}

export const suggestNames = async (input: {
  /** The unsorted paragraphs, from the domain's `whatToRead`. */
  passages: string[];
  /** What the sitting's categories are already called. */
  categories: string[];
}): Promise<Named> => {
  if (input.passages.length === 0) {
    throw new NamingFailed('There is nothing unsorted to read.');
  }

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    thinking: { type: 'adaptive' },
    output_config: {
      // Naming what a pile of notes is about is a judgement rather than a hard
      // reasoning problem, and it is asked for interactively — the learning
      // aid's trade-off, for the learning aid's reason.
      effort: 'medium',
      format: { type: 'json_schema', schema: SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: [
          input.categories.length === 0
            ? 'The writer has made no categories yet.'
            : `Categories they already have: ${input.categories.join(', ')}.`,
          '',
          'The passages they have not filed:',
          '',
          ...input.passages.map((one, index) => `${index + 1}. ${one}`),
        ].join('\n'),
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new NamingFailed('The request was declined.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new NamingFailed('The reading ran long and was cut off. Try it with fewer notes.');
  }

  const block = response.content.find((one) => one.type === 'text');
  if (!block || block.type !== 'text') {
    throw new NamingFailed('Nothing came back.');
  }

  let body: unknown;
  try {
    body = JSON.parse(block.text);
  } catch {
    throw new NamingFailed('What came back was not in a shape we could read.');
  }

  try {
    // Parsed through the domain's schema as well as the model's — two gates on
    // one shape, and the second is the one the tests run. It is also what drops
    // anything the model added that an idea has no field for.
    return {
      suggested: suggestedCategoriesSchema.parse(body),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch {
    throw new NamingFailed('What came back was not in a shape we could read.');
  }
};
