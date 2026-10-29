/**
 * Drawing of the neighbourhood maps (DB-19a): turns the generated geometry into SVG strings. The SVG is decorative
 * (`aria-hidden`): whatever it shows is also available as text in the page that uses it.
 */
import { insetConvex, lineD, polyCentroid, polyD, smoothD, clipRect, type Poly, type Pt } from '../geometry';
import { clamp, esc, num } from '../numeric';
import { FONT, HALO, INK, textW } from '../style';
import type { CoastData } from './gen-coast';
import type { CountryData } from './gen-country';
import type { HistoricData } from './gen-historic';
import { UW, VY0, VY1, type Block, type Cut } from './shared';

const PAL = {
  paper: '#efe7d8',
  paper2: '#f4eee2',
  lane: '#fffdf8',
  laneCase: '#e2d8c5',
  road: '#fff0cf',
  roadCase: '#e9cf9a',
  park: '#dfe3c2',
  parkEdge: '#cdd5a4',
  plaza: '#f9f3e4',
  plazaEdge: '#e6dabf',
  blocks: ['#e8dcc7', '#eee4d1', '#e1d3ba', '#e8cdb4'],
  newBlocks: ['#ebe1cd', '#e7dcc6'],
  whiteBlocks: ['#f3ecde', '#f8f3e8', '#ede2cf', '#efd8c3'],
};

export interface LocalCtx {
  W: number;
  H: number;
  sc: number;
  ks: number;
  P: (p: Pt) => Pt;
}
export interface Drawn {
  defs: string[];
  out: string[];
}

export function localCtx(width: number): LocalCtx {
  const W = Math.max(200, Math.round(width));
  const sc = W / UW;
  return { W, H: W * 0.75, sc, ks: clamp(0.6 + 0.4 * (W / 800), 0.8, 1.4), P: (p) => [p[0] * sc, (p[1] - VY0) * sc] };
}

const polyP = (poly: Poly, c: LocalCtx): string => polyD(poly.map(c.P), 1);
const lineP = (pts: Pt[], c: LocalCtx): string => lineD(pts.map(c.P), 1);
const smoothP = (pts: Pt[], c: LocalCtx, closed = false): string => smoothD(pts.map(c.P), closed, 1);

/** Does the polygon touch the visible band of the drawing? (whatever is outside the frame is dropped) */
function bandHit(p: readonly Pt[]): boolean {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const q of p) {
    x0 = Math.min(x0, q[0]);
    x1 = Math.max(x1, q[0]);
    y0 = Math.min(y0, q[1]);
    y1 = Math.max(y1, q[1]);
  }
  return x1 > -3 && x0 < UW + 3 && y1 > VY0 - 3 && y0 < VY1 + 3;
}

/** Blocks of one tone, shrunk to leave the lanes. */
function blocksP(blocks: readonly Block[], tone: number, c: LocalCtx, laneHalf: number, dec = 1): string {
  let d = '';
  for (const b of blocks) {
    if (b.t !== tone || !bandHit(b.p)) continue;
    const q = insetConvex(b.p.map(c.P), laneHalf);
    if (q) d += polyD(q, dec);
  }
  return d;
}

/** Coloured blocks; the «lane» is a light outline painted before the fill (paint-order). */
function blockLayer(blocks: readonly Block[], tones: number[], colors: readonly string[], c: LocalCtx, laneHalf: number, lane: string, dec = 1): string {
  const out: string[] = [];
  for (const t of tones) {
    const d = blocksP(blocks, t, c, laneHalf, dec);
    if (d) out.push(`<path d="${d}" fill="${colors[t]}"/>`);
  }
  if (!out.length) return '';
  return lane ? `<g stroke="${lane}" stroke-width="${num(laneHalf * 4)}" stroke-linejoin="round" paint-order="stroke">${out.join('')}</g>` : out.join('');
}

