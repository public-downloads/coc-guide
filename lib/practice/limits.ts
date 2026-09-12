import {
  countAt,
  CRAFTED_DEFENCE_LIMIT,
  type BuildingType,
  type PlacedBuilding,
} from "../schema/building";

/**
 * How many of a building you may still place. Three rules apply:
 *
 * - the per-type count the Town Hall allows,
 * - the crafted-defence rule: only one crafted defence may stand at a time,
 *   whichever type it is, so they share a single budget, and
 * - the merge rule: a merged defence is *made of* ordinary ones and consumes
 *   them, so it spends from their count as well as its own.
 */
export interface Allowance {
  /** How many are already down (of this type, or of any crafted defence). */
  used: number;
  /** The cap, or null when we have no data for this type. */
  max: number | null;
  /** How many more may be placed; null means unlimited. */
  remaining: number | null;
  /** Which rule is binding, when one is. */
  limitedBy: "count" | "crafted" | "merge" | null;
  /**
   * Which source type ran out, when `limitedBy` is "merge" — the palette says
   * "no Cannons left" rather than leaving a tile mysteriously disabled.
   */
  spentOn?: string;
}

/**
 * How many of `sourceId` are spoken for: the ones standing, plus the ones
 * eaten by every merged building on the board.
 *
 * This is the whole merge rule. Two Cannons become a Ricochet Cannon and the
 * Cannons are gone, so a village showing 3 Ricochet Cannons has already spent
 * 6 of its 7 Cannons and may place exactly one more.
 */
export function sourcesUsed(
  sourceId: string,
  buildings: PlacedBuilding[],
  lookup: (id: string) => BuildingType | undefined,
): number {
  let used = 0;
  for (const building of buildings) {
    if (building.typeId === sourceId) {
      used += 1;
      continue;
    }
    used += lookup(building.typeId)?.mergedFrom?.[sourceId] ?? 0;
  }
  return used;
}

export function allowanceFor(
  type: BuildingType,
  buildings: PlacedBuilding[],
  lookup: (id: string) => BuildingType | undefined,
  th: number,
): Allowance {
  const byCount = countAllowance(type, buildings, lookup, th);

  /*
    A merged defence also has to afford its ingredients. Whichever source runs
    out first is the binding rule, because you cannot build the merge without
    all of them.
  */
  for (const [sourceId, cost] of Object.entries(type.mergedFrom ?? {})) {
    const source = lookup(sourceId);
    if (!source?.availableAt) continue;

    const cap = countAt(source, th);
    const spent = sourcesUsed(sourceId, buildings, lookup);
    const affordable = Math.floor(Math.max(0, cap - spent) / cost);

    if (byCount.remaining === null || affordable < byCount.remaining) {
      byCount.remaining = affordable;
      byCount.limitedBy = "merge";
      byCount.spentOn = sourceId;
    }
  }

  if (!type.crafted) return byCount;

  const craftedUsed = buildings.filter(
    (b) => lookup(b.typeId)?.crafted,
  ).length;
  const crafted: Allowance = {
    used: craftedUsed,
    max: CRAFTED_DEFENCE_LIMIT,
    remaining: Math.max(0, CRAFTED_DEFENCE_LIMIT - craftedUsed),
    limitedBy: "crafted",
  };

  // Whichever rule bites first wins; on a tie prefer the crafted rule, since
  // "one crafted defence at a time" explains the block better than a count of
  // one does.
  if (byCount.remaining === null) return crafted;
  return byCount.remaining < crafted.remaining! ? byCount : crafted;
}

function countAllowance(
  type: BuildingType,
  buildings: PlacedBuilding[],
  lookup: (id: string) => BuildingType | undefined,
  th: number,
): Allowance {
  /*
    An ordinary defence counts the merges that ate it, so the palette shows a
    Cannon as 7/7 once three Ricochet Cannons and a Multi-Gear Tower are down
    — which is the truth, even though no Cannon is standing anywhere.
  */
  const used = sourcesUsed(type.id, buildings, lookup);
  const max = type.availableAt ? countAt(type, th) : null;

  return {
    used,
    max,
    remaining: max === null ? null : Math.max(0, max - used),
    limitedBy: max === null ? null : "count",
  };
}

export function canPlaceAnother(
  type: BuildingType,
  buildings: PlacedBuilding[],
  lookup: (id: string) => BuildingType | undefined,
  th: number,
): boolean {
  const { remaining } = allowanceFor(type, buildings, lookup, th);
  return remaining === null || remaining > 0;
}
