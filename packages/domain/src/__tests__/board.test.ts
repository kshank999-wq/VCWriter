import { describe, expect, it } from 'vitest';
import {
  addCharacter,
  assignCharacterVoice,
  boardPlayback,
  createProjectFile,
  setRowFrame,
  setRowHead,
  setRowTail,
  shotAt,
  shotStart,
  updateBeat,
  updateUnit,
  type ProjectFile,
} from '../index.js';
import { newId } from '../ids.js';
import type { CharacterId, ManuscriptElementId } from '../ids.js';

/**
 * Playing the board (addendum 05 §5): the durations the sheet holds, laid end
 * to end, with the voices already assigned reading over them.
 */

const line = (text: string, characterId: CharacterId | null = null) => ({
  id: newId<ManuscriptElementId>(),
  type: 'dialogue' as const,
  text,
  characterId,
  attributes: {},
});

/** One segment, one shot: four seconds of line. */
const board = (): ProjectFile => {
  const file = createProjectFile({ title: 'Commercial 1', format: 'short_form' });
  return updateBeat(updateUnit(file, file.units[0]!.id, { title: 'Know your enemy...', summary: '' }), file.beats[0]!.id, {
    manuscript: { elements: [line('"Know your enemy."')] },
    seconds: 4,
  });
};

describe('the board laid end to end', () => {
  it('starts the first shot at nothing and each one after it where the last ended', () => {
    let file = board();
    file = setRowHead(file, file.beats[0]!.id, 2);
    file = setRowTail(file, file.beats[0]!.id, 1);

    const playback = boardPlayback(file);
    const first = playback.shots[0]!;
    expect(first.at).toBe(0);
    // Two of header, four of line, one of tail.
    expect(first.seconds).toBe(7);
    expect(playback.seconds).toBe(7);
  });

  it('starts the reading after the header, not at the cut', () => {
    let file = board();
    file = setRowHead(file, file.beats[0]!.id, 3);
    expect(boardPlayback(file).shots[0]?.saidAt).toBe(3);
  });

  it('reads a line with its quotation marks taken off', () => {
    const playback = boardPlayback(board());
    expect(playback.shots[0]?.lines[0]?.text).toBe('Know your enemy.');
    expect(playback.shots[0]?.lines[0]?.spoken).toBe(true);
  });

  it('gives a line with nobody attached to it the narrator, because a commercial is narration', () => {
    let file = board();
    file = {
      ...file,
      settings: {
        ...file.settings,
        narratorVoice: { providerId: 'system', voiceId: 'v1', displayName: 'Narrator', accent: '', rate: 1, pitch: 0 },
      },
    };
    expect(boardPlayback(file).shots[0]?.lines[0]?.voice?.voiceId).toBe('v1');
  });

  it('reads a character in their own voice, and names a character who has none', () => {
    let file = addCharacter(board(), { name: 'SUN TZU' });
    const tzu = file.characters[file.characters.length - 1]!;
    file = updateBeat(file, file.beats[0]!.id, {
      manuscript: { elements: [line('"Know your enemy."', tzu.id)] },
    });

    // No voice yet: named, and read by the narrator.
    expect(boardPlayback(file).unassigned).toEqual(['SUN TZU']);

    file = assignCharacterVoice(file, tzu.id, {
      providerId: 'system',
      voiceId: 'tzu',
      displayName: 'Deep',
      accent: '',
      rate: 1,
      pitch: 0,
    });
    const playback = boardPlayback(file);
    expect(playback.unassigned).toEqual([]);
    expect(playback.shots[0]?.lines[0]?.voice?.voiceId).toBe('tzu');
    expect(playback.shots[0]?.lines[0]?.speaker).toBe('SUN TZU');
  });

  it('runs a shot to its clip where the clip is the longer of the two', () => {
    const file = board();
    const made = setRowFrame(file, file.beats[0]!.id, {
      data: 'data:video/mp4;base64,AAAA',
      kind: 'video',
      seconds: 11,
    });
    const playback = boardPlayback(made.file);
    expect(playback.shots[0]?.seconds).toBe(11);
    expect(playback.shots[0]?.moving).toBe(true);
    expect(playback.seconds).toBe(11);
  });
});

describe('the playhead', () => {
  it('holds a shot until the next one begins', () => {
    const playback = boardPlayback(board());
    expect(shotAt(playback, 0)?.number).toBe('1.1');
    expect(shotAt(playback, 3.9)?.number).toBe('1.1');
    // Past the end of the board there is no shot, which is what stops it.
    expect(shotAt(playback, 4)).toBeNull();
  });

  it('has nothing before the board starts', () => {
    expect(shotAt(boardPlayback(board()), -1)).toBeNull();
  });

  it('says where a shot starts, for playing from one', () => {
    const playback = boardPlayback(board());
    expect(shotStart(playback, playback.shots[0]!.beatId)).toBe(0);
  });
});