/** Main streets of the town: the first cuts of the split, wider than the lanes. */
function cutLayer(cuts: readonly Cut[], c: LocalCtx, ks: number, color: string): string {
  const lv: string[][] = [[], [], []];
  for (const q of cuts) {
    if (q.lv > 2 || !bandHit([q.a, q.b])) continue;
    const A = c.P(q.a);
    const B = c.P(q.b);
    lv[Math.min(q.lv, 2)].push(`M${num(A[0])} ${num(A[1])}L${num(B[0])} ${num(B[1])}`);
  }
  const widths = [3.6, 3.2, 2.5];
  return lv.map((l, i) => (l.length ? `<path d="${l.join('')}" fill="none" stroke="${color}" stroke-width="${num(widths[i] * ks)}"/>` : '')).join('');
}

const plazaLayer = (polys: readonly Poly[], c: LocalCtx): string => {
  const d = polys.filter(bandHit).map((p) => polyP(p, c)).join('');
  return d ? `<path d="${d}" fill="${PAL.plaza}" stroke="${PAL.plazaEdge}" stroke-width=".9" stroke-linejoin="round"/>` : '';
};

/** A road with its casing: the path is defined once in the defs and used twice. */
function roadLayer(id: string, key: string, d: string, casing: string, caseW: number, fill: string, fillW: number): { def: string; use: string } {
  if (!d) return { def: '', use: '' };
  return {
    def: `<path id="${id}${key}" d="${d}"/>`,
    use: `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><use href="#${id}${key}" stroke="${casing}" stroke-width="${num(caseW)}"/><use href="#${id}${key}" stroke="${fill}" stroke-width="${num(fillW)}"/></g>`,
  };
}

const treePattern = (id: string, key: string, base: string, dot: string, step: number, r: number): string =>
  `<pattern id="${id}${key}" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><rect width="${step}" height="${step}" fill="${base}"/><circle cx="${num(step * 0.25)}" cy="${num(step * 0.25)}" r="${r}" fill="${dot}"/><circle cx="${num(step * 0.75)}" cy="${num(step * 0.75)}" r="${r}" fill="${dot}"/></pattern>`;
const stripePattern = (id: string, key: string, base: string, line: string, step: number, w: number, rot: number): string =>
  `<pattern id="${id}${key}" width="${step}" height="${step}" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot})"><rect width="${step}" height="${step}" fill="${base}"/><rect width="${step}" height="${w}" fill="${line}"/></pattern>`;

