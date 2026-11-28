import { useTranslation } from 'react-i18next';
import { ChevronRight, Tags, Eye, Plus, Store, Tag } from 'lucide-react';
import { ServicePageHeader } from '@/features/supplier/components/service-page-header';
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

/**
 * A catalog that is empty says what a service is and offers the way in: the button of the state, and the four steps of the creation one tap away
 * under «Come funziona» (a list that is always open is a form to look at before there is anything to do). The page's header has no «Aggiungi
 * servizio» then: the state carries the one button (UX round 3).
 */
function EmptyCatalog() {
  const { t } = useTranslation();
  const steps = ['service', 'price', 'booking', 'photos'] as const;
  return (
    <div data-testid="supplier-services-empty">
      <EmptyState
        icon={Tag}
        title={t(`${T}.empty.title`)}
        description={t(`${T}.empty.description`)}
        action={{ label: t(`${T}.actions.add`), href: NEW_SERVICE_PATH }}
        className="pb-4 pt-8"
      />
      <details className="group mx-auto mb-6 max-w-md px-4 text-sm" data-testid="supplier-services-how">
        <summary className="mx-auto flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 rounded-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <ChevronRight aria-hidden="true" className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
          {t(`${T}.empty.how`)}
        </summary>
        <ol className="mt-2 grid gap-2" aria-label={t(`${T}.empty.stepsLabel`)}>
          {steps.map((step, index) => (
            <li key={step} className="flex min-w-0 items-start gap-3">
              <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                {index + 1}
              </span>
              <span className="min-w-0 break-words">{t(`${T}.empty.steps.${step}`)}</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

export function SupplierServicesPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useSupplierServices();
  const actions = useServiceActions();
  const limit = data?.limit || SERVICE_LIMITS.maxServices;
  const atLimit = data !== undefined && data.total >= limit;
  const empty = data !== undefined && data.items.length === 0;
  const list = useServicesList({ atLimit, busy: actions.busy, onPublish: actions.publishService, onPause: actions.pauseService, onDelete: actions.askDelete });

  const header = (
    <ServicePageHeader
        icon={Tags}
      title={t(`${T}.title`)}
      description={t(`${T}.description`)}
      crumbs="auto"
      primary={
        empty
          ? undefined
          : atLimit
            ? { label: t(`${T}.actions.add`), icon: Plus, disabled: true, onClick: () => undefined, testId: 'supplier-service-add' }
            : { label: t(`${T}.actions.add`), icon: Plus, to: NEW_SERVICE_PATH, testId: 'supplier-service-add' }
      }
      secondary={[
        { label: t(`${T}.actions.previewAll`), icon: Eye, to: bookingPreviewPath() },
        { label: t(`${T}.actions.showcase`), icon: Store, to: SHOWCASE_PATH },
      ]}
    />
  );

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

      {empty ? (
        <EmptyCatalog />
      ) : (
        <ListView list={list} rows={data?.items ?? []} isLoading={isLoading || !data} testId="supplier-services-list" />
      )}

      {actions.deleteDialog}
    </div>
  );
}
