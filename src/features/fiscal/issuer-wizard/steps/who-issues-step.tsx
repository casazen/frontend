import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FileText, Link2, UserRound, type LucideIcon } from 'lucide-react';
import { FormFieldError } from '@/components/shared/form-field-error';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import type { DocumentIssuerMode, FiscalDocumentSettings } from '@/types';
import { isChannelManagerRecommended } from '../issuer-wizard-model';
import type { IssuerWizardValues } from '../issuer-wizard-schema';

interface WhoCard {
  mode: DocumentIssuerMode;
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
  /** What the card says in place of its description while the choice cannot be taken today. */
  unavailableKey?: string;
}

/**
 * The three answers, with the words of the question. The channel manager is never named (NF-12): this is not where the host acts on its
 * site. The keys are written out so that the i18n test finds a missing translation.
 */
const CARDS: readonly WhoCard[] = [
  {
    mode: 'Octorate',
    icon: Link2,
    titleKey: 'fiscalDocuments.issuer.who.channelManager.title',
    descriptionKey: 'fiscalDocuments.issuer.who.channelManager.description',
    unavailableKey: 'fiscalDocuments.issuer.who.channelManager.unavailable',
  },
  {
    mode: 'CasaZenDirectOnly',
    icon: FileText,
    titleKey: 'fiscalDocuments.issuer.who.casazen.title',
    descriptionKey: 'fiscalDocuments.issuer.who.casazen.description',
    unavailableKey: 'fiscalDocuments.issuer.who.casazen.unavailable',
  },
  {
    mode: 'Accountant',
    icon: UserRound,
    titleKey: 'fiscalDocuments.issuer.who.accountant.title',
    descriptionKey: 'fiscalDocuments.issuer.who.accountant.description',
  },
];

interface WhoIssuesStepProps {
  settings: Pick<FiscalDocumentSettings, 'casazenIssuanceEnabled' | 'octorateConnected' | 'octorateIssuesAllBookings'>;
  /** Told as soon as a card is chosen: the steps that follow depend on it. */
  onChoose: (mode: DocumentIssuerMode) => void;
}

/** Whether the choice can be taken today: CasaZen only while issuing is on, the channel manager only once it is connected. */
function isAvailable(mode: DocumentIssuerMode, settings: WhoIssuesStepProps['settings']): boolean {
  if (mode === 'CasaZenDirectOnly') return settings.casazenIssuanceEnabled;
  if (mode === 'Octorate') return settings.octorateConnected;
  return true;
}

/**
 * Step 1, «Chi emette i documenti?»: one question, three answers that exclude each other (a booking never has two issuers). A choice that
 * cannot be taken today is shown and blocked with its reason, never hidden. The channel manager is marked as recommended only when it can
 * issue every booking (the answer to D34) and the organization is connected to it.
 */
export function WhoIssuesStep({ settings, onChoose }: WhoIssuesStepProps) {
  const { t } = useTranslation();
  const { control, setValue, formState } = useFormContext<IssuerWizardValues>();
  const chosen = useWatch({ control, name: 'mode' });
  const recommended = isChannelManagerRecommended(settings);

  // A flex column with a gap, not `space-y-*`: the group is a `fieldset` with its own margin, which the spacing of the siblings would not move.
  return (
    <div className="flex flex-col gap-3" data-testid="fiscal-issuer-who-step">
      <ChoiceGroup legend={t('fiscalDocuments.issuer.who.legend')} minCardWidth={15}>
        {CARDS.map(({ mode, icon, titleKey, descriptionKey, unavailableKey }) => {
          const blocked = !isAvailable(mode, settings);
          const title = t(titleKey);
          return (
            <ChoiceCard
              key={mode}
              name="fiscal-issuer-mode"
              value={mode}
              checked={chosen === mode}
              disabled={blocked}
              onChange={() => {
                setValue('mode', mode, { shouldDirty: true });
                onChoose(mode);
              }}
              icon={icon}
              title={
                mode === 'Octorate' && recommended ? (
                  <>
                    {title}{' '}
                    <span
                      data-testid="fiscal-issuer-recommended"
                      className="ml-1 inline-block whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 align-middle text-xs font-semibold text-primary-text"
                    >
                      {t('fiscalDocuments.issuer.who.recommended')}
                    </span>
                  </>
                ) : (
                  title
                )
              }
              description={t(blocked && unavailableKey ? unavailableKey : descriptionKey)}
              data-testid={`fiscal-issuer-mode-${mode}`}
            />
          );
        })}
      </ChoiceGroup>
      <FormFieldError error={formState.errors.mode} />
    </div>
  );
}
