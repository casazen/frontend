#!/usr/bin/env node
/**
 * Builds the national base of the schematic maps (DB-19a): src/features/site-maps/data/italy.json.
 *
 * A development tool: it is not run by the build nor by the CI. The generated file is committed; the raw data are not.
 *
 *   node tools/maps/build-italy.mjs <folder> [output.json]
 *
 * <folder> holds the Natural Earth files (public domain, https://www.naturalearthdata.com), either as the .zip files of the
 * download page or already unzipped (.shp + .dbf): ne_10m_land, ne_10m_admin_0_countries, ne_10m_admin_1_states_provinces,
 * ne_10m_populated_places, ne_10m_lakes (and, if present, ne_10m_lakes_europe). Nothing else is read and nothing is fetched.
 *
 * What it does: reads the shapefiles (a small reader of its own: no dependency), keeps what is near Italy, simplifies it at three
 * levels of detail with Douglas-Peucker (the tolerance of each level is written in the file), quantises the coordinates
 * (1/100 degree, about 1 km, for the two coarser levels; 1/1000 for the finest, see README.md), codes them as differences and
 * writes one JSON file. It prints the sizes and exits with an error if the file is over the budget of 80 KB gzipped.
 *
 * Region borders are the edges that two provinces of different regions share; the point where the name of a region is written is
 * the point of the region farthest from its edges.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const LAT0 = 40.8;
const LAT_KM = 111.19;
const LON_KM = 111.32 * Math.cos((LAT0 * Math.PI) / 180);
const ORIGIN_LAT = 40.8;
const ORIGIN_LON = 16.8;
const BUDGET_GZ = 80 * 1024;

/** Levels of detail: tolerance (km), units per degree, area of the smallest island and lake kept (km²), extent of the data. */
const LODS = [
  { tol: 2.0, u: 100, minIsland: 40, minLake: 100, box: { lat0: 32, lat1: 50.5, lon0: 2, lon1: 23.5 } },
  { tol: 0.7, u: 100, minIsland: 6, minLake: 30, box: { lat0: 32.4, lat1: 50.2, lon0: 3.5, lon1: 22 } },
  { tol: 0.25, u: 1000, minIsland: 0.8, minLake: 4, box: { lat0: 34.1, lat1: 48.5, lon0: 5.2, lon1: 20.2 } },
];
const ITALY_BOX = { lat0: 35.3, lat1: 47.3, lon0: 6.4, lon1: 18.9 };

/* ========================================================================== *
 *  Reading: zip, shapefile, dbf
 * ========================================================================== */
