import fs from "node:fs";
import path from "node:path";
import { capacityTablesSchema, type CapacityTables } from "../schema/capacity";
import type { CatalogIssue } from "./catalog";

/**
 * The filesystem half of the capacity tables. The schema and the maths live in
 * `lib/schema/capacity.ts` so the studio can import them in a browser; this
 * file only finds, parses and caches `data/capacity.json`.
 */

export {
  capacityAt,
  capacityTablesSchema,
  type Capacity,
  type CapacityTables,
} from "../schema/capacity";

export const CAPACITY_FILE = path.join(process.cwd(), "data", "capacity.json");

export interface CapacityData {
  tables: CapacityTables | null;
  issues: CatalogIssue[];
}

export function loadCapacity(file: string = CAPACITY_FILE): CapacityData {
  if (!fs.existsSync(file)) {
    return { tables: null, issues: [{ file: "capacity.json", message: "file does not exist" }] };
  }

  const parsed = capacityTablesSchema.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
  if (!parsed.success) {
    return {
      tables: null,
      issues: parsed.error.issues.map((issue) => ({
        file: "capacity.json",
        message: `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      })),
    };
  }

  return { tables: parsed.data, issues: [] };
}

let cached: CapacityData | undefined;

export function getCapacity(): CapacityData {
  if (cached && process.env.NODE_ENV === "production") return cached;
  cached = loadCapacity();
  return cached;
}
