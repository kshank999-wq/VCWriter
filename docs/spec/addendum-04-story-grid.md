# Addendum 04 — The Story Grid

Status: stages 1–3 built, September 2026; the rest specified. Extends §8.2 of
the master specification, which already asks for "a scene-by-scene
**story-grid style review**". This addendum says what that grid is and where
it lives.

The Story Grid is the craft method as it is commonly taught — a global genre
that owes the reader certain scenes, a value that moves in every scene, and
five things every story does at every scale. VC Writer uses the vocabulary
because writers use it. This is not an affiliation with anybody, and nothing
here is licensed from anyone.

## 1. Where it lives, and why

**A third tab of the Editors page**, beside Daily and Final. It belongs
there because it is *analysis of what is written* — it reads the manuscript
and asks whether the scenes are doing their work.

That is the whole reason it is not in Story Sculptor (addendum 03). The
Sculptor is for what is **not written yet**: shapes, guesses, ideas dropped
on a canvas. A method that asks "what is the value shift of this scene"
cannot be answered by a scene that does not exist. Two rooms, two jobs:

| | Sculptor | Story Grid |
| --- | --- | --- |
| Works on | What might be | What is |
| Made of | Nodes the writer invents | The scenes the manuscript has |
| Asks | *What if it went like this?* | *Is this scene working?* |
| Prescriptive | Never | Deliberately |

**Prescriptive is the point here.** Addendum 03 §1 forbids making a writer
fill in a template to proceed; that rule is about the Sculptor, where the
story is being found. The Story Grid is opened *on purpose*, by a writer who
has asked to be held to a method. A tab you choose to open is not a template
you are forced through.

## 2. What is already built

Most of the per-scene half exists. The Final Editor's grid already asks four
of the questions, and the AI structural read (§8.2) already answers several
of them.

| Story Grid asks | What VC Writer already holds |
| --- | --- |
| Value at stake | `SceneGrid.value` — "trust / betrayal", "life / death" |
| Value shift, its polarity | `SceneGrid.polarity`, and `SceneRead.valueShift` from the AI pass |
| The turning point | `SceneGrid.turn`, `SceneRead.turn` |
| Why the scene is here | `SceneGrid.purpose`, `SceneRead.purpose` |
| What is fought over | `SceneGrid.conflict` |
| Scene length, POV, who is in it | `SceneReview` — pages, words, speakers, location, dialogue and action lines |
| Setups and payoffs still open | The Setups & Payoffs tracker |
| Where a character actually moves | The character threads of the Timeline & Viewer |

So this addendum adds two things to what is there: **the global layer**, and
**the five commandments**. Everything else is the same data, laid out as a
grid instead of a card.

## 3. The global layer

What the story is, and what that obliges it to deliver. One panel at the head
of the tab.

| | |
| --- | --- |
| **Global genre** | Action, horror, crime, thriller, love, performance, society, status, worldview, morality — and a sub-genre where the writer wants one. Western and war are settings rather than genres: a western and a war film can both be action, and the sub-genre box is where they go |
| **Global value** | The value the whole story moves: life/death, love/hate, truth/lie, justice/tyranny, or the writer's own |
| **The controlling idea** | One sentence: what the ending says |
| **The obligatory scenes** | What this genre owes its reader, as a checklist |
| **The conventions** | The furniture the genre is expected to carry |

**The checklist is the useful part.** Choosing a genre fills it with what
that genre owes — a thriller owes its hero at the mercy of the villain, a
love story owes the lovers meeting — and each line can be **ticked off
against a scene in the script**. A line with no scene against it is the
question the whole tab exists to ask.

Nothing is enforced. A writer who deletes half the obligatory scenes, or adds
five of their own, has a genre of their own, and the grid says so without
complaint.

## 4. The five commandments

At three scales — the whole story, each act or region, and each scene:

| | What it asks |
| --- | --- |
| **Inciting incident** | What upsets the balance |
| **Progressive complication** | The turn that makes going back impossible |
| **Crisis** | The best bad choice, or the irreconcilable good |
| **Climax** | The choice, taken |
| **Resolution** | What it settles into |

The scene grid already holds the turn; the other four are new fields on the
same record, and the AI structural read is extended to answer them alongside
what it already answers. The global and act-level sets are the writer's own —
nothing derives them, because a story's inciting incident is a judgement, not
a measurement.

## 5. The grid itself

One row per scene, in reading order, read **down** the columns rather than
across a card. That is the difference from the Final Editor: a card tells you
about a scene, a grid tells you about the story.

| Column | From |
| --- | --- |
| # | Reading order |
| Scene | Its heading, or its number and name |
| Words / pages | Measured |
| Story event | The writer's, or the AI's `change` |
| Value | `SceneGrid.value` |
| Shift | The polarity, drawn as **+ / −** so the eye can run down it |
| The five commandments | Five narrow columns, filled or empty |
| POV, characters, setting, time | Measured where they can be, the writer's where they cannot |

**Empty cells are the finding.** A run of scenes with no value shift, a scene
with no crisis, three scenes in a row that turn the same direction — these
are visible because the grid is dense and regular, not because a rule fired.
Sorting and filtering are the analysis: show me the scenes that do not turn,
show me everything in this act, show me the negative ones.