/* ----- coast ----- */
export function drawCoast(d: CoastData, rotDeg: number, c: LocalCtx, id: string): Drawn {
  const { W, H, ks } = c;
  const defs: string[] = [];
  const out: string[] = [];
  const lh = (1.9 * ks) / 2 + 0.2;
  out.push(`<rect width="${num(W)}" height="${num(H)}" fill="${PAL.paper2}"/>`);
  out.push(blockLayer(d.newBlocks, [0, 1], PAL.newBlocks, c, (2.2 * ks) / 2, '', 0));
  // park with trees
  defs.push(treePattern(id, 't', PAL.park, '#bfca94', 7, 1.2));
  defs.push(`<path id="${id}pk" d="${smoothP(d.park, c, true)}"/>`);
  out.push(`<use href="#${id}pk" fill="${PAL.park}" stroke="${PAL.parkEdge}" stroke-width="1"/><use href="#${id}pk" fill="url(#${id}t)"/>`);
  // railway and main road behind the town
  out.push(`<g fill="none" stroke="#b8ab94" stroke-linejoin="round"><path d="${smoothP(d.rail, c)}" stroke-width="${num(1.3 * ks)}"/><path d="${smoothP(d.rail, c)}" stroke-width="${num(4.6 * ks)}" stroke-dasharray="1.1 5.4"/></g>`);
  const rd = roadLayer(id, 'rd', smoothP(d.road, c), PAL.roadCase, 6.6 * ks, PAL.road, 4.6 * ks);
  defs.push(rd.def);
  out.push(rd.use);
  // old town: blocks, main streets, squares
  out.push(blockLayer(d.blocks, [0, 1, 2, 3], PAL.blocks, c, lh, PAL.lane));
  out.push(cutLayer(d.cuts, c, ks, PAL.lane));
  out.push(plazaLayer(d.plazas, c));
  const via = roadLayer(id, 'vi', smoothP(d.via, c), PAL.laneCase, 5.2 * ks, PAL.lane, 3.6 * ks);
  defs.push(via.def);
  out.push(via.use);
  // sea
  const seaD = polyD(clipRect(d.sea.map(c.P), -24, -24, W + 24, H + 24), 1);
  defs.push(`<path id="${id}cl" d="${seaD}"/>`);
  defs.push(`<linearGradient id="${id}w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cfe8eb"/><stop offset="1" stop-color="#9ecbd5"/></linearGradient>`);
  defs.push(`<clipPath id="${id}sc"><use href="#${id}cl"/></clipPath>`);
  out.push(`<use href="#${id}cl" fill="none" stroke="${PAL.laneCase}" stroke-width="${num(11 * ks)}" stroke-linejoin="round"/><use href="#${id}cl" fill="none" stroke="${PAL.lane}" stroke-width="${num(9 * ks)}" stroke-linejoin="round"/>`);
  out.push(`<use href="#${id}cl" fill="url(#${id}w)"/>`);
  out.push(`<g clip-path="url(#${id}sc)" fill="none" stroke-linejoin="round" stroke-linecap="round"><use href="#${id}cl" stroke="#e6f4f5" stroke-opacity=".35" stroke-width="${num(26 * ks)}"/><use href="#${id}cl" stroke="#e6f4f5" stroke-opacity=".45" stroke-width="${num(14 * ks)}"/><use href="#${id}cl" stroke="#f1fafa" stroke-opacity=".7" stroke-width="${num(5 * ks)}"/></g>`);
  const waves = d.waves
    .map((w0) => {
      const p = c.P(w0);
      return `M${num(p[0])} ${num(p[1])}q${num(3 * ks)} ${num(-2.2 * ks)} ${num(6 * ks)} 0t${num(6 * ks)} 0t${num(6 * ks)} 0`;
    })
    .join('');
  if (waves) out.push(`<path d="${waves}" fill="none" stroke="#eaf6f7" stroke-opacity=".85" stroke-width="1.2" stroke-linecap="round"/>`);
  const tp = c.P(d.tip);
  out.push(`<ellipse cx="${num(tp[0])}" cy="${num(tp[1])}" rx="${num(1.5 * c.sc)}" ry="${num(0.9 * c.sc)}" fill="#f4e6c8" fill-opacity=".9" transform="rotate(${num(-25 + rotDeg)} ${num(tp[0])} ${num(tp[1])})"/>`);
  out.push(`<use href="#${id}cl" fill="none" stroke="#c9b896" stroke-width="1.1" stroke-linejoin="round"/>`);
  return { defs, out };
}

