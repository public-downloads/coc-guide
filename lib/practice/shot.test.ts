import { describe, expect, it } from "vitest";
import {
  buildingCentre,
  buildingRect,
  computePair,
  computeShot,
  findBestPair,
  findBestShot,
  nearestBuilding,
  perimeterPoint,
  snapToPerimeter,
  totalWeight,
} from "./shot";
import { FOCUS_MULTIPLIER } from "./scoring";
import {
  BOARD_OFFSET,
  BOARD_SIZE,
  type BuildingType,
  type PlacedBuilding,
} from "../schema/building";

const TYPES: Record<string, BuildingType> = {
  "air-defense": {
    id: "air-defense",
    name: "Air Defense",
    size: 3,
    category: "defence",
    weight: 9,
  },
  cannon: {
    id: "cannon",
    name: "Cannon",
    size: 3,
    category: "defence",
    weight: 5,
  },
  wall: { id: "wall", name: "Wall", size: 1, category: "wall", weight: 1 },
  // The id is real because the focus rule keys on it; the weight is not.
  monolith: {
    id: "monolith",
    name: "Monolith",
    size: 3,
    category: "defence",
    weight: 8,
  },
  // Worth nothing: a flag, not something to turn an ability on.
  "hero-banner": {
    id: "hero-banner",
    name: "Hero Banner",
    size: 2,
    category: "other",
    weight: 0,
  },
  "gold-storage": {
    id: "gold-storage",
    name: "Gold Storage",
    size: 3,
    category: "resource",
    weight: 2,
  },
};

const lookup = (id: string) => TYPES[id];

/**
 * A perimeter hero stands in the middle of an edge *tile*, not on the boundary
 * line around the board — units occupy a tile like everything else.
 */
function onEdgeTile(p: { x: number; y: number }): boolean {
  const last = BOARD_SIZE - 0.5;
  return p.x === 0.5 || p.y === 0.5 || p.x === last || p.y === last;
}

/** Three buildings down the middle column, plus one off in a corner. */
const buildings: PlacedBuilding[] = [
  { id: "ad", typeId: "air-defense", x: 20, y: 6 },
  { id: "cannon", typeId: "cannon", x: 20, y: 20 },
  { id: "storage", typeId: "gold-storage", x: 20, y: 34 },
  { id: "outlier", typeId: "cannon", x: 4, y: 4 },
];

/** The middle column's centre line, in board space. */
const COLUMN_X = 20 + 1.5 + BOARD_OFFSET;

describe("board vs village space", () => {
  it("offsets building rects into board space", () => {
    expect(buildingRect(buildings[0], lookup)).toEqual({
      x: 20 + BOARD_OFFSET,
      y: 6 + BOARD_OFFSET,
      w: 3,
      h: 3,
    });
  });

  it("centres on the footprint in board space", () => {
    expect(buildingCentre(buildings[0], lookup)).toEqual({
      x: COLUMN_X,
      y: 7.5 + BOARD_OFFSET,
    });
  });

  // Board dimensions themselves are asserted in placement.test.ts.
});

describe("nearestBuilding", () => {
  it("picks the closest by edge distance", () => {
    const hero = { x: COLUMN_X, y: 0 };
    expect(nearestBuilding(hero, buildings, lookup)?.id).toBe("ad");
  });

  it("changes as the hero moves", () => {
    const hero = { x: COLUMN_X, y: BOARD_SIZE };
    expect(nearestBuilding(hero, buildings, lookup)?.id).toBe("storage");
  });

  it("returns null on an empty board", () => {
    expect(nearestBuilding({ x: 0, y: 0 }, [], lookup)).toBeNull();
  });

  it("looks past a wall to the building behind it", () => {
    // The wall is nearer, but heroes shoot what is behind it.
    const walled: PlacedBuilding[] = [
      { id: "wall", typeId: "wall", x: 20, y: 2 },
      { id: "ad", typeId: "air-defense", x: 20, y: 6 },
    ];
    expect(nearestBuilding({ x: COLUMN_X, y: 0 }, walled, lookup)?.id).toBe(
      "ad",
    );
  });

  it("looks past a Hero Banner to something worth hitting", () => {
    // The banner is nearer and scores nothing. Aiming at it would point the
    // whole Giant Arrow at a decoration.
    const flagged: PlacedBuilding[] = [
      { id: "banner", typeId: "hero-banner", x: 20, y: 2 },
      { id: "ad", typeId: "air-defense", x: 20, y: 6 },
    ];
    expect(nearestBuilding({ x: COLUMN_X, y: 0 }, flagged, lookup)?.id).toBe(
      "ad",
    );
  });

  it("targets a worthless building only when nothing else remains", () => {
    const onlyBanners: PlacedBuilding[] = [
      { id: "banner", typeId: "hero-banner", x: 20, y: 2 },
    ];
    expect(
      nearestBuilding({ x: COLUMN_X, y: 0 }, onlyBanners, lookup)?.id,
    ).toBe("banner");
  });

  it("targets a wall only when nothing else remains", () => {
    const onlyWalls: PlacedBuilding[] = [
      { id: "wall", typeId: "wall", x: 20, y: 2 },
    ];
    expect(nearestBuilding({ x: COLUMN_X, y: 0 }, onlyWalls, lookup)?.id).toBe(
      "wall",
    );
  });
});

