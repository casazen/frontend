import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { FocusBlock, PlainSection } from '@/components/shared/calm';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Skeleton, SkeletonLine } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { cn, formatCurrency } from '@/lib/utils';
import { todayInRome } from '@/lib/stay-dates';
import { useTenant } from '@/queries/use-long-rent-tenants';
import type { TenantDetail, TenantErasureResult } from '@/types';
import { leaseSheetPath } from '../lib/lease-next-step';
import { fullDay, monthName, monthOfDate, rentRegisterPath } from '../lib/rent-register';
import { LONG_RENT_TENANTS_PATH } from './paths';
import { TenantErasureResultDialog } from './tenant-erasure-result-dialog';
import { tenantCitizenshipText, tenantLeaseEndText, tenantName, tenantPaymentNote, tenantPunctualityDetail } from './tenant-format';
import { TenantPrivacySection } from './tenant-privacy';

/** The page while the person loads: the shape of the page, no spinner in the middle of nothing. */
function TenantSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="min-w-0 space-y-6" data-testid="tenant-loading">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-2/3 max-w-sm motion-reduce:animate-none" />
          <Skeleton className="h-4 w-1/2 max-w-xs motion-reduce:animate-none" />
        </div>
        <Skeleton className="h-28 w-full rounded-xl motion-reduce:animate-none" />
        <div className="space-y-2">
          <SkeletonLine />
          <SkeletonLine />
        </div>
      </div>
    </div>
  );
}

/** «Adesso», only when a rent of the person is late: the one thing on the sheet that cannot wait, with the way to the register where it is reminded. */
function LateRentBlock({ overdue }: { overdue: NonNullable<TenantDetail['overdue']> }) {
  const { t, i18n } = useTranslation();
  const month = monthOfDate(overdue.oldestDueDate);
  const currentMonth = monthOfDate(todayInRome());

  return (
    <FocusBlock
      tone="warning"
      kicker={t('longRentTenants.now.kicker')}
      title={t('longRentTenants.now.title', { month: monthName(month, i18n.language, false) })}
      body={t('longRentTenants.now.body', {
        count: overdue.count,
        amount: formatCurrency(overdue.amount),
        date: fullDay(overdue.oldestDueDate, i18n.language),
      })}
      who={t('longRentTenants.now.who')}
      when={t('longRentTenants.now.when', { count: overdue.daysOverdue })}
      primary={{ label: t('longRentTenants.now.action'), href: rentRegisterPath(month, currentMonth, 'overdue'), testId: 'tenant-late-rent-action' }}
      data-testid="tenant-late-rent"
    />
  );
}

/** One line of a list of the sheet: a title, a line under it, and what stands at the end. */
function Line({ title, sub, end, late }: { title: ReactNode; sub?: ReactNode; end?: ReactNode; late?: boolean }) {
  return (
    <li className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="break-words font-medium">{title}</p>
        {sub ? <p className={cn('break-words text-sm', late ? 'font-medium text-danger-foreground' : 'text-foreground/70')}>{sub}</p> : null}
      </div>
      {end ? <div className="min-w-0 sm:shrink-0">{end}</div> : null}
    </li>
  );
}

/**
 * `/app/long-rent/tenants/:id`: one person of the long-term area (LR-09). The head says who they are; under it the one highlighted
 * block, only if a rent of theirs is late (it leads to the register of that month, where the reminder is sent); then the contact data as the
 * server masks them, the latest installments with how punctual they are, their leases, and, closed, «Privacy» with the copy of their
 * data and the request to erase them (for who may create a lease). A person who is not there (another org's, out of reach, or whose
 * data were erased) is told so. The answer to an erasure request stays in a window of its own, outside the states of the page: the
 * person may well disappear from the sheet the moment it is made.
 */
