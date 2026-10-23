import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FocusBlock, PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import { NoteLine } from '@/features/dashboard/components/note-line';
import { FiscalDisclaimer } from '@/features/fiscal/components/fiscal-disclaimer';
import { FiscalPropertyItem } from '@/features/fiscal/components/fiscal-property-item';
import { fiscalFocus, fiscalRegimeSelectId, type FiscalFocus } from '@/features/fiscal/fiscal-focus';
import { currentFiscalYear } from '@/features/fiscal/fiscal-format';
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
  /** A regime is being saved: the button of the block waits. */
  pending: boolean;
  onAssign: (propertyId: string, regime: StrFiscalRegime) => void;
}

/** The one highlighted block of the page: the next thing to do about the regime of the year, or that nothing is left. */
function FiscalFocusBlock({ snapshot, focus, pending, onAssign }: FiscalFocusBlockProps) {
  const { t } = useTranslation();
  const reports = { label: t('fiscal.reports.link'), href: REPORTS_PATH, testId: 'fiscal-focus-cta' };

  switch (focus.kind) {
    case 'vat':
      return (
        <FocusBlock
          tone="warning"
          kicker={t('compliance.cockpit.kicker')}
          title={t('fiscal.focus.vat.title')}
          body={t('fiscal.alert.piva', { max: snapshot.maxShortStayApartmentsPerTaxpayer })}
          primary={{ label: t('fiscal.alert.wizard'), href: WIZARD_PATH, testId: 'fiscal-focus-cta' }}
          data-testid="fiscal-piva-alert"
        />
      );
    case 'confirm': {
      const label = t('fiscal.confirmRecommended');
      return (
        <FocusBlock
          tone="warning"
          kicker={t('compliance.cockpit.kicker')}
          title={t('fiscal.focus.confirm.title', { name: focus.row.name })}
          body={t('fiscal.focus.confirm.body', { regime: t(`fiscal.regime.${focus.regime}`) })}
          then={focus.others > 0 ? t('compliance.cockpit.then', { count: focus.others }) : undefined}
          primary={{
            label,
            ariaLabel: `${label}: ${focus.row.name}`,
            onClick: () => onAssign(focus.row.propertyId, focus.regime),
            loading: pending,
            testId: 'fiscal-focus-cta',
          }}
          data-testid="fiscal-focus"
        />
      );
    }
    case 'choose': {
      const label = t('fiscal.focus.choose.cta');
      return (
        <FocusBlock
          tone="warning"
          kicker={t('compliance.cockpit.kicker')}
          title={t('fiscal.focus.choose.title', { name: focus.row.name })}
          body={t('fiscal.taxNote.regimeNotAssigned')}
          then={focus.others > 0 ? t('compliance.cockpit.then', { count: focus.others }) : undefined}
          primary={{
            label,
            ariaLabel: `${label}: ${focus.row.name}`,
            onClick: () => document.getElementById(fiscalRegimeSelectId(focus.row.propertyId))?.focus(),
            testId: 'fiscal-focus-cta',
          }}
          data-testid="fiscal-focus"
        />
      );
    }
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

/** What the page shows once the regime of the year is loaded: the block with the next thing to do, then one row per property. */
function FiscalOverview({ snapshot, canWrite, pending, onAssign }: FiscalOverviewProps) {
  const { t } = useTranslation();

  if (snapshot.properties.length === 0) {
    return (
      <FocusBlock
        title={t('fiscal.empty.title')}
        body={t('fiscal.empty.description')}
        // Whoever may not add a property goes to the list of them: the button never leads where the guard says no.
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
      <FiscalFocusBlock snapshot={snapshot} focus={focus} pending={pending} onAssign={onAssign} />

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
        <ul role="list" className="divide-y divide-border border-y border-border">
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
          // An API error is never shown as "no properties".
          <ErrorState title={t('fiscal.loadError')} error={error} onRetry={() => void refetch()} testId="fiscal-dashboard-error" />
        ) : isLoading ? (
          <div data-testid="fiscal-loading" className="space-y-6">
            <SkeletonCard lines={3} label={t('fiscal.loading')} />
            <SkeletonLine lines={4} />
          </div>
        ) : data ? (
          <FiscalOverview snapshot={data} canWrite={canWrite} pending={assign.isPending} onAssign={assignRegime} />
        ) : null}

        <FiscalDisclaimer />
      </div>
    </AppShell>
  );
}
