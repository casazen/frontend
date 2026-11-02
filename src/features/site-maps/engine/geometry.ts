/**
 * 2D geometry of the schematic map engine (DB-19a): Catmull-Rom curves, compact SVG path writers and the small polygon
 * toolbox (clipping, point in polygon, Voronoi cells) the generators are built from. Pure functions on `[x, y]` pairs.
 */
import { PI, clamp, num } from './numeric';

export type Pt = [number, number];
export type Poly = Pt[];

type Bezier = [Pt, Pt, Pt, Pt];

/** Centripetal Catmull-Rom as cubic Bézier segments [p1, c1, c2, p2]. */
export function crBezier(pts: readonly Pt[], closed: boolean): Bezier[] {
  const n = pts.length;
  const segs: Bezier[] = [];
  if (n < 2) return segs;
  const at = (i: number): Pt => {
    if (closed) return pts[((i % n) + n) % n];
    if (i < 0) return [2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1]];
    if (i >= n) return [2 * pts[n - 1][0] - pts[n - 2][0], 2 * pts[n - 1][1] - pts[n - 2][1]];
    return pts[i];
  };
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const d1 = Math.max(1e-4, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) ** 0.5);
    const d2 = Math.max(1e-4, Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) ** 0.5);
    const d3 = Math.max(1e-4, Math.hypot(p3[0] - p2[0], p3[1] - p2[1]) ** 0.5);
    const a = 2 * d1 * d1 + 3 * d1 * d2 + d2 * d2;
    const b = 2 * d3 * d3 + 3 * d3 * d2 + d2 * d2;
    const k1 = 3 * d1 * (d1 + d2);
    const k2 = 3 * d3 * (d3 + d2);
    segs.push([
      p1,
      [(d1 * d1 * p2[0] - d2 * d2 * p0[0] + a * p1[0]) / k1, (d1 * d1 * p2[1] - d2 * d2 * p0[1] + a * p1[1]) / k1],
      [(d3 * d3 * p1[0] - d2 * d2 * p3[0] + b * p2[0]) / k2, (d3 * d3 * p1[1] - d2 * d2 * p3[1] + b * p2[1]) / k2],
      p2,
    ]);
  }
  return segs;
}

/** Smooth SVG path (Bézier) through the points. */
export function smoothD(pts: readonly Pt[], closed = false, d = 1): string {
  const segs = crBezier(pts, closed);
  if (!segs.length) return '';
  let s = `M${num(pts[0][0], d)} ${num(pts[0][1], d)}`;
  for (const [, c1, c2, p] of segs) {
    s += `C${num(c1[0], d)} ${num(c1[1], d)} ${num(c2[0], d)} ${num(c2[1], d)} ${num(p[0], d)} ${num(p[1], d)}`;
  }
  return closed ? `${s}Z` : s;
}

/** Samples the smooth curve about every `step` (same unit as the points). */
export function sampleCurve(pts: readonly Pt[], closed: boolean, step: number): Pt[] {
  const segs = crBezier(pts, closed);
  const out: Pt[] = [];
  for (const [p1, c1, c2, p2] of segs) {
    const len = Math.hypot(c1[0] - p1[0], c1[1] - p1[1]) + Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) + Math.hypot(p2[0] - c2[0], p2[1] - c2[1]);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const u = 1 - t;
      out.push([
        u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0],
        u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1],
      ]);
    }
  }
  if (!closed && segs.length) {
    const last = segs[segs.length - 1][3];
    out.push([last[0], last[1]]);
  }
  return out;
}

/** Compact number for paths: no leading zero («.5», «-.5»). */
const cn = (v: number, d = 1): string => {
  const s = num(v, d);
  return s.startsWith('0.') ? s.slice(1) : s.startsWith('-0.') ? `-${s.slice(2)}` : s;
};

/** Joins numbers with the fewest separators (the minus sign separates by itself). */
const joinNums = (arr: string[]): string => {
  let out = '';
  for (const s of arr) out += out && s[0] !== '-' ? ` ${s}` : s;
  return out;
};

/** «M x y l dx dy …» in relative coordinates: every point is rounded before the difference, so there is no drift. */
function relD(pts: readonly Pt[], d: number, close: boolean): string {
  const k = 10 ** d;
  const r = (v: number): number => Math.round(v * k) / k;
  let px = r(pts[0][0]);
  let py = r(pts[0][1]);
  const nums: string[] = [];
  for (let i = 1; i < pts.length; i++) {
    const x = r(pts[i][0]);
    const y = r(pts[i][1]);
    nums.push(cn(x - px, d), cn(y - py, d));
    px = x;
    py = y;
  }
  return `M${cn(r(pts[0][0]), d)} ${cn(r(pts[0][1]), d)}l${joinNums(nums)}${close ? 'z' : ''}`;
}

