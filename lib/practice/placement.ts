import {
  BOARD_OFFSET,
  BOARD_SIZE,
  VILLAGE_SIZE,
  type BuildingType,
  type PlacedBuilding,
} from "../schema/building";
import { pointRectDistance, type Point, type Rect } from "./geometry";

/**
 * Two different rules, easy to confuse:
 *
 * - **Buildings** sit on whole tiles and may touch each other. They just
 *   cannot overlap.
 * - **Units** (the Queen, the Duke) cannot stand inside a building or within
 *   `UNIT_CLEARANCE` of one. That exclusion zone is not clipped by the village
 *   boundary — a building on the edge blocks the deploy border behind it too.
 *
 * Building coordinates are village space (0..44); unit positions are board
 * space (0..50).
 */
export const UNIT_CLEARANCE = 1;

export interface Footprint {
  x: number;
  y: number;
  size: number;
}

export function footprintOf(
  building: PlacedBuilding,
  lookup: (id: string) => BuildingType | undefined,
): Footprint | null {
  const type = lookup(building.typeId);
  return type ? { x: building.x, y: building.y, size: type.size } : null;
}

/** Village-space footprint as a board-space rectangle. */
export function footprintRect(f: Footprint): Rect {
  return {
    x: f.x + BOARD_OFFSET,
    y: f.y + BOARD_OFFSET,
    w: f.size,
    h: f.size,
  };
}

/**
 * Snaps a board-space pointer position to a whole-tile village position,
 * centring the footprint on the cursor and clamping it inside the village.
 */
export function snapFootprint(boardPoint: Point, size: number): Footprint {
  const max = VILLAGE_SIZE - size;
  const clamp = (v: number) => Math.min(Math.max(Math.round(v), 0), max);
  return {
    x: clamp(boardPoint.x - BOARD_OFFSET - size / 2),
    y: clamp(boardPoint.y - BOARD_OFFSET - size / 2),
    size,
  };
}

export function isInsideVillage(f: Footprint): boolean {
  return (
    f.x >= 0 &&
    f.y >= 0 &&
    f.x + f.size <= VILLAGE_SIZE &&
    f.y + f.size <= VILLAGE_SIZE
  );
}

/** Buildings may share an edge; they may not share a tile. */
export function overlaps(a: Footprint, b: Footprint): boolean {
  const overlaps1d = (
    aStart: number,
    aSize: number,
    bStart: number,
    bSize: number,
  ) => aStart < bStart + bSize && bStart < aStart + aSize;

  return (
    overlaps1d(a.x, a.size, b.x, b.size) && overlaps1d(a.y, a.size, b.y, b.size)
  );
}

export interface PlacementCheck {
  ok: boolean;
  /** Ids of the buildings blocking this spot, for highlighting. */
  blockedBy: string[];
  reason: "outside" | "overlap" | null;
}

export function checkPlacement(
  candidate: Footprint,
  existing: PlacedBuilding[],
  lookup: (id: string) => BuildingType | undefined,
  ignoreId?: string,
): PlacementCheck {
  if (!isInsideVillage(candidate)) {
    return { ok: false, blockedBy: [], reason: "outside" };
  }

  const blockedBy: string[] = [];
  for (const building of existing) {
    if (building.id === ignoreId) continue;
    const other = footprintOf(building, lookup);
    if (other && overlaps(candidate, other)) blockedBy.push(building.id);
  }

  return blockedBy.length > 0
    ? { ok: false, blockedBy, reason: "overlap" }
    : { ok: true, blockedBy: [], reason: null };
}

/** Every overlapping pair in a layout. Used as a build gate on preset bases. */
export function overlapViolations(
  buildings: PlacedBuilding[],
  lookup: (id: string) => BuildingType | undefined,
): Array<{ a: number; b: number }> {
  const out: Array<{ a: number; b: number }> = [];
  const prints = buildings.map((b) => footprintOf(b, lookup));

  for (let i = 0; i < prints.length; i++) {
    for (let j = i + 1; j < prints.length; j++) {
      const a = prints[i];
      const b = prints[j];
      if (a && b && overlaps(a, b)) out.push({ a: i, b: j });
    }
  }
  return out;
}

// --------------------------------------------------------------- unit space

/** True when a unit may stand at this board-space point. */
export function canUnitStandAt(
  point: Point,
  buildings: PlacedBuilding[],
  lookup: (id: string) => BuildingType | undefined,
): boolean {
  if (
    point.x < 0 ||
    point.y < 0 ||
    point.x > BOARD_SIZE ||
    point.y > BOARD_SIZE
  ) {
    return false;
  }
  return blockingBuildings(point, buildings, lookup).length === 0;
}

