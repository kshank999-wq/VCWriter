import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import {
  ADD_ON_QUESTION,
  addOnAnswer,
  captureKeyName,
  mayStillEdit,
  sayBack,
  type CaptureItem,
  type ProjectFormat,
} from '@vcwriter/domain';
import { correctNote } from '../host/api';
import { mayHear, readyToSpeak, startDictation, type DictationSession } from '../host/listen';
import { hush, readAloud } from '../host/say';
import { colour, styles } from '../theme';

/**
 * **One note, full screen** (addendum 27 §30, from Ken: *in the review
 * section, you can select a note and it brings it up full screen. And you can
 * then add to the note or read it back. Or actually read it back, and then
 * it'll ask you, would you like to add on to this note? And it'll add, continue
 * on where you were at*).
 *
 * *Read it back* reads the note, then asks the question out loud and listens:
 * yes, and what is said next goes on the end; no, and it stops; anything else
 * is taken as the writer already adding. *Add to it* skips the question.
 * Nothing is written to the account until **Save**. A note the desk has filed
 * is the trail behind work in a project (`mayStillEdit`), so it is read back
 * and not added to.
 */
type Mode = 'idle' | 'reading' | 'asking' | 'adding';

const join = (words: string, more: string): string => {
  const said = more.trim();
  if (!said) return words;
  return words.trim().length > 0 ? `${words.trimEnd()} ${said}` : said;
};

export function NoteView({
  note,
  format,
  onBack,
  onSaved,
}: {
  note: CaptureItem;
  format: ProjectFormat;
  onBack(): void;
  onSaved(): void;
}) {
  const editable = mayStillEdit(note.status);
  const [words, setWords] = useState(note.rawText);
  const wordsRef = useRef(note.rawText);
  const [interim, setInterim] = useState('');
  const [mode, setMode] = useState<Mode>('idle');
  const modeRef = useRef<Mode>('idle');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const session = useRef<DictationSession | null>(null);

  const changed = words !== note.rawText;
  const go = (next: Mode) => {
    modeRef.current = next;
    setMode(next);
  };
  const add = (more: string) => {
    wordsRef.current = join(wordsRef.current, more);
    setWords(wordsRef.current);
  };

  const stopListening = async () => {
    const was = session.current;
    session.current = null;
    if (was) await was.stop();
    setInterim('');
  };

  useEffect(
    () => () => {
      void session.current?.stop();
      hush();
    },
    [],
  );

  /** Listen, either for the answer to the question or for more of the note. */
  const listen = async (first: 'asking' | 'adding') => {
    if (!(await mayHear())) {
      setStatus('VC Writer Notes needs the microphone and speech to hear you.');
      go('idle');
      return;
    }
    go(first);
    session.current = startDictation(
      {
        onFinal: (chunk) => {
          setInterim('');
          if (modeRef.current === 'asking') {
            const answer = addOnAnswer(chunk);
            if (answer === 'no') {
              go('idle');
              void stopListening();
              return;
            }
            go('adding');
            // A yes is the go-ahead and nothing more; anything else is already the note.
            if (answer === 'yes') return;
          }
          if (modeRef.current === 'adding') add(chunk);
        },
        onInterim: setInterim,
        onError: (message) => {
          setStatus(message);
          go('idle');
        },
        onEnd: () => {
          setInterim('');
          session.current = null;
          go('idle');
        },
      },
      { commitAfterMs: 1500 },
    );
  };

  const readBack = async () => {
    await stopListening();
    hush();
    go('reading');
    readyToSpeak();
    const heard = sayBack({ category: note.category, subjectName: note.subjectName, text: wordsRef.current }, format);
    readAloud(heard, setStatus, () => {
      if (modeRef.current !== 'reading') return;
      if (!editable) {
        go('idle');
        return;
      }
      readAloud(ADD_ON_QUESTION, setStatus, () => {
        if (modeRef.current !== 'reading') return;
        // A beat after the question, so the phone does not hear itself.
        setTimeout(() => void listen('asking'), 350);
      });
    });
  };

  const toggleAdding = async () => {
    if (mode === 'adding' || mode === 'asking') {
      await stopListening();
      go('idle');
      return;
    }
    hush();
    await listen('adding');
  };

  const save = async () => {
    await stopListening();
    go('idle');
    if (!changed || saving) return;
    setSaving(true);
    const said = await correctNote(note.id as string, { rawText: wordsRef.current });
    setSaving(false);
    if (!said.ok) {
      setStatus(said.error);
      return;
    }
    onSaved();
  };

  const back = () => {
    void stopListening();
    hush();
    if (!changed) {
      onBack();
      return;
    }
    Alert.alert('Save what you added?', 'The words you added to this note are not saved yet.', [
      { text: 'Discard', style: 'destructive', onPress: onBack },
      { text: 'Save', onPress: () => void save() },
    ]);
  };

  const prompt =
    mode === 'reading'
      ? '◆ Reading it back…'
      : mode === 'asking'
        ? `● ${ADD_ON_QUESTION} Say yes or no.`
        : mode === 'adding'
          ? '● Listening — what you say goes on the end.'
          : null;

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <Pressable onPress={back} accessibilityRole="button">
          <Text style={{ color: colour.gold, fontSize: 15 }}>‹ Review</Text>
        </Pressable>
        <Text style={styles.muted}>{captureKeyName(note.category ?? 'idea', format)}</Text>
        {editable && changed ? (
          <Pressable onPress={() => void save()} disabled={saving} accessibilityRole="button">
            <Text style={{ color: colour.gold, fontSize: 15 }}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        ) : (
          <Text style={{ width: 40 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 24 }]}>
        {note.subjectName ? <Text style={[styles.heading, { fontSize: 24 }]}>{note.subjectName}</Text> : null}
        <Text style={[styles.text, { fontSize: 19, lineHeight: 28 }]}>
          {words}
          {interim && mode === 'adding' ? <Text style={{ color: colour.muted }}> {interim}</Text> : null}
        </Text>
        {!editable ? (
          <Text style={styles.muted}>
            {note.status === 'approved' ? '✓ Transferred to VC Writer — it is read here, and changed there.' : 'Set aside in VC Writer.'}
          </Text>
        ) : null}
      </ScrollView>

      <View style={{ padding: 16, gap: 10, borderTopWidth: 1, borderColor: colour.border }}>
        {prompt ? <Text style={[styles.muted, { color: mode === 'reading' ? colour.gold : colour.live }]}>{prompt}</Text> : null}
        {status ? <Text style={styles.muted}>{status}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            style={[styles.button, styles.secondary, { flex: 1 }]}
            onPress={() =>
              mode === 'reading'
                ? (hush(), go('idle'))
                : void readBack()
            }
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>{mode === 'reading' ? '■ Stop' : '🔊 Read it back'}</Text>
          </Pressable>
          {editable ? (
            <Pressable
              style={[styles.button, styles.secondary, { flex: 1 }, mode === 'adding' || mode === 'asking' ? { borderColor: colour.live } : null]}
              onPress={() => void toggleAdding()}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'adding' }}
            >
              <Text style={[styles.buttonText, styles.secondaryText, mode === 'adding' || mode === 'asking' ? { color: colour.live } : null]}>
                {mode === 'adding' || mode === 'asking' ? '■ Stop' : '🎙 Add to it'}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {editable && changed ? (
          <Pressable style={styles.button} onPress={() => void save()} disabled={saving} accessibilityRole="button">
            <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
