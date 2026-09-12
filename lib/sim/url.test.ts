import { describe, expect, it } from "vitest";
import {
  DEFAULT_HERO_LEVEL,
  emptyBuild,
  encodeBuild,
  parseBuild,
  type BuildResolver,
  type BuildState,
} from "./url";

const resolver: BuildResolver = {
  heroMaxLevel: (heroId) => (heroId === "archer-queen" ? 90 : null),
  equipment: (heroId, equipmentId) => {
    if (heroId !== "archer-queen") return undefined;
    const caps: Record<string, number> = {
      "frozen-arrow": 27,
      "magic-mirror": 27,
      "healer-puppet": 18,
      "giant-arrow": 18,
    };
    const maxLevel = caps[equipmentId];
    return maxLevel === undefined ? undefined : { maxLevel };
  },
};

function parse(query: string) {
  return parseBuild(new URLSearchParams(query), resolver);
}

describe("encodeBuild", () => {
  it("produces the shareable form from the plan", () => {
    const build: BuildState = {
      heroId: "archer-queen",
      heroLevel: DEFAULT_HERO_LEVEL,
      slots: [
        { equipmentId: "frozen-arrow", level: 12 },
        { equipmentId: "healer-puppet", level: 18 },
      ],
      compare: null,
    };

    expect(encodeBuild(build)).toBe(
      "hero=queen&e1=frozen-arrow%3A12&e2=healer-puppet%3A18",
    );
  });

  it("omits empty slots and a default hero level", () => {
    expect(encodeBuild(emptyBuild("archer-queen"))).toBe("hero=queen");
  });

  it("includes the hero level once it is set", () => {
    const build = { ...emptyBuild("archer-queen"), heroLevel: 90 };
    expect(encodeBuild(build)).toBe("hero=queen&hl=90");
  });

  it("round-trips through parseBuild", () => {
    const build: BuildState = {
      heroId: "archer-queen",
      heroLevel: 75,
      slots: [
        { equipmentId: "frozen-arrow", level: 27 },
        { equipmentId: "healer-puppet", level: 9 },
      ],
      compare: [{ equipmentId: "magic-mirror", level: 5 }, null],
    };

    const result = parse(encodeBuild(build));
    expect(result.errors).toEqual([]);
    expect(result.build).toEqual(build);
  });
});

describe("parseBuild", () => {
  it("reads a hero and both slots", () => {
    const result = parse("hero=queen&hl=80&e1=frozen-arrow:12&e2=healer-puppet:18");

    expect(result.errors).toEqual([]);
    expect(result.build).toEqual({
      heroId: "archer-queen",
      heroLevel: 80,
      slots: [
        { equipmentId: "frozen-arrow", level: 12 },
        { equipmentId: "healer-puppet", level: 18 },
      ],
      compare: null,
    });
  });

  it("defaults the hero level when the link omits it", () => {
    expect(parse("hero=queen").build?.heroLevel).toBe(DEFAULT_HERO_LEVEL);
  });

  it("defaults a slot with no level to 1", () => {
    expect(parse("hero=queen&e1=frozen-arrow").build?.slots[0]).toEqual({
      equipmentId: "frozen-arrow",
      level: 1,
    });
  });

  it("returns no build when the hero is missing", () => {
    expect(parse("e1=frozen-arrow:12")).toEqual({
      build: null,
      errors: ["no hero in the link"],
    });
  });

  it("returns no build for an unknown hero", () => {
    expect(parse("hero=sidekick")).toEqual({
      build: null,
      errors: ['unknown hero "sidekick"'],
    });
  });

  describe("degrading a stale link", () => {
    it("drops equipment the hero cannot use, keeping the rest", () => {
      const result = parse("hero=queen&e1=giant-gauntlet:9&e2=frozen-arrow:12");

      expect(result.errors).toEqual([
        '"giant-gauntlet" is not Archer Queen equipment — dropped',
      ]);
      expect(result.build?.slots).toEqual([
        null,
        { equipmentId: "frozen-arrow", level: 12 },
      ]);
    });

    it("clamps an equipment level above the rarity cap", () => {
      const result = parse("hero=queen&e1=healer-puppet:27");

      expect(result.errors).toEqual([
        "healer-puppet level 27 is above its level 18 cap — clamped",
      ]);
      expect(result.build?.slots[0]).toEqual({
        equipmentId: "healer-puppet",
        level: 18,
      });
    });

    it("clamps a hero level above the cap", () => {
      const result = parse("hero=queen&hl=200");

      expect(result.errors).toEqual([
        "hero level 200 is above the level 90 cap — clamped",
      ]);
      expect(result.build?.heroLevel).toBe(90);
    });

    it("leaves the hero level alone when the cap is unknown", () => {
      const result = parse("hero=king&hl=200");
      expect(result.errors).toEqual([]);
      expect(result.build?.heroLevel).toBe(200);
    });

    it("ignores a malformed slot", () => {
      const result = parse("hero=queen&e1=Frozen_Arrow:12");
      expect(result.errors).toEqual(['ignored malformed slot "Frozen_Arrow:12"']);
      expect(result.build?.slots[0]).toBeNull();
    });

    it("ignores a non-numeric hero level", () => {
      const result = parse("hero=queen&hl=max");
      expect(result.errors).toEqual(['ignored hero level "max"']);
      expect(result.build?.heroLevel).toBe(DEFAULT_HERO_LEVEL);
    });

    it("clears the second slot when a piece is repeated", () => {
      const result = parse("hero=queen&e1=frozen-arrow:12&e2=frozen-arrow:20");

      expect(result.errors).toEqual([
        "frozen-arrow cannot fill both slots — second slot cleared",
      ]);
      expect(result.build?.slots).toEqual([
        { equipmentId: "frozen-arrow", level: 12 },
        null,
      ]);
    });
  });

  describe("comparison mode", () => {
    it("is off unless cmp=1", () => {
      expect(parse("hero=queen&c1=frozen-arrow:12").build?.compare).toBeNull();
    });

    it("reads the second loadout when on", () => {
      const result = parse("hero=queen&cmp=1&c1=frozen-arrow:12");
      expect(result.build?.compare).toEqual([
        { equipmentId: "frozen-arrow", level: 12 },
        null,
      ]);
    });
  });
});
