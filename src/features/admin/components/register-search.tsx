import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';

export function RegisterSearch({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const { t } = useTranslation();
  return (
    <label className="grid w-full max-w-md gap-1.5 text-sm font-medium">
      {label}
      <span className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" type="search" placeholder={t('commandPalette.title')} value={value} onChange={event => onChange(event.target.value)} />
      </span>
    </label>
  );
}
