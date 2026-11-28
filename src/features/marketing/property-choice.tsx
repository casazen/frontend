import { Home } from 'lucide-react';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import type { PropertyOption } from './property-options';

interface PropertyChoiceProps {
  legend: string;
  name: string;
  options: readonly PropertyOption[];
  value: string;
  onChange: (id: string) => void;
  testIdPrefix: string;
  minCardWidth?: number;
}

export function PropertyChoice({ legend, name, options, value, onChange, testIdPrefix, minCardWidth = 13 }: PropertyChoiceProps) {
  return (
    <div>
      <ChoiceGroup legend={legend} minCardWidth={minCardWidth}>
        {options.map((item) => (
          <ChoiceCard
            key={item.id}
            name={name}
            value={item.id}
            checked={value === item.id}
            onChange={() => onChange(item.id)}
            title={item.name}
            media={
              item.photoUrl ? (
                <img src={item.photoUrl} alt="" loading="lazy" className="h-24 w-full object-cover" />
              ) : (
                <span className="grid h-24 w-full place-items-center bg-muted text-foreground/50">
                  <Home className="size-8" />
                </span>
              )
            }
            data-testid={`${testIdPrefix}-${item.id}`}
          />
        ))}
      </ChoiceGroup>
    </div>
  );
}
