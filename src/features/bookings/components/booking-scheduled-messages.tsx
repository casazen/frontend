import { useRef, useState, type ReactNode } from 'react';
import { Link, generatePath } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getManifestEntry, hasEntryPermission, isEntryFeatureEnabled } from '@/config/route-manifest';
import { useCommercialRouteAccess } from '@/hooks/use-commercial-profile';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { messageThreadPath } from '@/lib/message-hub-routes';
import {
  useEditScheduledMessage,
  useScheduledMessageIdsBeingWritten,
  useScheduledMessages,
  useSendScheduledMessageNow,
  useSkipScheduledMessage,
} from '@/queries/use-scheduled-messages';
import type { Booking, ScheduledMessage } from '@/types';
import { describeScheduledMessageError } from '../lib/scheduled-message-errors';
import {
  FIX_LABEL_KEYS,
  channelLineOf,
  endedReasonOf,
  failureReasonOf,
  formatOnPropertyClock,
  isOpenStatus,
  missingCodesOf,
  missingItemOf,
  sortedInTimeOrder,
  statusViewOf,
  type FixPlace,
} from '../lib/scheduled-messages';
import { ScheduledMessageEditDialog } from './scheduled-message-edit-dialog';
import { ScheduledMessageText } from './scheduled-message-text';

/** The links of the app that complete what a blocked message waits for: `null` where the page does not exist for this person (no permission, a flag off, a module the account does not have). */
type FixLinks = Record<FixPlace, string | null>;

/** A link that is at least 44 px high, on a phone and on a laptop, and underlined at rest: a line of text that leads somewhere must not look like the ones that do not. */
const LINK_CLASS =
  'inline-flex min-h-11 items-center rounded-sm text-sm font-medium underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * The pages a message that waits can be completed on, built from the routes of the app (`ROUTE_MANIFEST`) and opened only for who can open them: the same test the menu uses (the permissions of the page,
 * its flag and the module the account has), so that a link never leads to a page that answers «nessun accesso». The tab Documenti of the booking and the tax step of its check-in are pages of this booking;
 * the property and the routines are other pages.
 */
function useFixLinks(booking: Booking): FixLinks {
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const commercialAccess = useCommercialRouteAccess();

  const pageOf = (pattern: string, params?: { id: string }): string | null => {
    const entry = getManifestEntry(pattern);
    if (!entry || !hasEntryPermission(entry, hasPermission) || !isEntryFeatureEnabled(entry, flags) || !commercialAccess(pattern)) return null;
    return params ? generatePath(entry.path, params) : entry.path;
  };

  const bookingPage = pageOf('/app/short-rent/bookings/:id', { id: booking.id });
  const checkInPage = pageOf('/app/short-rent/bookings/:id/check-in', { id: booking.id });
  return {
    guest: bookingPage ? `${bookingPage}?tab=guest` : null,
    tax: checkInPage ? `${checkInPage}?step=tax` : null,
    property: pageOf('/app/short-rent/properties/:id', { id: booking.propertyId }),
    routines: pageOf('/app/short-rent/automations'),
  };
}

interface BookingScheduledMessagesProps {
  booking: Booking;
  /** The person may change the messages (`booking.write`): without it the timeline is only read, whatever the server says each message allows. */
  canWrite: boolean;
}

/**
 * The messages the routines will send to the guest of this booking, in time order (E05/F07/US02, NF-71, MSG-11): when each goes out on the clock of the property, the routine that holds it,
 * the channel it will use and its state in words (scheduled, sent with a link to the conversation, skipped by a person or by CasaZen with the reason, blocked with what it waits for and where to
 * complete it, failed, expired, cancelled), «Modificato» when the host changed the text and «Inviato fuori orario» when it applies, and the text as it will read. For who may write the booking, «Modifica»,
 * «Salta» and «Invia ora» on the messages the server says can still change.
 *
 * The caller draws it only with the flag `scheduledMessages` on and the permission `booking.read`. A failed read is an unknown state, never the list that was there before (the query keeps old data
 * when a read fails), and a 404 is said as one. The text the host is writing in the dialog of a message is not part of the list: it is kept here, so that an unknown state does not take it away.
 */
