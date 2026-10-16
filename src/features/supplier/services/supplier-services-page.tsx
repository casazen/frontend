import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Eye, ImageOff, LayoutGrid, List, ListChecks, Pause, Pencil, Plus, Store, Tag, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { ListRowActions } from '@/components/shared/list-view/list-row-actions';
import type { ListMenuEntry, ListRowAction } from '@/components/shared/list-view/list-types';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Alert } from '@/components/ui/alert';
import { DataView, type DataColumn } from '@/components/ui/data-view';
import { Segmented } from '@/components/ui/segmented';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { isDisplayableMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import { useSupplierServices } from '@/queries/use-supplier-services';
import { SUPPLIER_SERVICE_STATUSES, type SupplierService, type SupplierServiceStatus } from '@/types/supplier-services';
import { formatDuration, formatPrice } from './lib/service-labels';
import { SERVICE_LIMITS } from './lib/service-limits';
import {
  NEW_SERVICE_PATH,
  SHOWCASE_PATH,
  bookingPreviewPath,
  draftPath,
  duplicatePath,
  servicePath,
} from './lib/service-paths';
import { useServiceActions, type ServiceActions } from './use-service-actions';

const T = 'supplier.services';

type StatusFilter = 'all' | SupplierServiceStatus;
type View = 'cards' | 'table';

function readFilter(value: string | null): StatusFilter {
  return SUPPLIER_SERVICE_STATUSES.find((status) => status === value) ?? 'all';
}

/** What the card and the row say about a service that is not ready to be on offer yet, in words ("Prezzo, Durata"). */
function useMissingNames(service: SupplierService): string {
  const { t } = useTranslation();
  const keys = service.missingForPublication.map((field) =>
    field === 'priceFromCents' ? 'price' : field === 'durationMinutes' ? 'duration' : field,
  );
  return keys.map((key) => t(`${T}.fields.${key}`)).join(', ');
}

/** The one action of a row, by state, and the others in "⋯": the same on a card, in the table and on a phone. */
function useRowActions(service: SupplierService, actions: ServiceActions, atLimit: boolean) {
  const { t } = useTranslation();
  const primary: ListRowAction | null =
    service.status === 'Draft'
      ? { id: 'continue', label: t(`${T}.actions.continue`), icon: Pencil, href: draftPath(service.id), variant: 'secondary', testId: 'service-continue' }
      : service.status === 'Paused'
        ? { id: 'reactivate', label: t(`${T}.actions.reactivate`), icon: Check, variant: 'secondary', onSelect: () => void actions.publishService(service), testId: 'service-reactivate' }
        : null;

  const toggle: ListRowAction | null =
    service.status === 'Active'
      ? { id: 'pause', label: t(`${T}.actions.pause`), icon: Pause, onSelect: () => void actions.pauseService(service), testId: 'service-pause' }
      : service.status === 'Draft' && service.publishable
        ? { id: 'publish', label: t(`${T}.actions.publish`), icon: Check, onSelect: () => void actions.publishService(service), testId: 'service-publish' }
        : null;

  const menu: ListMenuEntry[] = [
    { id: 'edit', label: t(`${T}.actions.edit`), icon: Pencil, href: servicePath(service.id), testId: 'service-edit' },
    { id: 'preview', label: t(`${T}.actions.preview`), icon: Eye, href: bookingPreviewPath(service.id), testId: 'service-preview' },
    { id: 'duplicate', label: t(`${T}.actions.duplicate`), icon: Copy, href: atLimit ? undefined : duplicatePath(service.id), disabled: atLimit, testId: 'service-duplicate' },
    'separator',
    ...(toggle ? [toggle] : []),
    { id: 'delete', label: t(`${T}.actions.delete`), icon: Trash2, danger: true, onSelect: () => actions.askDelete(service), testId: 'service-delete' },
  ];
  return { primary, menu };
}

/** "da 45 € a intervento · 2 h": what the supplier asks and for how long, in one line. */
function useServiceLine(service: SupplierService): string {
  const { t, i18n } = useTranslation();
  return [formatPrice(service, t, i18n.language), formatDuration(service.durationMinutes, t)].join(' · ');
}

function ServiceThumb({ service, className }: { service: SupplierService; className?: string }) {
  const cover = service.photoUrls.find(isDisplayableMediaUrl);
  return (
    <div className={className}>
      {cover ? (
        <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-foreground/60">
          <ImageOff aria-hidden="true" className="size-6" />
        </div>
      )}
    </div>
  );
}

function ServiceCard({ service, actions, atLimit }: { service: SupplierService; actions: ServiceActions; atLimit: boolean }) {
  const { t } = useTranslation();
  const line = useServiceLine(service);
  const missing = useMissingNames(service);
  const { primary, menu } = useRowActions(service, actions, atLimit);

  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-inset ring-border" data-testid={`supplier-service-${service.id}`}>
      <Link to={servicePath(service.id)} className="flex min-w-0 flex-1 gap-3 p-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-col sm:gap-0 sm:p-0">
        <ServiceThumb service={service} className="aspect-square size-24 shrink-0 overflow-hidden rounded-md bg-muted sm:aspect-[4/3] sm:size-auto sm:w-full sm:rounded-none" />
        <span className="flex min-w-0 flex-1 flex-col gap-1 sm:p-4">
          <span className="break-words font-semibold leading-snug">{service.name}</span>
          <span className="break-words text-sm">{line}</span>
          <span className="break-words text-sm text-foreground/70">{getServiceCategoryLabel(service.category, t)}</span>
          {service.status === 'Draft' && missing ? <span className="break-words text-sm text-foreground/70">{t(`${T}.list.missing`, { fields: missing })}</span> : null}
        </span>
      </Link>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 pb-3 sm:pt-1">
        <StatusBadge kind="serviceListing" status={service.status} />
        <ListRowActions primary={primary} menu={menu} name={service.name} card />
      </div>
    </li>
  );
}

