export const MESSAGES_PATH = '/app/short-rent/messages';

export function messagesOfBookingPath(bookingId: string): string {
  return `${MESSAGES_PATH}?view=all&booking=${encodeURIComponent(bookingId)}`;
}

export function messageThreadPath(threadKey: string): string {
  return `${MESSAGES_PATH}/${encodeURIComponent(threadKey)}`;
}

export function reviewThreadPath(threadKey: string): string {
  return `${messageThreadPath(threadKey)}?view=reviews`;
}
