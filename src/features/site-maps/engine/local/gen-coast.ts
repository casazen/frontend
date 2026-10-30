/**
 * Coast map generator (DB-19a): an old town on a cliff, the sea on the east, a railway and a main road behind it, a park and a
 * modern district. With `wide` the geometry is generated over a bigger frame so that the drawing can be rotated to any sea
 * direction without leaving empty corners; without it the output is the one of the approved prototype.
 */
import { compactness, distToLine, ellipsePoly, pip, polyCentroid, sampleCurve, type Poly, type Pt } from '../geometry';
import { clamp, hashStr, rngOf, vnoise } from '../numeric';
import {
  FRAME,
  FRAME_WIDE,
  UH,
  UW,
  VY0,
  VY1,
  blobPts,
  bspField,
  clipByCoast,
  clipOutsideEllipse,
  cutSamples,
  ellipseNorm,
  jit,
  samples,
  type Block,
  type Cut,
} from './shared';

export interface CoastData {
  sea: Poly;
  tip: Pt;
  blocks: Block[];
  plazas: Poly[];
  cuts: Cut[];
  newBlocks: Block[];
  park: Poly;
  rail: Pt[];
  road: Pt[];
  via: Pt[];
  waves: Pt[];
  streets: Pt[];
}

export interface LocalGen<D> {
  data: D;
  /** Is the point on land? (in the coordinates of the generator) */
  land: (x: number, y: number) => boolean;
  /** Is the point on land, away from the cliff? */
  margin: (x: number, y: number) => boolean;
}