function readZipEntries(buf) {
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
function readPart(dir, name, ext) {
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

function readShp(buf) {
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

function readDbf(buf) {
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

/** Features of a Natural Earth layer: [{ attrs, shape }]. Returns [] (with a warning) if the layer is missing. */
function readLayer(dir, name, { required = true } = {}) {
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
const km = ([lon, lat]) => [(lon - ORIGIN_LON) * LON_KM, (lat - ORIGIN_LAT) * LAT_KM];
const areaKm2 = (ring) => {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = km(ring[j]);
    const b = km(ring[i]);
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2; // positive = counter-clockwise
};
/** Outer rings of a polygon feature: clockwise rings of a shapefile (holes are counter-clockwise and are dropped). */
const outerRings = (shape) => (shape?.parts ?? []).filter((r) => r.length >= 4 && areaKm2(r) < 0);

/** Sutherland-Hodgman against one half-plane of the box, in degrees. */
function clipRingToBox(ring, box) {
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
const bboxOf = (ring) => {
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
const boxesTouch = (a, b) => a.lon0 <= b.lon1 && a.lon1 >= b.lon0 && a.lat0 <= b.lat1 && a.lat1 >= b.lat0;
const inBox = (p, box) => p[0] >= box.lon0 && p[0] <= box.lon1 && p[1] >= box.lat0 && p[1] <= box.lat1;

/** Douglas-Peucker on an open polyline (points in degrees), tolerance in km; the end points stay. Iterative. */
function dpOpen(pts, tolKm) {
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
function dpRing(ring, tolKm) {
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
function encodeShape(pts, u, closed) {
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

/* ========================================================================== *
 *  The layers
 * ========================================================================== */
/** Rings of land (or of Italy) for one level: clipped to the extent, small islands dropped, simplified. */
function ringsForLod(rings, lod, minArea) {
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

function lakeRings(features, lod) {
  const rings = [];
  for (const f of features) for (const r of outerRings(f.shape)) rings.push(r);
  return ringsForLod(rings, lod, lod.minLake);
}

/** The edges that two provinces of different regions share, chained into lines; and the name and label point of every region. */
function regionBorders(provinces) {
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
  // chain the shared edges
  const adj = new Map();
  const pt = new Map();
  for (const [a, b] of border.values()) {
    const ka = key(a);
    const kb = key(b);
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
  return { lines, byRegion };
}

/** The point of a region farthest from its edges (grid search over the biggest part), as [lon, lat]. */
function labelPoint(rings, edges) {
  const biggest = rings.reduce((b, r) => (Math.abs(areaKm2(r)) > Math.abs(areaKm2(b)) ? r : b), rings[0]);
  const bb = bboxOf(biggest);
  const pip = (poly, x, y) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i];
      const b = poly[j];
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };
  const sample = edges.length > 600 ? edges.filter((_, i) => i % Math.ceil(edges.length / 600) === 0) : edges;
  let best = null;
  let bd = -1;
  const N = 36;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const x = bb.lon0 + ((bb.lon1 - bb.lon0) * i) / N;
      const y = bb.lat0 + ((bb.lat1 - bb.lat0) * j) / N;
      if (!pip(biggest, x, y)) continue;
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

/* ========================================================================== *
 *  Names written on the map (by hand: positions, sizes and the widths of the frame where they show)
 * ========================================================================== */
// [text, lat, lon, size, letter spacing, min width of the frame (km), max width (km), rotation]
const SEAS = [
  ['Mare Adriatico', 43.7, 14.3, 12, 2.2, 150, 2000, 40],
  ['Mare Adriatico', 41.55, 17.55, 12.5, 2.2, 120, 400, -32],
  ['Mar Ionio', 39.9, 17.0, 12.5, 2.2, 120, 400, 0],
  ['Mar Ionio', 37.7, 17.3, 12, 2.2, 400, 2000, 0],
  ['Mar Tirreno', 40.15, 12.45, 12, 2.2, 400, 2000, 0],
  ['Mar Tirreno', 39.9, 15.05, 10.5, 2, 200, 400, 0],
  ['Mar Ligure', 43.65, 8.9, 11, 2, 150, 2000, 0],
  ['Mar di Sardegna', 39.7, 7.7, 11, 2, 400, 2000, 0],
  ['Canale di Sicilia', 37.3, 12.1, 10.5, 1.8, 250, 2000, -18],
];
const COUNTRIES = [
  ['FRANCIA', 44.3, 6.4],
  ['SVIZZERA', 46.75, 8.3],
  ['AUSTRIA', 47.15, 13.2],
  ['SLOVENIA', 46.05, 14.7],
  ['CROAZIA', 45.15, 15.7],
  ['ALBANIA', 41.0, 19.9],
  ['TUNISIA', 35.9, 9.6],
];
/** Names of the regions as they are written on the map (the file has the long forms with the second language). */
const REGION_NAME = {
  "Valle d'Aosta/Vallée d'Aoste": "Valle d'Aosta",
  'Trentino-Alto Adige/Südtirol': 'Trentino-Alto Adige',
  'Friuli-Venezia Giulia': 'Friuli-Venezia Giulia',
};

/* ========================================================================== *
 *  Main
 * ========================================================================== */
function main() {
  const dir = process.argv[2];
  const outFile = process.argv[3] ?? path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../src/features/site-maps/data/italy.json');
  if (!dir) {
    console.error('usage: node tools/maps/build-italy.mjs <folder with the Natural Earth files> [output.json]');
    process.exit(2);
  }
  console.log(`reading ${dir}`);
  const land = readLayer(dir, 'ne_10m_land');
  const countries = readLayer(dir, 'ne_10m_admin_0_countries');
  const admin1 = readLayer(dir, 'ne_10m_admin_1_states_provinces');
  const places = readLayer(dir, 'ne_10m_populated_places');
  const lakes = [...readLayer(dir, 'ne_10m_lakes'), ...readLayer(dir, 'ne_10m_lakes_europe', { required: false })];

  const landRings = land.flatMap((f) => outerRings(f.shape));
  const italyRings = countries.filter((f) => f.attrs.adm0_a3 === 'ITA' || f.attrs.iso_a3 === 'ITA').flatMap((f) => outerRings(f.shape));
  if (!italyRings.length) throw new Error('Italy not found in ne_10m_admin_0_countries');
  const provinces = admin1
    .filter((f) => (f.attrs.adm0_a3 ?? f.attrs.sr_adm0_a3) === 'ITA' && f.shape)
    .map((f) => ({ region: REGION_NAME[f.attrs.region] ?? f.attrs.region, shape: f.shape }));
  if (!provinces.length) throw new Error('no Italian provinces in ne_10m_admin_1_states_provinces');
  const { lines, byRegion } = regionBorders(provinces);
  console.log(`  ${landRings.length} land rings, ${italyRings.length} rings of Italy, ${provinces.length} provinces, ${lines.length} border lines, ${byRegion.size} regions`);

  const lods = LODS.map((lod) => {
    const borders = lines
      .filter((l) => l.some((p) => inBox(p, lod.box)))
      .map((l) => encodeShape(dpOpen(l, lod.tol), lod.u, false))
      .filter(Boolean);
    return {
      u: lod.u,
      land: ringsForLod(landRings, lod, lod.minIsland),
      italy: ringsForLod(italyRings, lod, lod.minIsland),
      lakes: lakeRings(lakes, lod),
      borders,
    };
  });

  // towns: provincial capitals are level 1, the other places of some size level 2, the small ones level 3
  const towns = [];
  for (const f of places) {
    const a = f.attrs;
    if (a.adm0_a3 !== 'ITA' || !f.shape) continue;
    const name = a.name_it || a.name;
    const pop = Math.max(Number(a.pop_max) || 0, Number(a.pop_min) || 0);
    const cls = a.featurecla ?? '';
    const capital = /capital/i.test(cls) || a.adm0cap === '1';
    const tier = capital ? 1 : pop >= 60000 ? 2 : 3;
    towns.push([name, Math.round(f.shape.y * 1000), Math.round(f.shape.x * 1000), tier, Math.round(pop / 1000)]);
  }
  towns.sort((x, y) => x[3] - y[3] || y[4] - x[4]);

  const regions = [];
  for (const [name, edges] of byRegion) {
    const rings = provinces.filter((p) => p.region === name).flatMap((p) => outerRings(p.shape));
    const [lon, lat] = labelPoint(rings, edges);
    regions.push({ n: name.toUpperCase(), a: Math.round(lat * 1000), o: Math.round(lon * 1000) });
  }
  const seas = SEAS.map(([n, la, lo, s, l, m, x, r]) => ({ n, a: Math.round(la * 1000), o: Math.round(lo * 1000), s, l, m, x, ...(r ? { r } : {}) }));
  const countryNames = COUNTRIES.map(([n, la, lo]) => ({ n, a: Math.round(la * 1000), o: Math.round(lo * 1000) }));

  const data = {
    v: 1,
    source: 'Natural Earth 1:10m (public domain, naturalearthdata.com), simplified by tools/maps/build-italy.mjs',
    tol: LODS.map((l) => l.tol),
    lods,
    towns,
    regions,
    seas,
    countries: countryNames,
  };
  const json = JSON.stringify(data);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, json);
  const gz = zlib.gzipSync(json, { level: 9 }).length;
  console.log(`wrote ${outFile}`);
  console.log(`  ${(json.length / 1024).toFixed(1)} KB, ${(gz / 1024).toFixed(1)} KB gzipped (budget ${BUDGET_GZ / 1024} KB)`);
  lods.forEach((l, i) => {
    const part = JSON.stringify(l);
    console.log(`  level ${i}: tolerance ${LODS[i].tol} km, ${l.land.length} land, ${l.italy.length} Italy, ${l.lakes.length} lakes, ${l.borders.length} borders, ${(zlib.gzipSync(part, { level: 9 }).length / 1024).toFixed(1)} KB gzipped`);
  });
  console.log(`  ${towns.length} towns, ${regions.length} regions`);
  if (gz > BUDGET_GZ) {
    console.error('over the budget: lower the detail (tolerances, smallest island) or split the file by macro-region');
    process.exit(1);
  }
}

main();