describe("computeShot — Giant Arrow", () => {
  const base = { ability: "giant-arrow" as const, buildings, lookup };

  it("aims through the closest building, not a chosen one", () => {
    const shot = computeShot({ ...base, hero: { x: COLUMN_X, y: 0 } });

    expect(shot.targetId).toBe("ad");
    expect(shot.hitIds.sort()).toEqual(["ad", "cannon", "storage"]);
    expect(shot.score).toBe(9 + 5 + 2);
    expect(shot.defencesHit).toBe(2);
  });

  it("carries past the target to the board edge", () => {
    const shot = computeShot({ ...base, hero: { x: COLUMN_X, y: 0 } });
    expect(shot.segment?.b.y).toBe(BOARD_SIZE);
  });

  it("re-targets when the hero moves nearer another building", () => {
    const nearOutlier = computeShot({
      ...base,
      hero: { x: 4 + BOARD_OFFSET, y: 0 },
    });
    expect(nearOutlier.targetId).toBe("outlier");
    expect(nearOutlier.hitIds).toContain("outlier");
  });

  it("produces nothing when there is nothing to attack", () => {
    const shot = computeShot({ ...base, buildings: [], hero: { x: 5, y: 0 } });
    expect(shot.segment).toBeNull();
    expect(shot.targetId).toBeNull();
  });

  it("reports the board's total weight as the denominator", () => {
    const shot = computeShot({ ...base, hero: { x: COLUMN_X, y: 0 } });
    expect(shot.maxScore).toBe(totalWeight(buildings, lookup));
    expect(shot.maxScore).toBe(9 + 5 + 2 + 5);
  });
});

describe("computeShot — Rocket Backpack", () => {
  const base = { ability: "rocket-backpack" as const, buildings, lookup };

  it("aims through the board centre and reports no target", () => {
    const shot = computeShot({ ...base, hero: { x: BOARD_SIZE / 2, y: 0 } });
    expect(shot.through).toEqual({ x: BOARD_SIZE / 2, y: BOARD_SIZE / 2 });
    expect(shot.targetId).toBeNull();
  });

  it("ignores which building is closest", () => {
    const nearOutlier = computeShot({ ...base, hero: { x: 5, y: 0 } });
    expect(nearOutlier.through).toEqual({
      x: BOARD_SIZE / 2,
      y: BOARD_SIZE / 2,
    });
  });

  it("changes what it crosses as the hero moves along the edge", () => {
    const down = computeShot({ ...base, hero: { x: BOARD_SIZE / 2, y: 0 } });
    const across = computeShot({ ...base, hero: { x: 0, y: BOARD_SIZE / 2 } });
    expect(down.hitIds).not.toEqual(across.hitIds);
  });
});

describe("findBestShot", () => {
  it("solves for where to stand with the Giant Arrow", () => {
    const best = findBestShot("giant-arrow", buildings, lookup);

    expect(best).not.toBeNull();
    expect(best!.result.score).toBeGreaterThanOrEqual(16);
    expect(best!.result.hitIds).toContain("ad");
  });

  it("solves for a perimeter position with the Rocket Backpack", () => {
    const best = findBestShot("rocket-backpack", buildings, lookup);

    expect(best).not.toBeNull();
    expect(onEdgeTile(best!.hero)).toBe(true);
  });

  it("is never worse than an arbitrary attempt", () => {
    const best = findBestShot("giant-arrow", buildings, lookup)!;
    const arbitrary = computeShot({
      ability: "giant-arrow",
      hero: { x: 0, y: 0 },
      buildings,
      lookup,
    });
    expect(best.result.score).toBeGreaterThanOrEqual(arbitrary.score);
  });

  it("returns null on an empty board", () => {
    expect(findBestShot("giant-arrow", [], lookup)).toBeNull();
  });
});

