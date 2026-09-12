import { describe, expect, it } from "vitest";
import {
  ISO_RATIO,
  ISO_SIZE_SCALE,
  ISO_SPRITE_LIFT,
  ISO_SPRITE_OVERHANG,
  ISO_SPRITE_RISE,
  ISO_TILE_H,
  ISO_TILE_W,
  fromIso,
  isoDepth,
  isoExtent,
  isoSprite,
  sortByDepth,
  toIso,
} from "./iso";
import type { Footprint } from "./placement";

const at = (x: number, y: number, size = 1): Footprint => ({ x, y, size });

describe("the projection's angle", () => {
  it("looks down more steeply than a textbook 2:1", () => {
    /*
      Clash is not classic isometric. Its war map measures about 1360 across
      by 930 tall, ~1.47:1; at 2:1 the board reads as a flatter, more side-on
      view than the game. Pinned so the ratio cannot drift back to the
      textbook number without this failing.
    */
    expect(ISO_RATIO).toBeGreaterThan(1.35);
    expect(ISO_RATIO).toBeLessThan(1.6);
  });
});

describe("toIso", () => {
  it("puts the origin at the top of the diamond", () => {
    expect(toIso(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it("sends x down-right and y down-left", () => {
    expect(toIso(1, 0)).toEqual({ x: ISO_TILE_W / 2, y: ISO_TILE_H / 2 });
    expect(toIso(0, 1)).toEqual({ x: -ISO_TILE_W / 2, y: ISO_TILE_H / 2 });
  });

  it("keeps the diagonal on the vertical centre line", () => {
    // Equal x and y is straight down the middle of the diamond, whatever the
    // tile ratio is — the property the whole projection hangs on.
    for (const n of [1, 5, 23, 47]) expect(toIso(n, n).x).toBe(0);
  });
});

describe("fromIso", () => {
  it("is the exact inverse of toIso", () => {
    // This is what makes the board clickable: a pointer lands in projected
    // space and every placement rule expects tile space.
    for (const [x, y] of [[0, 0], [3, 9], [46, 2], [23.5, 23.5], [47, 47]]) {
      const p = toIso(x, y);
      const back = fromIso(p.x, p.y);
      expect(back.x).toBeCloseTo(x, 10);
      expect(back.y).toBeCloseTo(y, 10);
    }
  });
});

describe("isoExtent", () => {
  it("keeps the board's shape at the tile ratio", () => {
    const box = isoExtent(47);
    expect(box.width / box.height).toBe(ISO_RATIO);
  });

  it("adds headroom above the back corner for tall buildings", () => {
    const box = isoExtent(47, 6);
    expect(box.minY).toBe(-6);
    expect(box.height).toBe(47 * ISO_TILE_H + 6);
  });

  it("spans the full diamond horizontally", () => {
    const box = isoExtent(10);
    // The left point is tile (0,10) and the right point tile (10,0).
    expect(box.minX).toBe(toIso(0, 10).x);
    expect(box.minX + box.width).toBe(toIso(10, 0).x);
  });
});

describe("isoDepth", () => {
  it("orders a small building in front of a bigger one beside it", () => {
    /*
      The case that rules out sorting by origin: by origin sum the 4x4 (6)
      comes before the 1x1 (8), but the 4x4 is nearer the viewer and has to be
      painted last or it gets covered by the thing behind it.
    */
    const big = at(3, 3, 4);
    const small = at(6, 2, 1);
    expect(isoDepth(big)).toBeGreaterThan(isoDepth(small));
  });

  it("sorts back to front", () => {
    const items = [at(9, 9), at(0, 0), at(4, 4)];
    expect(sortByDepth(items, (f) => f).map((f) => f.x)).toEqual([0, 4, 9]);
  });

  it("is stable for equal depths", () => {
    // Two tiles on the same diagonal overlap nothing, so the order they were
    // given in is as good as any and must not wobble between renders.
    const a = { ...at(2, 6), tag: "a" };
    const b = { ...at(6, 2), tag: "b" };
    expect(sortByDepth([a, b], (f) => f).map((f) => f.tag)).toEqual(["a", "b"]);
  });
});

describe("isoSprite", () => {
  it("draws a building at about its own footprint", () => {
    // Within a few percent either way — enough that a 3x3 reads as covering
    // three tiles, which is what makes a base legible and a shot line
    // possible to judge against.
    const width = isoSprite(at(0, 0, 3), 1).width;
    expect(width).toBeCloseTo(3 * ISO_TILE_W * ISO_SPRITE_OVERHANG, 10);
    expect(width / (3 * ISO_TILE_W)).toBeGreaterThan(0.9);
    expect(width / (3 * ISO_TILE_W)).toBeLessThan(1.1);
    // Proportional to the footprint, except where a size class carries its
    // own correction — 1 and 3 both do not, so a 3x3 is exactly three 1x1s.
    expect(isoSprite(at(0, 0, 3), 1).width / isoSprite(at(0, 0, 1), 1).width).toBe(3);
  });

  it("lets a whole size class be nudged without touching the others", () => {
    // 2x2 buildings read small beside their neighbours, so the class gets a
    // scale of its own; nothing else is affected by it.
    const two = isoSprite(at(0, 0, 2), 1).width / (2 * ISO_TILE_W * ISO_SPRITE_OVERHANG);
    const four = isoSprite(at(0, 0, 4), 1).width / (4 * ISO_TILE_W * ISO_SPRITE_OVERHANG);
    expect(two).toBeCloseTo(ISO_SIZE_SCALE[2], 10);
    expect(four).toBeCloseTo(1, 10);
  });

  it("compresses a render's height into this board's flatter camera", () => {
    /*
      The wiki's art is drawn more side-on than the game's own view, so its
      raw height makes buildings stand too tall and spill over the walls they
      should sit behind. Squashing is the only correction available: a flat
      image carries no depth to reproject from.
    */
    const box = isoSprite(at(0, 0, 1), 1);
    expect(box.height).toBeLessThan(box.width);
    expect(box.height / box.width).toBeCloseTo(ISO_SPRITE_RISE, 10);
  });

  it("sits just above its plot's front corner, by the same gap at any size", () => {
    /*
      The gap has to be the same for a wall as for a Town Hall. Expressed as a
      fraction of the footprint it would be eight times larger on the 4x4, and
      then either the small buildings sit right and the big ones float or the
      reverse — which is exactly what a fraction produced.
    */
    for (const size of [1, 2, 3, 4]) {
      const box = isoSprite(at(6, 6, size), 1);
      const frontCorner = toIso(6 + size, 6 + size).y;
      expect(frontCorner - (box.y + box.height)).toBeCloseTo(ISO_SPRITE_LIFT, 10);
    }
  });

  it("stands on its tile rather than floating over it", () => {
    // A taller sprite must grow upwards: its base stays put while the top
    // rises, or a big building would sink into the ground.
    const short = isoSprite(at(5, 5, 2), 2);
    const tall = isoSprite(at(5, 5, 2), 0.5);
    expect(tall.height).toBeGreaterThan(short.height);
    expect(tall.y + tall.height).toBeCloseTo(short.y + short.height, 10);
  });

  it("centres on the footprint", () => {
    const box = isoSprite(at(4, 4, 2), 1.2);
    expect(box.x + box.width / 2).toBeCloseTo(toIso(5, 5).x, 10);
  });
});
