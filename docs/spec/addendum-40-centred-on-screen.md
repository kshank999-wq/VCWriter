# Addendum 40: The cue centred on the writing screen

From Ken: *centre the cue on the writing screen next*. Addendum 38 §9 named
this as the last unbuilt part of the stage play module.

## 1. Measured first

Addendum 37 gave `PageLayoutSpec` a `centred` set, and the page, the print,
the PDF and the Word export all honoured it. Two screens did not:

- **The writing screen** (`BeatBody`) set every line flush at its indent.
- **The Preview tab's pages** (`Paper`) drew each line with its padding and
  ignored the `centred` and `width` that `PageLine` has carried since
  addendum 37.

So a play's cue was centred on paper, left-aligned where the writer writes
it, and also left-aligned on the screen titled *Preview*, which is supposed
to show the pages that will print.

## 2. The change

The writing screen gives a centred line the class `centred`, and the field
is centred inside its own indent and width. The box does not move, so the
wrapping and the page breaks drawn on the screen are unchanged. Two cases
are left alone:

- A dual-dialogue column has no centre of its own, so it is not centred.
- A writer's own paragraph alignment (`own-align`) wins over the layout's.

The Preview tab sets a centred line in its own width with `text-align:
center`, as the print stylesheet does.

Both screens read the same set as everything else, so a cue centred by
Customise (addendum 39) is centred on screen, and a cue uncentred there is
flush left again. A screenplay's cue is at its fixed column, as before.

## 3. Driven

In the browser preview, on *The Lamp* (US musical), SCENE ONE, every cue and
the number's title are centred on the writing screen and on the Preview
tab's page. The speech, the lyrics and the directions sit at their own
indents.
