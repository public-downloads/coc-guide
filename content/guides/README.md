# Writing a guide

Two ways in. The studio is the comfortable one:

```bash
npm run studio      # http://localhost:4321
```

A local authoring app — guide list, frontmatter as form fields, an army builder
laid out like the in-game army screen, snippet buttons for the MDX components.
It writes straight into `content/guides/`, so publishing is still a commit. It
never ships: the site is a static export with nowhere to run it.

The army builder works the way the game does: the board shows the army so far,
one compartment per tab with its used/total badge, and the `+` on a compartment
raises a sheet from the bottom of the window holding everything that
compartment can take. Clicking a unit adds one; the `− n +` under each card
sets how many. The Clan Castle tab writes its picks with the `cc:` prefix, and
its sheet is split into troops, spells and siege machines.

Pets and equipment are **not** compartments. Each hero portrait carries a shelf
of three slots — one pet, two pieces — and clicking a slot opens a sheet
holding only what *that* hero can take, so the Queen's slot never offers the
King's gauntlet. Clicking a fitted piece takes it off again.

Picks are listed in unlock order within their elixir type — elixir troops, then
dark elixir, then the boosted supers — never alphabetically, and the slab
colour follows the same split: default blue, a deeper violet for dark elixir,
dark red for supers, gold for an epic (level-27) piece of equipment.

What the guide's Town Hall cannot build yet is shown greyed with its TH, not
hidden, and stays clickable for a guide that names what the reader is working
towards; the sheet's toggle hides them if a low-TH guide wants the short list.

Once a compartment is full the sheet disables what will not fit and the `+`
under a card stops — but a count typed by hand is left alone, and the badge
simply turns red. `validate:data` lists the equipment whose `hero` is still
missing from `data/units.json`; a piece with no hero cannot be picked, because
picking happens from the hero's own slot.

Counts and levels live in the body's first `<Army units="…" />` tag, because
`armyComp` in the frontmatter is a list of bare slugs and cannot hold them. The
builder writes both on every change — ids to the frontmatter for the index
filter, the full spec to the tag — and reads the tag back when a guide is
reopened.

Levels are filled in from the guide's Town Hall as you pick. A Clan Castle
pick is seeded two levels higher, because a donated unit arrives boosted by
the donor clan's perks — never past the unit's own ceiling. That happens once,
where the level is written; nothing adds a bonus again at render time.

### Screenshots and clips

Drop a file on the box under the body and it lands in
`public/guides/<slug>/`, with the tag that references it inserted at the
cursor — `<GuideVideo>` for mp4/webm/mov, `<Figure>` for an image. The name is
kebab-cased on the way in (`My Clip (1).MP4` → `my-clip-1.mp4`), and anything
outside that extension list is refused rather than written into `public/`.

### Two languages

Guides are written in English and translated one at a time. The switch above
the fields moves the title, summary **and** body together, so a German title
cannot end up over an English body without you seeing it.

- Title and summary go in the frontmatter under `translations.de`.
- The body is a sibling file, `content/guides/<slug>.de.mdx` — plain MDX with
  no frontmatter, since the English file already carries the metadata.

Everything falls back per *field*, not per language: a guide with a German
title and no German summary shows the German title and the English summary.
A reader on `/de/` who hits an untranslated guide gets the English one with a
line saying why — a strategy guide in the wrong language still beats no guide.
Emptying a translation deletes its file, so "not translated yet" has exactly
one representation.

Every save is validated against `guideFrontmatterSchema` server-side and
refused if it would not pass — the studio cannot write a file that
`validate:data` would reject. Run `npm run dev` alongside it and each guide has
an "open in site" link.

The CLI does the same scaffolding without the UI:

```bash
npm run new:guide -- "Sui Lalo" --th 13 --army lava-hound,balloon
```

That writes `content/guides/sui-lalo-th13.mdx` with valid frontmatter, creates
`public/guides/sui-lalo-th13/` for its screenshots and clips, and tells you
which unit icons are still missing. Then `npm run dev` and open
`/en/guides/sui-lalo-th13` — guides are read fresh on every request in
development, so saving the file is the whole loop.

| Flag | |
|---|---|
| `--th <1-20>` | required; also becomes the `-thNN` slug suffix |
| `--army <slug,slug>` | required; kebab-case unit ids |
| `--difficulty` | `beginner` \| `intermediate` \| `advanced` (default intermediate) |
| `--summary "<text>"` | the index blurb; a TODO is written if omitted |
| `--patch <YYYY.M>` | defaults to `CURRENT_PATCH` in `lib/content/scaffold.ts` |
| `--slug <slug>` | override the slug derived from the title |

