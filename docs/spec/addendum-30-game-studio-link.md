# Addendum 30 — A game is built in VC Game Studio

> From Ken: *on the project page, the video game tab needs to be a link to VC
> Game Studio.*

## 1. What was there, measured

Driven in the real preview at 1440×900 before anything was written. The
project page — the screen the program opens on, headed **New project** — draws
its formats as a grid of eight cards, each 150×146, four across and two down.
Every one is a `button` carrying `aria-pressed`, and pressing **Video game**
selected it: `Create project` then made a VC Writer game project, in the
`game` format, with addendum 18's whole Interactive Narrative module behind it.

That is the gap, and it is a gap against Ken's own written direction rather
than against anything in this repository. `kshank999-wq/vc_game_studio`,
25 September 2026:

> **VC Game Studio is its own program, not a mode inside VC Writer.** VC Writer
> carries only a teaser link that opens the full app in a mode that cannot
> save; from there the user reaches the home page to buy or subscribe.

The site is **vc-gamestudio.com** (that repo's `apps/web`, and its
`NEXT_PUBLIC_SITE_URL`); the domain resolves on Vercel today. So the ask is not
*add a link somewhere*, it is that the one card which still claims a game is
made here should stop claiming it.

## 2. A route rather than a format

The card **stays where it stands and stops being a choice.** Taking it off the
grid is the plainer reading of *not a mode inside VC Writer* and is the wrong
one: a writer who comes to VC Writer to write a game and finds nothing
concludes the answer is nothing, which is the fault addendum 08 §8b names (a
feature that vanishes when its list is empty is one nobody gets back into).
What changes is what pressing it does.

**A door says it is one**, three ways, because a control that leaves the
program may not look or announce like one that selects:

- it is an **anchor**, not a `button`;
- it carries **no `aria-pressed`** — the grid is a set of toggles and this is
  not one of them;
- it is **flat where every other card is raised** (addendum 20 §9 made the base
  `button` raised; the raise means *press me and something happens here*), in
  the accent colour, with a **↗**;
- and its line names **the program and the address** rather than the parts.
  *Scenes and beats* would be the wrong answer about a format this program does
  not start, and the address is said under the label rather than left in a
  hover nobody sees (addendum 02 §6b).

`builtElsewhere` in `packages/domain/src/formats.ts` is the one place that
knows it — the name and **one host**, with the URL read off the host so there
is one address rather than four — and `startsHere` is the predicate every
surface asks.

## 3. It decides starting, and nothing else

The half worth stating, because it is the half easy to get wrong by doing too
much: **`isInteractive` is untouched, `'game'` stays in the schema, and
addendum 18 goes on working.** A project already in that format opens, writes,
validates, simulates and plays exactly as before; the narrative map, the rule
builder, the endings matrix and the reports are all where they were. What is
withdrawn is a **way in**, never a feature — the distinction between a format
this program cannot handle and one another program handles better. A test
holds it: `createProjectFile({ format: 'game' })` still makes a game project,
and `nounsFor('game').unit` is still *Scene*.

## 4. Four surfaces start a project, and all four ask

Ken named the project page. Leaving it there would have shipped a page that
says games are built elsewhere beside three other screens that go on making
them — a contradiction between readings of one fact, which is the fault this
project documents more than any other. So the decision is made once and the
four callers read it:

| Where | What it does now |
| --- | --- |
| The project page (`Welcome.tsx`) | The card is the door, in its place on the grid |
| The phone's project list (`apps/mobile`) | **Absent**: nothing on a phone could open VC Game Studio, and a project started there would be made in the wrong program |
| The website's notes app (`project-page.tsx`) | Absent from the picker; the rows above still read *Game* off the same table |
| Said out loud (`capture-vocabulary.ts`) | *Video game* is no longer a kind, so it falls to the refusal that says the list again — the right answer from a pocket, where the way to a game is a website |

The **narrowing reaches what may be made and not what may be named.**
`formatSpokenName('game')` is still *Game*, because a project made before this,
or on a desktop, is on the phone's list and has to be named; a row reading
`game` is the raw column value showing through.

Three private copies of the eight formats existed between those surfaces
already (the desktop's labelled table, the phone's array, the website's words),
which is why the predicate goes in the domain and each list filters rather than
each list being edited to agree.

## 5. Driven

At 1440×900 in the real preview, after the change:

- the card is `A`, `href="https://vc-gamestudio.com"`, `target="_blank"`, no
  `aria-pressed`, `box-shadow: none` where its neighbours are raised, in
  `rgb(201, 164, 92)` against a `rgb(58, 48, 24)` edge, **150×146 like every
  other card** — the extra words do not grow the row;
- pressing it **opens a tab** and leaves the chosen format on *Screenplay*;
- under a light scheme the same card reads `rgb(26, 127, 55)` with a
  `rgb(223, 226, 232)` edge, so it is the scheme's tokens rather than a copy of
  Gold's values — addendum 02 §23a's fault one screen over, checked rather
  than assumed.

Looking at it caught the one thing no test could: **the address broke at its own
hyphen**, `vc-` over `gamestudio.com`, which is an address a reader cannot tell
from `vcgamestudio.com`. An address is one word, so it is `nowrap`.

In Electron the anchor needs no bridge: `setWindowOpenHandler` has sent every
`target="_blank"` to `shell.openExternal` since the window was built, so the
link opens in the writer's own browser and never inside the app — the mechanism
was already there, identical in both hosts, which is why the renderer writes an
`<a>` and nothing else.

## 6. Not built, and named

- **Which page of vc-gamestudio.com.** The link goes to the **home page**
  rather than to the no-save preview the Game Studio repo's direction
  describes. A route is only a route where it exists (addendum 10 §8), the home
  page is the one page certain to be there and to explain what VC Game Studio
  is, and the preview is one press from it. If Ken wants the card to land
  straight on the teaser, that is one host plus a path in `builtElsewhere`.
- **Opening an existing game project.** Nothing routes a `.vcw` in the `game`
  format to VC Game Studio; it opens here, as §3 says it must.
- **The website.** vc-writer.com says nothing about VC Game Studio. That is a
  page rather than a format picker, and Ken named the project page.
