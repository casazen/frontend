import { useContext } from 'react';
import { AppLayerContext } from '@/contexts/app-layer-context';
import type { UseAppLayerReturn } from '@/hooks/use-app-layer';

export function useAppLayerContext(): UseAppLayerReturn {
  const context = useContext(AppLayerContext);
  if (!context) {
    throw new Error('useAppLayerContext must be used within AppLayerProvider');
  }
  return context;
}
