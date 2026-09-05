import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  assignCharacterVoice,
  describeVoice,
  estimatedSpokenSeconds,
  findUnit,
  playbackPlan,
  sortVoices,
  suggestVoiceAssignments,
  toAssignment,
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
  const cancelled = useRef(false);

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
  }, []);

  // Never leave a voice talking to an empty room.
  useEffect(() => stop, [stop]);

  const play = useCallback(async () => {
    const synthesis = window.speechSynthesis;
    if (!synthesis || plan.steps.length === 0) return;

    cancelled.current = false;
    setPlaying(true);

    const available = synthesis.getVoices();
    for (const step of plan.steps) {
      if (cancelled.current) break;
      setNowPlaying(step.index);

      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(step.text);
        const match = step.voice ? available.find((voice) => voice.voiceURI === step.voice?.voiceId) : undefined;
        if (match) utterance.voice = match;
        utterance.rate = rate * (step.voice?.rate ?? 1);
        utterance.onend = () => resolve();
        // An error must not stall the queue — the next line still gets read.
        utterance.onerror = () => resolve();
        synthesis.speak(utterance);
      });
    }

    setPlaying(false);
    setNowPlaying(null);
  }, [plan, rate]);

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
          <button type="button" className="primary" disabled={!supported || playing} onClick={() => void play()}>
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
            <option value="">Default voice</option>
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
                {voice.accent ? ` · ${voice.accent}` : ''}
                {voice.gender !== 'unknown' ? ` · ${voice.gender}` : ''}
              </option>
            ))}
          </select>
        </li>

        {file.characters
          .filter((character) => !character.archived)
          .map((character) => (
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
                <option value="">No voice — read as narration</option>
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

      {file.characters.length === 0 ? (
        <p className="muted empty">Add characters to the project to give them voices.</p>
      ) : null}
    </div>
  );
}
