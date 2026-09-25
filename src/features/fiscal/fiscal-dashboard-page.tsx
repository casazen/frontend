import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFiscalRegime, useAssignFiscalRegime } from '@/queries/use-fiscal';
import { FiscalDisclaimer } from '@/features/fiscal/components/fiscal-disclaimer';
import { currentFiscalYear, TAX_NOTE_KEYS } from '@/features/fiscal/fiscal-format';
import { getProblemMessage } from '@/lib/api-errors';
import {
  STR_FISCAL_REGIMES,
  type FiscalPropertyRow,
  type FiscalRegimeSnapshot,
  type StrFiscalRegime,
} from '@/api/fiscal.api';

const IMPRESA_REGIMES: readonly StrFiscalRegime[] = ['RegimeOrdinario', 'RegimeForfettario'];

export function FiscalDashboardPage() {
  const { t } = useTranslation();
  const taxYear = useMemo(() => currentFiscalYear(), []);
  const { data, isLoading, isError, error, refetch, isFetching } = useFiscalRegime(taxYear);
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
      <div className="space-y-6 max-w-3xl mx-auto" data-testid="fiscal-dashboard-page">
        <PageHeader title={t('fiscal.page.title', { year: taxYear })} description={t('fiscal.page.description')} />
        <FiscalDisclaimer />
        {isLoading && <p data-testid="fiscal-loading">{t('fiscal.loading')}</p>}
        {isError && (
          <Card>
            <CardContent className="space-y-3 py-8 text-center" data-testid="fiscal-dashboard-error">
              <p className="text-destructive">{getProblemMessage(error, t) ?? t('fiscal.loadError')}</p>
              <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
                {t('fiscal.retry')}
              </Button>
            </CardContent>
          </Card>
        )}
        {data && (
          <>
            {data.requiresPartitaIva && (
              <div
                data-testid="fiscal-piva-alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
              >
                {t('fiscal.alert.piva', { max: data.maxShortStayApartmentsPerTaxpayer })}{' '}
                <Link className="underline" to="/app/short-rent/fiscal/wizard">
                  {t('fiscal.alert.wizard')}
                </Link>
              </div>
            )}
            <p data-testid="fiscal-str-count">
              {t('fiscal.count', { count: data.strPropertyCount, year: data.taxYear })}
            </p>
            {data.properties.length === 0 ? (
              <Card>
                <CardContent className="space-y-3 py-8 text-center" data-testid="fiscal-dashboard-empty">
                  <p className="font-medium">{t('fiscal.empty.title')}</p>
                  <p className="text-sm text-muted-foreground">{t('fiscal.empty.description')}</p>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/app/short-rent/properties/create">{t('fiscal.empty.action')}</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {data.properties.map((row) => (
                  <FiscalPropertyCard
                    key={row.propertyId}
                    row={row}
                    snapshot={data}
                    pending={assign.isPending}
                    onAssign={(regime) => assignRegime(row.propertyId, regime)}
                  />
                ))}
              </div>
            )}
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/app/short-rent/fiscal/reports">{t('fiscal.reports.link')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/short-rent/fiscal/wizard" data-testid="fiscal-profile-link">
              {t('fiscal.wizard.link')}
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

interface FiscalPropertyCardProps {
  row: FiscalPropertyRow;
  snapshot: FiscalRegimeSnapshot;
  pending: boolean;
  onAssign: (regime: StrFiscalRegime) => void;
}

function FiscalPropertyCard({ row, snapshot, pending, onAssign }: FiscalPropertyCardProps) {
  const { t } = useTranslation();
  const available = new Set(row.availableRegimes ?? []);
  const taxpayer = snapshot.taxpayers?.find((tp) => tp.index === row.taxpayerIndex);
  const regimeLabel = (regime: StrFiscalRegime | null) =>
    regime ? t(`fiscal.regime.${regime}`) : t('fiscal.notAssigned');
  const unavailableReason = (regime: StrFiscalRegime) =>
    IMPRESA_REGIMES.includes(regime) ? t('fiscal.unavailable.partitaIva') : t('fiscal.unavailable.threshold');
  const impresaBlocked = IMPRESA_REGIMES.every((r) => !available.has(r));
  const canDesignate = available.has('CedolareSecca21') && row.assignedRegime !== 'CedolareSecca21';
  const movesReducedRate =
    canDesignate && taxpayer?.reducedRatePropertyId != null && taxpayer.reducedRatePropertyId !== row.propertyId;
  const selectId = `fiscal-regime-${row.propertyId}`;

  return (
    <Card data-testid={`fiscal-property-card-${row.propertyId}`}>
      <CardHeader>
        <CardTitle className="text-base">{row.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {taxpayer && (
          <p className="text-muted-foreground" data-testid={`fiscal-taxpayer-${row.propertyId}`}>
            {taxpayer.isOrgTaxProfile
              ? t('fiscal.taxpayer.org')
              : t('fiscal.taxpayer.code', { code: taxpayer.fiscalCodeMasked ?? '' })}
          </p>
        )}
        <p data-testid={`fiscal-assigned-${row.propertyId}`}>
          {t('fiscal.assigned')}: <span className="font-medium">{regimeLabel(row.assignedRegime)}</span>
        </p>
        <p>
          {t('fiscal.recommended')}: {row.recommendedRegime ? t(`fiscal.regime.${row.recommendedRegime}`) : '—'}
        </p>
        {row.taxNote && TAX_NOTE_KEYS[row.taxNote] && (
          <p data-testid={`fiscal-tax-note-${row.propertyId}`} className="text-muted-foreground">
            {t(TAX_NOTE_KEYS[row.taxNote])}
          </p>
        )}
        <div className="space-y-1">
          <label htmlFor={selectId} className="font-medium">
            {t('fiscal.chooseRegime')}
          </label>
          <select
            id={selectId}
            data-testid={`fiscal-regime-select-${row.propertyId}`}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={row.assignedRegime ?? ''}
            disabled={pending || available.size === 0}
            onChange={(e) => {
              const regime = e.target.value as StrFiscalRegime;
              if (regime && regime !== row.assignedRegime) onAssign(regime);
            }}
          >
            <option value="" disabled>
              {t('fiscal.selectPlaceholder')}
            </option>
            {STR_FISCAL_REGIMES.map((regime) => (
              <option key={regime} value={regime} disabled={!available.has(regime)}>
                {available.has(regime)
                  ? t(`fiscal.regime.${regime}`)
                  : t('fiscal.unavailable.option', { regime: t(`fiscal.regime.${regime}`), reason: unavailableReason(regime) })}
              </option>
            ))}
          </select>
        </div>
        {impresaBlocked && taxpayer?.isOrgTaxProfile && (
          <p className="text-muted-foreground" data-testid={`fiscal-piva-required-${row.propertyId}`}>
            {t('fiscal.unavailable.partitaIvaHint')}{' '}
            <Link className="underline" to="/app/short-rent/fiscal/wizard">
              {t('fiscal.wizard.link')}
            </Link>
          </p>
        )}
        {canDesignate && (
          <div className="space-y-1">
            <Button
              size="sm"
              variant="outline"
              data-testid={`fiscal-primary-${row.propertyId}`}
              disabled={pending}
              onClick={() => onAssign('CedolareSecca21')}
            >
              {t('fiscal.primary')}
            </Button>
            {movesReducedRate && (
              <p className="text-muted-foreground" data-testid={`fiscal-primary-moves-${row.propertyId}`}>
                {t('fiscal.primaryMoves')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
