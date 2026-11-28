import { useState } from 'react';
import { fitView, panView, zoomView, type LatLon, type View } from '../engine/view';
import { FIT } from '../load';

const MIN_SPAN_KM = 8;
const MAX_SPAN_KM = 1500;

export interface MapViewControl {
  view: View;
  custom: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoom: (factor: number, anchor?: LatLon) => View | null;
  pan: (dxFrac: number, dyFrac: number) => void;
  fit: () => void;
  focus: (points: readonly LatLon[]) => View;
}

/**
 * The view of a map: fitted to the pins (with a margin) until the person moves or zooms it, then kept as it is. `aspect` is the
 * ratio of the box the map is shown in. The zoom stays between the whole country and a frame the rounding of the positions
 * can still justify, so a person never zooms to a level the data do not have.
 */
export function useMapView(pins: readonly LatLon[], aspect: number, initial?: View): MapViewControl {
  const [manual, setManual] = useState<View | null>(initial ?? null);
  const fitted = fitView(pins, { aspect, ...FIT });
  const view: View = manual ? { ...manual, aspect } : fitted;
  return {
    view,
    custom: manual !== null,
    canZoomIn: view.spanKm > MIN_SPAN_KM + 0.01,
    canZoomOut: view.spanKm < MAX_SPAN_KM - 1,
    zoom: (factor, anchor) => {
      const f = factor > 1 ? Math.min(factor, view.spanKm / MIN_SPAN_KM) : Math.max(factor, view.spanKm / MAX_SPAN_KM);
      if (Math.abs(f - 1) < 1e-6) return null;
      const next = zoomView(view, f, anchor);
      setManual(next);
      return next;
    },
    pan: (dxFrac, dyFrac) => setManual(panView(view, dxFrac, dyFrac)),
    fit: () => setManual(null),
    focus: (points) => {
      const next = fitView(points, { aspect, padPct: 0.5, minSpanKm: MIN_SPAN_KM });
      setManual(next);
      return next;
    },
  };
}
