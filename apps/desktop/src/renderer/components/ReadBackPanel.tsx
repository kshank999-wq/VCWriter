import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  assignCharacterVoice,
  estimatedSpokenSeconds,
  findUnit,
  playbackPlan,
  isProseFormat,
  naturalVoiceDescriptors,
  naturalVoiceFor,
  preferredDefaultVoice,
  suggestVoiceAssignments,
  toAssignment,
  workingCast,
  type ProjectFile,
  type StructuralUnitId,
  withNaturalVoicesOnly,
  wordAtFraction,
} from '@vcwriter/domain';
import { NaturalPlayer, useNaturalVoices } from '../natural-voices';
import { NaturalVoicesBox } from './NaturalVoicesBox';

interface ReadBackPanelProps {
  file: ProjectFile;
  currentUnitId: StructuralUnitId | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/**
 * Read-back (spec §10).
 *
 * A scene plays as a conversation: each character speaks in the voice assigned
 * to them, action and headings in the narrator's. **Only the natural voices**
 * (addendum 45 §8; from Ken, 11 November: *put Kokoro in every module and
 * take out the computer's voices*): they run on this computer, offline, and
 * cost nothing. A voice chosen among the computer's own before then counts as
 * not chosen, and is read by the default. The assignment stores a provider and
 * voice id, so a cloud provider later does not touch the project.
 */
export function ReadBackPanel({ file: stored, currentUnitId, onUpdate }: ReadBackPanelProps) {
  /** Natural voices (addendum 45), once the writer has downloaded them. */
  const natural = useNaturalVoices();
  const player = useRef<NaturalPlayer | null>(null);
  const file = useMemo(() => withNaturalVoicesOnly(stored), [stored]);
  const voices = useMemo(() => (natural.installed ? naturalVoiceDescriptors() : []), [natural.installed]);
  const [scope, setScope] = useState<'scene' | 'project'>('scene');
  const [rate, setRate] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<number | null>(null);
  /** The word being spoken in the line being read, as character offsets. */
  const [spoken, setSpoken] = useState<{ index: number; from: number; to: number } | null>(null);
  const cancelled = useRef(false);
  const current = useRef<HTMLParagraphElement | null>(null);
  /** The voice used where nothing is chosen: George, the natural British male. */
  const fallback = useMemo(() => preferredDefaultVoice(naturalVoiceDescriptors()), []);
  const [failed, setFailed] = useState(false);

  const plan = useMemo(
    () => playbackPlan(file, scope === 'scene' && currentUnitId ? { unitId: currentUnitId } : {}),
    [file, scope, currentUnitId],
  );

  const stop = useCallback(() => {
    cancelled.current = true;
    player.current?.stop();
    setPlaying(false);
    setNowPlaying(null);
    setSpoken(null);
  }, []);

  // The line being read stays in view, so the reading can be followed.
  useEffect(() => {
    if (nowPlaying !== null) current.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [nowPlaying]);

  // Never leave a voice talking to an empty room.
  useEffect(() => stop, [stop]);

  /** Read from a line — the first, or the one clicked in the script. */
  const play = useCallback(async (from = 0) => {
    if (plan.steps.length === 0 || !natural.installed) return;

    player.current?.stop();
    cancelled.current = false;
    setFailed(false);
    setPlaying(true);

    const voiceFor = (step: (typeof plan.steps)[number]) => naturalVoiceFor(step.voice, fallback?.id);
    const speedFor = (step: (typeof plan.steps)[number]) => rate * (step.voice?.rate ?? 1);
    player.current ??= new NaturalPlayer();
    const steps = plan.steps.slice(from);

    for (const [position, step] of steps.entries()) {
      if (cancelled.current) break;
      setNowPlaying(step.index);
      setSpoken(null);

      // **The word being read is lit** (from Ken: *it needs to highlight as
      // it's reading so you can follow along and find your errors*).
      const now = player.current.play(step.text, voiceFor(step), speedFor(step), (fraction) => {
        const word = wordAtFraction(step.text, fraction);
        if (word) setSpoken({ index: step.index, ...word });
      });
      // The next line is generated while this one is heard — asked for after
      // this one, so it never holds this one up.
      const next = steps[position + 1];
      if (next) void player.current.prepare(next.text, voiceFor(next), speedFor(next)).catch(() => undefined);

      try {
        await now;
      } catch {
        // A line the voice could not make is skipped, and the writer told,
        // rather than stalling the whole reading.
        setFailed(true);
      }
    }

    if (!cancelled.current) {
      setPlaying(false);
      setNowPlaying(null);
      setSpoken(null);
    }
  }, [plan, rate, fallback, natural.installed]);

  const seconds = estimatedSpokenSeconds(plan);
  const unit = currentUnitId ? findUnit(file, currentUnitId) : null;
  const supported = natural.installed;

  return (
    <div className="readback">
      <div className="panel-header">
        <h2>Read back</h2>
        <div className="editor-controls">
          <select value={scope} onChange={(event) => setScope(event.target.value as 'scene' | 'project')}>
            <option value="scene" disabled={!currentUnitId}>
              {unit ? `${unit.sequenceLabel || unit.kind} ${unit.title || ''}`.trim() : 'Current scene'}
            </option>
            <option value="project">Whole project</option>
          </select>
          <label className="toggle">
            Speed
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
              aria-label="Playback speed"
            />
            <span className="muted">{rate.toFixed(1)}×</span>
          </label>
          <button type="button" className="primary" disabled={!supported || playing} onClick={() => void play(0)}>
            Play
          </button>
          <button type="button" disabled={!playing} onClick={stop}>
            Stop
          </button>
        </div>
      </div>

      {failed ? <p className="notice">A line could not be read and was skipped.</p> : null}

      <p className="muted">
        {plan.steps.length} {plan.steps.length === 1 ? 'line' : 'lines'} · about {Math.round(seconds / 60)} min
        {nowPlaying !== null ? ` · reading line ${nowPlaying + 1}` : ''}
      </p>

      {/* **The script, as it is read** (from Ken: *you need to be able to see
          the script or manuscript as you're listening… it needs to highlight
          as it's reading so you can follow along and find your errors*). The
          line being read is lit and kept in view, and the word being spoken
          is marked inside it; a click on any line reads from there. */}
      <div className={`readback-script${isProseFormat(file.project.format) ? ' prose' : ''}`} aria-label="The script being read">
        {plan.steps.length === 0 ? (
          <p className="muted">Nothing to read here yet.</p>
        ) : (
          plan.steps.map((step) => {
            const on = nowPlaying === step.index;
            const word = on && spoken?.index === step.index ? spoken : null;
            return (
              <p
                key={step.index}
                ref={on ? current : undefined}
                className={`readback-line ${step.kind}${on ? ' reading' : ''}`}
                title="Read from here"
                onClick={() => void play(step.index)}
              >
                {step.kind === 'dialogue' && step.speaker ? <span className="readback-speaker">{step.speaker}</span> : null}
                <span className="readback-words">
                  {word ? (
                    <>
                      {step.text.slice(0, word.from)}
                      <mark className="readback-word">{step.text.slice(word.from, word.to)}</mark>
                      {step.text.slice(word.to)}
                    </>
                  ) : (
                    step.text
                  )}
                </span>
              </p>
            );
          })
        )}
      </div>

      {plan.unassigned.length > 0 ? (
        <p className="notice">
          {plan.unassigned.join(', ')} {plan.unassigned.length === 1 ? 'has' : 'have'} no voice yet and will be
          read by the narrator.
        </p>
      ) : null}

      <NaturalVoicesBox natural={natural} />

      <div className="panel-header">
        <h3>Voices</h3>
        <button
          type="button"
          className="ghost"
          disabled={voices.length === 0}
          onClick={() =>
            onUpdate((current) => {
              const suggestions = suggestVoiceAssignments(withNaturalVoicesOnly(current), voices);
              return Object.entries(suggestions).reduce(
                (draft, [characterId, assignment]) =>
                  assignCharacterVoice(draft, characterId as never, assignment),
                current,
              );
            })
          }
        >
          Suggest a cast
        </button>
      </div>

      <ul className="voice-list">
        <li>
          <span className="voice-name">Narrator (action and description)</span>
          <select
            aria-label="Narrator voice"
            value={file.settings.narratorVoice?.voiceId ?? ''}
            onChange={(event) => {
              const chosen = voices.find((voice) => voice.id === event.target.value);
              onUpdate((current) => ({
                ...current,
                settings: { ...current.settings, narratorVoice: chosen ? toAssignment(chosen) : null },
              }));
            }}
          >
            <option value="">{fallback ? `Default voice — ${fallback.name}` : 'Default voice'}</option>
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
                {voice.accent ? ` · ${voice.accent}` : ''}
                {voice.gender !== 'unknown' ? ` · ${voice.gender}` : ''}
              </option>
            ))}
          </select>
        </li>

        {/* `workingCast`, never a filter of our own: `!archived` was the whole
            answer before the graveyard and is half of one now (addendum 24
            §5i), so a deleted person kept a voice row here. */}
        {workingCast(file).map((character) => (
            <li key={character.id}>
              <span className="voice-name">{character.name}</span>
              <select
                aria-label={`Voice for ${character.name}`}
                value={character.voice?.voiceId ?? ''}
                onChange={(event) => {
                  const chosen = voices.find((voice) => voice.id === event.target.value);
                  onUpdate((current) =>
                    assignCharacterVoice(current, character.id, chosen ? toAssignment(chosen) : null),
                  );
                }}
              >
                <option value="">{fallback ? `No voice of their own — ${fallback.name}` : 'No voice — read as narration'}</option>
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                    {voice.accent ? ` · ${voice.accent}` : ''}
                    {voice.gender !== 'unknown' ? ` · ${voice.gender}` : ''}
                    {voice.age !== 'unknown' ? ` · ${voice.age}` : ''}
                  </option>
                ))}
              </select>
            </li>
          ))}
      </ul>

      {workingCast(file).length === 0 ? (
        <p className="muted empty">Add characters to the project to give them voices.</p>
      ) : null}
    </div>
  );
}
