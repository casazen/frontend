import type { ReactNode } from 'react';
import { SiteAppearanceContext, type SiteAppearance } from './site-appearance-context';

/** Offers the look of the booking site (theme, font pair, color of the host) to what is drawn in a portal (DB-20). */
export function SiteAppearanceProvider({ value, children }: { value: SiteAppearance; children: ReactNode }) {
  return <SiteAppearanceContext.Provider value={value}>{children}</SiteAppearanceContext.Provider>;
}
