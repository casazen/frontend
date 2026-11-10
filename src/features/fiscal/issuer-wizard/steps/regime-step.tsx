import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Briefcase, Percent, Receipt, UserRound } from 'lucide-react';
import { FormFieldError } from '@/components/shared/form-field-error';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { regimeOfAnswers, type IssuerWizardValues } from '../issuer-wizard-schema';
import { DocumentExample } from './document-example';

/**
 * Step 2, «Che regime hai?»: two simple questions that lead to the regime of the issuer. First «Hai una partita IVA?»; only whoever has one is
 * asked the second, which regime it applies. Under the answers, the example of the document the regime gives, as soon as the answers lead to one.
 * The regime of the invoice of an agency to its owners does not exist here: CasaZen does not issue it.
 */
export function RegimeStep() {
  const { t } = useTranslation();
  const { control, setValue, formState } = useFormContext<IssuerWizardValues>();
  const hasVatNumber = useWatch({ control, name: 'hasVatNumber' });
  const vatRegime = useWatch({ control, name: 'vatRegime' });
  const regime = regimeOfAnswers({ hasVatNumber, vatRegime });

  // Flex columns with a gap, not `space-y-*`: a `ChoiceGroup` is a `fieldset` with its own margin, which the spacing of the siblings would not move.
  return (
    <div className="flex flex-col gap-6" data-testid="fiscal-issuer-regime-step">
      <div className="flex flex-col gap-3">
        <ChoiceGroup legend={t('fiscalDocuments.issuer.regime.hasVatNumber.legend')} legendVisible minCardWidth={15}>
          <ChoiceCard
            name="fiscal-issuer-has-vat"
            value="yes"
            checked={hasVatNumber === 'yes'}
            onChange={() => setValue('hasVatNumber', 'yes', { shouldDirty: true })}
            icon={Briefcase}
            title={t('fiscalDocuments.issuer.regime.hasVatNumber.yes.title')}
            description={t('fiscalDocuments.issuer.regime.hasVatNumber.yes.description')}
            data-testid="fiscal-issuer-vat-yes"
          />
          <ChoiceCard
            name="fiscal-issuer-has-vat"
            value="no"
            checked={hasVatNumber === 'no'}
            onChange={() => {
              setValue('hasVatNumber', 'no', { shouldDirty: true });
              // The second question is not asked of a private person: its answer goes, or the draft would keep one nobody gave.
              setValue('vatRegime', null, { shouldDirty: true });
            }}
            icon={UserRound}
            title={t('fiscalDocuments.issuer.regime.hasVatNumber.no.title')}
            description={t('fiscalDocuments.issuer.regime.hasVatNumber.no.description')}
            data-testid="fiscal-issuer-vat-no"
          />
        </ChoiceGroup>
        <FormFieldError error={formState.errors.hasVatNumber} />
      </div>

      {hasVatNumber === 'yes' ? (
        <div className="flex flex-col gap-3" data-testid="fiscal-issuer-vat-regime">
          <ChoiceGroup legend={t('fiscalDocuments.issuer.regime.vatRegime.legend')} legendVisible minCardWidth={15}>
            <ChoiceCard
              name="fiscal-issuer-vat-regime"
              value="ordinary"
              checked={vatRegime === 'ordinary'}
              onChange={() => setValue('vatRegime', 'ordinary', { shouldDirty: true })}
              icon={Percent}
              title={t('fiscalDocuments.issuer.regime.vatRegime.ordinary.title')}
              description={t('fiscalDocuments.issuer.regime.vatRegime.ordinary.description')}
              data-testid="fiscal-issuer-vat-regime-ordinary"
            />
            <ChoiceCard
              name="fiscal-issuer-vat-regime"
              value="flatRate"
              checked={vatRegime === 'flatRate'}
              onChange={() => setValue('vatRegime', 'flatRate', { shouldDirty: true })}
              icon={Receipt}
              title={t('fiscalDocuments.issuer.regime.vatRegime.flatRate.title')}
              description={t('fiscalDocuments.issuer.regime.vatRegime.flatRate.description')}
              data-testid="fiscal-issuer-vat-regime-flatRate"
            />
          </ChoiceGroup>
          <p className="text-sm text-foreground/70">{t('fiscalDocuments.issuer.regime.vatRegime.hint')}</p>
          <FormFieldError error={formState.errors.vatRegime} />
        </div>
      ) : null}

      {regime ? <DocumentExample regime={regime} /> : null}
    </div>
  );
}
