import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCheck2, FilePen, FilePlus2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { ErrorState } from '@/components/shared/error-state';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { cn } from '@/lib/utils';
import { useLongRentRules } from '@/queries/use-lease-draft';
import { TYPE_OF_KIND, type ContractKind, type StartWay } from '../lib/contract-kind';

interface WayOption {
  way: StartWay;
  icon: LucideIcon;
  title: string;
  description: string;
  disabled?: boolean;
}

/** The two cards of the second question and the button that goes on. Nothing is chosen at first. */
function WayForm({ legend, options, busy, onChoose }: { legend: string; options: WayOption[]; busy?: boolean; onChoose: (way: StartWay) => void }) {
  const { t } = useTranslation();
  const [way, setWay] = useState<StartWay | null>(null);
  // An answer that is not open any more (the rules or the flags arrived after it) does not count.
  const answer = options.find((option) => option.way === way && !option.disabled)?.way ?? null;

  return (
    // A gap and not `space-y`: the `fieldset` of the cards resets its own margin (`m-0`), so the button would touch them.
    <form
      className={cn(FOCUS_COLUMN, 'flex flex-col gap-8')}
      data-testid="lease-way-choice"
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        if (answer) onChoose(answer);
      }}
    >
      <ChoiceGroup legend={legend} legendVisible minCardWidth={16}>
        {options.map((option) => (
          <ChoiceCard
            key={option.way}
            name="lease-way"
            value={option.way}
            checked={answer === option.way}
            disabled={option.disabled}
            onChange={() => setWay(option.way)}
            icon={option.icon}
            title={option.title}
            description={option.description}
            data-testid={`lease-way-${option.way}`}
          />
        ))}
      </ChoiceGroup>
      <div>
        <Button type="submit" disabled={answer === null} data-testid="lease-way-continue">
          {t('leaseWizard.start.continue')}
        </Button>
      </div>
    </form>
  );
}

/**
 * A canone concordato: only «do you already have everything?». Yes: the documents are uploaded and that is all. No: it starts from
 * zero with the partner (pay, then the form of ConcordatoFacile with our signed link), which is open only while the partner's service
 * is on (flag `concordatoFacile`): off, the card is there, closed, with a quiet «disponibile a breve».
 */
function ConcordatoWays({ onChoose }: { onChoose: (way: StartWay) => void }) {
  const { t } = useTranslation();
  const { flags, isLoading } = useFeatureFlags();
  const partnerOn = flags.concordatoFacile;

  return (
    <WayForm
      legend={t('leaseWizard.start.concordato.legend')}
      onChoose={onChoose}
      options={[
        {
          way: 'documenti',
          icon: FileCheck2,
          title: t('leaseWizard.start.concordato.documents.title'),
          description: t('leaseWizard.start.concordato.documents.description'),
        },
        {
          way: 'zero',
          icon: FilePlus2,
          title: t('leaseWizard.start.concordato.zero.title'),
          // While the flags load the card is closed all the same (fail closed), but it does not say «soon» for a moment and take it back.
          description: partnerOn || isLoading ? t('leaseWizard.start.concordato.zero.description') : t('leaseWizard.start.concordato.zero.soon'),
          disabled: !partnerOn,
        },
      ]}
    />
  );
}

/**
 * A libero or a transitory: «Come vuoi procedere?». Whether CasaZen can prepare the type is the server's to say (`availableTypes` of
 * `GET /long-rent/rules`, nothing is written here): a type it cannot prepare keeps the card, closed, with an honest sentence, and
 * «Ho già i documenti» stays open. The transitory type is open since TR (its model is the official Allegato B, still to be approved:
 * the download for the signature says so honestly at the end, as for the other types).
 */
function PreparableWays({ kind, onChoose }: { kind: Exclude<ContractKind, 'concordato'>; onChoose: (way: StartWay) => void }) {
  const { t } = useTranslation();
  const rules = useLongRentRules();

  if (rules.isError) {
    return (
      <div className={FOCUS_COLUMN}>
        <ErrorState testId="lease-way-error" title={t('leaseWizard.loadError')} error={rules.error} onRetry={() => void rules.refetch()} />
      </div>
    );
  }
  // Closed while the rules load (nothing is promised before the server answers), but without the sentence that says it cannot be done.
  const preparable = rules.data?.availableTypes.includes(TYPE_OF_KIND[kind]) ?? false;

  return (
    <WayForm
      legend={t('leaseWizard.start.other.legend')}
      busy={rules.isLoading}
      onChoose={onChoose}
      options={[
        {
          way: 'casazen',
          icon: FilePen,
          title: t('leaseWizard.start.other.casazen.title'),
          description: preparable || rules.isLoading ? t('leaseWizard.start.other.casazen.description') : t(`leaseWizard.start.other.casazen.unavailable.${kind}`),
          disabled: !preparable,
        },
        {
          way: 'documenti',
          icon: FileCheck2,
          title: t('leaseWizard.start.other.documents.title'),
          description: t('leaseWizard.start.other.documents.description'),
        },
      ]}
    />
  );
}

/** The second question of a new contract, after its type: how it is made. The cards depend on the type. */
export function StartWayChoice({ kind, onChoose }: { kind: ContractKind; onChoose: (way: StartWay) => void }) {
  return kind === 'concordato' ? <ConcordatoWays onChoose={onChoose} /> : <PreparableWays kind={kind} onChoose={onChoose} />;
}
