# Building art

> This directory is the **flat** board's art: square tiles drawn edge to edge.
> The 2.5D board uses `public/buildings-iso/` instead, which holds isometric
> renders and has its own README — the two are different shapes and are not
> interchangeable.


Drop an image here named after the building's type id and the trainer picks it
up automatically — no code change, no config. The id is the `id` field in
`data/buildings.json`, e.g.:

```
public/buildings/town-hall.png
public/buildings/air-defense.webp
public/buildings/x-bow.svg
```

Recognised extensions, in priority order: `webp`, `png`, `svg`, `jpg`, `jpeg`,
`avif`.

## What to supply

- **Square.** Buildings are square footprints and the image is drawn edge to
  edge with `xMidYMid slice`, so a non-square image gets cropped.
- **Small.** These render at roughly 20–90 px on screen. 128×128 is plenty;
  256×256 is the most worth shipping. A 1 MB render of a Town Hall is 1 MB the
  visitor downloads for a 60 px square.
- **Transparent background** (`webp`/`png`/`svg`) so the tile grid stays
  visible behind it.
- **WebP** is the best default: roughly a third the size of an equivalent PNG.
  Use SVG if the art is vector.

A type with no image here falls back to the built-in geometric glyph in
`components/practice/glyphs.tsx`, so a partial set is fine — fill them in as
you go.

## Licensing

Same position as the unit art — see [`public/units/README.md`](../units/README.md)
for the conditions the Fan Content Policy attaches. Short version: allowed
while the site stays non-commercial and carries the disclaimer, and revocable
by Supercell at any time.

The built-in glyphs are not a licensing hedge, they are the fallback. A type
with no image here still renders, which is what makes filling this directory
in over time painless.