## 6. The value graph

The polarity column, plotted: the story's value across its scenes, one point
per scene, running left to right. A story that never goes below the line, or
never comes back above it, is a story with a problem — and the graph says so
in a glance where fifty rows would not.

Clicking a point goes to the scene.

## 7. What it does not do

- **It does not rewrite.** §8.2 is explicit: findings are an interactive
  review, never a silent edit. The same holds here.
- **It does not grade.** No score, no "your story is 68% complete". A grid
  with holes in it is a working document, not a failure.
- **It does not fill itself in.** The AI pass offers answers and the writer
  accepts, edits or ignores them; the grid is the writer's reading of their
  own story, which is the only reading that can change anything.
- **It does not follow the Sculptor.** Where a scene exists in both, the
  grid reads the real scene, because the grid is about what is written.

## 8. Where the work is

1. **Built.** The global panel: genre, value, controlling idea, and the
   obligatory scenes and conventions each genre seeds — with a scene named
   against each line.
2. **Built.** The five commandments on the scene record, and on the story
   and its acts.
3. **Built.** The grid view: rows, sorting, filtering, and going to a scene
   from a row.
4. The AI structural read extended to answer the five commandments.
5. The value graph.
6. Print and export the grid, as the Reports pages already print.

Stage 1 alone is worth having: a writer who can see what their genre owes
them, and which of it the script has actually delivered, has most of what
they came for.

## 9. What is built

**Story Grid** is the third tab of the Editors page, also reachable from
Editor → Story Grid. The tab reads `answered/owed` so the one number is
visible without opening it.

### Stage 1 — the global layer

- **What the story is.** Genre, sub-genre, the value and the controlling
  idea. Choosing a genre for the first time fills the checklist and offers
  that genre's value; typing a value of one's own keeps it.
- **What the story owes**, and **what it carries** — the obligatory scenes
  and the conventions, each a line that can be reworded, removed, or added
  to, with a `+ One of your own` at the foot of each list.
- **A scene against each line.** Naming one marks the line kept (●) and
  offers a **Go** that opens that scene in the writing screen. Cutting the
  scene later leaves the line unanswered rather than pointing at nothing.
- **Start the list again** puts the current genre's checklist back, and says
  so out loud, because by then the list carries the writer's own wording.

Changing the genre does **not** replace the list on its own — by then it
holds their edits and their scenes. That is what the button is for.

It lives in `projectSettings.storyGrid`, so an older project opens with an
empty grid and no migration, and `packages/domain/src/story-grid.ts` holds
the method: the genres, what each owes, and what counts as kept.

### Stage 2 — the five commandments

The same five questions — inciting incident, progressive complication,
crisis, climax, resolution — at the three scales of §4, under one switch:

- **The story.** Five boxes, each carrying its question as its placeholder,
  with a count of how many have been answered beside the heading.
- **Each act.** One row per region, five columns across. Which marker kind
  divides the work is whichever coarsest one the writer has actually used —
  episodes for a series, acts for a screenplay, parts for a novel that has
  them and chapters for one that does not — so nobody is asked five questions
  per sequence in a script whose acts are already marked. A region runs from
  its marker to the scene before the next, exactly as the Final Editor
  measures the act shape.
A scene's five are five columns of the grid below rather than a scale of
their own: at that size they are worth reading down against everything else
the scene is.

**The progressive complication is the turn.** The Final Editor's grid has
always asked where a scene turns; that is the same field under the name the
method uses, so filling it in either place fills it in both. The other four
are new on the scene's record.

Nothing derives any of it. The story's and the acts' answers live in
`projectSettings.storyGrid` (the acts keyed by the marker that opens them, so
answers survive a marker being renamed and wait where they were if one is
deleted and put back); the scene's live on the scene, beside the rest of its
reading.

### Stage 3 — the grid

Every scene, one row, in reading order, at the foot of the tab.

| Column | From |
| --- | --- |
| # | Reading order |
| Scene | What the writer called it, else its marker, else its number — with the act it falls in under it, and a click to go there |
| Length | Measured: pages and words |
| Story event | The writer's. Where an AI read has been made, its `change` shows as the placeholder — offered, never written |
| At stake | `SceneGrid.value` |
| Shift | The polarity as **+ − ± =**, so a column of it reads at a glance |
| The five commandments | Five columns, filled or empty |
| POV | The writer's; nothing measures it |
| Who, where, when | Measured: who has a cue, and the scene heading's place and time |

**Filtering and sorting are the analysis.** *Show* takes every scene, the
ones that do not turn, the ones that do not move, the negative or positive
ones, the ones with nothing at stake yet, or the ones nobody has said
anything about at all. *In* narrows to one act. *Order* is reading order,
longest first, or shortest first. The heading says how many of how many are
showing; none of it changes a word of the manuscript.

A scene the writer has marked as not moving carries a rule down its edge —
the one row in the grid that is a finding in its own right.

The Final Editor keeps its own smaller grid (value, shift, turn, purpose):
the same fields, and filling one in fills the other. A card there tells you
about a scene; this tells you about the story.
