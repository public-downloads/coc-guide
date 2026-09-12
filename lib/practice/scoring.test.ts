import { describe, expect, it } from "vitest";
import {
  AURA_CREDIT,
  FOCUS_MULTIPLIER,
  isFocusType,
  scoreLines,
  touchLine,
  type PreparedBuilding,
} from "./scoring";
import type { Segment } from "./geometry";

/**
 * Synthetic weights, as everywhere else in the suite — real ones move with
 * every balance patch and would turn this into a balance tracker. The type
 * *ids* are real, because they are what the focus rule keys on.
 */
function prep(
  id: string,
  typeId: string,
  rect: { x: number; y: number; w: number; h: number },
  weight: number,
  extra: { aura?: number; isDefence?: boolean } = {},
): PreparedBuilding {
  return {
    id,
    typeId,
    rect,
    centre: { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 },
    radius: (Math.max(rect.w, rect.h) * Math.SQRT2) / 2,
    weight,
    aura: extra.aura ?? 0,
    isDefence: extra.isDefence ?? true,
  };
}

const AD = prep("ad", "air-defense", { x: 20, y: 5, w: 3, h: 3 }, 14);
/** Off both of the lines below, so only the aura rule can ever reach it. */
const TOWER = prep("tower", "spell-tower", { x: 30, y: 30, w: 2, h: 2 }, 12, {
  aura: 7,
});
const MONO = prep("mono", "monolith", { x: 20, y: 20, w: 3, h: 3 }, 11);
const STORE = prep("store", "gold-storage", { x: 35, y: 20, w: 3, h: 3 }, 2, {
  isDefence: false,
});

const BOARD = [AD, TOWER, MONO, STORE];
const HALF_WIDTH = 1;

/** Straight down the column both the Air Defense and the Monolith sit in. */
const DOWN: Segment = { a: { x: 21.5, y: 0 }, b: { x: 21.5, y: 47 } };
/** Across the row the Monolith and the storage sit in. */
const ACROSS: Segment = { a: { x: 0, y: 21.5 }, b: { x: 47, y: 21.5 } };
/** Misses everything, but passes inside the Spell Tower's aura. */
const BESIDE: Segment = { a: { x: 25, y: 0 }, b: { x: 25, y: 47 } };

const touch = (segment: Segment) => touchLine(segment, BOARD, HALF_WIDTH);

describe("touchLine", () => {
  it("separates a crossing from an aura clip", () => {
    const down = touch(DOWN);
    expect([...down.hit].sort()).toEqual(["ad", "mono"]);
    expect([...down.aura]).toEqual([]);
  });

  it("counts a near miss on a building with reach", () => {
    const beside = touch(BESIDE);
    expect([...beside.hit]).toEqual([]);
    expect([...beside.aura]).toEqual(["tower"]);
  });

  it("never reports a building as both hit and aura", () => {
    // Straight through the tower itself: crossing beats being nearby.
    const through: Segment = { a: { x: 31, y: 0 }, b: { x: 31, y: 47 } };
    expect(TOWER.aura).toBeGreaterThan(0);
    const result = touchLine(through, BOARD, HALF_WIDTH);
    expect(result.hit.has("tower")).toBe(true);
    expect(result.aura.has("tower")).toBe(false);
  });

  it("ignores aura on a building that has none", () => {
    // Two tiles clear of the Air Defense, which has no reach past its walls.
    const past: Segment = { a: { x: 26, y: 0 }, b: { x: 26, y: 47 } };
    const result = touchLine(past, BOARD, HALF_WIDTH);
    expect(result.hit.has("ad")).toBe(false);
    expect(result.aura.has("ad")).toBe(false);
  });
});

describe("scoreLines — one line", () => {
  it("adds the weight of everything crossed", () => {
    const scored = scoreLines(BOARD, [touch(DOWN)]);
    expect(scored.hitIds.sort()).toEqual(["ad", "mono"]);
    expect(scored.score).toBe(14 + 11);
    expect(scored.defencesHit).toBe(2);
  });

  it("gives an aura clip a fraction of the weight", () => {
    const scored = scoreLines(BOARD, [touch(BESIDE)]);
    expect(scored.hitIds).toEqual([]);
    expect(scored.auraIds).toEqual(["tower"]);
    expect(scored.score).toBe(Math.round(12 * AURA_CREDIT));
  });

  it("does not raise a focus building for a lone hero", () => {
    // One line is one hero, and one hero cannot finish a Monolith.
    const scored = scoreLines(BOARD, [touch(DOWN)]);
    expect(scored.bothIds).toEqual([]);
    expect(scored.score).toBe(14 + 11);
  });
});

describe("scoreLines — the pair", () => {
  const both = () => scoreLines(BOARD, [touch(DOWN), touch(ACROSS)]);

  it("counts a shared building once, not twice", () => {
    // The Monolith is on both lines. Two abilities through it still only
    // remove one Monolith.
    const scored = both();
    expect(scored.hitIds.filter((id) => id === "mono")).toHaveLength(1);
    expect(scored.defencesHit).toBe(2);
  });

  it("reports what both lines crossed", () => {
    expect(both().bothIds).toEqual(["mono"]);
  });

  it("multiplies a focus building crossed by both", () => {
    const scored = both();
    expect(scored.score).toBe(Math.round(14 + 11 * FOCUS_MULTIPLIER + 2));
  });

  it("pays nothing extra when only one line reaches it", () => {
    /*
      One ability into a Monolith is one ability wasted — it survives. Having
      both heroes on the board is not the achievement; landing both on the same
      building is, so this scores exactly what a lone hero would.
    */
    const wide: Segment = { a: { x: 0, y: 43 }, b: { x: 47, y: 43 } };
    const scored = scoreLines(BOARD, [touch(DOWN), touchLine(wide, BOARD, HALF_WIDTH)]);
    const solo = scoreLines(BOARD, [touch(DOWN)]);

    expect(scored.bothIds).toEqual([]);
    expect(scored.auraIds).toEqual([]);
    expect(scored.score).toBe(14 + 11);
    expect(scored.score).toBe(solo.score);
  });

  it("leaves everything that is not a focus building alone", () => {
    // The Air Defense keeps its 14 whether one hero is out or two — the pair
    // rule adds on the Monolith, it never rebalances the rest of the board.
    const solo = scoreLines(BOARD, [touch(DOWN)]);
    const paired = scoreLines(BOARD, [touch(DOWN), touch(DOWN)]);

    expect(solo.score).toBe(14 + 11);
    expect(paired.score).toBe(Math.round(14 + 11 * FOCUS_MULTIPLIER));
  });

  it("does not pay the aura credit twice", () => {
    const scored = scoreLines(BOARD, [touch(BESIDE), touch(BESIDE)]);
    expect(scored.score).toBe(Math.round(12 * AURA_CREDIT));
  });
});

describe("isFocusType", () => {
  it("covers the two defences a single ability cannot finish", () => {
    expect(isFocusType("monolith")).toBe(true);
    expect(isFocusType("revenge-tower")).toBe(true);
  });

  it("is false for everything else", () => {
    expect(isFocusType("air-defense")).toBe(false);
    expect(isFocusType("wall")).toBe(false);
  });
});
