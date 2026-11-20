import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

/**
 * **The AI deep check** behind the Edit Check's paid tier (addendum 47).
 *
 * The Edit Check's own rules and Harper run on the writer's computer and catch
 * what a rule can catch. What they cannot judge — whose head a sentence is in,
 * which "he" is meant, whether the light is morning or night — this asks the
 * model, which reads the passage and returns **findings, never prose**. The
 * response has no field that could carry replacement wording, and
 * `guardFindings` throws out any finding whose words cannot be found in the
 * passage or whose explanation carries a rewrite. No cheaters: the writer's
 * book stays the writer's.
 */

/**
 * The Opus-level model. One constant, so moving to the next Opus (5.6, 5.7)
 * is a one-line change, measured again before it ships.
 */
export const DEEP_CHECK_MODEL = 'claude-opus-5-5';

/** Dollars per million tokens for `DEEP_CHECK_MODEL`; thinking is billed as output. */
export const DEEP_CHECK_PRICE = { input: 4, output: 20 } as const;

export const DEEP_CHECKS = [
  'pov',
  'pronoun',
  'continuity',
  'telling',
  'dialogue',
  'pacing',
  'setup',
] as const;
export type DeepCheck = (typeof DEEP_CHECKS)[number];

export const DEEP_CHECK_NAMES: Record<DeepCheck, string> = {
  pov: 'Point of view',
  pronoun: 'Unclear reference',
  continuity: 'Continuity',
  telling: 'Telling, not showing',
  dialogue: 'Dialogue',
  pacing: 'Pacing',
  setup: 'Setup without payoff',
};

export interface DeepCheckLine {
  /** The manuscript element's id; the model sees L1, L2… instead. */
  id: string;
  /** For a script, the element type (action, dialogue…); prose paragraphs leave it out. */
  type?: string;
  text: string;
}

export interface DeepCheckRequest {
  format: 'prose' | 'screenplay';
  pointOfView?: 'first' | 'third-limited' | 'third-omniscient' | 'objective' | 'second';
  tense?: 'past' | 'present';
  /** In third limited, whose heads the passage may be in. */
  viewpoint?: string[];
  lines: DeepCheckLine[];
  /** How hard the model thinks. Measured: see addendum 47. */
  effort?: 'low' | 'medium' | 'high';
}

const findingSchema = z.object({
  line: z.string(),
  quote: z.string(),
  check: z.enum(DEEP_CHECKS),
  severity: z.enum(['concern', 'note']),
  confidence: z.enum(['high', 'medium', 'low']),
  message: z.string(),
  why: z.string(),
});
const responseSchema = z.object({ findings: z.array(findingSchema) });
export type RawDeepFinding = z.infer<typeof findingSchema>;

/** Written out, as in `ai.ts`: the SDK's zod helper needs Zod 4. */
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          line: { type: 'string', description: 'The line label the finding is on, such as L12.' },
          quote: {
            type: 'string',
            description: 'The exact words on that line the finding is about, copied character for character. At most fifteen words.',
          },
          check: { type: 'string', enum: [...DEEP_CHECKS] },
          severity: {
            type: 'string',
            enum: ['concern', 'note'],
            description: 'concern: probably a slip the writer did not intend. note: worth a look, may well be deliberate.',
          },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          message: { type: 'string', description: 'What is off, in one sentence. Never a replacement.' },
          why: { type: 'string', description: 'Why it reads as off, in one or two sentences. Never a replacement.' },
        },
        required: ['line', 'quote', 'check', 'severity', 'confidence', 'message', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['findings'],
  additionalProperties: false,
} as const;

const SYSTEM = `You are a line editor reading a passage of someone's novel or screenplay. You point out problems; you never fix them. The writer does every bit of the writing.

Never write replacement words, an example sentence, a suggested phrasing or a "for instance". Never quote words that are not in the passage. Describe what is off and why, and stop.

Look only for these:
- pov: a sentence inside the head of a character who is not the viewpoint character (head-hopping); the viewpoint character knowing what they cannot know; the narrator drifting into knowledge or judgement the chosen point of view does not allow. Free indirect style — the narration taking on the viewpoint character's own words and thoughts — is correct, not a slip.
- pronoun: a he, she, it or they whose person or thing a reader cannot tell for certain.
- continuity: something that contradicts the passage itself — time of day, weather, who is present, where something is, a physical detail.
- telling: an emotion or quality named in summary at a moment the scene is dramatising. Sparingly: summary is often right.
- dialogue: two characters who sound interchangeable, or a run of speech where a reader loses track of who is speaking.
- pacing: a stretch that stalls or rushes against the rest of the passage. Quote where it starts.
- setup: something given weight that the passage then drops. A note only, low confidence: the payoff may come later.

Do not report spelling, grammar, punctuation, word choice or style: other checks handle those. Do not report a character's dialect or idiom. Do not flag what a skilled writer plainly did on purpose. Report what a careful professional editor would raise, and nothing to fill space: an empty list is a good answer for a clean passage.`;

const describe = (request: DeepCheckRequest): string => {
  const parts = [request.format === 'prose' ? 'This is prose fiction.' : 'This is a screenplay. Lines are labelled with their element type.'];
  if (request.pointOfView) {
    const pov = {
      first: 'first person',
      'third-limited': 'third person limited',
      'third-omniscient': 'third person omniscient',
      objective: 'objective (no character’s thoughts)',
      second: 'second person',
    }[request.pointOfView];
    parts.push(`The writer has set the point of view as ${pov}.`);
  }
  if (request.viewpoint?.length) parts.push(`Viewpoint characters: ${request.viewpoint.join(', ')}.`);
  if (request.tense) parts.push(`Narrative tense: ${request.tense}.`);
  return parts.join(' ');
};

