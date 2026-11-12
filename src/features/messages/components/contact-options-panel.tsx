import { useId, useState } from 'react';
import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { Mail, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { messageThreadPath } from '@/lib/message-hub-routes';
import { useContactOptions, useStartConversation } from '@/queries/use-message-thread';
import { GUEST_MESSAGE_MAX_LENGTH, type MessageContactOptions } from '@/types';

// The reasons a booking cannot be written to are stable codes of the API; the keys are written out so that the i18n test finds a missing one.
const REASONS: Record<string, { messageKey: string }> = {
  mapping_not_confirmed: { messageKey: 'messages.contact.reason.mappingNotConfirmed' },
  thread_closed: { messageKey: 'messages.contact.reason.threadClosed' },
  no_conversation: { messageKey: 'messages.contact.reason.noConversation' },
  contact_info_unavailable: { messageKey: 'messages.contact.unavailable' },
  octorate_not_connected: { messageKey: 'messages.contact.reason.notConnected' },
};

interface ContactOptionsPanelProps {
  bookingId: string;
  /** Writing asks `booking.write`: without it the panel only says how the guest could be reached. */
  canWrite: boolean;
}

/** The sentence for the e-mail that did not go: one for a channel that does not release the contact, one for a limit, one for anything else. */
function startProblem(error: unknown, t: TFunction): string {
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  if (getHttpStatus(error) === 409 && code === 'contact_info_unavailable') return t('messages.contact.unavailable');
  if (getHttpStatus(error) === 409 && code === 'no_contact_channel') return t('messages.contact.noChannel');
  if (getHttpStatus(error) === 409 && code === 'thread_closed') return t('messages.problem.threadClosed');
  if (getHttpStatus(error) === 429) return t('messages.problem.tooManyRequests');
  if (getHttpStatus(error) === 422) return code === 'channel_rule_violation' ? t('messages.request.noContacts') : t('messages.problem.textInvalid');
  return getProblemMessage(error, t) ?? t('messages.problem.generic');
}

/**
 * How the host can write to the guest of a booking that has no conversation yet (NF-63, AC-NF63-3/4): CasaZen asks which way there is and
 * says it in one sentence. A conversation that exists is opened; a booking of a channel that has no chat can be written to by e-mail through
 * CasaZen, from the contact the channel holds for that one booking, which the host never sees (not the address, not the number) and CasaZen
 * does not keep; when the channel does not release it, one sentence says so. When nothing can be done, it says why. The interface says
 * «il canale» and never who holds the contact (NF-12).
 */
export function ContactOptionsPanel({ bookingId, canWrite }: ContactOptionsPanelProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const options = useContactOptions(bookingId);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-labelledby={titleId} data-testid="contact-options-panel">
      <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold">
        <MessageSquare className="size-5 text-muted-foreground" aria-hidden="true" />
        {t('messages.contact.title')}
      </h2>
      {options.isPending ? (
        <div role="status" aria-busy="true">
          <span className="sr-only">{t('messages.contact.loading')}</span>
          <Skeleton className="h-16 w-full motion-reduce:animate-none" aria-hidden="true" />
        </div>
      ) : options.isError || !options.data ? (
        <ErrorState testId="contact-options-error" title={t('messages.contact.error')} error={options.error} onRetry={() => void options.refetch()} />
      ) : (
        <ContactChoice bookingId={bookingId} options={options.data} canWrite={canWrite} />
      )}
    </section>
  );
}

function ContactChoice({ bookingId, options, canWrite }: { bookingId: string; options: MessageContactOptions; canWrite: boolean }) {
  const { t } = useTranslation();

  if ((options.channel === 'Ota' || options.channel === 'Direct') && options.threadKey) {
    return (
      <div className="space-y-3" data-testid="contact-existing-thread">
        <p className="text-sm text-muted-foreground">{t(options.channel === 'Ota' ? 'messages.contact.hasThread' : 'messages.contact.directFirst')}</p>
        <Button asChild>
          <Link to={messageThreadPath(options.threadKey)} data-testid="contact-open-thread">
            {t('messages.contact.openThread')}
          </Link>
        </Button>
      </div>
    );
  }

  if (options.channel === 'Email') {
    return <EmailMessage bookingId={bookingId} canWrite={canWrite} />;
  }

  const reason = options.reason ? REASONS[options.reason] : undefined;
  return (
    <p className="text-sm text-muted-foreground" data-testid="contact-none">
      {t(reason?.messageKey ?? 'messages.contact.reason.other')}
    </p>
  );
}

/** The first message by e-mail: a text of up to 2,000 characters, sent once however many times the button is pressed. */
function EmailMessage({ bookingId, canWrite }: { bookingId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const fieldId = useId();
  const [text, setText] = useState('');
  const start = useStartConversation(bookingId);
  const trimmed = text.trim();

  if (!canWrite) {
    return <p className="text-sm text-muted-foreground">{t('messages.actions.readOnly')}</p>;
  }

  if (start.isSuccess) {
    return (
      <p className="flex items-start gap-2 text-sm" role="status" data-testid="contact-email-sent">
        <Mail className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t(start.data.state === 'ManualVerify' ? 'messages.contact.needsVerification' : 'messages.contact.sent')}
      </p>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed && !start.isPending) start.send(trimmed);
      }}
      data-testid="contact-email-form"
    >
      <p className="text-sm text-muted-foreground">{t('messages.contact.emailIntro')}</p>
      <label htmlFor={fieldId} className="sr-only">
        {t('messages.composer.label')}
      </label>
      <Textarea
        id={fieldId}
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={GUEST_MESSAGE_MAX_LENGTH}
        rows={4}
        placeholder={t('messages.contact.emailPlaceholder')}
        className="resize-y"
      />
      {start.isError ? (
        <p className="text-sm text-destructive" role="alert" data-testid="contact-email-problem">
          {startProblem(start.error, t)}
        </p>
      ) : null}
      <Button type="submit" disabled={!trimmed || start.isPending} loading={start.isPending} data-testid="contact-email-send">
        <Mail className="size-4" aria-hidden="true" />
        {t('messages.contact.writeByEmail')}
      </Button>
    </form>
  );
}
