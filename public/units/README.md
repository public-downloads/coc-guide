# Unit art

Troops, spells, sieges, pets — one flat namespace, named after the slug guides
already use in `armyComp`. Drop a file in and it appears everywhere that id is
rendered: the guide header, the index rows, the filter chips, and any
`<Army units="…" />` row inside a guide. No registry, no code change.

```
public/units/hog-rider.webp
public/units/freeze-spell.webp
public/units/battle-blimp.webp
public/units/electro-owl.webp
```

Recognised extensions, in priority order: `webp`, `png`, `svg`, `jpg`, `jpeg`,
`avif`.

The id is whatever the guide writes, so `armyComp: [hog-rider]` looks for
`hog-rider.*`. Keep to singular, lowercase, kebab-case — `hog-rider`, not
`hog-riders` or `Hog_Rider`.

## What to supply

- **Square**, with the unit centred. Chips render 20–40 px and the image is
  fitted, not cropped, so a wide image just gets letterboxed.
- **Small.** 128×128 is plenty. These are icons, not hero art, and a page can
  carry a dozen of them.
- **Transparent background** so the chip works in both themes. A baked-in dark
  background disappears into the light theme's card.
- **WebP** — roughly a third of the equivalent PNG.

A unit with no file falls back to a bordered tile with its initials, so a
partial set is fine. `npm run validate:data` prints which ids used by a guide
are still missing art.

## Licensing

This site uses Supercell's unit art under the [Fan Content
Policy](https://supercell.com/en/fan-content-policy/), which grants a limited
licence for non-commercial fan content. That licence is what makes the art here
allowed, and it holds only while all of the following stay true:

- **Non-commercial.** No ads, no subscriptions, no paid tiers. The policy
  permits ad revenue, but taking it would also break Vercel's Hobby terms, so
  the practical answer is none.
- **The disclaimer ships on every page.** It is rendered from
  `components/SiteChrome.tsx` in the policy's own wording, with the link. Do
  not paraphrase it and do not move it to a page nobody visits.
- **No Supercell trademark in the domain** without an agreement with them.
- **Supercell can revoke the licence at any time, for any reason.** Compliant
  today is not a permanent state; keep a route open for takedown requests.

Known grey area: the policy also says not to modify assets without permission,
and the cutouts here are modified — background, level and count stripped, and
re-encoded to WebP. That is the normal state of every fan wiki, and the
alternative reading would forbid resizing an icon at all, but it is the clause
to be aware of.

Drawing or commissioning your own art removes all of the above. It is the only
option that is unambiguously yours.
