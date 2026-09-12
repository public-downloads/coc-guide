import { describe, expect, it } from "vitest";
import {
  blockingBuildings,
  canUnitStandAt,
  exclusionRuns,
  checkPlacement,
  isInsideVillage,
  overlapViolations,
  overlaps,
  nearestLegalStand,
  pushOutOfBuildings,
  snapFootprint,
  tileCentre,
  UNIT_CLEARANCE,
} from "./placement";
import {
  BOARD_OFFSET,
  BOARD_SIZE,
  VILLAGE_SIZE,
  type BuildingType,
  type PlacedBuilding,
} from "../schema/building";

const TYPES: Record<string, BuildingType> = {
  cannon: {
    id: "cannon",
    name: "Cannon",
    size: 3,
    category: "defence",
    weight: 5,
  },
  "town-hall": {
    id: "town-hall",
    name: "Town Hall",
    size: 4,
    category: "core",
    weight: 10,
  },
  wall: { id: "wall", name: "Wall", size: 1, category: "wall", weight: 1 },
};
const lookup = (id: string) => TYPES[id];

describe("the board", () => {
  it("wraps the village in a 3-tile deploy border on every side", () => {
    expect(BOARD_OFFSET).toBe(3);
    expect(BOARD_SIZE).toBe(VILLAGE_SIZE + 6);
    expect(BOARD_SIZE).toBe(50);
  });
});

describe("snapFootprint", () => {
  it("snaps to whole tiles and centres on the cursor", () => {
    // Board (13, 13) is village (10, 10); a 3-wide building centred there
    // starts at (8.5, 8.5), rounded to (9, 9).
    expect(snapFootprint({ x: 13, y: 13 }, 3)).toEqual({ x: 9, y: 9, size: 3 });
  });

  it("always lands on integers", () => {
    const f = snapFootprint({ x: 7.31, y: 19.87 }, 4);
    expect(Number.isInteger(f.x)).toBe(true);
    expect(Number.isInteger(f.y)).toBe(true);
  });

  it("clamps a footprint dragged past the village edge", () => {
    expect(snapFootprint({ x: 999, y: 999 }, 4)).toEqual({
      x: VILLAGE_SIZE - 4,
      y: VILLAGE_SIZE - 4,
      size: 4,
    });
    expect(snapFootprint({ x: -50, y: -50 }, 3)).toEqual({
      x: 0,
      y: 0,
      size: 3,
    });
  });
});

describe("overlaps — buildings may touch", () => {
  const a = { x: 10, y: 10, size: 3 }; // tiles 10..12

  it("allows two buildings flush against each other", () => {
    expect(overlaps(a, { x: 13, y: 10, size: 3 })).toBe(false);
  });

  it("allows a wall hugging a building", () => {
    expect(overlaps(a, { x: 13, y: 12, size: 1 })).toBe(false);
  });

  it("rejects a shared tile", () => {
    expect(overlaps(a, { x: 12, y: 10, size: 3 })).toBe(true);
  });

  it("rejects one fully inside another", () => {
    expect(overlaps(a, { x: 11, y: 11, size: 1 })).toBe(true);
  });
});

describe("checkPlacement", () => {
  const existing: PlacedBuilding[] = [
    { id: "a", typeId: "cannon", x: 10, y: 10 },
    { id: "b", typeId: "town-hall", x: 20, y: 20 },
  ];

  it("accepts a spot directly against another building", () => {
    expect(checkPlacement({ x: 13, y: 10, size: 3 }, existing, lookup)).toEqual({
      ok: true,
      blockedBy: [],
      reason: null,
    });
  });

  it("rejects an overlap and says which building", () => {
    const result = checkPlacement({ x: 12, y: 10, size: 3 }, existing, lookup);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("overlap");
    expect(result.blockedBy).toEqual(["a"]);
  });

  it("rejects a spot outside the village", () => {
    expect(
      checkPlacement({ x: VILLAGE_SIZE - 1, y: 0, size: 3 }, existing, lookup)
        .reason,
    ).toBe("outside");
  });

  it("ignores the building being moved", () => {
    expect(
      checkPlacement({ x: 10, y: 10, size: 3 }, existing, lookup, "a").ok,
    ).toBe(true);
  });
});

