import { useTranslation } from 'react-i18next';
import type { CinStatus } from '@/types';
import { cn } from '@/lib/utils';

interface PublicCinLabelProps {
  cinStatus: CinStatus;
  cinCode?: string | null;
  className?: string;
}

/**
 * CIN as shown to guests (public site, search results): the code as plain information, only when it is
 * valid. The compliance state ("missing", "invalid") is for the host only and appears in the host app
 * (PropertyCinBadge), never on guest-facing pages.
 */
export function PublicCinLabel({ cinStatus, cinCode, className }: PublicCinLabelProps) {
  const { t } = useTranslation();
  if (cinStatus !== 'Valid' || !cinCode) return null;

  return (
    <p className={cn('text-sm text-muted-foreground', className)} data-testid="public-cin">
      {t('property.cin.public', { code: cinCode })}
    </p>
  );
}
