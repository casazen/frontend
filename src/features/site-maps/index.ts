export { LOCAL_KINDS, localMapSvg, localPlace, type LocalKind, type LocalSpec, type MapLabel } from './engine/local';
export { regionMapSvg, type LabelMode } from './engine/region';
export { snapToLand } from './engine/snap';
export { resetMapIds } from './engine/style';
export {
  VIEW_ITALIA,
  fitView,
  isPositionSet,
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
export { MapCard } from './components/map-card';
export { mapCardOfPin } from './components/map-card-data';
export { RegionMap } from './components/region-map';
export type { MapPinData, RegionMapProps } from './components/types';
export type { LocalPoi } from './components/types-local';
export { useMapLink, type MapLink } from './components/use-map-link';
export { VIEW_LOMBARDIA_SVIZZERA, getRegionForPoints, loadRegionData, regionsForView } from './load';
