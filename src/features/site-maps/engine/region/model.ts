/**
 * Data model of the regional maps (DB-19a). `Raw*` types are the generated files as they are stored (compact integers, see
 * tools/maps/build-italy.mjs); the other types are what the renderer works on: points in km east and north of the origin
 * of the maps, with the bounding box of every ring so that whatever is far from the frame is skipped.
 */
import type { Pt } from '../geometry';

/** A ring or a line in km, with its bounding box [x0, y0, x1, y1] in km. */
export interface Shape {
  k: Pt[];
  box: [number, number, number, number];
}

/** One level of detail of the national base: land and neighbouring lands, Italy's outline, lakes, borders between regions. */
export interface GeoLod {
  land: Shape[];
  italy: Shape[];
  lakes: Shape[];
  borders: Shape[];
}

export interface BaseTown {
  id: string;
  name: string;
  lat: number;
  lon: number;
  tier: 1 | 2 | 3;
  /** Inhabitants (rounded), for the size of the built-up area. */
  pop: number;
}

/** A name written on the map at a position: a region, a sea or a neighbouring country. */
export interface GeoName {
  text: string;
  lat: number;
  lon: number;
  /** Letter size and spacing in px. */
  size: number;
  ls: number;
  /** The widths of the frame (km) in which the name is shown. */
  min: number;
  max: number;
  rot?: number;
}

export interface GeoBase {
  /** Index 0 is the coarsest level (the whole country), 2 the finest (a few tens of km). */
  lods: GeoLod[];
  /** Simplification tolerance of every level, in km: the level shown is the coarsest one whose error stays within a couple of pixels. */
  tol: number[];
  towns: BaseTown[];
  regions: GeoName[];
  seas: GeoName[];
  countries: GeoName[];
}

/* ----- the same thing as stored in the generated file ----- */

/** A ring or a line: [lat0, lon0, dlat1, dlon1, …], integers in units of 1/`u` degree. */
export type RawShape = number[];

export interface RawLod {
  /** Units per degree of the integers of this level: 100 is about 1 km, 1000 about 100 m. */
  u: number;
  land: RawShape[];
  italy: RawShape[];
  lakes: RawShape[];
  borders: RawShape[];
}

export interface RawName {
  /** text */
  n: string;
  /** latitude and longitude with three decimals, as integers in thousandths */
  a: number;
  o: number;
  /** size, letter spacing, min and max width of the frame in km, rotation (degrees) */
  s?: number;
  l?: number;
  m?: number;
  x?: number;
  r?: number;
}

export interface RawItaly {
  /** Format version. */
  v: 1;
  /** Where the data come from, for the credits. */
  source: string;
  /** Simplification tolerance of every level, in km. */
  tol: number[];
  lods: RawLod[];
  /** Towns: [name, lat in thousandths, lon in thousandths, tier, inhabitants in thousands]. */
  towns: [string, number, number, 1 | 2 | 3, number][];
  regions: RawName[];
  seas: RawName[];
  countries: RawName[];
}

/* ----- detail packs ----- */

/** A place in a detail pack: tier 1 is shown at every zoom, 2 from about 150 km of frame, 3 from about 40 km. */
export interface PackTown {
  id: string;
  name: string;
  lat: number;
  lon: number;
  tier: 1 | 2 | 3;
}
export interface PackPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
}
/** A road or a railway: ids of towns or stations, or [lat, lon] points. Class 1 is a trunk road, 2 a state road, 3 a provincial one. */
export interface PackRoad {
  c: 1 | 2 | 3;
  p: (string | [number, number])[];
}
export interface PackAreaName {
  text: string;
  lat: number;
  lon: number;
  kind: 'land' | 'sea';
  size: number;
  ls: number;
  rot?: number;
  min: number;
  max: number;
}
/** A soft tint of the territory (an ellipse with semi-axes in km) that hints at plains, hills and olive groves. */
export interface PackTint {
  lat: number;
  lon: number;
  rx: number;
  ry: number;
  g: 'g' | 'w' | 't' | 'o';
}
export interface PackLake {
  id: string;
  pts: [number, number][];
}

/** Extra detail drawn on top of the national base where the data exist: towns, roads, railways, countryside. */
export interface DetailPack {
  id: string;
  /** Area the pack covers: [min lat, min lon, max lat, max lon]. */
  box: [number, number, number, number];
  towns: PackTown[];
  airports: PackPlace[];
  stations: PackPlace[];
  /** Radius in km of the built-up area of a town, by id. */
  foot: Record<string, number>;
  roads: PackRoad[];
  rails: (string | [number, number])[][];
  areaNames: PackAreaName[];
  tints: PackTint[];
  lakes: PackLake[];
}
