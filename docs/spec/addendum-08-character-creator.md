# Addendum 08 — Character Creator

Status: specified; **stages 0–4 built**, September 2026. From Ken's *VC Writer
Character Creator Development Specification* — the first module of the Research
room. Extends §7 (research), §8 (structure) and §19 of the master specification,
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
5. The Arc Builder, with opportunity, refusal and doubling down (§8, §9).
6. Arc-to-plot: the on-deck queue, assignment, and the Related Elements box (§10).
7. Relationships (§11).
8. The relationship mind map (§12).
9. Cross-character arc links (§13).
10. Search, filters, the review modes and the Unused Character Material
    report (§18).

Stages 0–5 are Ken's MVP (§19) in his order. Stage 4 is the one to protect: it
is small in code and it is what makes the module usable by half its audience.

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
**Build** button beside somebody in the Characters folder, plus the edits in
`character-creator.ts` and migration `0040_character_tags.sql`.

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
