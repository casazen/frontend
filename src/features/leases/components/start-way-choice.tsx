import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared/error-state';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { cn } from '@/lib/utils';
import { useLongRentRules } from '@/queries/use-lease-draft';
import { TYPE_OF_KIND, type ContractKind, type StartWay } from '../lib/contract-kind';
import { ChoiceList, type ChoiceListOption } from './choice-list';

interface WayOption extends Omit<ChoiceListOption, 'value'> {
  value: StartWay;
}

/**
 * The two answers of the second question and the button that goes on (LR-WIZ-1). Nothing is chosen at first. The button says where it
 * leads once an answer is chosen («Continua: carica i documenti») and is pressable before: it puts the focus on the list and a line says
 * to choose.
 */
function WayForm({ legend, options, busy, onChoose }: { legend: string; options: WayOption[]; busy?: boolean; onChoose: (way: StartWay) => void }) {
  const { t } = useTranslation();
  const form = useRef<HTMLFormElement>(null);
  const [way, setWay] = useState<StartWay | null>(null);
  const [asked, setAsked] = useState(false);
  // An answer that is not open any more (the rules or the flags arrived after it) does not count.
  const answer = options.find((option) => option.value === way && !option.disabled)?.value ?? null;

  return (
    <form
      ref={form}
      className={cn(FOCUS_COLUMN, 'flex flex-col gap-6')}
      data-testid="lease-way-choice"
      aria-busy={busy}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (answer) {
          onChoose(answer);
          return;
        }
        setAsked(true);
        form.current?.querySelector<HTMLInputElement>('input[type="radio"]:not(:disabled)')?.focus();
      }}
    >
      <ChoiceList
        legend={legend}
        name="lease-way"
        value={answer ?? ''}
        onChange={(value) => setWay(value as StartWay)}
        options={options}
      />
      {asked && answer === null ? (
        <p role="alert" className="rounded-md bg-[color:var(--color-warning-soft,#fdf3df)] px-3 py-2 text-sm" data-testid="lease-way-choose">
          {t('leaseWizardGuide.start.how.choose')}
        </p>
      ) : null}
      <div>
        <Button type="submit" iconRight={<ArrowRight />} className="h-auto min-h-11 whitespace-normal py-2 text-center leading-tight max-sm:w-full" data-testid="lease-way-continue">
          {t(`leaseWizardGuide.start.how.continue.${answer ?? 'none'}`)}
        </Button>
      </div>
    </form>
  );
}

/**
 * A canone concordato: only «do you already have everything?». Yes: the documents are uploaded and that is all. No: it starts from
 * zero with the guided form (pay, then the form with our signed link), which is open only while that service is on (flag
 * `concordatoFacile`): off, the answer is there, closed, with a quiet «disponibile a breve».
 */
function ConcordatoWays({ onChoose }: { onChoose: (way: StartWay) => void }) {
  const { t } = useTranslation();
  const { flags, isLoading } = useFeatureFlags();
  const guidedFormOn = flags.concordatoFacile;

  return (
    <WayForm
      legend={t('leaseWizard.start.concordato.legend')}
      onChoose={onChoose}
      options={[
        {
          value: 'documenti',
          title: t('leaseWizard.start.concordato.documents.title'),
          description: t('leaseWizardGuide.start.how.documents.concordato'),
          testId: 'lease-way-documenti',
        },
        {
          value: 'zero',
          title: t('leaseWizard.start.concordato.zero.title'),
          // While the flags load the answer is closed all the same (fail closed), but it does not say «soon» for a moment and take it back.
          description: guidedFormOn || isLoading ? t('leaseWizard.start.concordato.zero.description') : t('leaseWizard.start.concordato.zero.soon'),
          disabled: !guidedFormOn,
          testId: 'lease-way-zero',
        },
      ]}
    />
  );
}

/**
 * A libero or a transitory: «Come vuoi procedere?». Whether CasaZen can prepare the type is the server's to say (`availableTypes` of
 * `GET /long-rent/rules`, nothing is written here): a type it cannot prepare keeps its answer, closed, with an honest sentence, and
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
          value: 'casazen',
          title: t('leaseWizard.start.other.casazen.title'),
          description: preparable || rules.isLoading ? t('leaseWizard.start.other.casazen.description') : t(`leaseWizard.start.other.casazen.unavailable.${kind}`),
          disabled: !preparable,
          testId: 'lease-way-casazen',
        },
        {
          value: 'documenti',
          title: t('leaseWizard.start.other.documents.title'),
          description: t('leaseWizardGuide.start.how.documents.other'),
          testId: 'lease-way-documenti',
        },
      ]}
    />
  );
}

/** The second question of a new contract, after its type: how it is made. The answers depend on the type. */
export function StartWayChoice({ kind, onChoose }: { kind: ContractKind; onChoose: (way: StartWay) => void }) {
  return kind === 'concordato' ? <ConcordatoWays onChoose={onChoose} /> : <PreparableWays kind={kind} onChoose={onChoose} />;
}
