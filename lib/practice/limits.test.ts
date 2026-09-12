import { describe, expect, it } from "vitest";
import { allowanceFor, canPlaceAnother, sourcesUsed } from "./limits";
import type { BuildingType, PlacedBuilding } from "../schema/building";

const TYPES: Record<string, BuildingType> = {
  cannon: {
    id: "cannon",
    name: "Cannon",
    size: 3,
    category: "defence",
    weight: 5,
    availableAt: { "9": 5, "17": 7 },
    maxLevelAt: { "9": 11 },
  },
  // No availability table — an event building we have no data for.
  roaster: {
    id: "roaster",
    name: "Roaster",
    size: 3,
    category: "defence",
    weight: 5,
  },
  "cake-a-pult": {
    id: "cake-a-pult",
    name: "Cake-A-Pult",
    size: 3,
    category: "defence",
    weight: 5,
    crafted: true,
    availableAt: { "11": 1, "17": 1 },
  },
  "hot-candle": {
    id: "hot-candle",
    name: "Hot Candle",
    size: 3,
    category: "defence",
    weight: 5,
    crafted: true,
    availableAt: { "11": 1, "17": 1 },
  },
  "archer-tower": {
    id: "archer-tower",
    name: "Archer Tower",
    size: 3,
    category: "defence",
    weight: 5,
    availableAt: { "17": 9 },
  },
  // The three merge shapes: a pair of one type, and one of each.
  "ricochet-cannon": {
    id: "ricochet-cannon",
    name: "Ricochet Cannon",
    size: 3,
    category: "defence",
    weight: 8,
    mergedFrom: { cannon: 2 },
    availableAt: { "17": 3 },
  },
  "multi-archer-tower": {
    id: "multi-archer-tower",
    name: "Multi-Archer Tower",
    size: 3,
    category: "defence",
    weight: 6,
    mergedFrom: { "archer-tower": 2 },
    availableAt: { "17": 3 },
  },
  "multi-gear-tower": {
    id: "multi-gear-tower",
    name: "Multi-Gear Tower",
    size: 3,
    category: "defence",
    weight: 8,
    mergedFrom: { cannon: 1, "archer-tower": 1 },
    availableAt: { "17": 1 },
  },
};
const lookup = (id: string) => TYPES[id];

