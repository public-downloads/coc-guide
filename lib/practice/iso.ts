import type { BuildingType } from "../schema/building";
import { BOARD_SIZE } from "../schema/building";
import type { Footprint } from "./placement";

/**
 * The isometric projection for the 2.5D board.
 *
 * Kept pure and apart from the component for the same reason `shot.ts` is:
 * the maths is the part that breaks, and it is worth testing without a DOM.
 * Nothing here knows about sprites — the same projection places a downloaded
 * render and the drawn box that stands in for a missing one.
 *
 * Tile space is unchanged. Every stored coordinate is still the axis-aligned
 * (x, y) the flat board uses; this only decides where that lands on screen.
 */

/**
 * One tile's width and height in projected units.
 *
 * Not the textbook 2:1. Clash looks down at the village more steeply than
 * that: measured off a war-map screenshot, its diamond is about 1360 across
 * and 930 tall, a ratio near 1.47:1. At 2:1 the board reads as a much flatter,
 * more side-on view than the game, which is what "a bit more top down" is
 * describing.
 *
 * Held as a width/height pair rather than an angle because every other number
 * here derives from them, and an angle would only have to be turned back into
 * exactly this pair.
 */
export const ISO_TILE_W = 2;
export const ISO_TILE_H = 1.36;

/** Width over height of the projected board. 1 would be straight down. */
export const ISO_RATIO = ISO_TILE_W / ISO_TILE_H;

/**
 * How far a building's art spills past the footprint it stands on.
 *
 * Barely. A render includes a little skirt of ground under the building, so
 * drawing it at exactly footprint width leaves a hairline of grass showing
 * on every side; a few percent closes that without the art starting to cover
 * its neighbours.
 *
 * Resist raising this. It was 1.35 for a while, from measuring a Town Hall's
 * decorative platform rather than its footprint, and on a sparse practice base
 * that looked fine — but a real TH17 layout has a building every few tiles,
 * and at 1.35 they overlapped into a pile with the wall lattice buried
 * underneath. The game's buildings sit *on* their tiles with grass between
 * them, which is what makes a base readable at a glance.
 *
 * A calibration against a screenshot, not a game constant — which is exactly
 * why it is one named number here rather than sprinkled through the renderer.
 */
export const ISO_SPRITE_OVERHANG = 0.96;

/**
 * How much of a render's height survives being put on this board.
 *
 * The wiki's renders are drawn from a more side-on camera than the game's own,
 * so they are taller than the game draws the same building. Left at 1 a wall
 * stands 1.34 tiles high against the roughly 0.8 the game shows, and a 3x3
 * storage 3.57 against 2.5 — which is what made the base look bulky and made
 * buildings spill across walls they should sit behind.
 *
 * Compressing height is the honest correction: the art carries no depth
 * information to reproject properly, and the alternative — shrinking the
 * sprite as a whole — makes footprints too small to line a shot up against.
 */
export const ISO_SPRITE_RISE = 0.78;

/**
 * Per-type corrections on top of the two global ones.
 *
 * The renders are not drawn to a common scale — each is framed to look good on
 * its own wiki page, so a tall tower fills its image edge to edge while a
 * squat one sits in a lot of empty space. Cropping to the opaque pixels would
 * fix the framing but not the framing *intent*: a Wizard Tower render is
 * simply drawn bigger relative to its footprint than an Inferno Tower's.
 *
 * So these are judged against the game, one building at a time, and only for
 * the ones that are visibly off. Anything absent renders at 1.
 */
export const ISO_SPRITE_SCALE: Record<string, number> = {
  "air-defense": 0.82,
  "bomb-tower": 0.78,
  "wizard-tower": 0.82,
  "elixir-collector": 0.94,
  "dark-elixir-drill": 0.9,
  "inferno-tower": 1.12,
  "clan-castle": 1.12,
  firespitter: 1.12,
  monolith: 1.12,
  "ricochet-cannon": 1.12,
  "hero-hunter": 1.12,
  "super-wizard-tower": 1.12,
};

/**
 * A scale for every building of a given footprint.
 *
 * Separate from the per-type map because the reason is different: this is the
 * whole size class reading small against its neighbours, not one render being
 * framed oddly. A per-type entry multiplies on top of it.
 */
export const ISO_SIZE_SCALE: Record<number, number> = {
  2: 1.1,
};

/**
 * Extra lift for a type whose render sits low in its own image, in board
 * units, on top of `ISO_SPRITE_LIFT`.
 *
 * Some renders include more ground under the building than others, which
 * leaves that building looking sunk into its plot while everything around it
 * sits right. Nudging one type is the smallest fix that does not disturb the
 * rest.
 */
export const ISO_SPRITE_NUDGE: Record<string, number> = {
  "elixir-collector": 0.3,
};

/**
 * How far a sprite's base is lifted off the front corner of its plot, in board
 * units. A building sits just above that corner, not on it.
 *
 * An absolute offset rather than a fraction of the footprint, and that is the
 * whole point: a fraction lifts a 4x4 eight times as far as a wall, so either
 * the small buildings sit right and the big ones float, or the reverse. The
 * gap wanted here is a constant few pixels whatever the building is.
 */
export const ISO_SPRITE_LIFT = 0.4;

export interface IsoPoint {
  x: number;
  y: number;
}

