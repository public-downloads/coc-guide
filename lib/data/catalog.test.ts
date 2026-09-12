import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_DATA_ROOT, loadEquipmentCatalog } from "./catalog";
import { HERO_IDS } from "../schema/hero";
import { makeEquipment } from "../../test/fixtures/equipment";

const tempRoots: string[] = [];

function withFiles(files: Record<string, unknown>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coc-data-"));
  tempRoots.push(root);
  for (const [relative, contents] of Object.entries(files)) {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(
      full,
      typeof contents === "string" ? contents : JSON.stringify(contents),
    );
  }
  return root;
}

afterEach(() => {
  let root: string | undefined;
  while ((root = tempRoots.pop())) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("the real /data catalog", () => {
  const catalog = loadEquipmentCatalog(DEFAULT_DATA_ROOT);

  it("has no validation issues", () => {
    expect(catalog.issues).toEqual([]);
  });

  it("loads the Archer Queen's equipment", () => {
    const ids = catalog.byHero["archer-queen"].map((e) => e.id);
    // Not an exhaustive list — the catalogue grows with every patch.
    expect(ids).toEqual(
      expect.arrayContaining([
        "frozen-arrow",
        "giant-arrow",
        "healer-puppet",
        "invisibility-vial",
      ]),
    );
  });

  it("gives every hero at least one piece", () => {
    for (const hero of HERO_IDS) {
      expect(catalog.byHero[hero].length).toBeGreaterThan(0);
    }
  });

  it("keeps every piece hero-specific", () => {
    for (const [hero, items] of Object.entries(catalog.byHero)) {
      for (const item of items) expect(item.hero).toBe(hero);
    }
  });

  it("respects the rarity caps", () => {
    for (const item of catalog.items) {
      expect(item.maxLevel).toBe(item.rarity === "common" ? 18 : 27);
    }
  });
});

describe("loadEquipmentCatalog", () => {
  it("flags a file whose id does not match its filename", () => {
    const root = withFiles({
      "queen/frozen-arrow.json": makeEquipment({
        id: "frozen-arrows",
        dataQuality: "stub",
        sources: [],
        levels: [],
      }),
    });
    expect(loadEquipmentCatalog(root).issues).toEqual([
      {
        file: "queen/frozen-arrow.json",
        message: 'id "frozen-arrows" must match the filename "frozen-arrow"',
      },
    ]);
  });

  it("flags equipment filed under the wrong hero", () => {
    const root = withFiles({
      "king/frozen-arrow.json": makeEquipment({
        id: "frozen-arrow",
        hero: "archer-queen",
        dataQuality: "stub",
        sources: [],
        levels: [],
      }),
    });
    expect(loadEquipmentCatalog(root).issues).toEqual([
      {
        file: "king/frozen-arrow.json",
        message:
          'hero "archer-queen" does not belong in /king (expected "barbarian-king")',
      },
    ]);
  });

  it("flags an unknown hero directory", () => {
    const root = withFiles({ "sidekick/thing.json": makeEquipment() });
    expect(loadEquipmentCatalog(root).issues[0].message).toMatch(
      /not a known hero directory/,
    );
  });

  it("flags malformed JSON without throwing", () => {
    const root = withFiles({ "queen/frozen-arrow.json": "{ nope" });
    expect(loadEquipmentCatalog(root).issues[0].message).toMatch(
      /^invalid JSON/,
    );
  });

  it("reports schema issues with the file they came from", () => {
    const root = withFiles({
      "queen/giant-arrow.json": makeEquipment({
        id: "giant-arrow",
        rarity: "common",
        maxLevel: 27,
        dataQuality: "stub",
        sources: [],
        levels: [],
      }),
    });
    expect(loadEquipmentCatalog(root).issues).toEqual([
      {
        file: "queen/giant-arrow.json",
        message: "maxLevel: common equipment caps at 18, got 27",
      },
    ]);
  });
});
