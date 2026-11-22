import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_NATURAL_VOICE, naturalVoiceDescriptors, plainInline } from '@vcwriter/domain';
import { NaturalPlayer, useNaturalVoices } from './natural-voices';
import { usePreference } from './use-split';

/**
 * **Read aloud, from the page itself** (from Ken, 22 November: *maybe we need
 * to … just read right out of the manuscript or script window. Doesn't really
 * need to be something separate. It can just be a playback button. And so if
 * you hit play, it starts at the beginning. If you select at a location, it
 * will start playing from there. So you can skip around. And the voices are
 * from the new library*).
 *
 * One Play button over a book's page. It reads the lines in order in a
 * natural voice — from the start, or from where the cursor was last put —
 * lighting the line it is reading and keeping it in view. Clicking another
 * place while it reads moves the reading there.
 */

export interface ReadLine {
  id: string;
  type: string;
  text: string;
}

/** Lines that are not words to read. */
const SILENT = new Set(['scene_break', 'figure', 'page_break']);
const RATES = [0.75, 0.9, 1, 1.15, 1.3, 1.5];

const highlights = () => (globalThis as unknown as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights;
const HighlightCtor = () => (globalThis as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;

/** Light the line being read, and bring it into view. */
const light = (scope: HTMLElement | null, id: string | null) => {
  const registry = highlights();
  const Ctor = HighlightCtor();
  if (!registry || !Ctor) return;
  if (!scope || !id) {
    registry.delete('vcw-reading');
    return;
  }
  const ink = scope.querySelector(`[data-element-id="${id}"] .ink`) ?? scope.querySelector(`[data-element-id="${id}"]`);
  if (!ink) return;
  const range = document.createRange();
  range.selectNodeContents(ink);
  registry.set('vcw-reading', new Ctor(range));
  (ink as HTMLElement).scrollIntoView?.({ block: 'center', behavior: 'smooth' });
};

export function ReadAloud({ lines, scope, autoStart = 0 }: { lines: () => ReadLine[]; scope: () => HTMLElement | null; autoStart?: number }) {
  const natural = useNaturalVoices();
  const [voice, setVoice] = usePreference('readAloudVoice', DEFAULT_NATURAL_VOICE);
  const [rate, setRate] = usePreference('readAloudRate', 1);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const player = useRef<NaturalPlayer | null>(null);
  const generation = useRef(0);
  /** Where the writer last put the cursor on this page: where Play starts. */
  const placed = useRef<{ id: string; caret: number } | null>(null);
  const voices = useMemo(() => naturalVoiceDescriptors(), []);

  const stop = useCallback(() => {
    generation.current += 1;
    player.current?.stop();
    setReading(false);
    light(scope(), null);
  }, [scope]);

  const run = useCallback(
    async (from: { id: string; caret: number } | null) => {
      const token = ++generation.current;
      player.current?.stop();
      player.current ??= new NaturalPlayer();
      const all = lines();
      let index = from ? Math.max(0, all.findIndex((line) => line.id === from.id)) : 0;
      setReading(true);
      setProblem(null);
      const words = (line: ReadLine, caret: number) => (SILENT.has(line.type) ? '' : plainInline(line.text.slice(caret)).trim());
      for (let caret = from?.caret ?? 0; index < all.length; index += 1, caret = 0) {
        if (generation.current !== token) return;
        const line = all[index]!;
        const said = words(line, caret);
        if (!said) continue;
        light(scope(), line.id);
        // The next line is made while this one is heard, so there is no pause between them.
        const next = all.slice(index + 1).find((one) => words(one, 0));
        if (next) void player.current.prepare(words(next, 0), voice, rate).catch(() => undefined);
        try {
          await player.current.play(said, voice, rate);
        } catch (cause) {
          if (generation.current === token) setProblem(cause instanceof Error ? cause.message : 'That line could not be read.');
        }
      }
      if (generation.current === token) {
        setReading(false);
        light(scope(), null);
      }
    },
    [lines, scope, voice, rate],
  );

  // Where the cursor is put, and a click elsewhere while reading moves the reading there.
  useEffect(() => {
    const here = (event: Event) => {
      const root = scope();
      const target = event.target as HTMLElement | null;
      if (!root || !target || !root.contains(target)) return;
      const line = target.closest('[data-element-id]') as HTMLElement | null;
      const id = line?.dataset['elementId'];
      if (!id) return;
      const box = target instanceof HTMLTextAreaElement ? target : null;
      placed.current = { id, caret: box ? box.selectionStart : 0 };
      if (event.type === 'pointerup' && generation.current > 0 && readingRef.current) void run(placed.current);
    };
    window.addEventListener('pointerup', here, true);
    window.addEventListener('keyup', here, true);
    return () => {
      window.removeEventListener('pointerup', here, true);
      window.removeEventListener('keyup', here, true);
    };
  }, [scope, run]);
  const readingRef = useRef(reading);
  readingRef.current = reading;

  // Asked to read from elsewhere (the Read back button on the bar).
  useEffect(() => {
    if (autoStart > 0 && natural.installed) void run(placed.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  // Never leave a voice talking after the page goes.
  useEffect(() => () => stop(), [stop]);

  if (!natural.available) {
    return <span className="read-aloud muted small">Reading aloud runs in the desktop app.</span>;
  }
  if (!natural.installed) {
    return (
      <span className="read-aloud">
        <button
          type="button"
          className="ghost small"
          disabled={natural.progress !== null}
          title="Read aloud uses VC Writer's natural voices: download them once (about 100 MB, free, works offline)"
          onClick={() => void natural.install()}
        >
          {natural.progress !== null ? `Getting voices ${Math.round(natural.progress * 100)}%` : '▶ Read aloud: get the voices'}
        </button>
      </span>
    );
  }
  return (
    <span className="read-aloud" role="group" aria-label="Read aloud">
      <button
        type="button"
        className={reading ? 'read-aloud-play on' : 'read-aloud-play'}
        aria-label={reading ? 'Stop reading' : 'Read aloud'}
        title={reading ? 'Stop' : 'Read aloud from the start, or from where you put the cursor'}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => (reading ? stop() : void run(placed.current))}
      >
        {reading ? '■ Stop' : '▶ Read aloud'}
      </button>
      <select aria-label="Reading voice" value={voice} onChange={(event) => setVoice(event.target.value)}>
        {voices.map((one) => (
          <option key={one.id} value={one.id}>
            {one.name.replace(' (natural)', '')} · {one.accent} {one.gender}
          </option>
        ))}
      </select>
      <select aria-label="Reading speed" value={String(rate)} onChange={(event) => setRate(Number(event.target.value))}>
        {RATES.map((one) => (
          <option key={one} value={String(one)}>
            {one === 1 ? 'Normal speed' : `${one}×`}
          </option>
        ))}
      </select>
      {problem ? (
        <span className="read-aloud-problem" role="status">
          {problem}
        </span>
      ) : null}
    </span>
  );
}