describe("overlapViolations", () => {
  it("accepts a tightly packed but legal layout", () => {
    const packed: PlacedBuilding[] = [
      { id: "a", typeId: "cannon", x: 0, y: 0 },
      { id: "b", typeId: "cannon", x: 3, y: 0 },
      { id: "c", typeId: "wall", x: 6, y: 0 },
    ];
    expect(overlapViolations(packed, lookup)).toEqual([]);
  });

  it("reports the offending pair by index", () => {
    const bad: PlacedBuilding[] = [
      { id: "a", typeId: "cannon", x: 0, y: 0 },
      { id: "b", typeId: "cannon", x: 2, y: 0 },
    ];
    expect(overlapViolations(bad, lookup)).toEqual([{ a: 0, b: 1 }]);
  });
});

describe("unit clearance", () => {
  // Village (10,10) size 3 -> board tiles 13..16.
  const buildings: PlacedBuilding[] = [
    { id: "a", typeId: "cannon", x: 10, y: 10 },
  ];

  it("keeps a unit one tile clear of a building", () => {
    expect(UNIT_CLEARANCE).toBe(1);
    expect(canUnitStandAt({ x: 12.5, y: 14 }, buildings, lookup)).toBe(false);
    expect(canUnitStandAt({ x: 12, y: 14 }, buildings, lookup)).toBe(true);
  });

  it("blocks standing inside a building", () => {
    expect(canUnitStandAt({ x: 14, y: 14 }, buildings, lookup)).toBe(false);
  });

  it("allows standing well away", () => {
    expect(canUnitStandAt({ x: 40, y: 40 }, buildings, lookup)).toBe(true);
  });

  it("names what is blocking", () => {
    expect(blockingBuildings({ x: 14, y: 14 }, buildings, lookup)).toEqual([
      "a",
    ]);
  });

  it("extends the exclusion zone across the village boundary", () => {
    // A building flush with the village edge sits at board x 3..6, so board
    // x 2.5 is in the deploy border and still blocked.
    const edge: PlacedBuilding[] = [{ id: "e", typeId: "cannon", x: 0, y: 0 }];
    expect(canUnitStandAt({ x: 2.5, y: 4 }, edge, lookup)).toBe(false);
    expect(canUnitStandAt({ x: 2, y: 4 }, edge, lookup)).toBe(true);
  });

  it("rejects a point off the board", () => {
    expect(canUnitStandAt({ x: -1, y: 10 }, [], lookup)).toBe(false);
    expect(canUnitStandAt({ x: BOARD_SIZE + 1, y: 10 }, [], lookup)).toBe(false);
  });
});

describe("pushOutOfBuildings", () => {
  const buildings: PlacedBuilding[] = [
    { id: "a", typeId: "cannon", x: 10, y: 10 },
  ];

  it("leaves a legal point alone", () => {
    const p = { x: 40, y: 40 };
    expect(pushOutOfBuildings(p, buildings, lookup)).toEqual(p);
  });

  it("nudges a point out of the exclusion zone", () => {
    const pushed = pushOutOfBuildings({ x: 14, y: 14 }, buildings, lookup);
    expect(canUnitStandAt(pushed, buildings, lookup)).toBe(true);
  });

  it("takes the shortest way out", () => {
    // Just inside the left edge of the zone, so it should exit leftwards.
    const pushed = pushOutOfBuildings({ x: 12.6, y: 14.5 }, buildings, lookup);
    expect(pushed.x).toBeCloseTo(12, 5);
    expect(pushed.y).toBeCloseTo(14.5, 5);
  });

  it("settles between two buildings rather than looping", () => {
    const pair: PlacedBuilding[] = [
      { id: "a", typeId: "cannon", x: 10, y: 10 },
      { id: "b", typeId: "cannon", x: 16, y: 10 },
    ];
    const pushed = pushOutOfBuildings({ x: 16, y: 14 }, pair, lookup);
    expect(pushed.x).toBeGreaterThanOrEqual(0);
    expect(pushed.y).toBeGreaterThanOrEqual(0);
  });

  it("keeps the result on the board", () => {
    const corner: PlacedBuilding[] = [{ id: "c", typeId: "cannon", x: 0, y: 0 }];
    const pushed = pushOutOfBuildings({ x: 4, y: 4 }, corner, lookup);
    expect(pushed.x).toBeGreaterThanOrEqual(0);
    expect(pushed.y).toBeGreaterThanOrEqual(0);
    expect(pushed.x).toBeLessThanOrEqual(BOARD_SIZE);
  });
});

