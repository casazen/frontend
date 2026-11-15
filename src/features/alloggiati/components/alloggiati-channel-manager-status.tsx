import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { checkInWizardPath } from '@/features/bookings/lib/stay-actions';
import { CheckoutGuestDataSubflow } from '@/features/compliance/components/checkout-guest-data-subflow';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { useRetryOctorateWrite } from '@/queries/use-alloggiati';
import type { AlloggiatiChannelManagerGuestDto, AlloggiatiStatusDto } from '@/types/alloggiati.types';
import {
  PLACE_NOT_RECOGNIZED,
  canRetryWrite,
  guestErrorKey,
  guestsToCorrect,
  needsPlaceCorrection,
  placeFieldsOf,
  retryOutcomeOf,
  type StayChannelView,
} from '../alloggiati-channel-manager';

const LONG_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/** The permission of the endpoints the actions of this block call (the retry, and the save of the guests in the layer). */
const SUBMIT_PERMISSION = 'alloggiati.submit';

/** The permission the route of the check-in wizard asks: the link to it is offered only to who can open it. */
const WIZARD_PERMISSION = 'booking.write';

/** One guest the channel manager did not take: which one, why in plain words (a place names the field to correct) and when it was last tried. */
function GuestError({ guest }: { guest: AlloggiatiChannelManagerGuestDto }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const named = guest.errorCode === PLACE_NOT_RECOGNIZED ? placeFieldsOf(guest.errorFields).map((field) => t(`alloggiati.channelManager.field.${field}`)) : [];
  const fields = named.length > 0 ? new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(named) : t('alloggiati.channelManager.field.unknown');
  const lastAttempt = guest.lastAttemptAt ? formatRomeDateTime(guest.lastAttemptAt, language) : '';

  return (
    <li className="min-w-0 space-y-0.5 py-2" data-testid={`alloggiati-guest-error-${guest.position}`}>
      <p className="break-words text-sm font-medium">{t('alloggiati.guestSummary.guestHeading', { index: guest.position + 1 })}</p>
      <p className="break-words text-sm">{t(guestErrorKey(guest.errorCode), { fields })}</p>
      {lastAttempt ? <p className="text-xs text-foreground/70">{t('alloggiati.channelManager.lastAttempt', { when: lastAttempt })}</p> : null}
    </li>
  );
}

/**
 * The way to the step that sends a corrected guest: the guest check-in wizard, where «Conferma e invia» passes the guests to the channel manager (with the automatic send of the organization
 * on, a corrected guest goes by itself). It is off while a request of the block is on its way, like the other buttons.
 */
function OpenCheckIn({ bookingId, busy }: { bookingId: string; busy: boolean }) {
  const { t } = useTranslation();

  if (busy) {
    return (
      <Button type="button" size="sm" variant="outline" className="min-h-11" disabled data-testid="alloggiati-open-check-in">
        {t('alloggiati.channelManager.reconfirm')}
      </Button>
    );
  }

  return (
    <Button asChild size="sm" variant="outline" className="min-h-11">
      <Link to={checkInWizardPath(bookingId)} data-testid="alloggiati-open-check-in">
        {t('alloggiati.channelManager.reconfirm')}
      </Link>
    </Button>
  );
}

interface AlloggiatiChannelManagerStatusProps {
  bookingId: string;
  status: AlloggiatiStatusDto;
  view: StayChannelView;
}

/**
 * The stay on the channel manager, under the status of the Alloggiati panel (E20/F01/US02, NF-43, NF-52): the words of the state the server gave and what the host can do
 * about it, never more than the server confirmed.
 *
 * - **Entrusted** (yellow): the channel manager has every guest and sends them; for CasaZen the communication is done only when the receipt is archived.
 * - **Receipt archived** (green): the server says an archived receipt covers the stay, and when it came.
 * - **Receipt missing**: entrusted, and the server's light is red (the receipt is not in the archive in time). The brief and the dictionary of the states give it no tone of its own, so it
 *   has the one a red line has everywhere else in the product (`withCompliance` of the next step of the booking): the warning tone, and the danger one once the term has passed
 *   (`isOverdue` of the server). The badge keeps the tone of the status (yellow), with the red «Scadenza superata» next to it when the server says the term has passed.
 * - **To correct** (red, the tone of its status): the guests the channel manager did not take, each by position with its reason in plain words. A place the channel manager does not know names the
 *   field and opens the guests of the stay in a layer over the page, so the host never leaves it; any other failure can be tried again with «Riprova». Saving the corrected guests sends
 *   nothing by itself (the guest goes with the confirmation of the check-in wizard, or alone when the organization turned the automatic send on): the block says so and leads to the wizard.
 *
 * Both actions are for who may send the guests' data (`alloggiati.submit`, the permission of the endpoints): without it the block only tells, and says whom to ask. They are
 * off while the retry is on its way, and what the retry did is told under them, never as a success the server did not confirm.
 */
