import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Qty } from '@/components/ui/qty';
import { Segmented } from '@/components/ui/segmented';
import { APP_LOCALES } from '@/hooks/use-app-locale';
import type { AppLocale } from '@/i18n/locale-storage';
import { buildAgencyBookingLink, campaignLabelToken } from '@/lib/booking-link';
import { openQrPrintSheet, useQrDataUrl } from '@/lib/qr-print-sheet';
import { addDays, todayInRome } from '@/lib/stay-dates';
import type { Property } from '@/types';
import type { OrgBookingSite } from '../domain/use-org-domain';

const COPIED_FEEDBACK_MS = 2_000;
const CAMPAIGN_MAX_LENGTH = 60;

interface BookingLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Pick<Property, 'id' | 'name' | 'slug' | 'maxGuests'>;
  publishable: boolean;
  bookingSite: OrgBookingSite;
}

export function BookingLinkDialog({ open, onOpenChange, property, publishable, bookingSite }: BookingLinkDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl sm:max-h-[90dvh] sm:overflow-y-auto" data-testid="booking-link-dialog">
        <DialogHeader>
          <DialogTitle>{t('directBooking.bookingLink.title')}</DialogTitle>
          <DialogDescription>{t('directBooking.bookingLink.description', { name: property.name })}</DialogDescription>
        </DialogHeader>
        <BookingLinkForm property={property} publishable={publishable} bookingSite={bookingSite} />
      </DialogContent>
    </Dialog>
  );
}

function BookingLinkForm({ property, publishable, bookingSite }: Omit<BookingLinkDialogProps, 'open' | 'onOpenChange'>) {
  const { t, i18n } = useTranslation();
  const maxGuests = Math.max(1, property.maxGuests);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(Math.min(2, maxGuests));
  const [language, setLanguage] = useState<AppLocale>(i18n.language.startsWith('en') ? 'en' : 'it');
  const [campaign, setCampaign] = useState('');
  const [copied, setCopied] = useState(false);

  const today = todayInRome();
  const checkInPast = checkIn !== '' && checkIn < today;
  const checkOutNotAfter = checkIn !== '' && checkOut !== '' && checkOut <= checkIn;
  const datesOk = checkIn !== '' && checkOut !== '' && !checkInPast && !checkOutNotAfter;

  const campaignToken = campaignLabelToken(campaign);
  const campaignRefused = campaign.trim() !== '' && campaignToken === '';

  const link = buildAgencyBookingLink(bookingSite.site, property, {
    checkIn: datesOk ? checkIn : '',
    checkOut: datesOk ? checkOut : '',
    guests,
    language,
    campaign,
  });
  const image = useQrDataUrl(link);
  // A link on the address of CasaZen only because the settings are still on their way is not the one to copy.
  const waiting = bookingSite.status === 'loading';

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      toast.error(t('directBooking.urlCopyError'));
    }
  };

  const print = () => {
    if (!image) return;
    const opened = openQrPrintSheet({
      title: property.name,
      lines: [i18n.getFixedT(language)('directBooking.bookingLink.printLine')],
      image,
    });
    if (!opened) toast.error(t('directBooking.bookingLink.popupBlocked'));
  };

  return (
    <div className="space-y-4" data-testid="booking-link-form">
      {!publishable ? (
        <Alert variant="warning" data-testid="booking-link-not-published">
          {t('directBooking.bookingLink.notPublished')}
        </Alert>
      ) : null}

      <div className="space-y-1.5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('directBooking.bookingLink.checkIn')} optional error={checkInPast ? t('directBooking.bookingLink.checkInPast') : undefined}>
            <Input type="date" min={today} value={checkIn} onChange={(event) => setCheckIn(event.target.value)} data-testid="booking-link-check-in" />
          </Field>
          <Field label={t('directBooking.bookingLink.checkOut')} optional error={checkOutNotAfter ? t('directBooking.bookingLink.checkOutNotAfter') : undefined}>
            <Input
              type="date"
              min={checkIn ? addDays(checkIn, 1) || today : today}
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
              data-testid="booking-link-check-out"
            />
          </Field>
        </div>
        <p className="text-sm text-muted-foreground">{t('directBooking.bookingLink.datesHint')}</p>
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div className="space-y-1.5">
          <span className="block text-sm font-medium" aria-hidden="true">
            {t('directBooking.bookingLink.guests')}
          </span>
          <Qty label={t('directBooking.bookingLink.guests')} value={guests} onChange={setGuests} min={1} max={maxGuests} testId="booking-link-guests" />
        </div>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium" aria-hidden="true">
            {t('directBooking.bookingLink.language')}
          </span>
          <Segmented
            label={t('directBooking.bookingLink.language')}
            options={APP_LOCALES.map(({ locale, nameKey }) => ({ value: locale, label: t(nameKey), testId: `booking-link-language-${locale}` }))}
            value={language}
            onValueChange={setLanguage}
          />
        </div>
      </div>

      <Field
        label={t('directBooking.bookingLink.campaign')}
        optional
        hint={
          campaignToken !== '' && campaignToken !== campaign.trim()
            ? t('directBooking.bookingLink.campaignPreview', { value: campaignToken })
            : t('directBooking.bookingLink.campaignHint')
        }
        error={campaignRefused ? t('directBooking.bookingLink.campaignRefused') : undefined}
      >
        <Input
          value={campaign}
          maxLength={CAMPAIGN_MAX_LENGTH}
          autoComplete="off"
          placeholder={t('directBooking.bookingLink.campaignPlaceholder')}
          onChange={(event) => setCampaign(event.target.value)}
          data-testid="booking-link-campaign"
        />
      </Field>

      {waiting ? (
        <p className="text-sm text-muted-foreground" role="status" data-testid="booking-link-site-loading">
          {t('directBooking.bookingLink.siteLoading')}
        </p>
      ) : null}
      {bookingSite.status === 'restricted' ? (
        <Alert variant="info" data-testid="booking-link-site-restricted">
          {t('directBooking.bookingLink.siteRestricted')}
        </Alert>
      ) : null}
      {bookingSite.status === 'failed' ? (
        <Alert
          variant="warning"
          data-testid="booking-link-site-failed"
          action={
            <Button type="button" variant="outline" size="sm" onClick={bookingSite.retry}>
              {t('directBooking.bookingLink.siteRetry')}
            </Button>
          }
        >
          {t('directBooking.bookingLink.siteFailed')}
        </Alert>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="booking-link-url">{t('directBooking.bookingLink.linkLabel')}</Label>
        <div className="flex gap-2">
          <Input
            id="booking-link-url"
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
            className="font-mono text-xs"
            data-testid="booking-link-url"
          />
          <Button type="button" className="shrink-0" disabled={waiting} onClick={() => void copy()} data-testid="booking-link-copy">
            {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
            {copied ? t('directBooking.bookingLink.copied') : t('directBooking.bookingLink.copy')}
          </Button>
        </div>
        <span role="status" className="sr-only">
          {copied ? t('directBooking.bookingLink.copied') : ''}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {image ? (
          <img
            src={image}
            alt={t('directBooking.bookingLink.qrAlt', { name: property.name })}
            className="size-32 rounded-md border bg-white p-2"
            data-testid="booking-link-qr"
          />
        ) : (
          <div className="size-32 rounded-md border bg-muted motion-safe:animate-pulse" aria-hidden="true" />
        )}
        <Button type="button" variant="outline" disabled={!image || waiting} onClick={print} data-testid="booking-link-print">
          <Printer aria-hidden="true" className="size-4" />
          {t('directBooking.bookingLink.print')}
        </Button>
      </div>
    </div>
  );
}