describe("isInsideVillage", () => {
  it("accepts a footprint flush with the edge", () => {
    expect(isInsideVillage({ x: 0, y: VILLAGE_SIZE - 3, size: 3 })).toBe(true);
  });

  it("rejects one hanging over the edge", () => {
    expect(isInsideVillage({ x: VILLAGE_SIZE - 2, y: 0, size: 3 })).toBe(false);
  });
});

describe("exclusionRuns", () => {
  const runsFor = (buildings: PlacedBuilding[]) =>
    exclusionRuns(buildings, lookup);

  it("is empty with no buildings", () => {
    expect(runsFor([])).toEqual([]);
  });

  it("rings a building by one tile on every side", () => {
    // Village (10,10) size 3 -> board 13..15, so the zone spans 12..16.
    const runs = runsFor([{ id: "a", typeId: "cannon", x: 10, y: 10 }]);

    expect(runs).toHaveLength(5);
    for (const run of runs) {
      expect(run.x).toBe(12);
      expect(run.width).toBe(5);
    }
    expect(runs.map((r) => r.y)).toEqual([12, 13, 14, 15, 16]);
  });

  it("merges overlapping zones into one run per row", () => {
    // Two cannons flush against each other: one continuous band, not two.
    const runs = runsFor([
      { id: "a", typeId: "cannon", x: 10, y: 10 },
      { id: "b", typeId: "cannon", x: 13, y: 10 },
    ]);

    expect(runs).toHaveLength(5);
    for (const run of runs) {
      expect(run.x).toBe(12);
      expect(run.width).toBe(8);
    }
  });

  it("bridges a two-tile gap between buildings", () => {
    // Gap of exactly two tiles: each ring covers one, so they meet.
    const runs = runsFor([
      { id: "a", typeId: "cannon", x: 10, y: 10 },
      { id: "b", typeId: "cannon", x: 15, y: 10 },
    ]);

    expect(runs.every((r) => r.width === 10)).toBe(true);
  });

  it("leaves a genuine gap unbridged", () => {
    // Four tiles apart: the rings do not touch, so the row splits in two.
    const middle = runsFor([
      { id: "a", typeId: "cannon", x: 10, y: 10 },
      { id: "b", typeId: "cannon", x: 17, y: 10 },
    ]).filter((r) => r.y === 14);

    expect(middle).toHaveLength(2);
  });

  it("clamps to the board rather than running off it", () => {
    const runs = runsFor([{ id: "a", typeId: "cannon", x: 0, y: 0 }]);
    expect(runs.every((r) => r.x >= 0 && r.x + r.width <= BOARD_SIZE)).toBe(
      true,
    );
    expect(runs.every((r) => r.y >= 0)).toBe(true);
  });

  it("covers exactly the points that block a unit", () => {
    const buildings: PlacedBuilding[] = [
      { id: "a", typeId: "cannon", x: 10, y: 10 },
      { id: "b", typeId: "wall", x: 20, y: 20 },
    ];
    const runs = runsFor(buildings);
    const covered = (x: number, y: number) =>
      runs.some((r) => r.y === y && x >= r.x && x < r.x + r.width);

    // Tile centres inside a run must be illegal, and vice versa.
    for (let y = 0; y < BOARD_SIZE; y += 3) {
      for (let x = 0; x < BOARD_SIZE; x += 3) {
        const centre = { x: x + 0.5, y: y + 0.5 };
        expect(covered(x, y)).toBe(!canUnitStandAt(centre, buildings, lookup));
      }
    }
  });
});

