import { formatName, type ProjectFormat } from '@vcwriter/domain';

/**
 * **Which module you are in, said in the middle** (addendum 35 §2, from Ken:
 * *whenever you enter a module, whether it be screenwriting, episodic, short
 * form, in the center, I want it to be titled, and it'll say novel, short
 * story collection, etc., just so you know what module you're in*).
 *
 * Nothing said it. The title bar carried the format in the **hover on the
 * project's name**, in the schema's own spelling (`short story`,
 * `instructional`), and the rooms said nothing at all — so the one fact that
 * decides what every noun on the screen means was the one fact no screen
 * printed.
 *
 * **It is in every room as well as on the title bar**, which is addendum 29
 * §2's finding read forwards: a room covers the menu bar, so a name that
 * stood only up there would be invisible from exactly the places a writer
 * goes to do the work.
 *
 * It is **absolutely centred rather than laid between the controls**, because
 * a bar's two sides are different widths in every room and a flex child
 * between them lands wherever those widths leave it — which is not the middle,
 * and would move as a count or a title changed beside it. It takes no pointer
 * events, so it is a label on the bar rather than something standing in front
 * of a control, and it truncates rather than pushing anything aside.
 */
export function RoomFormat({ format }: { format: ProjectFormat }) {
  return <span className="room-format">{formatName(format)}</span>;
}
