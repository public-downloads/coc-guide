import { VILLAGE_SIZE, type PlacedBuilding } from "../schema/building";
import type { Point } from "./geometry";

/**
 * Layouts live in the URL so a base you build in the sandbox can be pasted to
 * someone else, same as a simulator build. Three characters per building keeps
 * a full base well inside a shareable link.
 *
 *   ?b=<type><x><y><type><x><y>...&h=<x><y>
 */

/**
 * 62 URL-safe characters, covering a 0..47 board coordinate and the building
 * type list. Only ever append to this — the index of each character is what a
 * shared link encodes, so reordering would silently rewrite old layouts.
 */
const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const MAX_ENCODABLE = ALPHABET.length - 1;

function toChar(value: number): string | null {
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > MAX_ENCODABLE) return null;
  return ALPHABET[rounded];
}

function fromChar(char: string): number | null {
  const index = ALPHABET.indexOf(char);
  return index === -1 ? null : index;
}

export function encodeLayout(
  buildings: PlacedBuilding[],
  typeIds: string[],
): string {
  let out = "";
  for (const building of buildings) {
    const typeIndex = typeIds.indexOf(building.typeId);
    if (typeIndex === -1) continue;
    const chars = [
      toChar(typeIndex),
      toChar(building.x),
      toChar(building.y),
    ];
    if (chars.some((c) => c === null)) continue;
    out += chars.join("");
  }
  return out;
}

export interface DecodedLayout {
  buildings: PlacedBuilding[];
  errors: string[];
}

/**
 * Drops anything unreadable rather than failing — a link made before a
 * building type was renamed should still open with the rest of the base.
 */
export function decodeLayout(
  encoded: string,
  typeIds: string[],
): DecodedLayout {
  const buildings: PlacedBuilding[] = [];
  const errors: string[] = [];

  if (encoded.length % 3 !== 0) {
    errors.push("layout length is not a multiple of 3 — trailing data ignored");
  }

  for (let i = 0; i + 2 < encoded.length; i += 3) {
    const typeIndex = fromChar(encoded[i]);
    const x = fromChar(encoded[i + 1]);
    const y = fromChar(encoded[i + 2]);

    if (typeIndex === null || x === null || y === null) {
      errors.push(`ignored unreadable building at position ${i / 3 + 1}`);
      continue;
    }
    const typeId = typeIds[typeIndex];
    if (!typeId) {
      errors.push(`ignored unknown building type at position ${i / 3 + 1}`);
      continue;
    }
    if (x > VILLAGE_SIZE || y > VILLAGE_SIZE) {
      errors.push(`ignored building outside the village at position ${i / 3 + 1}`);
      continue;
    }

    buildings.push({ id: `b${buildings.length}`, typeId, x, y });
  }

  return { buildings, errors };
}

/**
 * A unit's standing position, stored as the **tile** it is standing on.
 *
 * Buildings occupy whole tiles and the no-deploy overlay is rasterised to
 * whole tiles, so a unit on a tile *corner* belongs to four tiles at once —
 * three of which it is not really standing on. It can then be perfectly legal
 * and still be drawn sitting on the shading, which is exactly what it looks
 * like: a hero standing on a wall.
 *
 * Storing the tile and standing in the middle of it removes the ambiguity:
 * "legal" and "not shaded" become the same question about the same square.
 */
export function encodeStand(p: Point): string {
  return encodePoint({ x: Math.floor(p.x), y: Math.floor(p.y) });
}

export function decodeStand(encoded: string): Point | null {
  const tile = decodePoint(encoded);
  return tile ? { x: tile.x + 0.5, y: tile.y + 0.5 } : null;
}

export function encodePoint(p: Point): string {
  const x = toChar(p.x);
  const y = toChar(p.y);
  return x !== null && y !== null ? `${x}${y}` : "";
}

export function decodePoint(encoded: string): Point | null {
  if (encoded.length !== 2) return null;
  const x = fromChar(encoded[0]);
  const y = fromChar(encoded[1]);
  return x === null || y === null ? null : { x, y };
}
