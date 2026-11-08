import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  assignCharacterVoice,
  describeVoice,
  estimatedSpokenSeconds,
  findUnit,
  playbackPlan,
  isProseFormat,
  NATURAL_PROVIDER,
  naturalVoiceDescriptors,
  preferredDefaultVoice,
  sortVoices,
  suggestVoiceAssignments,
  toAssignment,
  workingCast,
  type ProjectFile,
  type StructuralUnitId,
  type VoiceDescriptor,
  wordAtFraction,
} from '@vcwriter/domain';
import { NaturalPlayer, useNaturalVoices } from '../natural-voices';

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
  const [systemVoices, setSystemVoices] = useState<VoiceDescriptor[]>([]);
  /** Natural voices (addendum 45), once the writer has downloaded them. */
  const natural = useNaturalVoices();
  const player = useRef<NaturalPlayer | null>(null);
  /**
   * **The natural voices, and only them, once they are here** (from Ken:
   * *it says all the Google voices … let's add in the voices that we're
   * using now from that new company, since the Google voices sound
   * terrible*). The computer's own voices are one tick away for anyone who
   * wants them, and a voice already given to someone stays in their list.
   */
  const [showSystem, setShowSystem] = useState(() => {
    try {
      return window.localStorage.getItem('vcw-readback-system-voices') === '1';
    } catch {
      return false;
    }
  });
  const voices = useMemo(() => {
    if (!natural.installed) return sortVoices(systemVoices);
    const assigned = new Set(
      [file.settings.narratorVoice?.voiceId, ...file.characters.map((character) => character.voice?.voiceId)].filter(Boolean),
    );
    const system = showSystem ? systemVoices : systemVoices.filter((voice) => assigned.has(voice.id));
    return sortVoices([...naturalVoiceDescriptors(), ...system]);
  }, [natural.installed, systemVoices, showSystem, file.settings.narratorVoice, file.characters]);
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
      setSystemVoices(
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
    const synthesis = window.speechSynthesis;
    if (plan.steps.length === 0 || (!synthesis && !natural.installed)) return;

    synthesis?.cancel();
    player.current?.stop();
    cancelled.current = false;
    setPlaying(true);

    const available = synthesis?.getVoices() ?? [];
    const daniel = fallback && fallback.providerId !== NATURAL_PROVIDER ? available.find((voice) => voice.voiceURI === fallback.id) : undefined;
    /**
     * The natural voice a step is read in, if it is one: its own where it has
     * a natural voice, or the default where it has none and the default is
     * natural. A natural voice on a computer without them falls to the system.
     */
    const naturalFor = (step: (typeof plan.steps)[number]): string | null => {
      if (!natural.installed) return null;
      if (step.voice) return step.voice.providerId === NATURAL_PROVIDER ? step.voice.voiceId : null;
      return fallback?.providerId === NATURAL_PROVIDER ? fallback.id : null;
    };
    const speedFor = (step: (typeof plan.steps)[number]) => rate * (step.voice?.rate ?? 1);
    player.current ??= new NaturalPlayer();
    const steps = plan.steps.slice(from);

    for (const [position, step] of steps.entries()) {
      if (cancelled.current) break;
      setNowPlaying(step.index);
      setSpoken(null);

      const voiceId = naturalFor(step);
      // The next natural line is generated while this one is heard.
      const next = steps[position + 1];
      const nextVoice = next ? naturalFor(next) : null;
      if (next && nextVoice) void player.current.prepare(next.text, nextVoice, speedFor(next)).catch(() => undefined);

      if (voiceId) {
        try {
          await player.current.play(step.text, voiceId, speedFor(step), (fraction) => {
            const word = wordAtFraction(step.text, fraction);
            if (word) setSpoken({ index: step.index, ...word });
          });
          continue;
        } catch {
          // A line the natural voice could not make is read by the system voice instead.
        }
      }
      if (!synthesis) continue;

      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(step.text);
        const match =
          step.voice && step.voice.providerId !== NATURAL_PROVIDER
            ? available.find((voice) => voice.voiceURI === step.voice?.voiceId)
            : undefined;
        const voice = match ?? daniel;
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        }
        utterance.rate = speedFor(step);
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
  }, [plan, rate, fallback, natural.installed]);

  const seconds = estimatedSpokenSeconds(plan);
  const unit = currentUnitId ? findUnit(file, currentUnitId) : null;
  const supported = (typeof window !== 'undefined' && Boolean(window.speechSynthesis)) || natural.installed;

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

      {natural.available ? (
        <div className="natural-voices">
          {natural.installed ? (
            <p>
              <strong>Natural voices are installed.</strong>{' '}
              <span className="muted">
                Fourteen voices that sound like people, on this computer. They work offline and nothing you write is
                sent anywhere.
              </span>{' '}
              <button type="button" className="ghost small" onClick={() => void natural.remove()}>
                Remove
              </button>
              <label className="natural-voices-system">
                <input
                  type="checkbox"
                  checked={showSystem}
                  onChange={(event) => {
                    setShowSystem(event.target.checked);
                    try {
                      window.localStorage.setItem('vcw-readback-system-voices', event.target.checked ? '1' : '0');
                    } catch {
                      // A browser that keeps nothing still shows them for this visit.
                    }
                  }}
                />{' '}
                Also list this computer’s own voices
              </label>
            </p>
          ) : natural.progress !== null ? (
            <p>
              Downloading natural voices… {Math.round(natural.progress * 100)}%
              <progress value={natural.progress} max={1} aria-label="Download progress" />
            </p>
          ) : (
            <p>
              <strong>Want voices that sound like people?</strong>{' '}
              <span className="muted">
                Download the natural voices once (about 100 MB, free). They run on this computer, work offline, and
                nothing you write is sent anywhere.
              </span>{' '}
              <button type="button" className="primary small" onClick={() => void natural.install()}>
                Get natural voices
              </button>
            </p>
          )}
          {natural.error ? <p className="notice">{natural.error}</p> : null}
        </div>
      ) : (
        <p className="natural-voices muted small">
          Natural voices that sound like people come with the VC Writer desktop app: download them once from this
          panel there. Here in the browser, read back uses the browser’s own voices.
        </p>
      )}

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
