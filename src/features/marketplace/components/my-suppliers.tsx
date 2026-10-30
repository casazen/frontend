import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatStayDate, romeDateOf } from '@/lib/stay-dates';
import { useMarketplaceSuppliers } from '@/queries/use-service-requests';
import type { UsedSupplier } from '@/types/service-request';
import { MARKETPLACE_MINE_PATH, marketplaceHref, marketplaceSupplierPath } from '../lib/marketplace-paths';
import type { InterventionRequestStart } from '../lib/use-request-intervention';

/** The address parameter that holds the supplier whose requests «Le mie app» shows alone (`?supplier=<orgId>`). */
export const MINE_SUPPLIER_PARAM = 'supplier';

interface MySuppliersProps {
  suppliers: readonly UsedSupplier[];
  /** The property the marketplace is about: «Richiedi di nuovo» asks for it, and only a supplier that works around it can be asked. */
  propertyId: string;
  requestIntervention: (from?: InterventionRequestStart) => void;
}

/**
 * «I miei fornitori» (MKT, SR-09c): the suppliers the host already asked for a job, the latest first, with how many requests it sent
 * each, how many are not over, and the three things to do about it: ask again, open its page, see the requests. Nothing about a
 * supplier but what the host did with it. The section is a component of its own: what the marketplace will offer to use later has
 * its own, next to it.
 */
export function MySuppliers({ suppliers, propertyId, requestIntervention }: MySuppliersProps) {
  const { t, i18n } = useTranslation();
  // Which of them work around the property: the list of the area (the same query as Scopri), so there is no other request for it.
  const around = useMarketplaceSuppliers({ propertyId });
  const working = new Set(around.data?.items.map((supplier) => supplier.orgId));

  return (
    <PlainSection title={t('marketplace.mine.suppliersTitle')} count={suppliers.length} data-testid="marketplace-my-suppliers">
      <ul role="list" className="list-none divide-y">
        {suppliers.map((supplier) => {
          const canAsk = working.has(supplier.supplierOrgId);
          const last = formatStayDate(romeDateOf(supplier.lastRequestAt), i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });

          return (
            <li
              key={supplier.supplierOrgId}
              className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
              data-testid={`marketplace-my-supplier-${supplier.supplierOrgId}`}
            >
              <div className="min-w-0 space-y-1">
                <p className="break-words font-medium">{supplier.supplierName}</p>
                <p className="break-words text-sm text-foreground/70">
                  {t('marketplace.mine.summary', { count: supplier.requestsCount, date: last })}
                </p>
                {supplier.openCount > 0 ? (
                  <Badge variant="warning" data-testid={`marketplace-my-supplier-open-${supplier.supplierOrgId}`}>
                    {t('marketplace.mine.open', { count: supplier.openCount })}
                  </Badge>
                ) : null}
                {around.data && !canAsk ? <p className="text-sm text-foreground/70">{t('marketplace.mine.notAround')}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={!canAsk}
                  onClick={() => requestIntervention({ supplierOrgId: supplier.supplierOrgId, category: supplier.lastCategory })}
                  data-testid={`marketplace-my-supplier-again-${supplier.supplierOrgId}`}
                >
                  {t('marketplace.mine.requestAgain')}
                </Button>
                {canAsk ? (
                  <Button asChild variant="ghost" className="min-h-11">
                    <Link to={marketplaceHref(marketplaceSupplierPath(supplier.supplierOrgId), propertyId)}>{t('marketplace.mine.openPage')}</Link>
                  </Button>
                ) : null}
                <Button asChild variant="ghost" className="min-h-11">
                  <Link
                    to={marketplaceHref(MARKETPLACE_MINE_PATH, propertyId, { [MINE_SUPPLIER_PARAM]: supplier.supplierOrgId })}
                    data-testid={`marketplace-my-supplier-requests-${supplier.supplierOrgId}`}
                  >
                    {t('marketplace.mine.seeRequests')}
                  </Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </PlainSection>
  );
}
