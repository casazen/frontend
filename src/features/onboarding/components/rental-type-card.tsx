import { Home, KeyRound, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { AlignedCard, CardDescription, CardTitle } from '@/components/ui/card';
import type { RentalType } from '@/types';
import { cn } from '@/lib/utils';

type CardMetaEntry = {
  titleKey: string;
  descriptionKey: string;
  icon: typeof Home;
};

const CARD_META: Record<RentalType, CardMetaEntry> = {
  ShortTerm: {
    titleKey: 'onboarding.shortTermTitle',
    descriptionKey: 'onboarding.shortTermDescription',
    icon: Home,
  },
  LongTerm: {
    titleKey: 'onboarding.longTermTitle',
    descriptionKey: 'onboarding.longTermDescription',
    icon: KeyRound,
  },
  Both: {
    titleKey: 'onboarding.bothTitle',
    descriptionKey: 'onboarding.bothDescription',
    icon: Layers,
  },
};

const PATH_STEPS: Record<RentalType, readonly string[]> = {
  ShortTerm: ['onboarding.paths.short.property', 'onboarding.paths.short.payments', 'onboarding.paths.short.share'],
  LongTerm: ['onboarding.paths.long.property', 'onboarding.paths.long.ape', 'onboarding.paths.long.lease'],
  Both: ['onboarding.paths.both.start', 'onboarding.paths.both.finish', 'onboarding.paths.both.switch'],
};

interface RentalTypeCardProps {
  rentalType: RentalType;
  onSelect: (rentalType: RentalType) => void;
  isLoading: boolean;
  selectedType: RentalType | null;
}

export function RentalTypeCard({ rentalType, onSelect, isLoading, selectedType }: RentalTypeCardProps) {
  const { t } = useTranslation();
  const meta = CARD_META[rentalType];
  const Icon = meta.icon;
  const isSelected = selectedType === rentalType;

  return (
    <AlignedCard
      rows={5}
      className={cn(
        'rounded-2xl transition-shadow hover:shadow-md',
        isSelected && 'ring-2 ring-primary',
      )}
    >
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <CardTitle id={`rental-type-${rentalType}`} className="mb-1.5">{t(meta.titleKey)}</CardTitle>
      <CardDescription className="mb-6">{t(meta.descriptionKey)}</CardDescription>
      <details className="mb-4">
        <summary className="cursor-pointer rounded py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring">{t('onboarding.then')}</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
          {PATH_STEPS[rentalType].map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ol>
      </details>
      <Button
        type="button"
        className="w-full rounded-full"
        disabled={isLoading}
        onClick={() => onSelect(rentalType)}
        aria-describedby={`rental-type-${rentalType}`}
      >
        {isLoading && isSelected ? t('onboarding.configuring') : t('onboarding.choose')}
      </Button>
    </AlignedCard>
  );
}
