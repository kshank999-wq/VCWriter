import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { startDictation, systemDictationKey, type DictationSession } from '../dictation';

/**
 * **Dictate and read aloud** in a document (addendum 42 §15).
 *
 * Dictation is the program's own (`dictation.ts`, spec §9): what is heard is
 * typed at the cursor, a sentence at a time, and where this build has no speech
 * service the writer is told which keys start the operating system's
 * dictation, which types into the page as it does into any field.
 *
 * Reading aloud is the operating system's voices, as the Script's read-back
 * is: from the selection, or from the cursor to the end, one paragraph at a
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
  const synthesis = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  const [reading, setReading] = useState(false);
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState<string>('');
  const cancelled = useRef(false);

  useEffect(() => {
    if (!synthesis) return;
    const load = () =>
      setVoices(
        synthesis
          .getVoices()
          .map((voice) => ({ id: voice.voiceURI, name: `${voice.name} (${voice.lang})` }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    load();
    synthesis.addEventListener?.('voiceschanged', load);
    return () => synthesis.removeEventListener?.('voiceschanged', load);
  }, [synthesis]);

  const stopReading = useCallback(() => {
    cancelled.current = true;
    synthesis?.cancel();
    setReading(false);
  }, [synthesis]);

  const read = useCallback(async () => {
    if (!editor) return;
    if (reading) {
      stopReading();
      return;
    }
    if (!synthesis) {
      onSay('This computer has no voices to read with.');
      return;
    }
    const paragraphs = paragraphsToRead(editor);
    if (paragraphs.length === 0) {
      onSay('Nothing to read from here. Put the cursor where reading should start.');
      return;
    }
    cancelled.current = false;
    setReading(true);
    const voice = synthesis.getVoices().find((one) => one.voiceURI === voiceId);
    for (const paragraph of paragraphs) {
      if (cancelled.current) break;
      editor.chain().setTextSelection({ from: paragraph.from, to: paragraph.to }).scrollIntoView().run();
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(paragraph.text);
        if (voice) utterance.voice = voice;
        utterance.rate = rate;
        utterance.onend = () => resolve();
        // An error must not stall the reading: the next paragraph is still read.
        utterance.onerror = () => resolve();
        synthesis.speak(utterance);
      });
    }
    setReading(false);
  }, [editor, reading, synthesis, voiceId, rate, onSay, stopReading]);

  // Never leave a voice talking, or a microphone open, after the document closes.
  useEffect(
    () => () => {
      cancelled.current = true;
      synthesis?.cancel();
      session.current?.stop();
    },
    [synthesis],
  );

  return {
    dictating,
    heard,
    dictate,
    reading,
    read,
    canRead: Boolean(synthesis),
    rate,
    setRate,
    voices,
    voiceId,
    setVoiceId,
  };
}

export type DocumentSpeech = ReturnType<typeof useDocumentSpeech>;
