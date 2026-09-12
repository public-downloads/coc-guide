import { z } from "zod";
import { dataQualitySchema, gameVersionSchema, slugSchema } from "./common";
import { heroIdSchema } from "./hero";

export const raritySchema = z.enum(["common", "epic"]);
export type Rarity = z.infer<typeof raritySchema>;

/**
 * Rarity determines the level cap. Encoded here so a patch-note typo
 * (`"rarity": "common", "maxLevel": 27`) fails the build instead of quietly
 * producing a 27-level common in the simulator.
 */
export const RARITY_MAX_LEVEL: Record<Rarity, number> = {
  common: 18,
  epic: 27,
};

/**
 * `passive`  — stats only, always on (no activation).
 * `instant`  — fires once on ability use (spawns, burst damage, heals).
 * `duration` — fires on ability use and persists for N seconds.
 *
 * The sim must not collapse these into one number, so the distinction is
 * carried on the data rather than inferred from effect key names.
 */
export const abilityKindSchema = z.enum(["passive", "instant", "duration"]);
export type AbilityKind = z.infer<typeof abilityKindSchema>;

/** Ore spent to upgrade *to* this level. Level 1 is always free. */
const oreCostSchema = z.object({
  shiny: z.number().int().min(0),
  glowy: z.number().int().min(0),
  starry: z.number().int().min(0),
});

export const equipmentLevelSchema = z.object({
  lvl: z.number().int().min(1),
  /**
   * Passive damage bonus, added to the hero's base DPS. Ability damage does
   * *not* go here — it belongs in `effect`, because it fires on activation
   * rather than contributing to sustained DPS.
   */
  dmg: z.number().min(0),
  /** Passive HP bonus, added to the hero's base HP. */
  hp: z.number().min(0),
  /**
   * Passive health-recovery bonus. Optional because only some pieces grant it
   * (the Rocket Backpack does, most do not).
   */
  hpRecovery: z.number().min(0).optional(),
  /**
   * Ability output, keyed by the piece's `effectKeys`. Duration values are
   * seconds and must use a key ending in `Duration`.
   */
  effect: z.record(z.string(), z.number()),
  oreCost: oreCostSchema,
  /**
   * Blacksmith level gating this upgrade. Optional because stub files have no
   * level rows at all, and not every source lists it.
   */
  blacksmithLevel: z.number().int().min(1).optional(),
});
export type EquipmentLevel = z.infer<typeof equipmentLevelSchema>;

const equipmentBaseSchema = z.object({
  id: slugSchema,
  name: z.string().min(1),
  hero: heroIdSchema,
  rarity: raritySchema,
  maxLevel: z.number().int().min(1),
  gameVersion: gameVersionSchema,
  dataQuality: dataQualitySchema,
  ability: z.object({
    kind: abilityKindSchema,
    description: z.string().min(1),
  }),
  /** Effect keys every level row must define — no more, no less. */
  effectKeys: z.array(z.string()),
  /** Where the numbers came from. Required once the table is filled in. */
  sources: z.array(z.string()),
  notes: z.array(z.string()).default([]),
  levels: z.array(equipmentLevelSchema),
});

export const equipmentSchema = equipmentBaseSchema.superRefine((eq, ctx) => {
  const cap = RARITY_MAX_LEVEL[eq.rarity];
  if (eq.maxLevel !== cap) {
    ctx.addIssue({
      code: "custom",
      path: ["maxLevel"],
      message: `${eq.rarity} equipment caps at ${cap}, got ${eq.maxLevel}`,
    });
  }

  if (eq.ability.kind === "duration" && !eq.effectKeys.some(isDurationKey)) {
    ctx.addIssue({
      code: "custom",
      path: ["effectKeys"],
      message:
        'duration abilities need at least one effect key ending in "Duration"',
    });
  }

  if (eq.dataQuality === "stub") {
    if (eq.levels.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["levels"],
        message:
          "stub equipment must have an empty level table — promote it to unverified once filled in",
      });
    }
    return;
  }

  if (eq.sources.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["sources"],
      message: "non-stub equipment must cite at least one source",
    });
  }

  if (eq.levels.length !== eq.maxLevel) {
    ctx.addIssue({
      code: "custom",
      path: ["levels"],
      message: `expected ${eq.maxLevel} level rows, got ${eq.levels.length}`,
    });
    return;
  }

  const expectedKeys = [...eq.effectKeys].sort().join(",");

  eq.levels.forEach((level, i) => {
    const at = ["levels", i] as const;

    if (level.lvl !== i + 1) {
      ctx.addIssue({
        code: "custom",
        path: [...at, "lvl"],
        message: `level rows must run 1..${eq.maxLevel} in order — expected ${i + 1}, got ${level.lvl}`,
      });
    }

    const actualKeys = Object.keys(level.effect).sort().join(",");
    if (actualKeys !== expectedKeys) {
      ctx.addIssue({
        code: "custom",
        path: [...at, "effect"],
        message: `effect keys must match effectKeys [${expectedKeys}], got [${actualKeys}]`,
      });
    }

    if (i === 0) {
      const free =
        level.oreCost.shiny === 0 &&
        level.oreCost.glowy === 0 &&
        level.oreCost.starry === 0;
      if (!free) {
        ctx.addIssue({
          code: "custom",
          path: [...at, "oreCost"],
          message: "level 1 is granted free — ore cost must be all zeroes",
        });
      }
      return;
    }

    const prev = eq.levels[i - 1];
    if (level.dmg < prev.dmg) {
      ctx.addIssue({
        code: "custom",
        path: [...at, "dmg"],
        message: `dmg must not decrease with level (${prev.dmg} -> ${level.dmg})`,
      });
    }
    if (level.hp < prev.hp) {
      ctx.addIssue({
        code: "custom",
        path: [...at, "hp"],
        message: `hp must not decrease with level (${prev.hp} -> ${level.hp})`,
      });
    }
  });
});

export type Equipment = z.infer<typeof equipmentSchema>;

function isDurationKey(key: string): boolean {
  // Case-insensitive: wiki columns produce both `slowDownDuration` and a bare
  // `duration`.
  return /duration$/i.test(key);
}

/** Total ore to take a piece from level 1 to `toLevel`. */
export function cumulativeOreCost(equipment: Equipment, toLevel: number) {
  return equipment.levels
    .filter((l) => l.lvl <= toLevel)
    .reduce(
      (acc, l) => ({
        shiny: acc.shiny + l.oreCost.shiny,
        glowy: acc.glowy + l.oreCost.glowy,
        starry: acc.starry + l.oreCost.starry,
      }),
      { shiny: 0, glowy: 0, starry: 0 },
    );
}