const label = (index: number) => `L${index + 1}`;

export const passageText = (request: DeepCheckRequest): string =>
  request.lines.map((line, index) => `${label(index)}${line.type ? ` [${line.type}]` : ''}: ${line.text}`).join('\n');

const flat = (text: string) =>
  text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Words of advice that introduce new wording. */
const REWRITE_CUES =
  /\b(instead[,:]? (write|say|use|try)|consider (writing|saying|rephrasing|changing (it|this) to)|could (read|be rewritten|become)|try (something like|writing|saying)|for example[,:]? ["“]|rewrite (it|this) as|replace (it|this) with|such as ["“]|might read)\b/i;

export interface DeepFinding {
  elementId: string;
  quote: string;
  start: number;
  end: number;
  check: DeepCheck;
  severity: 'concern' | 'note';
  confidence: 'high' | 'medium' | 'low';
  message: string;
  why: string;
}

export interface GuardResult {
  findings: DeepFinding[];
  /** Thrown out, and why: counted, because a model that keeps trying to rewrite is a finding of its own. */
  dropped: { finding: RawDeepFinding; reason: 'no-line' | 'not-in-line' | 'rewrite' }[];
}

/**
 * **The rewrite guard.** A finding survives only if its words are on the
 * line it names, and if nothing it says quotes words the passage lacks or
 * reads as replacement advice.
 */
export const guardFindings = (raw: RawDeepFinding[], lines: DeepCheckLine[]): GuardResult => {
  const passage = flat(lines.map((line) => line.text).join(' '));
  const out: GuardResult = { findings: [], dropped: [] };
  for (const finding of raw) {
    const index = Number(/^L(\d+)$/i.exec(finding.line.trim())?.[1] ?? NaN) - 1;
    const line = lines[index];
    if (!line) {
      out.dropped.push({ finding, reason: 'no-line' });
      continue;
    }
    const at = flat(line.text).indexOf(flat(finding.quote));
    if (!finding.quote.trim() || at < 0) {
      out.dropped.push({ finding, reason: 'not-in-line' });
      continue;
    }
    const said = `${finding.message} ${finding.why}`;
    // Anything in quotation marks of four words or more must be the writer's own.
    const quoted = [...said.matchAll(/["“]([^"”]{3,})["”]/g)].map((match) => match[1]!);
    const invented = quoted.some((one) => one.trim().split(/\s+/).length >= 4 && !passage.includes(flat(one)));
    if (invented || REWRITE_CUES.test(said)) {
      out.dropped.push({ finding, reason: 'rewrite' });
      continue;
    }
    // Place it on the line as it is written (flattening only changes characters one for one, bar spaces).
    const exact = line.text.indexOf(finding.quote);
    const start = exact >= 0 ? exact : Math.max(0, at);
    out.findings.push({
      elementId: line.id,
      quote: finding.quote,
      start,
      end: start + finding.quote.length,
      check: finding.check,
      severity: finding.severity,
      confidence: finding.confidence,
      message: finding.message,
      why: finding.why,
    });
  }
  return out;
};

export interface DeepCheckUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface DeepCheckResult extends GuardResult {
  model: string;
  usage: DeepCheckUsage;
  /** What the call cost us, in dollars, at list price. */
  costDollars: number;
  words: number;
}

export class DeepCheckError extends Error {}

export const wordsIn = (lines: DeepCheckLine[]): number =>
  lines.reduce((sum, line) => sum + (line.text.match(/\S+/g)?.length ?? 0), 0);

export const costOf = (usage: DeepCheckUsage): number =>
  ((usage.inputTokens + usage.cacheWriteTokens * 1.25 + usage.cacheReadTokens * 0.1) * DEEP_CHECK_PRICE.input +
    usage.outputTokens * DEEP_CHECK_PRICE.output) /
  1_000_000;

export const runDeepCheck = async (request: DeepCheckRequest, client = new Anthropic()): Promise<DeepCheckResult> => {
  const response = await client.messages.create({
    model: DEEP_CHECK_MODEL,
    max_tokens: 32000,
    system: SYSTEM,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: request.effort ?? 'medium',
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [{ role: 'user', content: `${describe(request)}\n\n${passageText(request)}` }],
  });
  if (response.stop_reason === 'refusal') throw new DeepCheckError('The check was declined for this passage.');
  if (response.stop_reason === 'max_tokens') throw new DeepCheckError('The check ran long and was cut off. Try a shorter passage.');
  const text = response.content.find((block) => block.type === 'text');
  if (!text || text.type !== 'text') throw new DeepCheckError('The check came back empty.');
  let parsed: z.infer<typeof responseSchema>;
  try {
    parsed = responseSchema.parse(JSON.parse(text.text));
  } catch {
    throw new DeepCheckError('The check came back in an unreadable shape.');
  }
  const usage: DeepCheckUsage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
  };
  return {
    ...guardFindings(parsed.findings, request.lines),
    model: response.model,
    usage,
    costDollars: costOf(usage),
    words: wordsIn(request.lines),
  };
};