const place = (typeId: string, n: number): PlacedBuilding[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${typeId}-${i}`,
    typeId,
    x: i * 4,
    y: 0,
  }));

describe("per-type counts", () => {
  it("counts down as buildings are placed", () => {
    expect(allowanceFor(TYPES.cannon, place("cannon", 2), lookup, 9)).toEqual({
      used: 2,
      max: 5,
      remaining: 3,
      limitedBy: "count",
    });
  });

  it("stops at the Town Hall's limit", () => {
    const full = place("cannon", 5);
    expect(canPlaceAnother(TYPES.cannon, full, lookup, 9)).toBe(false);
    expect(allowanceFor(TYPES.cannon, full, lookup, 9).remaining).toBe(0);
  });

  it("allows more at a higher Town Hall", () => {
    const full = place("cannon", 5);
    expect(canPlaceAnother(TYPES.cannon, full, lookup, 17)).toBe(true);
  });

  it("never goes negative if a layout is over the limit", () => {
    const over = place("cannon", 9);
    expect(allowanceFor(TYPES.cannon, over, lookup, 9).remaining).toBe(0);
  });

  it("does not count other building types", () => {
    expect(
      allowanceFor(TYPES.cannon, place("roaster", 4), lookup, 9).used,
    ).toBe(0);
  });

  it("is unlimited when the type has no availability data", () => {
    const allowance = allowanceFor(TYPES.roaster, place("roaster", 12), lookup, 9);
    expect(allowance.max).toBeNull();
    expect(allowance.remaining).toBeNull();
    expect(canPlaceAnother(TYPES.roaster, place("roaster", 12), lookup, 9)).toBe(
      true,
    );
  });
});

describe("crafted defences share one slot", () => {
  it("allows the first crafted defence", () => {
    expect(canPlaceAnother(TYPES["cake-a-pult"], [], lookup, 17)).toBe(true);
  });

  it("blocks a second crafted defence of the same type", () => {
    const one = place("cake-a-pult", 1);
    expect(canPlaceAnother(TYPES["cake-a-pult"], one, lookup, 17)).toBe(false);
  });

  it("blocks a different crafted defence too — they share the budget", () => {
    const one = place("cake-a-pult", 1);
    const allowance = allowanceFor(TYPES["hot-candle"], one, lookup, 17);

    expect(allowance.limitedBy).toBe("crafted");
    expect(allowance.remaining).toBe(0);
    expect(canPlaceAnother(TYPES["hot-candle"], one, lookup, 17)).toBe(false);
  });

  it("does not restrict ordinary defences", () => {
    const one = place("cake-a-pult", 1);
    expect(canPlaceAnother(TYPES.cannon, one, lookup, 17)).toBe(true);
  });

  it("reports the crafted rule as the binding one", () => {
    expect(allowanceFor(TYPES["cake-a-pult"], [], lookup, 17).limitedBy).toBe(
      "crafted",
    );
  });
});

describe("merged defences", () => {
  /** The mix on a real Town Hall 18 village: no plain Cannons left at all. */
  const merged = [
    ...place("ricochet-cannon", 3),
    ...place("multi-gear-tower", 1),
  ];

  it("counts a merge against the buildings it ate", () => {
    // 3 Ricochet Cannons is 6 Cannons, and the Multi-Gear Tower is a seventh.
    expect(sourcesUsed("cannon", merged, lookup)).toBe(7);
    // The Multi-Gear Tower also took one Archer Tower.
    expect(sourcesUsed("archer-tower", merged, lookup)).toBe(1);
  });

  it("shows an ordinary defence as spent even with none standing", () => {
    const allowance = allowanceFor(TYPES.cannon, merged, lookup, 17);
    expect(allowance.used).toBe(7);
    expect(allowance.max).toBe(7);
    expect(allowance.remaining).toBe(0);
  });

  it("blocks a merge once its sources run out", () => {
    // Two Ricochet Cannons is four Cannons; three remain, so one more fits.
    const two = place("ricochet-cannon", 2);
    expect(canPlaceAnother(TYPES["ricochet-cannon"], two, lookup, 17)).toBe(true);

    // Six Cannons standing leaves one — not enough for a pair.
    const spent = [...two, ...place("cannon", 3)];
    const allowance = allowanceFor(TYPES["ricochet-cannon"], spent, lookup, 17);
    expect(allowance.remaining).toBe(0);
    expect(allowance.limitedBy).toBe("merge");
    expect(allowance.spentOn).toBe("cannon");
  });

  it("rounds down: a merge needs the whole recipe, not part of it", () => {
    // Five of seven Cannons gone leaves two — exactly one pair.
    const spent = place("cannon", 5);
    expect(allowanceFor(TYPES["ricochet-cannon"], spent, lookup, 17).remaining).toBe(1);

    // Six gone leaves one, which buys nothing.
    expect(
      allowanceFor(TYPES["ricochet-cannon"], place("cannon", 6), lookup, 17)
        .remaining,
    ).toBe(0);
  });

  it("takes the scarcer ingredient when a merge needs two kinds", () => {
    // Every Archer Tower is gone but Cannons remain: the Multi-Gear Tower
    // still cannot be built, and the message has to name the one that ran out.
    const spent = place("archer-tower", 9);
    const allowance = allowanceFor(TYPES["multi-gear-tower"], spent, lookup, 17);
    expect(allowance.remaining).toBe(0);
    expect(allowance.spentOn).toBe("archer-tower");
  });

  it("still respects the merge's own Town Hall count", () => {
    // Cannons would allow a fourth Ricochet Cannon; the cap of 3 does not.
    const three = place("ricochet-cannon", 3);
    const allowance = allowanceFor(TYPES["ricochet-cannon"], three, lookup, 17);
    expect(allowance.remaining).toBe(0);
    expect(allowance.limitedBy).toBe("count");
  });

  it("leaves a village with no merges exactly as it was", () => {
    const plain = place("cannon", 2);
    const allowance = allowanceFor(TYPES.cannon, plain, lookup, 17);
    expect(allowance.used).toBe(2);
    expect(allowance.remaining).toBe(5);
    expect(allowance.limitedBy).toBe("count");
  });
});
