import { createContext, useContext } from 'react';
import type { SupplierShowcaseDto } from '@/api/public-supplier.api';
import type { SiteModel } from '@/lib/supplier-site/site-model';
import { siteThemeProps, type SiteThemeProps } from '@/lib/supplier-site/style-config';

/** What the pages of a supplier's site share: the data the shell read once, and the model decided from it. */
export interface SupplierSiteContextValue {
  slug: string;
  showcase: SupplierShowcaseDto;
  model: SiteModel;
}

export const SupplierSiteContext = createContext<SupplierSiteContextValue | null>(null);

export function useSupplierSite(): SupplierSiteContextValue {
  const value = useContext(SupplierSiteContext);
  if (!value) throw new Error('useSupplierSite must be used inside SupplierSiteShell');
  return value;
}

/**
 * The style, the typeface and the color of the site, for the sheets it opens: a dialog is drawn outside the root of the site, so it
 * has to wear them itself (`<DialogContent className="vz-dialog" {...useSiteDialogTheme()}>`).
 */
export function useSiteDialogTheme(): SiteThemeProps {
  const { model } = useSupplierSite();
  return siteThemeProps(model.style, model.font, model.buttonColor);
}
