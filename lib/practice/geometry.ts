/**
 * Tile-space geometry for the ability trainer. Pure maths, no React, no data
 * loading — the UI only draws what these return.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  a: Point;
  b: Point;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EPSILON = 1e-9;

/**
 * Both abilities are "a line from the hero through some other point, carried
 * on to the edge of the village". Returns the segment from `origin` to where
 * that ray leaves the `size`x`size` box.
 *
 * Returns null when `through` is the same point as `origin`, since that gives
 * no direction to fire in.
 */
export function rayToBounds(
  origin: Point,
  through: Point,
  size: number,
): Segment | null {
  const dx = through.x - origin.x;
  const dy = through.y - origin.y;
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) return null;

  // Largest t >= 0 with origin + t*d still inside the box (slab method).
  let tMax = Infinity;

  for (const [o, d] of [
    [origin.x, dx],
    [origin.y, dy],
  ] as const) {
    if (Math.abs(d) < EPSILON) {
      // Parallel to this axis: only valid if already within the slab.
      if (o < 0 || o > size) return null;
      continue;
    }
    const tLow = (0 - o) / d;
    const tHigh = (size - o) / d;
    tMax = Math.min(tMax, Math.max(tLow, tHigh));
  }

  if (!Number.isFinite(tMax) || tMax <= 0) return null;

  return {
    a: { ...origin },
    b: { x: origin.x + dx * tMax, y: origin.y + dy * tMax },
  };
}

export function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** Shortest distance from a point to a rectangle; 0 when inside. */
export function pointRectDistance(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Perpendicular distance from a point to the *infinite* line through a
 * segment. Cheaper than `pointSegmentDistance` and never larger, which is what
 * makes it safe as a rejection test before the real hit check.
 */
export function pointLineDistance(p: Point, s: Segment): number {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const length = Math.hypot(dx, dy);
  if (length < EPSILON) return distance(p, s.a);
  return Math.abs(dy * (p.x - s.a.x) - dx * (p.y - s.a.y)) / length;
}

/** Shortest distance from `p` to the segment `s`. */
export function pointSegmentDistance(p: Point, s: Segment): number {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < EPSILON) return distance(p, s.a);

  const t = Math.max(
    0,
    Math.min(1, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / lengthSq),
  );
  return distance(p, { x: s.a.x + t * dx, y: s.a.y + t * dy });
}

function segmentsIntersect(s1: Segment, s2: Segment): boolean {
  const d = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

  const d1 = d(s2.a, s2.b, s1.a);
  const d2 = d(s2.a, s2.b, s1.b);
  const d3 = d(s1.a, s1.b, s2.a);
  const d4 = d(s1.a, s1.b, s2.b);

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }

  // Collinear touching counts as a hit.
  const onSegment = (p: Point, q: Point, r: Point) =>
    Math.abs(d(p, q, r)) < EPSILON &&
    r.x >= Math.min(p.x, q.x) - EPSILON &&
    r.x <= Math.max(p.x, q.x) + EPSILON &&
    r.y >= Math.min(p.y, q.y) - EPSILON &&
    r.y <= Math.max(p.y, q.y) + EPSILON;

  return (
    onSegment(s2.a, s2.b, s1.a) ||
    onSegment(s2.a, s2.b, s1.b) ||
    onSegment(s1.a, s1.b, s2.a) ||
    onSegment(s1.a, s1.b, s2.b)
  );
}

/** Shortest distance between a segment and an axis-aligned rectangle. */
export function segmentRectDistance(s: Segment, r: Rect): number {
  if (pointInRect(s.a, r) || pointInRect(s.b, r)) return 0;

  const corners: Point[] = [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];

  let min = Infinity;
  for (let i = 0; i < 4; i++) {
    const edge: Segment = { a: corners[i], b: corners[(i + 1) % 4] };
    if (segmentsIntersect(s, edge)) return 0;
    min = Math.min(
      min,
      pointSegmentDistance(edge.a, s),
      pointSegmentDistance(edge.b, s),
      pointSegmentDistance(s.a, edge),
      pointSegmentDistance(s.b, edge),
    );
  }
  return min;
}

/**
 * The ability path has width, so a building counts as hit when it comes within
 * `halfWidth` tiles of the centre line.
 */
export function rectIsHit(s: Segment, r: Rect, halfWidth: number): boolean {
  return segmentRectDistance(s, r) <= halfWidth + EPSILON;
}
