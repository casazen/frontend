import { useState } from 'react';
import { fitView, panView, zoomView, type LatLon, type View } from '../engine/view';

/** The smallest frame (km): the positions are rounded to about 1 km, so closer than this the map would only show the rounding. */
const MIN_SPAN_KM = 8;
const MAX_SPAN_KM = 1500;
/** Margin around the pins (fraction per side) and the smallest frame when the view is fitted to them. */
const FIT = { padPct: 0.42, minSpanKm: 40 };

export interface MapViewControl {
  view: View;
  /** True while the person has moved or zoomed the map: «Adatta ai risultati» brings it back. */
  custom: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  /** Zooms by a factor (2 is twice as close) and returns the new view, or null when the zoom is already at its end. */
  zoom: (factor: number, anchor?: LatLon) => View | null;
  /** Moves the frame by a fraction of its size: positive goes east and south. */
  pan: (dxFrac: number, dyFrac: number) => void;
  fit: () => void;
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
  };
}
