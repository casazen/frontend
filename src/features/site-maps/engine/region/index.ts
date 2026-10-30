/**
 * Regional maps (DB-19a): `regionMapSvg` draws the background of a map (sea, land, coast, lakes, borders between regions, roads,
 * towns with their names) for a view; the pins of the houses are HTML put over it with `projectPoint`. Everything is already
 * projected into the frame (viewBox = width × width / aspect), so strokes, dots and text keep their size when zooming: pass as
 * `width` the real width the map will be shown at. The SVG is decorative (`aria-hidden`).
 *
 * What is drawn depends on the width of the view: the coast comes from the level of detail of the national base that fits the
 * pixels, and roads, railways, built-up areas and fields appear as one gets closer, where a detail pack covers the area.
 * Nothing is fetched here: the data are what `loadRegionData` has installed (src/features/site-maps/load.ts).
 */
import { clipRect, crBezier, lineD, pip, polyD, smoothD, voronoiCells, type Poly, type Pt } from '../geometry';
import { DEG, PI, clamp, esc, hash2, num, rngOf, slug } from '../numeric';
import { FONT, HALO, INK, nextPrefix, textW } from '../style';
import { LAT_KM, LON_KM, ORIGIN_LAT, ORIGIN_LON, sane, toKm, unprojectPoint, type View } from '../view';
import { hits, makePlacer, runsInBox, thinPts, type Box } from './lines';
import type { GeoLod, GeoName, Shape } from './model';
import { getWorld, type World, type WorldTown } from './registry';

const TINT_CELL_KM = 34;

/**
 * Soft tints for the places that no detail pack covers: patches of plain, hill and grove on a grid fixed to the map, so that
 * they do not move when the map does and a region without a hand-made tint is not a flat colour. Not drawn on the whole country.
 */
function proceduralTints(win: Box, packs: World['packs']): { k: Pt; rx: number; ry: number; g: 'g' | 'w' | 't' }[] {
  const out: { k: Pt; rx: number; ry: number; g: 'g' | 'w' | 't' }[] = [];
  for (let ci = Math.floor(win.x0 / TINT_CELL_KM) - 1; ci <= Math.ceil(win.x1 / TINT_CELL_KM); ci++) {
    for (let cj = Math.floor(win.y0 / TINT_CELL_KM) - 1; cj <= Math.ceil(win.y1 / TINT_CELL_KM); cj++) {
      if (hash2(ci, cj, 71) > 0.8) continue;
      const k: Pt = [(ci + 0.2 + 0.6 * hash2(ci, cj, 72)) * TINT_CELL_KM, (cj + 0.2 + 0.6 * hash2(ci, cj, 73)) * TINT_CELL_KM];
      const lat = ORIGIN_LAT + k[1] / LAT_KM;
      const lon = ORIGIN_LON + k[0] / LON_KM;
      if (packs.some((p) => lat >= p.box[0] && lat <= p.box[2] && lon >= p.box[1] && lon <= p.box[3])) continue;
      const tone = hash2(ci, cj, 76);
      out.push({ k, rx: TINT_CELL_KM * (0.7 + 0.7 * hash2(ci, cj, 74)), ry: TINT_CELL_KM * (0.5 + 0.5 * hash2(ci, cj, 75)), g: tone < 0.38 ? 'g' : tone < 0.7 ? 'w' : 't' });
    }
  }
  return out;
}

export type LabelMode = 'auto' | 'major' | 'all' | 'none';
export interface RegionMapOptions {
  /** Real width in px the map will be shown at (the text and the strokes are sized for it). */
  width?: number;
  labels?: LabelMode;
  /** Towns to emphasise (ids or names). */
  highlight?: readonly string[];
  /** Forces a level of detail of the base (0 is the coarsest): for the review of the data, the pages leave it out. */
  level?: number;
}

const MARGIN = 36; // beyond the frame the detail is kept (px)
const TERRA = '#a3431f';
const TOWN_STYLE = {
  1: { fs: 13, fw: 700, r: 3.7 },
  2: { fs: 11.5, fw: 600, r: 2.9 },
  3: { fs: 10.5, fw: 600, r: 2.4 },
} as const;

