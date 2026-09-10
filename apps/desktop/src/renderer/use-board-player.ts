import { useCallback, useEffect, useRef, useState } from 'react';
import { shotAt, type BoardPlayback, type BoardShot } from '@vcwriter/domain';

/**
 * Playing the board (addendum 05 §5).
 *
 * An animatic: the board's own clock runs, the frames change at the durations
 * the sheet says, and each shot's audio is read aloud in the voices already
 * assigned. Nothing is rendered — this is a way of *hearing* whether a thirty
 * is a thirty.
 *
 * **The clock is the sheet's, not the speech synthesiser's.** A voice reads a
 * line in however long it takes; the board holds the shot for as long as the
 * writer said. Where the read over-runs it is cut off by the next shot, which
 * is exactly what happens in an edit suite and exactly the thing a writer
 * needs to be told. Timing the board to the voice instead would hide the one
 * fact playback exists to reveal.
 */

export interface BoardPlayer {
  playing: boolean;
  /** Where the playhead is, in seconds on the board's clock. */
  elapsed: number;
  /** What is on screen now. */
  shot: BoardShot | null;
  play(from?: number): void;
  stop(): void;
  supported: boolean;
}

export const useBoardPlayer = (playback: BoardPlayback): BoardPlayer => {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const frame = useRef<number | null>(null);
  const startedAt = useRef(0);
  const from = useRef(0);
  /** Which shots have already been read, so a line is not said twice. */
  const said = useRef(new Set<string>());
  /** The board as it was when Play was pressed: editing mid-play must not lurch. */
  const board = useRef(playback);

  const supported = typeof window !== 'undefined' && Boolean(window.speechSynthesis);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // A synthesiser that will not stop is not a reason to leave the UI stuck.
    }
    setPlaying(false);
    setElapsed(0);
  }, []);

  // Never leave a voice talking to an empty room.
  useEffect(() => stop, [stop]);

  const speak = useCallback((shot: BoardShot) => {
    const synthesis = window.speechSynthesis;
    if (!synthesis) return;
    const available = synthesis.getVoices();

    for (const line of shot.lines) {
      const utterance = new SpeechSynthesisUtterance(line.text);
      const match = line.voice ? available.find((voice) => voice.voiceURI === line.voice?.voiceId) : undefined;
      if (match) utterance.voice = match;
      utterance.rate = line.voice?.rate ?? 1;
      synthesis.speak(utterance);
    }
  }, []);

  const play = useCallback(
    (at = 0) => {
      if (playback.shots.length === 0) return;
      board.current = playback;
      said.current = new Set();
      from.current = at;
      startedAt.current = performance.now();
      setPlaying(true);
      setElapsed(at);

      try {
        window.speechSynthesis?.cancel();
      } catch {
        // As above: an unwilling synthesiser plays silently rather than not at all.
      }

      const tick = () => {
        const now = from.current + (performance.now() - startedAt.current) / 1000;

        // The board is over: stop rather than run a clock past the end of it.
        if (now >= board.current.seconds) {
          stop();
          return;
        }
        setElapsed(now);

        // A shot's line begins after its header's action, not at the cut.
        const here = shotAt(board.current, now);
        if (here && now >= here.saidAt && !said.current.has(here.beatId as string)) {
          said.current.add(here.beatId as string);
          // The previous shot's read is over the moment this one speaks.
          try {
            window.speechSynthesis?.cancel();
          } catch {
            /* see above */
          }
          speak(here);
        }

        frame.current = requestAnimationFrame(tick);
      };

      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(tick);
    },
    [playback, speak, stop],
  );

  return {
    playing,
    elapsed,
    shot: playing ? shotAt(board.current, elapsed) : null,
    play,
    stop,
    supported,
  };
};
