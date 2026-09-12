import fs from "node:fs";
import path from "node:path";
import { equipmentSchema, type Equipment } from "../schema/equipment";
import { HERO_IDS, HEROES, heroFromDirSlug, type HeroId } from "../schema/hero";

export interface CatalogIssue {
  /** Path relative to the data root, e.g. `queen/frozen-arrow.json`. */
  file: string;
  message: string;
}

export interface EquipmentCatalog {
  items: Equipment[];
  byId: Map<string, Equipment>;
  byHero: Record<HeroId, Equipment[]>;
  issues: CatalogIssue[];
}

export const DEFAULT_DATA_ROOT = path.join(
  process.cwd(),
  "data",
  "equipment",
);

/**
 * Reads and validates every equipment file. Collects issues rather than
 * throwing so the validate script can report all of them at once; use
 * {@link getEquipmentCatalog} for the fail-fast version.
 */
export function loadEquipmentCatalog(
  dataRoot: string = DEFAULT_DATA_ROOT,
): EquipmentCatalog {
  const items: Equipment[] = [];
  const issues: CatalogIssue[] = [];
  const byId = new Map<string, Equipment>();
  const byHero = Object.fromEntries(
    HERO_IDS.map((id) => [id, [] as Equipment[]]),
  ) as Record<HeroId, Equipment[]>;

  if (!fs.existsSync(dataRoot)) {
    issues.push({ file: dataRoot, message: "data root does not exist" });
    return { items, byId, byHero, issues };
  }

  for (const dirSlug of fs.readdirSync(dataRoot).sort()) {
    const dir = path.join(dataRoot, dirSlug);
    if (!fs.statSync(dir).isDirectory()) continue;

    const expectedHero = heroFromDirSlug(dirSlug);
    if (!expectedHero) {
      issues.push({
        file: dirSlug,
        message: `not a known hero directory — expected one of ${HERO_IDS.map(
          (id) => HEROES[id].dirSlug,
        ).join(", ")}`,
      });
      continue;
    }

    for (const filename of fs.readdirSync(dir).sort()) {
      if (!filename.endsWith(".json")) continue;
      const relative = `${dirSlug}/${filename}`;
      const raw = fs.readFileSync(path.join(dir, filename), "utf8");

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        issues.push({
          file: relative,
          message: `invalid JSON: ${(err as Error).message}`,
        });
        continue;
      }

      const result = equipmentSchema.safeParse(parsed);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const at = issue.path.length ? issue.path.join(".") : "(root)";
          issues.push({ file: relative, message: `${at}: ${issue.message}` });
        }
        continue;
      }

      const equipment = result.data;
      const basename = filename.replace(/\.json$/, "");

      if (equipment.id !== basename) {
        issues.push({
          file: relative,
          message: `id "${equipment.id}" must match the filename "${basename}"`,
        });
        continue;
      }

      if (equipment.hero !== expectedHero) {
        issues.push({
          file: relative,
          message: `hero "${equipment.hero}" does not belong in /${dirSlug} (expected "${expectedHero}")`,
        });
        continue;
      }

      const clash = byId.get(equipment.id);
      if (clash) {
        issues.push({
          file: relative,
          message: `duplicate id "${equipment.id}" (also defined for ${clash.hero})`,
        });
        continue;
      }

      byId.set(equipment.id, equipment);
      byHero[equipment.hero].push(equipment);
      items.push(equipment);
    }
  }

  return { items, byId, byHero, issues };
}

let cached: EquipmentCatalog | undefined;

/**
 * Catalog for app code. Throws if any file is invalid.
 *
 * Memoised in production (the files cannot change between requests) but read
 * fresh in development, so editing a level table shows up on reload instead of
 * needing a server restart.
 */
export function getEquipmentCatalog(): EquipmentCatalog {
  if (cached && process.env.NODE_ENV === "production") return cached;

  const catalog = loadEquipmentCatalog();
  if (catalog.issues.length > 0) {
    throw new Error(
      `Invalid equipment data:\n${catalog.issues
        .map((i) => `  ${i.file} — ${i.message}`)
        .join("\n")}`,
    );
  }
  cached = catalog;
  return cached;
}

/** Equipment is hero-specific — there is no "all equipment" picker. */
export function equipmentForHero(hero: HeroId): Equipment[] {
  return getEquipmentCatalog().byHero[hero];
}
