import { useTranslation } from 'react-i18next';
import { GraduationCap, Handshake, Home, Hourglass } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { getLeaseContractTypeLabel } from '@/lib/i18n-labels';
import type { LeaseOrigin, LongRentRules } from '@/types';

/** The types a contract can have, as the design lists them: the ones that cannot be chosen are shown and blocked, never hidden. */
const TYPES = ['Libero', 'Concordato', 'Transitorio', 'Studenti'] as const;
type CardType = (typeof TYPES)[number];

const ICONS: Record<CardType, LucideIcon> = { Libero: Home, Concordato: Handshake, Transitorio: Hourglass, Studenti: GraduationCap };

interface ContractTypeCardsProps {
  origin: LeaseOrigin;
  rules: LongRentRules;
  value: string;
  onChange: (type: string) => void;
  /** `id` of the first card, where the focus goes when the step says the type is missing. */
  firstId?: string;
}

/**
 * The type of the contract as cards (LR-06a, LR-D12): the libero 4+4 where the server offers it, the concordato 3+2 and the
 * transitory one for a contract already signed (`importedTypes`), the student one never («non ancora disponibile»). A canone
 * concordato made in CasaZen is prepared with the partner (ConcordatoFacile) and is chosen before the wizard starts, so here it is
 * shown and blocked. No figure is written here: the terms are in the title of the type, as the rest of the app says them.
 */
export function ContractTypeCards({ origin, rules, value, onChange, firstId }: ContractTypeCardsProps) {
  const { t } = useTranslation();
  const allowed = origin === 'Imported' ? rules.importedTypes : rules.availableTypes;
  // Why a card is as it is (the sentence under its name): where it can be chosen, the origin; otherwise the partner or «not yet».
  const cards = TYPES.map((type) => {
    const withPartner = origin === 'Created' && type === 'Concordato';
    const available = allowed.includes(type) && !withPartner;
    return { type, available, reason: available ? origin : withPartner ? 'partner' : 'blocked' };
  });

  return (
    <ChoiceGroup legend={t('leaseWizard.type.legend')} legendVisible minCardWidth={13}>
      {cards.map(({ type, available, reason }, position) => (
        <ChoiceCard
          key={type}
          id={position === 0 ? firstId : undefined}
          name="lease-type"
          value={type}
          checked={available && value === type}
          disabled={!available}
          onChange={() => onChange(type)}
          icon={ICONS[type]}
          title={type === 'Studenti' ? t('leaseWizard.type.students') : getLeaseContractTypeLabel(type, t)}
          description={t(`leaseWizard.type.description.${reason}.${type}`)}
          data-testid={`lease-type-${type}`}
        />
      ))}
    </ChoiceGroup>
  );
}
