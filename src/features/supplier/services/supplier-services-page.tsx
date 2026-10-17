import { useTranslation } from 'react-i18next';
import { Eye, Plus, Store, Tag } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ListView } from '@/components/shared/list-view/list-view';
import { Alert } from '@/components/ui/alert';
import { useSupplierServices } from '@/queries/use-supplier-services';
import { SERVICE_LIMITS } from './lib/service-limits';
import { NEW_SERVICE_PATH, SHOWCASE_PATH, bookingPreviewPath } from './lib/service-paths';
import { useServicesList } from './services-list';
import { useServiceActions } from './use-service-actions';

const T = 'supplier.services';

/** A catalog that is empty says what a service is made of and offers the way in: four steps, no form to look at yet. */
function EmptyCatalog() {
  const { t } = useTranslation();
  const steps = ['service', 'price', 'booking', 'photos'] as const;
  return (
    <div className="rounded-xl bg-card p-2 shadow-sm ring-1 ring-inset ring-border" data-testid="supplier-services-empty">
      <EmptyState
        icon={Tag}
        title={t(`${T}.empty.title`)}
        description={t(`${T}.empty.description`)}
        action={{ label: t(`${T}.actions.add`), href: NEW_SERVICE_PATH }}
        className="pb-4 pt-8"
      />
      <ol className="mx-auto mb-6 grid max-w-md gap-2 px-4 text-sm" aria-label={t(`${T}.empty.stepsLabel`)}>
        {steps.map((step, index) => (
          <li key={step} className="flex min-w-0 items-start gap-3">
            <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
              {index + 1}
            </span>
            <span className="min-w-0 break-words">{t(`${T}.empty.steps.${step}`)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Servizi e prezzi (SP-06, restyled in SP-SERV): the catalog of the supplier in the unified list (UI-14), filtered by state with
 * the quick filters. Each service has the one thing to do about it by state (go on with a draft, put a paused one back on offer)
 * and the rest in "⋯": edit, see how customers see it, duplicate, pause or publish, delete with a confirmation. 30 services at
 * most, so it is one request and no paging. The way to add one is the action of the header, which is the guided creation.
 */
export function SupplierServicesPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useSupplierServices();
  const actions = useServiceActions();
  const limit = data?.limit || SERVICE_LIMITS.maxServices;
  const atLimit = data !== undefined && data.total >= limit;
  const list = useServicesList({ atLimit, busy: actions.busy, onPublish: actions.publishService, onPause: actions.pauseService, onDelete: actions.askDelete });

  const header = (
    <PageHeader
      title={t(`${T}.title`)}
      description={t(`${T}.description`)}
      crumbs="auto"
      primary={
        atLimit
          ? { label: t(`${T}.actions.add`), icon: Plus, disabled: true, onClick: () => undefined, testId: 'supplier-service-add' }
          : { label: t(`${T}.actions.add`), icon: Plus, to: NEW_SERVICE_PATH, testId: 'supplier-service-add' }
      }
      secondary={[
        { label: t(`${T}.actions.previewAll`), icon: Eye, to: bookingPreviewPath() },
        { label: t(`${T}.actions.showcase`), icon: Store, to: SHOWCASE_PATH },
      ]}
    />
  );

  // A failed read that leaves the services of an earlier one on screen does not take them away.
  if (isError && !data) {
    return (
      <div className="min-w-0 space-y-6" data-testid="supplier-services-page">
        {header}
        <ErrorState testId="supplier-services-error" title={t(`${T}.list.loadError`)} error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6" data-testid="supplier-services-page">
      {header}

      {atLimit ? (
        <Alert variant="info" data-testid="supplier-services-limit">
          {t(`${T}.list.limitReached`, { max: limit })}
        </Alert>
      ) : null}

      {data && data.items.length === 0 ? (
        <EmptyCatalog />
      ) : (
        <ListView list={list} rows={data?.items ?? []} isLoading={isLoading || !data} testId="supplier-services-list" />
      )}

      {actions.deleteDialog}
    </div>
  );
}
