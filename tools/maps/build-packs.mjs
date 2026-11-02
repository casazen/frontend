#!/usr/bin/env node
/**
 * Builds the detail packs of the schematic maps (DB-19a) for the two regions where the site works, Lombardia and Svizzera:
 * src/features/site-maps/data/lombardia.ts, svizzera.ts and regions.ts (boxes and coarse outlines of the two, which the pages
 * need before anything is loaded).
 *
 * A development tool: it is not run by the build nor by the CI. The generated files are committed; the raw data are not.
 *
 *   node tools/maps/build-packs.mjs <folder> [output folder]
 *
 * <folder> holds the same Natural Earth files as build-italy.mjs (public domain): ne_10m_admin_1_states_provinces,
 * ne_10m_populated_places, ne_10m_lakes and, if present, ne_10m_lakes_europe. Nothing else is read and nothing is fetched.
 *
 * What a pack holds: the borders between the provinces of Lombardia and between the cantons of Svizzera (the shared edges of
 * the areas, simplified), the towns, and the names written on the map: the lakes (along their length, where the name fits), the
 * cantons and the country. The coast, the lakes themselves and the border between the two countries are in the national base.
 *
 * Natural Earth keeps only 3 of the 12 provincial capitals of Lombardia and no Locarno: the other ten towns of EXTRA_TOWNS are
 * written here by hand, with their position to a hundredth of a degree (the precision of the maps), and the build checks that
 * each of them falls inside its province or canton. Nothing else is added by hand but the choice of what to name (MAIN, LAKES).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { areaKm2, bboxOf, chainEdges, dpOpen, dpRing, encodeShape, format, labelPoint, mainAxis, mergeRings, outerRings, readLayer, readVersion, ringContains } from './ne.mjs';

const BUDGET_GZ = 40 * 1024; // per pack
const BORDER = { tol: 0.25, u: 1000 }; // borders inside a region: km, units per degree
const OUTLINE = { tol: 2.5, u: 100 }; // coarse outline that tells in which region a position is

/* ========================================================================== *
 *  What is written by hand
 * ========================================================================== */
/** Centres the site names at every zoom (tier 1): the provincial capitals of Lombardia and the main centres of Switzerland. */
const MAIN = {
  lombardia: ['Milano', 'Bergamo', 'Brescia', 'Como', 'Lecco', 'Monza', 'Pavia', 'Varese', 'Cremona', 'Mantova', 'Sondrio', 'Lodi'],
  svizzera: ['Zurigo', 'Berna', 'Basilea', 'Ginevra', 'Losanna', 'Lugano', 'Locarno', 'Bellinzona', 'Lucerna', 'San Gallo', 'Coira', 'Sion'],
};

/** Towns that Natural Earth does not have: [name, lat, lon, inhabitants (thousands, rounded), region, province or canton in Natural Earth]. */
const EXTRA_TOWNS = [
  ['Brescia', 45.54, 10.21, 200, 'lombardia', 'Brescia'],
  ['Monza', 45.58, 9.27, 123, 'lombardia', 'Monza e Brianza'],
  ['Pavia', 45.18, 9.16, 73, 'lombardia', 'Pavia'],
  ['Varese', 45.82, 8.83, 80, 'lombardia', 'Varese'],
  ['Cremona', 45.13, 10.02, 72, 'lombardia', 'Cremona'],
  ['Mantova', 45.16, 10.79, 49, 'lombardia', 'Mantova'],
  ['Sondrio', 46.17, 9.88, 22, 'lombardia', 'Sondrio'],
  ['Lodi', 45.31, 9.5, 45, 'lombardia', 'Lodi'],
  ['Lecco', 45.86, 9.4, 48, 'lombardia', 'Lecco'],
  ['Locarno', 46.17, 8.8, 16, 'svizzera', 'Ticino'],
];

/**
 * The lakes that are named. The lake is found by where it is in Natural Earth ([min lat, min lon, max lat, max lon], about) and
 * not by the name in the file, which gives Lago Maggiore as «Lago di Como».
 */
