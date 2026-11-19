import {
  isNarrowFix,
  linesInScope,
  narrationSpans,
  editModeOf,
  editorProfileOf,
  type EditCategory,
  type EditConfidence,
  type EditScope,
  type EditSeverity,
  type OutsideHit,
  type ProjectFile,
} from '@vcwriter/domain';

/**
 * **Spelling and grammar for the Edit Check** (editor spec §4, §7: *run
 * locally where feasible*), from Harper — an open-source grammar checker
 * (Apache-2.0) that runs inside the app as WebAssembly. Nothing is sent
 * anywhere; it works offline.
 *
 * Harper's notes become findings of the Edit Check's own shape. A fix is
 * kept only when it is one of Harper's narrow replacements for a mechanical
 * slip — *bought* for *buyed*, *to* for *too* — and the writer still accepts
 * each one. In speech (quoted words in prose, a script's dialogue) only
 * spelling and repeated words are checked: grammar there is the character's.
 */

type Linter = import('harper.js').LocalLinter;
let linter: Promise<Linter> | null = null;

/** Rules the Edit Check already has, or that are a house style rather than an error. */
const OFF = ['LongSentences', 'Spaces', 'UnclosedQuotes', 'OxfordComma', 'NoOxfordComma', 'UseEllipsisCharacter'];

const harper = (): Promise<Linter> => {
  linter ??= (async () => {
    const [{ LocalLinter }, { binaryInlined }] = await Promise.all([import('harper.js'), import('harper.js/binaryInlined')]);
    const made = new LocalLinter({ binary: binaryInlined });
    await made.setup();
    const config = await made.getLintConfig();
    for (const rule of OFF) if (rule in config) config[rule] = false;
    await made.setLintConfig(config);
    return made;
  })();
  linter.catch(() => {
    linter = null;
  });
  return linter;
};

/** Harper's kinds of note, as the Edit Check's categories. */
const placed = (kind: string): { category: EditCategory; severity: EditSeverity; confidence: EditConfidence } => {
  switch (kind) {
    case 'Spelling':
    case 'Typo':
      return { category: 'spelling', severity: 'error', confidence: 'high' };
    case 'Repetition':
      return { category: 'grammar', severity: 'error', confidence: 'high' };
    case 'Agreement':
    case 'Grammar':
    case 'Malapropism':
    case 'Eggcorn':
    case 'WordChoice':
    case 'Usage':
    case 'WordOrder':
    case 'BoundaryError':
    case 'Nonstandard':
    case 'Capitalization':
      return { category: 'grammar', severity: 'error', confidence: 'medium' };
    case 'Punctuation':
    case 'Formatting':
      return { category: 'punctuation', severity: 'error', confidence: 'medium' };
    case 'Redundancy':
    case 'Readability':
      return { category: 'clarity', severity: 'info', confidence: 'medium' };
    default:
      return { category: 'style', severity: 'info', confidence: 'low' };
  }
};

const RULE_TEXT: Partial<Record<EditCategory, string>> = {
  spelling: 'The word is not in the dictionary. If it is a name or a word of your own, add it to the project dictionary.',
  grammar: 'A grammatical slip, such as agreement, a wrong word form or a word repeated.',
  punctuation: 'Punctuation that does not follow the usual rule.',
  clarity: 'Words that may say the same thing twice, or less clearly than they could.',
  style: 'A matter of style, not a rule.',
};

/** Speech, where only spelling and doubled words are checked. */
const SPEECH_TYPES = new Set(['dialogue', 'parenthetical', 'lyric']);
/** Lines that are not sentences at all. */
const SKIP_TYPES = new Set(['character', 'transition', 'figure', 'scene_break', 'music_cue']);

export interface GrammarProgress {
  done: number;
  total: number;
}

/**
 * Harper over every line in the scope. Resolves with its findings; `signal`
 * stops it between lines (§7: cancellation and progress).
 */
export const grammarHits = async (
  file: ProjectFile,
  scope: EditScope,
  options: { onProgress?(progress: GrammarProgress): void; signal?: AbortSignal; words?: readonly string[] } = {},
): Promise<OutsideHit[]> => {
  const lines = linesInScope(file, scope).filter((line) => line.text.trim() && !SKIP_TYPES.has(line.type));
  const lint = await harper();
  const words = [
    ...editorProfileOf(file).dictionary,
    ...(options.words ?? []),
    ...file.characters.flatMap((one) => one.name.split(/\s+/)),
    ...(file.locations ?? []).flatMap((one) => one.name.split(/\s+/)),
  ].filter((one) => one.length > 1);
  if (words.length > 0) await lint.importWords(words);
  const screenplay = editModeOf(file) === 'screenplay';
  const out: OutsideHit[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (options.signal?.aborted) break;
    const line = lines[index]!;
    const speechOnly = SPEECH_TYPES.has(line.type) || (screenplay && line.type === 'scene_heading');
    const narration = speechOnly ? [] : narrationSpans(line.text);
    const inNarration = (start: number, end: number) => narration.some(([from, to]) => start >= from && end <= to);
    for (const one of await lint.lint(line.text, { language: 'plaintext' })) {
      const span = one.span();
      const kind = one.lint_kind();
      const where = placed(kind);
      const mechanical = where.category === 'spelling' || kind === 'Repetition';
      // Grammar is the character's in speech: only spelling and doubled words there.
      if (!mechanical && !inNarration(span.start, span.end)) continue;
      const suggestion = one.suggestions()[0];
      const fix = suggestion ? suggestion.get_replacement_text() : undefined;
      out.push({
        beatId: line.beatId,
        elementId: line.elementId,
        ruleId: `harper-${kind.toLowerCase()}`,
        ...where,
        start: span.start,
        end: span.end,
        message: one.message().replace(/`/g, '“').replace(/“([^“]*)“/g, '“$1”'),
        rule: RULE_TEXT[where.category] ?? 'A note from the grammar checker.',
        ...(fix !== undefined && where.severity === 'error' && isNarrowFix(fix) ? { fix } : {}),
      });
    }
    if (index % 10 === 9) {
      options.onProgress?.({ done: index + 1, total: lines.length });
      // Let the screen breathe between batches.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  options.onProgress?.({ done: lines.length, total: lines.length });
  return out;
};

/** Start Harper early, so the first check does not wait for it. */
export const warmGrammar = (): void => {
  void harper().catch(() => undefined);
};
