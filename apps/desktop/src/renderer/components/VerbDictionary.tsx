import { useEffect, useState } from 'react';
import { useModal } from '../use-modal';
import { loadVerbs, verbEntry } from '../spelling';

/**
 * **The verb dictionary** (editor spec §4, from Ken, 19 November: *a verb
 * dictionary, so you can right-click on a word and open up a verb dictionary
 * or thesaurus to replace weak verbs*).
 *
 * Opened from a word's right-click menu. Every meaning WordNet gives the verb,
 * each with its **stronger verbs** — the more specific ways of doing it — and
 * the words that mean the same, all already in the tense of the word clicked.
 * A click puts that one word in place of the one clicked; nothing else in the
 * sentence changes (spec §2: word-level aids never assemble a sentence).
 *
 * Mounted once beside the text menu; the menu opens it with the word and how
 * to replace it.
 */

interface Asked {
  word: string;
  replace(text: string): void;
}

let show: ((asked: Asked | null) => void) | null = null;

export const openVerbDictionary = (word: string, replace: (text: string) => void): void => show?.({ word, replace });

export function VerbDictionary() {
  const [asked, setAsked] = useState<Asked | null>(null);
  const [, setLoaded] = useState(0);
  useEffect(() => {
    show = setAsked;
    return () => {
      show = null;
    };
  }, []);
  useEffect(() => {
    if (asked) void loadVerbs().then(() => setLoaded((n) => n + 1)).catch(() => undefined);
  }, [asked]);
  const dialog = useModal(asked !== null);
  const entry = asked ? verbEntry(asked.word) : null;
  const pick = (word: string) => {
    asked?.replace(word);
    setAsked(null);
  };

  return (
    <dialog ref={dialog} className="track-dialog verb-dictionary" aria-label="Verb dictionary" onClose={() => setAsked(null)}>
      {asked ? (
        <>
          <header>
            <h3>
              Verb dictionary <span className="muted">— “{asked.word}”</span>
            </h3>
            <button type="button" className="ghost" aria-label="Close" onClick={() => setAsked(null)}>
              ×
            </button>
          </header>
          <div className="verb-dictionary-body">
            {!entry ? (
              <p className="muted">Reading the dictionary…</p>
            ) : (
              <>
                <p className="muted small">
                  Click a word to put it in place of “{asked.word}”. Only that word changes.
                </p>
                <ol className="verb-senses">
                  {entry.senses.map((sense, index) => (
                    <li key={index}>
                      <p className="verb-meaning">{sense.meaning}</p>
                      {sense.stronger.length > 0 ? (
                        <div className="verb-words">
                          <span className="verb-words-label">Stronger</span>
                          {sense.stronger.map((word) => (
                            <button key={word} type="button" className="chip" onClick={() => pick(word)}>
                              {word}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {sense.synonyms.length > 0 ? (
                        <div className="verb-words">
                          <span className="verb-words-label">Same meaning</span>
                          {sense.synonyms.map((word) => (
                            <button key={word} type="button" className="chip" onClick={() => pick(word)}>
                              {word}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
                <p className="muted small verb-credit">From WordNet, Princeton University.</p>
              </>
            )}
          </div>
        </>
      ) : null}
    </dialog>
  );
}