describe("computePair", () => {
  /*
    A Monolith over the board centre, so the Duke's dash goes through it and
    the Queen — who has nothing else near her — aims at it too. The cannon sits
    far enough away that it never becomes her target and neither line reaches
    it, which keeps the expected score to just the Monolith.
  */
  const centred: PlacedBuilding[] = [
    { id: "mono", typeId: "monolith", x: 20, y: 20 },
    { id: "cannon", typeId: "cannon", x: 35, y: 35 },
  ];

  it("gives each hero their own ability and their own line", () => {
    const result = computePair({
      positions: {
        queen: { x: BOARD_SIZE / 2, y: 0 },
        duke: { x: 0, y: BOARD_SIZE / 2 },
      },
      buildings: centred,
      lookup,
    });

    expect(result.lines.queen?.segment).not.toBeNull();
    expect(result.lines.duke?.segment).not.toBeNull();
    // The Queen aims through what she is attacking; the Duke never does.
    expect(result.lines.queen?.targetId).toBe("mono");
    expect(result.lines.duke?.targetId).toBeNull();
  });

  it("counts a building both lines cross exactly once", () => {
    const result = computePair({
      positions: {
        queen: { x: BOARD_SIZE / 2, y: 0 },
        duke: { x: 0, y: BOARD_SIZE / 2 },
      },
      buildings: centred,
      lookup,
    });

    expect(result.hitIds.filter((id) => id === "mono")).toHaveLength(1);
    expect(result.bothIds).toContain("mono");
  });

  it("is worth more than either hero alone on the same Monolith", () => {
    const positions = {
      queen: { x: BOARD_SIZE / 2, y: 0 },
      duke: { x: 0, y: BOARD_SIZE / 2 },
    };
    const together = computePair({ positions, buildings: centred, lookup });
    const alone = computeShot({
      ability: "giant-arrow",
      hero: positions.queen,
      buildings: centred,
      lookup,
    });

    expect(together.bothIds).toContain("mono");
    expect(together.score).toBeGreaterThan(alone.score);
    // Specifically: the Monolith carried the full crossed-by-both multiplier.
    expect(together.score).toBe(Math.round(8 * FOCUS_MULTIPLIER));
  });

  it("reports the board's total weight as the denominator", () => {
    const result = computePair({
      positions: { queen: { x: 0, y: 0 }, duke: { x: 0, y: BOARD_SIZE / 2 } },
      buildings,
      lookup,
    });
    expect(result.maxScore).toBe(totalWeight(buildings, lookup));
  });
});

describe("findBestPair", () => {
  it("solves for both heroes at once", () => {
    const best = findBestPair(buildings, lookup);

    expect(best).not.toBeNull();
    expect(best!.positions.queen).toBeDefined();
    expect(best!.positions.duke).toBeDefined();
  });

  it("keeps the Duke on the perimeter", () => {
    const { duke } = findBestPair(buildings, lookup)!.positions;
    expect(onEdgeTile(duke)).toBe(true);
  });

  it("is never worse than an arbitrary pair of positions", () => {
    const best = findBestPair(buildings, lookup)!;
    const arbitrary = computePair({
      positions: { queen: { x: 0, y: 0 }, duke: { x: 0, y: BOARD_SIZE / 2 } },
      buildings,
      lookup,
    });
    expect(best.result.score).toBeGreaterThanOrEqual(arbitrary.score);
  });

  it("finds the shot through a Monolith parked off to one side", () => {
    // The point of the focus seeding: the Monolith is nowhere near the
    // highest-scoring lines, so a shortlist ranked purely on score would drop
    // every position that reaches it.
    const offset: PlacedBuilding[] = [
      ...buildings,
      { id: "mono", typeId: "monolith", x: 2, y: 38 },
    ];
    const best = findBestPair(offset, lookup)!;
    expect(best.result.bothIds).toContain("mono");
  });

  it("returns null on an empty board", () => {
    expect(findBestPair([], lookup)).toBeNull();
  });
});

describe("perimeterPoint", () => {
  it("walks the four edges of the board in order", () => {
    expect(perimeterPoint(0)).toEqual({ x: 0, y: 0 });
    expect(perimeterPoint(0.25)).toEqual({ x: BOARD_SIZE, y: 0 });
    expect(perimeterPoint(0.5)).toEqual({ x: BOARD_SIZE, y: BOARD_SIZE });
    expect(perimeterPoint(0.75)).toEqual({ x: 0, y: BOARD_SIZE });
  });

  it("wraps around", () => {
    expect(perimeterPoint(1)).toEqual(perimeterPoint(0));
  });
});

describe("snapToPerimeter", () => {
  it("pulls an interior point to the nearest edge", () => {
    expect(snapToPerimeter({ x: 5, y: 23 })).toEqual({ x: 0, y: 23 });
    expect(snapToPerimeter({ x: 23, y: 3 })).toEqual({ x: 23, y: 0 });
  });

  it("clamps a point dragged off the board", () => {
    expect(snapToPerimeter({ x: -10, y: 60 })).toEqual({ x: 0, y: BOARD_SIZE });
  });
});
