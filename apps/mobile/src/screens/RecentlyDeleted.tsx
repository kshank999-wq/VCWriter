import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { listDeleted, removeDeleted, restoreDeleted, type DeletedNote } from '../host/api';
import { styles } from '../theme';

/**
 * Recently deleted notes (addendum 27 §34).
 *
 * A deleted note is kept here for 30 days, whether it was deleted on this
 * phone, at the desk or on the website, and can be put back exactly as it was.
 * After 30 days it is gone for good; *Delete now* and *Empty* do that sooner.
 */
export function RecentlyDeleted({ onBack }: { onBack(): void }) {
  const [notes, setNotes] = useState<DeletedNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const load = useCallback(async () => {
    const answer = await listDeleted();
    if (answer.ok) {
      setNotes(answer.data);
      setError(null);
    } else setError(answer.error);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const restore = async (ids: string[]) => {
    setWorking(true);
    const answer = await restoreDeleted(ids);
    setWorking(false);
    if (!answer.ok) {
      setError(answer.error);
      return;
    }
    setSaid(answer.data.restored === 1 ? 'Restored.' : `${answer.data.restored} notes restored.`);
    void load();
  };

  const remove = (ids: string[] | 'all') => {
    Alert.alert(
      ids === 'all' ? 'Empty Recently deleted?' : 'Delete this note now?',
      'It cannot be restored after this.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: ids === 'all' ? 'Empty' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            const answer = await removeDeleted(ids);
            setWorking(false);
            if (!answer.ok) setError(answer.error);
            void load();
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <Text style={styles.heading}>Recently deleted</Text>
      <Text style={styles.muted}>Deleted notes stay here for 30 days. Restore puts a note back where it was.</Text>
      {said ? <Text style={styles.text}>{said}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notes === null ? <Text style={styles.muted}>Loading…</Text> : null}
      {notes && notes.length === 0 ? <Text style={styles.muted}>Nothing here.</Text> : null}

      {(notes ?? []).map((note) => (
        <View key={note.id} style={styles.field}>
          <Text style={styles.text} numberOfLines={4}>
            {note.text || '(no text)'}
          </Text>
          <Text style={styles.muted}>
            {note.filedInto ? `${note.filedInto} · ` : ''}
            {note.daysLeft === 1 ? '1 day left' : `${note.daysLeft} days left`}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={[styles.button, { flex: 1 }]} disabled={working} onPress={() => void restore([note.id])}>
              <Text style={styles.buttonText}>Restore</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.secondary, { flex: 1 }]} disabled={working} onPress={() => remove([note.id])}>
              <Text style={[styles.buttonText, styles.secondaryText]}>Delete now</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {notes && notes.length > 1 ? (
        <>
          <Pressable style={styles.button} disabled={working} onPress={() => void restore(notes.map((one) => one.id))}>
            <Text style={styles.buttonText}>Restore all</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.danger]} disabled={working} onPress={() => remove('all')}>
            <Text style={[styles.buttonText, styles.dangerText]}>Empty Recently deleted</Text>
          </Pressable>
        </>
      ) : null}

      <Pressable style={[styles.button, styles.secondary]} onPress={onBack}>
        <Text style={[styles.buttonText, styles.secondaryText]}>Back to account</Text>
      </Pressable>
    </ScrollView>
  );
}
