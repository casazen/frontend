/**
 * Shared helpers of the tools that build the data of the schematic maps (DB-19a): a reader of the Natural Earth files (zip,
 * shapefile and dbf, no dependency), the little geometry the builders need, the integer coding of the generated files and the
 * writer of TypeScript values. Development tools: not run by the build nor by the CI. See src/features/site-maps/README.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const LAT0 = 40.8;
export const LAT_KM = 111.19;
export const LON_KM = 111.32 * Math.cos((LAT0 * Math.PI) / 180);
export const ORIGIN_LAT = 40.8;
export const ORIGIN_LON = 16.8;

/* ========================================================================== *
 *  Reading: zip, shapefile, dbf
 * ========================================================================== */
export function readZipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('bad zip directory');
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const local = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataStart, dataStart + csize);
    out.set(name, () => (method === 8 ? zlib.inflateRawSync(raw) : raw));
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** The bytes of `<name>.<ext>` from the folder (unzipped) or from `<name>.zip`. */
export function readPart(dir, name, ext) {
  const plain = path.join(dir, `${name}.${ext}`);
  if (fs.existsSync(plain)) return fs.readFileSync(plain);
  const zip = path.join(dir, `${name}.zip`);
  if (fs.existsSync(zip)) {
    const entries = readZipEntries(fs.readFileSync(zip));
    const hit = entries.get(`${name}.${ext}`);
    if (hit) return hit();
  }
  return null;
}

export function readShp(buf) {
  const out = [];
  let off = 100;
  while (off + 8 <= buf.length) {
    const len = buf.readInt32BE(off + 4) * 2;
    const c = off + 8;
    const st = buf.readInt32LE(c);
    if (st === 1 || st === 11 || st === 21) {
      out.push({ x: buf.readDoubleLE(c + 4), y: buf.readDoubleLE(c + 12) });
    } else if (st === 5 || st === 15 || st === 25 || st === 3 || st === 13 || st === 23) {
      const nParts = buf.readInt32LE(c + 36);
      const nPts = buf.readInt32LE(c + 40);
      const partsOff = c + 44;
      const ptsOff = partsOff + 4 * nParts;
      const starts = [];
      for (let i = 0; i < nParts; i++) starts.push(buf.readInt32LE(partsOff + 4 * i));
      starts.push(nPts);
      const parts = [];
      for (let i = 0; i < nParts; i++) {
        const pts = [];
        for (let j = starts[i]; j < starts[i + 1]; j++) pts.push([buf.readDoubleLE(ptsOff + 16 * j), buf.readDoubleLE(ptsOff + 16 * j + 8)]);
        parts.push(pts);
      }
      out.push({ parts });
    } else {
      out.push(null);
    }
    off = c + len;
  }
  return out;
}

export function readDbf(buf) {
  const n = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recLen = buf.readUInt16LE(10);
  const fields = [];
  let o = 32;
  let at = 1;
  while (o < headerLen && buf[o] !== 0x0d) {
    const name = buf.toString('latin1', o, o + 11).replace(/\0.*$/s, '').toLowerCase();
    const len = buf[o + 16];
    fields.push({ name, at, len });
    at += len;
    o += 32;
  }
  const rows = [];
  for (let i = 0; i < n; i++) {
    const base = headerLen + i * recLen;
    const row = {};
    for (const f of fields) row[f.name] = buf.toString('utf8', base + f.at, base + f.at + f.len).replace(/\0/g, '').trim();
    rows.push(row);
  }
  return rows;
}

/** The version of a Natural Earth layer, from the VERSION.txt that comes with it (the credits say which). */
export function readVersion(dir, name) {
  const buf = readPart(dir, name, 'VERSION.txt');
  return buf ? buf.toString('utf8').trim() : 'unknown';
}

/** Features of a Natural Earth layer: [{ attrs, shape }]. Returns [] (with a warning) if the layer is missing. */
export function readLayer(dir, name, { required = true } = {}) {
  const shp = readPart(dir, name, 'shp');
  const dbf = readPart(dir, name, 'dbf');
  if (!shp || !dbf) {
    if (required) throw new Error(`missing ${name} (.shp/.dbf or .zip) in ${dir}`);
    console.warn(`  (${name} not found: skipped)`);
    return [];
  }
  const shapes = readShp(shp);
  const rows = readDbf(dbf);
  return rows.map((attrs, i) => ({ attrs, shape: shapes[i] }));
}

