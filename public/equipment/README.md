# Hero equipment art

Drop-in, same as `public/units/`. The filename is the equipment's `id` — the
`id` field in `data/equipment/<hero>/<id>.json`, which is also its URL:

```
public/equipment/frozen-arrow.webp
public/equipment/giant-gauntlet.webp
```

Recognised extensions, in priority order: `webp`, `png`, `svg`, `jpg`, `jpeg`,
`avif`. A piece with no file here renders an initials tile, so a partial set is
fine; `npm run validate:data` lists what is missing.

These render small — 28 px in the equipment index, 40 px on a piece's own page.
100×100 is plenty. Transparent background, so both themes work.

Licensing: see [`../units/README.md`](../units/README.md). Same position, same
conditions.