export function AlloggiatiChannelManagerStatus({ bookingId, status, view }: AlloggiatiChannelManagerStatusProps) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const retry = useRetryOctorateWrite(bookingId);
  const [fixing, setFixing] = useState(false);
  const canSubmit = hasPermission('short-rent', SUBMIT_PERMISSION);

  const failed = view === 'toCorrect' ? guestsToCorrect(status) : [];
  const placeWrong = needsPlaceCorrection(failed);
  const retryOffered = view === 'toCorrect' && canRetryWrite(status);
  const canFix = canSubmit && placeWrong;
  const canRetry = canSubmit && retryOffered;
  // A corrected guest does not go by itself unless the organization turned the automatic send on: it goes with the confirmation of the check-in wizard, so the page says so and leads there.
  const canOpenCheckIn = canFix && hasPermission('short-rent', WIZARD_PERMISSION);
  const busy = retry.isPending;

  const receipt = status.channelManager?.receiptCoverage;
  const archivedOn = receipt?.archivedAt ? formatRomeDateTime(receipt.archivedAt, i18n.language, LONG_DATE) : '';
  const retryOutcome = retry.data?.retry ? retryOutcomeOf(retry.data.retry, retry.data.status) : null;

  return (
    <div className="space-y-3" data-testid="alloggiati-channel-manager" data-view={view}>
      {view === 'entrusted' ? (
        <p className="text-sm text-foreground/70" data-testid="alloggiati-entrusted-notice">
          {t('alloggiati.channelManager.entrusted')}
        </p>
      ) : null}

      {view === 'receiptArchived' ? (
        <p className="text-sm text-foreground/70" data-testid="alloggiati-receipt-archived-notice">
          {archivedOn ? t('alloggiati.channelManager.receiptArchivedOn', { date: archivedOn }) : t('alloggiati.channelManager.receiptArchived')}
        </p>
      ) : null}

      {view === 'receiptMissing' ? (
        <Alert variant={status.isOverdue ? 'danger' : 'warning'} data-testid="alloggiati-receipt-missing">
          {t('alloggiati.channelManager.receiptMissing')}
        </Alert>
      ) : null}

      {view === 'toCorrect' ? (
        <div className="space-y-2" data-testid="alloggiati-to-correct">
          <p className="text-sm font-medium text-destructive">{t('alloggiati.channelManager.toCorrect')}</p>
          {failed.length > 0 ? (
            <ul className="divide-y divide-border" aria-label={t('alloggiati.channelManager.guestsLabel')} data-testid="alloggiati-guest-errors">
              {failed.map((guest) => (
                <GuestError key={guest.position} guest={guest} />
              ))}
            </ul>
          ) : null}
          {canFix ? (
            <p className="text-sm text-foreground/70" data-testid="alloggiati-next-step">
              {t('alloggiati.channelManager.nextStep')}
            </p>
          ) : null}
        </div>
      ) : null}

      {canFix || canRetry ? (
        <div className="flex flex-wrap items-center gap-2">
          {canFix ? (
            <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={busy} onClick={() => setFixing(true)} data-testid="alloggiati-fix-guests">
              {t('alloggiati.channelManager.fix')}
            </Button>
          ) : null}
          {canOpenCheckIn ? <OpenCheckIn bookingId={bookingId} busy={busy} /> : null}
          {canRetry ? (
            <Button type="button" size="sm" className="min-h-11" loading={busy} onClick={() => retry.mutate()} data-testid="alloggiati-retry-write">
              {t('alloggiati.channelManager.retry')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {!canSubmit && (placeWrong || retryOffered) ? (
        <p className="text-sm text-foreground/70" data-testid="alloggiati-retry-needs-permission">
          {t('alloggiati.channelManager.needsPermission')}
        </p>
      ) : null}

      {retryOutcome ? (
        <p role="status" className="text-sm" data-testid="alloggiati-retry-result" data-outcome={retryOutcome}>
          {t(`alloggiati.channelManager.retryResult.${retryOutcome}`)}
        </p>
      ) : null}
      {retry.isError ? (
        <p role="alert" className="text-sm text-destructive" data-testid="alloggiati-retry-error">
          {getProblemMessage(retry.error, t) ?? t('alloggiati.channelManager.retryResult.error')}
        </p>
      ) : null}

      {/* A layer over the page, mounted only while it is open: the guests of the stay are corrected without leaving it (the wizard rules). It stays until the host closes it, even if the
          status moves on meanwhile (a corrected guest that goes through at once): the layer itself says that the data were saved, and the host closes it. */}
      {canSubmit ? (
        <CheckoutGuestDataSubflow bookingId={bookingId} open={fixing} onOpenChange={setFixing} description={t('alloggiati.channelManager.fixLayer')} />
      ) : null}
    </div>
  );
}
