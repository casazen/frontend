import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { SkeletonLine } from '@/components/ui/skeleton';
import { Fact, Facts } from '@/features/bookings/components/booking-facts';
import { RentManualNotices } from '@/features/leases/components/rent-manual-notices';
import { leaseTenantName } from '@/features/leases/lib/lease-list-format';
import { rentBreakdown } from '@/features/leases/lib/rent-breakdown';
import { LandlordMaintenanceList } from '@/features/maintenance-requests/landlord-page';
import { useRentLedger } from '@/queries/use-rent';
import type { usePropertyDocuments } from '@/queries/use-properties';
import { formatCurrency } from '@/lib/utils';
import { parseStayDate, todayInRome } from '@/lib/stay-dates';
import type { LeaseSummary, Property, RentInstallment } from '@/types';
import { PropertyCadastralCard } from '../components/property-cadastral-card';
import { PropertyDocumentsSection } from '../components/property-documents-section';
import { formatPropertyLocation } from '../property-location';
import { LongRentPropertyLeases } from './long-rent-property-leases';
import { longRentLeasePath, newLeaseForPropertyPath } from './paths';
import { Button } from '@/components/ui/button';

const FISCAL_REPORT_PATH = '/app/long-rent/fiscal';
const SEPA_ACCOUNT_PATH = '/app/long-rent/payments';

const startedLast = (a: LeaseSummary, b: LeaseSummary) => parseStayDate(b.startDate).localeCompare(parseStayDate(a.startDate));

/**
 * The panels of the tabs of the page of a long-term property (LR-07d), each one made of sections without a box. The fourth tab,
 * Interventi, is the list of requests to suppliers that the page already had (`LongRentServiceRequests`).
 */

/** Whether the APE is on file, in a line when it is and in a notice when it is not (the lease cannot be made without it). */
function ApeStatus({ hasApe }: { hasApe: boolean }) {
  const { t } = useTranslation();

  if (!hasApe) {
    return (
      <Alert variant="warning" data-testid="long-rent-ape-status">
        {t('longRentProperties.detail.apeMissing')}
      </Alert>
    );
  }

  return (
    <p role="status" data-testid="long-rent-ape-status" className="flex items-start gap-2 text-sm text-foreground/70">
      <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-foreground" />
      <span className="min-w-0 break-words">{t('longRentProperties.detail.apePresent')}</span>
    </p>
  );
}

/**
 * Contratti: the leases of the property, the last started first. Not loaded yet, or failed: nothing here, the note above the tabs
 * says it (a property is never "without contracts" because a list failed).
 */
export function ContractsPanel({ leases, propertyId, canCreateLease }: { leases: readonly LeaseSummary[] | undefined; propertyId: string; canCreateLease: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      {canCreateLease ? (
        <Button asChild data-testid="long-rent-property-create-contract">
          <Link to={newLeaseForPropertyPath(propertyId)}>{t('longRentProperties.detail.newLease')}</Link>
        </Button>
      ) : null}
      {leases === undefined ? null : leases.length === 0 ? (
        <p className="text-sm text-foreground/70" data-testid="long-rent-property-leases-empty">
          {t('longRentProperties.detail.contractsEmpty')}
        </p>
      ) : <LongRentPropertyLeases leases={leases} />}
    </div>
  );
}

/** Documenti: whether the APE is there and the documents of the property, with the upload that opens on the APE. */
export function DocumentsPanel({ propertyId, documents }: { propertyId: string; documents: ReturnType<typeof usePropertyDocuments> }) {
  const { t } = useTranslation();

  if (documents.isLoading) return <SkeletonLine lines={3} label={t('longRentProperties.detail.documentsLoading')} />;
  if (documents.isError || !documents.data) {
    return (
      <ErrorState
        testId="long-rent-documents-load-error"
        title={t('longRentProperties.detail.documentsLoadError')}
        error={documents.error}
        onRetry={() => void documents.refetch()}
      />
    );
  }

  const hasApe = documents.data.some((doc) => doc.documentType === 'Ape');
  return (
    <div className="space-y-3">
      <ApeStatus hasApe={hasApe} />
      <PropertyDocumentsSection plain propertyId={propertyId} documents={documents.data} defaultUploadType="Ape" />
    </div>
  );
}

