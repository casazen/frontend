import { Home, KeyRound, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RentalType } from '@/types';
import { cn } from '@/lib/utils';

const CARD_META: Record<
  RentalType,
  { title: string; description: string; icon: typeof Home }
> = {
  ShortTerm: {
    title: 'Affitti brevi',
    description: 'Gestisci prenotazioni short-stay su Airbnb, Booking.com e altri',
    icon: Home,
  },
  LongTerm: {
    title: 'Locazioni di lungo periodo',
    description: 'Gestisci contratti di locazione, registrazione RLI, cedolare secca',
    icon: KeyRound,
  },
  Both: {
    title: 'Entrambi',
    description: 'Accedi a entrambe le sezioni con switcher rapido',
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
        <CardTitle>{meta.title}</CardTitle>
        <CardDescription>{meta.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          className="w-full"
          disabled={isLoading}
          onClick={() => onSelect(rentalType)}
        >
          {isLoading && isSelected ? 'Configurazione...' : 'Scegli'}
        </Button>
      </CardContent>
    </Card>
  );
}
