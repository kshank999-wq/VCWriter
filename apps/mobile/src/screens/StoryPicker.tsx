import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { addStory, listStories, type StoryChoice } from '../host/api';
import { colour, styles } from '../theme';

/**
 * **Which story of a collection a note goes into** (addendum 27 §23, from Ken:
 * *when you're on the note screen, there'll be a dropdown that allows you to
 * pick the short story that it's going to go into*, and *you can add to that
 * list*).
 *
 * A closed row naming the story; pressed, the collection's stories in order,
 * and a box at the foot that adds one at the end — on the desk too, the way
 * *+ New story* does there. The list is the server's, read when the screen
 * opens, so a story added at the desk is here next time.
 */
export function StoryPicker({
  projectId,
  storyId,
  onChoose,
}: {
  projectId: string;
  storyId: string | null;
  onChoose(story: StoryChoice | null): void;
}) {
  const [stories, setStories] = useState<StoryChoice[]>([]);
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState('');
  const [nameDrawn, setNameDrawn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void listStories(projectId).then((said) => {
      if (!live) return;
      if (!said.ok) {
        setError(said.error);
        return;
      }
      setStories(said.data);
      // Nothing chosen yet, or a story since removed at the desk: the first.
      if (!said.data.some((one) => one.id === storyId)) onChoose(said.data[0] ?? null);
    });
    return () => {
      live = false;
    };
    // The list is read once per project; the choice is the screen's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const add = async () => {
    const title = naming.trim();
    if (title.length === 0 || busy) return;
    setBusy(true);
    const said = await addStory(projectId, title);
    setBusy(false);
    if (!said.ok) {
      setError(said.error);
      return;
    }
    setError(null);
    setStories(said.data);
    setNaming('');
    setNameDrawn((n) => n + 1);
    // The story just named is the one the next note is for.
    onChoose(said.data[said.data.length - 1] ?? null);
    setOpen(false);
  };

  const current = stories.find((one) => one.id === storyId) ?? null;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Story</Text>
      <Pressable
        style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
        onPress={() => setOpen((now) => !now)}
        accessibilityRole="button"
        accessibilityLabel={`Story: ${current?.title ?? 'none chosen'}`}
        accessibilityState={{ expanded: open }}
      >
        <Text style={[styles.text, current ? null : { color: colour.muted }]} numberOfLines={1}>
          {current?.title ?? (stories.length ? 'Choose a story' : 'No stories yet — add one')}
        </Text>
        <Text style={{ color: colour.gold, fontSize: 14 }}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      {open ? (
        <View style={{ gap: 6 }}>
          {stories.map((one, index) => (
            <Pressable
              key={one.id}
              onPress={() => {
                onChoose(one);
                setOpen(false);
              }}
              style={[styles.row, one.id === storyId ? styles.chosen : null, { paddingVertical: 10 }]}
              accessibilityRole="button"
              accessibilityState={{ selected: one.id === storyId }}
            >
              <Text style={styles.text}>
                {index + 1}. {one.title || 'Untitled story'}
              </Text>
            </Pressable>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput
              key={`new-story-${nameDrawn}`}
              style={[styles.input, { flex: 1 }]}
              // The keyboard's dictation writes here too (§21).
              defaultValue=""
              onChangeText={setNaming}
              placeholder="A new story's name"
              placeholderTextColor={colour.muted}
              autoCapitalize="words"
              onSubmitEditing={() => void add()}
            />
            <Pressable style={[styles.button, styles.secondary, { paddingHorizontal: 14 }]} onPress={() => void add()} disabled={busy}>
              <Text style={[styles.buttonText, styles.secondaryText]}>{busy ? 'Adding…' : '+ Add'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