/** The level of detail whose simplification (km) stays within about 2 px at this scale. */
function lodFor(lods: readonly GeoLod[], tol: readonly number[], kmPerPx: number): GeoLod {
  let pick = 0;
  for (let i = 0; i < lods.length; i++) {
    pick = i;
    if (tol[i] <= 2 * kmPerPx) break;
  }
  return lods[pick];
}

/** A ring in px; near the frame the corners are rounded with a Catmull-Rom curve when the scale is close enough to need it. */
function ringPx(ring: Shape, px: (k: Pt) => Pt, winKm: Box, smoothKm: number): Pt[] {
  const pts = ring.k;
  if (!smoothKm || pts.length < 4) return pts.map(px);
  const segs = crBezier(pts, true);
  const out: Pt[] = [];
  for (const [p1, c1, c2, p2] of segs) {
    const hit = Math.max(p1[0], p2[0]) >= winKm.x0 && Math.min(p1[0], p2[0]) <= winKm.x1 && Math.max(p1[1], p2[1]) >= winKm.y0 && Math.min(p1[1], p2[1]) <= winKm.y1;
    if (!hit) {
      out.push(px(p1));
      continue;
    }
    const len = Math.hypot(c1[0] - p1[0], c1[1] - p1[1]) + Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) + Math.hypot(p2[0] - c2[0], p2[1] - c2[1]);
    const m = Math.max(1, Math.ceil(len / smoothKm));
    for (let k = 0; k < m; k++) {
      const t = k / m;
      const u = 1 - t;
      out.push(px([u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0], u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1]]));
    }
  }
  return out;
}

/** Soft footprint of a town: a ring of 12 points around its centre. */
function footprint(tw: WorldTown, c: Pt, rp: number): string {
  const rnd = rngOf('foot', tw.id);
  const n = 12;
  const ring: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    const rr = rp * (0.72 + rnd() * 0.5);
    ring.push([c[0] + Math.cos(a) * rr * 1.12, c[1] + Math.sin(a) * rr * 0.9]);
  }
  return smoothD(ring, true);
}

/** Minor roads: a lattice with noise, hooked to the towns. */
const LAT_CELL = 3.4;
function minorRoads(kx0: number, ky0: number, kx1: number, ky1: number, towns: readonly WorldTown[]): [Pt, Pt, Pt][] {
  const cx0 = Math.floor(kx0 / LAT_CELL) - 1;
  const cx1 = Math.ceil(kx1 / LAT_CELL) + 1;
  const cy0 = Math.floor(ky0 / LAT_CELL) - 1;
  const cy1 = Math.ceil(ky1 / LAT_CELL) + 1;
  const node = (i: number, j: number): Pt => {
    const h1 = hash2(i, j, 101);
    const h2 = hash2(i, j, 202);
    let p: Pt = [(i + 0.5 + (h1 - 0.5) * 0.7) * LAT_CELL, (j + 0.5 + (h2 - 0.5) * 0.7) * LAT_CELL];
    for (const tw of towns) {
      if (Math.hypot(tw.k[0] - p[0], tw.k[1] - p[1]) < 1.7 && tw.foot <= 1.5) {
        p = tw.k;
        break;
      }
    }
    return p;
  };
  const edges: [Pt, Pt, Pt][] = [];
  for (let i = cx0; i <= cx1; i++) {
    for (let j = cy0; j <= cy1; j++) {
      const a = node(i, j);
      for (const [di, dj, salt] of [[1, 0, 303], [0, 1, 404], [1, 1, 505]]) {
        if (hash2(i, j, salt) > (salt === 505 ? 0.16 : 0.66)) continue;
        const b = node(i + di, j + dj);
        if (a === b) continue;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const o = (hash2(i, j, salt + 7) - 0.5) * len * 0.28;
        const mid: Pt = [(a[0] + b[0]) / 2 - ((b[1] - a[1]) / len) * o, (a[1] + b[1]) / 2 + ((b[0] - a[0]) / len) * o];
        edges.push([a, mid, b]);
      }
    }
  }
  return edges;
}

const ROAD_STYLE: Record<number, [string, number, string, number]> = {
  4: ['#e4d8bf', 2, '#fcf7ec', 1.1],
  3: ['#e4d6b8', 2.5, '#fffaf0', 1.3],
  2: ['#e6cf9c', 3.1, '#fff4dc', 1.8],
  1: ['#e3c487', 3.8, '#ffeec6', 2.4],
};
const GRADS: Record<string, [string, number]> = { g: ['#cfd99c', 0.55], w: ['#f6e8b8', 0.7], t: ['#e4d2a8', 0.55], o: ['#d6cfbb', 0.5] };

