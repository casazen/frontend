import { createContext, useContext } from 'react';
import type { SupplierShowcaseDto } from '@/api/public-supplier.api';
import type { SiteModel } from '@/lib/supplier-site/site-model';
import { siteThemeProps, type SiteThemeProps } from '@/lib/supplier-site/style-config';

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

export function useSiteDialogTheme(): SiteThemeProps {
  const { model } = useSupplierSite();
  return siteThemeProps(model.style, model.font, model.buttonColor);
}