/* ----- historic centre ----- */
export function drawHistoric(d: HistoricData, c: LocalCtx, id: string): Drawn {
  const { W, H, ks } = c;
  const defs: string[] = [];
  const out: string[] = [];
  const lh = (1.9 * ks) / 2 + 0.2;
  out.push(`<rect width="${num(W)}" height="${num(H)}" fill="${PAL.paper2}"/>`);
  out.push(blockLayer(d.outBlocks, [0, 1], PAL.newBlocks, c, (2.4 * ks) / 2, PAL.paper2, 0));
  defs.push(treePattern(id, 't', PAL.park, '#bfca94', 7, 1.2));
  d.parks.forEach((pk, i) => {
    defs.push(`<path id="${id}pk${i}" d="${smoothP(pk, c, true)}"/>`);
    out.push(`<use href="#${id}pk${i}" fill="${PAL.park}" stroke="${PAL.parkEdge}" stroke-width="1"/><use href="#${id}pk${i}" fill="url(#${id}t)"/>`);
  });
  // radial roads and ring road (avenues along the old walls)
  const mainD = d.radials.map((r) => smoothP(r, c)).join('') + smoothP(d.ring, c, true);
  const rd = roadLayer(id, 'rd', mainD, PAL.roadCase, 6.8 * ks, PAL.road, 4.8 * ks);
  defs.push(rd.def);
  out.push(rd.use);
  // moat and castle
  out.push(`<path d="${polyP(d.castle.moat, c)}" fill="#dbe8e2" stroke="#c4d5cd" stroke-width="1"/>`);
  out.push(blockLayer(d.blocks, [0, 1, 2], PAL.blocks, c, lh, PAL.lane));
  out.push(cutLayer(d.cuts, c, ks, PAL.lane));
  out.push(plazaLayer(d.plazas, c));
  // the big square hosts the Roman amphitheatre: a smaller ring, just hinted
  const pz = d.plazas[0];
  const pcen = polyCentroid(pz);
  out.push(`<path d="${polyP(pz.map((q): Pt => [pcen[0] + (q[0] - pcen[0]) * 0.6, pcen[1] + (q[1] - pcen[1]) * 0.6]), c)}" fill="none" stroke="#d9c9a6" stroke-width="${num(0.9 * ks)}"/>`);
  out.push(`<path d="${polyP(d.duomoBlock, c)}" fill="${PAL.blocks[3]}" stroke="#d4c4a3" stroke-width=".7" stroke-linejoin="round"/>`);
  out.push(`<path d="${polyP(d.castle.moat, c)}" fill="#dbe8e2" stroke="#c4d5cd" stroke-width="1"/>`);
  out.push(`<path d="${polyP(d.castle.poly, c)}" fill="#e3d1b5" stroke="#bda583" stroke-width="1" stroke-linejoin="round"/><path d="${polyP(d.castle.inner, c)}" fill="#f0e6d2" stroke="#cdb994" stroke-width=".8"/>`);
  out.push(
    `<g fill="#dcc7a4" stroke="#bda583" stroke-width=".9">${d.castle.poly
      .map((p) => {
        const q = c.P(p);
        return `<circle cx="${num(q[0])}" cy="${num(q[1])}" r="${num(1.15 * c.sc)}"/>`;
      })
      .join('')}</g>`,
  );
  const spine = roadLayer(id, 'sp', smoothP(d.ew, c) + smoothP(d.ns, c), PAL.laneCase, 5.2 * ks, PAL.lane, 3.5 * ks);
  defs.push(spine.def);
  out.push(spine.use);
  return { defs, out };
}

