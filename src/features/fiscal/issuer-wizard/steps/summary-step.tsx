import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { useOptionalWizard } from '@/components/shared/wizard/wizard-context';
import { WizardSummary, type WizardSummaryItem } from '@/components/shared/wizard/wizard-summary';
import { Alert } from '@/components/ui/alert';
import { compactIdentifier } from '@/features/fiscal/tax-profile-changes';
import type { FiscalDocumentSettings, FiscalIssuerField } from '@/types';
import { effectsOf, MODE_LABEL_KEYS, REGIME_LABEL_KEYS } from '../issuer-copy';
import { CASAZEN_MODE, modeFromValues } from '../issuer-wizard-model';
import {
  ISSUER_STEPS,
  SERVER_FIELD_MESSAGES,
  STEP_OF_FIELD,
  regimeHasVatNumber,
  regimeOfAnswers,
  type IssuerWizardValues,
} from '../issuer-wizard-schema';

interface SummaryStepProps {
  /** The setting as the server has it: what it can do here (`sdi`), the rule of the regime. */
  settings: FiscalDocumentSettings;
  /** The answers of the whole wizard. */
  values: IssuerWizardValues;
  /** What the server refused or said is missing at the last button: shown with a way to the step that fixes it. */
  problems: readonly FiscalIssuerField[];
}

/** The address as it will read on the documents: «Via Roma 12, 20121 Milano (MI)». */
function addressLine(values: IssuerWizardValues): string {
  const street = [values.addressStreet.trim(), values.addressCivic.trim()].filter(Boolean).join(' ');
  const town = [values.postalCode.replace(/\s+/g, ''), values.city.trim()].filter(Boolean).join(' ');
  const province = values.province.trim().toUpperCase();
  return [street, province ? `${town} (${province})` : town].filter(Boolean).join(', ');
}

/** What the person typed in the options of the issuer, one answer each, only the ones that are filled. */
function optionItems(values: IssuerWizardValues, label: (key: string) => string): WizardSummaryItem[] {
  const options: Array<{ id: string; labelKey: string; value: string }> = [
    { id: 'regimeCode', labelKey: 'fiscalDocuments.issuer.data.fatturaPaRegimeCode.label', value: values.fatturaPaRegimeCode.trim().toUpperCase() },
    { id: 'sdiCode', labelKey: 'fiscalDocuments.issuer.data.issuerSdiRecipientCode.label', value: values.issuerSdiRecipientCode.trim().toUpperCase() },
    { id: 'pec', labelKey: 'fiscalDocuments.issuer.data.issuerPec.label', value: values.issuerPec.trim().toLowerCase() },
    { id: 'series', labelKey: 'fiscalDocuments.issuer.data.defaultSeries.label', value: values.defaultSeries.trim() },
  ];
  return options.filter((option) => option.value !== '').map((option) => ({ id: option.id, label: label(option.labelKey), value: option.value, stepId: ISSUER_STEPS.issuer }));
}

/**
 * Last step, «Controlla e conferma» (NF-05): what will be saved, each answer with «Modifica» that goes back to its step, and in plain words
 * what will happen, what CasaZen will not do, and that the SDI is not reachable yet while the server has no channel for it. Nothing changes
 * until the last button. A refused save puts here what the server named, each with the way to the step that fixes it (never a dead end).
 */
export function SummaryStep({ settings, values, problems }: SummaryStepProps) {
  const { t } = useTranslation();
  const wizard = useOptionalWizard();
  const effectsId = useId();
  const mode = modeFromValues(values);
  const regime = regimeOfAnswers(values);

  const items: WizardSummaryItem[] = [
    { id: 'who', label: t('fiscalDocuments.issuer.summary.items.who'), value: mode ? t(MODE_LABEL_KEYS[mode]) : null, stepId: ISSUER_STEPS.who },
    { id: 'regime', label: t('fiscalDocuments.issuer.summary.items.regime'), value: regime ? t(REGIME_LABEL_KEYS[regime]) : null, stepId: ISSUER_STEPS.regime },
  ];
  if (mode === CASAZEN_MODE) {
    items.push({ id: 'name', label: t('fiscalDocuments.issuer.summary.items.name'), value: values.legalName.trim(), stepId: ISSUER_STEPS.issuer });
    if (regimeHasVatNumber(regime)) {
      items.push({
        id: 'vatNumber',
        label: t('fiscalDocuments.issuer.summary.items.vatNumber'),
        value: settings.issuer.vatNumber ?? compactIdentifier(values.vatNumber),
        stepId: ISSUER_STEPS.issuer,
      });
    } else if (regime === 'PrivatePerson') {
      items.push({
        id: 'fiscalCode',
        label: t('fiscalDocuments.issuer.summary.items.fiscalCode'),
        value: settings.issuer.fiscalCode ?? compactIdentifier(values.fiscalCode).toUpperCase(),
        stepId: ISSUER_STEPS.issuer,
      });
    }
    items.push({ id: 'address', label: t('fiscalDocuments.issuer.summary.items.address'), value: addressLine(values), stepId: ISSUER_STEPS.address });
    items.push(...optionItems(values, (key) => t(key)));
  }

  const effects = mode ? effectsOf(t, { mode, regime, settings }) : [];
  // A problem is shown only if the step that fixes it is one of the steps now (the choice may have changed since).
  const stepIds = new Set(wizard?.steps.map((step) => step.id));
  const open = problems.flatMap((field) => {
    const messageKey = SERVER_FIELD_MESSAGES[field];
    const stepId = STEP_OF_FIELD[field];
    return messageKey && stepIds.has(stepId) ? [{ field, messageKey, stepId }] : [];
  });

  return (
    <div className="flex flex-col gap-6" data-testid="fiscal-issuer-summary-step">
      {open.length > 0 ? (
        <Alert variant="danger" title={t('fiscalDocuments.issuer.summary.problems.title')} data-testid="fiscal-issuer-problems">
          <ul role="list" className="mt-1 space-y-1">
            {open.map(({ field, messageKey, stepId }) => {
              const stepLabel = wizard?.steps.find((step) => step.id === stepId)?.label ?? '';
              return (
                <li key={field} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1" data-testid={`fiscal-issuer-problem-${field}`}>
                  <span className="min-w-0 break-words">{t(messageKey)}</span>
                  {wizard ? (
                    <Link
                      to={wizard.hrefFor(stepId)}
                      aria-label={t('fiscalDocuments.issuer.summary.problems.fixStep', { step: stepLabel })}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t('fiscalDocuments.issuer.summary.problems.fix')}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Alert>
      ) : null}

      <WizardSummary items={items} />

      {effects.length > 0 ? (
        <section aria-labelledby={effectsId} className="min-w-0 space-y-3 rounded-lg bg-muted p-4" data-testid="fiscal-issuer-effects">
          <h3 id={effectsId} className="text-base font-semibold">
            {t('fiscalDocuments.issuer.summary.effects')}
          </h3>
          <ul className="space-y-2" role="list">
            {effects.map((line) => (
              <li key={line} className="flex min-w-0 items-start gap-2 text-sm">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-foreground" />
                <span className="min-w-0 break-words">{line}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
