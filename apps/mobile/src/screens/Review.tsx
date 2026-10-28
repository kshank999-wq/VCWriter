import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  captureKeyName,
  captureVocabulary,
  mayStillEdit,
  type CaptureItem,
  type ProjectFormat,
} from '@vcwriter/domain';
import { clearNotes, correctNote, forgetNote, listNotes } from '../host/api';
import { pendingCaptures, flush } from '../host/queue';
import { colour, styles } from '../theme';
import { NoteView } from './NoteView';

/**
 * What the phone caught (addendum 27 §8).
 *
 * Addendum 09 §7's list and its restraint: the notes for this project, read,
 * corrected and thrown away — **only while one is still waiting**. Once the
 * desktop has filed a note it is the trail behind a real research item, so
 * `mayStillEdit` decides in the domain, the route gives a person a sentence,
 * and row-level security refuses underneath both.
 *
 * **What is still on this phone is shown as such**, which the website's Review
 * does not do and this one must: a walk out of signal ends with notes the
 * server has never heard of, and a screen that listed only what the server
 * knows would be the §13 bug with a different cause — a writer looking at an
 * empty list holding a phone with their morning on it.
 */
export function Review({
  projectId,
  format,
  onBack,
}: {
  projectId: string;
  format: ProjectFormat;
  onBack(): void;
}) {
  const [notes, setNotes] = useState<CaptureItem[]>([]);
  const [waiting, setWaiting] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [only, setOnly] = useState<string>('all');
  const [editing, setEditing] = useState<string | null>(null);
  /** The note open full screen (addendum 27 §30), or null for the list. */
  const [viewing, setViewing] = useState<CaptureItem | null>(null);
  const [draft, setDraft] = useState('');
  /** What the edit box starts with, set once when it opens (addendum 27 §26). */
  const [seed, setSeed] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    // Anything still on the device goes first, so the list that comes back is
    // the whole morning rather than the part that had signal.
    await flush();
    setWaiting((await pendingCaptures()).length);
    const said = await listNotes(projectId);
    setLoading(false);
    if (!said.ok) {
      setError(said.error);
      return;
    }
    setError(null);
    setNotes(said.data);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = only === 'all' ? notes : notes.filter((note) => note.category === only);

  /**
   * One chip per category standing in these notes, in this project's order and
   * anything it does not know after — `inboxGroups`' own rule, so a chip is
   * never offered over nothing and a note is never without one.
   */
  const known = captureVocabulary(format).map((one) => one.key as string);
  const here = [...new Set(notes.map((note) => note.category).filter((one): one is string => !!one))];
  const chips = [...known.filter((one) => here.includes(one)), ...here.filter((one) => !known.includes(one))];

  const correct = async (note: CaptureItem) => {
    const said = await correctNote(note.id as string, { rawText: draft });
    if (!said.ok) {
      setError(said.error);
      return;
    }
    setEditing(null);
    await load();
  };

  /**
   * **The notes the desk has taken** (addendum 27 §25): filed into a project
   * there, so the writer can see they arrived and clear them off the phone.
   */
  const transferred = notes.filter((note) => note.status === 'approved');
  /**
   * **Clear them off the phone** (§29, from Ken: *it should clear all
   * transferred notes. And since they'll be in the archive, there's a
   * backup*): the account keeps them, in the desk's archive; the phone stops
   * listing them.
   */
  const clearTransferred = () => {
    const ids = transferred.map((note) => note.id as string);
    Alert.alert(
      `Clear ${ids.length} transferred note${ids.length === 1 ? '' : 's'}?`,
      'They come off this phone. They stay in the Archive in VC Writer on your desktop, as a backup.',
      [
        { text: 'Keep them', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const said = await clearNotes(ids);
              if (!said.ok) setError(said.error);
              else if (said.data.cleared === 0) setError('Nothing was cleared. Pull to refresh and try again.');
              await load();
            })();
          },
        },
      ],
    );
  };

  const remove = (note: CaptureItem) => {
    Alert.alert('Delete this note?', 'It goes from the phone and from your account.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const said = await forgetNote(note.id as string);
            if (!said.ok) setError(said.error);
            await load();
          })();
        },
      },
    ]);
  };

  if (viewing) {
    return (
      <NoteView
        note={viewing}
        format={format}
        onBack={() => setViewing(null)}
        onSaved={() => {
          setViewing(null);
          void load();
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.bar}>
        <Pressable onPress={onBack}>
          <Text style={{ color: colour.gold, fontSize: 15 }}>‹ Capture</Text>
        </Pressable>
        <Text style={styles.muted}>Review</Text>
        <Pressable onPress={() => void load()}>
          <Text style={{ color: colour.gold, fontSize: 15 }}>Refresh</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {waiting > 0 ? (
          <Text style={styles.muted}>
            {waiting} note{waiting === 1 ? '' : 's'} still on this phone, waiting for signal. Nothing is
            lost — they go as soon as there is any.
          </Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <Text style={styles.muted}>Looking…</Text> : null}

        {transferred.length > 0 ? (
          <View style={[styles.row, { gap: 8 }]}>
            <Text style={styles.text}>
              ✓ {transferred.length} note{transferred.length === 1 ? ' has' : 's have'} been transferred to VC Writer on your desktop.
            </Text>
            <Pressable style={[styles.button, styles.secondary]} onPress={clearTransferred} accessibilityRole="button">
              <Text style={[styles.buttonText, styles.secondaryText]}>Clear transferred notes</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {['all', ...chips].map((one) => (
            <Pressable
              key={one}
              onPress={() => setOnly(one)}
              style={[
                styles.button,
                styles.secondary,
                { paddingVertical: 8, paddingHorizontal: 11 },
                only === one ? { borderColor: colour.gold } : null,
              ]}
            >
              <Text
                style={[
                  styles.buttonText,
                  styles.secondaryText,
                  { fontSize: 11, letterSpacing: 0.4 },
                  only === one ? { color: colour.goldBright } : null,
                ]}
              >
                {one === 'all' ? 'All' : captureKeyName(one, format)}
              </Text>
            </Pressable>
          ))}
        </View>

        {!loading && shown.length === 0 ? (
          <Text style={styles.muted}>Nothing under that yet.</Text>
        ) : null}

        {shown.map((note) => {
          const open = editing === (note.id as string);
          const changeable = mayStillEdit(note.status);
          return (
            <View key={note.id as string} style={styles.row}>
              <Text style={styles.label}>
                {captureKeyName(note.category ?? 'idea', format)}
                {note.subjectName ? ` · ${note.subjectName}` : ''}
                {note.subcategory ? ` · ${note.subcategory}` : ''}
              </Text>

              {open ? (
                <>
                  <TextInput
                    style={[styles.input, { minHeight: 110, textAlignVertical: 'top', paddingTop: 10 }]}
                    // The keyboard's own dictation writes here; handing the
                    // value back doubles it (addendum 27 §21).
                    // Set once when the box opens: a starting text that
                    // followed the typing is handed back like a value (§26).
                    defaultValue={seed}
                    onChangeText={setDraft}
                    multiline
                    autoFocus
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Pressable style={[styles.button, { flex: 1 }]} onPress={() => void correct(note)}>
                      <Text style={styles.buttonText}>Save</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.button, styles.secondary, { flex: 1 }]}
                      onPress={() => setEditing(null)}
                    >
                      <Text style={[styles.buttonText, styles.secondaryText]}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                // A touch opens it full screen, to read back and add to (§30).
                <Pressable onPress={() => setViewing(note)} accessibilityRole="button" accessibilityHint="Opens the note full screen">
                  <Text style={styles.text} numberOfLines={4}>
                    {note.rawText}
                  </Text>
                  <Text style={{ color: colour.gold, fontSize: 13, marginTop: 4 }}>Open ›</Text>
                </Pressable>
              )}

              {!open ? (
                changeable ? (
                  <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
                    <Pressable
                      onPress={() => {
                        setDraft(note.rawText);
                        setSeed(note.rawText);
                        setEditing(note.id as string);
                      }}
                    >
                      <Text style={{ color: colour.gold, fontSize: 14 }}>Correct it</Text>
                    </Pressable>
                    <Pressable onPress={() => remove(note)}>
                      <Text style={{ color: '#e6795f', fontSize: 14 }}>Delete</Text>
                    </Pressable>
                  </View>
                ) : (
                  // Filed at the desk, so it is the trail behind real work now.
                  // Shown and not edited, rather than quietly missing.
                  <Text style={[styles.muted, note.status === 'approved' ? { color: colour.sent } : null]}>
                    {note.status === 'approved' ? '✓ Transferred to VC Writer.' : 'Set aside in VC Writer.'}
                  </Text>
                )
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
