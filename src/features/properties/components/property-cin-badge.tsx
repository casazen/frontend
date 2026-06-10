import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { CinStatus } from '@/types';
import { cn } from '@/lib/utils';

const CIN_CONFIG: Record<CinStatus, { variant: 'success' | 'warning' | 'destructive'; label: string; tooltip: string }> = {
  Valid: {
    variant: 'success',
    label: 'CIN valido',
    tooltip:
      'Obbligo di registrazione BDSR (D.L. 145/2023). Il codice CIN è conforme al formato IT-XXXXX-XXXXXXXXXX.',
  },
  Missing: {
    variant: 'warning',
    label: 'CIN mancante',
    tooltip:
      'Obbligo di registrazione BDSR (D.L. 145/2023). Mancata comunicazione del CIN può comportare sanzioni.',
  },
  Invalid: {
    variant: 'destructive',
    label: 'CIN non valido',
    tooltip:
      'Formato richiesto: IT-XXXXX-XXXXXXXXXX (5 cifre struttura + 10 cifre unità) secondo D.L. 145/2023.',
  },
};

interface PropertyCinBadgeProps {
  cinStatus: CinStatus;
  cinCode?: string | null;
  onEdit?: () => void;
}

export function PropertyCinBadge({ cinStatus, cinCode, onEdit }: PropertyCinBadgeProps) {
  const [open, setOpen] = useState(false);
  const config = CIN_CONFIG[cinStatus];

  const handleClick = () => {
    if (onEdit) {
      onEdit();
      return;
    }
    setOpen((prev) => !prev);
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        className="focus:outline-none focus:ring-2 focus:ring-ring rounded-full"
        aria-label={`Stato CIN: ${config.label}${onEdit ? '. Clicca per modificare' : ''}`}
      >
        <Badge variant={config.variant} className="cursor-pointer text-sm px-3 py-1">
          {config.label}
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
          <p>{config.tooltip}</p>
        </div>
      )}
    </div>
  );
}
