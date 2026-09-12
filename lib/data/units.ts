import fs from "node:fs";
import path from "node:path";
import { unitCatalogSchema, type Unit } from "../schema/unit";
import type { CatalogIssue } from "./catalog";

/** The unit registry — categories and housing space. See `lib/schema/unit.ts`. */
export const UNITS_FILE = path.join(process.cwd(), "data", "units.json");

export interface UnitData {
  units: Unit[];
  byId: Map<string, Unit>;
  issues: CatalogIssue[];
}

export function loadUnits(file: string = UNITS_FILE): UnitData {
  const issues: CatalogIssue[] = [];

  if (!fs.existsSync(file)) {
    issues.push({ file: "units.json", message: "file does not exist" });
    return { units: [], byId: new Map(), issues };
  }

  const parsed = unitCatalogSchema.safeParse(
    JSON.parse(fs.readFileSync(file, "utf8")),
  );
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        file: "units.json",
        message: `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      });
    }
    return { units: [], byId: new Map(), issues };
  }

  const byId = new Map<string, Unit>();
  for (const unit of parsed.data.units) {
    if (byId.has(unit.id)) {
      issues.push({ file: "units.json", message: `duplicate id: ${unit.id}` });
      continue;
    }
    byId.set(unit.id, unit);
  }

  return { units: parsed.data.units, byId, issues };
}

let cached: UnitData | undefined;

/** Memoised in production, read fresh in development. */
export function getUnits(): UnitData {
  if (cached && process.env.NODE_ENV === "production") return cached;
  cached = loadUnits();
  return cached;
}
