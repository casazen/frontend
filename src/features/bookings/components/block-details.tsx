import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarPlus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { propertyModePath } from '@/features/properties/mode/paths';
import { getProblemMessage } from '@/lib/api-errors';
import { formatStayDate } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import { useDeleteManualBlock } from '@/queries/use-manual-blocks';
import type { Booking } from '@/types';
import { MODE_CHANGE_BLOCK_REASON } from '@/types/calendar.types';
import { calendarKindInfo, calendarKindOf } from '../lib/calendar-kinds';
import { blockSourceLabel, type HostCalendarBlockEvent } from '../lib/host-calendar';
import { OtaStayForm } from './ota-stay-form';

interface ManualBlockActionsProps {
  block: HostCalendarBlockEvent;
  propertyId: string;
  canWriteProperty: boolean;
  onDeleted: () => void;
}

/**
 * Note and "Elimina blocco" of dates the host closed by hand (PC-09). Removing asks for a confirmation: the nights become
 * bookable again on the site and free on the channels that read the export.
 */
function ManualBlockActions({ block, propertyId, canWriteProperty, onDeleted }: ManualBlockActionsProps) {
  const { t } = useTranslation();
  const deleteBlock = useDeleteManualBlock();
  const [confirming, setConfirming] = useState(false);

  // The nights a scheduled change to long-term closes (PM-02): the host did not close them and cannot open them from here (the
  // API refuses with `calendar_block_held_by_mode_change`); they open again when the change is withdrawn. That way out is
  // offered only to who has it: with the permission to write the property.
  if (block.reason === MODE_CHANGE_BLOCK_REASON) {
    return (
      <div className="space-y-2" data-testid="mode-change-block">
        <p className="text-muted-foreground">{t('propertyMode.calendar.explanation')}</p>
        {canWriteProperty && (
          <>
            <p className="text-muted-foreground">{t('propertyMode.calendar.reopen')}</p>
            <Button variant="outline" size="sm" asChild>
              <Link to={propertyModePath('short-rent', propertyId)} data-testid="mode-change-block-manage">
                {t('propertyMode.calendar.manage')}
              </Link>
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {block.summary && (
        <p className="text-muted-foreground">{t('booking.calendar.manualBlock.noteLabel', { note: block.summary })}</p>
      )}
      <p className="text-muted-foreground">{t('booking.calendar.manualBlock.explanation')}</p>
      {!canWriteProperty ? (
        <p className="text-muted-foreground">{t('booking.calendar.manualBlock.readOnly')}</p>
      ) : confirming ? (
        <div className="space-y-2 rounded-lg border bg-background px-3 py-2" data-testid="manual-block-delete-confirm">
          <p>{t('booking.calendar.manualBlock.deleteConfirm')}</p>
          {deleteBlock.isError && (
            <p className="text-sm text-destructive" role="alert">
              {getProblemMessage(deleteBlock.error, t) ?? t('booking.calendar.manualBlock.deleteFailed')}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                deleteBlock.reset();
                setConfirming(false);
              }}
              disabled={deleteBlock.isPending}
            >
              {t('booking.calendar.manualBlock.cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteBlock.isPending}
              onClick={() => deleteBlock.mutate({ propertyId, blockId: block.id }, { onSuccess: () => onDeleted() })}
            >
              {deleteBlock.isPending
                ? t('booking.calendar.manualBlock.deleting')
                : t('booking.calendar.manualBlock.deleteConfirmAction')}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setConfirming(true)} data-testid="manual-block-delete">
          <Trash2 className="mr-2 h-4 w-4" />
          {t('booking.calendar.manualBlock.delete')}
        </Button>
      )}
    </div>
  );
}

export interface BlockDetailsBodyProps {
  block: HostCalendarBlockEvent;
  propertyId: string;
  /** The host may create stays (`booking.write`). */
  canWrite: boolean;
  /** The host may remove a manual block (`property.write`, PC-09). */
  canWriteProperty: boolean;
  onStayCreated: (booking: Booking) => void;
  onBlockDeleted: () => void;
}

/**
 * What a block says and lets the host do, without a frame: the nights, where they come from, the stay an OTA reservation can
 * become (CO-21) and the removal of the host's own block. The panel of the month and the drawer of the Timeline are two frames
 * around this, so that the two never differ.
 */
export function BlockDetailsBody({ block, propertyId, canWrite, canWriteProperty, onStayCreated, onBlockDeleted }: BlockDetailsBodyProps) {
  const { t, i18n } = useTranslation();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <p>
        {t('booking.calendar.dates', {
          arrival: formatStayDate(block.arrival, i18n.language),
          departure: formatStayDate(block.departure, i18n.language),
          count: block.nights,
        })}
      </p>
      {block.manual ? (
        <ManualBlockActions block={block} propertyId={propertyId} canWriteProperty={canWriteProperty} onDeleted={onBlockDeleted} />
      ) : (
        <>
          {block.summary && (
            <p className="text-muted-foreground">{t('booking.calendar.block.summary', { summary: block.summary })}</p>
          )}
          <p className="text-muted-foreground">{t('booking.calendar.block.notABooking')}</p>
        </>
      )}
      {block.stayId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
          <span>{t('booking.icalBlock.converted')}</span>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/app/short-rent/bookings/${block.stayId}`} data-testid="calendar-block-open-stay">
              {t('booking.icalBlock.openStay')}
            </Link>
          </Button>
        </div>
      ) : block.manual ? null : !block.convertible ? (
        <p className="text-muted-foreground" data-testid="calendar-block-not-convertible">
          {t('booking.icalBlock.notConvertible')}
        </p>
      ) : !canWrite ? (
        <p className="text-muted-foreground">{t('booking.icalBlock.readOnly')}</p>
      ) : creating ? (
        <div className="rounded-lg border bg-background p-4">
          <OtaStayForm
            blockId={block.id}
            channel={block.channel}
            onCreated={onStayCreated}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground">{t('booking.icalBlock.convertHint')}</p>
          <Button size="sm" onClick={() => setCreating(true)} data-testid="calendar-block-create-stay">
            <CalendarPlus className="mr-2 h-4 w-4" />
            {t('booking.otaStay.action')}
          </Button>
        </div>
      )}
    </>
  );
}

interface BlockDetailsProps extends BlockDetailsBodyProps {
  onClose: () => void;
}

/**
 * Dates taken on another channel, opened from the calendar: where they come from and the stay dates. A block is not a
 * CasaZen booking, so there is no booking detail to open; an imported block can become an OTA stay ("Crea soggiorno
 * OTA", CO-21, decision D7), from which the guest check-in link, Alloggiati Web and the cockpit start.
 */
export function BlockDetails({ onClose, ...body }: BlockDetailsProps) {
  const { t } = useTranslation();
  const { block } = body;
  const kind = calendarKindOf(block);
  const KindIcon = calendarKindInfo(kind).icon;
  return (
    <section aria-labelledby="calendar-block-title" className="space-y-3 rounded-xl border bg-card p-4 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          {/* The same small box as in the legend and on the grid: what these dates are, by shape and icon and not by color alone. */}
          <span className={cn('host-calendar-swatch', `host-calendar-event--${kind}`)} aria-hidden="true">
            <KindIcon />
          </span>
          <h2 id="calendar-block-title" className="min-w-0 break-words font-semibold">
            {block.manual
              ? t('booking.calendar.manualBlock.title', { reason: blockSourceLabel(block, t) })
              : t('booking.calendar.block.title', { source: blockSourceLabel(block, t) })}
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('booking.calendar.block.close')}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <BlockDetailsBody {...body} />
    </section>
  );
}