/**
 * Spese condominiali of this property. There is no condominium balance sheet, payment report or owner-to-condo charge
 * list yet: this section shows the current acconto and conguaglio on each contract's ledger, the preventivo and
 * conguaglio notices, and the two existing pages that come closest (the fiscal file, and the SEPA account in settings).
 * Canoni are not listed here.
 */
export function ExpensesPanel({ leases }: { leases: readonly LeaseSummary[] | undefined }) {
  const { t } = useTranslation();
  if (!leases) return null;
  if (leases.length === 0) {
    return (
      <p className="text-sm text-foreground/70" data-testid="long-rent-property-expenses-empty">
        {t('longRentProperties.expenses.empty')}
      </p>
    );
  }

  return (
    <div className="space-y-8" data-testid="long-rent-property-expenses">
      <p className="text-sm text-foreground/70">{t('longRentProperties.expenses.intro')}</p>
      {[...leases].sort(startedLast).map((lease) => (
        <CondoLease key={lease.id} lease={lease} />
      ))}
      <PlainSection title={t('longRentProperties.expenses.reportsTitle')}>
        <p className="text-sm text-foreground/70">{t('longRentProperties.expenses.reportsBody')}</p>
        <p className="text-sm">
          <Link to={FISCAL_REPORT_PATH} className="font-medium underline" data-testid="long-rent-property-fiscal-report">
            {t('longRentProperties.expenses.openReport')}
          </Link>
        </p>
      </PlainSection>
      <PlainSection title={t('longRentProperties.expenses.ownerPaymentsTitle')}>
        <p className="text-sm text-foreground/70">{t('longRentProperties.expenses.ownerPaymentsBody')}</p>
        <p className="text-sm">
          <Link to={SEPA_ACCOUNT_PATH} className="font-medium underline" data-testid="long-rent-property-sepa">
            {t('longRentProperties.expenses.openSepa')}
          </Link>
        </p>
      </PlainSection>
    </div>
  );
}

const CONDO_KINDS = new Set(['CondominiumAdvance', 'CondominiumSettlement']);

function hasCondoCharge(row: RentInstallment): boolean {
  return (row.components ?? []).some((part) => CONDO_KINDS.has(part.kind));
}

function latestDue(rows: readonly RentInstallment[]): RentInstallment | undefined {
  return [...rows].sort((a, b) => b.dueDate.localeCompare(a.dueDate) || b.periodEnd.localeCompare(a.periodEnd))[0];
}

function earliestDue(rows: readonly RentInstallment[]): RentInstallment | undefined {
  return [...rows].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.periodEnd.localeCompare(b.periodEnd))[0];
}

/**
 * Acconto and conguaglio of the charge a landlord checks now. One installment, never the sum of the ledger, so a
 * monthly advance stays that month's amount. Cancelled rows are ignored, and a paid row is used only when nothing
 * is still open. The row is the open one that covers today, otherwise the latest open due, otherwise the next open
 * one, otherwise the latest one still on the contract.
 */
function condoParts(installments: readonly RentInstallment[], today = todayInRome()) {
  const charged = installments.filter((row) => row.status !== 'Cancelled' && hasCondoCharge(row));
  const open = charged.filter((row) => row.status !== 'Paid');
  const coversToday = (row: RentInstallment) => row.periodStart <= today && today <= row.periodEnd;
  const current =
    latestDue(open.filter(coversToday)) ??
    latestDue(open.filter((row) => row.dueDate <= today)) ??
    earliestDue(open.filter((row) => row.dueDate > today)) ??
    latestDue(charged);
  if (!current) return { seen: false, advance: 0, settlement: 0 };
  const parts = rentBreakdown(current);
  return { seen: true, advance: parts.condominiumAdvance ?? 0, settlement: parts.condominiumSettlement ?? 0 };
}

