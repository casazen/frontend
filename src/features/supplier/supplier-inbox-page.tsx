import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays, ChevronRight, MapPin } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useSupplierInbox } from '@/queries/use-supplier';
import {
  useCompleteServiceRequest,
  useRejectServiceRequest,
  useTakeServiceRequest,
} from '@/queries/use-service-requests';
import { getProblemMessage } from '@/lib/api-errors';
import { getServiceCategoryLabel, getServiceRequestStatusLabel } from '@/lib/i18n-labels';
import { formatStayDate, romeDateOf } from '@/lib/stay-dates';
import type { SupplierServiceRequest } from '@/types/service-request';
import type { SupplierInboxParams, SupplierInboxStatus } from '@/types/supplier';
import { RejectServiceRequestDialog } from './components/reject-service-request-dialog';

const PAGE_SIZE = 20;
type InboxTab = 'open' | 'history';
const HISTORY_STATUSES: SupplierInboxStatus[] = ['history', 'Completato', 'Pagato', 'Rifiutato'];
const INBOX_TABS: { value: InboxTab; labelKey: string }[] = [
  { value: 'open', labelKey: 'supplier.inbox.tabOpen' },
  { value: 'history', labelKey: 'supplier.inbox.tabHistory' },
];

/** Date shown on a card: the day of the job when there is one, the activity date in the history. */
function ActivityLine({ item, tab }: { item: SupplierServiceRequest; tab: InboxTab }) {
  const { t, i18n } = useTranslation();
  const format = (instant: string | null | undefined) => formatStayDate(romeDateOf(instant), i18n.language);
  const parts: ReactNode[] = [
    <span key="city" className="inline-flex items-center gap-1" data-testid={`inbox-city-${item.id}`}>
      <MapPin className="h-3.5 w-3.5" />
      {item.postalCode ? `${item.city} (${item.postalCode})` : item.city}
    </span>,
    <span key="day" className="inline-flex items-center gap-1" data-testid={`inbox-day-${item.id}`}>
      <CalendarDays className="h-3.5 w-3.5" />
      {item.scheduledFor
        ? t('supplier.inbox.dayOf', { date: formatStayDate(item.scheduledFor, i18n.language) })
        : t('supplier.inbox.noDate')}
    </span>,
  ];
  if (tab === 'history') {
    const activity =
      item.status === 'Rifiutato'
        ? t('supplier.inbox.rejectedOn', { date: format(item.updatedAt) })
        : t('supplier.inbox.completedOn', { date: format(item.completedAt ?? item.createdAt) });
    parts.push(<span key="activity">{activity}</span>);
  } else {
    parts.push(<span key="received">{t('supplier.inbox.receivedOn', { date: format(item.createdAt) })}</span>);
  }
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{parts}</div>;
}