/* ----- countryside ----- */
export function drawCountry(d: CountryData, c: LocalCtx, id: string): Drawn {
  const { W, H, ks } = c;
  const defs: string[] = [];
  const out: string[] = [];
  out.push(`<rect width="${num(W)}" height="${num(H)}" fill="${PAL.paper}"/>`);
  defs.push(treePattern(id, 'o0', '#dde2bc', '#b9c08e', 9, 1.1));
  defs.push(treePattern(id, 'o1', '#d5dbb3', '#adb680', 10, 1.2));
  defs.push(stripePattern(id, 'o2', '#ece0c5', '#e0d3b2', 4.8, 0.9, 25));
  defs.push(stripePattern(id, 'o3', '#e3e0b9', '#cdc993', 4, 1, -18));
  defs.push(treePattern(id, 'o4', '#e9ddc5', '#dccdac', 12, 0.9));
  defs.push(treePattern(id, 'o5', '#e5e7c6', '#c7cea5', 12, 1.7));
  defs.push(treePattern(id, 'o6', '#eee8d4', '#d2cba9', 10, 0.9));
  const byKind: string[][] = [[], [], [], [], [], [], []];
  for (const f of d.fields) if (bandHit(f.p)) byKind[f.k].push(polyP(f.p, c));
  const fieldUse: string[] = [];
  const wallUse: string[] = [];
  byKind.forEach((list, k) => {
    if (!list.length) return;
    defs.push(`<path id="${id}f${k}" d="${list.join('')}"/>`);
    fieldUse.push(`<use href="#${id}f${k}" fill="url(#${id}o${k})"/>`);
    wallUse.push(`<use href="#${id}f${k}"/>`);
  });
  out.push(`<g stroke="#f7f1e4" stroke-width="${num(2 * ks)}" stroke-linejoin="round">${fieldUse.join('')}</g>`);
  out.push(`<g fill="none" stroke="#b9ab89" stroke-width="${num(1.25 * ks)}" stroke-dasharray="0.01 ${num(3.1 * ks)}" stroke-linecap="round">${wallUse.join('')}</g>`);
  // hills of the town
  d.hills.forEach((h, i) => out.push(`<path d="${smoothP(h, c, true)}" fill="#f6efe0" fill-opacity="${[0.4, 0.45, 0.55][i]}" stroke="#e4d9c0" stroke-opacity=".7" stroke-width=".8"/>`));
  out.push(`<path d="${polyP(d.townGround, c)}" fill="${PAL.lane}" stroke="${PAL.laneCase}" stroke-width="1"/>`);
  out.push(blockLayer(d.townBlocks, [0, 1, 2, 3], PAL.whiteBlocks, c, (1.9 * ks) / 2 + 0.1, PAL.lane));
  out.push(cutLayer(d.townCuts, c, ks * 0.85, PAL.lane));
  out.push(plazaLayer([d.townPlaza], c));
  // provincial road and tracks
  const rd = roadLayer(id, 'rd', smoothP(d.road, c), PAL.roadCase, 6.6 * ks, PAL.road, 4.6 * ks);
  defs.push(rd.def);
  out.push(rd.use);
  const tr = roadLayer(id, 'tr', d.tracks.map((t) => lineP(t, c)).join(''), '#dccfb3', 3.4 * ks, PAL.lane, 2 * ks);
  defs.push(tr.def);
  out.push(tr.use);
  // farms and trulli seen from above
  const circ = (t: { c: Pt; r: number }): string => {
    const q = c.P(t.c);
    const r = t.r * c.sc;
    return `<circle cx="${num(q[0])}" cy="${num(q[1])}" r="${num(r)}" fill="#f8f3e8" stroke="#bfae88" stroke-width=".9"/><circle cx="${num(q[0])}" cy="${num(q[1])}" r="${num(r * 0.55)}" fill="#e7ddc6"/><circle cx="${num(q[0])}" cy="${num(q[1])}" r="${num(Math.max(0.9, r * 0.14))}" fill="#c6b48d"/>`;
  };
  out.push(`<g fill="#f6f1e6" stroke="#c9b996" stroke-width=".8" stroke-linejoin="round"><path d="${d.buildings.map((b) => polyP(b, c)).join('') + polyP(d.homeWing, c)}"/></g>`);
  out.push(d.trulli.map(circ).join('') + d.homeTrulli.map(circ).join(''));
  return { defs, out };
}

/** Labels given by the caller: text with a halo, position in percent of the frame. */
export interface MapLabel {
  text: string;
  x: number;
  y: number;
}
export function labelLayer(labels: readonly MapLabel[] | undefined, c: LocalCtx): string {
  const items = (labels ?? []).filter((l) => l && l.text != null && Number.isFinite(l.x) && Number.isFinite(l.y));
  if (!items.length) return '';
  const texts = items
    .map((l) => {
      const half = textW(String(l.text), 12.5, 0, 0.58) / 2;
      const x = clamp((l.x / 100) * c.W, half + 6, c.W - half - 6);
      return `<text x="${num(x)}" y="${num((l.y / 100) * c.H + 4)}">${esc(l.text)}</text>`;
    })
    .join('');
  return `<g font-family="${FONT}" font-size="12.5" font-weight="650" text-anchor="middle" fill="${INK}" stroke="${HALO}" stroke-width="3.6" stroke-linejoin="round" paint-order="stroke">${texts}</g>`;
}
