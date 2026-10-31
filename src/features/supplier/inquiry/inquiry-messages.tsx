import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { MessageComposer, MessageThread, type ThreadItem } from '@/components/shared/message-thread';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { getProblemMessage } from '@/lib/api-errors';
import { useInquiryMessageSend, useSupplierRequestThread } from '@/queries/supplier/use-inquiry';
import type { SupplierServiceRequest } from '@/types/service-request';
import { INQUIRY_MESSAGE_MAX_LENGTH } from '@/types/supplier-inquiry';
import type { RequestActions } from '../requests/use-request-actions';

const T = 'supplier.inquiry.messages';

/**
 * The conversation with the customer of a request on measure (SP-10b, SP-08e), on the page of the request: what the customer wrote, what the
 * supplier answers, and a box to write (at most 1000 characters, plain text, no attachment). New messages are announced politely to a screen
 * reader and the thread is read again every 30 seconds while the page is visible (and less often while nothing happens), and when the page
 * opens; reading it marks the customer's messages as read, which is the point of the page and not of the drawer. The customer is «Nome C.»
 * until the request is taken (decision D9), and the section says in a line that contacts are not exchanged outside CasaZen. The text of
 * the messages is the customer's personal data: shown as text, held in memory only, never logged.
 */
export function InquiryMessages({ request, actions }: { request: SupplierServiceRequest; actions: RequestActions }) {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const thread = useSupplierRequestThread(request.id, { poll: true });
  const { pending, send, retry } = useInquiryMessageSend(request.id);

  const client = request.clientName?.trim() || t('supplier.requests.facts.clientUnknown');
  const you = t('supplier.requests.actor.you');

  if (thread.isPending) {
    return (
      <PlainSection title={t(`${T}.title`)} data-testid="supplier-inquiry-messages">
        <SkeletonLine lines={3} label={t(`${T}.loading`)} />
      </PlainSection>
    );
  }
  if (thread.isError || !thread.data) {
    return (
      <PlainSection title={t(`${T}.title`)} data-testid="supplier-inquiry-messages">
        <ErrorState testId="supplier-inquiry-messages-error" title={getProblemMessage(thread.error, t) ?? t(`${T}.loadError`)} error={thread.error} onRetry={() => void thread.refetch()} />
      </PlainSection>
    );
  }

  const { messages, canWrite } = thread.data;
  const items: ThreadItem[] = [
    ...messages.map((message) => ({
      id: message.id,
      mine: message.author === 'Supplier',
      author: message.author === 'Supplier' ? you : message.author === 'System' ? t('supplier.requests.actor.system') : client,
      text: message.body,
      at: message.createdAt,
    })),
    ...pending.map((message) => ({ id: message.key, mine: true, author: you, text: message.text, at: null, status: message.status })),
  ];
  const failed = pending.find((message) => message.status === 'failed');
  const sendProblem = failed ? (getProblemMessage(failed.error, t) ?? t(`${T}.sendError`)) : null;

  let composer;
  if (!canWrite) {
    // Closed (refused, cancelled, done) or the supplier suspended: the messages can be read, not added to.
    composer = (
      <p className="text-sm text-foreground/70" data-testid="supplier-inquiry-read-only">
        {t(actions.suspended ? 'supplier.requests.suspendedHint' : `${T}.closed`)}
      </p>
    );
  } else {
    composer = (
      <div className="space-y-1">
        <MessageComposer
          label={t(`${T}.composerLabel`, { name: client })}
          placeholder={t(`${T}.placeholder`)}
          maxLength={INQUIRY_MESSAGE_MAX_LENGTH}
          disabledReason={online ? null : t(`${T}.offline`)}
          onSend={send}
        />
        <p className="text-xs text-foreground/70">{t(`${T}.contacts`)}</p>
      </div>
    );
  }

  return (
    <PlainSection title={t(`${T}.title`)} data-testid="supplier-inquiry-messages">
      <MessageThread items={items} label={t(`${T}.logLabel`, { name: client })} emptyText={t(`${T}.empty`)} onRetry={retry} />
      {sendProblem ? (
        <p className="text-sm text-danger-foreground" role="alert" data-testid="supplier-inquiry-send-problem">
          {sendProblem}
        </p>
      ) : null}
      {composer}
    </PlainSection>
  );
}
