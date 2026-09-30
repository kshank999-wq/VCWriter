import { Platform } from 'react-native';
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
} from 'expo-iap';
import { NOTES_PRODUCTS, type NotesPlanKind } from '@vcwriter/domain';
import { recordPurchase } from './api';

/**
 * Buying the subscription, on the shop this phone belongs to (addendum 27 §14.6).
 *
 * **The store talks to the shop and the server decides what it bought.** This
 * file asks StoreKit or Play Billing for the products, puts the sheet up, and
 * hands whatever comes back to `/api/notes/purchase` as a bare receipt
 * identifier. It never works out an expiry, never decides the account is
 * entitled, and has no way to say so: the plan comes back from the server or the
 * purchase is not finished. That is the shape being the permission said on the
 * client's side of the same boundary.
 *
 * **A transaction is finished only after the server has written it down.** Both
 * shops replay an unfinished transaction — iOS on every launch, Android for three
 * days and then refunds it — which is exactly the behaviour wanted here: if the
 * verification call never reaches vc-writer.com, the purchase comes back next
 * time the app opens and is recorded then. Finishing first and failing to record
 * would take somebody's money and leave them unsubscribed.
 *
 * **Restoring is the same act.** `restore` asks the shop what this account
 * already holds and sends it, which is what a reinstall needs and what Apple
 * requires a subscription app to offer.
 */

export type Priced = {
  plan: NotesPlanKind;
  sku: string;
  /** What the shop says it costs, in the reader's own currency. */
  price: string;
  /** Android's offer token, which a subscription purchase must name. */
  offerToken: string | null;
};

export type Bought =
  | { ok: true; said: string }
  | { ok: false; error: string }
  /** The sheet was dismissed. Not a failure, and never said as one. */
  | { ok: false; cancelled: true; error: string };

let connected = false;

/** Opened once and left open: both shops expect a long-lived connection. */
const connect = async (): Promise<void> => {
  if (connected) return;
  await initConnection();
  connected = true;
};

export const closeStore = async (): Promise<void> => {
  if (!connected) return;
  connected = false;
  await endConnection().catch(() => undefined);
};

/**
 * The receipt identifier the server asks the shop about.
 *
 * Apple answers questions about a subscription by its **original** transaction
 * id — the one the first purchase in the chain had — so a renewal or an upgrade
 * still resolves to the same subscription. Google answers by the purchase token.
 * One field at the route, because the shops' names differ and the thing does not.
 */
const receiptOf = (purchase: Purchase): string | null => {
  const loose = purchase as unknown as {
    originalTransactionIdentifierIOS?: string | null;
    purchaseToken?: string | null;
    id?: string | null;
  };
  if (Platform.OS === 'ios') {
    return loose.originalTransactionIdentifierIOS ?? loose.id ?? null;
  }
  return loose.purchaseToken ?? null;
};

const store = (): 'app_store' | 'play_store' => (Platform.OS === 'ios' ? 'app_store' : 'play_store');

/**
 * Send a purchase to the server, and finish it only if that worked.
 *
 * The order is the decision: recorded, then finished.
 */
const settle = async (purchase: Purchase): Promise<Bought> => {
  const receiptId = receiptOf(purchase);
  if (!receiptId) {
    return { ok: false, error: 'The store did not say what was bought. Try Restore in a moment.' };
  }

  const said = await recordPurchase({ store: store(), receiptId });
  if (!said.ok) return { ok: false, error: said.error };

  await finishTransaction({ purchase, isConsumable: false }).catch(() => undefined);
  return { ok: true, said: said.data.said };
};

/**
 * What the two plans cost here.
 *
 * **The shop's own price, not the website's.** `NOTES_PRICE_WORDS` is the
 * advertised figure for a page that cannot ask; this is what this reader will
 * actually be charged in their own currency, which is both truer and what both
 * shops require an app to show.
 */
export const pricesFor = async (): Promise<Priced[]> => {
  await connect();
  const skus = [NOTES_PRODUCTS.yearly, NOTES_PRODUCTS.monthly];
  const products = (await fetchProducts({ skus, type: 'subs' })) as unknown as {
    id?: string;
    displayPrice?: string;
    subscriptionOfferDetailsAndroid?: { offerToken?: string }[];
  }[];

  const priced: Priced[] = [];
  for (const plan of ['yearly', 'monthly'] as NotesPlanKind[]) {
    const sku = NOTES_PRODUCTS[plan];
    const found = (products ?? []).find((one) => one.id === sku);
    // A product the shop has never heard of is **absent rather than offered at
    // the website's price**: a button that names a figure the till will not
    // charge is worse than one plan on the screen instead of two.
    if (!found) continue;
    priced.push({
      plan,
      sku,
      price: found.displayPrice ?? '',
      offerToken: found.subscriptionOfferDetailsAndroid?.[0]?.offerToken ?? null,
    });
  }
  return priced;
};

/**
 * Put the sheet up, and settle whatever the shop hands back.
 *
 * Both shops report the outcome through a listener rather than by resolving the
 * call — a purchase can be interrupted, deferred for a parent's approval, or
 * completed while the app is in the background — so the listeners are what this
 * waits on, with the promise's own rejection kept for the store refusing
 * outright.
 */
export const buy = async (chosen: Priced): Promise<Bought> =>
  new Promise<Bought>((settled) => {
    let done = false;
    const finish = (answer: Bought) => {
      if (done) return;
      done = true;
      bought.remove();
      failed.remove();
      settled(answer);
    };

    const bought = purchaseUpdatedListener((purchase) => {
      void settle(purchase).then(finish);
    });
    const failed = purchaseErrorListener((error) => {
      const code = String((error as unknown as { code?: string }).code ?? '');
      if (code.toLowerCase().includes('cancel')) {
        finish({ ok: false, cancelled: true, error: 'Nothing was bought.' });
        return;
      }
      finish({ ok: false, error: error.message || 'The store could not finish that.' });
    });

    void connect()
      .then(() =>
        requestPurchase({
          type: 'subs',
          request: {
            apple: { sku: chosen.sku },
            google: {
              skus: [chosen.sku],
              ...(chosen.offerToken
                ? { subscriptionOffers: [{ sku: chosen.sku, offerToken: chosen.offerToken }] }
                : {}),
            },
          },
        } as never),
      )
      .catch((cause: unknown) => {
        finish({
          ok: false,
          error: cause instanceof Error ? cause.message : 'The store could not be reached.',
        });
      });
  });

/**
 * What this shop account already holds, sent again.
 *
 * Offered on its own button because a reinstall, a new phone and a family-shared
 * subscription all arrive here — and because an app that sells a subscription and
 * cannot hand it back is one the App Store rejects.
 */
export const restore = async (): Promise<Bought> => {
  await connect();
  const held = (await getAvailablePurchases().catch(() => [])) as Purchase[];
  const mine = held.filter((one) => {
    const sku = (one as unknown as { id?: string; productId?: string }).productId ?? '';
    return sku === NOTES_PRODUCTS.yearly || sku === NOTES_PRODUCTS.monthly;
  });
  const chain = mine.length > 0 ? mine : held;

  for (const purchase of chain) {
    const answer = await settle(purchase);
    if (answer.ok) return answer;
  }
  return {
    ok: false,
    error: 'This store account has no Notes subscription on it. If you bought it on another account, sign in to that one on this phone.',
  };
};
