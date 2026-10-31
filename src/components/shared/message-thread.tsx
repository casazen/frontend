import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useMediaQuery } from '@/hooks/use-media-query';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';

/**
 * From this many characters the composer shows how many are left; for a box with a shorter limit (the 1,000 characters of the messages of a
 * request on measure, SP-08e), from nine tenths of it.
 */
const COUNTER_FROM = 1800;
const counterFrom = (maxLength: number) => Math.min(COUNTER_FROM, Math.floor(maxLength * 0.9));

const SHORT_DATE_TIME: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };

/** A message of a conversation as a reader sees it: who wrote it, what, when, and whether it is on its way. */
export interface ThreadItem {
  id: string;
  /** Written by the reader: the bubble goes on the right. */
  mine: boolean;
  /** The name the reader sees ("Tu", the name of the host or of the guest). */
  author: string;
  /** Plain text, shown as text (line breaks kept, never markup or links). */
  text: string;
  /** UTC instant; `null` for a message that has not reached the server yet. */
  at: string | null;
  status?: 'sending' | 'failed';
}

interface MessageThreadProps {
  items: ThreadItem[];
  /** Accessible name of the log. */
  label: string;
  emptyText: string;
  /** Sends a message that failed again (the same one, with the same key). */
  onRetry?: (id: string) => void;
}

/**
 * The messages of a conversation, oldest first, in a scrollable log announced politely to screen readers (DB-14b, SR-12): the guest's
 * and the host's screens show the same thread with the same component. It keeps the newest message in view when the reader was at the
 * bottom, and leaves the scroll alone when the reader scrolled up; it never takes the focus.
 */
export function MessageThread({ items, label, emptyText, onRetry }: MessageThreadProps) {
  const { t, i18n } = useTranslation();
  const logRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  useEffect(() => {
    const log = logRef.current;
    if (log && atBottom.current) log.scrollTop = log.scrollHeight;
  }, [items.length]);

  return (
    <div
      ref={logRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label={label}
      tabIndex={0}
      onScroll={(event) => {
        const log = event.currentTarget;
        atBottom.current = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
      }}
      className="max-h-80 min-h-24 space-y-3 overflow-y-auto rounded-md border bg-muted/30 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="message-thread"
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className={cn('flex flex-col gap-1', item.mine ? 'items-end' : 'items-start')}
            data-testid="message-bubble"
          >
            <p className="px-1 text-xs text-muted-foreground">
              {item.author}
              {item.status === 'sending' && ` · ${t('messageThread.sending')}`}
              {item.status !== 'sending' && item.at && ` · ${formatRomeDateTime(item.at, i18n.language, SHORT_DATE_TIME)}`}
            </p>
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-wrap rounded-2xl border px-3 py-2 text-sm [overflow-wrap:anywhere]',
                item.mine ? 'border-transparent bg-primary text-primary-foreground' : 'bg-card',
                item.status === 'sending' && 'opacity-70',
              )}
            >
              {item.text}
            </div>
            {item.status === 'failed' && (
              <p className="flex flex-wrap items-center gap-2 px-1 text-xs text-destructive" role="alert">
                {t('messageThread.failed')}
                {onRetry && (
                  <Button type="button" variant="outline" size="sm" onClick={() => onRetry(item.id)}>
                    {t('messageThread.retry')}
                  </Button>
                )}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}

interface MessageComposerProps {
  /** Accessible name of the text area. */
  label: string;
  placeholder: string;
  maxLength: number;
  /** Why a message cannot be sent now (offline…): the send button is off and the text typed stays. */
  disabledReason?: string | null;
  onSend: (text: string) => void;
}

/**
 * The box where a message is written (DB-14b, SR-12): Enter sends and Shift+Enter starts a new line; on a touch screen the Enter key
 * starts a new line and the «Invia» button, always there, sends. The text is cleared when the message is handed to {@link onSend}
 * (the screen then shows it as «sending», with its own retry), so a slow network never makes the guest type it again.
 */
export function MessageComposer({ label, placeholder, maxLength, disabledReason, onSend }: MessageComposerProps) {
  const { t } = useTranslation();
  const fieldId = useId();
  const hintId = useId();
  const touch = useMediaQuery('(pointer: coarse)');
  const [text, setText] = useState('');
  const trimmed = text.trim();
  const blocked = Boolean(disabledReason);
  const canSend = trimmed.length > 0 && !blocked;

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
    setText('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || touch || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-2"
      data-testid="message-composer"
    >
      <label htmlFor={fieldId} className="sr-only">
        {label}
      </label>
      <Textarea
        id={fieldId}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        maxLength={maxLength}
        rows={3}
        placeholder={placeholder}
        aria-describedby={hintId}
        className="resize-y"
      />
      <div className="flex items-center justify-between gap-3">
        <p id={hintId} className="text-xs text-muted-foreground" role={blocked ? 'status' : undefined}>
          {blocked
            ? disabledReason
            : text.length >= counterFrom(maxLength)
              ? t('messageThread.counter', { count: text.length, max: maxLength })
              : touch
                ? ''
                : t('messageThread.enterHint')}
        </p>
        <Button type="submit" disabled={!canSend}>
          {t('messageThread.send')}
        </Button>
      </div>
    </form>
  );
}
