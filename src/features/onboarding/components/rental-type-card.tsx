import { Home, KeyRound, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card
      className={cn(
        'transition-shadow hover:shadow-md',
        isSelected && 'ring-2 ring-primary',
      )}
    >
      <CardHeader>
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
        <CardTitle>{t(meta.titleKey)}</CardTitle>
        <CardDescription>{t(meta.descriptionKey)}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          className="w-full"
          disabled={isLoading}
          onClick={() => onSelect(rentalType)}
        >
          {isLoading && isSelected ? t('onboarding.configuring') : t('onboarding.choose')}
        </Button>
      </CardContent>
    </Card>
  );
}
