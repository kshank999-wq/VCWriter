import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  assignCharacterVoice,
  describeVoice,
  estimatedSpokenSeconds,
  findUnit,
  playbackPlan,
  isProseFormat,
  preferredDefaultVoice,
  sortVoices,
  suggestVoiceAssignments,
  toAssignment,
  workingCast,
  type ProjectFile,
  type StructuralUnitId,
  type VoiceDescriptor,
} from '@vcwriter/domain';

interface ReadBackPanelProps {
  file: ProjectFile;
  currentUnitId: StructuralUnitId | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/**
 * Read-back (spec §10).
 *
 * A scene plays as a conversation: each character speaks in the voice assigned
 * to them, action and headings in the narrator's. The voices come from the
 * operating system, so this works offline and costs nothing, and the
 * assignment stores a provider and voice id rather than anything vendor
 * specific — swapping in a cloud provider later does not touch the project.
 */
export function ReadBackPanel({ file, currentUnitId, onUpdate }: ReadBackPanelProps) {
  const [voices, setVoices] = useState<VoiceDescriptor[]>([]);
  const [scope, setScope] = useState<'scene' | 'project'>('scene');
  const [rate, setRate] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<number | null>(null);
  /** The word being spoken in the line being read, as character offsets. */
  const [spoken, setSpoken] = useState<{ index: number; from: number; to: number } | null>(null);
  const cancelled = useRef(false);
  const current = useRef<HTMLParagraphElement | null>(null);
  /**
   * The voice used where nothing is chosen: Daniel, the British male, where
   * the computer has him (from Ken: *the voices are just terrible. Let's make
   * Daniel the British male the default voice*).
   */
  const fallback = useMemo(() => preferredDefaultVoice(voices), [voices]);

  // The voice list arrives asynchronously on most platforms.
  useEffect(() => {
    const synthesis = window.speechSynthesis;
    if (!synthesis) return;

    const load = () => {
      setVoices(
        sortVoices(
          synthesis
            .getVoices()
            .map((voice) => describeVoice({ id: voice.voiceURI, name: voice.name, lang: voice.lang })),
        ),
      );
    };
    load();
    synthesis.addEventListener('voiceschanged', load);
    return () => synthesis.removeEventListener('voiceschanged', load);
  }, []);

  const plan = useMemo(
    () => playbackPlan(file, scope === 'scene' && currentUnitId ? { unitId: currentUnitId } : {}),
    [file, scope, currentUnitId],
  );

  const stop = useCallback(() => {
    cancelled.current = true;
    window.speechSynthesis?.cancel();
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
    const synthesis = window.speechSynthesis;
    if (!synthesis || plan.steps.length === 0) return;

    synthesis.cancel();
    cancelled.current = false;
    setPlaying(true);

    const available = synthesis.getVoices();
    const daniel = fallback ? available.find((voice) => voice.voiceURI === fallback.id) : undefined;
    for (const step of plan.steps.slice(from)) {
      if (cancelled.current) break;
      setNowPlaying(step.index);
      setSpoken(null);

      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(step.text);
        const match = step.voice ? available.find((voice) => voice.voiceURI === step.voice?.voiceId) : undefined;
        const voice = match ?? daniel;
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        }
        utterance.rate = rate * (step.voice?.rate ?? 1);
        // **The word being read is lit** (from Ken: *it needs to highlight as
        // it's reading so you can follow along and find your errors*).
        utterance.onboundary = (event) => {
          if (event.name && event.name !== 'word') return;
          const fromAt = event.charIndex;
          const length = event.charLength || (step.text.slice(fromAt).match(/^\S+/)?.[0].length ?? 0);
          setSpoken({ index: step.index, from: fromAt, to: fromAt + length });
        };
        utterance.onend = () => resolve();
        // An error must not stall the queue — the next line still gets read.
        utterance.onerror = () => resolve();
        synthesis.speak(utterance);
      });
    }

    if (!cancelled.current) {
      setPlaying(false);
      setNowPlaying(null);
      setSpoken(null);
    }
  }, [plan, rate, fallback]);

  const seconds = estimatedSpokenSeconds(plan);
  const unit = currentUnitId ? findUnit(file, currentUnitId) : null;
  const supported = typeof window !== 'undefined' && Boolean(window.speechSynthesis);

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

      {!supported ? (
        <p className="notice">This build has no speech synthesis available, so read-back is switched off.</p>
      ) : null}

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

      <div className="panel-header">
        <h3>Voices</h3>
        <button
          type="button"
          className="ghost"
          disabled={voices.length === 0}
          onClick={() =>
            onUpdate((current) => {
              const suggestions = suggestVoiceAssignments(current, voices);
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
