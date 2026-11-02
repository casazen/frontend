/**
 * Countryside generator (DB-19a): a farmhouse with its trulli among olive groves and dry-stone walls, a provincial road, farm
 * tracks that follow the field edges and the white hill town at the corner.
 */
import { ellipsePoly, pip, polyCentroid, sampleCurve, type Poly, type Pt } from '../geometry';
import { PI, hash2, hashStr, rngOf } from '../numeric';
import type { LocalGen } from './gen-coast';
import { FRAME, UW, VY0, VY1, blobPts, bspField, buildGraph, cutSamples, ellipseNorm, jit, rectPoly, samples, type Block, type Cut } from './shared';

export interface CountryData {
  fields: { p: Poly; k: number }[];
  tracks: Pt[][];
  road: Pt[];
  buildings: Poly[];
  trulli: { c: Pt; r: number }[];
  homeTrulli: { c: Pt; r: number }[];
  homeWing: Poly;
  court: Poly;
  hills: Poly[];
  townGround: Poly;
  townBlocks: Block[];
  townPlaza: Poly;
  townCuts: Cut[];
  streets: Pt[];
  home: Pt;
}

export function genCountry(seed: string): LocalGen<CountryData> {
  const rand = rngOf('country', seed);
  const J = (a: number): number => jit(rand, a);
  const tc: Pt = [86 + J(4), 21 + J(3)];
  const trx = 21 + J(2);
  const trY = 13.5 + J(1.5);
  const trot = 0.35 + J(0.2);
  const home: Pt = [50 + J(1.2), 50 + J(1.2)];
  const roadCtrl: Pt[] = [
    [tc[0] - 13 + J(2), tc[1] + 8], [68 + J(3), 38 + J(2)], [63 + J(2), 46 + J(2)], [59.5 + J(1.5), 53 + J(2)], [55 + J(2), 61 + J(1.5)], [44 + J(3), 68 + J(2)], [28 + J(3), 71.5 + J(2)],
    [10 + J(3), 70 + J(2)], [-8, 66 + J(3)],
  ];
  const road = samples(roadCtrl, 1.2);
  // fields (BSP) and the «court» of the house as a plot of its own
  const bsp = bspField(rand, FRAME, { target: 58, jitter: 0.45, ang: J(1.2) + 0.4, k: 1.18, minCompact: 0.38 });
  const courtPoly = rectPoly(home[0] + J(0.8), home[1] + J(0.8), 10.5 + J(1), 8 + J(1), J(0.3));
  const fieldPolys: Poly[] = bsp.blocks.filter((b) => {
    const g = polyCentroid(b);
    return ellipseNorm(g, tc, trx * 1.3, trY * 1.3, trot) > 1 && !pip(courtPoly, g[0], g[1]) && Math.hypot(g[0] - home[0], g[1] - home[1]) > 5.5;
  });
  fieldPolys.push(courtPoly);
  const seedMod = hashStr(seed) % 1000;
  const kinds = fieldPolys.map((p, i) => {
    if (p === courtPoly) return 6;
    const r = hash2(i, seedMod, 9);
    return r < 0.3 ? 0 : r < 0.46 ? 1 : r < 0.62 ? 2 : r < 0.74 ? 3 : r < 0.84 ? 4 : 5;
  });
  const graph = buildGraph(fieldPolys);
  const inFrame = (v: Pt): boolean => v[0] > 3 && v[0] < UW - 3 && v[1] > VY0 + 4 && v[1] < VY1 - 4 && ellipseNorm(v, tc, trx * 1.35, trY * 1.35, trot) > 1;
  const hv = graph.nearest(home);
  const roadPt = road.reduce((b, p) => (Math.hypot(p[0] - home[0], p[1] - home[1]) < Math.hypot(b[0] - home[0], b[1] - home[1]) ? p : b), road[0]);
  const farmA = graph.nearest([22 + J(6), 36 + J(6)], inFrame);
  const farmB = graph.nearest([74 + J(5), 64 + J(4)], inFrame);
  const farmC = graph.nearest([28 + J(5), 24 + J(3)], inFrame);
  const t1 = graph.path(hv, graph.nearest(roadPt, inFrame));
  const t2 = graph.path(graph.nearest(road[Math.floor(road.length * 0.82)], inFrame), farmA);
  const t3 = graph.path(graph.nearest(road[Math.floor(road.length * 0.5)], (v) => inFrame(v) && v[0] > 62), farmB);
  const t4 = graph.path(farmA, farmC);
  const smoothTrack = (t: Pt[]): Pt[] => (t.length > 3 ? sampleCurve(t, false, 1.5) : t);
  const tracks = [t1, t2, t3, t4].filter((t) => t.length > 1).map(smoothTrack);
  const farms = [
    farmA,
    farmB,
    farmC,
    graph.nearest([88 + J(4), 48 + J(5)], inFrame),
    graph.nearest([14 + J(4), 60 + J(4)], inFrame),
    graph.nearest([46 + J(5), 28 + J(3)], inFrame),
  ].filter((v) => v >= 0);
  const buildings: Poly[] = [];
  const trulli: { c: Pt; r: number }[] = [];
  for (const fv of farms) {
    const p = graph.verts[fv];
    const a = rand() * PI;
    buildings.push(rectPoly(p[0] + J(1), p[1] + J(1), 2.7 + J(0.6), 1.8 + J(0.4), a));
    if (rand() < 0.55) buildings.push(rectPoly(p[0] + Math.cos(a) * 2.6, p[1] + Math.sin(a) * 2.6, 1.8, 1.4, a + 0.4));
    if (rand() < 0.65) trulli.push({ c: [p[0] - Math.cos(a) * 2.4 + J(0.6), p[1] - Math.sin(a) * 2.4 + J(0.6)], r: 0.85 + rand() * 0.35 });
  }
  const homeTrulli: { c: Pt; r: number }[] = [];
  const nT = 3 + (rand() < 0.5 ? 1 : 0);
  const a0 = rand() * PI * 2;
  for (let i = 0; i < nT; i++) {
    const a = a0 + (i / nT) * PI * 2 + J(0.5);
    homeTrulli.push({ c: [home[0] + Math.cos(a) * 2.3, home[1] + Math.sin(a) * 1.9], r: 0.82 + rand() * 0.38 });
  }
  const homeWing = rectPoly(home[0] + J(0.8), home[1] + J(0.8), 3 + J(0.6), 1.8, J(0.6));
  // the town: a hill with contour lines and dense blocks
  const hills = [1.6, 1.35, 1.14].map((s) => blobPts(rand, tc[0], tc[1], trx * s, trY * s, 12, 0.07, trot));
  const townBsp = bspField(rand, ellipsePoly(tc[0], tc[1], trx, trY, trot, 34), { target: 8.5, jitter: 0.42, ang: trot + J(0.6), k: 1.2, minCompact: 0.5 });
  const distTc = (q: Poly): number => {
    const g = polyCentroid(q);
    return Math.hypot(g[0] - tc[0], g[1] - tc[1]);
  };
  const townC = townBsp.blocks.reduce((b, q) => (distTc(q) < distTc(b) ? q : b), townBsp.blocks[0]);
  const townBlocks: Block[] = townBsp.blocks.filter((q) => q !== townC).map((q) => ({ p: q, t: rand() < 0.1 ? 3 : rand() < 0.45 ? 1 : 0 }));
  const streets: Pt[] = [...road, ...tracks.flat(), ...cutSamples(townBsp.cuts, 3)];
  return {
    data: {
      fields: fieldPolys.map((p, i) => ({ p, k: kinds[i] })),
      tracks,
      road: roadCtrl,
      buildings,
      trulli,
      homeTrulli,
      homeWing,
      court: courtPoly,
      hills,
      townGround: ellipsePoly(tc[0], tc[1], trx * 1.01, trY * 1.01, trot, 34),
      townBlocks,
      townPlaza: townC,
      townCuts: townBsp.cuts.filter((q) => q.lv <= 3),
      streets,
      home,
    },
    land: () => true,
    margin: () => true,
  };
}
