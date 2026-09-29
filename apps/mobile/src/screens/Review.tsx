import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  captureKeyName,
  captureVocabulary,
  mayStillEdit,
  type CaptureItem,
  type ProjectFormat,
} from '@vcwriter/domain';
import { correctNote, forgetNote, listNotes } from '../host/api';
import { pendingCaptures, flush } from '../host/queue';
import { colour, styles } from '../theme';

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
  const [draft, setDraft] = useState('');

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
                    value={draft}
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
                <Text style={styles.text}>{note.rawText}</Text>
              )}

              {!open ? (
                changeable ? (
                  <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
                    <Pressable
                      onPress={() => {
                        setDraft(note.rawText);
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
                  <Text style={styles.muted}>Filed in VC Writer. Change it there.</Text>
                )
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