function InboxCard({
  item,
  tab,
  actions,
}: {
  item: SupplierServiceRequest;
  tab: InboxTab;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Card data-testid={`inbox-item-${item.id}`}>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{item.propertyName}</span>
          <Badge variant="secondary">{getServiceCategoryLabel(item.category, t)}</Badge>
          <Badge>{getServiceRequestStatusLabel(item.status, t)}</Badge>
        </div>
        <ActivityLine item={item} tab={tab} />
        {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <Button size="sm" variant="ghost" asChild>
            <Link to={`/app/supplier/inbox/${item.id}`} data-testid={`open-${item.id}`}>
              {t('supplier.inbox.details')}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InboxList({
  params,
  tab,
  enabled,
  onPage,
  renderActions,
}: {
  params: SupplierInboxParams;
  tab: InboxTab;
  enabled: boolean;
  onPage: (page: number) => void;
  renderActions?: (item: SupplierServiceRequest) => ReactNode;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useSupplierInbox(params, { enabled });

  if (!enabled) return null;

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="supplier-inbox-loading" aria-busy="true" aria-label={t('supplier.inbox.loading')}>
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-destructive/40" role="alert" data-testid="supplier-inbox-error">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="flex-1 text-sm text-destructive">{getProblemMessage(error, t) ?? t('supplier.inbox.loadError')}</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            {t('supplier.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (data.items.length === 0) {
    return (
      <Card data-testid="supplier-inbox-empty">
        <CardContent className="py-8 text-center text-muted-foreground">
          {tab === 'open' ? t('supplier.inbox.emptyOpen') : t('supplier.inbox.emptyHistory')}
        </CardContent>
      </Card>
    );
  }

  const page = data.page || params.page || 1;
  const pages = Math.max(1, Math.ceil(data.total / (data.pageSize || PAGE_SIZE)));
  return (
    <div className="space-y-4">
      {data.items.map((item) => (
        <InboxCard key={item.id} item={item} tab={tab} actions={renderActions?.(item)} />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm" data-testid="supplier-inbox-pagination">
        <span className="text-muted-foreground" data-testid="supplier-inbox-page-info">
          {t('supplier.inbox.pageInfo', { page, pages })} · {t('supplier.inbox.total', { count: data.total })}
        </span>
        {pages > 1 && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)} data-testid="supplier-inbox-prev">
              {t('supplier.inbox.previous')}
            </Button>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)} data-testid="supplier-inbox-next">
              {t('supplier.inbox.next')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Supplier inbox (SU-08, A4-14): the open requests with their quick actions, and the history (completed, paid,
 * rejected) filtered by status and Europe/Rome period, both paginated by the server. Each request opens its detail.
 */
export function SupplierInboxPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<InboxTab>('open');
  const [openPage, setOpenPage] = useState(1);
  const [historyStatus, setHistoryStatus] = useState<SupplierInboxStatus>('history');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const takeMutation = useTakeServiceRequest();
  const completeMutation = useCompleteServiceRequest();
  const rejectMutation = useRejectServiceRequest();

  const periodInvalid = !!from && !!to && from > to;

  const openActions = (item: SupplierServiceRequest) => {
    if (item.status === 'Richiesto') {
      return (
        <>
          <Button size="sm" onClick={() => takeMutation.mutate(item.id)} disabled={takeMutation.isPending} data-testid={`take-${item.id}`}>
            {t('serviceRequest.take')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRejectId(item.id)} data-testid={`reject-${item.id}`}>
            {t('serviceRequest.reject')}
          </Button>
        </>
      );
    }
    if (item.status === 'PresoInCarico' || item.status === 'InCorso') {
      return (
        <Button
          size="sm"
          onClick={() => completeMutation.mutate({ id: item.id })}
          disabled={completeMutation.isPending}
          data-testid={`complete-${item.id}`}
        >
          {t('serviceRequest.complete')}
        </Button>
      );
    }
    return null;
  };


  return (
    <div className="space-y-6" data-testid="supplier-inbox-page">
      <PageHeader title={t('supplier.inboxTitle')} description={t('supplier.inboxDescription')} />

      <div className="inline-flex rounded-lg bg-muted p-1" role="tablist" aria-label={t('supplier.inbox.tabsLabel')}>
        {INBOX_TABS.map(({ value, labelKey }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === value ? 'bg-background shadow' : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid={`supplier-inbox-tab-${value}`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {tab === 'open' ? (
        <InboxList
          params={{ status: 'open', page: openPage, pageSize: PAGE_SIZE }}
          tab="open"
          enabled
          onPage={setOpenPage}
          renderActions={openActions}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3" data-testid="supplier-inbox-filters">
            <div className="space-y-1">
              <Label htmlFor="supplier-inbox-status">{t('supplier.inbox.statusFilter')}</Label>
              <select
                id="supplier-inbox-status"
                value={historyStatus}
                onChange={(e) => {
                  setHistoryStatus(e.target.value as SupplierInboxStatus);
                  setHistoryPage(1);
                }}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="supplier-inbox-status"
              >
                {HISTORY_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value === 'history' ? t('supplier.inbox.statusAllHistory') : getServiceRequestStatusLabel(value, t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="supplier-inbox-from">{t('supplier.inbox.from')}</Label>
              <Input
                id="supplier-inbox-from"
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setHistoryPage(1);
                }}
                className="h-9 w-40"
                data-testid="supplier-inbox-from"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="supplier-inbox-to">{t('supplier.inbox.to')}</Label>
              <Input
                id="supplier-inbox-to"
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setHistoryPage(1);
                }}
                className="h-9 w-40"
                data-testid="supplier-inbox-to"
              />
            </div>
            {(from || to || historyStatus !== 'history') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setHistoryStatus('history');
                  setFrom('');
                  setTo('');
                  setHistoryPage(1);
                }}
                data-testid="supplier-inbox-clear"
              >
                {t('supplier.inbox.clearFilters')}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t('supplier.inbox.periodHint')}</p>
          {periodInvalid && (
            <p className="text-sm text-destructive" role="alert" data-testid="supplier-inbox-period-invalid">
              {t('supplier.inbox.periodInvalid')}
            </p>
          )}
          <InboxList
            params={{ status: historyStatus, from: from || undefined, to: to || undefined, page: historyPage, pageSize: PAGE_SIZE }}
            tab="history"
            enabled={!periodInvalid}
            onPage={setHistoryPage}
          />
        </div>
      )}

      {rejectId && (
        <RejectServiceRequestDialog
          key={rejectId}
          open
          isPending={rejectMutation.isPending}
          onCancel={() => setRejectId(null)}
          onConfirm={(reason) => rejectMutation.mutate({ id: rejectId, reason }, { onSuccess: () => setRejectId(null) })}
        />
      )}
    </div>
  );
}