/* ========================================================================== *
 *  Geometry
 * ========================================================================== */
export const km = ([lon, lat]) => [(lon - ORIGIN_LON) * LON_KM, (lat - ORIGIN_LAT) * LAT_KM];
export const areaKm2 = (ring) => {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = km(ring[j]);
    const b = km(ring[i]);
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2; // positive = counter-clockwise
};
/** Outer rings of a polygon feature: clockwise rings of a shapefile (holes are counter-clockwise and are dropped). */
export const outerRings = (shape) => (shape?.parts ?? []).filter((r) => r.length >= 4 && areaKm2(r) < 0);

/** Sutherland-Hodgman against one half-plane of the box, in degrees. */
export function clipRingToBox(ring, box) {
  const edges = [
    (p) => p[0] - box.lon0, // inside when >= 0
    (p) => box.lon1 - p[0],
    (p) => p[1] - box.lat0,
    (p) => box.lat1 - p[1],
  ];
  let poly = ring;
  for (const f of edges) {
    if (!poly.length) break;
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const da = f(a);
      const db = f(b);
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    poly = out;
  }
  return poly;
}
export const bboxOf = (ring) => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of ring) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { lon0: x0, lon1: x1, lat0: y0, lat1: y1 };
};
export const boxesTouch = (a, b) => a.lon0 <= b.lon1 && a.lon1 >= b.lon0 && a.lat0 <= b.lat1 && a.lat1 >= b.lat0;
export const inBox = (p, box) => p[0] >= box.lon0 && p[0] <= box.lon1 && p[1] >= box.lat0 && p[1] <= box.lat1;

/** Douglas-Peucker on an open polyline (points in degrees), tolerance in km; the end points stay. Iterative. */
export function dpOpen(pts, tolKm) {
  const n = pts.length;
  if (n <= 2) return pts.slice();
  const k = pts.map(km);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b <= a + 1) continue;
    const ax = k[a][0];
    const ay = k[a][1];
    const dx = k[b][0] - ax;
    const dy = k[b][1] - ay;
    const l2 = dx * dx + dy * dy;
    let best = -1;
    let bd = tolKm;
    for (let i = a + 1; i < b; i++) {
      let d;
      if (l2 === 0) d = Math.hypot(k[i][0] - ax, k[i][1] - ay);
      else {
        const t = Math.max(0, Math.min(1, ((k[i][0] - ax) * dx + (k[i][1] - ay) * dy) / l2));
        d = Math.hypot(k[i][0] - (ax + t * dx), k[i][1] - (ay + t * dy));
      }
      if (d > bd) {
        bd = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
/** The same on a closed ring: it is cut in two at the farthest vertex from the first. */
export function dpRing(ring, tolKm) {
  const pts = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring.slice();
  if (pts.length <= 4) return pts;
  const k0 = km(pts[0]);
  let far = 1;
  let fd = -1;
  pts.forEach((p, i) => {
    const q = km(p);
    const d = Math.hypot(q[0] - k0[0], q[1] - k0[1]);
    if (d > fd) {
      fd = d;
      far = i;
    }
  });
  const a = dpOpen(pts.slice(0, far + 1), tolKm);
  const b = dpOpen([...pts.slice(far), pts[0]], tolKm);
  return [...a, ...b.slice(1, -1)];
}

/** Integer coordinates of a ring or a line: [lat0, lon0, dlat, dlon, …] in units of 1/u degree, without repeated points. */
export function encodeShape(pts, u, closed) {
  const q = [];
  for (const [lon, lat] of pts) {
    const p = [Math.round(lat * u), Math.round(lon * u)];
    const last = q[q.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) q.push(p);
  }
  if (closed && q.length > 1 && q[0][0] === q[q.length - 1][0] && q[0][1] === q[q.length - 1][1]) q.pop();
  if (q.length < (closed ? 3 : 2)) return null;
  const out = [q[0][0], q[0][1]];
  for (let i = 1; i < q.length; i++) out.push(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
  return out;
}

/** Rings of land (or of Italy) for one level: clipped to the extent, small islands dropped, simplified. */
export function ringsForLod(rings, lod, minArea) {
  const out = [];
  for (const ring of rings) {
    const bb = bboxOf(ring);
    if (!boxesTouch(bb, lod.box)) continue;
    const inside = inBox([bb.lon0, bb.lat0], lod.box) && inBox([bb.lon1, bb.lat1], lod.box);
    const clipped = inside ? ring : clipRingToBox(ring, lod.box);
    if (clipped.length < 4) continue;
    if (Math.abs(areaKm2(clipped)) < minArea) continue;
    const enc = encodeShape(dpRing(clipped, lod.tol), lod.u, true);
    if (enc) out.push(enc);
  }
  return out;
}

/** The edges that two provinces of different regions share, chained into lines; and the name and label point of every region. */
export function regionBorders(provinces) {
  const key = (p) => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)}`;
  const edgeRegion = new Map(); // "a>b" -> region
  const rings = [];
  for (const pr of provinces) {
    for (const ring of outerRings(pr.shape)) {
      rings.push({ region: pr.region, ring });
      for (let i = 0; i < ring.length - 1; i++) edgeRegion.set(`${key(ring[i])}>${key(ring[i + 1])}`, pr.region);
    }
  }
  const border = new Map(); // undirected edge -> [a, b]
  const outer = []; // edges of the boundary of a region (also coast and national border): for the label points
  const byRegion = new Map();
  for (const { region, ring } of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i];
      const b = ring[i + 1];
      const other = edgeRegion.get(`${key(b)}>${key(a)}`);
      if (other !== region) {
        outer.push({ region, a, b });
        if (!byRegion.has(region)) byRegion.set(region, []);
        byRegion.get(region).push([a, b]);
        if (other !== undefined) {
          const ka = key(a);
          const kb = key(b);
          border.set(ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`, [a, b]);
        }
      }
    }
  }
  return { lines: chainEdges([...border.values()]), byRegion };
}

