/**
 * Schematic maps of the public site (DB-19a): drawn by us, with no tile provider and no exact position. See README.md.
 */
export { LOCAL_KINDS, localMapSvg, localPlace, type LocalKind, type LocalSpec, type MapLabel } from './engine/local';
export { regionMapSvg, type LabelMode, type RegionMapOptions } from './engine/region';
export { snapToLand } from './engine/snap';
export { resetMapIds } from './engine/style';
export {
  VIEW_ITALIA,
  VIEW_PUGLIA,
  fitView,
  makeView,
  panView,
  projectPoint,
  publicPoint,
  unprojectPoint,
  zoomView,
  type LatLon,
  type View,
} from './engine/view';
export { LocalMap } from './components/local-map';
export { RegionMap } from './components/region-map';
export type { MapPinData, RegionMapProps } from './components/types';
export type { LocalMapProps, LocalPoi } from './components/types-local';
export { useMapLink, type MapLink } from './components/use-map-link';
export { loadRegionData, regionsForView, type MapRegion } from './load';