/** Rotated name boxes need their bounding box. */
function nameBox(an: GeoName, c: Pt, kindSea: boolean): Box {
  const wd = textW(an.text, an.size, an.ls, kindSea ? 0.52 : 0.66);
  const box: Box = { x0: c[0] - wd / 2, x1: c[0] + wd / 2, y0: c[1] - an.size * 0.8, y1: c[1] + an.size * 0.3 };
  if (an.rot) {
    const ca = Math.abs(Math.cos(an.rot * DEG));
    const sa = Math.abs(Math.sin(an.rot * DEG));
    const hw = (wd * ca + an.size * sa) / 2;
    const hh = (wd * sa + an.size * ca) / 2;
    box.x0 = c[0] - hw;
    box.x1 = c[0] + hw;
    box.y0 = c[1] - hh;
    box.y1 = c[1] + hh;
  }
  return box;
}

/**
 * The background of a regional map (sea, land, coast, lakes, borders, roads, towns with names; no pins).
 * labels: 'auto' (levels of detail + collisions) · 'major' (only the provincial capitals) · 'all' (every town) · 'none'.
 */
export function regionMapSvg(viewIn: Partial<View>, { width = 1000, labels = 'auto', highlight = [], level }: RegionMapOptions = {}): string {
  const view = sane(viewIn);
  const world: World = getWorld();
  const W = Math.max(160, Math.round(Number.isFinite(width) ? width : 1000));
  const H = W / view.aspect;
  const S = view.spanKm;
  const sx = W / S; // px per km
  const [vkx, vky] = toKm(view.lat, view.lon);
  const px = (k: Pt): Pt => [(k[0] - vkx) * sx + W / 2, H / 2 - (k[1] - vky) * sx];
  const id = nextPrefix();
  const win: Box = { x0: -MARGIN, y0: -MARGIN, x1: W + MARGIN, y1: H + MARGIN };
  const mKm = MARGIN / sx;
  const winKm: Box = { x0: vkx - S / 2 - mKm, x1: vkx + S / 2 + mKm, y0: vky - S / view.aspect / 2 - mKm, y1: vky + S / view.aspect / 2 + mKm };
  const isNear = (p: Pt): boolean => p[0] > win.x0 && p[0] < win.x1 && p[1] > win.y0 && p[1] < win.y1;
  const inFrame = (p: Pt, m = 0): boolean => p[0] >= -m && p[0] <= W + m && p[1] >= -m && p[1] <= H + m;
  const findTown = (key: string): WorldTown | undefined => world.byKey.get(String(key)) ?? world.byKey.get(slug(key));
  const hl = new Set((highlight ?? []).map((h) => findTown(h)?.id).filter((v): v is string => !!v));
  const base = world.base;
  const lod: GeoLod = base ? (level != null ? base.lods[clamp(Math.round(level), 0, base.lods.length - 1)] : lodFor(base.lods, base.tol, S / W)) : { land: [], italy: [], lakes: [], borders: [] };
  const smoothKm = S / W < 0.25 ? clamp((3.5 * S) / W, 0.03, 0.4) : 0;

  /* --- land, Italy, coast, borders --- */
  const step = Math.max(2.6, W / 330);
  const shapePolys = (list: readonly Shape[], thinFar = 48): { thin: Pt[]; clip: Poly }[] => {
    const out: { thin: Pt[]; clip: Poly }[] = [];
    for (const ring of list) {
      if (!hits({ x0: ring.box[0], y0: ring.box[1], x1: ring.box[2], y1: ring.box[3] }, winKm)) continue;
      const thin = thinPts(ringPx(ring, px, winKm, smoothKm), isNear, step, thinFar);
      const clip = clipRect(thin, win.x0, win.y0, win.x1, win.y1);
      if (clip.length > 2) out.push({ thin, clip });
    }
    return out;
  };
  const land = shapePolys(lod.land);
  const landPolys = land.map((l) => l.clip);
  const italyPolys = shapePolys(lod.italy).map((l) => l.clip);
  const coastRuns = land.flatMap((l) => runsInBox([...l.thin, l.thin[0]], win));
  const hasCoast = coastRuns.length > 0;
  const coastPts = coastRuns.flat();
  const borderRuns: Pt[][] = [];
  for (const b of lod.borders) {
    if (!hits({ x0: b.box[0], y0: b.box[1], x1: b.box[2], y1: b.box[3] }, winKm)) continue;
    borderRuns.push(...runsInBox(thinPts(b.k.map(px), isNear, 3, 60), win));
  }
  const onLand = (x: number, y: number): boolean => landPolys.some((p) => pip(p, x, y));
  const onItaly = (x: number, y: number): boolean => italyPolys.some((p) => pip(p, x, y));
  const hasLand = landPolys.length > 0;

  const defs: string[] = [];
  defs.push(
    `<linearGradient id="${id}s" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#c8e2e7"/><stop offset=".55" stop-color="#b6dae0"/><stop offset="1" stop-color="#a2ced7"/></linearGradient>`,
  );
  const landD = landPolys.map((p) => polyD(p)).join('');
  if (hasLand) defs.push(`<path id="${id}L" d="${landD}"/><clipPath id="${id}kL"><use href="#${id}L"/></clipPath>`);
  if (italyPolys.length) defs.push(`<clipPath id="${id}kP"><path d="${italyPolys.map((p) => polyD(p)).join('')}"/></clipPath>`);

  const body: string[] = [];
  body.push(`<rect width="${num(W)}" height="${num(H)}" fill="url(#${id}s)"/>`);
  // band of shallow water along the coast
  if (hasCoast && hasLand) {
    body.push(
      `<g fill="none" stroke="#e1f2f2" stroke-linejoin="round" stroke-linecap="round"><use href="#${id}L" stroke-opacity=".26" stroke-width="34"/><use href="#${id}L" stroke-opacity=".34" stroke-width="19"/><use href="#${id}L" stroke-opacity=".5" stroke-width="8"/></g>`,
    );
  }
  if (hasLand) {
    body.push(`<use href="#${id}L" fill="#e9e1d0"/>`);
    if (italyPolys.length) body.push(`<use href="#${id}L" fill="#f1e8d6" clip-path="url(#${id}kP)"/>`);
  }

  /* --- tints of the territory and texture --- */
  const usedG = new Set<string>();
  const tintsP: string[] = [];
  const tintsO: string[] = [];
  for (const pack of world.packs) {
    for (const ti of pack.tints) {
      const c = px(toKm(ti.lat, ti.lon));
      const rx = ti.rx * sx;
      const ry = ti.ry * sx;
      if (c[0] + rx < 0 || c[0] - rx > W || c[1] + ry < 0 || c[1] - ry > H) continue;
      usedG.add(ti.g);
      (ti.g === 'o' ? tintsO : tintsP).push(`<ellipse cx="${num(c[0])}" cy="${num(c[1])}" rx="${num(rx)}" ry="${num(ry)}" fill="url(#${id}g${ti.g})"/>`);
    }
  }
  if (S <= 400 && hasLand) {
    for (const ti of proceduralTints(winKm, world.packs)) {
      const c = px(ti.k);
      const rx = ti.rx * sx;
      const ry = ti.ry * sx;
      if (c[0] + rx < 0 || c[0] - rx > W || c[1] + ry < 0 || c[1] - ry > H) continue;
      usedG.add(ti.g);
      tintsP.push(`<ellipse cx="${num(c[0])}" cy="${num(c[1])}" rx="${num(rx)}" ry="${num(ry)}" fill="url(#${id}g${ti.g})"/>`);
    }
  }
  for (const g of usedG) {
    defs.push(`<radialGradient id="${id}g${g}"><stop offset="0" stop-color="${GRADS[g][0]}" stop-opacity="${GRADS[g][1]}"/><stop offset="1" stop-color="${GRADS[g][0]}" stop-opacity="0"/></radialGradient>`);
  }
  if (hasLand) {
    defs.push(
      `<pattern id="${id}d" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r=".85" fill="#d9ccab" fill-opacity="${S <= 40 ? '.4' : '.6'}"/><circle cx="7.5" cy="7.5" r=".85" fill="#d9ccab" fill-opacity="${S <= 40 ? '.4' : '.6'}"/></pattern>`,
    );
    // fields, olive groves and vineyards: a mosaic of plots in soft tones (Voronoi on a noisy grid), only when close
    let quilt = '';
    if (S <= 40 && italyPolys.length) {
      const CELL = clamp(S / 9, 1.3, 4.4);
      const hk = S / view.aspect;
      const kx0 = vkx - S / 2 - CELL;
      const kx1 = vkx + S / 2 + CELL;
      const ky0 = vky - hk / 2 - CELL;
      const ky1 = vky + hk / 2 + CELL;
      const sites: Pt[] = [];
      const meta: [number, number][] = [];
      for (let i = Math.floor(kx0 / CELL) - 1; i <= Math.ceil(kx1 / CELL) + 1; i++) {
        for (let j = Math.floor(ky0 / CELL) - 1; j <= Math.ceil(ky1 / CELL) + 1; j++) {
          sites.push([(i + 0.5 + (hash2(i, j, 32) - 0.5) * 0.85) * CELL, (j + 0.5 + (hash2(i, j, 33) - 0.5) * 0.85) * CELL]);
          meta.push([i, j]);
        }
      }
      const cells = voronoiCells(sites, [[kx0 - CELL, ky0 - CELL], [kx1 + CELL, ky0 - CELL], [kx1 + CELL, ky1 + CELL], [kx0 - CELL, ky1 + CELL]]);
      const groups: Record<'o' | 'w' | 'v' | 's', string[]> = { o: [], w: [], v: [], s: [] };
      cells.forEach((poly, n) => {
        if (!poly) return;
        const h = hash2(meta[n][0], meta[n][1], 31);
        if (h < 0.15) return;
        const P = poly.map(px);
        if (!runsInBox([...P, P[0]], { x0: -6, y0: -6, x1: W + 6, y1: H + 6 }).length) return;
        groups[h < 0.5 ? 'o' : h < 0.72 ? 'w' : h < 0.88 ? 'v' : 's'].push(polyD(P, 1));
      });
      const tone = { o: ['#d9e0b2', 0.45], w: ['#f6ebca', 0.55], v: ['#e5e3ba', 0.42], s: ['#ece0c8', 0.45] } as const;
      for (const k of ['o', 'w', 'v', 's'] as const) if (groups[k].length) quilt += `<path d="${groups[k].join('')}" fill="${tone[k][0]}" fill-opacity="${tone[k][1]}"/>`;
    }
    const inItaly = italyPolys.length ? `<g clip-path="url(#${id}kP)">${tintsP.join('')}${quilt}<rect width="${num(W)}" height="${num(H)}" fill="url(#${id}d)"/></g>` : '';
    body.push(`<g clip-path="url(#${id}kL)">${tintsO.join('')}${inItaly}`);
    // inner shadow of the coast: it makes the shape stand out
    if (hasCoast) body.push(`<g fill="none" stroke="#c9b78c" stroke-linejoin="round"><use href="#${id}L" stroke-opacity=".2" stroke-width="16"/><use href="#${id}L" stroke-opacity=".28" stroke-width="6"/></g>`);
    // dashed borders between regions
    if (borderRuns.length) body.push(`<path d="${borderRuns.map((r) => lineD(r)).join('')}" fill="none" stroke="#cbbd9c" stroke-width="1.1" stroke-dasharray="5 3.5" stroke-linecap="round" opacity=".85"/>`);
    body.push('</g>');
  }

  /* --- lakes and lagoons --- */
  const lakeShapes: Pt[][] = [];
  for (const lk of lod.lakes) {
    if (!hits({ x0: lk.box[0], y0: lk.box[1], x1: lk.box[2], y1: lk.box[3] }, winKm)) continue;
    lakeShapes.push(lk.k.map(px));
  }
  for (const lk of world.lakes) lakeShapes.push(lk.map(px));
  for (const P of lakeShapes) {
    if (!P.some((p) => inFrame(p, 40))) continue;
    body.push(`<path d="${polyD(thinPts(P, isNear, 2, 8))}" fill="#b4d7de" stroke="#e1f0f0" stroke-width="1.4" stroke-linejoin="round"/>`);
  }

  /* --- footprints of the towns (when close) --- */
  const tierMax = labels === 'major' ? 1 : labels === 'all' ? 3 : S <= 45 ? 3 : S <= 165 ? 2 : 1;
  if (S <= 130) {
    const foot: string[] = [];
    for (const tw of world.towns) {
      if (!tw.detail && tw.tier > tierMax) continue; // a town of the base has its built-up area only when it has its name
      const rp = tw.foot * sx;
      if (rp < 5 || rp > 1200) continue;
      const c = px(tw.k);
      if (c[0] < -rp || c[0] > W + rp || c[1] < -rp || c[1] > H + rp) continue;
      foot.push(footprint(tw, c, rp));
    }
    if (foot.length && hasLand) {
      defs.push(`<pattern id="${id}u" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><rect width="6" height="6" fill="#ebdfc6"/><path d="M0 .3H6M.3 0V6" stroke="#fffaf0" stroke-opacity=".42" stroke-width=".8"/></pattern>`);
      body.push(`<path clip-path="url(#${id}kL)" d="${foot.join('')}" fill="url(#${id}u)" stroke="#d9c8a4" stroke-width=".9"/>`);
    }
  }

  /* --- railways (at the scale of an area) --- */
  if (S <= 110 && hasLand) {
    const railD: string[] = [];
    for (const r of world.rails) for (const run of runsInBox(r.map(px), win)) railD.push(smoothD(run, false));
    if (railD.length) {
      defs.push(`<path id="${id}rl" d="${railD.join('')}"/>`);
      body.push(`<g clip-path="url(#${id}kL)" fill="none" stroke="#c4b79d" stroke-linejoin="round"><use href="#${id}rl" stroke-width="1.2"/><use href="#${id}rl" stroke-width="4" stroke-dasharray="1 5"/></g>`);
    }
  }

  /* --- roads --- */
  const roadParts: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [] };
  const maxClass = S <= 80 ? 3 : S <= 170 ? 2 : 1;
  for (const rd of world.roads) {
    if (rd.c > maxClass) continue;
    const P = rd.pts.map(px);
    for (const run of runsInBox(P, win)) roadParts[rd.c].push(smoothD(run, false));
  }
  if (S <= 32 && hasLand) {
    const x0 = vkx - S / 2 - 1;
    const x1 = vkx + S / 2 + 1;
    const y0 = vky - S / view.aspect / 2 - 1;
    const y1 = vky + S / view.aspect / 2 + 1;
    const near = world.towns.filter((tw) => tw.k[0] > x0 - 3 && tw.k[0] < x1 + 3 && tw.k[1] > y0 - 3 && tw.k[1] < y1 + 3);
    for (const [a, m, b] of minorRoads(x0, y0, x1, y1, near)) {
      const A = px(a);
      const B = px(b);
      const Mi = px(m);
      roadParts[4].push(`M${num(A[0])} ${num(A[1])}Q${num(2 * Mi[0] - (A[0] + B[0]) / 2)} ${num(2 * Mi[1] - (A[1] + B[1]) / 2)} ${num(B[0])} ${num(B[1])}`);
    }
  }
  const roadBody: string[] = [];
  for (const c of [4, 3, 2, 1]) {
    if (!roadParts[c].length) continue;
    const [cas, cw, fil, fw] = ROAD_STYLE[c];
    defs.push(`<path id="${id}r${c}" d="${roadParts[c].join('')}"/>`);
    roadBody.push(`<use href="#${id}r${c}" stroke="${cas}" stroke-width="${cw}"/><use href="#${id}r${c}" stroke="${fil}" stroke-width="${fw}"/>`);
  }
  if (roadBody.length && hasLand) body.push(`<g clip-path="url(#${id}kL)" fill="none" stroke-linecap="round" stroke-linejoin="round">${roadBody.join('')}</g>`);

  /* --- towns: dots and names (priority: emphasised, then level, then size) --- */
  const placer = makePlacer(W, H);
  const labelsOn = labels !== 'none';
  const cand: { tw: WorldTown; c: Pt; mine: boolean }[] = [];
  for (const tw of world.towns) {
    const mine = hl.has(tw.id);
    if (!mine && tw.tier > tierMax) continue;
    const c = px(tw.k);
    if (!inFrame(c, 2)) continue;
    cand.push({ tw, c, mine });
  }
  cand.sort((a, b) => Number(b.mine) - Number(a.mine) || a.tw.tier - b.tw.tier || b.tw.foot - a.tw.foot);
  const dotsSvg: string[] = [];
  const ringsSvg: string[] = [];
  const lab: Record<'1' | '2' | '3' | 'h', string[]> = { 1: [], 2: [], 3: [], h: [] };
  for (const { tw, c, mine } of cand) {
    const st = TOWN_STYLE[tw.tier];
    const r = mine ? 5 : st.r;
    const fs = mine ? 13 : st.fs;
    const dotBox: Box = { x0: c[0] - r - 1.5, y0: c[1] - r - 1.5, x1: c[0] + r + 1.5, y1: c[1] + r + 1.5 };
    if (!mine && !placer.free(dotBox, 0)) continue;
    let spot: { anchor: 'start' | 'end' | 'middle'; tx: number; ty: number; box: Box } | null = null;
    if (labelsOn) {
      const wd = textW(tw.name, fs, 0, mine ? 0.6 : 0.575);
      const g = r + 3.6;
      const hBox = fs * 1.02;
      const mk = (anchor: 'start' | 'end' | 'middle', tx: number, ty: number) => {
        const x0 = anchor === 'start' ? tx : anchor === 'end' ? tx - wd : tx - wd / 2;
        return { anchor, tx, ty, box: { x0, x1: x0 + wd, y0: ty - fs * 0.76, y1: ty - fs * 0.76 + hBox } };
      };
      const cs = [
        mk('start', c[0] + g, c[1] + fs * 0.34),
        mk('end', c[0] - g, c[1] + fs * 0.34),
        mk('middle', c[0], c[1] + g + fs * 0.78),
        mk('middle', c[0], c[1] - g + fs * 0.1),
        mk('start', c[0] + g * 0.7, c[1] - g * 0.65),
        mk('start', c[0] + g * 0.7, c[1] + g * 0.65 + fs * 0.7),
        mk('end', c[0] - g * 0.7, c[1] - g * 0.65),
        mk('end', c[0] - g * 0.7, c[1] + g * 0.65 + fs * 0.7),
      ];
      const ok = (q: (typeof cs)[number], needLand: boolean): boolean => placer.free(q.box) && (!needLand || onLand((q.box.x0 + q.box.x1) / 2, (q.box.y0 + q.box.y1) / 2));
      spot = cs.find((q) => ok(q, true)) ?? cs.find((q) => ok(q, false)) ?? null;
      if (!spot && !mine) continue; // no free place for the name: no dot either (a map has no anonymous dots)
    }
    placer.add(dotBox);
    if (spot) placer.add(spot.box);
    if (mine) {
      ringsSvg.push(`<circle cx="${num(c[0])}" cy="${num(c[1])}" r="9.5" fill="${TERRA}" fill-opacity=".16"/><circle cx="${num(c[0])}" cy="${num(c[1])}" r="${r}" fill="${TERRA}" stroke="#fff7ec" stroke-width="1.8"/>`);
    } else if (tw.tier === 1) {
      dotsSvg.push(`<circle cx="${num(c[0])}" cy="${num(c[1])}" r="${r}" fill="#fffaf0" stroke="${INK}" stroke-width="1.6"/>`);
    } else {
      dotsSvg.push(`<circle cx="${num(c[0])}" cy="${num(c[1])}" r="${r}" fill="#8b7d66" stroke="#fbf6ea" stroke-width="1.1"/>`);
    }
    if (spot) {
      const t = `<text x="${num(spot.tx)}" y="${num(spot.ty)}"${spot.anchor === 'start' ? '' : ` text-anchor="${spot.anchor}"`}>${esc(tw.name)}</text>`;
      (mine ? lab.h : lab[String(tw.tier) as '1' | '2' | '3']).push(t);
    }
  }

  /* --- names of seas, regions and territories --- */
  const areas: { an: GeoName; kind: 'land' | 'sea' | 'out'; c: Pt }[] = [];
  const doNames = labelsOn && labels !== 'major';
  if (doNames) {
    const seaOk = S >= 120;
    const names: { an: GeoName; kind: 'land' | 'sea' | 'out' }[] = [];
    for (const pack of world.packs) for (const an of pack.areaNames) names.push({ an, kind: an.kind });
    for (const an of base?.regions ?? []) names.push({ an, kind: 'land' });
    for (const an of base?.seas ?? []) names.push({ an, kind: 'sea' });
    for (const an of base?.countries ?? []) names.push({ an, kind: 'out' });
    for (const { an, kind } of names) {
      if (S < an.min || S > an.max) continue;
      if (kind === 'sea' && !seaOk) continue;
      if (kind === 'sea' && areas.some((q) => q.an.text === an.text)) continue; // a sea has one name on the map, at the first place where it fits
      const c = px(toKm(an.lat, an.lon));
      const box = nameBox(an, c, kind === 'sea');
      if (!placer.free(box, 4)) continue;
      const here = onLand(c[0], c[1]);
      if (kind === 'sea' && here) continue;
      if (kind === 'land' && !(here && onItaly(c[0], c[1]))) continue;
      if (kind === 'out' && !(here && !onItaly(c[0], c[1]))) continue;
      placer.add(box);
      areas.push({ an, kind, c });
    }
    // name of the nearby sea: the open point of sea where the label fits entirely in the water, named after the nearest sea of the base
    if (!areas.some((q) => q.kind === 'sea') && S >= 4 && S < 330 && coastPts.length && base?.seas.length) {
      const cands: { x: number; y: number; d: number }[] = [];
      const nx = 16;
      const ny = 12;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          const x = ((i + 0.5) / nx) * W;
          const y = ((j + 0.5) / ny) * H;
          if (onLand(x, y)) continue;
          let d = Infinity;
          for (const p of coastPts) d = Math.min(d, Math.hypot(p[0] - x, p[1] - y));
          cands.push({ x, y, d });
        }
      }
      cands.sort((p, q) => q.d - p.d);
      for (const q of cands.slice(0, 40)) {
        if (q.d < 14) break;
        const g = unprojectPoint((q.x / W) * 100, (q.y / H) * 100, view);
        const gk = toKm(g.lat, g.lon);
        let best = base.seas[0];
        let bd = Infinity;
        for (const sn of base.seas) {
          const k = toKm(sn.lat, sn.lon);
          const dd = Math.hypot(k[0] - gk[0], k[1] - gk[1]);
          if (dd < bd) {
            bd = dd;
            best = sn;
          }
        }
        const an: GeoName = { text: best.text, lat: g.lat, lon: g.lon, size: 12, ls: 2.2, min: 0, max: 0 };
        const box: Box = { x0: q.x - textW(an.text, 12, 2.2, 0.52) / 2, x1: q.x + textW(an.text, 12, 2.2, 0.52) / 2, y0: q.y - 12, y1: q.y + 12 * 0.4 };
        if ([[box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1]].some((p) => onLand(p[0], p[1]))) continue;
        if (!placer.free(box, 4)) continue;
        placer.add(box);
        areas.push({ an, kind: 'sea', c: [q.x, q.y] });
        break;
      }
    }
  }
  const areaSvg = areas
    .map(({ an, kind, c }) => {
      const rot = an.rot ? ` transform="rotate(${an.rot} ${num(c[0])} ${num(c[1])})"` : '';
      const common = `x="${num(c[0])}" y="${num(c[1])}" text-anchor="middle" font-size="${an.size}" letter-spacing="${an.ls}"${rot}`;
      if (kind === 'sea') return `<text ${common} font-style="italic" font-weight="500" fill="#5f8d9b" stroke="none">${esc(an.text)}</text>`;
      return `<text ${common} font-weight="${an.size > 14 ? 700 : 600}" fill="${kind === 'out' ? '#c2b79c' : '#b2a183'}">${esc(an.text)}</text>`;
    })
    .join('');

  const labelGroup = (items: string[], fs: number, fw: number, extra = ''): string => (items.length ? `<g font-size="${fs}" font-weight="${fw}"${extra}>${items.join('')}</g>` : '');
  const textLayer = `<g font-family="${FONT}" fill="${INK}" stroke="${HALO}" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke">${areaSvg}${labelGroup(lab[3], 10.5, 600)}${labelGroup(lab[2], 11.5, 600)}${labelGroup(lab[1], 13, 700)}${labelGroup(lab.h, 13, 700, ` fill="#7b2f14"`)}</g>`;
  body.push(dotsSvg.join(''), ringsSvg.join(''), textLayer);

  return `<svg class="sm-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(W)} ${num(H, 2)}" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true" focusable="false"><defs>${defs.join('')}</defs>${body.join('')}</svg>`;
}

