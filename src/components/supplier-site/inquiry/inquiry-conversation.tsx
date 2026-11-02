import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import type { PublicBookingView } from '@/api/public-supplier-booking.api';
import { MessageComposer, MessageThread, type ThreadItem } from '@/components/shared/message-thread';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { formatTypicalResponse } from '@/lib/supplier-site/format';
import { INQUIRY_LIMITS } from '@/lib/supplier-site/inquiry-flow';
import type { RequestFailure } from '@/lib/supplier-site/request-errors';
import type { QuietCall } from './types';
import { useInquiryMessages } from './use-inquiry-messages';

/** The id of the section: the offer sends the person here to write to the supplier. */
export const CONVERSATION_ID = 'vi-chat';

/** The sentence under a message that could not be sent: the reason, in the words of the page. */
function useSendProblem(failure: RequestFailure | undefined): string | null {
  const { t } = useTranslation();
  if (!failure) return null;
  if (failure.kind === 'refused' && ['threadClosed', 'threadFull', 'messageInvalid', 'supplierUnavailable'].includes(failure.reason)) {
    return t(`supplierSite.request.errors.${failure.reason}`);
  }
  if (failure.kind === 'rateLimited') {
    return failure.retryAfterSeconds
      ? t('supplierSite.request.errors.rateLimitedWait', { minutes: Math.max(1, Math.ceil(failure.retryAfterSeconds / 60)) })
      : t('supplierSite.request.errors.rateLimited');
  }
  return t('supplierSite.inquiry.chat.sendError');
}

interface InquiryConversationProps {
  view: PublicBookingView;
  quiet: QuietCall;
  /** The typical time to answer of the supplier, measured (never written by hand); null until it is. */
  typicalResponseMinutes: number | null;
}

/**
 * The conversation with the supplier of a request on measure (SP-12c), inside «La mia richiesta»: the customer on the right, the
 * supplier on the left, the notices of CasaZen between them; a box to write (1,000 characters of plain text, no attachment). New messages
 * are announced politely to a screen reader (the thread is a polite log) and the page above reads the request again by itself while it
 * is open and in front. The message shows at once as «sending» and stays as «not sent» with a retry if it fails. The words are the
 * customer's and the supplier's personal data: shown as text, held in memory only, never logged.
 */
export function InquiryConversation({ view, quiet, typicalResponseMinutes }: InquiryConversationProps) {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const { pending, send, retry } = useInquiryMessages(quiet);
  const failed = pending.find((message) => message.status === 'failed');
  const problem = useSendProblem(failed?.failure);
  const thread = view.thread;
  if (!thread) return null;

  const name = view.supplier.name;
  const you = t('supplierSite.inquiry.chat.you');
  const items: ThreadItem[] = [
    ...thread.messages.map((message) => ({
      id: message.id,
      mine: message.author === 'customer',
      author: message.author === 'customer' ? you : message.author === 'system' ? t('supplierSite.inquiry.chat.system') : name,
      text: message.body,
      at: message.createdAt,
    })),
    ...pending.map((message) => ({ id: message.key, mine: true, author: you, text: message.text, at: null, status: message.status })),
  ];

  return (
    <section className="vz-section vz-section--tight vi-chat" id={CONVERSATION_ID} aria-labelledby="vi-chat-title" data-testid="supplier-inquiry-conversation">
      <div className="vz-container">
        <div className="vi-chat__in">
          <h2 id="vi-chat-title" className="vf-h2">
            {t('supplierSite.inquiry.chat.title')}
          </h2>
          {typicalResponseMinutes ? <p className="vf-p">{t('supplierSite.inquiry.chat.typical', { name, typical: formatTypicalResponse(typicalResponseMinutes, t) })}</p> : null}
          <MessageThread items={items} label={t('supplierSite.inquiry.chat.logLabel', { name })} emptyText={t('supplierSite.inquiry.chat.empty')} onRetry={retry} />
          {problem ? (
            <p className="vb-error" role="alert" data-testid="supplier-inquiry-send-problem">
              {problem}
            </p>
          ) : null}
          {thread.canWrite ? (
            <div className="vi-chat__write">
              <MessageComposer
                label={t('supplierSite.inquiry.chat.composerLabel', { name })}
                placeholder={t('supplierSite.inquiry.chat.placeholder')}
                maxLength={INQUIRY_LIMITS.messageMax}
                disabledReason={online ? null : t('supplierSite.inquiry.chat.offline')}
                onSend={send}
              />
              <p className="vb-hint vb-hint--icon">
                <ShieldCheck aria-hidden="true" />
                <span>{t('supplierSite.inquiry.chat.contacts')}</span>
              </p>
            </div>
          ) : (
            <p className="vb-note" data-testid="supplier-inquiry-read-only">
              {view.status === 'Richiesto' ? t('supplierSite.inquiry.chat.unavailable', { name }) : t('supplierSite.inquiry.chat.closed')}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
