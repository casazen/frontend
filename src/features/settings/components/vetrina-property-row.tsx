import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { buildPropertyBookingPath } from '@/lib/booking-url';
import { isPropertyPublishable } from '@/lib/booking-url';
import type { Property } from '@/types';

interface VetrinaPropertyRowProps {
  property: Property;
  orgSlug: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function VetrinaPropertyRow({ property, orgSlug, isSelected, onSelect }: VetrinaPropertyRowProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const bookingPath = buildPropertyBookingPath(orgSlug, property);
  const absoluteUrl = `${window.location.origin}${bookingPath}`;
  const publishable = isPropertyPublishable({ isActive: property.isActive, complianceStatus: property.complianceStatus ?? undefined });

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      toast.success(t('directBooking.urlCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('directBooking.urlCopyError'));
    }
  };

  return (
    <button
      type="button"
      data-testid="vetrina-property-row"
      onClick={() => onSelect(property.id)}
      className={`w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${
        isSelected ? 'border-primary bg-primary/5' : 'border-transparent bg-transparent'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{property.name}</p>
        <p className="truncate text-xs text-muted-foreground">{property.city}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge
          variant={publishable ? 'success' : 'secondary'}
          className="text-xs"
          data-testid="property-publish-badge"
        >
          {publishable ? t('directBooking.published') : t('directBooking.notPublished')}
        </Badge>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={t('directBooking.copyPropertyUrl')}
          data-testid="vetrina-property-copy-url"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>

        <a
          href={bookingPath}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={t('directBooking.openPropertyPage')}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </button>
  );
}