const LAKES = {
  lombardia: [
    ['Lago Maggiore', [45.72, 8.49, 46.17, 8.85]],
    ['Lago di Como', [45.82, 9.07, 46.17, 9.41]],
    ['Lago di Garda', [45.45, 10.51, 45.9, 10.87]],
    ["Lago d'Iseo", [45.67, 9.97, 45.83, 10.11]],
  ],
  svizzera: [
    ['Lago Lemano', [46.2, 6.13, 46.52, 6.94]],
    ['Lago di Costanza', [47.49, 9.03, 47.82, 9.74]],
    ['Lago di Neuchâtel', [46.79, 6.64, 47.02, 7.04]],
    ['Lago di Zurigo', [47.2, 8.54, 47.36, 8.94]],
    ['Lago dei Quattro Cantoni', [46.9, 8.28, 47.07, 8.62]],
    ['Lago di Lugano', [45.91, 8.89, 46.04, 9.12]],
    ['Lago di Thun', [46.66, 7.63, 46.75, 7.82]],
    ['Lago di Brienz', [46.7, 7.89, 46.77, 8.05]],
    ['Lago di Bienne', [47.05, 7.08, 47.14, 7.23]],
    ['Lago di Zugo', [47.07, 8.46, 47.19, 8.53]],
    ['Lago di Walen', [47.12, 9.13, 47.14, 9.3]],
  ],
};

/** The cantons are written up to this width of the frame (km), the name of the country from there up. */
const CANTON_MAX_KM = 330;
/** Where the name of Switzerland is written [lat, lon]: in the Alps, away from the big towns whose names would take its place. */
const COUNTRY_AT = [46.75, 8.45];

/* ========================================================================== *
 *  Helpers
 * ========================================================================== */
const round = (v, n = 1000) => Math.round(v * n) / n;
const biggest = (rings) => rings.reduce((b, r) => (Math.abs(areaKm2(r)) > Math.abs(areaKm2(b)) ? r : b), rings[0]);
const pairs = (ring) => ring.slice(1).map((p, i) => [ring[i], p]);
const gz = (v) => zlib.gzipSync(JSON.stringify(v), { level: 9 }).length;

/** «Canton Vallese», «Cantone dei Grigioni», «canton Ticino» → «Vallese», «Grigioni», «Ticino». */
const cantonName = (nameIt, name) => (nameIt || name).replace(/^canton(e)?\s+((dei|di|del|della|dello|degli)\s+)?/i, '').trim();

/** The feature of a layer whose biggest ring is where `at` says (centre within 0.04 degrees, size within 40 %). */
function findLake(features, at) {
  const [la0, lo0, la1, lo1] = at;
  let best = null;
  for (const f of features) {
    const rings = outerRings(f.shape);
    if (!rings.length) continue;
    const ring = biggest(rings);
    const bb = bboxOf(ring);
    const near = Math.abs((bb.lat0 + bb.lat1) / 2 - (la0 + la1) / 2) < 0.04 && Math.abs((bb.lon0 + bb.lon1) / 2 - (lo0 + lo1) / 2) < 0.04;
    const w = (bb.lon1 - bb.lon0) / (lo1 - lo0);
    const h = (bb.lat1 - bb.lat0) / (la1 - la0);
    const size = w > 0.6 && w < 1.4 && h > 0.6 && h < 1.4;
    if (near && size && (!best || Math.abs(areaKm2(ring)) > best.area)) best = { f, ring, area: Math.abs(areaKm2(ring)) };
  }
  return best;
}

/** The name of a lake: at its point farthest from the shore, along its main axis (a name never reads upside down). */
function lakeName(text, ring) {
  const [lon, lat] = labelPoint([ring], pairs(ring));
  const { deg, lengthKm } = mainAxis(ring);
  let rot = -deg; // the SVG turns clockwise
  rot = ((((rot + 180) % 360) + 360) % 360) - 180;
  if (rot > 90) rot -= 180;
  else if (rot <= -90) rot += 180;
  const size = lengthKm >= 50 ? 12 : lengthKm >= 25 ? 11 : 10;
  return { n: text, a: Math.round(lat * 1000), o: Math.round(lon * 1000), s: size, l: 1.4, m: 0, x: 1500, ...(Math.abs(rot) >= 1 ? { r: Math.round(rot) } : {}), k: 'lake', d: Math.round(lengthKm) };
}

/* ========================================================================== *
 *  One pack
 * ========================================================================== */
