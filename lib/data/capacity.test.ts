import { describe, expect, it } from "vitest";
import { capacityAt, type CapacityTables } from "./capacity";

/** Synthetic tables — the suite never reads `/data`. */
const tables: CapacityTables = {
  campsPerTownHall: { "1": 1, "5": 3, "9": 4, "17": 4 },
  armyCamp: [
    { level: 1, troopCapacity: 20, townHall: 1 },
    { level: 5, troopCapacity: 45, townHall: 5 },
    { level: 13, troopCapacity: 85, townHall: 17 },
  ],
  spellFactory: [
    { level: 1, spellCapacity: 2, townHall: 5 },
    { level: 5, spellCapacity: 10, townHall: 10 },
  ],
  darkSpellFactory: [{ level: 1, spellCapacity: 1, townHall: 8 }],
  clanCastle: [
    { level: 1, troopCapacity: 10, spellCapacity: 0, siegeCapacity: 0, townHall: 2 },
    { level: 13, troopCapacity: 55, spellCapacity: 3, siegeCapacity: 2, townHall: 17 },
  ],
};

describe("capacityAt", () => {
  it("multiplies camps by the best camp that Town Hall allows", () => {
    expect(capacityAt(tables, 17).troops).toBe(85 * 4);
    expect(capacityAt(tables, 5).troops).toBe(45 * 3);
  });

  it("does not count a building the Town Hall has not reached", () => {
    // TH9 cannot build the level-13 camp, so it is still on the level-5 one.
    expect(capacityAt(tables, 9).troops).toBe(45 * 4);
  });

  it("reads the castle row for the Town Hall", () => {
    expect(capacityAt(tables, 17).clanCastle).toEqual({
      troops: 55,
      spells: 3,
      sieges: 2,
    });
  });

  it("adds the dark spell factory's slot once it exists", () => {
    expect(capacityAt(tables, 5).spells).toBe(2); // no dark factory yet
    expect(capacityAt(tables, 10).spells).toBe(10 + 1);
  });

  it("returns null below the first row rather than guessing", () => {
    expect(capacityAt(tables, 1).spells).toBeNull();
    expect(capacityAt(tables, 1).clanCastle).toBeNull();
  });
});
