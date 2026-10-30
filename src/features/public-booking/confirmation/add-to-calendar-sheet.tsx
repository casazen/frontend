import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, CalendarDays, Download, FileDown, Lock, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildIcs, googleCalendarUrl, outlookCalendarUrl, type CalendarStay } from '@/features/public-booking/confirmation/build-ics';
import { usePortalRootProps } from '@/features/public-site/site-appearance-context';
import { cn } from '@/lib/utils';
import './confirmation.css';

/** Gives the browser a text file to save. Nothing is sent anywhere: the file is made here, from the data of the booking. */
function saveTextFile(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface AddToCalendarSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stay: CalendarStay;
  /** The name of the downloaded file (`soggiorno-XXXXX-XXXXX.ics`). */
  fileName: string;
  /** What the sheet says about the house: its name and the days. */
  home: string;
  days: string;
}

/**
 * «Aggiungi al calendario» (DB-06b): a real `.ics` file made in the browser, and the two links that open Google Calendar and
 * Outlook.com in a new tab. The event has the zone or the city of the house, never the exact address, and the links carry the title,
 * the days and that place only. On a phone the sheet comes up from the bottom (the `Dialog` of the app does that).
 */
export function AddToCalendarSheet({ open, onOpenChange, stay, fileName, home, days }: AddToCalendarSheetProps) {
  const { t } = useTranslation();
  const portal = usePortalRootProps();
  const [saved, setSaved] = useState(false);
  const google = googleCalendarUrl(stay);
  const outlook = outlookCalendarUrl(stay);

  const download = () => {
    // The `UID` ends with the site the guest booked on: the one of this page, never a domain written in the code.
    const file = buildIcs({ ...stay, uidHost: window.location.hostname }, new Date());
    if (!file) return;
    saveTextFile(fileName, file);
    setSaved(true);
  };

  const close = (next: boolean) => {
    if (!next) setSaved(false);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent {...portal} className={cn(portal.className, 'bc-cal bg-[var(--cz-public-surface)]')} data-testid="calendar-sheet">
        <DialogHeader>
          <DialogTitle className="public-display text-2xl">{t('siteConfirm.calendar.title')}</DialogTitle>
          <DialogDescription>{t('siteConfirm.calendar.description', { home, days })}</DialogDescription>
        </DialogHeader>

        <ul className="bc-cal__list">
          <li>
            <button type="button" className="bc-cal__opt" onClick={download} data-testid="calendar-download">
              <span className="bc-cal__i" aria-hidden="true">
                <FileDown />
              </span>
              <span className="bc-cal__t">
                <strong>{t('siteConfirm.calendar.ics.title')}</strong>
                <small>{t('siteConfirm.calendar.ics.text')}</small>
              </span>
              <Download aria-hidden />
            </button>
          </li>
          {google ? (
            <li>
              <a className="bc-cal__opt" href={google} target="_blank" rel="noopener noreferrer" data-testid="calendar-google">
                <span className="bc-cal__i" aria-hidden="true">
                  <CalendarDays />
                </span>
                <span className="bc-cal__t">
                  <strong>{t('siteConfirm.calendar.google')}</strong>
                  <small>{t('siteConfirm.calendar.newTab')}</small>
                </span>
                <ArrowUpRight aria-hidden />
              </a>
            </li>
          ) : null}
          {outlook ? (
            <li>
              <a className="bc-cal__opt" href={outlook} target="_blank" rel="noopener noreferrer" data-testid="calendar-outlook">
                <span className="bc-cal__i" aria-hidden="true">
                  <Mail />
                </span>
                <span className="bc-cal__t">
                  <strong>{t('siteConfirm.calendar.outlook')}</strong>
                  <small>{t('siteConfirm.calendar.newTab')}</small>
                </span>
                <ArrowUpRight aria-hidden />
              </a>
            </li>
          ) : null}
        </ul>

        <p className="bc-cal__note">
          <Lock aria-hidden />
          <span>{t('siteConfirm.calendar.place')}</span>
        </p>
        <p className={cn('bc-cal__saved', !saved && 'sr-only')} role="status" aria-live="polite">
          {saved ? t('siteConfirm.calendar.saved') : ''}
        </p>
      </DialogContent>
    </Dialog>
  );
}
