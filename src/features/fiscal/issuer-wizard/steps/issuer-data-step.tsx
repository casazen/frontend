import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { FiscalDocumentSettings } from '@/types';
import { proposedRegimeCode } from '../issuer-wizard-model';
import { regimeHasVatNumber, regimeOfAnswers, type IssuerIdentityOnRecord, type IssuerWizardValues } from '../issuer-wizard-schema';

interface IssuerDataStepProps {
  settings: Pick<FiscalDocumentSettings, 'issuer'>;
  /** What the tax profile already has: it is shown, and asked only when it is missing. */
  onRecord: IssuerIdentityOnRecord;
}

/**
 * Step 3 (only when CasaZen issues), «I tuoi dati sui documenti»: the name that is on the documents, the VAT number or the fiscal code of the
 * regime when the tax profile does not have it yet (it is added to the tax profile, where it lives), and under «Altre opzioni», which nobody
 * has to touch, the regime code of the electronic invoice, the recipient code and the PEC of the issuer's own channel, and the series.
 * Pre-filled from what CasaZen knows: the organization and the tax profile.
 */
export function IssuerDataStep({ settings, onRecord }: IssuerDataStepProps) {
  const { t } = useTranslation();
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<IssuerWizardValues>();
  const [hasVatNumber, vatRegime, regimeCode, recipientCode, pec, series] = useWatch({
    control,
    name: ['hasVatNumber', 'vatRegime', 'fatturaPaRegimeCode', 'issuerSdiRecipientCode', 'issuerPec', 'defaultSeries'],
  });
  const regime = regimeOfAnswers({ hasVatNumber, vatRegime });

  // The options are open when they hold something (a draft, a saved value) or a problem, and stay as the person leaves them: they do not
  // close under the cursor of whoever empties a field.
  const [opened, setOpened] = useState(() => [regimeCode, recipientCode, pec, series].some((value) => value.trim() !== ''));
  const optionProblem = Boolean(errors.fatturaPaRegimeCode ?? errors.issuerSdiRecipientCode ?? errors.issuerPec ?? errors.defaultSeries);

  const asksVatNumber = regimeHasVatNumber(regime);
  const asksFiscalCode = regime === 'PrivatePerson';

  return (
    <div className="flex flex-col gap-5" data-testid="fiscal-issuer-data-step">
      <Field label={t('fiscalDocuments.issuer.data.legalName.label')} hint={t('fiscalDocuments.issuer.data.legalName.hint')} error={errors.legalName}>
        <Input autoComplete="organization" data-testid="fiscal-issuer-legal-name" {...register('legalName')} />
      </Field>

      {asksVatNumber ? (
        onRecord.vatNumber ? (
          <p className="break-words text-sm" data-testid="fiscal-issuer-on-record">
            {t('fiscalDocuments.issuer.data.onRecord.vatNumber', { value: settings.issuer.vatNumber })}
          </p>
        ) : (
          <Field
            label={t('fiscalDocuments.issuer.data.vatNumber.label')}
            hint={t('fiscalDocuments.issuer.data.vatNumber.hint')}
            example="12345678901"
            error={errors.vatNumber}
          >
            <Input inputMode="numeric" maxLength={13} autoComplete="off" data-testid="fiscal-issuer-vat-number" {...register('vatNumber')} />
          </Field>
        )
      ) : null}

      {asksFiscalCode ? (
        onRecord.fiscalCode ? (
          <p className="break-words text-sm" data-testid="fiscal-issuer-on-record">
            {t('fiscalDocuments.issuer.data.onRecord.fiscalCode', { value: settings.issuer.fiscalCode })}
          </p>
        ) : (
          <Field label={t('fiscalDocuments.issuer.data.fiscalCode.label')} hint={t('fiscalDocuments.issuer.data.fiscalCode.hint')} error={errors.fiscalCode}>
            <Input maxLength={20} autoComplete="off" data-testid="fiscal-issuer-fiscal-code" {...register('fiscalCode')} />
          </Field>
        )
      ) : null}

      <details
        open={opened || optionProblem}
        onToggle={(event) => setOpened(event.currentTarget.open)}
        className="min-w-0 text-sm"
        data-testid="fiscal-issuer-more-options"
      >
        <summary className="flex min-h-11 cursor-pointer items-center text-foreground/70">{t('fiscalDocuments.issuer.data.moreOptions')}</summary>
        <div className="flex flex-col gap-5 pb-2 pt-2">
          <p className="text-foreground/70">{t('fiscalDocuments.issuer.data.moreOptionsHint')}</p>
          <Field
            label={t('fiscalDocuments.issuer.data.fatturaPaRegimeCode.label')}
            hint={t('fiscalDocuments.issuer.data.fatturaPaRegimeCode.hint')}
            example={proposedRegimeCode(regime)}
            optional
            error={errors.fatturaPaRegimeCode}
          >
            <Input maxLength={4} autoComplete="off" data-testid="fiscal-issuer-regime-code" {...register('fatturaPaRegimeCode')} />
          </Field>
          <Field
            label={t('fiscalDocuments.issuer.data.issuerSdiRecipientCode.label')}
            hint={t('fiscalDocuments.issuer.data.issuerSdiRecipientCode.hint')}
            example="ABC1234"
            optional
            error={errors.issuerSdiRecipientCode}
          >
            <Input maxLength={7} autoComplete="off" data-testid="fiscal-issuer-sdi-code" {...register('issuerSdiRecipientCode')} />
          </Field>
          <Field
            label={t('fiscalDocuments.issuer.data.issuerPec.label')}
            hint={t('fiscalDocuments.issuer.data.issuerPec.hint')}
            example="nome@pec.it"
            optional
            error={errors.issuerPec}
          >
            <Input type="email" autoComplete="off" data-testid="fiscal-issuer-pec" {...register('issuerPec')} />
          </Field>
          <Field
            label={t('fiscalDocuments.issuer.data.defaultSeries.label')}
            hint={t('fiscalDocuments.issuer.data.defaultSeries.hint')}
            example="2026"
            optional
            error={errors.defaultSeries}
          >
            <Input maxLength={20} autoComplete="off" data-testid="fiscal-issuer-series" {...register('defaultSeries')} />
          </Field>
        </div>
      </details>
    </div>
  );
}
