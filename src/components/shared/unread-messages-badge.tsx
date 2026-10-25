import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface UnreadMessagesBadgeProps {
  count: number;
  className?: string;
}

/**
 * The mark of a booking with guest messages not read yet: a speech bubble and the number (99+ above that), in the accent of the
 * app. The words are for a screen reader ("2 messaggi da leggere"), so the meaning is never the color alone. Nothing at 0.
 */
export function UnreadMessagesBadge({ count, className }: UnreadMessagesBadgeProps) {
  const { t } = useTranslation();
  if (count <= 0) return null;
  return (
    <span
      data-testid="unread-messages-badge"
      className={cn(
        'inline-flex h-4 min-w-4 shrink-0 items-center justify-center gap-0.5 rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground',
        className,
      )}
    >
      <MessageSquare aria-hidden="true" className="size-2.5" />
      <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
      <span className="sr-only">{t('booking.messages.unread', { count })}</span>
    </span>
  );
}
