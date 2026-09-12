// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  addBeat,
  addUnit,
  createProjectFile,
  originNow,
  projectFileSchema,
  ROOM_COLOURS,
  seatSchema,
  type ProjectFile,
  type Seat,
} from '@vcwriter/domain';
import { RoomProvider, useRoom } from '../room';
import { RoomBar } from '../components/RoomBar';
import { ContributorMark } from '../components/ContributorMark';
import { useMark } from '../room';

/**
 * Colour end to end (addendum 07 §6).
 *
 * What is worth testing here is not that a badge renders. It is the three
 * rules that are easy to break later: a colour is **read through the seat** so
 * recolouring a writer recolours their pages; picking a contributor **marks**
 * their work rather than hiding everyone else's; and **the master is clean
 * while a contribution is signed** — clean reading takes every colour off.
 */

afterEach(cleanup);

const AT = '2026-09-11T00:00:00.000Z';

const seat = (over: Partial<Seat>): Seat =>
  seatSchema.parse({ id: 's', roomId: 'r', email: '', invitedAt: AT, createdAt: AT, updatedAt: AT, ...over });

const JO = seat({ id: 's1', userId: 'jo', displayName: 'Jo Calder', title: 'Staff Writer', colour: ROOM_COLOURS[1] });
const MARA = seat({ id: 's2', userId: 'mara', displayName: 'Mara Okonjo', colour: ROOM_COLOURS[2] });

/** A scene by Jo and a beat by Mara. */
const script = (): ProjectFile => {
  const empty = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  const bare: ProjectFile = { ...empty, units: [], beats: [] };
  const scene = addUnit(bare, { laneId: bare.lanes[0]!.id, title: 'INT. WAREHOUSE - NIGHT' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'Mara enters' });

  return projectFileSchema.parse({
    ...beat.file,
    units: beat.file.units.map((unit) => ({ ...unit, origin: originNow('jo', AT) })),
    beats: beat.file.beats.map((one) => ({ ...one, origin: originNow('mara', AT) })),
  });
};

const inARoom = (over: Partial<{ showing: 'master' | 'contribution'; seats: Seat[] }> = {}): void => {
  (window as unknown as { vcwriter: unknown }).vcwriter = {
    roomIdentity: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        roomId: 'r',
        roomName: 'Blackout',
        role: 'writer',
        you: JO,
        seats: over.seats ?? [JO, MARA],
        showing: over.showing ?? 'contribution',
      },
    }),
  };
};

/** Every record's mark, as the interface would draw it. */
function Marks({ file }: { file: ProjectFile }) {
  const mark = useMark();
  return (
    <ul>
      {[...file.units, ...file.beats].map((record) => (
        <li key={record.id}>
          <ContributorMark who={mark(record.origin)} />
        </li>
      ))}
    </ul>
  );
}

function Stamp() {
  const { stamp } = useRoom();
  return <p data-testid="stamp">{stamp ? `${stamp.initials} ${stamp.colour}` : 'none'}</p>;
}

const show = (file: ProjectFile) =>
  render(
    <RoomProvider>
      <RoomBar file={file} />
      <Marks file={file} />
      <Stamp />
    </RoomProvider>,
  );

describe('whose work this is', () => {
  it('says whose draft the window holds, and offers only the people in it', async () => {
    inARoom();
    show(script());

    expect(await screen.findByText('Jo Calder’s draft')).toBeTruthy();
    expect(screen.getByText('Staff Writer')).toBeTruthy();
    // Both wrote something; a third seat with nothing in the script would not
    // be offered, because the question is whose work is in here.
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['JC', 'MO']);
  });

  it('reads the colour through the seat rather than off the record', async () => {
    inARoom({ seats: [{ ...JO, colour: '#123456' }, MARA] });
    show(script());

    const marks = await screen.findAllByTitle(/Jo Calder/);
    expect(marks.some((mark) => (mark as HTMLElement).style.getPropertyValue('--room-colour') === '#123456')).toBe(true);
  });

  it('marks one contributor without taking anybody else’s work away', async () => {
    inARoom();
    show(script());

    const rows = () => document.querySelectorAll('li');
    await waitFor(() => expect(document.querySelectorAll('.contributor-mark').length).toBe(2));

    fireEvent.click(screen.getByRole('button', { name: 'MO' }));
    // One mark left, and both records still on the page.
    expect(document.querySelectorAll('.contributor-mark').length).toBe(1);
    expect(rows().length).toBe(2);

    // The same press again is how the writer stops picking somebody out.
    fireEvent.click(screen.getByRole('button', { name: 'MO' }));
    expect(document.querySelectorAll('.contributor-mark').length).toBe(2);
  });

  it('takes every colour off in clean reading, and the stamp with it', async () => {
    inARoom();
    show(script());

    expect(await screen.findByTestId('stamp')).toHaveProperty('textContent', `JC ${ROOM_COLOURS[1]}`);

    fireEvent.click(screen.getByLabelText('Clean reading'));
    expect(document.querySelectorAll('.contributor-mark').length).toBe(0);
    expect(screen.getByTestId('stamp').textContent).toBe('none');
  });

  it('never signs the master, whatever the window is showing', async () => {
    inARoom({ showing: 'master' });
    show(script());

    expect(await screen.findByText('The master')).toBeTruthy();
    expect(document.querySelectorAll('.contributor-mark').length).toBe(0);
    expect(screen.getByTestId('stamp').textContent).toBe('none');
  });

  it('says nothing at all outside a room — a script with one author', async () => {
    (window as unknown as { vcwriter: unknown }).vcwriter = {};
    show(script());

    await waitFor(() => expect(screen.getByTestId('stamp').textContent).toBe('none'));
    expect(document.querySelector('.room-bar')).toBeNull();
    expect(document.querySelectorAll('.contributor-mark').length).toBe(0);
  });
});
