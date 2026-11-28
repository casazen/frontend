import { useEffect, useState, useSyncExternalStore } from 'react';
import { geoVersion, hasBase, subscribeGeo } from '../engine/region/registry';
import type { View } from '../engine/view';
import { loadRegionData, regionsForView, type MapRegion } from '../load';

export const useGeoVersion = (): number => useSyncExternalStore(subscribeGeo, geoVersion, () => 0);

export interface MapData {
  status: 'loading' | 'ready' | 'error';
  version: number;
  retry: () => void;
}

export function useMapData(view: View): MapData {
  const version = useGeoVersion();
  const baseReady = useSyncExternalStore(subscribeGeo, hasBase, () => false);
  const key = regionsForView(view).join(',');
  const [failed, setFailed] = useState<{ key: string; attempt: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all(key.split(',').map((region) => loadRegionData(region as MapRegion))).catch(() => {
      if (alive) setFailed({ key, attempt });
    });
    return () => {
      alive = false;
    };
  }, [key, attempt]);
  const error = !baseReady && failed?.key === key && failed.attempt === attempt;
  return { status: error ? 'error' : baseReady ? 'ready' : 'loading', version, retry: () => setAttempt((n) => n + 1) };
}