export function genCoast(seed: string, wide: boolean): LocalGen<CoastData> {
  const rand = rngOf('coast', seed);
  const J = (a: number): number => jit(rand, a);
  const ctrl: Pt[] = [
    [79 + J(6), -8], [76 + J(4), 5], [72 + J(4), 16], [70.5 + J(3), 27], [68.5 + J(3), 37], [66 + J(2), 46], [63.5 + J(2), 53.5], [60.5 + J(1.5), 59],
    [57.5, 62.2], [53, 60.6], [48.8, 58.4], [45.2, 56.4], [43.8, 58.8], [47.4, 62.6], [51.8, 66.2], [54.6, 69.4], [50.5 + J(2), 74.5], [45 + J(3), 80], [41 + J(3), 88],
  ];
  const tip: Pt = [45.2, 56.8];
  // rotated drawings need the coast to go on beyond the canonical frame
  const chain: Pt[] = wide
    ? [[ctrl[0][0] + 7, -45], [ctrl[0][0] + 3.5, -26], ...ctrl, [ctrl[ctrl.length - 1][0] - 3, 102], [ctrl[ctrl.length - 1][0] - 6, 118], [ctrl[ctrl.length - 1][0] - 9, 135]]
    : ctrl;
  const base = sampleCurve(chain, false, 0.55);
  const hs = hashStr(`c${seed}`) % 997;
  let acc = 0;
  const coast: Pt[] = base.map((p, i) => {
    if (i) acc += Math.hypot(p[0] - base[i - 1][0], p[1] - base[i - 1][1]);
    const a = base[Math.max(0, i - 1)];
    const b = base[Math.min(base.length - 1, i + 1)];
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const amp = clamp((Math.hypot(p[0] - tip[0], p[1] - tip[1]) - 2.5) / 6, 0.25, 1);
    const w = ((vnoise(acc / 3.4, 0, hs) - 0.5) * 1.0 + (vnoise(acc / 1.2, 0, hs + 3) - 0.5) * 0.4) * amp;
    return [p[0] - ((b[1] - a[1]) / tl) * w, p[1] + ((b[0] - a[0]) / tl) * w];
  });
  const far = wide ? 90 : 30;
  const sea: Poly = [...coast, [UW + far, UH + far], [UW + far, -far]];
  const land = (x: number, y: number): boolean => !pip(sea, x, y);
  const coastDist = (x: number, y: number): number => distToLine(coast, x, y);
  const inland: Pt[] = coast.map((p, i) => {
    const a = coast[Math.max(0, i - 1)];
    const b = coast[Math.min(coast.length - 1, i + 1)];
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let n: Pt = [-(b[1] - a[1]) / tl, (b[0] - a[0]) / tl];
    if (!land(p[0] + n[0] * 1.6, p[1] + n[1] * 1.6)) n = [-n[0], -n[1]];
    return n;
  });
  // railway and main road behind the town, park, main street
  const railCtrl: Pt[] = ([[15, 4], [13.5, 14], [12, 28], [12.5, 44], [15, 58], [19, 70], [23, 96]] as Pt[]).map((p): Pt => [p[0] + J(1.2), p[1]]);
  const roadCtrl: Pt[] = ([[35, 4], [31.5, 14], [28, 26], [26, 40], [26.5, 54], [29, 66], [33.5, 96]] as Pt[]).map((p): Pt => [p[0] + J(1.2), p[1]]);
  const viaCtrl: Pt[] = [[26, 40.5 + J(1.5)], [35, 42.5], [43, 44.2 + J(1)], [51, 43.4], [58, 41.2], [66, 38.6]];
  if (wide) {
    railCtrl.unshift([railCtrl[0][0] + 3, -30], [railCtrl[0][0] + 1.5, -12]);
    railCtrl.push([railCtrl[railCtrl.length - 1][0] + 3, 112], [railCtrl[railCtrl.length - 1][0] + 6, 130]);
    roadCtrl.unshift([roadCtrl[0][0] + 4, -30], [roadCtrl[0][0] + 2, -12]);
    roadCtrl.push([roadCtrl[roadCtrl.length - 1][0] + 3, 112], [roadCtrl[roadCtrl.length - 1][0] + 6, 130]);
  }
  const rail = samples(railCtrl, 1.2);
  const road = samples(roadCtrl, 1.2);
  const park = blobPts(rand, 57 + J(3), 22 + J(2), 9, 5.8, 9, 0.2, J(0.4));
  const parkS = sampleCurve(park, true, 0.8);
  // old town: BSP blocks inside an ellipse, then cut along the cliff
  const oc: Pt = [49 + J(2), 49.5 + J(2)];
  const oRx = 21.5 + J(1.5);
  const oRy = 17 + J(1.2);
  const oRot = -0.28 + J(0.2);
  const home: Pt = [50 + J(1), 50 + J(1)];
  const plaza: Pt = [41.5 + J(1.5), 46.5 + J(1)];
  const plazaPoly = ellipsePoly(plaza[0], plaza[1], 3.7, 2.6, 0, 18);
  const bsp = bspField(rand, ellipsePoly(oc[0], oc[1], oRx, oRy, oRot, 36), { target: 10, jitter: 0.42, ang: 1.45 + J(0.3), k: 1.25, minCompact: 0.5 });
  let blocks: Poly[] = [];
  for (const b of bsp.blocks) {
    const q = clipByCoast(b, 1.25, coast, land, coastDist);
    if (q && compactness(q) > 0.32) blocks.push(q);
  }
  blocks = blocks.filter((b) => ellipseNorm(polyCentroid(b), plaza, 3.9, 2.9, 0) > 1);
  const distHome = (b: Poly): number => {
    const g = polyCentroid(b);
    return Math.hypot(g[0] - home[0], g[1] - home[1]);
  };
  const homeBlock = blocks.reduce<Poly | null>((best, b) => (pip(b, home[0], home[1]) ? b : best), null) ?? blocks.reduce((best, b) => (distHome(b) < distHome(best) ? b : best), blocks[0]);
  const free = blocks.filter((b) => b !== homeBlock && distHome(b) > 6);
  const plazas: Poly[] = [plazaPoly];
  const drop = new Set<Poly>();
  for (let i = 0; i < 3 && free.length; i++) drop.add(free[Math.floor(rand() * free.length)]);
  for (const d of drop) plazas.push(d);
  const churchTarget: Pt = [44, 53];
  const distChurch = (b: Poly): number => {
    const g = polyCentroid(b);
    return Math.hypot(g[0] - churchTarget[0], g[1] - churchTarget[1]);
  };
  const church = free.filter((b) => !drop.has(b)).reduce<Poly | null>((best, b) => (!best || distChurch(b) < distChurch(best) ? b : best), null);
  const tone = (b: Poly): number => (b === church ? 3 : rand() < 0.2 ? 2 : rand() < 0.5 ? 1 : 0);
  const blockList: Block[] = blocks.filter((b) => !drop.has(b)).map((b) => ({ p: b, t: tone(b) }));
  // new town: modern, nearly orthogonal blocks aligned with the ring of the old town and with the coast
  const newBsp = bspField(rand, wide ? FRAME_WIDE : FRAME, {
    target: 20,
    jitter: 0.13,
    ang: -0.2 + J(0.1),
    k: 1.1,
    minCompact: 0.45,
    density: (g) => 1 + 1.7 * clamp((ellipseNorm(g, oc, oRx, oRy, oRot) - 1.2) / 1.6, 0, 1),
  });
  const newBlocks: Block[] = [];
  for (const b of newBsp.blocks) {
    let q = clipOutsideEllipse(b, oc, oRx + 0.8, oRy + 0.8, oRot, 2.4);
    if (q) q = clipByCoast(q, 3.2, coast, land, coastDist);
    if (!q || compactness(q) < 0.25) continue;
    const g = polyCentroid(q);
    if (distToLine(rail, g[0], g[1]) < 3 || distToLine(road, g[0], g[1]) < 3 || pip(parkS, g[0], g[1]) || distToLine(parkS, g[0], g[1]) < 3) continue;
    newBlocks.push({ p: q, t: rand() < 0.3 ? 1 : 0 });
  }
  const waves: Pt[] = [];
  const maxWaves = wide ? 14 : 9;
  for (let i = 0; i < (wide ? 120 : 60) && waves.length < maxWaves; i++) {
    const p: Pt = wide ? [60 + rand() * 60, -10 + rand() * 110] : [68 + rand() * 40, VY0 + rand() * 75];
    if (land(p[0], p[1]) || coastDist(p[0], p[1]) < 7) continue;
    if (waves.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 9)) continue;
    waves.push(p);
  }
  const prom: Pt[] = [];
  for (let i = 0; i < coast.length; i += 4) prom.push([coast[i][0] + inland[i][0] * 1.2, coast[i][1] + inland[i][1] * 1.2]);
  const promKept = wide ? prom : prom.filter((p) => p[0] > -2 && p[0] < UW + 2 && p[1] > VY0 - 2 && p[1] < VY1 + 2);
  const streets: Pt[] = [...samples(viaCtrl, 1.6), ...road, ...promKept, ...cutSamples(bsp.cuts, 3)];
  return {
    data: { sea, tip, blocks: blockList, plazas, cuts: bsp.cuts.filter((c) => c.lv <= 3), newBlocks, park, rail: railCtrl, road: roadCtrl, via: viaCtrl, waves, streets },
    land,
    margin: (x, y) => land(x, y) && coastDist(x, y) > 1.6,
  };
}
