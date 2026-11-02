/**
 * Building blocks of the neighbourhood maps (DB-19a): drawing space, random blobs, the recursive split of an area into blocks
 * (BSP) and the graph of field edges the farm tracks follow. Everything is deterministic given the random generator.
 */
import { clipHalf, compactness, polyArea, polyCentroid, sampleCurve, type Poly, type Pt } from '../geometry';
import { PI, hash2, lerp, type Rand } from '../numeric';

/** Drawing space is 100 × 100: of the 4:3 frame only the band VY0..VY1 is visible. */
export const UW = 100;
export const UH = 100;
export const VY0 = 12.5;
export const VY1 = 87.5;
export const FRAME: Poly = [[-1.5, 11], [UW + 1.5, 11], [UW + 1.5, 89], [-1.5, 89]];
/** Generation frame when the drawing is going to be rotated: it has to cover the visible band at any angle. */
export const FRAME_WIDE: Poly = [[-30, -30], [UW + 30, -30], [UW + 30, UH + 30], [-30, UH + 30]];

export interface Cut {
  a: Pt;
  b: Pt;
  lv: number;
}
export interface Block {
  p: Poly;
  /** Tone index into the palette of the layer that draws it. */
  t: number;
}
interface BspResult {
  blocks: Poly[];
  cuts: Cut[];
}
interface BspOptions {
  target: number;
  jitter?: number;
  minFrac?: number;
  minCompact?: number;
  density?: (c: Pt) => number;
}

export const jit = (rand: Rand, a: number): number => (rand() - 0.5) * a;

export function blobPts(rand: Rand, cx: number, cy: number, rx: number, ry: number, n = 9, jag = 0.2, rot = 0): Poly {
  const out: Poly = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2 + (rand() - 0.5) * 0.25;
    const k = 1 + (rand() - 0.5) * 2 * jag;
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

export function rectPoly(cx: number, cy: number, w: number, h: number, rot = 0): Poly {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const corners: Pt[] = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  return corners.map(([x, y]): Pt => [cx + x * c - y * s, cy + x * s + y * c]);
}

/** Local coordinates of a rotated ellipse: |q| ≤ 1 inside. */
export function ellipseNorm(p: Pt, c: Pt, rx: number, ry: number, rot: number): number {
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  const x = dx * Math.cos(rot) + dy * Math.sin(rot);
  const y = -dx * Math.sin(rot) + dy * Math.cos(rot);
  return Math.hypot(x / rx, y / ry);
}

export const localToWorld = (c: Pt, rot: number, x: number, y: number): Pt => [c[0] + x * Math.cos(rot) - y * Math.sin(rot), c[1] + x * Math.sin(rot) + y * Math.cos(rot)];

export const samples = (pts: readonly Pt[], step = 1.5, closed = false): Pt[] => sampleCurve(pts, closed, step);

/** Points along the cuts (the main streets) up to a level: they snap the points of interest. */
export const cutSamples = (cuts: readonly Cut[], maxLv: number, step = 2.2): Pt[] => {
  const out: Pt[] = [];
  for (const c of cuts) {
    if (c.lv > maxLv) continue;
    const n = Math.max(1, Math.round(Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]) / step));
    for (let i = 0; i <= n; i++) out.push([lerp(c.a[0], c.b[0], i / n), lerp(c.a[1], c.b[1], i / n)]);
  }
  return out;
};

/**
 * Recursive split of a convex area into blocks with T junctions, like a real town: cut perpendicular to the long axis with a
 * little random angle. The cuts of the first levels are the main streets.
 */
