import { describe, expect, it } from "vitest";
import { computeLoadout, diffLoadouts } from "./loadout";
import { makeEquipment, makeLevels } from "../../test/fixtures/equipment";
import { makeHeroStats, makeStubHeroStats } from "../../test/fixtures/hero";

const hero = makeHeroStats();

/** Level 10: dps 100 + 5*9 = 145, hp 1000 + 40*9 = 1360. */
const HERO_LEVEL = 10;
const HERO_DPS = 145;
const HERO_HP = 1360;

const frozen = makeEquipment({
  id: "frozen-arrow",
  name: "Frozen Arrow",
  ability: { kind: "passive", description: "Attacks freeze." },
  effectKeys: ["freezeDuration"],
  levels: makeLevels({
    count: 27,
    dmg: { base: 10, step: 5 },
    hp: { base: 100, step: 25 },
    effect: { freezeDuration: { base: 0.5, step: 0.02 } },
  }),
});

const puppet = makeEquipment({
  id: "healer-puppet",
  name: "Healer Puppet",
  rarity: "common",
  maxLevel: 18,
  ability: { kind: "instant", description: "Summons healers." },
  effectKeys: ["healerCount"],
  levels: makeLevels({
    count: 18,
    dmg: { base: 0, step: 0 },
    hp: { base: 200, step: 30 },
    effect: { healerCount: { base: 1, step: 0 } },
  }),
});

const vial = makeEquipment({
  id: "invisibility-vial",
  name: "Invisibility Vial",
  rarity: "common",
  maxLevel: 18,
  ability: { kind: "duration", description: "Go invisible." },
  effectKeys: ["invisibilityDuration", "healAmount"],
  levels: makeLevels({
    count: 18,
    effect: {
      invisibilityDuration: { base: 2, step: 0.1 },
      healAmount: { base: 50, step: 10 },
    },
  }),
});

