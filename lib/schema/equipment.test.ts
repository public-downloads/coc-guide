import { describe, expect, it } from "vitest";
import {
  cumulativeOreCost,
  equipmentSchema,
  RARITY_MAX_LEVEL,
} from "./equipment";
import { makeEquipment, makeLevels } from "../../test/fixtures/equipment";

function messages(input: unknown): string[] {
  const result = equipmentSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

describe("equipmentSchema", () => {
  it("accepts a well-formed epic piece", () => {
    expect(equipmentSchema.safeParse(makeEquipment()).success).toBe(true);
  });

  it("accepts a well-formed common piece", () => {
    const common = makeEquipment({
      rarity: "common",
      maxLevel: RARITY_MAX_LEVEL.common,
      levels: makeLevels({
        count: RARITY_MAX_LEVEL.common,
        effect: { testDuration: { base: 1, step: 0.1 } },
      }),
    });
    expect(equipmentSchema.safeParse(common).success).toBe(true);
  });

  it("rejects a common piece claiming the epic cap", () => {
    const bad = makeEquipment({ rarity: "common", maxLevel: 27 });
    expect(messages(bad)).toContainEqual(
      "maxLevel: common equipment caps at 18, got 27",
    );
  });

  it("rejects an epic piece claiming the common cap", () => {
    const bad = makeEquipment({
      rarity: "epic",
      maxLevel: 18,
      levels: makeLevels({
        count: 18,
        effect: { testDuration: { base: 1, step: 0.1 } },
      }),
    });
    expect(messages(bad)).toContainEqual(
      "maxLevel: epic equipment caps at 27, got 18",
    );
  });

  it("rejects a level table shorter than maxLevel", () => {
    const bad = makeEquipment({
      levels: makeLevels({
        count: 26,
        effect: { testDuration: { base: 1, step: 0.1 } },
      }),
    });
    expect(messages(bad)).toContainEqual(
      "levels: expected 27 level rows, got 26",
    );
  });

  it("rejects a gap in the level sequence", () => {
    const levels = makeLevels({
      count: 27,
      effect: { testDuration: { base: 1, step: 0.1 } },
    });
    levels[12] = { ...levels[12], lvl: 14 };
    expect(messages(makeEquipment({ levels }))).toContainEqual(
      "levels.12.lvl: level rows must run 1..27 in order — expected 13, got 14",
    );
  });

  it("rejects a level whose effect keys drift from effectKeys", () => {
    const levels = makeLevels({
      count: 27,
      effect: { testDuration: { base: 1, step: 0.1 } },
    });
    levels[5] = { ...levels[5], effect: { testDurationn: 1.5 } };
    expect(messages(makeEquipment({ levels }))).toContainEqual(
      "levels.5.effect: effect keys must match effectKeys [testDuration], got [testDurationn]",
    );
  });

  it("rejects damage that decreases with level", () => {
    const levels = makeLevels({
      count: 27,
      effect: { testDuration: { base: 1, step: 0.1 } },
    });
    levels[9] = { ...levels[9], dmg: 0 };
    expect(messages(makeEquipment({ levels }))).toContainEqual(
      "levels.9.dmg: dmg must not decrease with level (50 -> 0)",
    );
  });

  it("rejects an ore cost on level 1", () => {
    const levels = makeLevels({
      count: 27,
      effect: { testDuration: { base: 1, step: 0.1 } },
    });
    levels[0] = {
      ...levels[0],
      oreCost: { shiny: 10, glowy: 0, starry: 0 },
    };
    expect(messages(makeEquipment({ levels }))).toContainEqual(
      "levels.0.oreCost: level 1 is granted free — ore cost must be all zeroes",
    );
  });

  it("rejects a duration ability with no duration effect key", () => {
    const bad = makeEquipment({
      ability: { kind: "duration", description: "Test." },
      effectKeys: ["healAmount"],
      levels: makeLevels({
        count: 27,
        effect: { healAmount: { base: 10, step: 1 } },
      }),
    });
    expect(messages(bad)).toContainEqual(
      'effectKeys: duration abilities need at least one effect key ending in "Duration"',
    );
  });

  it("rejects non-stub data with no cited source", () => {
    expect(messages(makeEquipment({ sources: [] }))).toContainEqual(
      "sources: non-stub equipment must cite at least one source",
    );
  });

  it("rejects a non-kebab-case id", () => {
    expect(messages(makeEquipment({ id: "Frozen Arrow" }))).toContainEqual(
      "id: must be a lowercase kebab-case slug",
    );
  });

  it("rejects a malformed gameVersion", () => {
    expect(messages(makeEquipment({ gameVersion: "v2025" }))).toContainEqual(
      'gameVersion: must look like "2025.10"',
    );
  });

  describe("stub data", () => {
    const stub = makeEquipment({
      dataQuality: "stub",
      sources: [],
      levels: [],
    });

    it("is accepted with an empty level table and no sources", () => {
      expect(equipmentSchema.safeParse(stub).success).toBe(true);
    });

    it("is rejected once it carries levels", () => {
      const bad = { ...stub, levels: makeLevels({ count: 2 }) };
      expect(messages(bad)).toContainEqual(
        "levels: stub equipment must have an empty level table — promote it to unverified once filled in",
      );
    });

    it("still has to respect the rarity cap", () => {
      expect(messages({ ...stub, rarity: "common" })).toContainEqual(
        "maxLevel: common equipment caps at 18, got 27",
      );
    });
  });
});

describe("cumulativeOreCost", () => {
  const piece = makeEquipment();

  it("is free at level 1", () => {
    expect(cumulativeOreCost(piece, 1)).toEqual({
      shiny: 0,
      glowy: 0,
      starry: 0,
    });
  });

  it("sums every upgrade up to the requested level", () => {
    // makeLevels ramps shiny by 120 per level: 120 + 240 = 360 by level 3.
    expect(cumulativeOreCost(piece, 3)).toEqual({
      shiny: 360,
      glowy: 90,
      starry: 0,
    });
  });
});
