import { CheckCircle2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { TicinoNotificationDay } from '@/types/swissCompliance.types';
import { dayStateOf } from './ticino-day-model';
import { closedLineOf } from './ticino-day-text';

/** The portal is a page on https: whatever else an answer says is not offered as a link. */
function portalHrefOf(day: Pick<TicinoNotificationDay, 'portalUrl'>): string | null {
  return /^https:\/\//i.test(day.portalUrl) ? day.portalUrl : null;
}

interface TicinoPortalStepProps {
  day: TicinoNotificationDay;
  /** The person pressed the link to the portal: the layer goes on to the declaration, which is where they land when they come back. */
  onOpened: () => void;
}

/**
 * Step 3 «Carica sul portale»: how to upload the file on the portal of the canton and the official link, the one way out of the layer. CasaZen does not sign in to the
 * portal and never knows its credentials (decision D1): the host uploads the file, and comes back to say so (the next step opens by itself).
 */
export function TicinoPortalStep({ day, onOpened }: TicinoPortalStepProps) {
  const { t } = useTranslation();
  const href = portalHrefOf(day);

  return (
    <div className="space-y-3" data-testid="ticino-portal">
      <p className="text-sm text-foreground/70">{t('swiss.portal.body')}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onOpened}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
          data-testid="ticino-portal-link"
        >
          {t('swiss.portal.open')}
          <ExternalLink aria-hidden="true" className="size-4" />
          <span className="sr-only">{t('swiss.portal.newTab')}</span>
        </a>
      ) : null}
      <p className="text-sm text-foreground/70">{t('swiss.portal.accents')}</p>
      <p className="text-sm text-foreground/70">{t('swiss.portal.privacy')}</p>
    </div>
  );
}

interface TicinoDeclareStepProps {
  day: TicinoNotificationDay;
  /** The person may declare the police communication of the property (`alloggiati.submit`, what the endpoint asks). */
  canSubmit: boolean;
  /** The day has not started in Switzerland: it cannot be declared. */
  future: boolean;
  busy: boolean;
  onDeclare: () => void;
  onUndeclare: () => void;
  /** Back to the step of the portal, for who has not uploaded the file yet. */
  onBackToPortal: () => void;
}

/**
 * Step 4 «Ho caricato il file»: the host says the file was uploaded, and the day leaves the days to notify (the cockpit and the counter of the menu read again, and the others
 * of the team are told). A day already declared says who did it and when, and can be reopened by whoever may declare, unless the receipt of the portal is filed (it closes the day
 * by itself, so there is nothing to reopen); a day closed by the receipt alone has nothing to declare.
 */
export function TicinoDeclareStep({ day, canSubmit, future, busy, onDeclare, onUndeclare, onBackToPortal }: TicinoDeclareStepProps) {
  const { t, i18n } = useTranslation();
  const state = dayStateOf(day);
  const closed = closedLineOf(day, t, i18n.language);

  if (state === 'declared' || state === 'receipt') {
    return (
      <div className="space-y-3" data-testid="ticino-declared">
        <p className="flex items-start gap-2 text-sm">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="min-w-0 break-words">{closed}</span>
        </p>
        {/* With the receipt of the portal filed the day stays closed whatever happens to the declaration (the undo removes only the declaration): nothing would be reopened, and the others of the team would be told it was. */}
        {state === 'declared' && canSubmit && day.receiptCount === 0 ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onUndeclare} data-testid="ticino-undeclare">
            {t('swiss.declare.undo')}
          </Button>
        ) : null}
      </div>
    );
  }

  if (future) {
    return (
      <p className="text-sm text-foreground/70" data-testid="ticino-declare-future">
        {t('swiss.day.future')}
      </p>
    );
  }

  if (!canSubmit) {
    return (
      <p className="text-sm text-foreground/70" data-testid="ticino-declare-needs-submit">
        {t('swiss.declare.needsSubmit')}
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="ticino-declare">
      <p className="text-sm text-foreground/70">{t('swiss.declare.body')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={busy} onClick={onDeclare} data-testid="ticino-declare-button">
          {t('swiss.declare.action')}
        </Button>
        <Button type="button" variant="link" size="sm" disabled={busy} onClick={onBackToPortal} className="h-auto min-h-11 whitespace-normal py-2 text-left">
          {t('swiss.declare.notYet')}
        </Button>
      </div>
    </div>
  );
}
