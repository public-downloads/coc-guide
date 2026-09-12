import { z } from "zod";

/**
 * What a Town Hall can field: camp space, spell slots, and what the Clan
 * Castle holds. Per *building* level, as published — the totals are derived,
 * because "capacity at TH13" is camps × the best camp that TH13 allows, and
 * hardcoding the product would go stale on any table change.
 *
 * The client-safe half of `lib/data/capacity.ts`, the same way
 * `guide-frontmatter.ts` is the client-safe half of `guides.ts`: the loader
 * reads the filesystem, so anything running in a browser — the studio's army
 * builder — imports the schema and the maths from here instead.
 */

const levelRow = z.object({
  level: z.number().int().min(1),
  townHall: z.number().int().min(1),
});

export const capacityTablesSchema = z.object({
  campsPerTownHall: z.record(z.string(), z.number().int().min(1)),
  armyCamp: z.array(levelRow.extend({ troopCapacity: z.number().int().min(0) })),
  spellFactory: z.array(levelRow.extend({ spellCapacity: z.number().int().min(0) })),
  /** Adds its slot on top of the Spell Factory; absent below its Town Hall. */
  darkSpellFactory: z
    .array(levelRow.extend({ spellCapacity: z.number().int().min(0) }))
    .default([]),
  clanCastle: z.array(
    levelRow.extend({
      troopCapacity: z.number().int().min(0),
      spellCapacity: z.number().int().min(0),
      siegeCapacity: z.number().int().min(0),
    }),
  ),
});

export type CapacityTables = z.infer<typeof capacityTablesSchema>;

export interface Capacity {
  /** Camp space, or null if the Town Hall is outside the tables. */
  troops: number | null;
  spells: number | null;
  clanCastle: { troops: number; spells: number; sieges: number } | null;
}

/** The best row a Town Hall has unlocked, or undefined below the first one. */
function bestAt<T extends { townHall: number }>(rows: T[], townHall: number) {
  return rows
    .filter((row) => row.townHall <= townHall)
    .sort((a, b) => a.townHall - b.townHall)
    .at(-1);
}

export function capacityAt(tables: CapacityTables, townHall: number): Capacity {
  const camp = bestAt(tables.armyCamp, townHall);
  const camps = tables.campsPerTownHall[String(townHall)];
  const factory = bestAt(tables.spellFactory, townHall);
  const darkFactory = bestAt(tables.darkSpellFactory, townHall);
  const castle = bestAt(tables.clanCastle, townHall);

  return {
    troops: camp && camps ? camp.troopCapacity * camps : null,
    spells:
      factory === undefined
        ? null
        : factory.spellCapacity + (darkFactory?.spellCapacity ?? 0),
    clanCastle: castle
      ? {
          troops: castle.troopCapacity,
          spells: castle.spellCapacity,
          sieges: castle.siegeCapacity,
        }
      : null,
  };
}
