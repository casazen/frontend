#!/usr/bin/env node
/**
 * Builds the national base of the schematic maps (DB-19a): src/features/site-maps/data/italy.ts. The base covers Italy and
 * Switzerland, the two countries the maps are about; the detail packs of Lombardia and Svizzera are built by build-packs.mjs.
 *
 * A development tool: it is not run by the build nor by the CI. The generated file is committed; the raw data are not.
 *
 *   node tools/maps/build-italy.mjs <folder> [output.ts]
 *
 * <folder> holds the Natural Earth files (public domain, https://www.naturalearthdata.com), either as the .zip files of the
 * download page or already unzipped (.shp + .dbf): ne_10m_land, ne_10m_admin_0_countries, ne_10m_admin_1_states_provinces,
 * ne_10m_populated_places, ne_10m_lakes (and, if present, ne_10m_lakes_europe). Nothing else is read and nothing is fetched.
 *
 * What it does: reads the shapefiles (the small reader of ne.mjs: no dependency), keeps what is near Italy, simplifies it at three
 * levels of detail with Douglas-Peucker (the tolerance of each level is written in the file), quantises the coordinates
 * (1/100 degree, about 1 km, for the two coarser levels; 1/1000 for the finest, see README.md), codes them as differences and
 * writes one TypeScript module. It prints the sizes and exits with an error if the data are over the budget of 80 KB gzipped.
 *
 * Italy and Switzerland share their border vertex by vertex in Natural Earth, so the two outlines are merged into one area
 * (`home`: no seam between them, whatever the simplification) and the shared edges are the border between the two countries
 * (`nation`). Region borders are the edges that two provinces of different regions share; the point where the name of a region
 * is written is the point of the region farthest from its edges.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { chainEdges, dpOpen, encodeShape, format, inBox, labelPoint, mergeRings, outerRings, readLayer, readVersion, regionBorders, ringsForLod } from './ne.mjs';

const BUDGET_GZ = 80 * 1024;

/** Levels of detail: tolerance (km), units per degree, area of the smallest island and lake kept (km²), extent of the data. */
const LODS = [
  { tol: 2.0, u: 100, minIsland: 40, minLake: 100, box: { lat0: 32, lat1: 50.5, lon0: 2, lon1: 23.5 } },
  { tol: 0.7, u: 100, minIsland: 6, minLake: 30, box: { lat0: 32.4, lat1: 50.2, lon0: 3.5, lon1: 22 } },
  { tol: 0.25, u: 1000, minIsland: 0.8, minLake: 4, box: { lat0: 34.1, lat1: 48.5, lon0: 5.2, lon1: 20.2 } },
];

function lakeRings(features, lod) {
  const rings = [];
  for (const f of features) for (const r of outerRings(f.shape)) rings.push(r);
  return ringsForLod(rings, lod, lod.minLake);
}

/* ========================================================================== *
 *  Names written on the map (by hand: positions, sizes and the widths of the frame where they show)
 * ========================================================================== */
// [text, lat, lon, size, letter spacing, min width of the frame (km), max width (km), rotation]
const SEAS = [
  // a name may have several places: the first one where it fits is the one that is written
  ['Mare Adriatico', 43.7, 14.3, 12, 2.2, 150, 2000, 40],
  ['Mare Adriatico', 42.8, 15.7, 12, 2.2, 150, 2000, 40],
  ['Mare Adriatico', 41.55, 17.55, 12.5, 2.2, 120, 400, -32],
  ['Mar Ionio', 39.9, 17.0, 12.5, 2.2, 120, 400, 0],
  ['Mar Ionio', 37.7, 17.3, 12, 2.2, 400, 2000, 0],
  ['Mar Tirreno', 40.15, 12.45, 12, 2.2, 400, 2000, 0],
  ['Mar Tirreno', 39.9, 15.05, 10.5, 2, 200, 400, 0],
  ['Mar Ligure', 43.65, 8.9, 11, 2, 150, 2000, 0],
  ['Mar di Sardegna', 39.7, 7.7, 11, 2, 400, 2000, 0],
  ['Canale di Sicilia', 37.3, 12.1, 10.5, 1.8, 250, 2000, -18],
];
// the countries the maps are not about (Switzerland is one of the two they are about: its name is in its detail pack)
const COUNTRIES = [
  ['FRANCIA', 44.3, 6.4],
  ['AUSTRIA', 47.15, 13.2],
  ['SLOVENIA', 46.05, 14.7],
  ['CROAZIA', 45.15, 15.7],
  ['ALBANIA', 41.0, 19.9],
  ['TUNISIA', 35.9, 9.6],
];
/** Names of the regions as they are written on the map (the file has the long forms with the second language). */
const REGION_NAME = {
  Apulia: 'Puglia',
  Sicily: 'Sicilia',
  "Valle d'Aosta/Vallée d'Aoste": "Valle d'Aosta",
  'Trentino-Alto Adige/Südtirol': 'Trentino-Alto Adige',
  'Friuli-Venezia Giulia': 'Friuli-Venezia Giulia',
};

