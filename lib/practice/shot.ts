import {
  BOARD_CENTRE,
  BOARD_OFFSET,
  BOARD_SIZE,
  type BuildingType,
  type PlacedBuilding,
} from "../schema/building";
import type { HeroId } from "../schema/hero";
import {
  pointRectDistance,
  rayToBounds,
  type Point,
  type Rect,
  type Segment,
} from "./geometry";
import {
  canUnitStandAt,
  perimeterTile,
  tileCentre,
  PERIMETER_TILES,
} from "./placement";
import {
  isFocusType,
  scoreLines,
  touchLine,
  type LineTouch,
  type PreparedBuilding,
} from "./scoring";

export const ABILITY_IDS = ["giant-arrow", "rocket-backpack"] as const;
export type AbilityId = (typeof ABILITY_IDS)[number];

export interface AbilitySpec {
  id: AbilityId;
  name: string;
  heroId: HeroId;
  /** Matching file in /data/equipment, so the trainer can show real damage. */
  equipmentId: string;
  /**
   * How the line's direction is decided. Neither is aimed by the player:
   *
   * `nearest` — through whatever the hero is currently attacking, which in
   *             practice is the closest building. You steer it by *standing
   *             somewhere else*, not by picking a target.
   * `centre`  — always through the middle of the board.
   */
  aim: "nearest" | "centre";
  /** Whether the hero may stand inside the buildable area. */
  heroArea: "board" | "perimeter";
  /** Half-width of the damage path, in tiles. Not verified — see notes. */
  halfWidth: number;
  drill: string;
}

export const ABILITIES: Record<AbilityId, AbilitySpec> = {
  "giant-arrow": {
    id: "giant-arrow",
    name: "Giant Arrow",
    heroId: "archer-queen",
    equipmentId: "giant-arrow",
    aim: "nearest",
    heroArea: "board",
    halfWidth: 1,
    drill:
      "The arrow flies from the Queen through whatever she is attacking — and she attacks the closest building, you do not get to pick. Move her until the closest building is the one that lines the shot up.",
  },
  "rocket-backpack": {
    id: "rocket-backpack",
    name: "Rocket Backpack",
    heroId: "dragon-duke",
    equipmentId: "rocket-backpack",
    aim: "centre",
    heroArea: "perimeter",
    halfWidth: 1.5,
    drill:
      "The Duke always dashes through the centre of the village, so where he stands is the whole decision. Move him around the edge to swing the path.",
  },
};

export type BuildingTypeLookup = (typeId: string) => BuildingType | undefined;

export function prepare(
  buildings: PlacedBuilding[],
  lookup: BuildingTypeLookup,
): PreparedBuilding[] {
  const out: PreparedBuilding[] = [];
  for (const building of buildings) {
    const type = lookup(building.typeId);
    if (!type) continue;
    const rect: Rect = {
      x: building.x + BOARD_OFFSET,
      y: building.y + BOARD_OFFSET,
      w: type.size,
      h: type.size,
    };
    out.push({
      id: building.id,
      typeId: type.id,
      rect,
      centre: { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 },
      radius: (type.size * Math.SQRT2) / 2,
      weight: type.weight,
      aura: type.auraRadius ?? 0,
      isDefence: type.category === "defence",
    });
  }
  return out;
}

/** Buildings are stored in village space; everything else works in board space. */
export function buildingRect(
  building: PlacedBuilding,
  lookup: BuildingTypeLookup,
): Rect | null {
  const type = lookup(building.typeId);
  if (!type) return null;
  return {
    x: building.x + BOARD_OFFSET,
    y: building.y + BOARD_OFFSET,
    w: type.size,
    h: type.size,
  };
}

export function buildingCentre(
  building: PlacedBuilding,
  lookup: BuildingTypeLookup,
): Point | null {
  const rect = buildingRect(building, lookup);
  return rect ? { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 } : null;
}

/**
 * The building the hero would be attacking. Closest by edge distance, with the
 * earliest-placed building winning a tie so the result is deterministic.
 *
 * Two kinds of building are skipped:
 *
 * - **Walls.** Heroes path around them and shoot what is behind, so a wall is
 *   almost never what the Queen is actually attacking.
 * - **Anything worth nothing.** A Hero Banner is a flag, not a target worth
 *   turning an ability on. Letting one win the aim points the whole Giant
 *   Arrow at a decoration and wastes it, which is exactly the mistake the
 *   drill exists to stop you making.
 *
 * Either only becomes a target when there is genuinely nothing else left.
 */
