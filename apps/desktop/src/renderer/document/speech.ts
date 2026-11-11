import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { DEFAULT_NATURAL_VOICE, naturalVoiceDescriptors } from '@vcwriter/domain';
import { startDictation, systemDictationKey, type DictationSession } from '../dictation';
import { NaturalPlayer, useNaturalVoices } from '../natural-voices';

/**
 * **Dictate and read aloud** in a document (addendum 42 §15).
 *
 * Dictation is the program's own (`dictation.ts`, spec §9): what is heard is
 * typed at the cursor, a sentence at a time, and where this build has no speech
 * service the writer is told which keys start the operating system's
 * dictation, which types into the page as it does into any field.
 *
 * Reading aloud is in the natural voices, as the Script's read-back is
 * (addendum 45 §8), never the operating system's: from the selection, or from the cursor to the end, one paragraph at a
 * time with the paragraph being read selected, so the writer can follow it
 * and stop where they want to change something.
 */

export interface Voice {
  id: string;
  name: string;
}

interface Paragraph {
  from: number;
  to: number;
  text: string;
}

/** The paragraphs to read: those the selection touches, or from the cursor's to the end. */
const paragraphsToRead = (editor: Editor): Paragraph[] => {
  const { from, to, empty } = editor.state.selection;
  const out: Paragraph[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const end = pos + node.nodeSize;
    const inRange = empty ? end > from : end > from && pos < to;
    if (inRange && node.textContent.trim()) {
      const start = empty || pos + 1 >= from ? pos + 1 : from;
      const stop = empty || end - 1 <= to ? end - 1 : to;
      out.push({ from: start, to: stop, text: editor.state.doc.textBetween(start, stop, ' ', ' ') });
    }
    return false;
  });
  return out;
};

export function useDocumentSpeech(editor: Editor | null, onSay: (message: string) => void) {
  // ------------------------------------------------------------- dictation
  const [dictating, setDictating] = useState(false);
  const [heard, setHeard] = useState('');
  const session = useRef<DictationSession | null>(null);

  const stopDictating = useCallback(() => {
    session.current?.stop();
    session.current = null;
    setDictating(false);
    setHeard('');
  }, []);

  const dictate = useCallback(() => {
    if (!editor) return;
    if (session.current) {
      stopDictating();
      return;
    }
    const started = startDictation({
      onFinal: (text) => {
        const words = text.trim();
        if (!words) return;
        // A space between this and what is already there, unless at a line's start.
        const { $from } = editor.state.selection;
        const before = $from.parent.textBetween(0, $from.parentOffset, ' ', ' ');
        const lead = before && !/\s$/.test(before) ? ' ' : '';
        editor.chain().focus().insertContent(`${lead}${words}`).run();
        setHeard('');
      },
      onInterim: setHeard,
      onError: (why) => {
        onSay(why);
        stopDictating();
      },
      onEnd: () => {
        session.current = null;
        setDictating(false);
        setHeard('');
      },
    });
    if (!started) {
      onSay(`No speech service here. ${systemDictationKey()} and dictate into the page.`);
      return;
    }
    session.current = started;
    setDictating(true);
  }, [editor, onSay, stopDictating]);

  // ------------------------------------------------------------ reading aloud
  const natural = useNaturalVoices();
  const player = useRef<NaturalPlayer | null>(null);
  const [reading, setReading] = useState(false);
  const [rate, setRate] = useState(1);
  const voices: Voice[] = useMemo(
    () => (natural.installed ? naturalVoiceDescriptors().map((voice) => ({ id: voice.id, name: `${voice.name.replace(' (natural)', '')} · ${voice.accent} ${voice.gender}` })) : []),
    [natural.installed],
  );
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_NATURAL_VOICE);
  const cancelled = useRef(false);

  const stopReading = useCallback(() => {
    cancelled.current = true;
    player.current?.stop();
    setReading(false);
  }, []);

  const read = useCallback(async () => {
    if (!editor) return;
    if (reading) {
      stopReading();
      return;
    }
    if (!natural.installed) {
      onSay(natural.available ? 'Get the natural voices first: Get voices, beside Read aloud.' : 'Reading aloud runs in the desktop app.');
      return;
    }
    const paragraphs = paragraphsToRead(editor);
    if (paragraphs.length === 0) {
      onSay('Nothing to read from here. Put the cursor where reading should start.');
      return;
    }
    cancelled.current = false;
    setReading(true);
    player.current ??= new NaturalPlayer();
    for (const [position, paragraph] of paragraphs.entries()) {
      if (cancelled.current) break;
      editor.chain().setTextSelection({ from: paragraph.from, to: paragraph.to }).scrollIntoView().run();
      // The next paragraph is generated while this one is heard.
      const now = player.current.play(paragraph.text, voiceId, rate);
      const next = paragraphs[position + 1];
      if (next) void player.current.prepare(next.text, voiceId, rate).catch(() => undefined);
      try {
        await now;
      } catch {
        // A paragraph the voice could not make must not stall the reading.
      }
    }
    setReading(false);
  }, [editor, reading, natural.installed, natural.available, voiceId, rate, onSay, stopReading]);

  // Never leave a voice talking, or a microphone open, after the document closes.
  useEffect(
    () => () => {
      cancelled.current = true;
      player.current?.stop();
      session.current?.stop();
    },
    [],
  );

  return {
    dictating,
    heard,
    dictate,
    reading,
    read,
    canRead: natural.available,
    voicesInstalled: natural.installed,
    voicesProgress: natural.progress,
    getVoices: natural.install,
    rate,
    setRate,
    voices,
    voiceId,
    setVoiceId,
  };
}

export type DocumentSpeech = ReturnType<typeof useDocumentSpeech>;
