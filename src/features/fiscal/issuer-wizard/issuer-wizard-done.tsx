import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { WizardSummary, type WizardSummaryItem } from '@/components/shared/wizard/wizard-summary';
import { useIssuerSettings } from '@/queries/use-fiscal-issuer';
import { effectsOf, MODE_LABEL_KEYS, REGIME_LABEL_KEYS } from './issuer-copy';
import { CASAZEN_MODE } from './issuer-wizard-model';
import { AREA_HOME_PATH, FISCAL_PATH } from './issuer-paths';

/** The address of the issuer as the server has it, on one line: «Via Roma 12, 20121 Milano (MI)». */
function savedAddress(issuer: { addressStreet?: string; addressCivic?: string; postalCode?: string; city?: string; province?: string }): string {
  const street = [issuer.addressStreet, issuer.addressCivic].filter(Boolean).join(' ');
  const town = [issuer.postalCode, issuer.city].filter(Boolean).join(' ');
  return [street, issuer.province ? `${town} (${issuer.province})` : town].filter(Boolean).join(', ');
}

/**
 * «What happens now» at the end of the wizard (NF-05, NF-10): the result for each thing that was set, what CasaZen will and will not do, and
 * one suggested next step. It reads the setting from the server, so it is also what an address opened again shows (a reload): a setting that
 * the wizard never completed sends the person back to the first step. It says only what is true: the rule of the regime, when the server
 * has one, says which document the regime gives.
 */
export function IssuerDone() {
  const { t } = useTranslation();
  const settings = useIssuerSettings();

  if (settings.isPending) return <LoadingScreen message={t('fiscalDocuments.issuer.loading')} className="h-auto flex-1" />;
  const data = settings.data;
  if (!data) {
    return (
      <ErrorState title={t('fiscalDocuments.issuer.loadError')} error={settings.error} onRetry={() => void settings.refetch()} testId="fiscal-issuer-done-error" />
    );
  }
  if (!data.mode || !data.confirmedAt) return <Navigate to={{ search: '' }} replace />;

  const regime = data.regime ?? null;
  const rows: WizardSummaryItem[] = [
    { id: 'who', label: t('fiscalDocuments.issuer.summary.items.who'), value: t(MODE_LABEL_KEYS[data.mode]) },
    { id: 'regime', label: t('fiscalDocuments.issuer.summary.items.regime'), value: regime ? t(REGIME_LABEL_KEYS[regime]) : null },
  ];
  const effects = effectsOf(t, { mode: data.mode, regime, settings: data });
  if (data.mode === CASAZEN_MODE) {
    rows.push({ id: 'name', label: t('fiscalDocuments.issuer.summary.items.name'), value: data.issuer.legalName ?? null });
    rows.push({ id: 'address', label: t('fiscalDocuments.issuer.summary.items.address'), value: savedAddress(data.issuer) });
    if (data.rule?.configured) {
      effects.unshift(data.rule.documentKind === 'Receipt' ? t('fiscalDocuments.issuer.done.rule.receipt') : t('fiscalDocuments.issuer.done.rule.invoice'));
    }
  }

  return (
    <div data-testid="fiscal-issuer-done">
      <WizardDone
        title={t('fiscalDocuments.issuer.done.title')}
        whatNext={effects.map((text) => ({ text }))}
        primary={{ label: t('fiscalDocuments.issuer.done.toFiscal'), to: FISCAL_PATH }}
        secondary={{ label: t('fiscalDocuments.issuer.done.toHome'), to: AREA_HOME_PATH }}
      >
        <WizardSummary items={rows} />
      </WizardDone>
    </div>
  );
}
