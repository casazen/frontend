import { useMemo, useState } from 'react';
import { CalendarClock, Inbox } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ListView } from '@/components/shared/list-view/list-view';
import type { ListOption } from '@/components/shared/list-view/list-types';
import { useListState } from '@/components/shared/list-view/use-list-state';
import { Button } from '@/components/ui/button';
import { useListViewsScope } from '@/hooks/use-list-views-scope';
import { useSupplierServices } from '@/queries/use-supplier-services';
import { useSupplierInbox, useSupplierInboxCounts } from '@/queries/supplier/use-inbox';
import { useSupplierProfile } from '@/queries/supplier/use-profile';
import type { SupplierInboxTab, SupplierProfile } from '@/types/supplier';
import { clientNameMatches, requestPath } from './requests/request-model';
import './requests/supplier-request-drawer';
import { inboxParamsOf, startChipOf, useSupplierRequestsList } from './requests/supplier-requests-list';
import { useBulkAccept } from './requests/use-bulk-accept';
import { useRequestActions } from './requests/use-request-actions';

const PAGE_SIZE = 20;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHIP_TO_ANSWER: SupplierInboxTab = 'da-rispondere';

/** The comuni the supplier works in, for the filter: by ISTAT code where the official list has them, else as written. */
function comuneOptionsOf(profile: SupplierProfile | undefined): ListOption[] {
  if (!profile) return [];
  const chosen = (profile.operatingComuni ?? []).map((comune) => ({ value: comune.istatCode, label: comune.displayName || comune.name }));
  const named = new Set(chosen.map((option) => option.label.toLowerCase()));
  const written = (profile.comuni ?? []).filter((name) => name.trim() && !named.has(name.trim().toLowerCase())).map((name) => ({ value: name.trim(), label: name.trim() }));
  return [...chosen, ...written];
}

/**
 * The requests of the supplier (UI-14, SP-08b): one list on six tabs the server counts (da rispondere, in attesa del cliente, programmate,
 * da incassare, archivio, tutte), a search, the filters in a drawer and the saved views. The state is in the address; the server picks,
 * searches and pages the rows. A row opens in the drawer of the shell, and the one thing to do about it (accept, complete, remind the payer) is
 * on the row; the requests to answer can be accepted together. "Rispondi alla più urgente" is the one action of the page, and with nothing to
 * answer it is "Imposta la disponibilità". With `?clientId=` (from the page of the customers, SP-16b) the list holds only the requests of
 * that customer, and says so.
 *
 * The list opens on the requests to answer, or, with none, on the first tab that has something (`startChipOf`): the numbers decide it once,
 * when they first arrive, and the rows are not asked before that. The names of the customers cannot be searched by the server (they are
 * encrypted for the private ones, SP-D23): when the search finds no service or comune, the names are looked for among the requests of the
 * tab the console has loaded, and the page says so.
 */
