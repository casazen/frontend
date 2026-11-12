import type { ThreadItem } from '@/components/shared/message-thread';
import type { PendingThreadMessage } from '@/queries/use-thread-send';
import type { MessageHubMessage, MessageHubThreadDetail } from '@/types';

/**
 * A row of the conversation: a message the server stored (`message`), or one this page is sending or could not send (`pending`, with the
 * key of its send). The shared log draws both; the bubble of the hub reads what it needs from the original.
 */
export interface HubThreadItem extends ThreadItem {
  message?: MessageHubMessage;
  pending?: PendingThreadMessage;
}

/** The words for who wrote a message when the message does not say it by name. */
export interface SenderLabels {
  guest: string;
  you: string;
  assistant: string;
}

/**
 * Who wrote a message, as the reader sees it: the guest by name, the assistant of CasaZen, a person of the host side by the name the
 * channel gives (a colleague, or the host writing on the channel itself), and «Tu» for what was written in CasaZen, which carries no name.
 */
export function senderOf(message: MessageHubMessage, guestName: string | null | undefined, labels: SenderLabels): string {
  if (message.direction === 'Inbound') return guestName?.trim() || labels.guest;
  if (message.origin === 'Assistant') return labels.assistant;
  return message.senderName?.trim() || labels.you;
}

/** The rows of a conversation: its messages oldest first, then what this page is still sending or could not send. */
export function buildThreadItems(thread: MessageHubThreadDetail, pending: readonly PendingThreadMessage[], labels: SenderLabels): HubThreadItem[] {
  return [
    ...thread.messages.map(
      (message): HubThreadItem => ({
        id: message.id,
        mine: message.direction === 'Outbound',
        author: senderOf(message, thread.guestName ?? thread.booking?.guestName, labels),
        text: message.text,
        at: message.sentAt,
        message,
      }),
    ),
    ...pending.map((item): HubThreadItem => ({ id: item.key, mine: true, author: labels.you, text: item.text, at: null, status: item.status, pending: item })),
  ];
}