/* ========================================================================== *
 *  Main
 * ========================================================================== */
function main() {
  const dir = process.argv[2];
  const outFile = process.argv[3] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/features/site-maps/data/italy.ts');
  if (!dir) {
    console.error('usage: node tools/maps/build-italy.mjs <folder with the Natural Earth files> [output.ts]');
    process.exit(2);
  }
  console.log(`reading ${dir}`);
  const land = readLayer(dir, 'ne_10m_land');
  const countries = readLayer(dir, 'ne_10m_admin_0_countries');
  const admin1 = readLayer(dir, 'ne_10m_admin_1_states_provinces');
  const places = readLayer(dir, 'ne_10m_populated_places');
  const lakes = [...readLayer(dir, 'ne_10m_lakes'), ...readLayer(dir, 'ne_10m_lakes_europe', { required: false })];

  const landRings = land.flatMap((f) => outerRings(f.shape));
  const countryRings = (a3) => countries.filter((f) => f.attrs.adm0_a3 === a3 || f.attrs.iso_a3 === a3).flatMap((f) => outerRings(f.shape));
  const italyRings = countryRings('ITA');
  const swissRings = countryRings('CHE');
  if (!italyRings.length) throw new Error('Italy not found in ne_10m_admin_0_countries');
  if (!swissRings.length) throw new Error('Switzerland not found in ne_10m_admin_0_countries');
  // Italy and Switzerland as one area; the edges they share are their border
  const home = mergeRings([...italyRings, ...swissRings]);
  if (home.shared.length < 100) throw new Error(`Italy and Switzerland share only ${home.shared.length} edges: the data do not match vertex by vertex`);
  const nationLines = chainEdges(home.shared);
  const provinces = admin1
    .filter((f) => (f.attrs.adm0_a3 ?? f.attrs.sr_adm0_a3) === 'ITA' && f.shape)
    .map((f) => ({ region: REGION_NAME[f.attrs.region] ?? f.attrs.region, shape: f.shape }));
  if (!provinces.length) throw new Error('no Italian provinces in ne_10m_admin_1_states_provinces');
  const { lines, byRegion } = regionBorders(provinces);
  console.log(`  ${landRings.length} land rings, ${home.rings.length} rings of Italy and Switzerland, ${nationLines.length} lines of their border, ${provinces.length} provinces, ${lines.length} border lines, ${byRegion.size} regions`);

  const encodeLines = (list, lod) =>
    list
      .filter((l) => l.some((p) => inBox(p, lod.box)))
      .map((l) => encodeShape(dpOpen(l, lod.tol), lod.u, false))
      .filter(Boolean);
  const lods = LODS.map((lod) => ({
    u: lod.u,
    land: ringsForLod(landRings, lod, lod.minIsland),
    home: ringsForLod(home.rings, lod, lod.minIsland),
    lakes: lakeRings(lakes, lod),
    borders: encodeLines(lines, lod),
    nation: encodeLines(nationLines, lod),
  }));

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

  const versions = ['ne_10m_land', 'ne_10m_admin_0_countries', 'ne_10m_admin_1_states_provinces', 'ne_10m_populated_places', 'ne_10m_lakes', 'ne_10m_lakes_europe'].map((n) => `${n.replace('ne_10m_', '')} ${readVersion(dir, n)}`);
  const data = {
    v: 1,
    source: `Natural Earth 1:10m, public domain (naturalearthdata.com): ${versions.join(', ')}; simplified by tools/maps/build-italy.mjs`,
    tol: LODS.map((l) => l.tol),
    lods,
    towns,
    regions,
    seas,
    countries: countryNames,
  };
  const json = JSON.stringify(data);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const header = [
    '// Generated by tools/maps/build-italy.mjs from Natural Earth (public domain). Do not edit by hand: see src/features/site-maps/README.md.',
    "import type { RawItaly } from '../engine/region/model';",
    '',
    'export const ITALY: RawItaly = ',
  ].join('\n');
  const source = `${header}${format(data, '')};\n`;
  fs.writeFileSync(outFile, source);
  const gz = zlib.gzipSync(json, { level: 9 }).length;
  console.log(`wrote ${outFile} (${(source.length / 1024).toFixed(1)} KB of source)`);
  console.log(`  ${(json.length / 1024).toFixed(1)} KB, ${(gz / 1024).toFixed(1)} KB gzipped (budget ${BUDGET_GZ / 1024} KB)`);
  lods.forEach((l, i) => {
    const part = JSON.stringify(l);
    console.log(`  level ${i}: tolerance ${LODS[i].tol} km, ${l.land.length} land, ${l.home.length} home, ${l.lakes.length} lakes, ${l.borders.length} borders, ${l.nation.length} national, ${(zlib.gzipSync(part, { level: 9 }).length / 1024).toFixed(1)} KB gzipped`);
  });
  console.log(`  ${towns.length} towns, ${regions.length} regions`);
  if (gz > BUDGET_GZ) {
    console.error('over the budget: lower the detail (tolerances, smallest island) or split the file by macro-region');
    process.exit(1);
  }
}

main();
