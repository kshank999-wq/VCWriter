import { useMemo, useState } from 'react';
import {
  ARC_POINT_NAMES,
  WORK_STANDING_WORDS,
  arcContinuity,
  arcKindsPresent,
  castNeverSpoken,
  cuesWithoutCharacter,
  describeRow,
  tracksInOrder,
  reviewRows,
  scriptPresence,
  unitsInStoryOrder,
  unusedCharacterMaterial,
  type ArcPointKind,
  type CharacterId,
  type CharacterTraitId,
  type TrackId,
  type ProjectFile,
  type ReviewRow,
  type StructuralUnitId,
  type UsageColour,
  type WorkStanding,
} from '@vcwriter/domain';

/**
 * Search, filters and the three review modes (addendum 08 §18, stage 10).
 *
 * **One screen rather than five.** §18 asks for a search, seven filters, a
 * character review in story order, a report of what is still on deck, and an arc
 * continuity check — which is one question asked three ways: *choose some of
 * this character work, and read it in the order the story tells it*. The filters
 * belong to all three modes, so they sit above all three.
 *
 * **Nothing here judges.** Every row is a fact about the manuscript, and the two
 * continuity notes are checkable rather than opinions: a cause written after its
 * effect either is or is not, and *this character is thin* is not something
 * software gets to say (§7).
 *
 * **In the script** (stage 13) is the fourth reading, and the one that works
 * before anybody has written anything down: who is in the manuscript, in how
 * many scenes, how often they speak, and the longest stretch they are away.
 * Counted every time, never stored — so it is first, because on most projects
 * it is the only one with anything in it.
 */

interface CharacterReviewProps {
  file: ProjectFile;
  onOpenCreator(characterId: CharacterId): void;
}

type Mode = 'script' | 'story' | 'deck' | 'continuity';

const DOT_CLASS: Record<UsageColour, string> = {
  green: 'is-in',
  red: 'is-deck',
  grey: 'is-aside',
};

const STANDINGS: ReadonlyArray<WorkStanding> = ['in_the_writing', 'on_deck', 'set_aside'];

