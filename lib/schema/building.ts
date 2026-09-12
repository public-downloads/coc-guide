import { z } from "zod";
import { dataQualitySchema, gameVersionSchema, slugSchema } from "./common";

/**
 * Two nested grids, both in tile space:
 *
 * - `VILLAGE_SIZE` (44x44) is the buildable area. Building coordinates are
 *   always expressed in this space, so stored layouts never shift.
 * - `BOARD_SIZE` (50x50) is the whole board: the village plus a 3-tile deploy
 *   border on every side, which is where heroes stand. Ability lines clip to
 *   this.
 *
 * `BOARD_OFFSET` converts village space to board space.
 */
export const VILLAGE_SIZE = 44;
export const DEPLOY_BORDER = 3;
export const BOARD_SIZE = VILLAGE_SIZE + DEPLOY_BORDER * 2;
export const BOARD_OFFSET = DEPLOY_BORDER;

/** Centre of the board, which is also the centre of the buildable area. */
export const BOARD_CENTRE = BOARD_SIZE / 2;

export const buildingCategorySchema = z.enum([
  "core",
  "defence",
  "wall",
  "resource",
  "army",
  "other",
]);
export type BuildingCategory = z.infer<typeof buildingCategorySchema>;

export const buildingTypeSchema = z.object({
  id: slugSchema,
  name: z.string().min(1),
  /** Footprint in tiles; buildings are square. */
  size: z.number().int().min(1).max(6),
  category: buildingCategorySchema,
  /**
   * Practice-scoring weight, not a game stat — how much crossing this building
   * is worth when grading a line. See `lib/practice/scoring.ts` for the tiers
   * and for the rules layered on top of this number.
   */
  weight: z.number().min(0),
  /**
   * Radius of an effect that reaches past the footprint, in tiles. This one
   * *is* a game number. A line that passes within it scores a fraction of the
   * building's weight without crossing it, because the aura is what the attack
   * actually walks into — see `AURA_CREDIT`.
   */
  auraRadius: z.number().min(0).optional(),
  /**
   * Public URL of an image to draw instead of the built-in glyph. Usually
   * filled in automatically by the loader from `public/buildings/<id>.*`;
   * set it here only to point somewhere else.
   */
  image: z.string().optional(),
  /**
   * How many you may build at each Town Hall level, keyed by TH as a string.
   * A missing or zero entry means the building does not exist at that TH.
   */
  availableAt: z.record(z.string(), z.number().int().min(0)).optional(),
  /** Highest level the building can reach at each Town Hall level. */
  maxLevelAt: z.record(z.string(), z.number().int().min(0)).optional(),
  /**
   * What this building is merged from, as `{ sourceTypeId: howMany }`.
   *
   * From Town Hall 16 the game merges pairs of ordinary defences into stronger
   * ones — two Cannons become a Ricochet Cannon, a Cannon and an Archer Tower
   * become a Multi-Gear Tower — and the sources are *consumed*. So the count
   * in `availableAt` is the unmerged maximum, and every merge spends from it.
   * Without this, a Town Hall 18 village would offer 7 Cannons *and* 3
   * Ricochet Cannons, which is twice the artillery anyone actually has.
   */
  mergedFrom: z.record(z.string(), z.number().int().min(1)).optional(),
  /**
   * Concealed until it fires, like a Hidden Tesla. It is a real building and
   * an ability still hits it — the attacker just cannot see it coming, so the
   * isometric board leaves it out.
   */
  concealed: z.boolean().optional(),
  /**
   * A crafted defence. Only three exist per season and only one may stand in
   * a village at a time, whichever type it is.
   */
  crafted: z.boolean().optional(),
  /**
   * From a past crafting season and no longer obtainable. Kept in the list so
   * old share links still decode; hidden from the palette.
   */
  retired: z.boolean().optional(),
});
export type BuildingType = z.infer<typeof buildingTypeSchema>;

export const buildingCatalogSchema = z
  .object({
    gameVersion: gameVersionSchema,
    dataQuality: dataQualitySchema,
    sources: z.array(z.string()),
    notes: z.array(z.string()).default([]),
    types: z.array(buildingTypeSchema).min(1),
  })
  .superRefine((catalog, ctx) => {
    const seen = new Set<string>();
    catalog.types.forEach((type, i) => {
      if (seen.has(type.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["types", i, "id"],
          message: `duplicate building type "${type.id}"`,
        });
      }
      seen.add(type.id);
    });

    /*
      A merge recipe names other building types, and a typo in one would
      silently disable the whole rule — the source would never be found, so
      nothing would ever be spent and the palette would offer both the merge
      and its ingredients. Cheaper to fail the build.
    */
    const ids = new Set(catalog.types.map((t) => t.id));
    catalog.types.forEach((type, i) => {
      for (const sourceId of Object.keys(type.mergedFrom ?? {})) {
        if (!ids.has(sourceId)) {
          ctx.addIssue({
            code: "custom",
            path: ["types", i, "mergedFrom", sourceId],
            message: `"${type.id}" is merged from unknown building type "${sourceId}"`,
          });
        }
        if (sourceId === type.id) {
          ctx.addIssue({
            code: "custom",
            path: ["types", i, "mergedFrom", sourceId],
            message: `"${type.id}" cannot be merged from itself`,
          });
        }
      }
    });
  });

export type BuildingCatalog = z.infer<typeof buildingCatalogSchema>;

/** Town Hall levels the trainer offers. */
export const TH_LEVELS = Array.from({ length: 18 }, (_, i) => i + 1);

/** Only one crafted defence may stand in a village, whichever type it is. */
export const CRAFTED_DEFENCE_LIMIT = 1;
export const MAX_TH = TH_LEVELS[TH_LEVELS.length - 1];

export function countAt(type: BuildingType, th: number): number {
  return type.availableAt?.[String(th)] ?? 0;
}

export function maxLevelAt(type: BuildingType, th: number): number | null {
  const value = type.maxLevelAt?.[String(th)];
  return value && value > 0 ? value : null;
}

/**
 * A type with no per-TH table at all is never hidden — better to show a
 * building we lack data for than to silently drop it. Retired crafted
 * defences are always hidden.
 */
export function isAvailableAt(type: BuildingType, th: number): boolean {
  if (type.retired) return false;
  if (!type.availableAt) return true;
  return countAt(type, th) > 0;
}

/** A placed building. `x`/`y` are the top-left tile of its footprint. */
export interface PlacedBuilding {
  id: string;
  typeId: string;
  x: number;
  y: number;
}

/**
 * A preset base to drill against. These are authored for practice, not copied
 * from anyone's real village.
 */
export const baseLayoutSchema = z.object({
  id: slugSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  buildings: z
    .array(
      z.object({
        typeId: slugSchema,
        x: z.number().int().min(0).max(VILLAGE_SIZE),
        y: z.number().int().min(0).max(VILLAGE_SIZE),
      }),
    )
    .min(1),
});

export type BaseLayout = z.infer<typeof baseLayoutSchema>;
