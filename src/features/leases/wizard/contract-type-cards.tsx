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

/** Where the line that says what each type is lives (the same lines as the first question of «Nuovo contratto»). */
const KIND_OF_TYPE = { Libero: 'libero', Concordato: 'concordato', Transitorio: 'transitorio' } as const;

interface ContractTypeCardsProps {
  origin: LeaseOrigin;
  rules: LongRentRules;
  value: string;
  onChange: (type: string) => void;
  /** `id` of the first card, where the focus goes when the step says the type is missing. */
  firstId?: string;
}

/**
 * The type a contract made in CasaZen has, chosen as the first question of «Nuovo contratto»: shown as a fact, with no cards to choose
 * from (the canone concordato is made with the partner, not here). It has the `id` the cards would give their first one, so that
 * «Resta da fare» still puts the focus on it.
 */
function ChosenType({ type, id }: { type: CardType; id?: string }) {
  const { t } = useTranslation();
  const Icon = ICONS[type];
  return (
    <div className="space-y-2" data-testid="lease-type-chosen">
      <p className="text-sm font-medium">{t('leaseWizard.type.legend')}</p>
      <div id={id} tabIndex={-1} className="flex min-w-0 items-center gap-3 rounded-xl border bg-muted/30 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block break-words font-semibold leading-snug">{getLeaseContractTypeLabel(type, t)}</span>
          <span className="block break-words text-sm text-foreground/70">{t('leaseWizard.type.chosen')}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * The type of the contract as cards (LR-06a, LR-D12): the libero 4+4 and the transitory one (since TR) where the server offers them
 * (`availableTypes`), the concordato 3+2 and all of them for a contract already signed (`importedTypes`), the student one never
 * («non ancora disponibile»). A canone
 * concordato made in CasaZen is prepared with the partner (ConcordatoFacile) and is chosen before the wizard starts, so here it is
 * shown and blocked. No figure is written here: the terms are in the title of the type, as the rest of the app says them.
 *
 * The type is the first question of «Nuovo contratto» (NL-FLOW), so a contract made in CasaZen that already has one the server lets it
 * make is not asked again: it is shown as chosen. One already signed keeps the cards, with the type chosen at the start checked: the
 * documents may say otherwise, and it is corrected here.
 */
export function ContractTypeCards({ origin, rules, value, onChange, firstId }: ContractTypeCardsProps) {
  const { t } = useTranslation();
  const allowed = origin === 'Imported' ? rules.importedTypes : rules.availableTypes;
  const chosen = TYPES.find((type) => type === value && type !== 'Concordato' && allowed.includes(type));
  if (origin === 'Created' && chosen) return <ChosenType type={chosen} id={firstId} />;

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
          description={available && type !== 'Studenti' ? t(`leaseWizardGuide.start.kind.${KIND_OF_TYPE[type]}`) : t(`leaseWizard.type.description.${reason}.${type}`)}
          data-testid={`lease-type-${type}`}
        />
      ))}
    </ChoiceGroup>
  );
}