export function CharacterReview({ file, onOpenCreator }: CharacterReviewProps) {
  // Opens on the script, which is the reading that has something in it before
  // anybody has written a trait down — and on most projects that is all of them.
  const [mode, setMode] = useState<Mode>('script');
  const [query, setQuery] = useState('');
  const [characterId, setCharacterId] = useState<CharacterId | ''>('');
  const [traitId, setTraitId] = useState<CharacterTraitId | ''>('');
  const [standing, setStanding] = useState<WorkStanding | ''>('');
  const [arcKind, setArcKind] = useState<ArcPointKind | ''>('');
  const [unitId, setUnitId] = useState<StructuralUnitId | ''>('');
  const [trackId, setTrackId] = useState<TrackId | ''>('');
  const [relatedTo, setRelatedTo] = useState<CharacterId | ''>('');

  const cast = file.characters.filter((person) => !person.archived);
  const traits = file.characterTraits.filter(
    (trait) =>
      !trait.archived &&
      (characterId === '' || (trait.characterId as string) === (characterId as string)),
  );
  const kinds = useMemo(() => arcKindsPresent(file), [file]);

  const filter = useMemo(
    () => ({
      query,
      ...(characterId === '' ? {} : { characterId }),
      ...(traitId === '' ? {} : { traitId }),
      ...(standing === '' ? {} : { standing }),
      ...(arcKind === '' ? {} : { arcKind }),
      ...(unitId === '' ? {} : { unitId }),
      ...(trackId === '' ? {} : { trackId }),
      ...(relatedTo === '' ? {} : { relatedTo }),
    }),
    [query, characterId, traitId, standing, arcKind, unitId, trackId, relatedTo],
  );

  const rows = useMemo(() => reviewRows(file, filter), [file, filter]);
  const presence = useMemo(() => scriptPresence(file, filter), [file, filter]);
  const unknownCues = useMemo(() => cuesWithoutCharacter(file), [file]);
  const silent = useMemo(
    () =>
      castNeverSpoken(file).map(
        (id) => file.characters.find((one) => (one.id as string) === (id as string))!,
      ),
    [file],
  );
  const report = useMemo(() => unusedCharacterMaterial(file, filter), [file, filter]);
  const continuity = useMemo(
    () => arcContinuity(file, characterId === '' ? null : characterId),
    [file, characterId],
  );

  const row = (entry: ReviewRow) => (
    <li key={`${entry.work.kind}:${entry.work.id}`} className="review-row">
      <i className={`creator-dot ${DOT_CLASS[entry.colour]}`} title={WORK_STANDING_WORDS[entry.standing]} />
      <button
        type="button"
        className="review-who"
        title={`Open ${entry.work.characterName}`}
        onClick={() => onOpenCreator(entry.work.characterId)}
      >
        {entry.work.characterName}
      </button>
      <span className="review-what">{describeRow(entry)}</span>
      <span className="review-where muted small">
        {entry.unitTitle ? `${entry.unitTitle}${entry.beatTitle ? ` · ${entry.beatTitle}` : ''}` : '—'}
      </span>
    </li>
  );

  return (
    <div className="review">
      <header className="review-bar">
        <input
          className="review-search"
          type="search"
          aria-label="Search character work"
          placeholder="Search what they do, their traits, their names"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <select
          aria-label="Character"
          value={characterId as string}
          onChange={(event) => {
            setCharacterId(event.target.value as CharacterId);
            // A trait belongs to one person, so a chosen one cannot survive
            // changing who is being looked at.
            setTraitId('');
          }}
        >
          <option value="">Everybody</option>
          {cast.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Trait"
          value={traitId as string}
          onChange={(event) => setTraitId(event.target.value as CharacterTraitId)}
        >
          <option value="">Any trait</option>
          {traits.map((trait) => (
            <option key={trait.id} value={trait.id}>
              {trait.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Standing"
          value={standing}
          onChange={(event) => setStanding(event.target.value as WorkStanding | '')}
        >
          <option value="">Anywhere</option>
          {STANDINGS.map((one) => (
            <option key={one} value={one}>
              {WORK_STANDING_WORDS[one]}
            </option>
          ))}
        </select>

        {kinds.length > 0 ? (
          <select
            aria-label="Arc stage"
            value={arcKind}
            onChange={(event) => setArcKind(event.target.value as ArcPointKind | '')}
          >
            <option value="">Any arc stage</option>
            {kinds.map((one) => (
              <option key={one} value={one}>
                {ARC_POINT_NAMES[one]}
              </option>
            ))}
          </select>
        ) : null}

        <select
          aria-label="Scene"
          value={unitId as string}
          onChange={(event) => setUnitId(event.target.value as StructuralUnitId)}
        >
          <option value="">Any scene</option>
          {unitsInStoryOrder(file).map((unit) => (
            <option key={unit.id} value={unit.id}>
              {`${unit.sequenceLabel} ${unit.title || 'Untitled'}`.trim()}
            </option>
          ))}
        </select>

        <select
          aria-label="Plot"
          value={trackId as string}
          onChange={(event) => setTrackId(event.target.value as TrackId)}
        >
          <option value="">Any plot</option>
          {tracksInOrder(file).map((track) => (
            <option key={track.id} value={track.id}>
              {track.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Related to"
          value={relatedTo as string}
          onChange={(event) => setRelatedTo(event.target.value as CharacterId)}
        >
          <option value="">Anyone’s people</option>
          {cast.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}’s people
            </option>
          ))}
        </select>
      </header>

      <nav className="review-modes" aria-label="Review">
        {(
          [
            ['script', 'In the script'],
            ['story', 'In story order'],
            ['deck', 'Still on deck'],
            ['continuity', 'Arc continuity'],
          ] as ReadonlyArray<[Mode, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={mode === key ? 'creator-tab selected' : 'creator-tab'}
            aria-current={mode === key ? 'page' : undefined}
            onClick={() => setMode(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="review-body">
        {mode === 'script' ? (
          <ScriptPresence
            presence={presence}
            unknownCues={unknownCues}
            silent={silent}
            onOpenCreator={onOpenCreator}
          />
        ) : mode === 'story' ? (
          rows.length === 0 ? (
            <p className="muted empty-state">Nothing matches that.</p>
          ) : (
            <ul className="review-list">{rows.map(row)}</ul>
          )
        ) : mode === 'deck' ? (
          report.length === 0 ? (
            <p className="muted empty-state">Everything planned is in the writing.</p>
          ) : (
            report.map((group) => (
              <section key={group.characterId} className="review-group">
                <h4>
                  {group.characterName}
                  <span className="count muted">{group.rows.length}</span>
                </h4>
                <ul className="review-list">{group.rows.map(row)}</ul>
              </section>
            ))
          )
        ) : (
          <>
            {/* Facts, in the order the manuscript tells them — and the notes
                above, where they will be read before the list. */}
            {continuity.notes.length === 0 ? (
              <p className="muted small review-note-none">Nothing obviously out of order.</p>
            ) : (
              <ul className="review-notes">
                {continuity.notes.map((note, index) => (
                  <li key={`${note.kind}:${index}`}>
                    <span className="review-note-kind muted">
                      {note.kind === 'cause_after_effect' ? 'Order' : 'Arc'}
                    </span>
                    {note.text}
                  </li>
                ))}
              </ul>
            )}

            {continuity.inOrder.length === 0 ? (
              <p className="muted empty-state">No arc points yet.</p>
            ) : (
              <ul className="review-list">{continuity.inOrder.map(row)}</ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Who is in the manuscript, read off the cues (addendum 08 §18, stage 13).
 *
 * **Counted, never stored**, like the colour and like the map's lines: cut a
 * scene and the numbers move with nothing running.
 *
 * The line it holds is the module's standing one. *Fourteen speeches across
 * nine scenes* is a fact, and *absent for eleven scenes* is a fact. Whether
 * either is a problem is the writer's to say, so there is no warning colour
 * anywhere here and nothing is called a gap that is really just somebody
 * arriving late.
 */
function ScriptPresence({
  presence,
  unknownCues,
  silent,
  onOpenCreator,
}: {
  presence: ReturnType<typeof scriptPresence>;
  unknownCues: ReturnType<typeof cuesWithoutCharacter>;
  silent: ProjectFile['characters'];
  onOpenCreator(characterId: CharacterId): void;
}) {
  if (presence.length === 0 && unknownCues.length === 0 && silent.length === 0) {
    return <p className="muted empty-state">Nobody speaks in the script yet.</p>;
  }

  return (
    <>
      {presence.length === 0 ? null : (
        <ul className="review-list presence-list">
          {presence.map((row) => (
            <li key={row.characterId} className="presence-row">
              <button
                type="button"
                className="review-who"
                title={`Open ${row.characterName}`}
                onClick={() => onOpenCreator(row.characterId)}
              >
                {row.characterName}
              </button>
              <span className="presence-counts muted small">
                {row.scenes === 1 ? '1 scene' : `${row.scenes} scenes`} ·{' '}
                {row.speeches === 1 ? '1 speech' : `${row.speeches} speeches`}
              </span>
              <span className="presence-span muted small">
                {row.appearances[0]!.unitTitle}
                {row.appearances.length > 1 ? ` → ${row.appearances.at(-1)!.unitTitle}` : ''}
              </span>
              {/* Said as the two scenes it sits between, so it can be checked
                  rather than taken on trust. */}
              {row.gap ? (
                <span className="presence-gap muted small">
                  away for {row.gap.scenes === 1 ? '1 scene' : `${row.gap.scenes} scenes`} after{' '}
                  {row.gap.after.unitTitle}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {/* Both of these are ordinary rather than wrong — somebody typed straight
          into the script and never filed, a background character with no
          lines — so they are stated and not flagged. */}
      {unknownCues.length === 0 ? null : (
        <section className="review-group">
          <h4>
            Speaking, but not in the cast
            <span className="count muted">{unknownCues.length}</span>
          </h4>
          <ul className="review-list">
            {unknownCues.map((one) => (
              <li key={one.cue} className="presence-row">
                <span className="review-who as-text">{one.cue}</span>
                <span className="presence-counts muted small">
                  {one.speeches === 1 ? '1 speech' : `${one.speeches} speeches`}
                </span>
                <span className="presence-span muted small">from {one.firstUnitTitle}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {silent.length === 0 ? null : (
        <section className="review-group">
          <h4>
            In the cast, not yet speaking
            <span className="count muted">{silent.length}</span>
          </h4>
          <ul className="review-list">
            {silent.map((person) => (
              <li key={person.id} className="presence-row">
                <button
                  type="button"
                  className="review-who"
                  title={`Open ${person.name}`}
                  onClick={() => onOpenCreator(person.id)}
                >
                  {person.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
