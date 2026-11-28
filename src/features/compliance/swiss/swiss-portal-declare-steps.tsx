import { CheckCircle2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { SwissNotificationDay } from '@/types/swissCompliance.types';
import { dayStateOf, portalLinkOf, regimeTextKey } from './swiss-day-model';
import { closedLineOf } from './swiss-day-text';

interface SwissPortalStepProps {
  day: SwissNotificationDay;
  busy: boolean;
  onOpened: () => void;
}

/**
 * Step 2 «Apri il portale»: how the canton wants the notification and the official link, the one way out of the layer. CasaZen does not sign in to the portal and never knows its
 * credentials (decision D1): the host notifies there with what they copied, and comes back to say so (the next step opens by itself). A canton with no portal (a paper form, a file by
 * e-mail) says how it is done and goes on without a link.
 */
export function SwissPortalStep({ day, busy, onOpened }: SwissPortalStepProps) {
  const { t } = useTranslation();
  const portal = portalLinkOf(day);

  return (
    <div className="space-y-3" data-testid="swiss-portal">
      <p className="text-sm font-medium" data-testid="swiss-portal-channel">
        {t(regimeTextKey('channel', day.channel))}
      </p>
      <p className="text-sm text-foreground/70">{t('swissNotification.portal.body')}</p>
      {portal ? (
        <a
          href={portal.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={busy || undefined}
          onClick={(event) => {
            if (busy) event.preventDefault();
            else onOpened();
          }}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
          data-testid="swiss-portal-link"
        >
          {t('swissNotification.portal.open', { host: portal.host })}
          <ExternalLink aria-hidden="true" className="size-4" />
          <span className="sr-only">{t('swissNotification.portal.newTab')}</span>
        </a>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-foreground/70" data-testid="swiss-portal-none">
            {t('swissNotification.portal.none')}
          </p>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onOpened} data-testid="swiss-portal-next">
            {t('swissNotification.portal.next')}
          </Button>
        </div>
      )}
      <p className="text-sm text-foreground/70">{t('swissNotification.portal.privacy')}</p>
    </div>
  );
}

interface SwissDeclareStepProps {
  day: SwissNotificationDay;
  /** The person may declare the communication of the property (`alloggiati.submit`, what the endpoint asks). */
  canSubmit: boolean;
  future: boolean;
  busy: boolean;
  onDeclare: () => void;
  onUndeclare: () => void;
  onBackToPortal: () => void;
}

export function SwissDeclareStep({ day, canSubmit, future, busy, onDeclare, onUndeclare, onBackToPortal }: SwissDeclareStepProps) {
  const { t, i18n } = useTranslation();

  if (dayStateOf(day) === 'declared') {
    return (
      <div className="space-y-3" data-testid="swiss-declared">
        <p className="flex items-start gap-2 text-sm">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="min-w-0 break-words">{closedLineOf(day, t, i18n.language)}</span>
        </p>
        {canSubmit ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onUndeclare} data-testid="swiss-undeclare">
            {t('swissNotification.declare.undo')}
          </Button>
        ) : null}
      </div>
    );
  }

  if (future) {
    return (
      <p className="text-sm text-foreground/70" data-testid="swiss-declare-future">
        {t('swissNotification.day.future')}
      </p>
    );
  }

  if (!canSubmit) {
    return (
      <p className="text-sm text-foreground/70" data-testid="swiss-declare-needs-submit">
        {t('swissNotification.declare.needsSubmit')}
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="swiss-declare">
      <p className="text-sm text-foreground/70">{t('swissNotification.declare.body')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={busy} onClick={onDeclare} data-testid="swiss-declare-button">
          {t('swissNotification.declare.action')}
        </Button>
        <Button type="button" variant="link" size="sm" disabled={busy} onClick={onBackToPortal} className="h-auto min-h-11 whitespace-normal py-2 text-left">
          {t('swissNotification.declare.notYet')}
        </Button>
      </div>
    </div>
  );
}