export function blockingBuildings(
  point: Point,
  buildings: PlacedBuilding[],
  lookup: (id: string) => BuildingType | undefined,
): string[] {
  const blocking: string[] = [];
  for (const building of buildings) {
    const f = footprintOf(building, lookup);
    if (!f) continue;
    if (pointRectDistance(point, footprintRect(f)) < UNIT_CLEARANCE) {
      blocking.push(building.id);
    }
  }
  return blocking;
}

/**
 * Nudges a unit out of any building's exclusion zone, to the closest legal
 * point. Iterates because pushing clear of one building can push into another;
 * gives up after a few passes and returns the best it managed.
 */
export function pushOutOfBuildings(
  point: Point,
  buildings: PlacedBuilding[],
  lookup: (id: string) => BuildingType | undefined,
  passes = 6,
): Point {
  let current = clampToBoard(point);

  for (let i = 0; i < passes; i++) {
    const blockers = buildings
      .map((b) => footprintOf(b, lookup))
      .filter((f): f is Footprint => f !== null)
      .map(footprintRect)
      .filter((r) => pointRectDistance(current, r) < UNIT_CLEARANCE);

    if (blockers.length === 0) return current;

    // Push clear of whichever one it is deepest inside.
    const worst = blockers.reduce((deepest, r) =>
      pointRectDistance(current, r) < pointRectDistance(current, deepest)
        ? r
        : deepest,
    );
    current = clampToBoard(nearestPointOutside(current, worst));
  }

  return current;
}

/**
 * The centre of the closest tile a unit may actually stand on.
 *
 * Two things used to let a hero end up on a wall. `pushOutOfBuildings` slides
 * a unit to the nearest legal *real* coordinate, but gives up after a few
 * passes on a dense base and hands back the best it managed — which on a max
 * base is often still inside something. And whatever it returned was then
 * rounded for the URL, which could put it straight back into the clearance
 * ring it had just been pushed out of.
 *
 * Searching tile centres directly settles both: the result is legal by
 * construction, it survives being stored, and it is legal at the same point
 * the no-deploy overlay rasterises from — so the marker can never contradict
 * the shading under it.
 *
 * `area` keeps a perimeter-locked hero on the perimeter: the Duke dashes from
 * the edge, so the nearest legal tile *inland* is not an answer for him.
 */
export function nearestLegalStand(
  point: Point,
  buildings: PlacedBuilding[],
  lookup: (id: string) => BuildingType | undefined,
  area: "board" | "perimeter" = "board",
): Point {
  const start = clampToBoard(point);
  const legal = (p: Point) => canUnitStandAt(p, buildings, lookup);

  if (area === "perimeter") {
    const from = nearestPerimeterIndex(start);
    const lap = PERIMETER_TILES;

    // Walk both ways around the edge at once, so the hero moves as little as
    // possible rather than always sliding clockwise.
    for (let step = 0; step <= lap / 2; step++) {
      for (const index of [from + step, from - step]) {
        const candidate = perimeterTile(((index % lap) + lap) % lap);
        if (legal(candidate)) return candidate;
      }
    }
    return perimeterTile(from);
  }

  const tile = {
    x: Math.min(Math.floor(start.x), BOARD_SIZE - 1),
    y: Math.min(Math.floor(start.y), BOARD_SIZE - 1),
  };
  const origin = tileCentre(tile);
  if (legal(origin)) return origin;

  /*
    Rings outward from that tile. The board is 50 tiles, so the worst case is
    bounded and tiny; in practice a hero dropped on a building is one or two
    tiles from open ground.
  */
  for (let r = 1; r < BOARD_SIZE; r++) {
    let best: Point | null = null;
    let bestDistance = Infinity;

    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        // Only the ring itself; everything inside it was tried already.
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const at = { x: tile.x + dx, y: tile.y + dy };
        if (
          at.x < 0 ||
          at.y < 0 ||
          at.x >= BOARD_SIZE ||
          at.y >= BOARD_SIZE
        ) {
          continue;
        }
        const candidate = tileCentre(at);
        if (!legal(candidate)) continue;

        const d = Math.hypot(candidate.x - start.x, candidate.y - start.y);
        if (d < bestDistance) {
          bestDistance = d;
          best = candidate;
        }
      }
    }
    if (best) return best;
  }

  // A board with no legal tile at all: give back where they asked to stand
  // rather than silently teleporting them somewhere arbitrary.
  return origin;
}

