import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { PLACEHOLDER_KEYS, splitPlaceholders } from '../lib/scheduled-messages';

interface ScheduledMessageTextProps {
  text: string;
  className?: string;
}

/**
 * The text of a scheduled message in a read-only block (E05/F07/US02, NF-71): the words of the message with their values in place, and where a link or a code will be made when the message goes
 * out, a sentence that says so («il link del check-in verrà creato quando il messaggio parte»). A preview issues no link and releases no code, so the text never carries either: what
 * the host reads is what the guest will read, with those three parts named instead of shown. The line breaks of the message stay.
 */
export function ScheduledMessageText({ text, className }: ScheduledMessageTextProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('whitespace-pre-wrap break-words border-l-2 border-border pl-3 text-sm', className)} data-testid="scheduled-message-text-block">
      {splitPlaceholders(text).map((part, index) =>
        part.kind === 'text' ? (
          <Fragment key={index}>{part.text}</Fragment>
        ) : (
          <span key={index} className="italic text-foreground/70" data-placeholder={part.name}>
            {`[${t(PLACEHOLDER_KEYS[part.name])}]`}
          </span>
        ),
      )}
    </div>
  );
}