export function TenantDetailPage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const { hasPermission } = useWorkspace();
  const canManage = hasPermission('long-rent', 'lease.create');
  const { data, isLoading, isError, error, refetch } = useTenant(id);
  const [erased, setErased] = useState<TenantErasureResult | null>(null);

  let content: ReactNode;
  if (isLoading) {
    content = <TenantSkeleton label={t('longRentTenants.detail.loading')} />;
  } else if (isError && getHttpStatus(error) !== 404) {
    // An API error is never shown as "not found" (only a 404 is).
    content = (
      <div className="min-w-0 space-y-6">
        <PageHeader crumbs="auto" title={t('longRentTenants.detail.fallbackTitle')} />
        <ErrorState testId="tenant-load-error" title={t('longRentTenants.detail.loadError')} error={error} onRetry={() => void refetch()} />
      </div>
    );
  } else if (!data) {
    content = (
      <div className="min-w-0 space-y-6">
        <PageHeader crumbs="auto" title={t('longRentTenants.detail.fallbackTitle')} />
        <EmptyState
          icon={Users}
          title={t('longRentTenants.detail.notFound')}
          description={t('longRentTenants.detail.notFoundDescription')}
          action={{ label: t('longRentTenants.detail.backToList'), href: LONG_RENT_TENANTS_PATH }}
        />
      </div>
    );
  } else {
    const { tenant, payments, overdue, onTimeDays } = data;
    const currentMonth = monthOfDate(todayInRome());
    content = (
      <div className="min-w-0 space-y-8" data-testid="tenant-page">
        <PageHeader
          crumbs="auto"
          title={tenantName(tenant)}
          description={t('longRentTenants.detail.description', { citizenship: tenantCitizenshipText(tenant, t) })}
        />

        {overdue ? <LateRentBlock overdue={overdue} /> : null}

        <PlainSection title={t('longRentTenants.contacts.title')}>
          <dl className="space-y-3 text-sm">
            <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="shrink-0 text-foreground/70 sm:w-48">{t('longRentTenants.contacts.email')}</dt>
              <dd className="min-w-0 break-words font-medium" data-testid="tenant-email">
                {tenant.contactEmailMasked}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="shrink-0 text-foreground/70 sm:w-48">{t('longRentTenants.contacts.citizenship')}</dt>
              <dd className="min-w-0 break-words font-medium">{tenantCitizenshipText(tenant, t)}</dd>
            </div>
          </dl>
        </PlainSection>

        <PlainSection title={t('longRentTenants.payments.title')} actionLabel={t('longRentTenants.payments.all')} href={rentRegisterPath(currentMonth, currentMonth)}>
          <p className="text-sm text-foreground/70" data-testid="tenant-punctuality">
            {tenantPunctualityDetail(tenant.punctuality, onTimeDays, t)}
          </p>
          {payments.length > 0 ? (
            <ul role="list" className="divide-y divide-border border-y border-border" data-testid="tenant-payments">
              {payments.map((payment) => {
                const note = tenantPaymentNote(payment, t, i18n.language);
                return (
                  <Line
                    key={payment.id}
                    title={t('longRentTenants.payments.item', { month: monthName(monthOfDate(payment.dueDate), i18n.language), amount: formatCurrency(payment.amount) })}
                    sub={tenant.leases.length > 1 ? `${payment.propertyName} · ${note.text}` : note.text}
                    late={note.late}
                    end={<StatusBadge kind="rent" status={payment.isOverdue ? 'Overdue' : payment.status} />}
                  />
                );
              })}
            </ul>
          ) : null}
        </PlainSection>

        <PlainSection title={t('longRentTenants.leases.title')} count={tenant.leases.length}>
          <ul role="list" className="divide-y divide-border border-y border-border" data-testid="tenant-leases">
            {tenant.leases.map((lease) => (
              <Line
                key={lease.leaseId}
                title={
                  <Link to={leaseSheetPath(lease.leaseId)} className="rounded-sm hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {lease.propertyName}
                  </Link>
                }
                sub={[
                  lease.monthlyRent > 0 ? t('leases.monthlyRentValue', { amount: formatCurrency(lease.monthlyRent) }) : null,
                  tenantLeaseEndText(lease, t, i18n.language),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                end={lease.stage ? <StatusBadge kind="leaseStage" status={lease.stage} /> : undefined}
              />
            ))}
          </ul>
        </PlainSection>

        {canManage ? <TenantPrivacySection tenant={tenant} onErased={setErased} /> : null}
      </div>
    );
  }

  return (
    <>
      {content}
      <TenantErasureResultDialog result={erased} onClose={() => setErased(null)} />
    </>
  );
}
