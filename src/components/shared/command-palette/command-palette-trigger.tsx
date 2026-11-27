import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCommandPalette } from './command-palette-context';
import { shortcutLabel } from './shortcut';

export function CommandPaletteTrigger({ className }: { className?: string }) {
  const { t } = useTranslation();
  const palette = useCommandPalette();
  const shortcut = shortcutLabel();

  return (
    <button
      type="button"
      data-testid="command-palette-trigger"
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      onClick={(event) => palette.open(event.currentTarget)}
      className={cn(
        'flex min-h-10 w-full items-center gap-3 rounded-lg border bg-muted/40 px-3 text-left text-sm text-foreground/70 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
        'max-md:size-11 max-md:min-h-11 max-md:justify-center max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:text-foreground',
        className,
      )}
    >
      <Search aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
      <span className="min-w-0 flex-1 truncate max-md:sr-only">{t('commandPalette.placeholder')}</span>
      <kbd
        aria-hidden="true"
        className="rounded border bg-background px-1.5 py-0.5 font-sans text-[11px] font-medium text-foreground/70 max-md:hidden"
      >
        {shortcut}
      </kbd>
    </button>
  );
}
