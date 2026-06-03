import { useAppLayer } from '@/hooks/use-app-layer';
import { AppLayerContext } from '@/contexts/app-layer-context';

export function AppLayerProvider({ children }: { children: React.ReactNode }) {
  const layerState = useAppLayer();
  return (
    <AppLayerContext.Provider value={layerState}>{children}</AppLayerContext.Provider>
  );
}
