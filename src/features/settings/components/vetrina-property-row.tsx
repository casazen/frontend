import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, ExternalLink, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { propertySiteUrl } from '@/lib/booking-link';
import { isPropertyPublishable } from '@/lib/booking-url';
import type { Property } from '@/types';
import { copySiteAddress } from '../domain/copy-site-address';
import type { OrgBookingSite } from '../domain/use-org-domain';
import { BookingLinkDialog } from './booking-link-dialog';

interface VetrinaPropertyRowProps {
  property: Property;
  /** Where the links of the site are (its own host or the platform): the address the row copies and opens is on it, not on the address of this page. */
  bookingSite: OrgBookingSite;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function VetrinaPropertyRow({ property, bookingSite, isSelected, onSelect }: VetrinaPropertyRowProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const propertyUrl = propertySiteUrl(bookingSite.site, property);
  const publishable = isPropertyPublishable({
    isActive: property.isActive,
    isPaused: property.isPaused,
    complianceStatus: property.complianceStatus ?? undefined,
  });

  // The address is copied once it is known: while the settings of the site are on their way nothing is, and when they could not be read the host is told that what it
  // got is the address of CasaZen (`copySiteAddress`).
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!(await copySiteAddress(propertyUrl, bookingSite.status, t))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button
        type="button"
        data-testid="vetrina-property-row"
        onClick={() => onSelect(property.id)}
        className={`w-full flex items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${
          isSelected ? 'border-primary bg-primary/5' : 'border-transparent bg-transparent'
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{property.name}</p>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <p className="truncate text-xs text-muted-foreground">{property.city}</p>
            <Badge
              variant={publishable ? 'success' : 'secondary'}
              className="shrink-0 px-1.5 py-0 text-[10px]"
              data-testid="property-publish-badge"
            >
              {publishable ? t('directBooking.published') : t('directBooking.notPublished')}
            </Badge>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t('directBooking.copyPropertyUrl')}
            data-testid="vetrina-property-copy-url"
            disabled={bookingSite.status === 'loading'}
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>

          {/* The link for the website of the agency (NF-123): dates, guests, language and campaign, with its QR. */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t('directBooking.bookingLink.open', { name: property.name })}
            data-testid="vetrina-property-booking-link"
            onClick={(e) => {
              e.stopPropagation();
              setLinkOpen(true);
            }}
          >
            <Link2 className="h-3.5 w-3.5" />
          </Button>

          <a
            href={propertyUrl}
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

      {/* Beside the row and not inside it: a press in the dialog never reaches the row, which would select the home. */}
      <BookingLinkDialog open={linkOpen} onOpenChange={setLinkOpen} property={property} publishable={publishable} bookingSite={bookingSite} />
    </>
  );
}
