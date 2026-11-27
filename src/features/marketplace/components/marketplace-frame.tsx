import { Store } from 'lucide-react';
import type { ReactNode } from 'react';
import { ServicePageHeader } from '@/features/supplier/components/service-page-header';
import type { PageCrumb } from '@/lib/page-crumbs';
import { MarketplaceTabs, type MarketplaceSection } from './marketplace-tabs';

interface MarketplaceFrameProps {
  section: MarketplaceSection;
  title: string;
  description?: string;
  crumbs?: PageCrumb[];
  toolbar?: ReactNode;
  children: ReactNode;
}

/** The account marketplace stays available before any property is set up. */
export function MarketplaceFrame({ section, title, description, crumbs, toolbar, children }: MarketplaceFrameProps) {
  return (
    <div className="min-w-0 space-y-6" data-testid="marketplace-page">
      <ServicePageHeader icon={Store} title={title} description={description} crumbs={crumbs} />
      <div className="grid min-w-0 gap-3 rounded-2xl border border-border bg-card px-4 py-3 lg:grid-cols-[minmax(12rem,1fr)_minmax(16rem,1fr)] lg:items-center">
        <MarketplaceTabs section={section} />
        {toolbar ? <div className="min-w-0">{toolbar}</div> : null}
      </div>
      {children}
    </div>
  );
}
