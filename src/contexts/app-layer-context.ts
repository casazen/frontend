import { createContext } from 'react';
import type { UseAppLayerReturn } from '@/hooks/use-app-layer';

export const AppLayerContext = createContext<UseAppLayerReturn | null>(null);
