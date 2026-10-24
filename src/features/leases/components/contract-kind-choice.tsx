import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Handshake, Home, Hourglass } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { cn } from '@/lib/utils';
import { CONTRACT_KINDS, type ContractKind } from '../lib/contract-kind';

const ICONS: Record<ContractKind, LucideIcon> = { concordato: Handshake, libero: Home, transitorio: Hourglass };

/**
 * The one question a new contract starts with: «Che contratto vuoi fare?», answered with a type. Everything after it depends on the
 * answer: the second screen asks how it is made (`StartWayChoice`). Nothing is chosen at first, and «Continua» waits for an answer.
 */
export function ContractKindChoice({ onChoose }: { onChoose: (kind: ContractKind) => void }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<ContractKind | null>(null);

  return (
    // A gap and not `space-y`: the `fieldset` of the cards resets its own margin (`m-0`), so the button would touch them.
    <form
      className={cn(FOCUS_COLUMN, 'flex flex-col gap-8')}
      data-testid="lease-kind-choice"
      onSubmit={(event) => {
        event.preventDefault();
        if (kind) onChoose(kind);
      }}
    >
      <ChoiceGroup legend={t('leaseWizard.start.kind.legend')} legendVisible minCardWidth={14}>
        {CONTRACT_KINDS.map((option) => (
          <ChoiceCard
            key={option}
            name="lease-kind"
            value={option}
            checked={kind === option}
            onChange={() => setKind(option)}
            icon={ICONS[option]}
            title={t(`leaseWizard.start.kind.${option}.title`)}
            description={t(`leaseWizard.start.kind.${option}.description`)}
            data-testid={`lease-kind-${option}`}
          />
        ))}
      </ChoiceGroup>
      <div>
        <Button type="submit" disabled={kind === null} data-testid="lease-kind-continue">
          {t('leaseWizard.start.continue')}
        </Button>
      </div>
    </form>
  );
}
