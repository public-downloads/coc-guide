import { z } from "zod";
import { dataQualitySchema, gameVersionSchema } from "./common";

/**
 * Every hero has exactly two equipment slots. This is a game rule, not a
 * layout choice — the sim and the URL state both depend on it.
 */
export const EQUIPMENT_SLOTS_PER_HERO = 2;

export const HERO_IDS = [
  "barbarian-king",
  "archer-queen",
  "minion-prince",
  "grand-warden",
  "royal-champion",
  "dragon-duke",
] as const;

export const heroIdSchema = z.enum(HERO_IDS);
export type HeroId = z.infer<typeof heroIdSchema>;

/**
 * `dirSlug` is the folder name under /data/equipment and the `hero` query
 * param in /sim URLs. Short on purpose — shareable build links are the growth
 * feature, so they should stay readable.
 */
export const HEROES: Record<HeroId, { name: string; dirSlug: string }> = {
  "barbarian-king": { name: "Barbarian King", dirSlug: "king" },
  "archer-queen": { name: "Archer Queen", dirSlug: "queen" },
  "minion-prince": { name: "Minion Prince", dirSlug: "prince" },
  "grand-warden": { name: "Grand Warden", dirSlug: "warden" },
  "royal-champion": { name: "Royal Champion", dirSlug: "champion" },
  "dragon-duke": { name: "Dragon Duke", dirSlug: "duke" },
};

const DIR_SLUG_TO_HERO = Object.fromEntries(
  Object.entries(HEROES).map(([id, meta]) => [meta.dirSlug, id as HeroId]),
) as Record<string, HeroId | undefined>;

export function heroFromDirSlug(dirSlug: string): HeroId | undefined {
  return DIR_SLUG_TO_HERO[dirSlug];
}

export function heroDirSlug(hero: HeroId): string {
  return HEROES[hero].dirSlug;
}

/** Base stats at a given hero level, before any equipment is applied. */
export const heroLevelSchema = z.object({
  lvl: z.number().int().min(1),
  dps: z.number().min(0),
  hp: z.number().min(0),
});
export type HeroLevel = z.infer<typeof heroLevelSchema>;

export const heroStatsSchema = z
  .object({
    id: heroIdSchema,
    name: z.string().min(1),
    /**
     * Null while the hero is a stub — hero caps move with Town Hall releases,
     * and a guessed cap is worse than an absent one. Required once real
     * numbers land.
     */
    maxLevel: z.number().int().min(1).nullable(),
    gameVersion: gameVersionSchema,
    dataQuality: dataQualitySchema,
    sources: z.array(z.string()),
    notes: z.array(z.string()).default([]),
    levels: z.array(heroLevelSchema),
  })
  .superRefine((hero, ctx) => {
    if (hero.dataQuality === "stub") {
      if (hero.levels.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["levels"],
          message:
            "stub heroes must have an empty level table — promote to unverified once filled in",
        });
      }
      return;
    }

    if (hero.sources.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["sources"],
        message: "non-stub heroes must cite at least one source",
      });
    }

    if (hero.maxLevel === null) {
      ctx.addIssue({
        code: "custom",
        path: ["maxLevel"],
        message: "non-stub heroes must declare a level cap",
      });
      return;
    }

    if (hero.levels.length !== hero.maxLevel) {
      ctx.addIssue({
        code: "custom",
        path: ["levels"],
        message: `expected ${hero.maxLevel} level rows, got ${hero.levels.length}`,
      });
      return;
    }

    hero.levels.forEach((level, i) => {
      if (level.lvl !== i + 1) {
        ctx.addIssue({
          code: "custom",
          path: ["levels", i, "lvl"],
          message: `level rows must run 1..${hero.maxLevel} in order — expected ${i + 1}, got ${level.lvl}`,
        });
      }
      if (i === 0) return;
      const prev = hero.levels[i - 1];
      if (level.dps < prev.dps) {
        ctx.addIssue({
          code: "custom",
          path: ["levels", i, "dps"],
          message: `dps must not decrease with level (${prev.dps} -> ${level.dps})`,
        });
      }
      if (level.hp < prev.hp) {
        ctx.addIssue({
          code: "custom",
          path: ["levels", i, "hp"],
          message: `hp must not decrease with level (${prev.hp} -> ${level.hp})`,
        });
      }
    });
  });

export type HeroStats = z.infer<typeof heroStatsSchema>;
