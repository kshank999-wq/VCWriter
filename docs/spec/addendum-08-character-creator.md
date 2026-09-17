# Addendum 08 — Character Creator

Status: **complete — all ten stages built, plus stages 11–14 (the way in, the
map and the review reading the script, and the rail) and §11's two leftovers,
the scene range and the drag** (0–5 were Ken's MVP), September 2026. From his
*VC Writer Character Creator Development Specification* — the first module of
the Research room. Extends §7 (research), §8 (structure) and §19 of the master specification,
and uses the typed link system §7.4 already built.

The Character Creator builds characters **through observable behaviour** —
what a trait makes somebody *do*, whether it has actually appeared on the page,
how the character changes across the story, and how their change moves other
people's. It is not a biography form with more fields.

## 1. The decision that shapes everything

**A trait is not characterization.**

*Greedy* is telling. *Leaves an embarrassingly small tip* is showing, and it is
the thing a writer can actually put in a scene. Ken's §2 says so, and it decides
the shape of the whole module: the unit of work is the **characterization
item**, not the character and not the trait. A trait is a folder for the ways it
gets shown.

Everything downstream follows from that:

- A trait with no characterization under it is an unfinished thought, and the
  interface should be able to say so.
- A characterization item is *on deck* until a scene exists for it — so the
  module has to hold work that is not in the story yet without that looking like
  an error.
- **Red and green are about the manuscript, not about the record.** An item is
  used because it appears in the writing, and for no other reason.

## 2. The second decision: used is a reading, never a stored flag

§17 asks for four behaviours that are hard to keep true if *used* is a column
somebody sets:

> If linked story content is deleted, status should automatically return to
> unused unless another valid usage remains. When a scene/beat is moved, links
> remain intact. When a character is renamed, all references update through the
> character ID.

All three become free — not implemented, *free* — if the status is **derived**:

```
used  = this item has at least one usage link whose target still exists
unused = it has none
```

Nothing sets it, so nothing can set it wrongly. Deleting the scene removes the
target and the item goes red again by itself; moving a scene changes nothing,
because the link is to an id and not to a position.

The one thing that *is* stored is **retired** — §17's *intentionally unused*.
That is an intention rather than a fact about the manuscript, and a derived
answer cannot know it. So: two words, and they are different in kind.

This is the same choice addendum 07 §19 made for the activity trail, for the
same reason: a second copy of a fact drifts from the first.

## 3. What already exists, and what this is allowed to assume

Most of what §16 asks for is in the product, built for other reasons. Naming it
decides how much of this is new work and how much is widening.

| What §16 names | What exists today | Where |
| --- | --- | --- |
| `Character` | Name, aliases, description, arc notes, category, voice | `entities/character.ts` |
| `ResearchLink` / `ProjectLink` | Typed story links between entity refs | `entities/links.ts`, §7.4 |
| A stable id for a passage | Every manuscript element carries one | `entities/manuscript.ts` |
| Scene / beat linking | `story_links` with `unit` and `beat` refs | `entities/links.ts` |
| The Related Elements box | Drawn on the scene and the beat | `Inspector.tsx` |
| A place to launch from | The Characters research category | `DEFAULT_RESEARCH_CATEGORIES` |
| A node canvas with labelled edges | The Story Sculptor's board | addendum 03 |
| Filters, search, review modes | The Story Grid's machinery | addendum 04 |

Four of these deserve a decision rather than a row.

### 3.1 Cross-arc links are story links; relationships are not

§14 says character relationships and cross-arc connections *should use the
project-wide linking architecture*. Half of that is right and half of it is not,
and the difference is worth stating.

**A cross-arc link is exactly a story link**: two references, a verb, a note.
*Mara's refusal* **causes** *Deakins' decision*. So `arc_point` joins the entity
types and the arc verbs join the link types, and nothing new is built.

**A relationship is not**, because §11 asks it to carry a description, a
*current state*, and an optional *evolution over the story* — three things a
link does not have and should not grow, since every other link in the product
would then carry three empty fields. A relationship gets its own row. It is
still directional, which is §11's real requirement: *A trusts B while B is
manipulating A* is two records, not one with a muddle in it.

### 3.2 A usage link anchors by id and keeps the words as a quote

§16: *store stable source identifiers rather than relying only on copied text.*

So a usage link is `{ beat id, element id }` — both of which already exist and
neither of which changes when the story is reordered. The passage is copied
alongside it **as a quote, for reading**, and never as the thing the link is
made of.

Which settles a question that would otherwise be argued about later: when the
writer rewrites the line, the quote and the manuscript diverge. That is **not a
broken link**. It is a rewritten line, still in the same beat, still showing the
same trait — and the row says *the line has changed since* rather than going
red. Going red there would punish the writer for writing.

### 3.3 The arc does not assume anybody improves

§9 is the part of this specification most software gets wrong. An arc is
usually modelled as a journey upward, and then a tragedy or an antagonist has to
be forced through a shape built for somebody else.

So the arc points include **opportunity to change**, **refusal**, and **doubling
down** as kinds of point in the same list, not a second system bolted beside the
first. A Scrooge and an antagonist use the same builder; what differs is which
points they have. And §13's last line — *one character's refusal to change can
become another character's catalyst* — is then just a cross-arc link between two
points, which §3.1 already built.

### 3.4 No module framework yet

Ken's words are *building out the research room with modules*, plural. This is
the first, and it will not be given a framework.

Building a plug-in architecture for one known module is how the wrong
architecture gets built: the second module is where the real shape becomes
visible, and a framework written before it will be bent to fit or thrown away.
What the Character Creator establishes instead is a **pattern** — a research
category that opens a screen of its own, with its records in the document and
its links in the existing link system — and the second module follows it. If
three modules share machinery, that machinery gets extracted then, from three
real examples.

## 4. The records

Seven, and they are §16's list with the reasoning attached.

| Record | What it is | Why not something that exists |
| --- | --- | --- |
| `CharacterTrait` | A quality, with prominence and a note | A research item cannot be a folder for characterization |
| `CharacterizationItem` | One concrete way the trait is shown | **The unit of work** (§1) |
| `UsageLink` | Where an item appears: beat, element, quote | Needs a text anchor a story link has no field for (§3.2) |
| `CharacterArc` | Beginning state, need, end state | One per character; the spine the points hang on |
| `ArcPoint` | A movement, turning point, opportunity or refusal | §9 |
| `CharacterRelationship` | Directional, with a state and an evolution | §3.1 |
| *cross-arc link* | **A story link**, not a record here | §3.1 |

`character.arcNotes` already exists as free text and stays: it is where somebody
writes about a character before deciding to build an arc, and taking it away to
make room for a structured arc would be taking away the thing people actually
start with.

## 5. Where it lives

The Character Creator is reached from the **Characters** research category and
opens as a screen of its own — a tabbed workspace, §15:

| Tab | What is on it |
| --- | --- |
| **Overview** | Name, aliases, role in the story, description, tags |
| **Traits** | Traits, each with its characterization items and their colour |
| **Arc** | Beginning, points, opportunities, refusals, turning points, end |
| **Relationships** | Linked characters, types, states, evolution |
| **Connections** | Cross-character arc links, and the map |
| **Usage** | Everything used and unused, with a way back to the page |

## 6. Both directions

§7 is the requirement that makes this usable by somebody who does not outline,
and it runs **both ways**:

- **Plan → story.** An item sits on deck until a scene suits it, then is linked.
- **Story → plan.** The writer highlights a passage in the script, right-clicks,
  chooses *Add to character characterization*, picks the character, and assigns
  it to a trait or makes a new one from the same dialog.

Neither direction is the primary one. A module that only supported the first
would be for outliners, and one that only supported the second would have
nothing to show a writer before they start.

## 7. What the writer is warned about, and what they are not

§10 allows *optional warnings for important arc points that remain unused near
completion*. Taken literally that is a nag, so it is narrowed to the one form
that is information rather than pressure: the **Unused Character Material**
report (§18), which is a list the writer asks for. Nothing in this module
interrupts writing to say a character is underdeveloped.

## 8. Build order

0. **Built.** The vocabulary: the records, the used/unused rule, and the
   arc kinds, in the domain with tests (§16, §17, §19).
1. **Built.** The tables, the sync mapping, and the round trip.
2. **Built.** The Character Creator screen: Overview, Traits, Characterization,
   red/green.
3. **Built.** Linking an item to a scene or beat from the Creator (plan → story).
4. **Built.** The right-click workflow in the editor (story → plan) (§7).
5. **Built.** The Arc Builder, with opportunity, refusal and doubling down (§8, §9).
6. **Built.** Arc-to-plot: the on-deck queue, assignment, and the Related
   Elements box (§10).
7. **Built.** Relationships (§11).
8. **Built.** The relationship mind map (§12).
9. **Built.** Cross-character arc links (§13).
10. **Built.** Search, filters, the review modes and the Unused Character
    Material report (§18).

Stages 0–5 are Ken's MVP (§19) in his order, and **all of them are built**.
Stage 4 was the one to protect: small in code, and what makes the module usable
by half its audience.

## 9. What it must never do

- **Never mark something used that is not in the manuscript.** Red and green are
  about the page (§2).
- **Never lose a characterization item because a scene was deleted.** The item
  is the writer's; the link is what goes.
- **Never impose a moral reading of a trait.** §4: positive, negative and
  neutral stay optional. A trait is a fact about a character, not a judgement.
- **Never require an arc.** Most characters in most scripts do not have one.
- **Never rewrite a character or the manuscript from a suggestion** (§21), when
  AI arrives here — the rule addendum 07 §14 already made structural.

## 10. What is built

### Stage 0 — the vocabulary, and the two words

`packages/domain/src/character-creator.ts`.

**The unit of work is the characterization item**, and the file is arranged to
say so: a trait is a folder, and `characterizationOf` returns a trait with its
items rather than the other way round.

**Used is derived and retired is stored**, which is §2 made real. `isUsed` takes
the item's usage links *and the ids the manuscript still has*, so a deleted
beat makes an item red without anything being updated anywhere — and a moved
beat changes nothing at all, because the link is to an id. `retired` is a column
because it is an intention, and no reading of the manuscript can discover it.

**A usage link's quote can go stale and that is not an error.** `usageStanding`
answers `used`, `rewritten` or `gone`: the passage is still in the beat but the
words have changed, which is a writer writing. Only a target that no longer
exists is `gone`, and only `gone` takes the green away.

**The arc kinds put refusal in the same list as change**, so a tragedy and a
redemption are built with one tool (§3.3), and `arcShape` reads a finished arc
back as `positive`, `negative`, `flat` or `refused` rather than asking the
writer to declare it in advance.

### Stage 1 — the tables, and the journey there and back

Migration `0039_character_creator.sql`, the six collections on the project file,
and `characterCreatorRows`/`characterCreatorFromRows` in `sync-mapping.ts`.

**Flat in the database, for the reason every other collection here is flat.**
The per-record sync merge compares *records*, so a character carrying its traits
carrying their characterization would be one record as far as the merge is
concerned — and two writers touching two different traits of the same person
would collide over work that never overlapped.

**There is no `used` column anywhere, and the absence is load-bearing** (§2).
The migration says so in a table comment, because a column called `used` is the
obvious thing for somebody to add later and it would break the module quietly:
the flag would be right on the machine that wrote it and wrong everywhere else.

**Deleting costs the filing, never the idea.** A trait's items are
`on delete set null`, not cascade, so removing a folder leaves the writing
unfiled rather than gone — and unfiled is a state the module already has, since
§7's right-click makes an item in a second without asking for a trait. A usage
link, by contrast, is `on delete cascade` on the beat: a link to writing that no
longer exists is not a link, and the item simply goes red again, which is §17
happening without anything running.

**The round trip is the test that matters**, because the claim the module makes
to a writer is a colour. `sync-character-creator.test.ts` proves an item stays
green on the second machine: a usage link that did not survive the journey would
tell somebody their work is not in the script when it is, and they would write
it again.

**One list of collections rather than two.** Building this out found the drift
waiting to happen: both readers of a project out of the database walked
`SYNC_TABLES` to fetch and then re-listed every collection by hand, so a new
module had to be remembered in three places, and forgetting one reads back as
nothing — after which the push takes nothing for the truth and deletes the rows
on the server. `ProjectRows` is now derived from `SYNC_TABLES` and `gatherRows`
does the assembling, so the compiler asks the question instead of a person.

**Proved against the live database, not just in tests.** Eight claims, in one
transaction, rolled back: a second writer cannot read or add to somebody else's
character; cutting a beat takes the usage links and leaves the characterization;
deleting a trait leaves its items unfiled; nobody is in a relationship with
themselves; and a character gets one arc.

### Stage 2 — the screen, and the colour

`apps/desktop/src/renderer/components/CharacterCreator.tsx`, reached from the
**Cast** section of the research side menu — every name in the project, one
click in — plus the edits in `character-creator.ts` and migration
`0040_character_tags.sql`. See stage 11 for why the side menu, and not the
button this stage first shipped.

**The layout is the argument.** Traits sit in a narrow column down the side and
the middle of the screen is the ways one of them gets shown, because the
characterization is the work and the trait is only the folder it is in (§1). A
screen that put the traits in the middle would be a screen about adjectives.

**Deleting the folder keeps the writing**, which is the one behaviour a writer
would feel as a loss. `removeTrait` unfiles its characterization rather than
taking it, which is the database's `on delete set null` said again in the
document — and unfiled is somewhere those ideas already live, since §7's
right-click path puts them there. Driving the real interface proves it: take
*Greedy* away and its three items are in **Noticed, not filed**, the one that
was in the writing is still green, and the line at the top has not moved.

**Setting aside and deleting are different things, and both are offered.**
`retired` is an idea decided against and worth keeping, so it goes grey and
stops counting as work outstanding; the × is for something typed by mistake, and
takes its usage links with it. The cascade runs that way only — deleting the
*writing* never takes the idea (§9).

**On deck is drawn as a ring rather than a blob.** Filled gold is in the script,
a red ring is still to place, a dashed grey ring is set aside — and the hollow
one is right, because there is nothing in it yet. The legend says in words that
this is the ordinary state, since a red dot with no explanation reads as an
error and §7 rules out anything that nags.

**The colour is never computed here.** `characterBoard` reads it off the usage
links every time, so the component cannot get it wrong — only draw it. Cut the
beat and the green one goes red with nothing running.

**`tags` is the one thing §5's Overview asked for that had nowhere to live**
(migration 0040). Not the heading a character is filed under, which says how
much of the story they are in, and not a trait, which says what they are like:
it is the writer's own shorthand for *who somebody is* — *antagonist*, *the one
who knows*. A research item has carried exactly this since 0001.

Two of §5's six tabs exist. Arc, Relationships, Connections and Usage arrive
with stages 5, 7, 8 and 10, and are not drawn as empty tabs in the meantime.

### Stage 3 — pinning it to the page

`pinUsage`, `unpinUsage`, `whereItAppears`, `placesToPin` and `quotableLines`
in the domain; the **Where** panel in the Creator, opened by pressing the
state on a row.

**There is no "mark as used" anywhere in this module, and there never will be.**
That is the whole of §2 made operational: a writer says *where* something
landed, and the colour follows from the manuscript. A button that set a flag
would be a button that set it wrongly, and the module's one promise to a writer
is that the colour is true.

**The colour is the way in.** The question a colour raises is *where*, so the
colour is the thing you press to find out — no separate link icon competing for
the row.

**The scene is worked out from the beat rather than asked for.** A link naming a
beat in one scene and a scene it is not in would navigate somewhere wrong, so
there is no way for a caller to make one.

**Pointing at a line is optional.** The whole beat is a perfectly good answer;
naming a line copies it as the quote, which is what lets the row read without
opening the scene (§3.2). Blank lines are not offered — a quote of nothing reads
as nothing.

**A pin to writing that has gone keeps its row.** The item went red by itself
the moment the beat was cut, and somebody looking at that wants to know why:
*that writing is no longer there*, struck through, with the tidy-up beside it.
Dropping the row silently would leave them a colour and no explanation.

**Unpinning takes the pin and never the writing**, and the same is true the
other way about: pinning the same thing to the same place twice does nothing and
hands back the pin already there, which is the database's unique said in the
document so the two cannot disagree.

**The beat being written is one click**, when there is one. It is the same fact
the research shelf already uses to mark material used where it landed, and most
of the time somebody is pinning what they have just put on the page.

Driven in the real interface: open the Where on an item on deck, choose the
beat and the line, press Pin it — the dot fills, the row reads *In the writing*,
and the line at the top goes from *1 in the writing, 2 on deck* to *2 in the
writing, 1 on deck*.

### Stage 4 — caught while writing

`captureFromScript` and `peopleInBeat` in the domain; the context menu and the
filing dialog in `BeatBody.tsx`, so it works everywhere the manuscript is
edited rather than in one screen.

This is §6's *both directions* finished, and §8 called it the stage to protect:
it is small in code and it is what makes the module usable by somebody who does
not outline. Right-click a line, choose *Add to a character's
characterization…*, and it is filed without leaving the page.

**An item made this way is green the moment it exists.** That is the point
rather than a convenience. The writer is not recording a plan; they are noticing
that what they have just written *is* characterization, and a path that made the
item and left it on deck would be asking them to go and file their own work.
`captureFromScript` makes the trait if one was named, adds the item and pins it
in one call — and **keeps nothing at all if the pin cannot be made**, because
half of it would be the one confusing outcome: something born on deck in a beat
the writer is looking at.

**The text and the quote are different things on purpose.** The passage arrives
in the box already, and editable, because what somebody wants to file is usually
a reading of the line rather than the line: *squares the coins before she lets
go of them* from *MARA counts out four coins and sets them down, squared*. The
item keeps their words; the pin keeps the page's.

**Naming a trait is done here or not at all.** §7 is explicit that the fast path
must not stop to send somebody off to make a folder first, so the dialog takes a
new trait's name — and *Not filed yet* is a real answer, since unfiled is a real
place (§1).

**Who speaks in the beat comes first in the list, and nothing is filtered.** An
action line about what somebody left behind is characterization and they never
said a word in it, so `peopleInBeat` is an ordering and never a gate.

**Nothing is taken away by suppressing the native menu.** Electron gives a
renderer no context menu of its own, so today right-click does nothing at all in
the app; this is the first thing on it. The menu has one item and will grow only
when something else genuinely belongs on the writing — reimplementing
cut/copy/paste badly is not that.

Driven in the real interface: right-click the action line in *The bill*, name
the trait *Counts everything*, type the reading, press Add it — and the Creator
shows a new trait holding one green item, pinned to INT. DINER - NIGHT · The
bill with the original line as its quote.

### Stage 5 — the Arc Builder

`arcBoard`, `beginArc`, `addArcPoint`, `moveArcPoint` and the rest in the
domain; the **Arc** tab in the Creator. This finishes §19's MVP.

**A spine, read top to bottom**: who they are, what they need, what happens,
who they become. §8 asks the view to show progression from beginning to end, and
the way to do that is to put it in that order and get out of the way.

**It does not assume anybody improves** (§9). A chance to change, a refusal and a
doubling-down are kinds of point in the same list as a discovery, so a Scrooge
and an antagonist are built with one tool — and the four decisive kinds are named
in the domain (`DECISIVE_KINDS`) rather than in a stylesheet, because *which
moments carry the drama* is a statement about writing.

**The shape is read back, never declared.** `arcShape` calls it *refused* the
moment a refusal exists, whatever else is there, because that is the defining
event once it happens. Asking a writer to label an arc positive before writing it
would be asking them to decide the ending first.

**What is written sits where the story puts it.** The points split in two: what
is in the manuscript, in the manuscript's order, and what is still on deck, in
the writer's. The arrows are only on the second group — `moveArcPoint` refuses a
placed point outright — because an arrow that reordered something already written
would be a control that lies about where the scene is.

**Pinning an arc point is the same act as pinning characterization**, so it is
the same panel: the Where panel from stage 3 took an *owner* instead of an item
and worked unchanged. Two versions of it would eventually disagree about what
pinning means.

**Nothing requires an arc.** A character without one gets a sentence saying most
characters do not need one, rather than an empty form implying they are behind.
Removing an arc takes its points with it — unlike a trait, whose characterization
survives (§1), because a point has no meaning without the journey it is a point
of, and that matches the database's cascade.

Driven in the real interface: start an arc, write the beginning and the need,
add a discovery, a chance to change, a refusal and a doubling-down, and the
header reads *Is offered the change and refuses it*. Pin the discovery to a beat
and it moves from **Still to place** into **In the writing**, wearing the scene's
name.

### Stage 6 — the module read from the scene

`characterWorkIn`, `onDeckForBeat` and `describeWork` in the domain;
`CharacterWorkPanel.tsx` under Related Elements in the Inspector.

**Three of §10's five bullets were already standing** when this stage began, and
saying so is more useful than building them twice: the unassigned queue is the
Arc's *Still to place*, assigning a point is stage 3's Where panel, and *which
arc points are already represented* is the Arc's *In the writing*. The fifth —
warnings about important points left unused — is §7's narrowed report, and waits
for stage 10.

**What was missing is the direction of travel.** Everything else in the module
starts from a person and asks where their work landed. A writer in a scene has
the opposite question — *what is this beat carrying?* — and it is the same rows
read backwards, so nothing new is stored to answer it. The panel empties itself
when a pin goes, because it is a reading rather than a list.

**The queue belongs where the opportunity appears.** §10 asks for future arc
moments kept on deck and assigned *when the plot creates an opportunity*, and
that moment is somebody writing the scene — not somebody three screens away in
the Creator. So what is waiting is offered in the Inspector, one press from being
in the writing, and **+ Here** runs the same `pinUsage` as everywhere else.

**Whoever speaks in the beat comes first and nobody is filtered out**, for the
reason §7's list is ordered that way: a scene can carry work belonging to
somebody who never says a word in it. Retired work is left out entirely — that
decision is already made, and offering it again is the nagging §7 rules out.

**Drag and drop is now built as well** (§13 of this addendum). The press stays, because it is
still the shortest way to put something in the beat already selected; the drag
does the thing the press cannot, which is land work in a beat that is *not* the
selected one.

Driven in the real interface: select the beat, open **On deck (2)**, press
**+ Here** on a piece of characterization — it moves up into what the beat is
carrying, and the queue below is one shorter.

### Stage 7 — relationships

`relate`, `relationshipsOf`, `answerRelationship` and the rest in the domain;
the **Relationships** tab in the Creator.

**Two lists, one above the other**: how they see other people, and how other
people see them. §11's requirement is that the two directions can disagree —
*A trusts B while B is manipulating A* — so a screen with one row per pair would
have to choose which of those sentences to keep, and the drama is the difference
between them. The tab draws both because the records are both.

**A relationship links two character records**, never a name typed twice, which
is §11's opening line and the reason this is not free text on the Overview.

**The other way round is offered, and arrives empty.** A row whose reading has
not been answered carries *+ The other way*, which opens the reverse with the
same kind and nothing else — copying the description across would be the module
putting the first person's words in the second person's mouth, and the point of
the second record is that it may say something completely different. It is an
offer and never a warning: plenty of relationships are only worth writing down
from one side, and §7 rules out nagging.

**Removing one reading leaves the other standing**, which is the same rule read
from the other end.

**The same pair may be read twice, differently.** Rivals at work and family at
home is two rows; what is refused is a second *identical* reading, which is the
database's unique said again in the document so the two cannot disagree.

The writer's own label wins over the kind wherever the relationship is named
(`relationshipName`), so *owes him for the Tulsa thing* survives being filed
under **Something else**.

Driven in the real interface, and the driver's DOM dump is the proof that
matters: Mara → Deakins reads **Friend**, *trusts him completely*; the answered
reverse reads **Dependency**, *working her, carefully*, with its history still
empty. Two records, two sentences, no merging.

### Stage 8 — the mind map

`packages/domain/src/character-map.ts`, and `CharacterMap.tsx` reached from
**Character map** in the Research window's menu, beside Plots and Setups.

**Nothing about the picture is stored, and that is the decision.** The Story
Sculptor's board keeps x and y because arranging it *is* the work; this is a
reading of the relationships, so the layout is computed every time. A new
character appears without anybody dragging one, a deleted relationship closes
the gap by itself, and there is no second copy of the cast to drift out of step
with the first. If somebody later wants to arrange it by hand, that is a
different feature and it will need the Sculptor's machinery, not this.

**One line per pair, with a label at each end** — which §3.1 promised a stage
ago. Two people may read each other differently, so two overlapping lines
carrying contradictory labels would hide the very thing the two records exist to
show. The label sits a third of the way along from the person whose reading it
is, so it is obvious which sentence belongs to whom.

**Clicking a line opens both readings at once**, and that panel is the only
place in the product where the two directions can be edited side by side —
*she trusts him* above *he is working her* is the thing a map is opened to see.
Clicking a name opens the Creator on that person, and the way out then says
**‹ Map**, because that is where they came from.

**Focus is a reading of the graph, not a filter on the cast** (§12's *expand
outward*): the person in the middle, whoever they are joined to around them, and
at depth 2 whoever *those* people are joined to. The graph is walked in both
directions — being read by somebody connects you to them as much as reading them
does.

**A track filter counts somebody as in a plot because they speak there**
(`charactersInTrack`), the same way the rest of the module works out who is in a
beat, rather than because anybody filed them under it.

**A scene range is now beside it** (§12 of this addendum), and the two are not
the same question
said differently: a track is a subplot and a range is a stretch of the script, so
*who is in act two and how do they connect there* is a question the track cannot
answer. Both narrow the cast, and a writer who sets both gets the people who
pass both.

**A character nothing joins to is still drawn**, because a person no line
reaches is a fact about the story worth seeing. A large cast can turn them off
with one tick.

A 1.5px line is hard to hit with a pointer, so a fat transparent line sits under
each edge and takes the clicks.

### Stage 9 — arcs that move arcs

`arcEffectsOf`, `arcsTurningIn` and `otherArcPoints` in the domain; the
**Moves** panel on an arc point, and the turning-list on a beat.

**Nothing new is stored, and nothing new is drawn** — which is what §3.1 decided
three stages before this one was built. A cross-character arc link is exactly a
story link: two references, a verb and a note. So the whole of the new shape is
`'arc_point'` joining `storyEntityTypeSchema` and the eight verbs joining
`storyLinkTypeSchema`, and **no migration**: `story_links.from_type` has always
been text, and both ends were already indexed.

The proof that the promise held is in the tests: an arc point resolves through
`resolveRef` like any other entity, so the **Related Elements box shows a
cross-arc link without being told that arcs exist**, and a character rename
reaches it through the id like every other link.

**Read in both directions.** Being moved by somebody is as much a fact about a
journey as moving them, so a writer looking at a refusal sees what it set off
*and* what set it off. §13's *from an arc point, show all characters whose arcs
are affected* is `arcEffectsOf`, and the row wears the verb.

**An arc cannot move itself.** The picker offers other people's points only: a
link between two points of one arc says nothing a reader could act on, and
allowing it would fill §13's reading with characters affecting nobody but
themselves.

**One dramatic event means both ends in one beat** (`arcsTurningIn`). A refusal
here that causes a decision three scenes later is a real link and belongs on the
point; what belongs on the *beat* is the moment where two arcs turn together,
which is §13's last line — one character's refusal becoming another's catalyst —
made visible where it happens.

Driven in the real interface: Mara's *takes the money anyway* **causes**
Deakins' *stops covering for her*; her point reads `causes → DEAKINS`, his reads
`← causes MARA`, and his row counts it without anybody telling it to.

### Stage 10 — search, filters and the three reviews

`packages/domain/src/character-review.ts`, and **Character review** in the
Research menu. This finishes §8's build order.

**One screen rather than five.** §18 asks for a search, seven filters, a
character review in story order, a report of what is on deck, and an arc
continuity check. That reads as five features and is one question asked three
ways: *choose some of this character work, and read it in the order the story
tells it*. So there is one filter (`reviewRows`) and three readings on top of it
— written as five they would drift five ways, and the filters would end up
meaning something slightly different in each.

**Story order, because that is how an audience meets somebody.** Placed work
comes first in the manuscript's order; what is not written yet follows, in the
writer's. Reading a character in the order the ideas were typed is not reading a
character.

**The search looks at the trait's name as well as the work**, because somebody
searching *greedy* wants what it makes her do — and the trait is the only place
that word appears, since the whole module's point is that the item says *leaves
a small tip* instead.

**The report leaves out what was set aside.** That is a decision already made,
and a list that kept raising it is exactly the nagging §7 forbids.

**The two continuity notes are checkable, never opinions.** A cause written
after its effect either is or is not — the writer said this moment causes that
one and the scenes are the other way round — and a refusal in an arc that never
offers a change is §9's own logic, not a verdict on the writing. *This character
is thin* is not a thing software gets to say, so it is not said. Both notes may
also describe something deliberate, which is why they are notes under a mode the
writer opened, and not warnings that arrive uninvited.

Driven in the real interface: the review lists Mara's work in story order, the
search narrows it to the three filed under *Greedy*, **Still on deck** groups
what is waiting under her name, and **Arc continuity** says *MARA refuses a
change their arc never offers* — which was true, and stopped being true the
moment she was given the chance.

### Stage 11 — being able to find it

`ResearchWindow.tsx`, `CastPanel.tsx`, `CharacterCreator.tsx`. No domain change
and no migration: everything below is about reaching what the ten stages above
already built.

**A module nobody can find is a module nobody has.** The Creator shipped behind
a small **Build** button on a row, inside the one folder that shows the cast —
so a writer who opened Research, clicked a character folder of their own making
and looked around correctly concluded it was not there. The fix is that the
**cast is in the side menu**, by name, in the order names are offered while a
cue is being typed, with the number of things waiting on each person beside
them. One click is the whole route.

**The Creator is a selection, not a layer over one**, and that is what makes it
stay. It used to be a separate piece of state that any click in the side menu
threw away, which meant the module could not be left and returned to — the one
thing a writer does constantly, because the reason to open the Creator is
usually something they just noticed somewhere else. Now pointing the menu at a
person is the same act as pointing it at a folder, so leaving is clicking
something else and coming back is clicking them again. The tab each person was
last left on is remembered per person, because arriving back on Overview when
the work was three items into their arc is the software forgetting them.

**Right-click opens a cast row**, since the name on it is editable and a click
there has to keep meaning rename.

Driven in the real interface: **Cast** lists Deakins and Mara with *2* beside
Mara, opening her and choosing **Arc**, going to Plots and coming back lands on
her Arc with her name still lit in the menu, and a right-click on a cast row
opens that person.

### Stage 12 — the lines the script draws

`togetherInScript` in `character-map.ts`, `peopleSpeakingIn` in
`character-creator.ts`, and the drawing in `CharacterMap.tsx`. No new record and
no migration, which is the tell that this is a reading rather than a feature.

**A map that opens empty on a finished screenplay has not read the
screenplay.** Stage 8 drew only what somebody had written down, so the one
project guaranteed to have nothing on the map was the one with a hundred and ten
pages behind it. The manuscript already knows who keeps turning up together.

**So it is counted, never stored.** For every pair who speak in the same scene:
how many scenes, and how many beats inside them. Cut the scene and the line
thins by itself; write another and it thickens. There is no *rebuild the map*
anywhere, because there is nothing to rebuild — §2's rule, applied to a second
question.

**And it stops at the count.** Nine scenes together is a fact. *Rivals* is not,
and the script has no way to know it, so a line the manuscript drew is dashed,
faint, thickening with its scenes, and labelled `9 scenes` and nothing else.
Clicking it offers the writer the sentence, one direction at a time — §11's
point being that the two directions may disagree — and naming it turns the line
solid. The script raises the question; the person answers it.

Two consequences worth stating. **Focus now expands through script lines**,
without which *who they know* was useless until somebody had written
relationships down — the state every real project starts in. And **asking for a
kind drops them**: *show me the rivals* is a question about readings that have
been named, and an unnamed line is not one.

The limit is deliberate and named in the tests: sharing is worked out from **who
speaks**, the same rule the module already uses for who is in a beat, so
somebody standing silently in the room does not count. Finding them means
matching names in prose, where a name in an action line is as often somebody
being *talked about* as somebody being there — and a map that guessed wrong
would be worse than one that under-reports.

Driven in the real interface: a four-hander draws Mara–Deakins at **3 scenes**
thick, three single-scene lines around it, and the panel on one reads *They speak
in 3 scenes together, across 3 beats* above two empty readings. The count sits
just off each line's midpoint, because two lines that cross do it at their
midpoints and two counts on the same spot read as one.

### Stage 13 — the review reads the script

`scriptPresence`, `cuesWithoutCharacter` and `castNeverSpoken` in
`character-review.ts`, the **In the script** reading in `CharacterReview.tsx`,
and `charactersCalled` in `characters.ts`. No record, no migration — stage 12's
argument applied to the second screen.

**The review opened on *In story order*, which said *nothing matches that*.**
True, and useless, because on a project with a hundred and ten pages and no
Creator records there is nothing in any of the three readings. So there is a
fourth, and it is the one the screen opens on: who is in the manuscript, in how
many scenes, how often they speak, where they come in and where they go out,
and the longest stretch they are away.

**Countable, and nothing more.** *Fourteen speeches across nine scenes* is a
fact; *absent for eleven scenes* is a fact; whether either matters is the
writer's, so no row wears a warning colour. And **arriving late is not a gap** —
a character who enters at scene 40 has not been away from anything, and calling
it an absence would be the software inventing a problem to report.

Two more facts fall out of the same walk, and both are ordinary rather than
wrong, so they are stated and not flagged: **a cue nobody in the cast is
behind** (somebody typed straight into the script and never filed, or a name
mistyped — and the extension is stripped, so `MAEVE` and `MAEVE (V.O.)` are one
row), and **somebody in the cast with no lines yet**, which is here because a
presence report that silently omitted them would be a report you cannot trust.

**A correctness fix came with it.** Three modules asked *is this cue this
character* by testing whether the cue **starts with** the name, which quietly
made `MARABEL` speak as `MARA`. The cast list already had the right rule —
strip the extension and the dual caret, then match whole — so it is now one
function, `charactersCalled`, and `peopleSpeakingIn` and `charactersInTrack` both
use it. It returns a *list* because an alias may collide with somebody else's
name, and silently picking one of the two would put a speech in the wrong
character's scene. `castForNewEpisode`'s *carry whoever spoke* in `episodes.ts`
carried the fourth copy of the same defect — a series would have pulled MAEVE
into the next episode because MAEVENA spoke in this one — and now asks the same
function. There is no loose cue match left in the domain.

Driven in the real interface: a seven-scene fixture opens on **In the script**
with Mara at *4 scenes · 5 speeches*, her span, and *away for 3 scenes after
Sc. 1 EXT. LOT - LATER*, with **MAEVE** below under *Speaking, but not in the
cast*.

### Stage 14 — the rail, and the module by name

`characterRail` / `railStanding` in the domain, `Rail` in `CharacterCreator.tsx`,
and three changes to the research side menu.

**The menu says what the feature is called.** *Cast* is a noun for a list of
people; **Character Creator** is the thing the product does, and a writer who
has read about it needs to find that word in the menu. The folders moved to the
bottom of the menu in the same pass — they are the least of what this window is
opened for, and they were sitting above the part that is.

**The rail answers the other question.** The Creator says *what is this person
like*, one tab at a time. What it could not say is **what have I made for them,
and what is still owed** — that was spread across the Traits tab, the Arc tab
and their notes, and a writer had to visit three places to total it up. The rail
is one reading over all of it: a block per trait, a block for the arc, a block
for the notes, every row red or green, and what each block still owes in its
heading.

**There is still no "mark as used", and there is still never going to be.** Ken
asked for one, and the reason it is not here is §2: green means the manuscript
contains it, read off the usage links every time, which is why cutting a scene
turns a row red on its own with nothing running. A stored flag would let
somebody mark a trait used that appears nowhere, and nothing would ever correct
it — the colour would stop being a fact about the script and become a fact
about who last clicked. So clicking a red row does what marking it used was
*for*: it opens that piece of work with the **Where** panel already showing, so
saying where it landed is the next thing on screen. One press, same gesture, and
the colour still means something.

**A note gets no dot**, and that is the same rule pointed the other way. A note
is something the writer knows about the person, not something *shown* in a
scene, so there is no claim about the manuscript to make about it. Inventing a
colour there would teach a writer to distrust the colour everywhere else.

The dots are now actually red and green. They were gold-for-used, which is the
brand's colour for everything and therefore said *done* to nobody.

Driven in the built renderer: the menu reads Everything · Character Creator ·
Also · Folders; MARA's rail shows *2 still on deck*, Greedy owing one, a green
row, a red row, a set-aside row and the unfiled pile; and clicking a row landed
on the Traits tab with that trait chosen and **Where** open on *Pin it*.

## 11. What is left

**Nothing.** §8's stages are built, and so are the two things Ken's §12 and §10
named that this section used to hold back: the **scene-range filter** on the map
is §12 of this addendum, and **drag and drop** for assigning on-deck work is
§13.

What comes next is not more of this module but the **second** one — and
§3.4 is the reason to wait: the pattern this establishes is a research category
that opens a screen of its own, with its records in the document and its links in
the existing link system. If three modules end up sharing machinery, that
machinery gets extracted then, from three real examples rather than one guess.


## 12. The scene range on the map — his §12

`SceneRange`, `scenesForRange`, `unitsInRange`, `charactersInScenes` and
`describeRange` in `character-map.ts`; the **Scenes … to …** pair in the map's
bar.

*His* §12, the mind map. Stage 8 left this out on the grounds that the plot track
beside it answered the same question. It does not. A track is a **subplot** and a range is a **stretch
of the script**, and the question a range answers — *who is in act two, and how
do they connect there* — cannot be asked of a track at all. Both narrow the cast,
so a writer who sets both gets the people who pass both, which is what setting
two filters means everywhere else.

**A range is positions, not scene ids.** *Scenes 12 to 30* means where they sit
in the story order, so moving a scene into the stretch puts it in the stretch.
Storing two ids would freeze the answer to wherever those two scenes happened to
be on the afternoon somebody set the filter — which is the same reason nothing
else in this module stores a reading.

**It narrows what the script says and never what a writer said.** This is the
decision the whole thing turns on. The manuscript's own lines are counted inside
the range, so a pair who share nine scenes across the film share two in act two
and the line thins accordingly. A **relationship the writer wrote down is
untouched**: a relationship has no scene number, and deciding when one began
would be the map inventing a fact the record does not carry. Two people who are
both in the stretch keep their named line; a line whose other end is outside it
is not drawn, because that person is not on this map and a line to nowhere is a
reading of nothing.

Who counts as *in* a stretch is the module's one rule, for the fourth time:
**they speak there**. A range that kept people who were not in it would draw the
whole cast with fewer lines, which answers nothing.

Two more small things, both because being right at a writer's expense is not
being right: a range given **backwards** is read forwards rather than refused,
and a range covering the **whole script** is not a range at all — the control
sits at both ends until somebody moves one, and `null` is the only
representation of *no range*, so a filtered map and an unfiltered one cannot
look alike.

**A filtered map says so.** The line under the bar names the stretch, counts who
speaks in it, and states the rule about relationships — because a range that
dropped half the cast without explanation looks like a story with half the cast
in it.

Driven in the built renderer: the whole script drew four people and four lines
with MARA and DEAKINS at *3 scenes*; narrowing to scenes 2–3 thinned that line
to *2 scenes* and put the line up; the last scene alone dropped ROURKE from the
map entirely, leaving three people and two lines; and **×** put all of it back.

## 13. Drag and drop for on-deck work — his §10

Stage 6 read his §10's *drag/drop **or** assign* and built the press, on the
grounds
that a press that says where something lands is the same act with fewer ways to
miss. That is true of the beat already selected — and it is the whole of what a
press can reach, which is the thing the drag fixes: **a drag can land work in a
beat that is not the selected one.**

So both exist and neither replaces the other. **+ Here** is still the shortest
way to put something in the scene being written; dragging is how a writer moves
a piece of somebody's plan to a scene three pages down without leaving where
they are.

**The drop is claimed by type.** The on-deck row writes a MIME type of its own
on the drag, and a beat only takes a drop that carries it — which means
dragging a line of dialogue inside the manuscript behaves exactly as it always
did, because the beat never calls `preventDefault` on a drag that is not this
one. A drop handler that swallowed text drags would have broken editing to add a
convenience.

**It runs the same `pinUsage` as everywhere else**, so the colour follows from
the manuscript exactly as §2 requires, and dropping something twice in the same
beat changes nothing.
