/**
 * What a line is worth. Pure functions over prepared buildings — no data
 * loading, no React.
 *
 * The flat number in `data/buildings.json` is the base: one opinion per
 * building type, tiered by what that defence does to an attack rather than by
 * its damage figure. Two rules are layered on top here, and both exist because
 * a flat per-type number cannot express them:
 *
 * - **Aura.** A Spell Tower's effect reaches seven tiles past a 2x2 footprint,
 *   so passing beside one is not the same as missing it. Types with an
 *   `auraRadius` score a fraction of their weight for a near miss.
 * - **Focus.** A Monolith or a Revenge Tower has more hitpoints than one hero
 *   ability removes. Their value therefore depends on whether *both* heroes
 *   are on the board and whether both lines actually cross them — which is a
 *   fact about the attempt, not about the building.
 */

import { pointLineDistance, rectIsHit, type Point, type Rect, type Segment } from "./geometry";

/**
 * Fraction of its weight a building scores when the line passes inside its
 * aura but never crosses the footprint.
 *
 * Deliberately well under half: clipping the aura is worth something, and it
 * is not worth as much as removing the tower. At 0.35 a Spell Tower brushed at
 * range is worth about as much as a Cannon flattened, which is roughly the
 * trade an attack is making.
 */
export const AURA_CREDIT = 0.35;

/**
 * Defences with more effective hitpoints than a single hero ability strips.
 * One hero cannot finish them, so a pair going in together is the whole reason
 * to bring both — and the earthquake-into-double-ability opener exists
 * precisely for these two.
 */
export const FOCUS_TYPES = ["monolith", "revenge-tower"] as const;
export type FocusType = (typeof FOCUS_TYPES)[number];

const FOCUS = new Set<string>(FOCUS_TYPES);

export function isFocusType(typeId: string): boolean {
  return FOCUS.has(typeId);
}

/**
 * How much more a focus building is worth when **both** lines cross it.
 *
 * Only then. Having the pair on the board buys nothing on its own, and one
 * ability into a Monolith is one ability wasted — it survives, so the shot
 * scores what any other near miss would. The bonus is the reward for actually
 * landing both, which is the thing the drill teaches.
 *
 * Everything else on the board — the air defences, the spell towers — keeps
 * scoring exactly as it does solo; this rule adds, it never rebalances.
 */
export const FOCUS_MULTIPLIER = 2.5;

/**
 * Buildings flattened into exactly what the hit test and the scoring need. A
 * walled base runs to a few hundred buildings and the solver sweeps thousands
 * of positions, so this is built once per sweep rather than per candidate line.
 */
export interface PreparedBuilding {
  id: string;
  typeId: string;
  rect: Rect;
  centre: Point;
  /** Half the footprint's diagonal — its bounding-circle radius. */
  radius: number;
  weight: number;
  /** Tiles past the footprint the building's effect reaches; 0 for most. */
  aura: number;
  isDefence: boolean;
}

/** Which buildings one line touched, before any scoring rule is applied. */
export interface LineTouch {
  /** Crossed the footprint. */
  hit: Set<string>;
  /** Inside the aura but never crossed. Always disjoint from `hit`. */
  aura: Set<string>;
}

export interface LineScore {
  /** Crossed by at least one line. */
  hitIds: string[];
  /** Clipped the aura of, and never crossed. */
  auraIds: string[];
  /** Crossed by every line — empty unless there is more than one. */
  bothIds: string[];
  score: number;
  /** Distinct defences crossed, however many lines crossed them. */
  defencesHit: number;
}

/** What one line touched, given the prepared board and the path's half-width. */
export function touchLine(
  segment: Segment,
  prepared: PreparedBuilding[],
  halfWidth: number,
): LineTouch {
  const hit = new Set<string>();
  const aura = new Set<string>();

  for (const b of prepared) {
    // Cheap rejection first: anything farther from the line than the path's
    // half-width plus the building's reach cannot possibly be touched.
    const reach = b.radius + Math.max(b.aura, 0);
    if (pointLineDistance(b.centre, segment) > halfWidth + reach) continue;

    if (rectIsHit(segment, b.rect, halfWidth)) hit.add(b.id);
    else if (b.aura > 0 && rectIsHit(segment, b.rect, halfWidth + b.aura)) {
      aura.add(b.id);
    }
  }

  return { hit, aura };
}

/**
 * Score one or more lines against the board.
 *
 * A building is counted once however many lines reach it — two abilities
 * through the same Cannon still only remove one Cannon. What more than one
 * line buys you is the focus multiplier, and only on the two buildings that
 * actually need two heroes.
 */
export function scoreLines(
  prepared: PreparedBuilding[],
  lines: LineTouch[],
): LineScore {
  const hitIds: string[] = [];
  const auraIds: string[] = [];
  const bothIds: string[] = [];
  let score = 0;
  let defencesHit = 0;

  const pair = lines.length > 1;

  for (const b of prepared) {
    const hits = lines.reduce((n, line) => n + (line.hit.has(b.id) ? 1 : 0), 0);

    if (hits > 0) {
      const byAll = hits === lines.length;
      hitIds.push(b.id);
      if (b.isDefence) defencesHit += 1;
      if (pair && byAll) bothIds.push(b.id);

      score +=
        pair && byAll && isFocusType(b.typeId)
          ? b.weight * FOCUS_MULTIPLIER
          : b.weight;
      continue;
    }

    // Aura credit is deliberately flat: it is a near miss, and a near miss
    // does not get better for happening twice.
    if (lines.some((line) => line.aura.has(b.id))) {
      auraIds.push(b.id);
      score += b.weight * AURA_CREDIT;
    }
  }

  // Fractional aura credit would otherwise put ".65" on a scoreboard.
  return { hitIds, auraIds, bothIds, score: Math.round(score), defencesHit };
}