const keyOf = (p) => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)}`;

/** Chains undirected edges [a, b] (points as [lon, lat]) into lines: they start and end where the edges meet in other than two. */
export function chainEdges(edges) {
  const adj = new Map();
  const pt = new Map();
  for (const [a, b] of edges) {
    const ka = keyOf(a);
    const kb = keyOf(b);
    pt.set(ka, a);
    pt.set(kb, b);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka).push(kb);
    adj.get(kb).push(ka);
  }
  const used = new Set();
  const edgeId = (x, y) => (x < y ? `${x}|${y}` : `${y}|${x}`);
  const lines = [];
  const walk = (start) => {
    const line = [pt.get(start)];
    let cur = start;
    for (;;) {
      const next = (adj.get(cur) ?? []).find((n) => !used.has(edgeId(cur, n)));
      if (next === undefined) break;
      used.add(edgeId(cur, next));
      line.push(pt.get(next));
      cur = next;
      if ((adj.get(cur) ?? []).length !== 2) break;
    }
    return line;
  };
  for (const [k, list] of adj) if (list.length !== 2) while (list.some((n) => !used.has(edgeId(k, n)))) lines.push(walk(k));
  for (const [k, list] of adj) while (list.some((n) => !used.has(edgeId(k, n)))) lines.push(walk(k));
  return lines;
}

/**
 * The union of areas that share their borders vertex by vertex (as the provinces and the countries of Natural Earth do): the
 * edges that two rings share (one the reverse of the other) cancel, the others are chained into the rings of the union. Also
 * returns the shared edges, which are the borders between the areas. Rings are clockwise, closed, as [lon, lat].
 */
export function mergeRings(rings) {
  const dir = new Map(); // "a>b" -> edge
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const ka = keyOf(ring[i]);
      const kb = keyOf(ring[i + 1]);
      if (ka !== kb) dir.set(`${ka}>${kb}`, { a: ring[i], b: ring[i + 1], ka, kb, used: false });
    }
  }
  const shared = [];
  const out = new Map(); // start key -> edges of the union that start there
  for (const e of dir.values()) {
    if (dir.has(`${e.kb}>${e.ka}`)) {
      if (e.ka < e.kb) shared.push([e.a, e.b]);
      continue;
    }
    if (!out.has(e.ka)) out.set(e.ka, []);
    out.get(e.ka).push(e);
  }
  const merged = [];
  for (const list of out.values()) {
    for (const first of list) {
      if (first.used) continue;
      first.used = true;
      const ring = [first.a, first.b];
      let cur = first;
      while (cur.kb !== first.ka) {
        const next = (out.get(cur.kb) ?? []).find((n) => !n.used);
        if (!next) break;
        next.used = true;
        ring.push(next.b);
        cur = next;
      }
      if (cur.kb === first.ka && ring.length >= 4) merged.push(ring);
    }
  }
  return { rings: merged, shared };
}

/** Is the point inside the ring? Both as [lon, lat]. */
export function ringContains(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/**
 * The main axis of an area: the direction (degrees counter-clockwise from the east, in km space) along which it is longest,
 * from the second moments of the polygon, and its extent along it in km.
 */
export function mainAxis(ringIn) {
  const pts = ringIn.map(km);
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  if (areaKm2(ringIn) < 0) pts.reverse();
  let A = 0;
  let cx = 0;
  let cy = 0;
  let ix = 0;
  let iy = 0;
  let ixy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const cr = x0 * y1 - x1 * y0;
    A += cr;
    cx += (x0 + x1) * cr;
    cy += (y0 + y1) * cr;
    ix += (y0 * y0 + y0 * y1 + y1 * y1) * cr;
    iy += (x0 * x0 + x0 * x1 + x1 * x1) * cr;
    ixy += (x0 * y1 + 2 * x0 * y0 + 2 * x1 * y1 + x1 * y0) * cr;
  }
  A /= 2;
  cx /= 6 * A;
  cy /= 6 * A;
  const mxx = iy / 12 - A * cx * cx;
  const myy = ix / 12 - A * cy * cy;
  const mxy = ixy / 24 - A * cx * cy;
  const theta = 0.5 * Math.atan2(2 * mxy, mxx - myy);
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  let lo = Infinity;
  let hi = -Infinity;
  for (const [x, y] of pts) {
    const t = x * ux + y * uy;
    lo = Math.min(lo, t);
    hi = Math.max(hi, t);
  }
  return { deg: (theta * 180) / Math.PI, lengthKm: hi - lo };
}

/** The point of a region farthest from its edges (grid search over the biggest part), as [lon, lat]. */
export function labelPoint(rings, edges) {
  const biggest = rings.reduce((b, r) => (Math.abs(areaKm2(r)) > Math.abs(areaKm2(b)) ? r : b), rings[0]);
  const bb = bboxOf(biggest);
  const sample = edges.length > 600 ? edges.filter((_, i) => i % Math.ceil(edges.length / 600) === 0) : edges;
  let best = null;
  let bd = -1;
  const N = 36;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const x = bb.lon0 + ((bb.lon1 - bb.lon0) * i) / N;
      const y = bb.lat0 + ((bb.lat1 - bb.lat0) * j) / N;
      if (!ringContains(biggest, x, y)) continue;
      let d = Infinity;
      const p = km([x, y]);
      for (const [a, b] of sample) {
        const A = km(a);
        const B = km(b);
        const dx = B[0] - A[0];
        const dy = B[1] - A[1];
        const l2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / l2));
        d = Math.min(d, Math.hypot(p[0] - (A[0] + t * dx), p[1] - (A[1] + t * dy)));
      }
      if (d > bd) {
        bd = d;
        best = [x, y];
      }
    }
  }
  return best ?? [(bb.lon0 + bb.lon1) / 2, (bb.lat0 + bb.lat1) / 2];
}

/** TypeScript source of a value: a row of numbers on one line, every other array and object one element per line. */
export function format(v, indent) {
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'number')) return `[${v.join(',')}]`;
    if (!v.length) return '[]';
    const inner = indent + '  ';
    return `[\n${v.map((x) => inner + format(x, inner)).join(',\n')},\n${indent}]`;
  }
  if (v && typeof v === 'object') {
    const inner = indent + '  ';
    const key = (k) => (/^[A-Za-z_]\w*$/.test(k) ? k : JSON.stringify(k));
    return `{\n${Object.entries(v).map(([k, x]) => `${inner}${key(k)}: ${format(x, inner)}`).join(',\n')},\n${indent}}`;
  }
  return JSON.stringify(v);
}
