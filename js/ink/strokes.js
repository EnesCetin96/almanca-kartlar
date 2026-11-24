// Pure stroke helpers (no DOM). Coordinates are "logical": x spans 0..LOGICAL_W,
// and y uses the same scale, so a note looks identical at any card width.
export const LOGICAL_W = 1000;

export function toLogical(clientX, clientY, rect) {
  const s = rect.width / LOGICAL_W;
  return [(clientX - rect.left) / s, (clientY - rect.top) / s];
}

/** Pen width for a pressure in 0..1; pressure 0.5 gives exactly the base width. */
export const pressureWidth = (base, pressure) => base * (0.4 + 1.2 * pressure);

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function strokeHit(stroke, x, y, radius) {
  const r = radius + stroke.width / 2;
  const pts = stroke.points;
  if (pts.length === 1) return Math.hypot(pts[0][0] - x, pts[0][1] - y) <= r;
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= r) return true;
  }
  return false;
}

/** Returns a new array without the touched strokes, or the same array if nothing was hit. */
export function eraseAt(strokes, x, y, radius) {
  const kept = strokes.filter((s) => !strokeHit(s, x, y, radius));
  return kept.length === strokes.length ? strokes : kept;
}
