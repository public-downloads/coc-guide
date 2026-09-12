import { describe, expect, it } from "vitest";
import {
  pointSegmentDistance,
  rayToBounds,
  rectIsHit,
  segmentRectDistance,
} from "./geometry";

const SIZE = 47;

describe("rayToBounds", () => {
  it("carries the line to the far edge, not just to the aim point", () => {
    const seg = rayToBounds({ x: 23, y: 0 }, { x: 23, y: 10 }, SIZE);
    expect(seg).toEqual({ a: { x: 23, y: 0 }, b: { x: 23, y: 47 } });
  });

  it("keeps going past the target rather than stopping at it", () => {
    const seg = rayToBounds({ x: 0, y: 22 }, { x: 5, y: 22 }, SIZE);
    expect(seg?.b).toEqual({ x: 47, y: 22 });
  });

  it("exits through the correct edge on a diagonal", () => {
    const seg = rayToBounds({ x: 0, y: 0 }, { x: 1, y: 1 }, SIZE);
    expect(seg?.b).toEqual({ x: 47, y: 47 });
  });

  it("exits the nearer edge when the slope is not 45 degrees", () => {
    // Rises 2 across for 1 down, so it leaves through x = 47 first.
    const seg = rayToBounds({ x: 0, y: 0 }, { x: 2, y: 1 }, SIZE);
    expect(seg?.b).toEqual({ x: 47, y: 23.5 });
  });

  it("fires backwards through the origin when aimed that way", () => {
    const seg = rayToBounds({ x: 22, y: 30 }, { x: 22, y: 10 }, SIZE);
    expect(seg?.b).toEqual({ x: 22, y: 0 });
  });

  it("returns null when there is no direction to fire in", () => {
    expect(rayToBounds({ x: 10, y: 10 }, { x: 10, y: 10 }, SIZE)).toBeNull();
  });
});

describe("pointSegmentDistance", () => {
  const seg = { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } };

  it("measures perpendicular distance mid-segment", () => {
    expect(pointSegmentDistance({ x: 5, y: 3 }, seg)).toBe(3);
  });

  it("clamps to the endpoints beyond the segment", () => {
    expect(pointSegmentDistance({ x: 14, y: 0 }, seg)).toBe(4);
  });
});

describe("segmentRectDistance", () => {
  const rect = { x: 10, y: 10, w: 3, h: 3 };

  it("is zero when the segment crosses the rect", () => {
    expect(
      segmentRectDistance({ a: { x: 0, y: 11 }, b: { x: 44, y: 11 } }, rect),
    ).toBe(0);
  });

  it("is zero when the segment starts inside the rect", () => {
    expect(
      segmentRectDistance({ a: { x: 11, y: 11 }, b: { x: 44, y: 40 } }, rect),
    ).toBe(0);
  });

  it("measures the gap when the segment passes alongside", () => {
    expect(
      segmentRectDistance({ a: { x: 0, y: 8 }, b: { x: 44, y: 8 } }, rect),
    ).toBe(2);
  });
});

describe("rectIsHit", () => {
  const rect = { x: 10, y: 10, w: 3, h: 3 };
  const alongside = { a: { x: 0, y: 8 }, b: { x: 44, y: 8 } };

  it("counts a near miss as a hit once the path is wide enough", () => {
    expect(rectIsHit(alongside, rect, 1)).toBe(false);
    expect(rectIsHit(alongside, rect, 2)).toBe(true);
  });
});
