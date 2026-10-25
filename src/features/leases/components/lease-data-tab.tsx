import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { longRentPropertyPath } from '@/features/properties/long-rent/paths';
import { getLeasePartyRoleLabel, getLeaseTypeAndRegimeLabel } from '@/lib/i18n-labels';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { LeaseDetail } from '@/types';
import { isLeasePlaceholderDate, leasePropertyLine } from '../lib/lease-list-format';
import { leaseSheetPath } from '../lib/lease-next-step';
import { leaseTermEnd, leaseTermFacts } from '../lifecycle/lifecycle-format';

/** The statuses from which a lease has a plan of the rents to show (the plan is made for a contract signed by everyone). */
const HAS_RENT_PLAN: readonly LeaseDetail['status'][] = ['Signed', 'RegistrationPending', 'SentToProvider', 'Registered'];

function Fact({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-foreground/70 sm:w-48">{label}</dt>
      <dd className="min-w-0 break-words font-medium" data-testid={testId}>
        {children}
      </dd>
    </div>
  );
}

/** The people of the lease: name, role and, masked by the server, fiscal code and e-mail. */
function PartyList({ parties }: { parties: LeaseDetail['parties'] }) {
  const { t } = useTranslation();

  if (parties.length === 0) return <p className="text-sm text-foreground/70">{t('leases.noParties')}</p>;

  return (
    <ul role="list" className="divide-y divide-border border-y border-border">
      {parties.map((party) => (
        <li
          key={party.id}
          data-testid="lease-party"
          className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
        >
          <div className="min-w-0">
            <p className="break-words font-medium">
              {party.firstName} {party.lastName}
            </p>
            <p className="flex flex-wrap gap-x-1.5 text-sm text-foreground/70">
              <span>{getLeasePartyRoleLabel(party.role, t)}</span>
              {party.isExtraEU ? <span>· {t('leaseSheet.party.extraEu')}</span> : null}
            </p>
          </div>
          {/* Masked by the server: the clear fiscal code and email never reach the browser (A7-17). */}
          <div className="min-w-0 space-y-0.5 break-words text-sm sm:text-right">
            <p>
              <span className="text-foreground/70">{t('leases.fiscalCodeMasked')}: </span>
              {party.fiscalCodeMasked}
            </p>
            <p>
              <span className="text-foreground/70">{t('leases.contactEmailMasked')}: </span>
              {party.contactEmailMasked}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * The data of the lease, and only the data, in sections without a box around them: the parties (fiscal code and e-mail masked by the
 * server), the property, the economic conditions (with the way to the plan of the rents), the dates. What to do about the contract, the
 * tax comparison and the range of the canone concordato are in the guide (LR-GUIDE-1), not here.
 *
 * The end is the end of the period the lease is in (`currentTermEndDate`, LR-14: a lease that renews by itself goes on), with what
 * stopped it from renewing, the notice or the early termination, beside it (LR-10). `onRequestErasure` is the quiet action of the
 * people of the lease, "Chiedi la cancellazione dei dati" (LR-09): it is given only to who may make the request.
 */
export function LeaseDataTab({ lease, onRequestErasure }: { lease: LeaseDetail; onRequestErasure?: () => void }) {
  const { t } = useTranslation();
  const parties = lease.parties ?? [];
  // A draft keeps starting values (a date in the year 3000, a rent of 0) for what was not typed yet: shown as to be set.
  const toDefine = t('leaseSheet.toDefine');
  const day = (date: string) => (isLeasePlaceholderDate(date) ? toDefine : formatDate(date));
  const termFacts = leaseTermFacts(lease, t);
  const conditions = (
    <dl className="space-y-3 text-sm">
      <Fact label={t('leases.fiscalRegime')} testId="lease-type-regime">
        {getLeaseTypeAndRegimeLabel(lease, t)}
      </Fact>
      <Fact label={t('leases.monthlyRent')}>{lease.monthlyRent > 0 ? formatCurrency(lease.monthlyRent) : toDefine}</Fact>
      <Fact label={t('leases.securityDeposit')}>
        {lease.securityDeposit != null ? formatCurrency(lease.securityDeposit) : t('leases.securityDepositMissing')}
      </Fact>
    </dl>
  );

  return (
    <div className="space-y-8">
      {onRequestErasure ? (
        <PlainSection
          title={t('leases.parties')}
          actionLabel={t('leaseLifecycle.erasure.action')}
          onAction={onRequestErasure}
          actionTestId="lease-erasure-action"
        >
          <PartyList parties={parties} />
        </PlainSection>
      ) : (
        <PlainSection title={t('leases.parties')}>
          <PartyList parties={parties} />
        </PlainSection>
      )}

      <PlainSection
        title={t('leaseSheet.property.title')}
        actionLabel={t('leaseSheet.property.open')}
        href={longRentPropertyPath(lease.propertyId)}
      >
        <p className="break-words font-medium">{leasePropertyLine(lease, t)}</p>
      </PlainSection>

      {HAS_RENT_PLAN.includes(lease.status) ? (
        <PlainSection
          title={t('leaseSheet.conditions.title')}
          actionLabel={t('leaseGuide.data.rentPlan')}
          href={leaseSheetPath(lease.id, 'pagamenti')}
          actionTestId="lease-rent-plan-link"
        >
          {conditions}
        </PlainSection>
      ) : (
        <PlainSection title={t('leaseSheet.conditions.title')}>{conditions}</PlainSection>
      )}

      <PlainSection title={t('leaseSheet.dates.title')}>
        <dl className="space-y-3 text-sm">
          <Fact label={t('leaseSheet.dates.start')}>{day(lease.startDate)}</Fact>
          <Fact label={t('leaseSheet.dates.end')} testId="lease-end-date">
            {day(leaseTermEnd(lease))}
          </Fact>
          {termFacts.map((fact) => (
            <Fact key={fact.key} label={fact.label} testId={`lease-fact-${fact.key}`}>
              {fact.value}
            </Fact>
          ))}
          <Fact label={t('leases.stipulaDate')} testId="lease-stipula-date">
            {lease.stipulaDate ? formatDate(lease.stipulaDate) : t('leases.stipulaDateMissing')}
          </Fact>
          <Fact label={t('leases.registrationDeadline')} testId="lease-registration-deadline">
            {lease.registrationDeadline ? formatDate(lease.registrationDeadline) : t('leases.registrationDeadlineToBeDetermined')}
          </Fact>
          <Fact label={t('leases.created')}>{formatDateTime(lease.createdAt)}</Fact>
        </dl>
        {/* A notice that came after the last day to give it: said without a number, and CasaZen does not judge it (LR-D29). */}
        {lease.noticeWarning ? (
          <p className="text-sm text-foreground/70" data-testid="lease-notice-warning">
            {t('leaseLifecycle.notice.possiblyLate')}
          </p>
        ) : null}
      </PlainSection>
    </div>
  );
}
