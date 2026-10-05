import { StyleSheet } from 'react-native';

/**
 * The brand, on a phone (docs/brand.md).
 *
 * **The same values the website declares**, because an app in a different gold
 * is a different product to anybody who uses both. They are copied rather than
 * imported for the plain reason that a stylesheet is not a module — and copied
 * *here only*, so there is one place to correct rather than one per screen.
 *
 * One scheme: the brand is dark, on every surface it has.
 */
export const colour = {
  ink: '#070604',
  raised: '#100e09',
  raised2: '#181509',
  border: '#3a3018',
  gold: '#c9a45c',
  goldBright: '#e8c872',
  goldDeep: '#8a6f2f',
  text: '#f1e7cf',
  muted: '#a3946f',
  /** Listening, and only listening: red is what the eye finds without reading. */
  live: '#c4432f',
  /** The website's own `--red`, for the one control that cannot be undone. */
  red: '#8b1c1c',
} as const;

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colour.ink },
  body: { padding: 20, gap: 16 },

  heading: {
    color: colour.gold,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: { color: colour.text, fontSize: 17, fontWeight: '600' },
  text: { color: colour.text, fontSize: 16, lineHeight: 22 },
  muted: { color: colour.muted, fontSize: 13, lineHeight: 18 },
  error: { color: '#e6795f', fontSize: 14, lineHeight: 19 },

  field: { gap: 6 },
  label: { color: colour.muted, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: colour.border,
    backgroundColor: colour.raised,
    color: colour.text,
    fontSize: 16,
    paddingHorizontal: 14,
    // A thumb's worth: 44pt is the floor Apple asks for and the floor a walk
    // needs anyway.
    paddingVertical: 13,
  },

  button: {
    backgroundColor: colour.gold,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  buttonText: {
    color: colour.ink,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colour.border,
  },
  secondaryText: { color: colour.gold },

  danger: { backgroundColor: colour.red, borderWidth: 1, borderColor: colour.red },
  dangerText: { color: colour.goldBright },

  row: {
    borderWidth: 1,
    borderColor: colour.border,
    backgroundColor: colour.raised,
    padding: 14,
    gap: 3,
  },
  chosen: { borderColor: colour.gold },

  /**
   * A link out to the website, and the thumb's worth of room round it.
   *
   * It is **a link rather than a button** because what it does is leave: the
   * two on the purchase screen are documents to read, and drawing them as
   * acts beside *Subscribe* would make three things that look alike where one
   * of them takes somebody's money. The tap target is its own box, a 13pt
   * word being well under the 44pt floor a phone needs — and under a walking
   * thumb most of all.
   */
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20 },
  linkTap: { paddingVertical: 11 },
  link: { color: colour.gold, fontSize: 13, lineHeight: 18, textDecorationLine: 'underline' },

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colour.border,
  },
});
