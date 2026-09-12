import fs from "node:fs";
import path from "node:path";
import {
  baseLayoutSchema,
  buildingCatalogSchema,
  VILLAGE_SIZE,
  type BaseLayout,
  type BuildingCatalog,
  type BuildingType,
} from "../schema/building";
import { overlapViolations } from "../practice/placement";
import { findImage } from "./art";
import type { CatalogIssue } from "./catalog";

export const BUILDINGS_FILE = path.join(process.cwd(), "data", "buildings.json");
export const BASES_ROOT = path.join(process.cwd(), "data", "bases");

/** Drop-in art: `public/buildings/<type id>.png` and it just appears. */
export const BUILDING_IMAGE_DIR = path.join(process.cwd(), "public", "buildings");

function findBuildingImage(typeId: string): string | undefined {
  return findImage(BUILDING_IMAGE_DIR, typeId, "/buildings");
}

export interface PracticeData {
  buildings: BuildingCatalog | null;
  bases: BaseLayout[];
  issues: CatalogIssue[];
}

export function loadPracticeData(
  buildingsFile: string = BUILDINGS_FILE,
  basesRoot: string = BASES_ROOT,
): PracticeData {
  const issues: CatalogIssue[] = [];
  let buildings: BuildingCatalog | null = null;

  if (!fs.existsSync(buildingsFile)) {
    issues.push({ file: "buildings.json", message: "file does not exist" });
  } else {
    const parsed = buildingCatalogSchema.safeParse(
      JSON.parse(fs.readFileSync(buildingsFile, "utf8")),
    );
    if (parsed.success) {
      buildings = {
        ...parsed.data,
        types: parsed.data.types.map((type) => ({
          ...type,
          image: type.image ?? findBuildingImage(type.id),
        })),
      };
    } else {
      for (const issue of parsed.error.issues) {
        issues.push({
          file: "buildings.json",
          message: `${issue.path.join(".") || "(root)"}: ${issue.message}`,
        });
      }
    }
  }

  const byType = new Map<string, BuildingType>(
    (buildings?.types ?? []).map((t) => [t.id, t]),
  );
  const bases: BaseLayout[] = [];

  if (fs.existsSync(basesRoot)) {
    for (const filename of fs.readdirSync(basesRoot).sort()) {
      if (!filename.endsWith(".json")) continue;

      const parsed = baseLayoutSchema.safeParse(
        JSON.parse(fs.readFileSync(path.join(basesRoot, filename), "utf8")),
      );
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          issues.push({
            file: filename,
            message: `${issue.path.join(".") || "(root)"}: ${issue.message}`,
          });
        }
        continue;
      }

      const base = parsed.data;
      if (base.id !== filename.replace(/\.json$/, "")) {
        issues.push({
          file: filename,
          message: `id "${base.id}" must match the filename`,
        });
        continue;
      }

      // Footprints have to fit; the schema only knows the top-left tile.
      base.buildings.forEach((b, i) => {
        const type = byType.get(b.typeId);
        if (!type) {
          issues.push({
            file: filename,
            message: `buildings.${i}: unknown type "${b.typeId}"`,
          });
        } else if (b.x + type.size > VILLAGE_SIZE || b.y + type.size > VILLAGE_SIZE) {
          issues.push({
            file: filename,
            message: `buildings.${i}: ${type.name} at (${b.x}, ${b.y}) runs past the village edge`,
          });
        }
      });

      // Buildings may touch, but never share a tile.
      const placed = base.buildings.map((b, i) => ({
        id: String(i),
        typeId: b.typeId,
        x: b.x,
        y: b.y,
      }));
      for (const { a, b } of overlapViolations(placed, (id) => byType.get(id))) {
        issues.push({
          file: filename,
          message: `buildings.${a} and buildings.${b} overlap`,
        });
      }

      bases.push(base);
    }
  }

  return { buildings, bases, issues };
}

let cached: PracticeData | undefined;

/** Memoised in production, read fresh in development. */
export function getPracticeData(): PracticeData {
  if (cached && process.env.NODE_ENV === "production") return cached;

  const data = loadPracticeData();
  if (data.issues.length > 0) {
    throw new Error(
      `Invalid practice data:\n${data.issues
        .map((i) => `  ${i.file} — ${i.message}`)
        .join("\n")}`,
    );
  }
  cached = data;
  return cached;
}
