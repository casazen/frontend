import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CircleDashed, IdCard, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { guestsApi } from '@/api/guests.api';
import { asBookingPage, bookingsApi } from '@/api/bookings.api';
import { getHttpStatus } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import type { Guest } from '@/types';
import { GdprTab } from './components/gdpr-tab';
import { GuestDataTab } from './components/guest-data-tab';
import { GuestDocumentsTab } from './components/guest-documents-tab';
import { GuestStaysTab } from './components/guest-stays-tab';

const GUESTS_PATH = '/app/short-rent/guests';

const PANELS = ['details', 'stays', 'documents', 'privacy'] as const;
type GuestPanel = (typeof PANELS)[number];
const panelOf = (value: string | null): GuestPanel => PANELS.find((panel) => panel === value) ?? 'details';

function GuestDetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="min-w-0 space-y-6" data-testid="guest-detail-loading">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-2/3 max-w-sm motion-reduce:animate-none" />
          <Skeleton className="h-4 w-1/2 max-w-xs motion-reduce:animate-none" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl motion-reduce:animate-none" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full motion-reduce:animate-none" />
          <Skeleton className="h-4 w-11/12 motion-reduce:animate-none" />
          <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}

function GuestDocumentStatus({ onFile }: { onFile: boolean }) {
  const { t } = useTranslation();
  const Icon = onFile ? IdCard : CircleDashed;

  return (
    <span
      data-testid="guest-document-status"
      data-on-file={onFile}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset',
        STATUS_TONE_CLASSES[onFile ? 'success' : 'neutral'],
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 break-words">{t(onFile ? 'guests.detailPage.documentOnFile' : 'guests.detailPage.documentMissing')}</span>
    </span>
  );
}

const hasDocumentOnFile = (guest: Guest) => Boolean(guest.documentNumberMasked) || guest.hasDocumentScan;

export function GuestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const activeTab = panelOf(searchParams.get('tab'));

  const {
    data: guest,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['guests', id],
    queryFn: () => guestsApi.getById(id!),
    enabled: !!id,
  });

  const staysQuery = useQuery({
    queryKey: ['bookings', { guestId: id }],
    queryFn: () => bookingsApi.getByGuestId(id!),
    enabled: !!id && !!guest && activeTab === 'stays',
    refetchOnMount: true,
  });

  if (isLoading) {
    return <GuestDetailSkeleton label={t('guests.detailPage.loading')} />;
  }

  if (isError && getHttpStatus(error) !== 404) {
    return (
      <AppShell>
        <div className="min-w-0 space-y-6">
          <PageHeader crumbs="auto" title={t('guests.detailPage.fallbackTitle')} />
          <ErrorState testId="guest-load-error" title={t('guests.detailPage.loadError')} error={error} onRetry={() => void refetch()} />
        </div>
      </AppShell>
    );
  }

  if (!guest) {
    return (
      <AppShell>
        <div className="min-w-0 space-y-6">
          <PageHeader crumbs="auto" title={t('guests.detailPage.fallbackTitle')} />
          <EmptyState
            icon={Users}
            title={t('guests.notFound')}
            description={t('guests.notFoundDescription')}
            action={{ label: t('guests.backToGuests'), href: GUESTS_PATH }}
          />
        </div>
      </AppShell>
    );
  }

  const stays = asBookingPage(staysQuery.data).items;
  const fullName = `${guest.firstName} ${guest.lastName}`.trim() || t('guests.detailPage.fallbackTitle');
  const contacts = [guest.email, guest.phoneNumber].filter(Boolean).join(' · ');

  const tabs: TabItem<GuestPanel>[] = [
    { value: 'details', label: t('guests.detailPage.tabs.details'), testId: 'guest-tab-details' },
    { value: 'stays', label: t('guests.detailPage.tabs.stays'), testId: 'guest-tab-stays' },
    { value: 'documents', label: t('guests.detailPage.tabs.documents'), testId: 'guest-tab-documents' },
    { value: 'privacy', label: t('guests.detailPage.tabs.privacy'), testId: 'guest-tab-privacy' },
  ];

  return (
    <AppShell>
      <div className="min-w-0 space-y-6">
        <PageHeader
          crumbs="auto"
          title={fullName}
          description={contacts || undefined}
          action={<GuestDocumentStatus onFile={hasDocumentOnFile(guest)} />}
        />

        <Tabs label={t('guests.detailPage.tabsLabel')} items={tabs} defaultValue="details" value={activeTab} selectTestId="guest-tabs-select">
          {activeTab === 'details' && <GuestDataTab guest={guest} />}

          {activeTab === 'stays' && (
            <GuestStaysTab
              stays={stays}
              isLoading={staysQuery.isLoading}
              isError={staysQuery.isError && staysQuery.data === undefined}
              error={staysQuery.error}
              onRetry={() => void staysQuery.refetch()}
            />
          )}

          {activeTab === 'documents' && <GuestDocumentsTab guest={guest} />}

          {activeTab === 'privacy' && <GdprTab guest={guest} />}
        </Tabs>
      </div>
    </AppShell>
  );
}