function buildPack({ id, label, areas, places, lakeLayer, lakes, source, extra, country }) {
  // areas: [{ name, label, shape }] (provinces or cantons)
  const rings = areas.flatMap((a) => outerRings(a.shape));
  const union = mergeRings(rings);
  if (!union.rings.length) throw new Error(`${id}: no outline`);
  const outline = biggest(union.rings);
  const lines = chainEdges(union.shared);
  const bb = bboxOf(outline);
  const box = [Math.floor(bb.lat0 * 100) / 100, Math.floor(bb.lon0 * 100) / 100, Math.ceil(bb.lat1 * 100) / 100, Math.ceil(bb.lon1 * 100) / 100];
  const borders = lines.map((l) => encodeShape(dpOpen(l, BORDER.tol), BORDER.u, false)).filter(Boolean);

  // towns: those of Natural Earth inside the outline, and the ones written by hand (checked to be in their area)
  const towns = [];
  const main = new Set(MAIN[id]);
  for (const f of places) {
    const a = f.attrs;
    if (!f.shape || !union.rings.some((r) => ringContains(r, f.shape.x, f.shape.y))) continue;
    const name = a.name_it || a.name;
    const pop = Math.max(Number(a.pop_max) || 0, Number(a.pop_min) || 0);
    const capital = /admin-1/i.test(a.featurecla ?? '') || /capital/i.test(a.featurecla ?? '');
    const tier = main.has(name) ? 1 : capital || pop >= 60000 ? 2 : 3;
    towns.push([name, Math.round(f.shape.y * 1000), Math.round(f.shape.x * 1000), tier, Math.round(pop / 1000)]);
  }
  for (const [name, lat, lon, pop, region, areaName] of extra.filter((e) => e[4] === id)) {
    const area = areas.find((a) => a.name === areaName);
    if (!area) throw new Error(`${name}: no area called ${areaName}`);
    if (!outerRings(area.shape).some((r) => ringContains(r, lon, lat))) throw new Error(`${name} (${lat}, ${lon}) is not inside ${areaName} in Natural Earth`);
    if (towns.some((t) => t[0] === name)) throw new Error(`${name} is in Natural Earth: take it out of EXTRA_TOWNS`);
    towns.push([name, Math.round(lat * 1000), Math.round(lon * 1000), main.has(name) ? 1 : 3, pop]);
  }
  for (const name of main) if (!towns.some((t) => t[0] === name)) throw new Error(`${id}: the main centre ${name} is missing`);
  towns.sort((x, y) => x[3] - y[3] || y[4] - x[4]);

  // names: the lakes, the country and the cantons
  const names = [];
  for (const [text, at] of lakes) {
    const hit = findLake(lakeLayer, at);
    if (!hit) throw new Error(`${id}: lake ${text} not found at ${at.join(',')}`);
    names.push(lakeName(text, hit.ring));
    console.log(`  ${text}: ${hit.f.attrs.name} · ${Math.round(hit.area)} km² · ${names[names.length - 1].d} km along ${names[names.length - 1].r ?? 0}°`);
  }
  if (country) {
    if (!ringContains(outline, COUNTRY_AT[1], COUNTRY_AT[0])) throw new Error('the name of the country is outside the country');
    names.push({ n: country, a: Math.round(COUNTRY_AT[0] * 1000), o: Math.round(COUNTRY_AT[1] * 1000), s: 13, l: 6, m: CANTON_MAX_KM, x: 2000 });
    // the cantons, the biggest first (the first names are the ones that find room)
    const sorted = [...areas].sort((p, q) => outerRings(q.shape).reduce((s, r) => s + Math.abs(areaKm2(r)), 0) - outerRings(p.shape).reduce((s, r) => s + Math.abs(areaKm2(r)), 0));
    for (const area of sorted) {
      const ar = outerRings(area.shape);
      const big = biggest(ar);
      const [lon, lat] = labelPoint([big], pairs(big));
      names.push({ n: area.label.toUpperCase(), a: Math.round(lat * 1000), o: Math.round(lon * 1000), s: 9, l: 2.4, m: 0, x: CANTON_MAX_KM });
    }
  }

  const pack = { v: 1, id, source, box, u: BORDER.u, borders, towns, names };
  const ringOut = encodeShape(dpRing(outline, OUTLINE.tol), OUTLINE.u, true);
  console.log(`${label}: ${areas.length} areas, ${lines.length} border lines (${borders.length} kept), ${towns.length} towns, ${names.length} names, box ${box.join(', ')}; ${(gz(pack) / 1024).toFixed(1)} KB gzipped; outline ${ringOut.length / 2} points`);
  if (gz(pack) > BUDGET_GZ) throw new Error(`${id}: over the budget of ${BUDGET_GZ / 1024} KB gzipped`);
  return { pack, region: { id, box, ring: ringOut } };
}

