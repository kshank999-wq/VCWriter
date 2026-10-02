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

## 2. The first answer: a route rather than a format

Built and shipped as `d92f83c`. The card **stayed where it stood and stopped
being a choice**: an anchor rather than a `button`, no `aria-pressed`, flat
where every other card is raised, a ↗, and a line naming the program and the
address rather than the parts. Taking it off the grid looked like the wrong
move — a writer who comes to VC Writer to write a game and finds nothing
concludes the answer is nothing, which is the fault addendum 08 §8b names.

`builtElsewhere` in `packages/domain/src/formats.ts` is the one place that
knows it — the name and **one host**, with the URL read off the host so there
is one address rather than four — and `startsHere` is the predicate every
surface asks. Both survive §2a unchanged; what changed is only what the project
page draws.

## 2a. Ken's answer: an advertisement, outside the grid

> *Or we can create a separate button and advertisement on that screen saying,
> need to write a narrative interaction script. See VC Game Studio.*

He is right, and the reason is worth keeping because it reverses §2's own
argument rather than merely preferring another look. §2 spent **three
decisions** making one card announce that it was not like its seven
neighbours — an anchor, no `aria-pressed`, flat rather than raised — and each
of them is the cost of standing a door in a row of toggles. **Outside the grid
it has to announce nothing**, because nothing about it claims to be a format.
So the card is **gone rather than kept beside the advertisement**: two things
on one screen pointing at VC Game Studio would be two answers to *where do I
write a game*, and the one inside the grid is the one that has to lie about
what it is.

What §2 was right about is that the answer must still be **findable from the
formats**, and that is why the advertisement is **at the foot of the New
project panel**: a writer scanning the eight-card grid for *Video game*, and
not finding it, looks around in the same glance. It is deliberately **not
between the grid and `Create project`** — nothing may stand between choosing a
format and pressing the button.

Three smaller ones. **The words are Ken's** — *Need to write a narrative
interaction script?* and *See VC Game Studio* — because an advertisement is
copy rather than a reading, and copy typed twice is two advertisements
(addendum 27 §13). **The program and the address are still the domain's**, read
from `builtElsewhere`, so there is one host in the program and the whole
advertisement goes with it if that ever answers null. And **the button is
raised like every other act on this screen**: it is a control a writer presses
on purpose, and what says it leaves is the ↗ beside its words and the address
under it, not a different shape.

The grid is now **seven cards and every one of them is a choice**, which a test
asserts by walking them: there is no card on the format grid that does anything
but choose a format.

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

In the real preview, at 1440×900 and again at 1100:

- **seven cards on the grid and no anchor among them** (`.format-options a` is
  0), every one carrying `aria-pressed`;
- the advertisement is 630×160 at the foot of the panel, below `Create
  project`, its left edge in `rgb(201, 164, 92)` — the accent token, so it
  follows the writer's scheme rather than carrying a colour of its own
  (addendum 02 §23a's fault, checked rather than assumed);
- the button is 187×38, `href="https://vc-gamestudio.com"`,
  `target="_blank"`; pressing it **opens a tab** and leaves the chosen format
  on *Screenplay*.

Measured on §2's card before it was replaced, and worth keeping because the
fault outlived it: **the address broke at its own hyphen**, `vc-` over
`gamestudio.com`, which is an address a reader cannot tell from
`vcgamestudio.com`. An address is one word, so it is `nowrap` — and the
advertisement, which also prints the host, inherits the fix.

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
- **Both.** §2's card and §2a's advertisement are not kept side by side, for
  §2a's reason. Putting the card back is one branch in the grid's `map` and the
  `.format-elsewhere` rules, if Ken wants a writer to meet the answer twice.
