import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  OWN_CATEGORY_MAX,
  addOwnCategory,
  canRemoveNoteCategory,
  categoryChoices,
  removeNoteCategory,
  restoreBuiltInCategories,
  type CategoryChoices,
  type ProjectFormat,
} from '@vcwriter/domain';
import { colour, styles } from '../theme';

/**
 * The gear beside the categories (addendum 27 §35, from Ken: *a little gear
 * wheel that allows you to create and delete your own categories*).
 *
 * One list, the project's: the format's own categories and the writer's,
 * each with a way off it — **Delete** for one the writer made, **Hide** for
 * one of the format's, which *Put back the standard ones* undoes. The last one
 * standing cannot be taken off, so a note always has somewhere to go. Notes
 * already filed under a category keep it whatever happens here.
 */
export function CategoryEditor({
  visible,
  format,
  choices,
  onChange,
  onClose,
}: {
  visible: boolean;
  format: ProjectFormat;
  choices: CategoryChoices;
  onChange(next: CategoryChoices): void;
  onClose(): void;
}) {
  const [typed, setTyped] = useState('');
  const list = categoryChoices(format, choices);
  const removable = canRemoveNoteCategory(format, choices);

  const add = () => {
    const next = addOwnCategory(format, choices, typed);
    if (next !== choices) onChange(next);
    setTyped('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ maxHeight: '85%', backgroundColor: colour.ink, borderTopWidth: 1, borderColor: colour.gold }}>
          <View style={[styles.bar, { paddingHorizontal: 20, paddingVertical: 14 }]}>
            <Text style={[styles.heading, { fontSize: 16 }]}>Categories</Text>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10}>
              <Text style={{ color: colour.gold, fontSize: 15 }}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={[styles.body, { paddingTop: 0 }]} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.input, { flex: 1, paddingVertical: 10 }]}
                value={typed}
                onChangeText={setTyped}
                onSubmitEditing={add}
                placeholder="New category — Mara, Act Two, Locations…"
                placeholderTextColor={colour.muted}
                maxLength={OWN_CATEGORY_MAX}
                returnKeyType="done"
                accessibilityLabel="Name of a new category"
              />
              <Pressable
                onPress={add}
                disabled={typed.trim().length === 0}
                accessibilityRole="button"
                style={[styles.button, { paddingVertical: 10 }, typed.trim().length === 0 ? { opacity: 0.5 } : null]}
              >
                <Text style={styles.buttonText}>Add</Text>
              </Pressable>
            </View>

            <View style={{ gap: 6 }}>
              {list.map((one) => (
                <View key={one.key} style={[styles.row, { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }]}>
                  <Text style={[styles.text, { flex: 1 }]} numberOfLines={1}>
                    {one.name}
                    {one.own ? '' : '  '}
                    {one.own ? null : <Text style={styles.muted}>standard</Text>}
                  </Text>
                  {removable ? (
                    <Pressable
                      onPress={() => onChange(removeNoteCategory(format, choices, one.key))}
                      accessibilityRole="button"
                      accessibilityLabel={`${one.own ? 'Delete' : 'Hide'} ${one.name}`}
                      hitSlop={8}
                      style={[styles.button, styles.secondary, { paddingVertical: 5, paddingHorizontal: 10 }]}
                    >
                      <Text style={[styles.buttonText, styles.secondaryText, { fontSize: 11 }]}>{one.own ? 'Delete' : 'Hide'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>

            {!removable ? <Text style={styles.muted}>One category has to stay, so a note always has somewhere to go.</Text> : null}
            {choices.hidden.length > 0 ? (
              <Pressable onPress={() => onChange(restoreBuiltInCategories(choices))} accessibilityRole="button" style={styles.linkTap}>
                <Text style={styles.link}>Put back the standard ones</Text>
              </Pressable>
            ) : null}
            <Text style={styles.muted}>
              These are for this project, on this phone. Notes you have already saved keep their category, even if you delete it here.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