/* ========================================================================== *
 *  Main
 * ========================================================================== */
function main() {
  const dir = process.argv[2];
  const outDir = process.argv[3] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/features/site-maps/data');
  if (!dir) {
    console.error('usage: node tools/maps/build-packs.mjs <folder with the Natural Earth files> [output folder]');
    process.exit(2);
  }
  console.log(`reading ${dir}`);
  const admin1 = readLayer(dir, 'ne_10m_admin_1_states_provinces');
  const populated = readLayer(dir, 'ne_10m_populated_places');
  const lakeLayer = [...readLayer(dir, 'ne_10m_lakes'), ...readLayer(dir, 'ne_10m_lakes_europe', { required: false })];

  const versions = ['ne_10m_admin_1_states_provinces', 'ne_10m_populated_places', 'ne_10m_lakes', 'ne_10m_lakes_europe'].map((n) => `${n.replace('ne_10m_', '')} ${readVersion(dir, n)}`);
  const source = (what) => `Natural Earth 1:10m, public domain (naturalearthdata.com): ${versions.join(', ')}${what}; simplified by tools/maps/build-packs.mjs`;

  const lombard = admin1
    .filter((f) => f.attrs.adm0_a3 === 'ITA' && f.attrs.region === 'Lombardia' && f.shape)
    .map((f) => ({ name: f.attrs.name, label: f.attrs.name_it || f.attrs.name, shape: f.shape }));
  const cantons = admin1
    .filter((f) => f.attrs.adm0_a3 === 'CHE' && f.shape)
    .map((f) => ({ name: f.attrs.name, label: cantonName(f.attrs.name_it, f.attrs.name), shape: f.shape }));
  if (lombard.length !== 12) throw new Error(`expected 12 provinces of Lombardia, found ${lombard.length}`);
  if (cantons.length !== 26) throw new Error(`expected 26 cantons, found ${cantons.length}`);

  const handMade = ` and ${EXTRA_TOWNS.length} towns written by hand (${EXTRA_TOWNS.map((t) => t[0]).join(', ')})`;
  const lom = buildPack({ id: 'lombardia', label: 'Lombardia', areas: lombard, places: populated, lakeLayer, lakes: LAKES.lombardia, source: source(handMade), extra: EXTRA_TOWNS, country: null });
  const svi = buildPack({ id: 'svizzera', label: 'Svizzera', areas: cantons, places: populated, lakeLayer, lakes: LAKES.svizzera, source: source(handMade), extra: EXTRA_TOWNS, country: 'SVIZZERA' });

  fs.mkdirSync(outDir, { recursive: true });
  const head = (what, type, name) => `// Generated by tools/maps/build-packs.mjs from Natural Earth (public domain). Do not edit by hand: see src/features/site-maps/README.md.\n// ${what}\nimport type { ${type} } from '../engine/region/model';\n\nexport const ${name}: ${type} = `;
  fs.writeFileSync(path.join(outDir, 'lombardia.ts'), `${head('Detail pack of Lombardia: borders of the provinces, towns, names of lakes.', 'RawPack', 'LOMBARDIA')}${format(lom.pack, '')};\n`);
  fs.writeFileSync(path.join(outDir, 'svizzera.ts'), `${head('Detail pack of Svizzera: borders of the cantons, towns, names of the country, the cantons and the lakes.', 'RawPack', 'SVIZZERA')}${format(svi.pack, '')};\n`);
  const index = { v: 1, regions: [lom.region, svi.region] };
  fs.writeFileSync(path.join(outDir, 'regions.ts'), `${head('Where the regions with a detail pack are: their boxes and coarse outlines.', 'RawRegionIndex', 'REGION_INDEX')}${format(index, '')};\n`);
  console.log(`wrote lombardia.ts, svizzera.ts, regions.ts in ${outDir}; the index is ${(gz(index) / 1024).toFixed(1)} KB gzipped`);
}

main();