function ServiceRowActions({ service, actions, atLimit, card = false }: { service: SupplierService; actions: ServiceActions; atLimit: boolean; card?: boolean }) {
  const { primary, menu } = useRowActions(service, actions, atLimit);
  return <ListRowActions primary={primary} menu={menu} name={service.name} card={card} />;
}

function ServiceNameCell({ service, card = false }: { service: SupplierService; card?: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <Link
        to={servicePath(service.id)}
        className={cn(
          'font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          // In a card the name is the way into the service: a line of text is 21 px, a finger needs 44.
          card && 'inline-flex min-h-11 items-center',
        )}
      >
        {service.name}
      </Link>
      <span className="block text-sm font-normal text-foreground/70">{getServiceCategoryLabel(service.category, t)}</span>
    </>
  );
}

function ServicePriceCell({ service }: { service: SupplierService }) {
  const { t, i18n } = useTranslation();
  return <span className="font-medium text-foreground">{formatPrice(service, t, i18n.language)}</span>;
}

function ServiceDurationCell({ service }: { service: SupplierService }) {
  const { t } = useTranslation();
  return <>{formatDuration(service.durationMinutes, t)}</>;
}

/** On a phone a row of the table is a card: name, price and state, and what to do about it. */
function ServiceTableCard({ service, actions, atLimit }: { service: SupplierService; actions: ServiceActions; atLimit: boolean }) {
  const line = useServiceLine(service);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <ServiceNameCell service={service} card />
        </div>
        <StatusBadge kind="serviceListing" status={service.status} className="shrink-0" />
      </div>
      <p className="break-words text-sm">{line}</p>
      <ServiceRowActions service={service} actions={actions} atLimit={atLimit} card />
    </div>
  );
}

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
 * Servizi e prezzi (SP-06): the catalog of the supplier, as cards with the cover photo or as a table, filtered by state. Each
 * service has the one thing to do about it by state (go on with a draft, put a paused one back on offer) and the rest in "⋯":
 * edit, see how customers see it, duplicate, pause or publish, delete. 30 services at most, so it is one request and no paging.
 */
