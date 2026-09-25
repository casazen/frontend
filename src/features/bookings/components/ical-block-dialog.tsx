import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatStayDate, nightsBetween } from '@/lib/stay-dates';
import type { Booking } from '@/types';
import type { CalendarItemDto } from '@/types/calendar.types';
import { stayDateOf } from '../lib/booking-price';
import { OtaStayForm } from './ota-stay-form';

interface IcalBlockDialogProps {
  block: CalendarItemDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The host may create stays (`booking.write`). */
  canWrite: boolean;
  onStayCreated: (booking: Booking) => void;
}

/**
 * Detail of a calendar block (CO-21): dates, channel and label of its feed, the text the channel published. An imported
 * block not yet a stay offers "Crea soggiorno OTA" (decision D7); a block already turned into a stay links to it.
 */
export function IcalBlockDialog({ block, open, onOpenChange, canWrite, onStayCreated }: IcalBlockDialogProps) {
  const { t, i18n } = useTranslation();
  const [creating, setCreating] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) setCreating(false);
    onOpenChange(next);
  };

  if (!block) return null;

  const checkIn = stayDateOf(block.startDate);
  const checkOut = stayDateOf(block.endDate);
  const nights = nightsBetween(checkIn, checkOut);
  const imported = block.blockSource !== 'Manual';
  const channelName = block.channel ? t(`ical.channels.${block.channel}`) : t('booking.icalBlock.manual');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="ical-block-dialog">
        <DialogHeader>
          <DialogTitle>{t('booking.icalBlock.title')}</DialogTitle>
          <DialogDescription>
            {t('booking.icalBlock.dates', {
              checkIn: formatStayDate(checkIn, i18n.language),
              checkOut: formatStayDate(checkOut, i18n.language),
              count: nights,
            })}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t('booking.icalBlock.channel')}</dt>
          <dd data-testid="ical-block-channel">
            {channelName}
            {block.channelLabel ? ` · ${block.channelLabel}` : ''}
          </dd>
          {block.summary && (
            <>
              <dt className="text-muted-foreground">{t('booking.icalBlock.summary')}</dt>
              <dd className="break-words">{block.summary}</dd>
            </>
          )}
        </dl>

        {block.bookingId ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-4 py-3 text-sm">
            <span>{t('booking.icalBlock.converted')}</span>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/app/short-rent/bookings/${block.bookingId}`} data-testid="ical-block-open-stay">
                {t('booking.icalBlock.openStay')}
              </Link>
            </Button>
          </div>
        ) : !imported ? (
          <p className="text-sm text-muted-foreground">{t('booking.icalBlock.manualHint')}</p>
        ) : !block.convertible ? (
          <p className="text-sm text-muted-foreground" data-testid="ical-block-not-convertible">
            {t('booking.icalBlock.notConvertible')}
          </p>
        ) : !canWrite ? (
          <p className="text-sm text-muted-foreground">{t('booking.icalBlock.readOnly')}</p>
        ) : creating ? (
          <OtaStayForm
            blockId={block.id}
            channel={block.channel}
            onCreated={(booking) => {
              setCreating(false);
              onStayCreated(booking);
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('booking.icalBlock.convertHint')}</p>
            <Button onClick={() => setCreating(true)} data-testid="ical-block-create-stay">
              <CalendarPlus className="mr-2 h-4 w-4" />
              {t('booking.otaStay.action')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