describe("computeLoadout", () => {
  it("adds passive equipment stats onto the hero's base stats", () => {
    const result = computeLoadout({ hero, level: HERO_LEVEL }, [
      { equipment: frozen, level: 1 },
      { equipment: puppet, level: 1 },
    ]);

    expect(result.dps).toEqual({
      base: HERO_DPS,
      fromEquipment: 10,
      total: HERO_DPS + 10,
    });
    expect(result.hp).toEqual({
      base: HERO_HP,
      fromEquipment: 300,
      total: HERO_HP + 300,
    });
  });

  it("scales contributions with equipment level", () => {
    const result = computeLoadout({ hero, level: HERO_LEVEL }, [
      { equipment: frozen, level: 27 },
    ]);

    // dmg 10 + 5*26 = 140, hp 100 + 25*26 = 750
    expect(result.dps.fromEquipment).toBe(140);
    expect(result.hp.fromEquipment).toBe(750);
  });

  it("breaks the total down per slot", () => {
    const result = computeLoadout({ hero, level: HERO_LEVEL }, [
      { equipment: frozen, level: 3 },
      { equipment: puppet, level: 2 },
    ]);

    expect(result.slots.map((s) => ({ id: s.equipmentId, dmg: s.dmg, hp: s.hp }))).toEqual([
      { id: "frozen-arrow", dmg: 20, hp: 150 },
      { id: "healer-puppet", dmg: 0, hp: 230 },
    ]);
  });

  it("keeps a duration ability separate from its other effects", () => {
    const result = computeLoadout({ hero, level: HERO_LEVEL }, [
      { equipment: vial, level: 1 },
    ]);

    const ability = result.abilities[0];
    expect(ability.kind).toBe("duration");
    if (ability.kind !== "duration") throw new Error("expected a duration ability");

    expect(ability.durationSeconds).toBe(2);
    expect(ability.effects).toEqual([
      { key: "healAmount", label: "Heal amount", value: 50, unit: "number" },
    ]);
  });

  it("does not give an instant ability a duration", () => {
    const result = computeLoadout({ hero, level: HERO_LEVEL }, [
      { equipment: puppet, level: 1 },
    ]);

    const ability = result.abilities[0];
    expect(ability.kind).toBe("instant");
    expect(ability).not.toHaveProperty("durationSeconds");
    expect(ability.effects).toEqual([
      { key: "healerCount", label: "Healer count", value: 1, unit: "count" },
    ]);
  });

  it("names what effective HP does not account for", () => {
    const result = computeLoadout({ hero, level: HERO_LEVEL }, [
      { equipment: puppet, level: 1 },
      { equipment: vial, level: 1 },
    ]);

    expect(result.effectiveHp.unmodelled).toEqual([
      "Healer Puppet sustain",
      "Invisibility Vial uptime",
    ]);
  });

  describe("with missing data", () => {
    const stubPiece = makeEquipment({
      id: "magic-mirror",
      name: "Magic Mirror",
      dataQuality: "stub",
      sources: [],
      levels: [],
    });

    it("contributes zero rather than guessing", () => {
      const result = computeLoadout({ hero, level: HERO_LEVEL }, [
        { equipment: stubPiece, level: 5 },
      ]);

      expect(result.slots[0].dataAvailable).toBe(false);
      expect(result.slots[0].dmg).toBe(0);
      expect(result.slots[0].ability).toBeNull();
      expect(result.dps.total).toBe(HERO_DPS);
    });

    it("reports the loadout as incomplete and says what is missing", () => {
      const result = computeLoadout(
        { hero: makeStubHeroStats(), level: HERO_LEVEL },
        [{ equipment: stubPiece, level: 5 }],
      );

      expect(result.complete).toBe(false);
      expect(result.missing).toEqual([
        "Archer Queen base stats",
        "Magic Mirror level table",
      ]);
      expect(result.hero.dataAvailable).toBe(false);
    });

    it("is complete when every input has a table", () => {
      const result = computeLoadout({ hero, level: HERO_LEVEL }, [
        { equipment: frozen, level: 1 },
      ]);
      expect(result.complete).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("rejects a third slot", () => {
      expect(() =>
        computeLoadout({ hero, level: HERO_LEVEL }, [
          { equipment: frozen, level: 1 },
          { equipment: puppet, level: 1 },
          { equipment: vial, level: 1 },
        ]),
      ).toThrow("a hero has 2 equipment slots, got 3");
    });

    it("rejects equipment belonging to another hero", () => {
      const kingPiece = makeEquipment({ id: "giant-gauntlet", hero: "barbarian-king" });
      expect(() =>
        computeLoadout({ hero, level: HERO_LEVEL }, [
          { equipment: kingPiece, level: 1 },
        ]),
      ).toThrow(/belongs to barbarian-king, not archer-queen/);
    });

    it("rejects the same piece in both slots", () => {
      expect(() =>
        computeLoadout({ hero, level: HERO_LEVEL }, [
          { equipment: frozen, level: 1 },
          { equipment: frozen, level: 4 },
        ]),
      ).toThrow("Frozen Arrow cannot fill both slots");
    });

    it("rejects an equipment level above the rarity cap", () => {
      expect(() =>
        computeLoadout({ hero, level: HERO_LEVEL }, [
          { equipment: puppet, level: 19 },
        ]),
      ).toThrow("Healer Puppet level must be 1..18, got 19");
    });

    it("rejects a hero level above the cap", () => {
      expect(() => computeLoadout({ hero, level: 91 }, [])).toThrow(
        "Archer Queen caps at level 90, got 91",
      );
    });

    it("allows any level when the hero cap is unknown", () => {
      expect(() =>
        computeLoadout({ hero: makeStubHeroStats(), level: 200 }, []),
      ).not.toThrow();
    });
  });
});

describe("diffLoadouts", () => {
  const base = { hero, level: HERO_LEVEL };

  it("reports the delta from a to b", () => {
    const a = computeLoadout(base, [{ equipment: frozen, level: 1 }]);
    const b = computeLoadout(base, [{ equipment: frozen, level: 3 }]);

    expect(diffLoadouts(a, b)).toEqual({
      dps: 10,
      hp: 50,
      effectiveHp: 50,
      comparable: true,
    });
  });

  it("flags the comparison as unusable when either side is missing data", () => {
    const a = computeLoadout(base, [{ equipment: frozen, level: 1 }]);
    const b = computeLoadout(
      { hero: makeStubHeroStats(), level: HERO_LEVEL },
      [],
    );

    expect(diffLoadouts(a, b).comparable).toBe(false);
  });
});