export function SupplierInboxPage() {
  const { t } = useTranslation();
  const actions = useRequestActions();
  const counts = useSupplierInboxCounts();
  const [searchParams, setSearchParams] = useSearchParams();

  // Where the list starts: decided once, when the numbers first arrive (or fail), and then left alone, so that the tab a person is looking at
  // does not change under them when a request comes in. A tab named in the address needs no wait.
  const [startChip, setStartChip] = useState<SupplierInboxTab | null>(null);
  if (startChip === null && (counts.data || counts.isError)) setStartChip(startChipOf(counts.data));
  const waitingForStart = startChip === null && !searchParams.has('chip');

  const services = useSupplierServices();
  const profile = useSupplierProfile();
  const serviceOptions = useMemo<ListOption[]>(() => (services.data?.items ?? []).map((service) => ({ value: service.id, label: service.name })), [services.data]);
  const comuneOptions = useMemo(() => comuneOptionsOf(profile.data), [profile.data]);

  const baseList = useSupplierRequestsList(actions, { startChip: startChip ?? CHIP_TO_ANSWER, services: serviceOptions, comuni: comuneOptions });
  const bulk = useBulkAccept();
  const { state } = useListState(baseList);
  // Taking many at once is for the tab of the requests to answer, and not for a suspended supplier: no other tab has checkboxes.
  const list = useMemo(
    () => (state.chip === CHIP_TO_ANSWER && !actions.suspended ? { ...baseList, bulk: [bulk.action] } : baseList),
    [baseList, state.chip, actions.suspended, bulk.action],
  );
  const viewsScope = useListViewsScope();

  const requestedClient = searchParams.get('clientId');
  const clientId = requestedClient && GUID.test(requestedClient) ? requestedClient : undefined;
  const params = inboxParamsOf(state, PAGE_SIZE, clientId);
  const inbox = useSupplierInbox(params, { enabled: !waitingForStart });

  // The search by name (SP-D23): only when the server found nothing for the text, the names are looked for among the requests of the tab as
  // they were loaded (the same page without the text: usually already in the cache).
  const text = state.q.trim();
  const serverFoundNothing = text.length >= 2 && inbox.isSuccess && !inbox.isPlaceholderData && inbox.data.total === 0;
  const loaded = useSupplierInbox({ ...params, q: undefined }, { enabled: !waitingForStart && serverFoundNothing });
  const byName = serverFoundNothing ? (loaded.data?.items ?? []).filter((request) => clientNameMatches(request, text)) : null;
  const rows = byName ?? inbox.data?.items ?? [];

  const c = counts.data;
  const toAnswer = c?.toAnswer ?? 0;
  // The server puts the request to answer first on top of its tab: the first row is the most urgent.
  const urgent = useSupplierInbox({ tab: CHIP_TO_ANSWER, page: 1, pageSize: 1 }, { enabled: toAnswer > 0 });
  const mostUrgent = toAnswer > 0 ? urgent.data?.items[0] : undefined;

  // A supplier who has no request at all gets what the requests are for, and not an empty table with filters.
  const nothingYet = c !== undefined && [c.toAnswer, c.awaitingCustomer, c.scheduled, c.toCollect, c.archive].every((n) => n === 0);
  const { icon: emptyIcon, ...empty } = list.empty;
  const primary = mostUrgent
    ? { label: t('supplier.requests.answerUrgent'), icon: Inbox, to: requestPath(mostUrgent.id), testId: 'supplier-inbox-urgent' }
    : c !== undefined && !nothingYet && toAnswer === 0
      ? { label: t('supplier.requests.empty.availability'), icon: CalendarClock, to: '/app/supplier/availability', testId: 'supplier-inbox-availability' }
      : undefined;

  return (
    <div className="min-w-0 space-y-6" data-testid="supplier-inbox-page">
      <PageHeader title={t('supplier.requests.title')} description={t('supplier.requests.description')} crumbs="auto" primary={primary} />

      {nothingYet ? (
        <div className="rounded-xl bg-card p-2 shadow-sm ring-1 ring-inset ring-border" data-testid="supplier-inbox-empty">
          <EmptyState icon={emptyIcon ?? Inbox} {...empty} />
        </div>
      ) : (
        <>
          {clientId ? (
            <div className="flex flex-wrap items-center gap-3 text-sm" data-testid="supplier-inbox-client-filter">
              <span>{t('supplier.requests.clientFilter.note')}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSearchParams(
                    (current) => {
                      current.delete('clientId');
                      return current;
                    },
                    { replace: true },
                  )
                }
              >
                {t('supplier.requests.clientFilter.clear')}
              </Button>
            </div>
          ) : null}
          {byName && byName.length > 0 ? (
            <p className="text-sm text-foreground/70" data-testid="supplier-inbox-name-search">
              {t('supplier.requests.list.nameSearch', { text })}
            </p>
          ) : null}
          <ListView
            list={list}
            mode="server"
            rows={rows}
            totalCount={byName ? byName.length : inbox.data?.total}
            pageSize={PAGE_SIZE}
            isLoading={waitingForStart || inbox.isLoading || (serverFoundNothing && loaded.isLoading)}
            isRefreshing={inbox.isPlaceholderData}
            isError={inbox.isError && !inbox.isLoading}
            error={inbox.error}
            errorTitle={t('supplier.requests.list.loadError')}
            onRetry={() => void inbox.refetch()}
            chipCounts={{
              'da-rispondere': c?.toAnswer,
              'in-attesa': c?.awaitingCustomer,
              programmate: c?.scheduled,
              'da-incassare': c?.toCollect,
              archivio: c?.archive,
            }}
            viewsScope={viewsScope}
            testId="supplier-inbox-list"
          />
        </>
      )}

      {actions.dialog}
      {bulk.dialog}
    </div>
  );
}