function CondoLease({ lease }: { lease: LeaseSummary }) {
  const { t } = useTranslation();
  const ledger = useRentLedger(lease.id, lease.status);
  const name = leaseTenantName(lease, t);
  const parts = ledger.data ? condoParts(ledger.data.installments) : null;
  const notices = ledger.data?.manualNotices ?? [];

  return (
    <PlainSection title={name} data-testid={`long-rent-property-condo-${lease.id}`}>
      <div className="space-y-4">
        <p className="text-sm">
          <Link to={longRentLeasePath(lease.id)} className="font-medium underline">
            {t('longRentProperties.expenses.openContract')}
          </Link>
        </p>
        {ledger.isLoading ? <SkeletonLine lines={2} label={t('longRentProperties.expenses.loading')} /> : null}
        {ledger.isError ? (
          <ErrorState
            testId={`long-rent-property-condo-error-${lease.id}`}
            title={t('longRentProperties.expenses.loadError')}
            error={ledger.error}
            onRetry={() => void ledger.refetch()}
          />
        ) : null}
        {parts ? (
          <div className="space-y-2" data-testid={`long-rent-property-condo-situation-${lease.id}`}>
            <h3 className="text-sm font-medium">{t('longRentProperties.expenses.situation')}</h3>
            {parts.seen ? (
              <ul className="space-y-1 text-sm">
                <li>{t('longRentProperties.expenses.advance', { amount: formatCurrency(parts.advance, 'EUR') })}</li>
                <li>{t('longRentProperties.expenses.settlement', { amount: formatCurrency(parts.settlement, 'EUR') })}</li>
              </ul>
            ) : (
              <p className="text-sm text-foreground/70">{t('longRentProperties.expenses.noParts')}</p>
            )}
          </div>
        ) : null}
        {ledger.data ? (
          <div className="space-y-2" data-testid={`long-rent-property-condo-report-${lease.id}`}>
            <h3 className="text-sm font-medium">{t('longRentProperties.expenses.summary')}</h3>
            {notices.length > 0 ? (
              <RentManualNotices leaseId={lease.id} notices={notices} />
            ) : (
              <p className="text-sm text-foreground/70">{t('longRentProperties.expenses.noSummary')}</p>
            )}
            <p className="text-sm">
              <Link to={`${longRentLeasePath(lease.id)}?tab=documenti`} className="font-medium underline">
                {t('longRentProperties.expenses.openDocuments')}
              </Link>
            </p>
          </div>
        ) : null}
      </div>
    </PlainSection>
  );
}

/**
 * Manutenzione of this property: the requests the tenant sent on each contract, the same list as
 * `/app/long-rent/leases/:id/manutenzione`. No contract, no requests.
 */
export function MaintenancePanel({ leases }: { leases: readonly LeaseSummary[] | undefined }) {
  const { t } = useTranslation();
  if (!leases) return null;
  if (leases.length === 0) {
    return (
      <p className="text-sm text-foreground/70" data-testid="long-rent-property-maintenance-empty">
        {t('longRentProperties.maintenance.empty')}
      </p>
    );
  }

  return (
    <div className="space-y-8" data-testid="long-rent-property-maintenance">
      {[...leases].sort(startedLast).map((lease) => (
        <section key={lease.id} className="space-y-3" aria-labelledby={`property-maintenance-${lease.id}`}>
          <h2 id={`property-maintenance-${lease.id}`} className="text-base font-semibold">
            {leaseTenantName(lease, t)}
          </h2>
          <LandlordMaintenanceList leaseId={lease.id} />
        </section>
      ))}
    </div>
  );
}

/** Dati: where the property is and how big, and the cadastral identification the contract prints. */
export function DataPanel({ property }: { property: Property }) {
  const { t } = useTranslation();

  return (
    <PlainSection title={t('longRentProperties.detail.infoTitle')}>
      <div className="space-y-6">
        <Facts>
          <Fact label={t('longRentProperties.detail.address')}>{formatPropertyLocation(property)}</Fact>
          <Fact label={t('longRentProperties.detail.rooms')}>
            {[t('property.table.bedroomsCount', { count: property.bedrooms }), t('property.table.bathroomsCount', { count: property.bathrooms })].join(' · ')}
          </Fact>
          {property.description ? <Fact label={t('longRentProperties.detail.description')}>{property.description}</Fact> : null}
        </Facts>
        <PropertyCadastralCard key={property.updatedAt} property={property} />
      </div>
    </PlainSection>
  );
}
