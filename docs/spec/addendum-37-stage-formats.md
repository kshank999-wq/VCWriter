# Addendum 37 — The six a stage play is set in

From Ken, with his own *VC Writer — Stage Play Formatting Engine* spec
attached (version 1.0, 14 October 2026):

> When you select stage play, you need a dropdown or some type of preference
> that can select the proper formatting for you. So here is a new development
> spec with all the common stage play formatting specifications. Please enter
> it into the preferences section as a drop-down or selectable menu.

---

## 1. Measured first

A **stage play** printed as `SCREENPLAY_LAYOUT` — the cue out at 3.7 inches,
the speech a narrow column down the middle, US Letter. That is a film page.
And *File ▸ Page setup ▸ Script format* offered **US single-camera, US
multi-camera, BBC drama, BBC taped** — four screen house styles and no way to
ask for a stage page at all.

So the complaint is exact: a play was set as a screenplay, and nothing in the
program could say otherwise.

## 2. The audit pays a thirty-third time, and pays nearly all of it

Ken's spec §6 asks for a configuration contract — margins, cue placement and
casing, the dialogue column, the direction indent, heading alignment,
pagination rules. **`PageLayoutSpec` has carried every one of those since the
screen formats were written**, and more besides: `cueBeside` for a cue laid in
the margin beside its speech, `blanksBeforeHeading`, per-element uppercase,
per-element double spacing, dual columns.

Four more things were already standing:

| The spec asks for | What was already here |
| --- | --- |
| A stored format per project | `settings.scriptFormat`, a project setting by its own doc comment |
| One chooser the whole program reads | `layoutFor` / `layoutForFile` — the preview, the print, the PDF and the Final Editor all go through it |
| A selectable menu | *File ▸ Page setup ▸ Script format*, a radio group that draws **a sample page** per option |
| "Format change must never alter dialogue text, cast data or metadata" | True by construction: a layout is read at print time and written into nothing |

What `PageLayoutSpec` did **not** carry is two fields, and both are real:

**`centred`.** The spec says the US cue is *centered*, and a fixed indent is
not centring — it is right for one length of name and wrong for every other,
which on a page of six characters is visible. The block is still set at its
own `indent` and `width`, so the wrapping and the page count are unchanged;
only where the words sit inside it differs.

**`paper`.** `linesPerPage` and `columns` have always carried the geometry
while the print stylesheet carried `@page { size: letter }` whatever the
layout said — so the **BBC layouts, which have claimed A4 in their own prose
since they were written, printed their 58 lines onto US Letter**. A layout
that knows how tall its page is and not what paper it is cut from is half a
layout. That is a pre-existing fault this change fixes along the way.

## 3. The six

`scriptFormatSchema` gains six values, prefixed `stage_` rather than taking
the spec's bare ids — `uk_bbc` beside the screen list's `bbc` would be two
values a reader has to hold apart — with each layout's doc naming the spec's
own id. They are **the same field as the four screen ones and not a second
one**: a script is set in one house style, and the format decides which
houses are on offer.

