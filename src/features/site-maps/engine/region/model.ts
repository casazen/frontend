/**
 * Data model of the regional maps (DB-19a). `Raw*` types are the generated files as they are stored (compact integers, see
 * tools/maps/build-italy.mjs); the other types are what the renderer works on: points in km east and north of the origin
 * of the maps, with the bounding box of every ring so that whatever is far from the frame is skipped.
 */
import type { Pt } from '../geometry';

export interface Shape {
  k: Pt[];
  box: [number, number, number, number];
}

export interface GeoLod {
  land: Shape[];
  home: Shape[];
  lakes: Shape[];
  borders: Shape[];
  nation: Shape[];
}

export interface BaseTown {
  id: string;
  name: string;
  lat: number;
  lon: number;
  tier: 1 | 2 | 3;
  pop: number;
}

export interface GeoName {
  text: string;
  lat: number;
  lon: number;
  size: number;
  ls: number;
  min: number;
  max: number;
  rot?: number;
  len?: number;
}

export interface GeoBase {
  lods: GeoLod[];
  tol: number[];
  towns: BaseTown[];
  regions: GeoName[];
  seas: GeoName[];
  countries: GeoName[];
}

export type RawShape = number[];

export interface RawLod {
  u: number;
  land: RawShape[];
  home: RawShape[];
  lakes: RawShape[];
  borders: RawShape[];
  nation: RawShape[];
}

export interface RawName {
  n: string;
  a: number;
  o: number;
  s?: number;
  l?: number;
  m?: number;
  x?: number;
  r?: number;
}

export interface RawItaly {
  v: 1;
  source: string;
  tol: number[];
  lods: RawLod[];
  towns: [string, number, number, 1 | 2 | 3, number][];
  regions: RawName[];
  seas: RawName[];
  countries: RawName[];
}

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
export interface PackRoad {
  c: 1 | 2 | 3;
  p: (string | [number, number])[];
}
export interface PackAreaName {
  text: string;
  lat: number;
  lon: number;
  kind: 'land' | 'sea' | 'lake';
  size: number;
  ls: number;
  rot?: number;
  min: number;
  max: number;
  len?: number;
}
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

export interface DetailPack {
  id: string;
  box: [number, number, number, number];
  towns: PackTown[];
  airports: PackPlace[];
  stations: PackPlace[];
  foot: Record<string, number>;
  roads: PackRoad[];
  rails: (string | [number, number])[][];
  areaNames: PackAreaName[];
  tints: PackTint[];
  lakes: PackLake[];
  borders: Shape[];
}

export interface RawPackName extends RawName {
  k?: 'sea' | 'lake';
  d?: number;
}

export interface RawPack {
  v: 1;
  id: string;
  source: string;
  box: [number, number, number, number];
  u: number;
  borders: RawShape[];
  towns: [string, number, number, 1 | 2 | 3, number][];
  names: RawPackName[];
}

export interface RawRegionIndex {
  v: 1;
  regions: {
    id: 'lombardia' | 'svizzera';
    box: [number, number, number, number];
    ring: RawShape;
  }[];
}
