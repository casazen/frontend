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
import { todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import type { Guest } from '@/types';
import { GdprTab } from './components/gdpr-tab';
import { GuestDataTab } from './components/guest-data-tab';
import { GuestDocumentsTab } from './components/guest-documents-tab';
import { GuestStayFocus } from './components/guest-stay-focus';
import { GuestStaysTab } from './components/guest-stays-tab';
import { focusStayOf } from './lib/guest-stays';

const GUESTS_PATH = '/app/short-rent/guests';

/** Values of `?tab=` on the guest's page; an unknown one opens the first. */
const PANELS = ['details', 'stays', 'documents', 'privacy'] as const;
type GuestPanel = (typeof PANELS)[number];
const panelOf = (value: string | null): GuestPanel => PANELS.find((panel) => panel === value) ?? 'details';

/** The page while the guest loads: the shape of the page, no spinner in the middle of nothing. */
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

/**
 * Whether the guest's document is on file, from what the guest record already says (a document number or a scan). It says
 * nothing about it being checked: there is no such state in the data, and none is made up.
 */
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

/**
 * `/app/short-rent/guests/:id`: one guest (SR-04b, a restyling: same data, same endpoints, same privacy). The header says who
 * the guest is, how to reach them and whether a document is on file; under it the one highlighted block, the stay that matters
 * now with the way to its booking, and then the tabs Dati dell'ospite, Soggiorni, Documenti and Privacy, each made of sections
 * without a box. The tab is in the address (`?tab=`).
 */
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

  // The bookings of the guest change on other screens (arrival, cancellation): read them again when the page is opened.
  const staysQuery = useQuery({
    queryKey: ['bookings', { guestId: id }],
    queryFn: () => bookingsApi.getByGuestId(id!),
    enabled: !!id,
    refetchOnMount: true,
  });

  if (isLoading) {
    return <GuestDetailSkeleton label={t('guests.detailPage.loading')} />;
  }

  // An API error is never shown as "not found" (only a 404 is).
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
  const focus = focusStayOf(stays, todayInRome());
  const fullName = `${guest.firstName} ${guest.lastName}`.trim() || t('guests.detailPage.fallbackTitle');
  // The line under the name: how to reach the guest (both are on the Dati dell'ospite tab too).
  const contacts = [guest.email, guest.phoneNumber].filter(Boolean).join(' · ');

  // The test ids are how the end-to-end tests and the tests reach the tabs.
  const tabs: TabItem<GuestPanel>[] = [
    { value: 'details', label: t('guests.detailPage.tabs.details'), testId: 'guest-tab-details' },
    { value: 'stays', label: t('guests.detailPage.tabs.stays'), testId: 'guest-tab-stays' },
    { value: 'documents', label: t('guests.detailPage.tabs.documents'), testId: 'guest-tab-documents' },
    { value: 'privacy', label: t('guests.detailPage.tabs.privacy'), testId: 'guest-tab-privacy' },
  ];

  return (
    <AppShell>
      <div className="min-w-0 space-y-6">
        {/* The trail (Affitti brevi › Ospiti › this guest) and, on a phone, the link back to the list as the user left it (UI-05). */}
        <PageHeader
          crumbs="auto"
          title={fullName}
          description={contacts || undefined}
          action={<GuestDocumentStatus onFile={hasDocumentOnFile(guest)} />}
        />

        {staysQuery.isLoading ? (
          <div role="status" aria-busy="true" data-testid="guest-stay-focus-loading">
            <span className="sr-only">{t('shared.loading.srOnly')}</span>
            <Skeleton aria-hidden="true" className="h-36 w-full rounded-xl motion-reduce:animate-none" />
          </div>
        ) : focus ? (
          <GuestStayFocus stay={focus} />
        ) : null}

        {/* UI-07 Tabs: links with the tab in the address (`?tab=`), a menu on a phone. */}
        <Tabs label={t('guests.detailPage.tabsLabel')} items={tabs} defaultValue="details" value={activeTab} selectTestId="guest-tabs-select">
          {activeTab === 'details' && <GuestDataTab guest={guest} />}

          {activeTab === 'stays' && (
            <GuestStaysTab
              stays={stays}
              isLoading={staysQuery.isLoading}
              isError={staysQuery.isError}
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
