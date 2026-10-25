import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { cn } from '@/lib/utils';
import { useLongRentRules } from '@/queries/use-lease-draft';
import { WhyAsk } from '../wizard/why-ask';
import { CONTRACT_KINDS, kindTitle, type ContractKind } from '../lib/contract-kind';
import { ChoiceList } from './choice-list';

/**
 * The one question a new contract starts with: «Che contratto vuoi fare?», answered with a type. Everything after it depends on the
 * answer: the second screen asks how it is made (`StartWayChoice`). Nothing is chosen at first. The answers are one quiet list with a
 * line under each (LR-WIZ-1) and a «Quale scegliere?» that compares them in three lines; the main button is pressable at once: with
 * nothing chosen it puts the focus on the list and a line says to choose. The term the transitory answer names is the server's (`rules`);
 * the question does not wait for it.
 */
export function ContractKindChoice({ onChoose }: { onChoose: (kind: ContractKind) => void }) {
  const { t } = useTranslation();
  const rules = useLongRentRules();
  const form = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<ContractKind | null>(null);
  const [asked, setAsked] = useState(false);
  const term = rules.data?.transitoryTermMonths;

  return (
    <form
      ref={form}
      className={cn(FOCUS_COLUMN, 'flex flex-col gap-6')}
      data-testid="lease-kind-choice"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (kind) {
          onChoose(kind);
          return;
        }
        setAsked(true);
        form.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
      }}
    >
      <div className="space-y-2">
        <ChoiceList
          legend={t('leaseWizard.start.kind.legend')}
          name="lease-kind"
          value={kind ?? ''}
          onChange={(value) => setKind(value as ContractKind)}
          options={CONTRACT_KINDS.map((option) => ({
            value: option,
            title: kindTitle(option, rules.data, t),
            description: t(`leaseWizardGuide.start.kind.${option}`),
            testId: `lease-kind-${option}`,
          }))}
        />
        <WhyAsk summary={t('leaseWizardGuide.start.which.help.summary')}>
          <ul className="space-y-1">
            <li>{t('leaseWizardGuide.start.which.help.libero')}</li>
            <li>{t('leaseWizardGuide.start.which.help.concordato')}</li>
            <li>{term ? t('leaseWizardGuide.start.which.help.transitorio', { min: term.min, max: term.max }) : t('leaseWizardGuide.start.which.help.transitorioBare')}</li>
          </ul>
        </WhyAsk>
      </div>
      {asked && kind === null ? (
        <p role="alert" className="rounded-md bg-[color:var(--color-warning-soft,#fdf3df)] px-3 py-2 text-sm" data-testid="lease-kind-choose">
          {t('leaseWizardGuide.start.which.choose')}
        </p>
      ) : null}
      <div>
        <Button type="submit" iconRight={<ArrowRight />} className="h-auto min-h-11 whitespace-normal py-2 text-center leading-tight max-sm:w-full" data-testid="lease-kind-continue">
          {t('leaseWizardGuide.start.which.continue')}
        </Button>
      </div>
    </form>
  );
}