export function nearestBuilding(
  hero: Point,
  buildings: PlacedBuilding[],
  lookup: BuildingTypeLookup,
): PlacedBuilding | null {
  const targetable = buildings.filter((b) => {
    const type = lookup(b.typeId);
    return type !== undefined && type.category !== "wall" && type.weight > 0;
  });
  return closest(hero, targetable.length > 0 ? targetable : buildings, lookup);
}

function closest(
  hero: Point,
  buildings: PlacedBuilding[],
  lookup: BuildingTypeLookup,
): PlacedBuilding | null {
  let best: PlacedBuilding | null = null;
  let bestDistance = Infinity;

  for (const building of buildings) {
    const rect = buildingRect(building, lookup);
    if (!rect) continue;
    const distance = pointRectDistance(hero, rect);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = building;
    }
  }
  return best;
}

export interface ShotInput {
  ability: AbilityId;
  hero: Point;
  buildings: PlacedBuilding[];
  lookup: BuildingTypeLookup;
  /** Internal: reuse of a prepared list across a sweep. */
  prepared?: PreparedBuilding[];
}

export interface ShotResult {
  /** Null when there is nothing to aim through. */
  segment: Segment | null;
  through: Point | null;
  /** What the hero is attacking, for `aim: "nearest"`. Derived, never chosen. */
  targetId: string | null;
  hitIds: string[];
  /** Clipped the aura of, without crossing. Worth partial credit. */
  auraIds: string[];
  score: number;
  defencesHit: number;
  maxScore: number;
}

/** Total weight available on the board — the denominator for a shot's score. */
export function totalWeight(
  buildings: PlacedBuilding[],
  lookup: BuildingTypeLookup,
): number {
  return buildings.reduce((sum, b) => sum + (lookup(b.typeId)?.weight ?? 0), 0);
}

export function computeShot({
  ability,
  hero,
  buildings,
  lookup,
  prepared,
}: ShotInput): ShotResult {
  const spec = ABILITIES[ability];
  const board = prepared ?? prepare(buildings, lookup);
  const empty: ShotResult = {
    segment: null,
    through: null,
    targetId: null,
    hitIds: [],
    auraIds: [],
    score: 0,
    defencesHit: 0,
    maxScore: totalWeight(buildings, lookup),
  };

  const aimed = aim(spec, hero, buildings, lookup);
  if (!aimed) return empty;

  const scored = scoreLines(board, [
    touchLine(aimed.segment, board, spec.halfWidth),
  ]);

  return {
    segment: aimed.segment,
    through: aimed.through,
    targetId: aimed.targetId,
    hitIds: scored.hitIds,
    auraIds: scored.auraIds,
    score: scored.score,
    defencesHit: scored.defencesHit,
    maxScore: empty.maxScore,
  };
}

/**
 * Where the line goes, given where the hero stands. Separated out because the
 * pair needs the geometry of both lines before either can be scored — scoring
 * them one at a time would count a shared building twice.
 */
function aim(
  spec: AbilitySpec,
  hero: Point,
  buildings: PlacedBuilding[],
  lookup: BuildingTypeLookup,
): { segment: Segment; through: Point; targetId: string | null } | null {
  let through: Point | null = null;
  let targetId: string | null = null;

  if (spec.aim === "centre") {
    through = { x: BOARD_CENTRE, y: BOARD_CENTRE };
  } else {
    const target = nearestBuilding(hero, buildings, lookup);
    if (target) {
      through = buildingCentre(target, lookup);
      targetId = target.id;
    }
  }
  if (!through) return null;

  const segment = rayToBounds(hero, through, BOARD_SIZE);
  return segment ? { segment, through, targetId } : null;
}

export interface BestShot {
  result: ShotResult;
  /** The hero position that produced it. */
  hero: Point;
}

/** Tile step when sweeping the board for the Queen's best standing spot. */
const BOARD_SAMPLE_STEP = 1;

/**
 * Every edge tile a perimeter hero could stand on.
 *
 * Tiles rather than an arbitrary sample count because the answer ends up in
 * the URL, and the URL stores a tile — a solver that returns x=23.6 has its
 * answer stored as tile 23 and redrawn at 23.5, which is a position the solver
 * never scored and the hero may not even be allowed to stand on.
 */
function perimeterStands(): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < PERIMETER_TILES; i++) out.push(perimeterTile(i));
  return out;
}

/**
 * The best line available, used to grade the attempt. Since neither ability is
 * aimed, "best" means the best place to *stand* — swept over the perimeter for
 * the Duke, and over the whole board for the Queen.
 */