/** A polygon as a closed sub-path (`d` decimals). */
export const polyD = (poly: readonly Pt[], d = 1): string => (poly.length < 3 ? '' : relD(poly, d, true));
/** A polyline as an open sub-path (`d` decimals). */
export const lineD = (pts: readonly Pt[], d = 1): string => (pts.length < 2 ? '' : relD(pts, d, false));

/** Signed area (positive or negative by winding). */
export const polyArea = (poly: readonly Pt[]): number => {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  return s / 2;
};

/** Compactness of a polygon (1 is a circle): used to discard slivers. */
export function compactness(poly: readonly Pt[]): number {
  let per = 0;
  for (let i = 0; i < poly.length; i++) per += Math.hypot(poly[(i + 1) % poly.length][0] - poly[i][0], poly[(i + 1) % poly.length][1] - poly[i][1]);
  return per ? (4 * PI * Math.abs(polyArea(poly))) / (per * per) : 0;
}

/** Keeps the points with nx·x + ny·y ≤ c (Sutherland-Hodgman, one half-plane). */
export function clipHalf(poly: readonly Pt[], nx: number, ny: number, c: number): Poly {
  const out: Poly = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const da = nx * a[0] + ny * a[1] - c;
    const db = nx * b[0] + ny * b[1] - c;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export function clipRect(poly: readonly Pt[], x0: number, y0: number, x1: number, y1: number): Poly {
  let p = clipHalf(poly, -1, 0, -x0);
  if (p.length) p = clipHalf(p, 1, 0, x1);
  if (p.length) p = clipHalf(p, 0, -1, -y0);
  if (p.length) p = clipHalf(p, 0, 1, y1);
  return p;
}

/** Point in polygon (even-odd). */
export function pip(poly: readonly Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function centroid(poly: readonly Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p[0];
    y += p[1];
  }
  return [x / poly.length, y / poly.length];
}

/** Area-weighted centroid of a polygon. */
export function polyCentroid(poly: readonly Pt[]): Pt {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    a += f;
    cx += (poly[j][0] + poly[i][0]) * f;
    cy += (poly[j][1] + poly[i][1]) * f;
  }
  return Math.abs(a) < 1e-9 ? centroid(poly) : [cx / (3 * a), cy / (3 * a)];
}

/** Shrinks a convex polygon by `d` (the lanes between blocks). */
export function insetConvex(poly: readonly Pt[], d: number): Poly | null {
  const cen = centroid(poly);
  let out: Poly = poly.slice();
  for (let i = 0; i < poly.length && out.length > 2; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    let ox = dy / len;
    let oy = -dx / len;
    if (ox * (cen[0] - a[0]) + oy * (cen[1] - a[1]) > 0) {
      ox = -ox;
      oy = -oy;
    }
    out = clipHalf(out, ox, oy, ox * a[0] + oy * a[1] - d);
  }
  return out.length > 2 ? out : null;
}

/** Distance from a point to a polyline. */
export function distToLine(pts: readonly Pt[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1);
    best = Math.min(best, Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy)));
  }
  return best;
}

/** Ellipse (convex polygon) with n vertices, rotated by `rot` radians. */
export function ellipsePoly(cx: number, cy: number, rx: number, ry: number, rot = 0, n = 28): Poly {
  const out: Poly = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

/** Voronoi cells (half-plane cuts) inside a convex region. */
export function voronoiCells(sites: readonly Pt[], region: readonly Pt[]): (Poly | null)[] {
  const n = sites.length;
  const cells: (Poly | null)[] = new Array<Poly | null>(n).fill(null);
  for (let i = 0; i < n; i++) {
    const [sx, sy] = sites[i];
    const order: [number, number][] = [];
    for (let j = 0; j < n; j++) if (j !== i) order.push([(sites[j][0] - sx) ** 2 + (sites[j][1] - sy) ** 2, j]);
    order.sort((a, b) => a[0] - b[0]);
    let poly: Poly = region.slice();
    let reach = 0;
    for (const p of poly) reach = Math.max(reach, Math.hypot(p[0] - sx, p[1] - sy));
    for (const [d2, j] of order) {
      if (Math.sqrt(d2) / 2 > reach) break;
      const [tx, ty] = sites[j];
      const nx = tx - sx;
      const ny = ty - sy;
      poly = clipHalf(poly, nx, ny, nx * ((sx + tx) / 2) + ny * ((sy + ty) / 2));
      if (poly.length < 3) break;
      reach = 0;
      for (const p of poly) reach = Math.max(reach, Math.hypot(p[0] - sx, p[1] - sy));
    }
    cells[i] = poly.length >= 3 ? poly : null;
  }
  return cells;
}
