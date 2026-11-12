import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSendCondominiumNotice } from '@/queries/use-rent';
import type { RentManualNotice } from '@/types';

type NoticeChannel = 'Email' | 'WhatsApp';

const NOTICE_CHANNELS: readonly NoticeChannel[] = ['Email', 'WhatsApp'];

/**
 * Budgets and settlements the landlord may send. Nothing leaves on open: the post runs only from «Invia», after at least
 * one channel is chosen.
 */
export function RentManualNotices({ leaseId, notices }: { leaseId: string; notices: RentManualNotice[] }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<RentManualNotice | null>(null);
  if (notices.length === 0) return null;

  return (
    <section className="space-y-3" data-testid="rent-manual-notices">
      <div>
        <h3 className="text-sm font-medium">{t('rent.notices.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('rent.notices.hint')}</p>
      </div>
      <ul className="space-y-2">
        {notices.map((notice) => (
          <li key={notice.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
            <div className="min-w-0">
              <p className="font-medium">{notice.title}</p>
              <p className="text-sm text-muted-foreground">
                {t(`rent.notices.kind.${notice.kind}`)}
                {notice.recipientName ? ` · ${notice.recipientName}` : ''}
              </p>
              {notice.summary ? <p className="mt-1 text-sm">{notice.summary}</p> : null}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setPending(notice)} data-testid={`rent-notice-send-${notice.id}`}>
              {t('rent.notices.send')}
            </Button>
          </li>
        ))}
      </ul>
      {pending ? <SendNoticeDialog leaseId={leaseId} notice={pending} onClose={() => setPending(null)} /> : null}
    </section>
  );
}

function SendNoticeDialog({
  leaseId,
  notice,
  onClose,
}: {
  leaseId: string;
  notice: RentManualNotice;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const send = useSendCondominiumNotice(leaseId);
  const [channels, setChannels] = useState<NoticeChannel[]>([]);

  function toggle(channel: NoticeChannel) {
    setChannels((current) => (current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]));
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !send.isPending && onClose()}>
      <DialogContent data-testid="rent-notice-dialog">
        <DialogHeader>
          <DialogTitle>{t('rent.notices.dialogTitle', { title: notice.title })}</DialogTitle>
          <DialogDescription>{t('rent.notices.dialogDescription')}</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('rent.notices.channels')}</legend>
          {NOTICE_CHANNELS.map((channel) => (
            <label key={channel} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={channels.includes(channel)}
                onChange={() => toggle(channel)}
              />
              {t(`rent.notices.channel.${channel}`)}
            </label>
          ))}
        </fieldset>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={send.isPending}>
            {t('rent.cancel')}
          </Button>
          <Button
            type="button"
            disabled={channels.length === 0 || send.isPending}
            data-testid="rent-notice-confirm"
            onClick={() => send.mutate({ noticeId: notice.id, channels }, { onSuccess: onClose })}
          >
            {t('rent.notices.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