It refuses to overwrite an existing file.

## Frontmatter

Every field is required except `draft`, and the whole block is validated by
`guideFrontmatterSchema` — `npm run validate:data` fails the build on a bad
one, and the dev index shows a banner instead of a stack trace.

```yaml
title: "Sui Lalo"
summary: "One or two sentences; this is what the index shows."
thLevel: 13
armyComp: [lava-hound, balloon]   # kebab-case; drives the filter and the icons
difficulty: intermediate
updatedAt: "2026-08-12"           # quoted, or YAML hands you a Date
patch: "2025.10"
draft: true                       # written, not yet checked against live play
```

`draft: true` puts a badge on the guide and a warning above the prose. Drop the
line once it has been verified in play. `validate:data` lists what is still
drafted.

## Components

Available inside any guide, no import needed — they are registered in
[`app/[locale]/guides/[slug]/page.tsx`](../../app/[locale]/guides/[slug]/page.tsx).

```mdx
<Army units="lava-hound x2 l6, balloon x24 l10, freeze-spell x2,
             barbarian-king l95, frozen-arrow l27, lassi l10" />
<Army units="lava-hound, balloon" compact />
```
The army laid out like the in-game army screen: one compartment per tab —
**Heroes**, **Army**, **Spells**, **Siege machines** and **Clan Castle** —
each with its own unit count and camp space. A hero's pet and its two pieces of
equipment sit on a shelf under that hero's portrait rather than in compartments
of their own.

Prefix an id with `cc:` to put it in the Clan Castle compartment — the same
unit means something different when it is donated:

```mdx
<Army units="hog-rider x14, cc:ice-golem x1, cc:rage-spell x1" />
```

You write one flat list; which compartment each id lands in comes from
`data/units.json`, not from the guide. `xN` is the count, `lN` the level,
`@hero` the hero a pet rides with — all optional and order-free. `compact`
drops the whole frame for a plain icon row.

```mdx
<Army units="archer-queen l95, frozen-arrow l27, frosty l10 @archer-queen" />
```

Equipment finds its hero from the registry, because a piece belongs to one
hero. A pet does not: any pet can walk beside any hero, so `@archer-queen` is
how a guide says which. A pet with no `@` still renders — as a loose card
rather than on a hero's shelf.

Art is drop-in — `public/units/<id>.webp`, or `public/equipment/<id>.webp` for
equipment — and an id with no file yet still gets a card with its initials.

Four game rules are enforced while picking in the studio, and reported by
`armyViolations`: **four heroes**, **one pet per hero**, **two equipment per
hero** and **two distinct super troops**. The studio disables the tiles that
would break any of them, with the reason on hover.

Each compartment shows used against what the guide's Town Hall can field —
camp space from `campsPerTownHall` × the best camp that TH allows, spell space
from the Spell Factory plus the Dark Spell Factory, and the Clan Castle's own
row. A TH16 guide is measured against 320 space, a TH17 one against 340.

Everything trained is counted in **housing space**, spells included: a Rage
costs two of the factory's slots and a Clone three, so `rage-spell x3,
freeze-spell x2` reads `8 / 11 space · 5 spells`. The Clan Castle carries three
badges rather than one, because it holds troops, spells and sieges against
three separate capacities.

A unit with no `housingSpace` in `data/units.json` makes its whole compartment
read "space unknown" rather than a total that silently omits it;
`npm run validate:data` lists any that still need the number.

The numbers are deliberately not part of the image. A cutout with `x12` burnt
into it is usable by exactly one guide and goes stale on the next balance
change — keep `public/units/` transparent and let the guide state the counts.

```mdx
<LoadoutCallout hero="queen" e1="frozen-arrow:27" e2="healer-puppet:18"
  note="Why this loadout and not another." />
```
The exact loadout the attack assumes, linked to the simulator.

```mdx
<Figure src="/guides/sui-lalo-th13/funnel.webp"
  alt="Two small groups on the corners" caption="Before the Hound goes in" />
```
Screenshot. `aspect` defaults to `16 / 9`; the image is fitted inside it, never
cropped.

```mdx
<GuideVideo src="/guides/sui-lalo-th13/walkthrough.mp4"
  poster="/guides/sui-lalo-th13/walkthrough.jpg" caption="The funnel, at 0.5x" />
```
Replay clip. See [`public/guides/README.md`](../../public/guides/README.md) for
encoding settings.

`Figure` and `GuideVideo` check the file exists at build time and render a
visible "not found" card rather than a broken box, so a missing asset is
something you see while writing.

## Assets

Everything belonging to one guide lives in `public/guides/<slug>/`; unit icons
are shared, so they live in `public/units/`.