export function BookingScheduledMessages({ booking, canWrite }: BookingScheduledMessagesProps) {
  const { t } = useTranslation();
  const query = useScheduledMessages(booking.id, true);
  const links = useFixLinks(booking);
  // Which message the host is editing and what they have typed and not saved. It lives in the section and not in the card: when a read fails (the poll, the focus of the window, the bell) the list gives
  // way to the unknown state and the cards, with their dialogs, are unmounted; the host's words must survive that and be there when the list is back. A closed dialog (saved or cancelled) forgets them.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ReadonlyMap<string, string>>(() => new Map());
  const keepDraft = (id: string, text: string) => setDrafts((current) => new Map(current).set(id, text));
  const closeEdit = (id: string) => {
    setEditingId((current) => (current === id ? null : current));
    setDrafts((current) => {
      if (!current.has(id)) return current;
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  };
  const draftKept = editingId !== null && drafts.has(editingId);

  let body: ReactNode;
  if (query.isError) {
    const gone = getHttpStatus(query.error) === 404;
    body = (
      <div role="alert" className="space-y-2" data-testid="scheduled-messages-error">
        <p className="text-sm text-destructive">{t(gone ? 'booking.scheduledMessages.loadErrorGone' : 'booking.scheduledMessages.loadError')}</p>
        {/* The messages are not shown (their state is not known), but what the host was writing is not lost: it comes back with the list. */}
        {draftKept ? (
          <p className="text-sm" data-testid="scheduled-messages-draft-kept">
            {t('booking.scheduledMessages.draftKept')}
          </p>
        ) : null}
        {gone ? null : (
          <Button variant="outline" size="sm" className="min-h-11" loading={query.isFetching} onClick={() => void query.refetch()} data-testid="scheduled-messages-retry">
            {t('booking.scheduledMessages.retry')}
          </Button>
        )}
      </div>
    );
  } else if (query.data === undefined) {
    body = (
      <p role="status" className="flex items-center gap-2 text-sm text-foreground/70" data-testid="scheduled-messages-loading">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {t('booking.scheduledMessages.loading')}
      </p>
    );
  } else if (query.data.length === 0) {
    body = (
      <div className="space-y-1" data-testid="scheduled-messages-empty">
        <p className="max-w-prose text-sm text-foreground/70">{t('booking.scheduledMessages.empty')}</p>
        {/* The routines are where messages are switched on: the link is offered only to who may open that page, and only while the routines exist. Without it the sentence stands alone. */}
        {links.routines ? (
          <Link to={links.routines} className={LINK_CLASS} data-testid="scheduled-messages-routines-link">
            {t('booking.scheduledMessages.emptyLink')}
          </Link>
        ) : null}
      </div>
    );
  } else {
    body = (
      <ol role="list" aria-label={t('booking.scheduledMessages.listLabel')} className="divide-y divide-border" data-testid="scheduled-messages-list">
        {sortedInTimeOrder(query.data).map((message) => (
          <ScheduledMessageItem
            key={message.id}
            message={message}
            canWrite={canWrite}
            links={links}
            editing={editingId === message.id}
            draft={drafts.get(message.id)}
            onEdit={() => setEditingId(message.id)}
            onEditClosed={() => closeEdit(message.id)}
            onDraft={(text) => keepDraft(message.id, text)}
          />
        ))}
      </ol>
    );
  }

  return (
    <PlainSection title={t('booking.scheduledMessages.title')} data-testid="booking-scheduled-messages">
      {body}
    </PlainSection>
  );
}

/** Which of the two confirmations of a message is open (the edit dialog is kept by the section). */
type ConfirmKind = 'skip' | 'send';

/** The three writes a card can make on its message. */
type WriteKind = 'edit' | ConfirmKind;

interface ScheduledMessageItemProps {
  message: ScheduledMessage;
  canWrite: boolean;
  links: FixLinks;
  /** The host is editing the text of this message (the section keeps it, so that it survives an unknown state of the list). */
  editing: boolean;
  /** What the host has typed in the dialog and has not saved; `undefined` when nothing. */
  draft: string | undefined;
  onEdit: () => void;
  /** The dialog was closed (saved, cancelled): the section forgets what was typed. */
  onEditClosed: () => void;
  onDraft: (text: string) => void;
}

function ScheduledMessageItem({ message, canWrite, links, editing, draft, onEdit, onEditClosed, onDraft }: ScheduledMessageItemProps) {
  const { t, i18n } = useTranslation();
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const edit = useEditScheduledMessage();
  const skip = useSkipScheduledMessage();
  const sendNow = useSendScheduledMessageNow();
  // The buttons of a card wait for ANY write of that card, not only the one of the hook that pressed them: an edit that is on its way must not be crossed by a skip or a send.
  const busy = useScheduledMessageIdsBeingWritten().has(message.id);

  const view = statusViewOf(message.status);
  const planned = formatOnPropertyClock(message.plannedAtUtc, message.timeZone, i18n.language);
  const sentAt = formatOnPropertyClock(message.sentAt, message.timeZone, i18n.language, false);
  const name = message.routineName.trim() || t('booking.scheduledMessages.routineUnnamed');
  // What each button is called for a screen reader: the same words as the button, then which message it is about (the buttons of every message say the same).
  const editLabel = t('booking.scheduledMessages.edit.actionLabel', { name, when: planned });
  const skipLabel = t('booking.scheduledMessages.skip.actionLabel', { name, when: planned });
  const sendLabel = t('booking.scheduledMessages.sendNow.actionLabel', { name, when: planned });
  const ended = endedReasonOf(message);
  const failure = message.status === 'Failed' ? failureReasonOf(message.blockedReason) : null;
  const missing = missingCodesOf(message);
  const channel = channelLineOf(message);

  // What the server lets a person do with this message, and only for who may write the booking. The dialogs follow it: one that is open on a message that can no longer change closes with it.
  const may = { edit: canWrite && message.canEdit, skip: canWrite && message.canSkip, send: canWrite && message.canSendNow };
  const editOpen = editing && may.edit;
  const confirmOpen: ConfirmKind | null = confirm === 'skip' && may.skip ? 'skip' : confirm === 'send' && may.send ? 'send' : null;
  const dialogOpen = editOpen || confirmOpen !== null;
  const openEdit = () => {
    setProblem(null);
    onEdit();
  };
  const closeEdit = () => {
    setProblem(null);
    onEditClosed();
  };
  const openConfirm = (kind: ConfirmKind) => {
    setProblem(null);
    setConfirm(kind);
  };
  const closeConfirm = () => {
    setProblem(null);
    setConfirm(null);
  };

  // ONE write of this card at a time, and the same write pressed again gets the answer of the first instead of a second request. `busy` comes from the mutation cache and reaches the screen a moment after the
  // press (the cache tells React on the next turn of the clock), so two submits in the same instant (a key held down, a double click made by a script) both find the button enabled: this guard does not wait
  // for the screen. Without it the second request is refused by the server with a 409 that would show on the card, right after the toast that says the first one worked.
  const inFlight = useRef<{ kind: WriteKind; running: Promise<void> } | null>(null);
  /** Runs the write unless one is on its way. The same kind pressed again is given the first one's promise; another kind is not started (`null`): nothing is started and nothing is said done. */
  const once = (kind: WriteKind, write: () => Promise<void>): Promise<void> | null => {
    const current = inFlight.current;
    if (current) return current.kind === kind ? current.running : null;
    const running = write().finally(() => {
      inFlight.current = null;
    });
    inFlight.current = { kind, running };
    return running;
  };
  // A confirmation that was not started must not close its dialog as if it had worked: it fails, and the dialog stays open.
  const notStarted = () => Promise.reject(new Error('Another write of this message is on its way'));

  // Each write lets go of its mutation when it is over (`reset`): a hook keeps the last one it ran, with the text that was sent, for as long as the card is on the page.
  const saveText = (text: string | null): Promise<void> =>
    once('edit', async () => {
      setProblem(null);
      try {
        await edit.mutateAsync({ bookingId: message.bookingId, id: message.id, text });
        closeEdit();
      } catch (error) {
        setProblem(describeScheduledMessageError(error, t));
      } finally {
        edit.reset();
      }
    }) ?? Promise.resolve();

  // A refusal is said inside the dialog, which stays open (a failed confirmation closes nothing), and again on the card when the dialog was closed while the request was on its way.
  const confirmSkip = (): Promise<void> =>
    once('skip', async () => {
      setProblem(null);
      try {
        await skip.mutateAsync({ bookingId: message.bookingId, id: message.id });
      } catch (error) {
        setProblem(describeScheduledMessageError(error, t));
        throw error;
      } finally {
        skip.reset();
      }
    }) ?? notStarted();

  const confirmSendNow = (): Promise<void> =>
    once('send', async () => {
      setProblem(null);
      try {
        await sendNow.mutateAsync({ bookingId: message.bookingId, id: message.id });
      } catch (error) {
        setProblem(describeScheduledMessageError(error, t));
        throw error;
      } finally {
        sendNow.reset();
      }
    }) ?? notStarted();

  const problemInDialog = problem ? (
    <p role="alert" className="text-sm text-destructive" data-testid="scheduled-message-dialog-problem">
      {problem}
    </p>
  ) : null;

  return (
    <li className="space-y-3 py-4 first:pt-0 last:pb-0" data-testid="scheduled-message" data-status={message.status} data-message-id={message.id}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <time dateTime={message.plannedAtUtc} className="text-sm font-semibold" data-testid="scheduled-message-time">
          {planned}
        </time>
        <Badge variant={view.badge} className="gap-1.5" data-testid="scheduled-message-status">
          <view.Icon className="size-3.5" aria-hidden="true" />
          {t(view.labelKey)}
        </Badge>
        {message.edited ? (
          <Badge variant="outline" data-testid="scheduled-message-edited">
            {t('booking.scheduledMessages.edited')}
          </Badge>
        ) : null}
        {message.outsideHours ? (
          <Badge variant="outline" data-testid="scheduled-message-outside-hours">
            {t('booking.scheduledMessages.outsideHours')}
          </Badge>
        ) : null}
      </div>
      <p className="break-words text-sm text-foreground/70" data-testid="scheduled-message-routine">
        {t('booking.scheduledMessages.routine', { name })}
      </p>

      {message.status === 'Sent' ? (
        <p className="text-sm" data-testid="scheduled-message-sent">
          {sentAt ? t('booking.scheduledMessages.sent.at', { when: sentAt }) : t('booking.scheduledMessages.sent.done')}
          {message.sentThreadKey ? (
            <>
              {' '}
              <Link to={messageThreadPath(message.sentThreadKey)} className={LINK_CLASS} data-testid="scheduled-message-conversation">
                {t('booking.scheduledMessages.sent.openConversation')}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {ended ? (
        <div className="space-y-1 text-sm" data-testid="scheduled-message-ended">
          {/* Who ended it: a person of the team says it all with its sentence; CasaZen says so first and then why. */}
          {message.status === 'Skipped' && !ended.byPerson ? <p className="font-medium">{t('booking.scheduledMessages.reason.bySystem')}</p> : null}
          <p>{t(ended.reasonKey)}</p>
          {/* A skip that landed while the send was under way: the message did go out, so it is never said that the guest will not get it. */}
          {message.status === 'Skipped' && sentAt ? <p>{t('booking.scheduledMessages.sent.skippedAfterSend', { when: sentAt })}</p> : null}
        </div>
      ) : null}

      {failure ? (
        <p className="text-sm" data-testid="scheduled-message-failure">
          {t(failure.reasonKey)}
        </p>
      ) : null}

      {missing.length > 0 ? (
        <div className="space-y-1" data-testid="scheduled-message-missing">
          <p className="text-sm font-medium">{t('booking.scheduledMessages.blocked.heading')}</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {missing.map((code) => {
              const item = missingItemOf(code);
              const href = item.fix ? links[item.fix] : null;
              return (
                <li key={code} data-code={code}>
                  {t(item.itemKey)}
                  {item.fix && href ? (
                    <>
                      {' '}
                      <Link to={href} className={LINK_CLASS} data-testid={`scheduled-message-fix-${item.fix}`}>
                        {t(FIX_LABEL_KEYS[item.fix])}
                      </Link>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {/* A planned or a failed message whose booking lacks a datum is held back when its time comes: its text has the datum taken out, so it is said that this is not what the guest will read yet. */}
          {message.status !== 'Blocked' ? (
            <p className="text-sm text-foreground/70" data-testid="scheduled-message-missing-note">
              {t('booking.scheduledMessages.blocked.willHold')}
            </p>
          ) : null}
        </div>
      ) : null}

      {channel ? (
        <p className="text-sm text-foreground/70" data-testid="scheduled-message-channel">
          {channel.reasonKey
            ? t('booking.scheduledMessages.channel.lineNone', { reason: t(channel.reasonKey) })
            : t('booking.scheduledMessages.channel.line', { channel: t(channel.channelKey) })}
        </p>
      ) : null}

      {message.text ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground/70">{t('booking.scheduledMessages.textLabel')}</p>
          <ScheduledMessageText text={message.text} />
        </div>
      ) : isOpenWithoutText(message) ? (
        <p className="text-sm text-foreground/70" data-testid="scheduled-message-no-text">
          {t('booking.scheduledMessages.textMissing')}
        </p>
      ) : null}

      {may.edit || may.skip || may.send ? (
        <div className="flex flex-wrap gap-2" data-testid="scheduled-message-actions">
          {may.edit ? (
            <Button variant="outline" size="sm" className="min-h-11" disabled={busy} aria-label={editLabel} onClick={openEdit} data-testid="scheduled-message-edit">
              {t('booking.scheduledMessages.edit.action')}
            </Button>
          ) : null}
          {may.skip ? (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={busy}
              aria-label={skipLabel}
              onClick={() => openConfirm('skip')}
              data-testid="scheduled-message-skip"
            >
              {t('booking.scheduledMessages.skip.action')}
            </Button>
          ) : null}
          {may.send ? (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={busy}
              aria-label={sendLabel}
              onClick={() => openConfirm('send')}
              data-testid="scheduled-message-send-now"
            >
              {t('booking.scheduledMessages.sendNow.action')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {problem && !dialogOpen ? (
        <p role="alert" className="text-sm text-destructive" data-testid="scheduled-message-problem">
          {problem}
        </p>
      ) : null}

      {may.edit ? (
        <ScheduledMessageEditDialog
          message={message}
          open={editOpen}
          onOpenChange={(open) => (open ? onEdit() : closeEdit())}
          onSave={saveText}
          busy={busy}
          problem={problem}
          onProblemSeen={() => setProblem(null)}
          draft={draft}
          onDraftChange={onDraft}
        />
      ) : null}

      {may.skip ? (
        <ConfirmationDialog
          open={confirmOpen === 'skip'}
          onOpenChange={(open) => (open ? setConfirm('skip') : closeConfirm())}
          title={t('booking.scheduledMessages.skip.title')}
          description={t('booking.scheduledMessages.skip.description', { name, when: planned })}
          consequences={[
            t('booking.scheduledMessages.skip.consequenceGuest'),
            t('booking.scheduledMessages.skip.consequenceFinal'),
            t('booking.scheduledMessages.skip.consequenceTeam'),
          ]}
          confirmLabel={t('booking.scheduledMessages.skip.confirm')}
          variant="destructive"
          isLoading={busy}
          onConfirm={confirmSkip}
        >
          {problemInDialog}
        </ConfirmationDialog>
      ) : null}

      {may.send ? (
        <ConfirmationDialog
          open={confirmOpen === 'send'}
          onOpenChange={(open) => (open ? setConfirm('send') : closeConfirm())}
          title={t('booking.scheduledMessages.sendNow.title')}
          description={t('booking.scheduledMessages.sendNow.description', { name, when: planned })}
          consequences={[t('booking.scheduledMessages.sendNow.consequenceNow'), t('booking.scheduledMessages.sendNow.consequenceGuest')]}
          confirmLabel={t('booking.scheduledMessages.sendNow.confirm')}
          isLoading={busy}
          onConfirm={confirmSendNow}
        >
          {problemInDialog ??
            (missing.length > 0 ? (
              <div className="space-y-1" data-testid="scheduled-message-send-now-missing">
                <p className="text-sm font-medium">{t('booking.scheduledMessages.sendNow.stillMissing')}</p>
                <ul className="list-disc space-y-0.5 pl-5 text-sm">
                  {missing.map((code) => (
                    <li key={code}>{t(missingItemOf(code).itemKey)}</li>
                  ))}
                </ul>
                <p className="text-sm text-foreground/70">{t('booking.scheduledMessages.sendNow.blockedNote')}</p>
              </div>
            ) : null)}
        </ConfirmationDialog>
      ) : null}
    </li>
  );
}

/** A message that can still go whose text the server could not give (the template of its routine is gone): it is said, not left as an empty space. */
function isOpenWithoutText(message: ScheduledMessage): boolean {
  return isOpenStatus(message.status) && !message.text;
}
