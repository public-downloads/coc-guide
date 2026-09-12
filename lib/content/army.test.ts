import { describe, expect, it } from "vitest";
import {
  armyViolations,
  castleUse,
  formatArmy,
  groupArmy,
  parseArmy,
} from "./army";
import type { UnitCategory } from "../schema/unit";

/** Synthetic registry — the suite never reads `/data`. */
const registry = new Map<
  string,
  { category: UnitCategory; housingSpace: number | null }
>([
  ["hog-rider", { category: "dark-troop", housingSpace: 5 }],
  ["healer", { category: "troop", housingSpace: 14 }],
  ["freeze-spell", { category: "spell", housingSpace: 1 }],
  ["wall-wrecker", { category: "siege", housingSpace: 1 }],
  ["barbarian-king", { category: "hero", housingSpace: null }],
  ["lassi", { category: "pet", housingSpace: null }],
  ["thrower", { category: "troop", housingSpace: null }],
]);

describe("parseArmy", () => {
  it("reads a bare list of ids", () => {
    expect(parseArmy("hog-rider, miner, healer")).toEqual([
      { id: "hog-rider" },
      { id: "miner" },
      { id: "healer" },
    ]);
  });

  it("reads counts and levels in either order", () => {
    expect(parseArmy("hog-rider x12 l10, healer l7 x4")).toEqual([
      { id: "hog-rider", count: 12, level: 10 },
      { id: "healer", count: 4, level: 7 },
    ]);
  });

  it("reads the hero a pet rides with", () => {
    // Any pet can walk beside any hero, so which one is a fact about this
    // army rather than about the pet — the registry cannot supply it.
    expect(parseArmy("frosty l10 @archer-queen, lassi @barbarian-king")).toEqual([
      { id: "frosty", level: 10, carrier: "archer-queen" },
      { id: "lassi", carrier: "barbarian-king" },
    ]);
  });

  it("ignores a modifier it does not understand", () => {
    expect(parseArmy("hog-rider x12 wat")).toEqual([
      { id: "hog-rider", count: 12 },
    ]);
  });

  it("tolerates ragged whitespace and empty entries", () => {
    expect(parseArmy("  hog-rider   x12 ,, healer,")).toEqual([
      { id: "hog-rider", count: 12 },
      { id: "healer" },
    ]);
  });
});

describe("formatArmy", () => {
  it("round-trips whatever parseArmy read", () => {
    // The studio reads the tag, edits it and writes it back, so anything lost
    // here is lost from the guide.
    const spec =
      "hog-rider x12 l10, cc:ice-golem x1, barbarian-king l95, frosty l10 @archer-queen, healer";
    expect(formatArmy(parseArmy(spec))).toBe(spec);
  });

  it("emits only the modifiers that were set", () => {
    // A comp picked with no counts should not sprout a cosmetic x1 per unit.
    expect(formatArmy([{ id: "lava-hound" }, { id: "balloon" }])).toBe(
      "lava-hound, balloon",
    );
  });
});

describe("groupArmy", () => {
  const group = (spec: string) => groupArmy(parseArmy(spec), registry);

  it("splits into the in-game compartments, in tab order", () => {
    // Written in a deliberately jumbled order: the output follows ARMY_TABS,
    // which leads with the heroes the way the army screen does.
    const spec = "freeze-spell x2, barbarian-king l80, hog-rider x12, wall-wrecker";
    expect(group(spec).map((s) => s.tab)).toEqual([
      "heroes",
      "army",
      "spells",
      "sieges",
    ]);
  });

  it("counts units and totals housing space", () => {
    const [army] = group("hog-rider x12, healer x4");
    expect(army.units).toBe(16);
    expect(army.space).toBe(12 * 5 + 4 * 14);
  });

  it("reports unknown space rather than a partial total", () => {
    // A guide that says "60 space" while three troops are uncompiled is worse
    // than one that says it does not know.
    const [army] = group("hog-rider x12, thrower x3");
    expect(army.space).toBeNull();
    expect(army.unknown).toEqual(["thrower"]);
    expect(army.units).toBe(15);
  });

  it("does not count heroes or pets as camp units", () => {
    const [heroes] = group("barbarian-king l80, lassi l10");
    expect(heroes.tab).toBe("heroes");
    expect(heroes.units).toBe(0);
    expect(heroes.space).toBe(0);
    expect(heroes.unknown).toEqual([]);
  });

  it("keeps an unregistered slug visible instead of dropping it", () => {
    const [army] = group("mystery-troop x2");
    expect(army.entries[0]).toMatchObject({ id: "mystery-troop", category: "troop" });
    expect(army.space).toBeNull();
  });
});