export function findBestShot(
  ability: AbilityId,
  buildings: PlacedBuilding[],
  lookup: BuildingTypeLookup,
): BestShot | null {
  const spec = ABILITIES[ability];
  const prepared = prepare(buildings, lookup);
  let best: BestShot | null = null;

  const consider = (hero: Point) => {
    // A position the hero could not legally occupy is not a real answer.
    if (!canUnitStandAt(hero, buildings, lookup)) return;
    const result = computeShot({ ability, hero, buildings, lookup, prepared });
    if (!result.segment) return;
    if (!best || result.score > best.result.score) best = { result, hero };
  };

  if (spec.heroArea === "perimeter") {
    for (const point of perimeterStands()) consider(point);
    return best;
  }

  for (let x = 0; x < BOARD_SIZE; x += BOARD_SAMPLE_STEP) {
    for (let y = 0; y < BOARD_SIZE; y += BOARD_SAMPLE_STEP) {
      consider(tileCentre({ x, y }));
    }
  }
  return best;
}

// ------------------------------------------------------------------ the pair

/**
 * Both heroes on the board at once. This is the earthquake opener: quakes
 * open the compartment, then the Queen's arrow and the Duke's dash go through
 * the same high-hitpoint defence together, because neither ability takes a
 * Monolith or a Revenge Tower down on its own.
 */
export const HERO_SLOTS = ["queen", "duke"] as const;
export type HeroSlot = (typeof HERO_SLOTS)[number];

/** Which ability each hero brings. One each — there is nothing to choose. */
export const PAIR_ABILITY: Record<HeroSlot, AbilityId> = {
  queen: "giant-arrow",
  duke: "rocket-backpack",
};

/** Where one hero's line goes. Null when they have nothing to aim through. */
export interface LineAim {
  segment: Segment;
  through: Point;
  targetId: string | null;
}

export interface PairShot {
  lines: Record<HeroSlot, LineAim | null>;
  /** Crossed by either line, counted once. */
  hitIds: string[];
  auraIds: string[];
  /** Crossed by *both* — where the focus multiplier lands. */
  bothIds: string[];
  score: number;
  defencesHit: number;
  maxScore: number;
}

export interface PairInput {
  positions: Record<HeroSlot, Point>;
  buildings: PlacedBuilding[];
  lookup: BuildingTypeLookup;
  prepared?: PreparedBuilding[];
}

/**
 * Score both lines together.
 *
 * Not two `computeShot` calls added up: a building both lines cross is still
 * one building, so adding the two scores would double-count the whole overlap
 * — which is exactly the region the pair is trying to share.
 */
export function computePair({
  positions,
  buildings,
  lookup,
  prepared,
}: PairInput): PairShot {
  const board = prepared ?? prepare(buildings, lookup);

  const lines = {} as Record<HeroSlot, LineAim | null>;
  const touches: LineTouch[] = [];

  for (const slot of HERO_SLOTS) {
    const spec = ABILITIES[PAIR_ABILITY[slot]];
    const aimed = aim(spec, positions[slot], buildings, lookup);
    lines[slot] = aimed;
    if (aimed) touches.push(touchLine(aimed.segment, board, spec.halfWidth));
  }

  const scored = scoreLines(board, touches);

  return {
    lines,
    hitIds: scored.hitIds,
    auraIds: scored.auraIds,
    bothIds: scored.bothIds,
    score: scored.score,
    defencesHit: scored.defencesHit,
    maxScore: totalWeight(buildings, lookup),
  };
}

export interface BestPair {
  result: PairShot;
  positions: Record<HeroSlot, Point>;
}

/**
 * How many standing positions per hero survive into the joint search, and how
 * far apart they have to be.
 *
 * A full joint sweep is 2300 Queen positions times 240 Duke positions, which
 * is millions of line evaluations — far past what belongs on a keystroke. So
 * each side is swept alone, shortlisted, and only the shortlists are paired up.
 * Spacing them is what makes a shortlist worth having: sixteen adjacent tiles
 * are sixteen copies of one line, and the second-best *idea* never survives.
 */
const PAIR_SHORTLIST = 16;
const SHORTLIST_SPACING = 4;

interface Candidate {
  hero: Point;
  score: number;
  /** Ids of the focus buildings this line crosses, if any. */
  focus: string[];
}

/**
 * The best pair of positions, used to grade the attempt.
 *
 * A shortlist search, not an exhaustive one — see `PAIR_SHORTLIST`. It is
 * seeded with the best line each hero has *through every focus building* as
 * well as their best lines overall, so the answer the drill exists to teach
 * cannot be shortlisted away by a pile of higher-scoring lines that ignore the
 * Monolith.
 */
