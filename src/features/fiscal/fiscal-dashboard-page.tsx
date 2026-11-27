import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FocusBlock, PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import { getManifestEntry, hasEntryPermission, isEntryFeatureEnabled } from '@/config/route-manifest';
import { NoteLine } from '@/features/dashboard/components/note-line';
import { FiscalDisclaimer } from '@/features/fiscal/components/fiscal-disclaimer';
import { FiscalPropertyItem } from '@/features/fiscal/components/fiscal-property-item';
import { FISCAL_DOCUMENTS_PATH } from '@/features/fiscal/documents/document-paths';
import { fiscalFocus, type FiscalFocus } from '@/features/fiscal/fiscal-focus';
import { currentFiscalYear } from '@/features/fiscal/fiscal-format';
import { BILLING_SETUP_PATH } from '@/features/fiscal/billing-wizard/billing-wizard-ids';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { useFiscalRegime, useAssignFiscalRegime } from '@/queries/use-fiscal';
import type { FiscalRegimeSnapshot, StrFiscalRegime } from '@/api/fiscal.api';

const WIZARD_PATH = '/app/short-rent/fiscal/wizard';
const REPORTS_PATH = '/app/short-rent/fiscal/reports';
const PROPERTIES_PATH = '/app/short-rent/properties';

interface FiscalFocusBlockProps {
  snapshot: FiscalRegimeSnapshot;
  focus: FiscalFocus;
}

function FiscalFocusBlock({ snapshot, focus }: FiscalFocusBlockProps) {
  const { t } = useTranslation();
  const reports = { label: t('fiscal.reports.link'), href: REPORTS_PATH, testId: 'fiscal-focus-cta' };

  switch (focus.kind) {
    case 'vat':
      return (
        <FocusBlock
          tone="warning"
          kicker={t('compliance.cockpit.kicker.fine')}
          title={t('fiscal.focus.vat.title')}
          body={t('fiscal.alert.piva', { max: snapshot.maxShortStayApartmentsPerTaxpayer })}
          primary={{ label: t('fiscal.alert.wizard'), href: WIZARD_PATH, testId: 'fiscal-focus-cta' }}
          data-testid="fiscal-piva-alert"
        />
      );
    case 'properties':
      return null;
    case 'ok':
      return (
        <FocusBlock
          tone="success"
          title={t('fiscal.focus.ok.title', { year: snapshot.taxYear })}
          body={t('fiscal.reports.description')}
          primary={reports}
          data-testid="fiscal-focus"
        />
      );
    case 'reports':
      return <FocusBlock title={t('fiscal.focus.reports.title')} body={t('fiscal.reports.description')} primary={reports} data-testid="fiscal-focus" />;
  }
}

interface FiscalOverviewProps {
  snapshot: FiscalRegimeSnapshot;
  canWrite: boolean;
  pending: boolean;
  onAssign: (propertyId: string, regime: StrFiscalRegime) => void;
}

function FiscalOverview({ snapshot, canWrite, pending, onAssign }: FiscalOverviewProps) {
  const { t } = useTranslation();

  if (snapshot.properties.length === 0) {
    return (
      <FocusBlock
        title={t('fiscal.empty.title')}
        body={t('fiscal.empty.description')}
        primary={
          canWrite
            ? { label: t('fiscal.empty.action'), href: `${PROPERTIES_PATH}/create`, testId: 'fiscal-empty-cta' }
            : { label: t('compliance.cockpit.allClear.cta'), href: PROPERTIES_PATH, testId: 'fiscal-empty-cta' }
        }
        data-testid="fiscal-dashboard-empty"
      />
    );
  }

  const focus = fiscalFocus(snapshot, canWrite);

  return (
    <>
      <FiscalFocusBlock snapshot={snapshot} focus={focus} />

      <PlainSection title={t('fiscal.list.title')} data-testid="fiscal-properties-section">
        {/* The block above already says it when the partita IVA is what is missing; otherwise it stays here as a note. */}
        {snapshot.requiresPartitaIva && focus.kind !== 'vat' ? (
          <p data-testid="fiscal-piva-alert">
            <NoteLine note={{ text: t('fiscal.alert.piva', { max: snapshot.maxShortStayApartmentsPerTaxpayer }), tone: 'warning' }} />
          </p>
        ) : null}
        <p data-testid="fiscal-str-count" className="text-sm text-foreground/70">
          {t('fiscal.count', { count: snapshot.strPropertyCount, year: snapshot.taxYear })}
        </p>
        <ul role="list" className="grid gap-3">
          {snapshot.properties.map((row) => (
            <FiscalPropertyItem
              key={row.propertyId}
              row={row}
              snapshot={snapshot}
              pending={pending}
              canWrite={canWrite}
              onAssign={(regime) => onAssign(row.propertyId, regime)}
            />
          ))}
        </ul>
      </PlainSection>
    </>
  );
}

