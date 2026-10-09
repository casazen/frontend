import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { withListReturn } from '@/lib/list-return';
import { cn } from '@/lib/utils';

interface BackLinkProps {
  /**
   * Where it leads: the page above this one. When that is a list that remembers its filters (`useListReturn`) the link
   * leads to it as the user left it.
   */
  to: string;
  /** The name of that page ("Prenotazioni"): the link reads "← Prenotazioni", a screen reader "Torna a Prenotazioni". */
  label: string;
  className?: string;
}

/**
 * The way back to the page above, for a phone (UI-05): where the breadcrumb of a computer would be, a link a thumb can hit
 * (44 px tall). From `md` up it is hidden, the breadcrumb takes its place; pass a `className` to show it there too.
 */
export function BackLink({ to, label, className }: BackLinkProps) {
  const { t } = useTranslation();

  return (
    <Link
      to={withListReturn(to)}
      data-testid="back-link"
      aria-label={t('pageHeader.backTo', { name: label })}
      className={cn(
        '-ml-1.5 inline-flex min-h-11 items-center gap-1.5 self-start rounded-md px-1.5 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:hidden',
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}
