/**
 * Small helpers of the regional drawing (DB-19a): thinning of polylines, the stretches of a line that touch the frame, and the
 * placer that keeps labels from overlapping each other or leaving the frame.
 */
import type { Pt } from '../geometry';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Thins a polyline (step `step` px inside the frame, `far` outside it), keeping the transitions. */
export function thinPts(P: readonly Pt[], near: (p: Pt) => boolean, step = 2.6, far = 48): Pt[] {
  if (!P.length) return [];
  const out: Pt[] = [P[0]];
  let last = P[0];
  let prevNear = near(P[0]);
  for (let i = 1; i < P.length; i++) {
    const p = P[i];
    const isNear = near(p);
    if (isNear && !prevNear && P[i - 1] !== last) {
      out.push(P[i - 1]);
      last = P[i - 1];
    }
    const d = Math.hypot(p[0] - last[0], p[1] - last[1]);
    if (d >= (isNear ? step : far) || (!isNear && prevNear)) {
      out.push(p);
      last = p;
    }
    prevNear = isNear;
  }
  if (out[out.length - 1] !== P[P.length - 1]) out.push(P[P.length - 1]);
  return out;
}

/** The consecutive stretches of a polyline whose segments touch the window. */
export function runsInBox(pts: readonly Pt[], win: Box): Pt[][] {
  const runs: Pt[][] = [];
  let cur: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const hit = Math.max(a[0], b[0]) >= win.x0 && Math.min(a[0], b[0]) <= win.x1 && Math.max(a[1], b[1]) >= win.y0 && Math.min(a[1], b[1]) <= win.y1;
    if (hit) {
      if (!cur.length) cur.push(a);
      cur.push(b);
    } else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  return runs;
}

/** Placer of labels: boxes that must not overlap nor leave the frame. */
export function makePlacer(W: number, H: number): { free: (b: Box, m?: number) => boolean; add: (b: Box) => void } {
  const boxes: Box[] = [];
  return {
    free(b, m = 3) {
      if (b.x0 < m || b.y0 < m || b.x1 > W - m || b.y1 > H - m) return false;
      for (const q of boxes) if (b.x0 < q.x1 + 1.5 && b.x1 + 1.5 > q.x0 && b.y0 < q.y1 + 1 && b.y1 + 1 > q.y0) return false;
      return true;
    },
    add(b) {
      boxes.push(b);
    },
  };
}

/** Do two boxes overlap? */
export const hits = (a: Box, b: Box): boolean => a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;
