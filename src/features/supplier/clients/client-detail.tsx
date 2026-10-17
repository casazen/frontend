import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Mail, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { useSupplierClient } from '@/queries/use-supplier-clients';
import type { ServiceRequestStatus } from '@/types/service-request';
import type { SupplierClient, SupplierClientJob } from '@/types/supplier-clients';
import { requestPath } from '../requests/request-model';
import { formatMoney } from '../services/lib/service-money';
import { clientDay, clientRequestsPath, hasContact } from './clients-model';

function Fact({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-foreground/70">{label}</dt>
      <dd className="mt-1 break-words font-semibold">{value}</dd>
      {note ? <dd className="break-words text-sm text-foreground/70">{note}</dd> : null}
    </div>
  );
}

function JobRow({ job }: { job: SupplierClientJob }) {
  const { t, i18n } = useTranslation();
  const when = job.scheduledStart
    ? formatRomeDateTime(job.scheduledStart, i18n.language, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <li>
      <Link
        to={requestPath(job.requestId)}
        className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md py-2 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid={`supplier-client-job-${job.requestId}`}
      >
        <span className="min-w-0">
          <span className="block break-words font-medium">{job.serviceName?.trim() || getServiceCategoryLabel(job.category, t)}</span>
          <span className="block break-words text-sm text-foreground/70">
            {[when, job.amountCents !== null && job.amountCents !== undefined ? formatMoney(job.amountCents, i18n.language) : t('supplier.requests.facts.priceTbd')]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <StatusBadge kind="request" status={job.status as ServiceRequestStatus} perspective="supplier" />
      </Link>
    </li>
  );
}

/**
 * One customer in the drawer of the list (SP-16b): what they did together, how to reach them (only once a job of theirs was taken, as the
 * API sends it: nothing here is made up or kept), their latest requests, each one click from its page, and the way to all their requests.
 * The row already holds the figures; the latest requests and the contact come from the detail, with their own loading and error.
 */
export function ClientDetail({ client }: { client: SupplierClient }) {
  const { t, i18n } = useTranslation();
  const detail = useSupplierClient(client.id);
  const shown: SupplierClient = detail.data ?? client;
  const contact = shown.contact;

  return (
    <div className="min-w-0 space-y-6" data-testid="supplier-client-detail">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4">
        <Fact
          label={t('supplier.clients.detail.jobs')}
          value={shown.jobsAccepted}
          note={t('supplier.clients.detail.jobsCompleted', { count: shown.jobsCompleted })}
        />
        <Fact label={t('supplier.clients.detail.paid')} value={formatMoney(shown.grossPaidCents, i18n.language)} />
        <Fact label={t('supplier.clients.detail.last')} value={clientDay(shown.lastJobAt, i18n.language) || t('supplier.clients.none')} />
        <Fact label={t('supplier.clients.detail.next')} value={clientDay(shown.nextJobAt, i18n.language) || t('supplier.clients.none')} />
      </dl>

      {!shown.anonymized ? (
        <PlainSection title={t('supplier.clients.detail.contact')} data-testid="supplier-client-contact">
          {hasContact(shown) && contact ? (
            <div className="space-y-1 text-sm">
              {contact.name?.trim() ? <p className="break-words font-medium">{contact.name}</p> : null}
              {contact.phone?.trim() ? (
                <div>
                  <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="inline-flex min-h-11 items-center gap-2 underline" data-testid="supplier-client-phone">
                    <Phone aria-hidden="true" className="size-4" />
                    {contact.phone}
                  </a>
                </div>
              ) : null}
              {contact.email?.trim() ? (
                <div className="min-w-0">
                  <a href={`mailto:${contact.email}`} className="inline-flex min-h-11 max-w-full items-center gap-2 break-all underline" data-testid="supplier-client-email">
                    <Mail aria-hidden="true" className="size-4 shrink-0" />
                    {contact.email}
                  </a>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="flex items-start gap-2 text-sm text-foreground/70" data-testid="supplier-client-contact-hidden">
              <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{t('supplier.clients.detail.contactAfterTake')}</span>
            </p>
          )}
        </PlainSection>
      ) : null}

      <PlainSection title={t('supplier.clients.detail.recent')} data-testid="supplier-client-recent">
        {detail.isLoading ? (
          <SkeletonLine lines={3} label={t('supplier.clients.detail.recentLoading')} />
        ) : detail.isError ? (
          <div className="flex flex-wrap items-center gap-3 text-sm" role="alert" data-testid="supplier-client-recent-error">
            <span>{t('supplier.clients.detail.recentError')}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void detail.refetch()}>
              {t('supplier.retry')}
            </Button>
          </div>
        ) : detail.data && detail.data.recentJobs.length > 0 ? (
          <ul className="divide-y">{detail.data.recentJobs.map((job) => <JobRow key={job.requestId} job={job} />)}</ul>
        ) : (
          <p className="text-sm text-foreground/70">{t('supplier.clients.detail.recentNone')}</p>
        )}
      </PlainSection>

      <Button asChild variant="outline" className="min-h-11">
        <Link to={clientRequestsPath(client.id)} data-testid="supplier-client-requests-link">
          {t('supplier.clients.requests')}
        </Link>
      </Button>
    </div>
  );
}
