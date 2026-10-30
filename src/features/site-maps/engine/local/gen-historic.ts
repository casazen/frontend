/**
 * Historic centre generator (DB-19a): an oval of blocks inside a ring road, a castle with its moat, squares, parks outside the
 * ring and modern blocks around it.
 */
import { compactness, distToLine, ellipsePoly, pip, polyCentroid, sampleCurve, type Poly, type Pt } from '../geometry';
import { PI, clamp, rngOf } from '../numeric';
import type { LocalGen } from './gen-coast';
import { FRAME, blobPts, bspField, clipOutsideEllipse, cutSamples, ellipseNorm, jit, localToWorld, rectPoly, samples, type Block, type Cut } from './shared';

export interface HistoricData {
  ring: Pt[];
  blocks: Block[];
  plazas: Poly[];
  cuts: Cut[];
  outBlocks: Block[];
  castle: { poly: Poly; moat: Poly; inner: Poly };
  duomoBlock: Poly;
  parks: Poly[];
  radials: Pt[][];
  ew: Pt[];
  ns: Pt[];
  streets: Pt[];
}

export function genHistoric(seed: string): LocalGen<HistoricData> {
  const rand = rngOf('historic', seed);
  const J = (a: number): number => jit(rand, a);
  const c: Pt = [50 + J(3), 49 + J(2.4)];
  const rx = 28.5 + J(2);
  const ry = 21.5 + J(1.6);
  const rot = -0.14 + J(0.18);
  const toW = (x: number, y: number): Pt => localToWorld(c, rot, x, y);
  const norm = (p: Pt): number => ellipseNorm(p, c, rx, ry, rot);
  const home: Pt = [50 + J(1), 50 + J(1)];
  const thC = -0.6 + J(0.4);
  const castle = toW(0.74 * rx * Math.cos(thC), 0.74 * ry * Math.sin(thC));
  const cRot = rot + thC * 0.25 + 0.15;
  const castlePoly = rectPoly(castle[0], castle[1], 9.6, 7.6, cRot).map((p): Pt => [p[0] + J(0.7), p[1] + J(0.7)]);
  const moatPoly = rectPoly(castle[0], castle[1], 12.4, 10.2, cRot);
  const plazaC = toW(-0.16 * rx, 0.3 * ry);
  const plazaR: Pt = [5.4 + J(0.8), 3.5 + J(0.5)];
  const plazaPoly = ellipsePoly(plazaC[0], plazaC[1], plazaR[0], plazaR[1], rot, 20);
  const duomoC = toW(-0.4 * rx, -0.3 * ry);
  const duomoPoly = rectPoly(duomoC[0], duomoC[1], 10 + J(1), 5.4 + J(0.6), rot + 0.1);
  const duomoBlock = rectPoly(duomoC[0] + 5.6 * Math.cos(rot + 0.1), duomoC[1] + 5.6 * Math.sin(rot + 0.1), 3.6, 5.8, rot + 0.1);
  const bsp = bspField(rand, ellipsePoly(c[0], c[1], rx, ry, rot, 40), { target: 10.5, jitter: 0.4, ang: rot + J(0.5), k: 1.15, minCompact: 0.5 });
  const keep = bsp.blocks.filter((b) => {
    const g = polyCentroid(b);
    return !pip(moatPoly, g[0], g[1]) && ellipseNorm(g, plazaC, plazaR[0] * 1.1, plazaR[1] * 1.15, rot) > 1 && !pip(duomoPoly, g[0], g[1]) && !pip(duomoBlock, g[0], g[1]);
  });
  const distHome = (b: Poly): number => {
    const g = polyCentroid(b);
    return Math.hypot(g[0] - home[0], g[1] - home[1]);
  };
  const homeBlock = keep.find((b) => pip(b, home[0], home[1])) ?? keep.reduce((best, b) => (distHome(b) < distHome(best) ? b : best), keep[0]);
  const free = keep.filter((b) => b !== homeBlock && distHome(b) > 5);
  const drop = new Set<Poly>();
  for (let i = 0; i < 5 && free.length; i++) drop.add(free[Math.floor(rand() * free.length)]);
  const blocks: Block[] = keep.filter((b) => !drop.has(b)).map((b) => ({ p: b, t: rand() < 0.2 ? 2 : rand() < 0.5 ? 1 : 0 }));
  // parks outside the ring road
  const thP = thC + 1.5 + J(0.5);
  let pc = toW(1.42 * rx * Math.cos(thP), 1.55 * ry * Math.sin(thP));
  pc = [clamp(pc[0], 12, 88), clamp(pc[1], 18, 82)];
  if (norm(pc) < 1.22) pc = toW(1.45 * rx * Math.cos(thP), 1.6 * ry * Math.sin(thP));
  const parkA = blobPts(rand, pc[0], pc[1], 8.6, 5.6, 9, 0.2, J(0.5));
  const pcB = toW(-1.4 * rx, 1.3 * ry);
  const parkB = blobPts(rand, clamp(pcB[0], 8, 30), clamp(pcB[1], 54, 68), 5.4, 4, 8, 0.2, J(0.5));
  const parkSA = sampleCurve(parkA, true, 0.8);
  const parkSB = sampleCurve(parkB, true, 0.8);
  // modern blocks outside the ring, aligned with it
  const outBsp = bspField(rand, FRAME, { target: 19, jitter: 0.14, ang: rot + J(0.3), k: 1.15, minCompact: 0.45, density: (g) => 1 + 1.9 * clamp((norm(g) - 1.15) / 1.3, 0, 1) });
  const outBlocks: Block[] = [];
  for (const b of outBsp.blocks) {
    const q = clipOutsideEllipse(b, c, rx * 1.06, ry * 1.06, rot, 2.4);
    if (!q || compactness(q) < 0.3) continue;
    const g = polyCentroid(q);
    if (pip(parkSA, g[0], g[1]) || pip(parkSB, g[0], g[1]) || distToLine(parkSA, g[0], g[1]) < 2.6 || distToLine(parkSB, g[0], g[1]) < 2.6) continue;
    outBlocks.push({ p: q, t: rand() < 0.35 ? 1 : 0 });
  }
  const ringPts: Pt[] = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * PI * 2;
    const k = 1.06 + (rand() - 0.5) * 0.03;
    ringPts.push(toW(rx * k * Math.cos(a), ry * k * Math.sin(a)));
  }
  const radials: Pt[][] = [];
  const gates = [PI, 0, -PI / 2, PI / 2, PI * 0.78, -PI * 0.74].map((a) => a + J(0.22));
  for (const a of gates) {
    const s = toW(rx * 1.06 * Math.cos(a), ry * 1.06 * Math.sin(a));
    const dir = [s[0] - c[0], s[1] - c[1]];
    const dl = Math.hypot(dir[0], dir[1]) || 1;
    const u = [dir[0] / dl, dir[1] / dl];
    const nrmv = [-u[1], u[0]];
    radials.push([
      s,
      [s[0] + u[0] * 14 + nrmv[0] * J(3), s[1] + u[1] * 14 + nrmv[1] * J(3)],
      [s[0] + u[0] * 34 + nrmv[0] * J(6), s[1] + u[1] * 34 + nrmv[1] * J(6)],
      [s[0] + u[0] * 90, s[1] + u[1] * 90],
    ]);
  }
  const ew: Pt[] = [toW(-rx * 1.02, 0.1 * ry), toW(-0.55 * rx, -0.05 * ry), [plazaC[0] - 1, plazaC[1] - 3.2], toW(0.4 * rx, 0.1 * ry), toW(rx * 1.02, 0.02 * ry)];
  const ns: Pt[] = [toW(0.04 * rx, -ry * 1.02), toW(-0.1 * rx, -0.45 * ry), toW(-0.2 * rx, -0.05 * ry), [home[0] - 4.5, home[1] + 1.5], plazaC, toW(0.02 * rx, ry * 1.02)];
  const streets: Pt[] = [...samples(ringPts, 1.6, true), ...radials.flatMap((r) => samples(r, 1.6)), ...samples(ew, 1.6), ...samples(ns, 1.6), ...cutSamples(bsp.cuts, 3)];
  return {
    data: {
      ring: ringPts,
      blocks,
      plazas: [plazaPoly, duomoPoly, ...drop],
      cuts: bsp.cuts.filter((q) => q.lv <= 3),
      outBlocks,
      castle: { poly: castlePoly, moat: moatPoly, inner: rectPoly(castle[0], castle[1], 5.2, 3.8, cRot) },
      duomoBlock,
      parks: [parkA, parkB],
      radials,
      ew,
      ns,
      streets,
    },
    land: () => true,
    margin: () => true,
  };
}
