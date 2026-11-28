import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SEARCH_DELAY_MS = 300;

interface SupplierSearchBoxProps {
  value?: string;
  onSearch: (words: string) => void;
  live?: boolean;
}

export function SupplierSearchBox({ value = '', onSearch, live = false }: SupplierSearchBoxProps) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const hand = (words: string) => {
    clearTimeout(timer.current);
    onSearch(words);
    setTyped(null);
  };

  return (
    <form
      role="search"
      className="min-w-0"
      onSubmit={(event) => {
        event.preventDefault();
        hand(typed ?? value);
      }}
    >
      <Label htmlFor="marketplace-search" className="sr-only">
        {t('marketplace.search.label')}
      </Label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="marketplace-search"
          type="search"
          value={typed ?? value}
          placeholder={t('marketplace.search.placeholder')}
          className="min-h-11 rounded-xl pl-9"
          data-testid="marketplace-search"
          onChange={(event) => {
            const words = event.target.value;
            setTyped(words);
            clearTimeout(timer.current);
            if (live) timer.current = setTimeout(() => hand(words), SEARCH_DELAY_MS);
          }}
        />
      </div>
    </form>
  );
}
