import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** How long the words of the search rest before the page asks for them. */
const SEARCH_DELAY_MS = 300;

interface SupplierSearchBoxProps {
  /** The words in the address (the page of the search); nothing on Scopri. */
  value?: string;
  /**
   * The words are ready: with `live` after the person stopped typing for a moment, always when the form is sent (Enter). On
   * Scopri nothing is asked while the person types (`live` off): the search is a page of its own and Enter leads to it.
   */
  onSearch: (words: string) => void;
  live?: boolean;
}

/**
 * The search of the marketplace (MKT): one box for a supplier, a service or a category. The words are what the person typed, spaces
 * and all (the page trims them to ask); while the person types the box shows what was typed, and when the words are handed on it
 * follows the address again, so Back and a shared link are shown as they are.
 */
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
          className="pl-9"
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