export function SupplierServicesPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const { data, isLoading, isError, error, refetch } = useSupplierServices();
  const actions = useServiceActions();
  const filter = readFilter(params.get('stato'));
  const view: View = params.get('vista') === 'tabella' ? 'table' : 'cards';

  const change = (next: { stato?: StatusFilter; vista?: View }) => {
    setParams(
      (previous) => {
        const query = new URLSearchParams(previous);
        const stato = next.stato ?? filter;
        const vista = next.vista ?? view;
        if (stato === 'all') query.delete('stato');
        else query.set('stato', stato);
        if (vista === 'table') query.set('vista', 'tabella');
        else query.delete('vista');
        return query;
      },
      { replace: true },
    );
  };

  const header = (atLimit: boolean) => (
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

  if (isError) {
    return (
      <div className="min-w-0 space-y-6" data-testid="supplier-services-page">
        {header(false)}
        <ErrorState testId="supplier-services-error" title={t(`${T}.list.loadError`)} error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (isLoading || !data) {
    return <LoadingScreen message={t(`${T}.list.loading`)} className="h-auto flex-1" />;
  }

  const limit = data.limit || SERVICE_LIMITS.maxServices;
  const atLimit = data.total >= limit;
  const counts = new Map<StatusFilter, number>([['all', data.items.length]]);
  for (const status of SUPPLIER_SERVICE_STATUSES) counts.set(status, data.items.filter((item) => item.status === status).length);
  const shown = filter === 'all' ? data.items : data.items.filter((item) => item.status === filter);
  const filterOption = (value: StatusFilter, label: string) => ({ value, label: `${label} (${counts.get(value) ?? 0})`, testId: `supplier-services-filter-${value}` });

  const columns: DataColumn<SupplierService>[] = [
    { key: 'name', header: t(`${T}.table.service`), rowHeader: true, cell: (service) => <ServiceNameCell service={service} /> },
    { key: 'price', header: t(`${T}.table.price`), cell: (service) => <ServicePriceCell service={service} /> },
    { key: 'duration', header: t(`${T}.table.duration`), cell: (service) => <ServiceDurationCell service={service} /> },
    { key: 'status', header: t(`${T}.table.status`), cell: (service) => <StatusBadge kind="serviceListing" status={service.status} /> },
  ];

  return (
    <div className="min-w-0 space-y-6" data-testid="supplier-services-page">
      {header(atLimit)}

      {atLimit ? (
        <Alert variant="info" data-testid="supplier-services-limit">
          {t(`${T}.list.limitReached`, { max: limit })}
        </Alert>
      ) : null}

      {data.items.length === 0 ? (
        <EmptyCatalog />
      ) : (
        <>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <Segmented<StatusFilter>
              label={t(`${T}.filters.label`)}
              value={filter}
              onValueChange={(stato) => change({ stato })}
              options={[
                filterOption('all', t(`${T}.filters.all`)),
                filterOption('Active', t(`${T}.filters.Active`)),
                filterOption('Paused', t(`${T}.filters.Paused`)),
                filterOption('Draft', t(`${T}.filters.Draft`)),
              ]}
              testId="supplier-services-filters"
            />
            <Segmented<View>
              label={t(`${T}.view.label`)}
              value={view}
              onValueChange={(vista) => change({ vista })}
              options={[
                { value: 'cards', label: t(`${T}.view.cards`), icon: LayoutGrid, testId: 'supplier-services-view-cards' },
                { value: 'table', label: t(`${T}.view.table`), icon: List, testId: 'supplier-services-view-table' },
              ]}
              testId="supplier-services-view"
            />
          </div>

          {shown.length === 0 ? (
            <div className="rounded-xl bg-card p-2 shadow-sm ring-1 ring-inset ring-border" data-testid="supplier-services-filter-empty">
              <EmptyState
                icon={ListChecks}
                title={t(`${T}.filters.emptyTitle`)}
                description={t(`${T}.filters.emptyDescription`)}
                action={{ label: t(`${T}.filters.showAll`), onClick: () => change({ stato: 'all' }) }}
              />
            </div>
          ) : view === 'cards' ? (
            <ul role="list" aria-label={t(`${T}.title`)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="supplier-services-cards">
              {shown.map((service) => (
                <ServiceCard key={service.id} service={service} actions={actions} atLimit={atLimit} />
              ))}
            </ul>
          ) : (
            <DataView<SupplierService>
              label={t(`${T}.title`)}
              rows={shown}
              rowKey={(service) => service.id}
              columns={columns}
              cardsUntil="lg"
              rowActions={(service) => <ServiceRowActions service={service} actions={actions} atLimit={atLimit} />}
              renderCard={(service) => <ServiceTableCard service={service} actions={actions} atLimit={atLimit} />}
              rowTestId={(service) => `supplier-service-${service.id}`}
              testId="supplier-services-table"
            />
          )}
        </>
      )}

      {actions.deleteDialog}
    </div>
  );
}
