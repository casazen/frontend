import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
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
      <PageHeader title={title} description={description} crumbs={crumbs} />
      <MarketplaceTabs section={section} />
      {toolbar ? <div className="max-w-xl">{toolbar}</div> : null}
      {children}
    </div>
  );
}
