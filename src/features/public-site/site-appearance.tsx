import type { ReactNode } from 'react';
import { SiteAppearanceContext, type SiteAppearance } from './site-appearance-context';

export function SiteAppearanceProvider({ value, children }: { value: SiteAppearance; children: ReactNode }) {
  return <SiteAppearanceContext.Provider value={value}>{children}</SiteAppearanceContext.Provider>;
}