function bspBlocks(rand: Rand, region: Poly, { target, jitter = 0.5, minFrac = 0.3, minCompact = 0.42, density = () => 1 }: BspOptions): BspResult {
  const blocks: Poly[] = [];
  const cuts: Cut[] = [];
  const stack: { p: Poly; lv: number }[] = [{ p: region, lv: 0 }];
  while (stack.length) {
    const item = stack.pop();
    if (!item) break;
    const { p, lv } = item;
    const area = Math.abs(polyArea(p));
    const c: Pt = p.length >= 3 ? polyCentroid(p) : [0, 0];
    if (p.length < 3 || area <= target * density(c) * (0.55 + rand() * 0.95)) {
      if (p.length >= 3) blocks.push(p);
      continue;
    }
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (const q of p) {
      const dx = q[0] - c[0];
      const dy = q[1] - c[1];
      sxx += dx * dx;
      sxy += dx * dy;
      syy += dy * dy;
    }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    let done = false;
    for (let attempt = 0; attempt < 8 && !done; attempt++) {
      const soft = attempt < 4 ? 1 : 0.4;
      const mc = attempt < 4 ? minCompact : attempt < 6 ? minCompact * 0.6 : 0.12;
      const mf = attempt < 6 ? minFrac : minFrac * 0.5;
      const ang = th + PI / 2 + (rand() - 0.5) * 2 * jitter * soft;
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);
      let lo = Infinity;
      let hi = -Infinity;
      for (const q of p) {
        const t = nx * q[0] + ny * q[1];
        lo = Math.min(lo, t);
        hi = Math.max(hi, t);
      }
      const t0 = lerp(lo, hi, 0.5 + (rand() - 0.5) * 0.55 * soft);
      const a = clipHalf(p, nx, ny, t0);
      const b = clipHalf(p, -nx, -ny, -t0);
      if (a.length < 3 || b.length < 3) continue;
      if (Math.min(Math.abs(polyArea(a)), Math.abs(polyArea(b))) < area * mf) continue;
      if (Math.min(compactness(a), compactness(b)) < mc) continue;
      const on = a.filter((q) => Math.abs(nx * q[0] + ny * q[1] - t0) < 1e-6);
      if (on.length >= 2) cuts.push({ a: on[0], b: on[on.length - 1], lv });
      stack.push({ p: a, lv: lv + 1 }, { p: b, lv: lv + 1 });
      done = true;
    }
    if (!done) blocks.push(p);
  }
  return { blocks, cuts };
}

interface BspFieldOptions extends BspOptions {
  ang?: number;
  k?: number;
}

/** BSP in a stretched space: the blocks come out elongated by k along the direction `ang`. */
export function bspField(rand: Rand, region: Poly, { target, jitter, ang = 0, k = 1, minFrac = 0.3, minCompact = 0.42, density = () => 1 }: BspFieldOptions): BspResult {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const fwd = (p: Pt): Pt => [(p[0] * ca + p[1] * sa) / k, -p[0] * sa + p[1] * ca];
  const inv = (q: Pt): Pt => [q[0] * k * ca - q[1] * sa, q[0] * k * sa + q[1] * ca];
  const r = bspBlocks(rand, region.map(fwd), { target: target / k, jitter, minFrac, minCompact, density: (g) => density(inv(g)) });
  return { blocks: r.blocks.map((b) => b.map(inv)), cuts: r.cuts.map((c) => ({ a: inv(c.a), b: inv(c.b), lv: c.lv })) };
}

