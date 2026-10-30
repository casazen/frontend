import { useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/shared/empty-state';
import { useUsedSuppliers } from '@/queries/use-service-requests';
import { MarketplaceFrame, type MarketplaceContext } from './components/marketplace-frame';
import { MINE_SUPPLIER_PARAM, MySuppliers } from './components/my-suppliers';
import { RequestsSection } from './components/requests-section';
import { SuppliersError, SuppliersLoading } from './components/suppliers-state';
import { MARKETPLACE_PATH, marketplaceHref } from './lib/marketplace-paths';

/**
 * Le mie app (MKT, SR-09c): what the host already uses of the marketplace. For now the suppliers it already asked for a job and the
 * requests it sent, with what happened to each; what the marketplace will offer to use later is a section of its own next to these.
 * With no request ever made it says so and leads to the suppliers.
 */
export function MarketplaceMinePage() {
  const { t } = useTranslation();

  return (
    <MarketplaceFrame
      section="mine"
      title={t('marketplace.mine.title')}
      description={t('marketplace.mine.description')}
      trail={[{ label: t('marketplace.title'), path: MARKETPLACE_PATH }, { label: t('marketplace.mine.title') }]}
      needsComune={false}
    >
      {(context) => <MineContent context={context} />}
    </MarketplaceFrame>
  );
}

function MineContent({ context }: { context: MarketplaceContext }) {
  const { t } = useTranslation();
  const { property, requestIntervention } = context;
  const [searchParams, setSearchParams] = useSearchParams();
  const used = useUsedSuppliers();
  const suppliers = used.data?.items ?? [];

  if (used.isLoading) return <SuppliersLoading />;
  if (used.isError && !used.data) return <SuppliersError error={used.error} onRetry={() => void used.refetch()} />;

  if (suppliers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t('marketplace.mine.emptyTitle')}
        description={t('marketplace.mine.emptyHint')}
        action={{ label: t('marketplace.mine.discover'), href: marketplaceHref(MARKETPLACE_PATH, property.id) }}
        className="py-8"
      />
    );
  }

  // «Vedi le richieste» of a supplier: the requests below are only its own, until the person asks for all of them again.
  const only = suppliers.find((supplier) => supplier.supplierOrgId === searchParams.get(MINE_SUPPLIER_PARAM));

  return (
    <div className="space-y-8">
      <MySuppliers suppliers={suppliers} propertyId={property.id} requestIntervention={requestIntervention} />
      <RequestsSection
        propertyId={property.id}
        onlySupplier={
          only
            ? {
                orgId: only.supplierOrgId,
                name: only.supplierName,
                onShowAll: () =>
                  setSearchParams(
                    (previous) => {
                      const next = new URLSearchParams(previous);
                      next.delete(MINE_SUPPLIER_PARAM);
                      return next;
                    },
                    { replace: true },
                  ),
              }
            : undefined
        }
      />
    </div>
  );
}