export function findBestPair(
  buildings: PlacedBuilding[],
  lookup: BuildingTypeLookup,
): BestPair | null {
  const prepared = prepare(buildings, lookup);
  if (prepared.length === 0) return null;

  /*
    Each shortlisted position is aimed and traced once here, so the joint pass
    below is set arithmetic rather than geometry. Re-aiming inside the double
    loop would repeat the same few dozen line traces a couple of hundred times.
  */
  const options = {} as Record<
    HeroSlot,
    Array<{ hero: Point; touch: LineTouch }>
  >;
  for (const slot of HERO_SLOTS) {
    const spec = ABILITIES[PAIR_ABILITY[slot]];
    options[slot] = shortlist(
      sweep(PAIR_ABILITY[slot], buildings, lookup, prepared),
    ).flatMap((hero) => {
      const aimed = aim(spec, hero, buildings, lookup);
      return aimed
        ? [{ hero, touch: touchLine(aimed.segment, prepared, spec.halfWidth) }]
        : [];
    });
    if (options[slot].length === 0) return null;
  }

  let bestScore = -1;
  let positions: Record<HeroSlot, Point> | null = null;

  for (const queen of options.queen) {
    for (const duke of options.duke) {
      const { score } = scoreLines(prepared, [queen.touch, duke.touch]);
      if (score > bestScore) {
        bestScore = score;
        positions = { queen: queen.hero, duke: duke.hero };
      }
    }
  }
  if (!positions) return null;

  return {
    result: computePair({ positions, buildings, lookup, prepared }),
    positions,
  };
}

/** Every legal standing position for one ability, scored on its own. */
function sweep(
  ability: AbilityId,
  buildings: PlacedBuilding[],
  lookup: BuildingTypeLookup,
  prepared: PreparedBuilding[],
): Candidate[] {
  const spec = ABILITIES[ability];
  const out: Candidate[] = [];

  const consider = (hero: Point) => {
    if (!canUnitStandAt(hero, buildings, lookup)) return;
    const aimed = aim(spec, hero, buildings, lookup);
    if (!aimed) return;

    const touch = touchLine(aimed.segment, prepared, spec.halfWidth);
    const focus = prepared
      .filter((b) => isFocusType(b.typeId) && touch.hit.has(b.id))
      .map((b) => b.id);
    out.push({
      hero,
      score: scoreLines(prepared, [touch]).score,
      focus,
    });
  };

  if (spec.heroArea === "perimeter") {
    for (const point of perimeterStands()) consider(point);
    return out;
  }

  for (let x = 0; x < BOARD_SIZE; x += BOARD_SAMPLE_STEP) {
    for (let y = 0; y < BOARD_SIZE; y += BOARD_SAMPLE_STEP) {
      consider(tileCentre({ x, y }));
    }
  }
  return out;
}

/**
 * The strongest spread-out positions, plus the best one through each focus
 * building whether or not it made the cut on score.
 */
function shortlist(candidates: Candidate[]): Point[] {
  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  const picked: Point[] = [];

  /*
    The best line through each focus building goes in first, and it skips the
    spacing rule rather than being thinned by it. It is the shot the pair
    exists for, and on a base where the Monolith sits off to one side it will
    not be anywhere near the top of the score ranking — so if the spacing rule
    can drop it, the drill can never show it.
  */
  const seeded = new Set<string>();
  for (const candidate of ranked) {
    if (candidate.focus.some((id) => !seeded.has(id))) {
      for (const id of candidate.focus) seeded.add(id);
      picked.push(candidate.hero);
    }
  }

  for (const candidate of ranked) {
    if (picked.length >= PAIR_SHORTLIST) break;
    const { hero } = candidate;
    const crowded = picked.some(
      (p) => Math.hypot(p.x - hero.x, p.y - hero.y) < SHORTLIST_SPACING,
    );
    if (!crowded) picked.push(hero);
  }
  return picked;
}

/** Maps 0..1 onto a lap of the board perimeter. */
export function perimeterPoint(t: number, size: number = BOARD_SIZE): Point {
  const p = ((t % 1) + 1) % 1;
  const side = Math.floor(p * 4);
  const along = (p * 4 - side) * size;

  switch (side) {
    case 0:
      return { x: along, y: 0 };
    case 1:
      return { x: size, y: along };
    case 2:
      return { x: size - along, y: size };
    default:
      return { x: 0, y: size - along };
  }
}

/** Nearest point on the board perimeter, for snapping a dragged Duke back. */
export function snapToPerimeter(p: Point, size: number = BOARD_SIZE): Point {
  const x = Math.min(Math.max(p.x, 0), size);
  const y = Math.min(Math.max(p.y, 0), size);
  const candidates: Point[] = [
    { x, y: 0 },
    { x, y: size },
    { x: 0, y },
    { x: size, y },
  ];
  return candidates.reduce((closest, candidate) =>
    Math.hypot(candidate.x - p.x, candidate.y - p.y) <
    Math.hypot(closest.x - p.x, closest.y - p.y)
      ? candidate
      : closest,
  );
}
