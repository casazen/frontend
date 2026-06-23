import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { CinStatus } from '@/types';
import { cn } from '@/lib/utils';

interface PropertyCinBadgeProps {
  cinStatus: CinStatus;
  cinCode?: string | null;
  onEdit?: () => void;
}

export function PropertyCinBadge({ cinStatus, cinCode, onEdit }: PropertyCinBadgeProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const badgeKey = cinStatus === 'Valid' ? 'valid' : cinStatus === 'Missing' ? 'missing' : 'invalid';
  const variant: 'success' | 'warning' | 'destructive' =
    cinStatus === 'Valid' ? 'success' : cinStatus === 'Missing' ? 'warning' : 'destructive';

  const label = t(`property.cin.badge.${badgeKey}`);
  const tooltipKey = `tooltip${cinStatus === 'Valid' ? 'Valid' : cinStatus === 'Missing' ? 'Missing' : 'Invalid'}` as const;
  const tooltipLabel = t(`property.cin.badge.${tooltipKey}`);

  const handleClick = () => {
    if (onEdit) {
      onEdit();
      return;
    }
    setOpen((prev) => !prev);
  };

  const ariaLabel = onEdit
    ? t('property.cin.badge.editAria', { label })
    : t('property.cin.badge.aria', { label });

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        className="focus:outline-none focus:ring-2 focus:ring-ring rounded-full"
        aria-label={ariaLabel}
      >
        <Badge variant={variant} className="cursor-pointer text-sm px-3 py-1">
          {label}
          {cinCode ? ` · ${cinCode}` : ''}
        </Badge>
      </button>
      {!onEdit && open && (
        <div
          role="tooltip"
          className={cn(
            'absolute z-10 mt-2 w-72 rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md',
            'right-0'
          )}
        >
          <p>{tooltipLabel}</p>
        </div>
      )}
    </div>
  );
}
