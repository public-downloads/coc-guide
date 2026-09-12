import fs from "node:fs";
import path from "node:path";
import { heroStatsSchema, type HeroId, type HeroStats } from "../schema/hero";
import type { CatalogIssue } from "./catalog";

export interface HeroStatsCatalog {
  items: HeroStats[];
  byId: Map<HeroId, HeroStats>;
  issues: CatalogIssue[];
}

export const DEFAULT_HERO_DATA_ROOT = path.join(process.cwd(), "data", "heroes");

/**
 * Base hero stats, one file per hero. Same collect-don't-throw contract as
 * {@link import("./catalog").loadEquipmentCatalog}.
 */
export function loadHeroStats(
  dataRoot: string = DEFAULT_HERO_DATA_ROOT,
): HeroStatsCatalog {
  const items: HeroStats[] = [];
  const issues: CatalogIssue[] = [];
  const byId = new Map<HeroId, HeroStats>();

  if (!fs.existsSync(dataRoot)) {
    issues.push({ file: dataRoot, message: "hero data root does not exist" });
    return { items, byId, issues };
  }

  for (const filename of fs.readdirSync(dataRoot).sort()) {
    if (!filename.endsWith(".json")) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(dataRoot, filename), "utf8"));
    } catch (err) {
      issues.push({
        file: filename,
        message: `invalid JSON: ${(err as Error).message}`,
      });
      continue;
    }

    const result = heroStatsSchema.safeParse(parsed);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const at = issue.path.length ? issue.path.join(".") : "(root)";
        issues.push({ file: filename, message: `${at}: ${issue.message}` });
      }
      continue;
    }

    const hero = result.data;
    const basename = filename.replace(/\.json$/, "");
    if (hero.id !== basename) {
      issues.push({
        file: filename,
        message: `id "${hero.id}" must match the filename "${basename}"`,
      });
      continue;
    }
    if (byId.has(hero.id)) {
      issues.push({ file: filename, message: `duplicate hero "${hero.id}"` });
      continue;
    }

    byId.set(hero.id, hero);
    items.push(hero);
  }

  return { items, byId, issues };
}

let cached: HeroStatsCatalog | undefined;

/** Memoised in production, read fresh in development. See `getEquipmentCatalog`. */
export function getHeroStats(): HeroStatsCatalog {
  if (cached && process.env.NODE_ENV === "production") return cached;

  const catalog = loadHeroStats();
  if (catalog.issues.length > 0) {
    throw new Error(
      `Invalid hero data:\n${catalog.issues
        .map((i) => `  ${i.file} — ${i.message}`)
        .join("\n")}`,
    );
  }
  cached = catalog;
  return cached;
}

export function heroStatsFor(hero: HeroId): HeroStats | undefined {
  return getHeroStats().byId.get(hero);
}