describe("nearestLegalStand", () => {
  const buildings: PlacedBuilding[] = [
    { id: "th", typeId: "town-hall", x: 20, y: 20 },
    { id: "c", typeId: "cannon", x: 10, y: 10 },
  ];
  const legal = (p: { x: number; y: number }) =>
    canUnitStandAt(p, buildings, lookup);

  /** Every returned position is the middle of some tile. */
  const isTileCentre = (p: { x: number; y: number }) =>
    p.x % 1 === 0.5 && p.y % 1 === 0.5;

  it("leaves a unit already on a legal tile where it is", () => {
    const open = tileCentre({ x: 2, y: 2 });
    expect(legal(open)).toBe(true);
    expect(nearestLegalStand(open, buildings, lookup)).toEqual(open);
  });

  it("always returns a tile centre, which is what the URL stores", () => {
    const settled = nearestLegalStand({ x: 23.4, y: 24.8 }, buildings, lookup);
    expect(isTileCentre(settled)).toBe(true);
  });

  it("moves a unit dropped inside a building onto legal ground", () => {
    // Dead centre of the Town Hall's footprint.
    const inside = { x: 20 + BOARD_OFFSET + 2, y: 20 + BOARD_OFFSET + 2 };
    expect(legal(inside)).toBe(false);
    expect(legal(nearestLegalStand(inside, buildings, lookup))).toBe(true);
  });

  it("moves a unit off the clearance ring, not just off the footprint", () => {
    // A tile touching the Town Hall's edge: outside the building itself, but
    // inside the ring the no-deploy overlay shades.
    const onRing = tileCentre({
      x: 20 + BOARD_OFFSET - 1,
      y: 20 + BOARD_OFFSET + 2,
    });
    expect(legal(onRing)).toBe(false);
    expect(legal(nearestLegalStand(onRing, buildings, lookup))).toBe(true);
  });

  it("settles anywhere over a building onto shaded-free ground", () => {
    /*
      The regression this exists for: `pushOutOfBuildings` gives up after a few
      passes on a crowded board, and whatever it returned was then rounded for
      the URL — which could put it straight back inside the ring it had just
      left. Every tile across and around the Town Hall has to come back legal.
    */
    for (let x = 18; x <= 28; x += 1) {
      for (let y = 18; y <= 28; y += 1) {
        const settled = nearestLegalStand(tileCentre({ x, y }), buildings, lookup);
        expect(legal(settled)).toBe(true);
        expect(isTileCentre(settled)).toBe(true);
      }
    }
  });

  it("keeps a perimeter unit on an edge tile", () => {
    const edge = nearestLegalStand(
      { x: 25, y: 25 },
      buildings,
      lookup,
      "perimeter",
    );
    const last = BOARD_SIZE - 0.5;
    const onEdge =
      edge.x === 0.5 || edge.y === 0.5 || edge.x === last || edge.y === last;
    expect(onEdge).toBe(true);
    expect(legal(edge)).toBe(true);
  });

  it("never has to move a perimeter unit on a real board", () => {
    /*
      The deploy border is wider than the clearance, so the outer edge is legal
      however tightly the village is packed — a building flush against the
      village boundary still sits BOARD_OFFSET tiles in. The walk along the
      edge is there to keep that true if either constant ever changes; this is
      the assertion that says it currently cannot bite.
    */
    expect(BOARD_OFFSET).toBeGreaterThan(UNIT_CLEARANCE);

    const edged: PlacedBuilding[] = [
      { id: "a", typeId: "wall", x: 0, y: 0 },
      { id: "b", typeId: "cannon", x: VILLAGE_SIZE - 3, y: 0 },
    ];
    for (let x = 0; x <= BOARD_SIZE; x++) {
      expect(canUnitStandAt({ x, y: 0 }, edged, lookup)).toBe(true);
    }
  });
});