/** Cuts a block with the half-plane of the nearest cliff, moved by `margin`. */
export function clipByCoast(poly: Poly, margin: number, coast: readonly Pt[], land: (x: number, y: number) => boolean, coastDist: (x: number, y: number) => number): Poly | null {
  if (poly.every((q) => land(q[0], q[1]) && coastDist(q[0], q[1]) >= margin)) return poly;
  const cen = polyCentroid(poly);
  let bi = 0;
  let bd = Infinity;
  for (let i = 0; i < coast.length; i++) {
    const d = (coast[i][0] - cen[0]) ** 2 + (coast[i][1] - cen[1]) ** 2;
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  const a = coast[Math.max(0, bi - 3)];
  const b = coast[Math.min(coast.length - 1, bi + 3)];
  const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  let nx = -(b[1] - a[1]) / tl;
  let ny = (b[0] - a[0]) / tl;
  if (!land(coast[bi][0] + nx * 1.6, coast[bi][1] + ny * 1.6)) {
    nx = -nx;
    ny = -ny;
  }
  const out = clipHalf(poly, -nx, -ny, -(nx * coast[bi][0] + ny * coast[bi][1] + margin));
  if (out.length < 3 || Math.abs(polyArea(out)) < 0.3 * Math.abs(polyArea(poly))) return null;
  return out.every((q) => land(q[0], q[1]) && coastDist(q[0], q[1]) >= margin - 0.3) ? out : null;
}

/** Cuts a block with the tangent of the nearest ellipse (blocks aligned with the ring road). */
export function clipOutsideEllipse(poly: Poly, c: Pt, rx: number, ry: number, rot: number, margin: number): Poly | null {
  if (poly.every((q) => ellipseNorm(q, c, rx + margin, ry + margin, rot) >= 1)) return poly;
  const g = polyCentroid(poly);
  const dx = g[0] - c[0];
  const dy = g[1] - c[1];
  const lx = dx * Math.cos(rot) + dy * Math.sin(rot);
  const ly = -dx * Math.sin(rot) + dy * Math.cos(rot);
  const t = Math.atan2(ly / ry, lx / rx);
  const B = localToWorld(c, rot, rx * Math.cos(t), ry * Math.sin(t));
  const nl: Pt = [Math.cos(t) / rx, Math.sin(t) / ry];
  const nw = localToWorld([0, 0], rot, nl[0], nl[1]);
  const nn = Math.hypot(nw[0], nw[1]) || 1;
  const nx = nw[0] / nn;
  const ny = nw[1] / nn;
  const out = clipHalf(poly, -nx, -ny, -(nx * B[0] + ny * B[1] + margin));
  if (out.length < 3 || Math.abs(polyArea(out)) < 0.3 * Math.abs(polyArea(poly))) return null;
  return out.every((q) => ellipseNorm(q, c, rx + margin * 0.8, ry + margin * 0.8, rot) >= 1) ? out : null;
}

export interface FieldGraph {
  verts: Pt[];
  nearest: (p: Pt, ok?: (v: Pt) => boolean) => number;
  path: (from: number, to: number) => Pt[];
}

/** Graph of the edges between fields: the sides are split at the T junctions, so the tracks follow them. */
export function buildGraph(polys: readonly Poly[]): FieldGraph {
  const vid = new Map<string, number>();
  const verts: Pt[] = [];
  const adj: { v: number; w: number }[][] = [];
  const vtx = (p: Pt): number => {
    const key = `${Math.round(p[0] * 20)},${Math.round(p[1] * 20)}`;
    let i = vid.get(key);
    if (i === undefined) {
      i = verts.length;
      vid.set(key, i);
      verts.push(p);
      adj.push([]);
    }
    return i;
  };
  const edges: [Pt, Pt][] = [];
  for (const poly of polys) for (let i = 0; i < poly.length; i++) edges.push([poly[i], poly[(i + 1) % poly.length]]);
  for (const [a, b] of edges) {
    vtx(a);
    vtx(b);
  }
  const link = (a: number, b: number): void => {
    if (a === b || adj[a].some((e) => e.v === b)) return;
    const w = Math.hypot(verts[a][0] - verts[b][0], verts[a][1] - verts[b][1]) * (1 + 0.5 * hash2(a, b, 5));
    adj[a].push({ v: b, w });
    adj[b].push({ v: a, w });
  };
  for (const [a, b] of edges) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    if (l2 < 1e-9) continue;
    const mids: [number, number][] = [];
    for (let vi = 0; vi < verts.length; vi++) {
      const v = verts[vi];
      const t = ((v[0] - a[0]) * dx + (v[1] - a[1]) * dy) / l2;
      if (t <= 0.002 || t >= 0.998) continue;
      if (Math.hypot(v[0] - (a[0] + t * dx), v[1] - (a[1] + t * dy)) < 0.04) mids.push([t, vi]);
    }
    mids.sort((m, n) => m[0] - n[0]);
    const chain = [vtx(a), ...mids.map((m) => m[1]), vtx(b)];
    for (let i = 0; i + 1 < chain.length; i++) link(chain[i], chain[i + 1]);
  }
  const nearest = (p: Pt, ok: (v: Pt) => boolean = () => true): number => {
    let bi = -1;
    let bd = Infinity;
    verts.forEach((v, i) => {
      if (!ok(v)) return;
      const d = Math.hypot(v[0] - p[0], v[1] - p[1]);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    return bi;
  };
  const path = (from: number, to: number): Pt[] => {
    if (from < 0 || to < 0) return [];
    const dist: number[] = new Array<number>(verts.length).fill(Infinity);
    const prev: number[] = new Array<number>(verts.length).fill(-1);
    const done: boolean[] = new Array<boolean>(verts.length).fill(false);
    dist[from] = 0;
    for (let it = 0; it < verts.length; it++) {
      let u = -1;
      for (let i = 0; i < verts.length; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || dist[u] === Infinity || u === to) break;
      done[u] = true;
      for (const e of adj[u]) {
        if (dist[u] + e.w < dist[e.v]) {
          dist[e.v] = dist[u] + e.w;
          prev[e.v] = u;
        }
      }
    }
    if (from !== to && prev[to] < 0) return [];
    const out: Pt[] = [];
    for (let v = to; v >= 0; v = prev[v]) out.push(verts[v]);
    return out.reverse();
  };
  return { verts, nearest, path };
}