/**
 * The fiscal regime of the year, property by property: the one thing to do first (confirm or choose a regime, or the partita
 * IVA when a taxpayer is over the threshold), then each property with its regime and its state. Whoever may only look sees the
 * state of each one and the reports. Everything comes from `GET fiscal/regime`; a regime is chosen with
 * `PUT fiscal/properties/{id}/regime` and never applied on its own.
 */
export function FiscalDashboardPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canWrite = hasPermission('short-rent', 'property.write');
  const { flags } = useFeatureFlags();
  const documentsEntry = getManifestEntry(FISCAL_DOCUMENTS_PATH);
  const canOpenDocuments = documentsEntry !== undefined && isEntryFeatureEnabled(documentsEntry, flags) && hasEntryPermission(documentsEntry, hasPermission);
  // The same for the wizard «Fatturazione»: its card is for who may change the setup, and only where the wizard exists (the issuance of fiscal documents is on): a card never leads to the home of the area.
  const billingEntry = getManifestEntry(BILLING_SETUP_PATH);
  const canOpenBilling = canWrite && billingEntry !== undefined && isEntryFeatureEnabled(billingEntry, flags) && hasEntryPermission(billingEntry, hasPermission);
  const taxYear = useMemo(() => currentFiscalYear(), []);
  const { data, isLoading, isError, error, refetch } = useFiscalRegime(taxYear);
  const assign = useAssignFiscalRegime(taxYear);

  const assignRegime = (propertyId: string, regime: StrFiscalRegime) =>
    assign.mutate(
      { propertyId, regime, isPrimaryForCedolare: regime === 'CedolareSecca21' ? true : undefined },
      {
        onSuccess: () => toast.success(t('fiscal.assignSuccess')),
        onError: (err) => toast.error(getProblemMessage(err, t) ?? t('fiscal.assignFailed')),
      },
    );

  return (
    <AppShell>
      <div className="space-y-6 md:space-y-8" data-testid="fiscal-dashboard-page">
        <PageHeader
          title={t('fiscal.page.title', { year: taxYear })}
          description={t('fiscal.page.description')}
          crumbs="auto"
          secondary={[
            ...(canWrite ? [{ label: t('fiscal.wizard.link'), icon: UserRound, to: WIZARD_PATH, testId: 'fiscal-profile-link' }] : []),
            { label: t('fiscal.reports.link'), icon: FileText, to: REPORTS_PATH, testId: 'fiscal-reports-link' },
          ]}
        />

        {isError && !data ? (
          <ErrorState title={t('fiscal.loadError')} error={error} onRetry={() => void refetch()} testId="fiscal-dashboard-error" />
        ) : isLoading ? (
          <div data-testid="fiscal-loading" className="space-y-6">
            <SkeletonCard lines={3} label={t('fiscal.loading')} />
            <SkeletonLine lines={4} />
          </div>
        ) : data ? (
          <FiscalOverview snapshot={data} canWrite={canWrite} pending={assign.isPending} onAssign={assignRegime} />
        ) : null}

        {canOpenDocuments ? (
          <PlainSection
            title={t('fiscalDocuments.list.title')}
            actionLabel={t('fiscalDocuments.list.card.action')}
            href={FISCAL_DOCUMENTS_PATH}
            actionTestId="fiscal-documents-card-cta"
            data-testid="fiscal-documents-card"
          >
            <p className="text-sm text-foreground/70">{t('fiscalDocuments.list.description')}</p>
          </PlainSection>
        ) : null}

        {/* The invoicing setup of the organization (the wizard «Fatturazione»): a quiet section, not a second highlighted block. Whoever may not change it has no button to it. */}
        {canOpenBilling ? (
          <PlainSection
            title={t('billingWizard.card.title')}
            actionLabel={t('billingWizard.card.action')}
            href={BILLING_SETUP_PATH}
            actionTestId="fiscal-billing-card-cta"
            data-testid="fiscal-billing-card"
          >
            <p className="text-sm text-foreground/70">{t('billingWizard.card.description')}</p>
          </PlainSection>
        ) : null}

        <FiscalDisclaimer />
      </div>
    </AppShell>
  );
}
