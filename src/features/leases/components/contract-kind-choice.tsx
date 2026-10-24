import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCheck2, FilePen, Handshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { cn } from '@/lib/utils';
import type { LeaseOrigin } from '@/types';
import type { ContractKind } from '../lib/contract-kind';

/** What the first questions of a new contract decide: how the lease comes to be, and how it is prepared. */
export interface StartAnswer {
  origin: LeaseOrigin;
  kind: ContractKind;
}

/**
 * The first questions of a new contract: everything after them depends on the answers. Made in CasaZen or already signed elsewhere
 * (LR-06a: it is chosen once and never changes, because it decides the steps and what the server asks) and, for one made in CasaZen,
 * which kind (LR-D12): a canone concordato is prepared with the partner, any other is filled in on the wizard. A contract already
 * signed is filled in on the wizard whatever its type: the type is chosen in the step of the conditions, among the ones the server
 * offers for it.
 */
export function ContractKindChoice({ onChoose }: { onChoose: (answer: StartAnswer) => void }) {
  const { t } = useTranslation();
  const [origin, setOrigin] = useState<LeaseOrigin>('Created');
  const [kind, setKind] = useState<ContractKind | null>(null);
  const ready = origin === 'Imported' || kind !== null;

  return (
    // A gap and not `space-y`: the `fieldset` of the cards resets its own margin (`m-0`), so the button would touch them.
    <form
      className={cn(FOCUS_COLUMN, 'flex flex-col gap-8')}
      data-testid="lease-kind-choice"
      onSubmit={(event) => {
        event.preventDefault();
        if (origin === 'Imported') onChoose({ origin, kind: 'altro' });
        else if (kind) onChoose({ origin, kind });
      }}
    >
      <ChoiceGroup legend={t('leaseWizard.start.origin.legend')} legendVisible minCardWidth={16}>
        <ChoiceCard
          name="lease-origin"
          value="Created"
          checked={origin === 'Created'}
          onChange={() => setOrigin('Created')}
          icon={FilePen}
          title={t('leaseWizard.start.origin.created.title')}
          description={t('leaseWizard.start.origin.created.description')}
          data-testid="lease-origin-created"
        />
        <ChoiceCard
          name="lease-origin"
          value="Imported"
          checked={origin === 'Imported'}
          onChange={() => setOrigin('Imported')}
          icon={FileCheck2}
          title={t('leaseWizard.start.origin.imported.title')}
          description={t('leaseWizard.start.origin.imported.description')}
          data-testid="lease-origin-imported"
        />
      </ChoiceGroup>
      {origin === 'Created' ? (
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
      ) : null}
      <div>
        <Button type="submit" disabled={!ready} data-testid="lease-kind-continue">
          {t('leases.kind.continue')}
        </Button>
      </div>
    </form>
  );
}