describe("clan castle entries", () => {
  it("routes cc: into its own compartment, whatever the unit is", () => {
    const sections = groupArmy(
      parseArmy("hog-rider x12, cc:healer x1, cc:freeze-spell x1"),
      registry,
    );
    expect(sections.map((s) => s.tab)).toEqual(["army", "clan-castle"]);
    expect(sections[1].entries.map((e) => e.id)).toEqual(["healer", "freeze-spell"]);
  });

  it("keeps the castle's space out of the camp's", () => {
    const [army, cc] = groupArmy(parseArmy("healer x4, cc:healer x1"), registry);
    expect(army.space).toBe(4 * 14);
    expect(cc.space).toBe(14);
  });

  it("splits the castle three ways, as the castle counts", () => {
    // Troops, spells and sieges are three separate capacities; totalling the
    // compartment as one number measures a donated Freeze against the troops.
    const [cc] = groupArmy(
      parseArmy("cc:healer x1, cc:freeze-spell x2, cc:wall-wrecker x1"),
      registry,
    );
    expect(castleUse(cc)).toEqual({ troops: 14, spells: 2, sieges: 1 });
  });

  it("reports an unknown castle slot without poisoning the others", () => {
    const [cc] = groupArmy(parseArmy("cc:thrower x1, cc:freeze-spell x1"), registry);
    expect(castleUse(cc)).toEqual({ troops: null, spells: 1, sieges: 0 });
  });
});

describe("armyViolations", () => {
  const rules = new Map([
    ["frozen-arrow", { category: "equipment" as const, hero: "archer-queen" }],
    ["healer-puppet", { category: "equipment" as const, hero: "archer-queen" }],
    ["giant-arrow", { category: "equipment" as const, hero: "archer-queen" }],
    ["rage-vial", { category: "equipment" as const, hero: "barbarian-king" }],
    ["super-witch", { category: "super-troop" as const }],
    ["super-archer", { category: "super-troop" as const }],
    ["super-giant", { category: "super-troop" as const }],
  ]);
  const check = (spec: string) => armyViolations(parseArmy(spec), rules);

  it("passes two pieces per hero", () => {
    expect(check("frozen-arrow, healer-puppet, rage-vial")).toEqual([]);
  });

  it("flags a third piece on one hero, counting per hero", () => {
    const [violation] = check("frozen-arrow, healer-puppet, giant-arrow, rage-vial");
    expect(violation.rule).toBe("equipment-per-hero");
    expect(violation.ids).toHaveLength(3);
  });

  it("flags a third distinct super troop", () => {
    expect(check("super-witch, super-archer")).toEqual([]);
    expect(check("super-witch, super-archer, super-giant")[0].rule).toBe("super-troops");
  });
});

describe("hero and pet limits", () => {
  const roster = new Map([
    ["barbarian-king", { category: "hero" as const }],
    ["archer-queen", { category: "hero" as const }],
    ["grand-warden", { category: "hero" as const }],
    ["royal-champion", { category: "hero" as const }],
    ["minion-prince", { category: "hero" as const }],
    ["lassi", { category: "pet" as const }],
    ["frosty", { category: "pet" as const }],
  ]);
  const check = (spec: string) => armyViolations(parseArmy(spec), roster);

  it("allows four heroes and refuses a fifth", () => {
    const four = "barbarian-king, archer-queen, grand-warden, royal-champion";
    expect(check(four)).toEqual([]);
    expect(check(`${four}, minion-prince`)[0].rule).toBe("heroes");
  });

  it("gives each hero one pet", () => {
    expect(check("barbarian-king, archer-queen, lassi, frosty")).toEqual([]);
    expect(check("barbarian-king, lassi, frosty")[0].rule).toBe("pets");
  });

  it("refuses a pet with no hero to ride with", () => {
    expect(check("lassi")[0].message).toBe("a pet needs a hero to ride with");
  });
});

describe("compartment ordering", () => {
  const mixed = new Map<string, { category: UnitCategory; housingSpace: number | null }>([
    ["super-witch", { category: "super-troop", housingSpace: 40 }],
    ["hog-rider", { category: "dark-troop", housingSpace: 5 }],
    ["healer", { category: "troop", housingSpace: 14 }],
    ["miner", { category: "troop", housingSpace: 6 }],
  ]);

  it("lists elixir troops, then dark, then super", () => {
    const [army] = groupArmy(
      parseArmy("super-witch x2, hog-rider x12, healer x4, miner x6"),
      mixed,
    );
    expect(army.entries.map((e) => e.id)).toEqual([
      "healer",
      "miner",
      "hog-rider",
      "super-witch",
    ]);
  });

  it("keeps the author's order within one category", () => {
    const [army] = groupArmy(parseArmy("miner x6, healer x4"), mixed);
    expect(army.entries.map((e) => e.id)).toEqual(["miner", "healer"]);
  });
});
