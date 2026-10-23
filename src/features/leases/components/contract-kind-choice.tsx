import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilePen, Handshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { cn } from '@/lib/utils';
import type { ContractKind } from '../lib/contract-kind';

/** The first question of a new contract: everything after it depends on the answer. */
export function ContractKindChoice({ onChoose }: { onChoose: (kind: ContractKind) => void }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<ContractKind | null>(null);

  return (
    // A gap and not `space-y`: the `fieldset` of the cards resets its own margin (`m-0`), so the button would touch them.
    <form
      className={cn(FOCUS_COLUMN, 'flex flex-col gap-6')}
      data-testid="lease-kind-choice"
      onSubmit={(event) => {
        event.preventDefault();
        if (kind) onChoose(kind);
      }}
    >
      <ChoiceGroup legend={t('leases.kind.legend')} legendVisible minCardWidth={16}>
        <ChoiceCard
          name="lease-kind"
          value="concordato"
          checked={kind === 'concordato'}
          onChange={() => setKind('concordato')}
          icon={Handshake}
          title={t('leases.kind.concordato.title')}
          description={t('leases.kind.concordato.description')}
          data-testid="lease-kind-concordato"
        />
        <ChoiceCard
          name="lease-kind"
          value="altro"
          checked={kind === 'altro'}
          onChange={() => setKind('altro')}
          icon={FilePen}
          title={t('leases.kind.other.title')}
          description={t('leases.kind.other.description')}
          data-testid="lease-kind-other"
        />
      </ChoiceGroup>
      <div>
        <Button type="submit" disabled={!kind} data-testid="lease-kind-continue">
          {t('leases.kind.continue')}
        </Button>
      </div>
    </form>
  );
}