Geometry is the engine's: twelve-point Courier at ten characters to the inch
and six lines to the inch. **Letter** with the spec's 1.5″ binding edge and 1″
elsewhere is 60 characters and 55 lines; **A4** with its 1″ all round (the
spec's own VC DEFAULT) is 62 characters and 58 lines.

| Preset | Spec id | Paper | Cue | Directions |
| --- | --- | --- | --- | --- |
| US modern play | `us_modern` §4.1 | Letter | centred, own line | col 15 — 3″ from the paper's edge |
| US traditional play | `us_traditional` §4.2 | Letter | centred, own line | their own indented block |
| US publisher reading copy | `us_publisher` §4.3 | Letter | in from the left | set apart, compact |
| UK BBC stage | `uk_bbc` §4.4 | A4 | at the left, **speech on the same line** | **capitals**, shifted right |
| UK contemporary play | `uk_contemporary` §4.5 | A4 | at the left, speech beside it | indented, ordinary case |
| Continental reading copy | `eu_continental` §4.5 | A4 | label left, speech beside | indented |

Two of them are worth a sentence each.

**UK BBC stage is `cueBeside`**, which was built for taped television and is
the same shape here. The spec forbids space-padding to reach the column, and
`cueBeside` is exactly that prohibition kept: the cue is laid in the margin
rather than typed into the line. It is **its own entry rather than a reuse of
BBC taped** because its directions are in capitals, which is the difference
between the two samples.

**The publisher reading copy is the one whose cue is not centred** — a reading
copy sets it in from the left, which is what keeps the page compact.

### The spec's caveats are kept rather than paraphrased away

They are on the screen, in the copy a writer reads: these are
recommendations and not acceptance rules; a theatre's, publisher's or
competition's own instructions override them; the BBC sample is **dated 2004**
and is not a statement of current UK submission rules; and **there is no
single Europe-wide convention**, so the continental preset is a configurable
reading copy and is labelled as one. No preset is named for a country whose
house style this has not been checked against, and nothing claims a
certification or an endorsement.

## 4. What a play already written is set in

**A play carrying `us` is not a writer who chose a screenplay.** Until now the
menu had no stage preset in it, so `us` is what every play was handed. So
`scriptFormatOf` resolves it to the modern play, which is the whole of Ken's
*select the proper formatting for you* — and it is **one reading**, asked by
`layoutFor` and by the menu alike, so what is lit and what prints cannot
disagree.

The screen formats are **absent rather than renamed** on a play
(`scriptFormatsFor`, which is `kindsFor`'s rule, addendum 16 §6c): a
multi-camera sitcom layout is not a thing a play can be set in, and offering
it is offering to format a play wrongly. The whole domain suite — 3,057 tests
— passed **unedited**, which is the proof no screen script moved.

## 5. Where the control is, and why it is not in Preferences

Ken asked for it in **Preferences**, and that is the right instinct and the
wrong record. `Preferences` takes no project at all — only the colour scheme
and whether the Script is drawn on paper — and its own footer says why:
*Preferences are kept on this computer, not in the project*. A script's house
style changes the geometry and therefore the page count, and two people
opening one play must not be looking at two different things.

So it stays where `scriptFormat` already lives, in **File ▸ Page setup ▸
Script format**, which is a selectable menu that draws a **sample page** for
every option — more than a drop-down can say. A second control elsewhere would
be the fault this project removes everywhere else.

And because Ken looked in Preferences, **Preferences says where it is**: a
*Script format* section with one line pointing at Page setup, on a script
alone (addendum 10 §8 — a route only where the route exists), with no second
control in it.

**The list is the format's and the copy is the screen's.**
`scriptFormatsFor` is a rule and lives in the domain; `SCRIPT_FORMAT_WORDS` is
what each is called and the page it draws, which is copy and not a reading
(addendum 30 §2a). Rendering the menu from the list means a seventh preset is
an entry in one place.

## 6. Driven

At 1440×900 in the real preview, on a new **Stage play** called *The Lamp*:

- *File ▸ Page setup* reads **SCRIPT FORMAT** over six tiles — US modern play,
  US traditional play, US publisher reading copy, UK BBC stage, UK
  contemporary play, Continental reading copy — each with its sample page and
  its caveat, with **US modern play lit**;
- a screenplay's own four are exactly as they were;
- choosing UK BBC stage lights it and writes `stage_uk_bbc`.

And in the printed document:

```
stage_us_modern   @page { size: letter; }   .page 8.5in × 11in
  scene_heading  padding-left:0ch;width:60ch;text-align:center   ACT ONE
  character      padding-left:0ch;width:60ch;text-align:center   SARAH
  dialogue       padding-left:0ch                                You came, and I did not think you would.
  action         padding-left:15ch                               She does not move.

stage_uk_bbc      @page { size: A4; }       .page 8.27in × 11.69in
  scene_heading  padding-left:0ch     ACT ONE
  dialogue       padding-left:0ch     SARAH           You came, and I did not think you would.
  action         padding-left:20ch    SHE DOES NOT MOVE.
```

## 7. What is not built, and named

Ken's spec is a module and this is its **drop-down**. The rest is named rather
than half-built:

- **The musical preset** (§4.6, which the spec itself marks optional in v1).
  It needs Song Title, Lyric, Music Cue and Dance Direction as **element
  types** — a change to what a manuscript can hold, not a formatting preset —
  and a preset that promised lyrics over a manuscript with no lyric element
  would be a control that lies.
- **The cast page and the title-page builder** (§5). A cast is already read
  from the cues (`notedCast`, `charactersCalled`) and a title page is already
  built (`settings.titlePage`); what §5 asks for beyond them — doubling,
  casting ages, vocal range, an "include in cast" tick per role — is the
  Character Creator's record widened, which is its own piece of work.
- **A dynamic width fallback for a long cue** (§9's own acceptance test). A
  name longer than the speech's column pushes that first line right rather
  than overlapping it, so nothing collides; what is missing is the fallback
  that drops such a cue onto its own line. It is `cueBeside`'s, so it would
  reach BBC taped too.
- **DOCX export with a paragraph style per block** (§8). The program exports
  PDF and an eBook; a DOCX writer is a new reader of the same pagination.
- **Save as Custom Template and Restore Defaults** (§1), and the per-element
  override inspector (§7). The presets are immutable bundled records, which is
  what §9's last test asks for; what is absent is somewhere to keep a writer's
  own edit of one.
