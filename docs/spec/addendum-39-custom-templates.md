# Addendum 39: Custom templates

From Ken, after addendum 38: *build the custom templates next*. This covers
his *Stage Play Formatting Engine* spec §1 (*Save as Custom Template*,
*Restore Defaults*) and §7 (the per-element override inspector), which
addendum 38 §9 left named and unbuilt.

---

## 1. Two records, and where each one lives

**The project's changes** are stored in `settings.formatOverrides`. They
belong to the project, for addendum 37 §5's reason: they change the geometry,
and so the page count, and two people opening one play must see the same
page. A project carries only what the writer changed. Each element's indent,
width, capitals and centring is optional, and a missing value means the
preset's own.

**The library** of saved templates belongs to the writer, on their machine
(the `formatTemplates` preference). A house style built for one theatre is
something to reach for in the next play, and a template kept inside a single
project could not be reached from another. A template is a preset's id, a
name, and the changes made to that preset.

**Applying a template copies it into the project.** The preset is chosen,
the changes are written in, and the name goes with them. Nothing printed
ever depends on the library still holding the template, so removing one
from the library leaves every play set in it exactly as it was.

The bundled presets stay immutable, which is the spec's own §9 test. A
template is never an edited copy of a preset's record.

## 2. One reading

`applyFormatOverrides` is applied inside `layoutForFile`. That function is
already the one chooser the writing screen, the preview, the print, the PDF,
the Word export and the page count all read, so a change shows up in every
one of them at once with nothing else edited. Each override replaces one
field of one element:

- Capitals and centring are added to the element or taken from it.
- An indent and a width are clamped so the element still fits the column.

With no changes, the shared preset object is returned as it is, so a script
nobody has customised keeps the layout it has always had.

A value set back to the preset's is stored as nothing (`withElementOverride`).
Moving a cue back to where the preset had it therefore leaves no override
behind, and the row stops saying it was changed.

## 3. The screen

To open it, go to **File ▸ Page setup**. Under the lit preset, a line says
*Exactly as bundled* or *Set as Lyric Theatre submissions*, followed by a
**Customise…** button.

**Customise** shows a table with a row for every element the format writes,
including a play's song title, lyric, music cue and dance. The columns are
indent, width, capitals and centred.

- A changed row is marked, shows the preset's values on hover, and has a ↺
  that puts that row back.
- A sample page beside the table is set from the layout in force.
- A cleared box sends nothing. It is not a request for column 0, and a width
  below one is refused.

Changes apply as they are made and are undone like any other edit, following
Page setup's own rule for the script format beside it. Three further
controls sit under the table:

- **Restore defaults** clears the changes, leaving the preset exactly as
  bundled.
- **Save template** saves under a name and records that name on the
  project. Saving under a name already in the library replaces that
  template and keeps its place in the list.
- **Your templates** lists each saved template with its base preset and how
  many elements it changes. A template made for another kind of script
  cannot be applied: a play's house style on a film page is offered
  nowhere, `scriptFormatsFor`'s rule.

**Choosing another preset keeps the changes over it**, and the Page setup
line says so. Dropping someone's work silently because they clicked a tile
would be the worse fault, and Restore defaults is one button away.

## 4. Driven

In the browser preview, on *The Lamp* (US musical):

1. Customise; turn off the cue's centring and set its indent to 20, then
   set the lyric's indent to 5.
2. Save the template as *Lyric Theatre submissions*.

The rows for the cue and the lyric are marked, and the sample page and the
writing screen behind the dialog both move. Page setup then reads *Set as
Lyric Theatre submissions*. In the tests, a template saved on one play and
applied to a fresh one sets the second play's preset and its changes.
