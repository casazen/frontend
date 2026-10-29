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
export { loadRegionData, regionsForView, type MapRegion } from './load';
