import { describe, expect, it } from "vitest";
import {
  decodeLayout,
  decodePoint,
  decodeStand,
  encodeLayout,
  encodePoint,
  encodeStand,
} from "./layout";
import type { PlacedBuilding } from "../schema/building";

const TYPE_IDS = ["town-hall", "air-defense", "cannon"];

describe("layout encoding", () => {
  const buildings: PlacedBuilding[] = [
    { id: "b0", typeId: "town-hall", x: 20, y: 20 },
    { id: "b1", typeId: "cannon", x: 5, y: 41 },
  ];

  it("uses three characters per building", () => {
    expect(encodeLayout(buildings, TYPE_IDS)).toHaveLength(6);
  });

  it("round-trips", () => {
    const encoded = encodeLayout(buildings, TYPE_IDS);
    const decoded = decodeLayout(encoded, TYPE_IDS);

    expect(decoded.errors).toEqual([]);
    expect(decoded.buildings).toEqual([
      { id: "b0", typeId: "town-hall", x: 20, y: 20 },
      { id: "b1", typeId: "cannon", x: 5, y: 41 },
    ]);
  });

  it("stays short enough to share for a full base", () => {
    const full: PlacedBuilding[] = Array.from({ length: 60 }, (_, i) => ({
      id: `b${i}`,
      typeId: "cannon",
      x: i % 40,
      y: Math.floor(i / 40),
    }));
    expect(encodeLayout(full, TYPE_IDS).length).toBe(180);
  });

  it("skips buildings whose type is not in the list", () => {
    const encoded = encodeLayout(
      [{ id: "b0", typeId: "mystery-tower", x: 1, y: 1 }],
      TYPE_IDS,
    );
    expect(encoded).toBe("");
  });

  describe("decoding a stale link", () => {
    it("drops an unknown type index but keeps the rest", () => {
      // "J" decodes cleanly to index 45 — well past the end of TYPE_IDS.
      const encoded = encodeLayout(buildings, TYPE_IDS) + "J55";
      const decoded = decodeLayout(encoded, TYPE_IDS);

      expect(decoded.buildings).toHaveLength(2);
      expect(decoded.errors).toEqual([
        "ignored unknown building type at position 3",
      ]);
    });

    it("reports trailing junk without losing valid buildings", () => {
      const decoded = decodeLayout(
        encodeLayout(buildings, TYPE_IDS) + "xy",
        TYPE_IDS,
      );
      expect(decoded.buildings).toHaveLength(2);
      expect(decoded.errors).toEqual([
        "layout length is not a multiple of 3 — trailing data ignored",
      ]);
    });

    it("drops unreadable characters", () => {
      const decoded = decodeLayout("!!!", TYPE_IDS);
      expect(decoded.buildings).toEqual([]);
      expect(decoded.errors).toEqual([
        "ignored unreadable building at position 1",
      ]);
    });

    it("returns an empty layout for an empty string", () => {
      expect(decodeLayout("", TYPE_IDS)).toEqual({ buildings: [], errors: [] });
    });
  });
});

describe("point encoding", () => {
  it("round-trips", () => {
    expect(decodePoint(encodePoint({ x: 0, y: 44 }))).toEqual({ x: 0, y: 44 });
  });

  it("rounds fractional tile positions", () => {
    expect(decodePoint(encodePoint({ x: 21.5, y: 7.4 }))).toEqual({
      x: 22,
      y: 7,
    });
  });

  it("rejects malformed input", () => {
    expect(decodePoint("abc")).toBeNull();
    expect(decodePoint("!!")).toBeNull();
  });
});

describe("encodeStand / decodeStand", () => {
  it("round-trips a tile centre", () => {
    const stand = { x: 23.5, y: 4.5 };
    expect(decodeStand(encodeStand(stand))).toEqual(stand);
  });

  it("stores the tile a unit is standing on, not the corner it is near", () => {
    // Anywhere inside tile (23, 4) is tile (23, 4).
    for (const p of [
      { x: 23.1, y: 4.9 },
      { x: 23.5, y: 4.5 },
      { x: 23.99, y: 4.01 },
    ]) {
      expect(decodeStand(encodeStand(p))).toEqual({ x: 23.5, y: 4.5 });
    }
  });

  it("always decodes to the middle of a tile", () => {
    // Never a corner: a unit on a corner belongs to four tiles at once, three
    // of which it is not standing on, which is how a hero came to be drawn on
    // top of the no-deploy shading.
    for (const encoded of ["00", "zz", "5k"]) {
      const p = decodeStand(encoded)!;
      expect(p.x % 1).toBe(0.5);
      expect(p.y % 1).toBe(0.5);
    }
  });

  it("rejects the same input decodePoint does", () => {
    expect(decodeStand("")).toBeNull();
    expect(decodeStand("!!")).toBeNull();
  });
});
