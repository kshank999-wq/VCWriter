import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { NOTES_PROMISE, type NotesPlanKind } from '@vcwriter/domain';
import { buy, pricesFor, restore, type Priced } from '../host/purchase';
import { notesStanding, site } from '../host/api';
import { styles } from '../theme';

/**
 * Subscribing, in the app (addendum 27 §14.6).
 *
 * Notes is $49.99 a year or $4.99 a month, bought **here** rather than on a
 * website: both shops require a subscription used in an app to be sold by their
 * own billing, so there is no link out to a card form anywhere in this
 * application and there must not be.
 *
 * Three decisions carry the screen.
 *
 * **The price on it is the shop's.** `pricesFor` reads what StoreKit or Play
 * Billing says this reader will be charged in their own currency; a plan the shop
 * has never heard of is absent rather than offered at the website's figure,
 * because a button naming a price the till will not charge is worse than one plan
 * where there should be two.
 *
 * **The promise comes before the price.** What a writer wants to know before
 * paying for a notebook is what happens to the notebook if they stop paying, so
 * `NOTES_PROMISE` is on the screen rather than in a help page — and it is the
 * domain's one copy of it, said the same here, at the desk, and in every refusal.
 *
 * **Restore is a first-class button.** A reinstall, a new phone and a
 * family-shared subscription all arrive needing it, and an app that sells a
 * subscription and cannot hand one back is one Apple rejects.
 *
 * **And the two documents are on this screen rather than in the account.**
 * Apple's guideline 3.1.2 asks a purchase screen to carry the terms and the
 * privacy policy, and it asks for the right thing: this is where the agreement
 * is made, and a term somebody meets after paying is one they did not agree
 * to. They are **links rather than text repeated here**, which is `Account`'s
 * own reason — a second copy would be the older one, and nothing on the screen
 * would say which — and they open in the phone's own browser, so a reader who
 * stops to read one comes back to an app that never went anywhere.
 */

const NAMES: Record<NotesPlanKind, string> = { yearly: 'A year', monthly: 'A month' };
const NOTE: Record<NotesPlanKind, string> = {
  yearly: 'Renews once a year. The better part of four months free against the monthly price.',
  monthly: 'Renews every month. Cancel whenever you like, in your store account.',
};

export function Subscribe({ onBack, onSubscribed }: { onBack(): void; onSubscribed(): void }) {
  const [prices, setPrices] = useState<Priced[] | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [working, setWorking] = useState<NotesPlanKind | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const found = await pricesFor().catch(() => [] as Priced[]);
      if (!alive) return;
      setPrices(found);
      // Said rather than left blank: a shop that cannot be reached is not the
      // same as a subscription that cannot be had, and the difference is the
      // whole of whether somebody tries again.
      if (found.length === 0) {
        setError('The store could not be reached just now, so there is nothing to show. Try again in a moment.');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const settle = useCallback(
    async (answer: Awaited<ReturnType<typeof restore>>) => {
      if (answer.ok) {
        setSaid(answer.said);
        setError(null);
        // Ask the server what it now thinks, rather than believing this screen:
        // one answer about who is subscribed, and it is not the client's.
        const standing = await notesStanding();
        if (standing.ok && standing.data.mayCapture) onSubscribed();
        return;
      }
      // A dismissed sheet is not a failure and is never reported as one.
      setError('cancelled' in answer ? null : answer.error);
    },
    [onSubscribed],
  );

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.bar}>
        <Pressable onPress={onBack} style={[styles.button, styles.secondary]}>
          <Text style={[styles.buttonText, styles.secondaryText]}>Back</Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>Notes</Text>
      <Text style={styles.text}>
        A voice notebook for the walk, the train and the queue. Say a thought and what kind of thought it is, and
        find it waiting at your desk — divided, attributed and ready to file.
      </Text>
      <Text style={styles.muted}>{NOTES_PROMISE}</Text>

      {said ? <Text style={styles.text}>{said}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {prices === null ? <Text style={styles.muted}>Asking the store…</Text> : null}

      {(prices ?? []).map((one) => (
        <View key={one.sku} style={styles.row}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.title}>
              {NAMES[one.plan]}
              {one.price ? ` · ${one.price}` : ''}
            </Text>
            <Text style={styles.muted}>{NOTE[one.plan]}</Text>
          </View>
          <Pressable
            style={styles.button}
            disabled={working !== null}
            onPress={() => {
              setWorking(one.plan);
              void buy(one)
                .then(settle)
                .finally(() => setWorking(null));
            }}
          >
            <Text style={styles.buttonText}>{working === one.plan ? 'Working…' : 'Subscribe'}</Text>
          </Pressable>
        </View>
      ))}

      <Pressable
        style={[styles.button, styles.secondary]}
        disabled={working !== null}
        onPress={() => {
          setWorking('restore');
          void restore()
            .then(settle)
            .finally(() => setWorking(null));
        }}
      >
        <Text style={[styles.buttonText, styles.secondaryText]}>
          {working === 'restore' ? 'Asking the store…' : 'Restore a subscription'}
        </Text>
      </Pressable>

      <Text style={styles.muted}>
        Bought and managed in your store account, where it is also cancelled. A subscription renews itself at the
        end of each period unless it is cancelled at least a day before. VC Writer for Windows and macOS is a
        separate purchase and works without this.
      </Text>

      <View style={styles.linkRow}>
        <Pressable
          accessibilityRole="link"
          style={styles.linkTap}
          onPress={() => void Linking.openURL(`${site()}/terms`)}
        >
          <Text style={styles.link}>Terms of Use</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          style={styles.linkTap}
          onPress={() => void Linking.openURL(`${site()}/privacy`)}
        >
          <Text style={styles.link}>Privacy Policy</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
