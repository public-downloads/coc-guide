# Isometric building art

The 2.5D board's sprites. One render per building type, named after its `id`
in `data/buildings.json`, standing at the game's isometric angle.

Not the same thing as [`public/buildings/`](../buildings/README.md): those are
square tiles for the flat board, drawn edge to edge. An isometric render is
whatever shape the building is — an Air Defense is tall and narrow, a Barracks
squat and wide — and it is *placed*, not stretched to fit.

## Fetching them

```bash
npm run fetch:art -- --dry-run       # what it would take, no writes
npm run fetch:art                    # everything still missing
npm run fetch:art -- --only cannon,x-bow
npm run fetch:art -- --force         # re-fetch what is already here
```

[`scripts/fetch-building-art.ts`](../../scripts/fetch-building-art.ts) pulls
from the Clash of Clans wiki through its MediaWiki API — the HTML pages are
behind Cloudflare and refuse a script, the API is not. For each type it takes
the highest-level render, at 256 px wide from the wiki's own thumbnailer.

Deliberately a one-off command, never a build step: the site is a static
export and the wiki is someone else's server.

## manifest.json

Written by the same script. It records each file's dimensions and where it
came from:

```jsonc
"cannon": {
  "file": "cannon.png",
  "width": 256, "height": 208,
  "source": "https://static.wikia.nocookie.net/clashofclans/images/4/48/Cannon21.png"
}
```

The dimensions are not decoration — the board needs the aspect ratio to draw
a building at its real proportions. A file dropped in by hand with no manifest
entry still renders, just assumed square until the script runs and records it.

`source` is there so any of this can be traced back or removed on request.

## What the fetcher cannot find

Every non-retired type has a sprite now. Five needed help getting one:

| id | where it came from |
|---|---|
| `hero-banner` | `Hero Banner Empty.png` |
| `helper-hut` | `Helper Hut.png` |
| `b-o-b-s-hut` | `O.T.T.O Hut5.png` |
| `builder-s-hut` | supplied by hand |
| `giga-bomb` | supplied by hand |

The first three are on the wiki but their filenames do not follow the
`Name<level>` pattern the fetcher keys on, so they were pulled by exact title.
The last two were dropped into this folder directly, and their manifest
entries say so instead of carrying a source URL.

A type with no sprite is not broken — it renders as a shaded box extruded from
its footprint, coloured by category and standing at the height in `ISO_HEIGHT`
(`lib/practice/iso.ts`). A partial set is a normal state.

## Licensing

Same position as every other art directory here — Supercell's, used under the
[Fan Content Policy](https://supercell.com/en/fan-content-policy/), on the
conditions spelled out in [`public/units/README.md`](../units/README.md):
non-commercial, disclaimer on every page, revocable at any time.

Two things worth noting about fetching rather than saving by hand. The images
are downloaded at thumbnail size rather than full resolution, which is both
smaller to ship and less of the wiki's bandwidth. And every file's origin is
in the manifest, so a takedown request can be answered precisely instead of by
guessing which files came from where.
