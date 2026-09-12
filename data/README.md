# /data — game data

One JSON file per equipment piece, grouped by hero directory:

```
data/equipment/<hero-dir>/<equipment-id>.json
```

Hero directories are `king`, `queen`, `prince`, `warden`, `champion` (see
`lib/schema/hero.ts`). The filename must equal the `id` field, and the `hero`
field must match the directory — `npm run validate:data` enforces both.

Balance changes every update, so nothing in here may be duplicated into a
component. `lib/data/catalog.ts` is the only reader.

## There is no stats API

The Supercell CoC API returns player and clan data only. It has no equipment
stat tables, and it requires IP whitelisting, so it can never be fetched
statically.

In practice the Clash of Clans Fandom wiki carries complete per-level tables
(ability attributes, hero boosts, ore costs, Blacksmith level) in a consistent
layout, and is the working source. It is CC BY-SA, so cite the page URL in
`sources` on every file that uses it. Numbers taken from it are `unverified`
until someone checks them in-game.

## dataQuality

Each file declares how much its numbers can be trusted:

| Value | Meaning | Level table |
|---|---|---|
| `stub` | Metadata is right, numbers not compiled yet | must be empty |
| `unverified` | Table compiled from patch notes, not checked in-game | full |
| `verified` | Table matches observed in-game values | full |

Promote a file by filling in `levels`, citing `sources`, and bumping
`dataQuality`. The schema will then require a complete, contiguous `1..maxLevel`
table, at least one source, and monotonic `dmg`/`hp`.

Nothing should ship to a guide or a shareable build link off `stub` data, and
`unverified` should be visible in the UI.

## Current state

All 6 heroes and 40 of the 41 equipment pieces now carry full level tables,
transcribed from the wiki and marked `unverified`. Outstanding:

- [ ] `Dark Orb` — the wiki table's dmg/hp decreases at level 8, which the
      schema rejects. Check the source table before adding it.
- [ ] Descriptions on the generated equipment files are placeholder text built
      from the wiki's summary row. Rewrite by hand before they are
      player-facing.
- [ ] Nothing is `verified` — no numbers have been checked in-game.

### Older notes

- [x] `queen/frozen-arrow` — epic, 27 · **unverified**, from the Fandom wiki
- [x] `queen/giant-arrow` — common, 18 · **unverified**, from the Fandom wiki
- [x] `duke/rocket-backpack` — epic, 27 · **unverified**, from the Fandom wiki
- [ ] `queen/archer-puppet` — common, 18
- [ ] `queen/healer-puppet` — common, 18
- [ ] `queen/invisibility-vial` — common, 18
- [ ] `queen/action-figure` — epic, 27
- [ ] `queen/magic-mirror` — epic, 27
- [ ] all five files in `data/heroes/` — base DPS/HP per level, and the level cap

`effectKeys` on each remaining stub is a modelling guess and will likely be
wrong. Frozen Arrow is the worked example: it was guessed as `freezeDuration`
and the wiki turned out to list *Slow Down* (a percentage) and *Slow Down
Duration* as two separate columns. Read the real table first, then set the keys.

Also unconfirmed: whether these seven are the complete Archer Queen list as of
the current patch. Check before treating the catalog as exhaustive.

## Field meanings

- `dmg` / `hp` — **passive** bonuses, added to the hero's base stats. Ability
  damage does not go here.
- `effect` — ability output, keyed by `effectKeys`. Seconds-valued keys must end
  in `Duration`; the schema uses that to check that `ability.kind: "duration"`
  pieces actually carry a duration.
- `oreCost` — ore to upgrade *to* that level. Level 1 is free.
- `gameVersion` — the patch the numbers were read from, e.g. `"2025.10"`.
- `maxLevelAt` (in `units.json`) — the highest level this unit reaches at each
  Town Hall, keyed by TH as a string; the same shape `buildings.json` uses.
  It is what lets the studio fill a level in when a unit is picked. A unit
  without one gets a blank level box rather than a guessed number, and
  `npm run validate:data` lists what is still missing.

### Where the level tables came from

All 136 units have one. Three sources:

- **Heroes and equipment (48)** — transcribed from
  `https://www.clashrecord.com/max-levels/th7` … `/th18`, one page per Town
  Hall. That source states equipment caps depend on *rarity and Town Hall,
  not on the individual piece*, which is why all commons share one table and
  all epics share another.
- **Troops, dark troops, pets, spells and siege machines (71)** — supplied
  directly by the project owner as per-Town-Hall tables.
- **Super troops (17)** — not transcribed at all. A super is always the same
  level as the unit it boosts, so its table is copied from its base through
  `SUPER_BASE` in `lib/schema/unit.ts`, and `validate-data.ts` asserts the two
  still match. Rebalance the Valkyrie and the Super Valkyrie follows, or the
  build fails.

All are `unverified` like everything else here: compiled from outside the
game rather than checked in it.

Two things make them worth more than a single source usually is:

- Every hero's TH18 figure equals the `maxLevel` already in
  `data/heroes/*.json`, compiled earlier from the Fandom wiki — six
  independent agreements. Each equipment table tops out at exactly the
  `maxLevel` in that piece's own file — 40 more. `validate-data.ts` asserts
  this and **fails the build** on a disagreement, so a future patch cannot
  silently drift the two apart.
- Every supplied row was length-checked to end at TH18, and each row's first
  column checked against the `availableAt` already in the registry. Only one
  disagreed — `sky-wagon`, corrected from TH17 to TH16 — and `ruin-witch`
  moved from `troop` to `dark-troop`, both per the supplied tables.

`dark-orb` (Minion Prince) and `revenge-deck` (Dragon Duke) are epic stubs:
their hero and rarity are confirmed, so they take the epic table and the gold
slab, but they have no level rows and their `ability.kind` is a placeholder.
Fill those in the same way as any other piece.

## Open modelling questions

These are design decisions, not data — settle them before `computeLoadout`:

- Does effective HP account for Healer Puppet output, or is healing reported
  separately?
- Invisibility Vial is damage avoided, not HP gained. Does it enter effective
  HP at all?
- Magic Mirror's clone may scale off the Queen's own stats rather than off the
  piece. If so the sim needs that relation, and a flat per-level effect value
  cannot express it.