/**
 * Tile (x, y) -> the point it projects to, before the board is centred.
 *
 * x runs down-right and y runs down-left, so the origin tile is the top of
 * the diamond and (BOARD_SIZE, BOARD_SIZE) is the bottom.
 */
export function toIso(x: number, y: number): IsoPoint {
  return {
    x: (x - y) * (ISO_TILE_W / 2),
    y: (x + y) * (ISO_TILE_H / 2),
  };
}

/**
 * The inverse — a projected point back to the tile under it. This is what
 * makes the board clickable: a pointer arrives in projected space and every
 * placement rule expects tile space.
 */
export function fromIso(x: number, y: number): IsoPoint {
  const a = x / (ISO_TILE_W / 2);
  const b = y / (ISO_TILE_H / 2);
  return { x: (b + a) / 2, y: (b - a) / 2 };
}

/**
 * The viewBox a board of `size` tiles needs.
 *
 * `top` is extra headroom above the back corner: buildings are drawn standing
 * up from their tile, so the tallest one at the far corner would be clipped
 * without it.
 */
export function isoExtent(size: number = BOARD_SIZE, top = 0) {
  return {
    // The diamond is `size` tiles wide on each of two axes, meeting at the
    // left and right points.
    minX: -size * (ISO_TILE_W / 2),
    minY: -top,
    width: size * ISO_TILE_W,
    height: size * ISO_TILE_H + top,
  };
}

/**
 * How tall each category stands, in tile heights.
 *
 * A presentation choice, not game data: `data/buildings.json` has footprints
 * and levels but no heights, and inventing a height field there would be
 * inventing a stat. These are only what makes a wall read as low and a Town
 * Hall as tall, and they are only used for the drawn fallback — a real sprite
 * carries its own height in the image.
 */
export const ISO_HEIGHT: Record<BuildingType["category"], number> = {
  wall: 0.55,
  resource: 1.3,
  army: 1.3,
  other: 1.2,
  defence: 1.7,
  core: 2.2,
};

/**
 * Painter's algorithm: draw back to front, so a nearer building covers what
 * is behind it.
 *
 * The key is the footprint's *centre*, not its origin. Origin alone gets a
 * big building wrong against a small one beside it — a 4x4 at (3,3) sorts
 * before a 1x1 at (6,2) by origin sum, but the 4x4 is nearer the viewer and
 * has to be drawn after it.
 */
export function isoDepth(f: Footprint): number {
  return f.x + f.size / 2 + (f.y + f.size / 2);
}

/** Back to front. Stable, so equal depths keep the order they came in. */
export function sortByDepth<T>(items: T[], footprint: (item: T) => Footprint): T[] {
  return [...items].sort((a, b) => isoDepth(footprint(a)) - isoDepth(footprint(b)));
}

/**
 * The four corners of a footprint's ground diamond, as an SVG points string.
 * Used for the tile itself and for the top face of a drawn building.
 */
export function isoFace(f: Footprint, lift = 0): string {
  const corners: Array<[number, number]> = [
    [f.x, f.y],
    [f.x + f.size, f.y],
    [f.x + f.size, f.y + f.size],
    [f.x, f.y + f.size],
  ];
  return corners
    .map(([x, y]) => {
      const p = toIso(x, y);
      return `${p.x},${p.y - lift}`;
    })
    .join(" ");
}

/**
 * The two visible side faces of a box standing `height` tall on `f`, as SVG
 * point strings. Only the right and front faces can be seen from this angle;
 * the other two are always hidden, so drawing them would be four extra nodes
 * per building for nothing.
 */
export function isoSides(f: Footprint, height: number): { right: string; front: string } {
  const lift = height * ISO_TILE_H;
  const east = toIso(f.x + f.size, f.y);
  const south = toIso(f.x + f.size, f.y + f.size);
  const west = toIso(f.x, f.y + f.size);

  return {
    right: [
      `${east.x},${east.y - lift}`,
      `${south.x},${south.y - lift}`,
      `${south.x},${south.y}`,
      `${east.x},${east.y}`,
    ].join(" "),
    front: [
      `${south.x},${south.y - lift}`,
      `${west.x},${west.y - lift}`,
      `${west.x},${west.y}`,
      `${south.x},${south.y}`,
    ].join(" "),
  };
}

/**
 * Where a sprite sits: its bottom edge centred on the footprint's ground
 * centre, scaled so the art spans the footprint's full projected width.
 *
 * Anchoring to the bottom centre rather than the middle is what makes a
 * building stand on its tile instead of floating over it, and it is the one
 * convention an isometric render can be relied on to follow.
 */
export function isoSprite(f: Footprint, aspect: number, scale = 1, nudge = 0) {
  const width =
    f.size *
    ISO_TILE_W *
    ISO_SPRITE_OVERHANG *
    (ISO_SIZE_SCALE[f.size] ?? 1) *
    scale;
  const height = (width / aspect) * ISO_SPRITE_RISE;
  const centre = toIso(f.x + f.size / 2, f.y + f.size / 2);
  return {
    x: centre.x - width / 2,
    /*
      The sprite hangs above its ground point, growing upward from it rather
      than around its middle — a building that got taller when it got wider
      would lift off its tile. That ground point is the plot's front corner,
      raised by `ISO_SPRITE_LIFT` so the building sits just above the corner
      rather than balanced on it.
    */
    y: centre.y - height + (f.size * ISO_TILE_H) / 2 - ISO_SPRITE_LIFT - nudge,
    width,
    height,
  };
}