/** Units stand in the middle of a tile, never on the corner between four. */
export function tileCentre(tile: Point): Point {
  return { x: tile.x + 0.5, y: tile.y + 0.5 };
}

/**
 * The centre of the edge tile `i` steps clockwise from the top-left corner.
 *
 * The Duke stands *on* the border rather than on the line around it, same as
 * everyone else stands on a tile — the deploy border is three tiles wide and
 * he occupies one of them.
 */
export function perimeterTile(i: number): Point {
  const last = BOARD_SIZE - 1;
  const side = Math.floor(i / BOARD_SIZE);
  const along = i % BOARD_SIZE;
  switch (side) {
    case 0:
      return tileCentre({ x: along, y: 0 });
    case 1:
      return tileCentre({ x: last, y: along });
    case 2:
      return tileCentre({ x: last - along, y: last });
    default:
      return tileCentre({ x: 0, y: last - along });
  }
}

/** How many edge tiles there are — one lap of `perimeterTile`. */
export const PERIMETER_TILES = BOARD_SIZE * 4;

/** The index of the edge tile nearest a point, anywhere on the board. */
function nearestPerimeterIndex(p: Point): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < PERIMETER_TILES; i++) {
    const candidate = perimeterTile(i);
    const d = Math.hypot(candidate.x - p.x, candidate.y - p.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

/** A horizontal strip of blocked tiles, in board space. Height is always 1. */
export interface ExclusionRun {
  x: number;
  y: number;
  width: number;
}

/**
 * The area no unit may stand in, as merged horizontal runs.
 *
 * Rasterising to the tile grid first means overlapping zones collapse into one
 * region rather than being drawn twice, and two buildings a couple of tiles
 * apart produce a single continuous band. Merging each row into runs keeps the
 * shape count low — a walled base would otherwise be thousands of tiles.
 */
export function exclusionRuns(
  buildings: PlacedBuilding[],
  lookup: (id: string) => BuildingType | undefined,
): ExclusionRun[] {
  const blocked = new Uint8Array(BOARD_SIZE * BOARD_SIZE);
  let any = false;

  for (const building of buildings) {
    const f = footprintOf(building, lookup);
    if (!f) continue;
    const r = footprintRect(f);

    // The rect grown by the clearance, clamped to the board.
    const x0 = Math.max(0, Math.floor(r.x - UNIT_CLEARANCE));
    const x1 = Math.min(BOARD_SIZE - 1, Math.ceil(r.x + r.w + UNIT_CLEARANCE) - 1);
    const y0 = Math.max(0, Math.floor(r.y - UNIT_CLEARANCE));
    const y1 = Math.min(BOARD_SIZE - 1, Math.ceil(r.y + r.h + UNIT_CLEARANCE) - 1);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        blocked[y * BOARD_SIZE + x] = 1;
        any = true;
      }
    }
  }
  if (!any) return [];

  const runs: ExclusionRun[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    let start = -1;
    for (let x = 0; x <= BOARD_SIZE; x++) {
      const filled = x < BOARD_SIZE && blocked[y * BOARD_SIZE + x] === 1;
      if (filled && start === -1) start = x;
      else if (!filled && start !== -1) {
        runs.push({ x: start, y, width: x - start });
        start = -1;
      }
    }
  }
  return runs;
}

/** Closest point at least `UNIT_CLEARANCE` outside the rectangle. */
function nearestPointOutside(p: Point, r: Rect): Point {
  const left = r.x - UNIT_CLEARANCE;
  const right = r.x + r.w + UNIT_CLEARANCE;
  const top = r.y - UNIT_CLEARANCE;
  const bottom = r.y + r.h + UNIT_CLEARANCE;

  // Distance to each way out, then take the cheapest.
  const options: Array<{ point: Point; cost: number }> = [
    { point: { x: left, y: p.y }, cost: Math.abs(p.x - left) },
    { point: { x: right, y: p.y }, cost: Math.abs(p.x - right) },
    { point: { x: p.x, y: top }, cost: Math.abs(p.y - top) },
    { point: { x: p.x, y: bottom }, cost: Math.abs(p.y - bottom) },
  ];

  return options.reduce((best, o) => (o.cost < best.cost ? o : best)).point;
}

function clampToBoard(p: Point): Point {
  return {
    x: Math.min(Math.max(p.x, 0), BOARD_SIZE),
    y: Math.min(Math.max(p.y, 0), BOARD_SIZE),
  };
}
