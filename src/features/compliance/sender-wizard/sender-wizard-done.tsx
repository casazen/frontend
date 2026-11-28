import { useEffect, useId, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { propertySetupReturn } from '@/features/properties/wizard/property-setup-model';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CONNECTION_HEALTH_SECTION } from '@/features/compliance/lib/connection-health-model';
import { useIstatClaim } from '@/features/compliance/lib/use-istat-claim';
import { cn } from '@/lib/utils';
import { useSender } from '@/queries/use-property-sender';
import { outcomeOfSender, type SenderOutcome } from './sender-wizard-model';
import { useSenderPropertyName } from './use-sender-property-name';

const COMPLIANCE_PATH = '/app/short-rent/compliance';
const PROPERTIES_PATH = '/app/short-rent/properties';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

type Tone = 'done' | 'attention' | 'problem';

const OUTCOMES: Readonly<Record<SenderOutcome, { tone: Tone; points: ReadonlyArray<{ key: string; tone: Tone }> }>> = {
  active: { tone: 'done', points: [{ key: 'send', tone: 'done' }, { key: 'istat', tone: 'done' }] },
  declared: { tone: 'attention', points: [{ key: 'word', tone: 'attention' }, { key: 'check', tone: 'attention' }] },
  unverified: { tone: 'attention', points: [{ key: 'unknown', tone: 'attention' }, { key: 'check', tone: 'attention' }] },
  inactive: { tone: 'problem', points: [{ key: 'off', tone: 'problem' }, { key: 'fix', tone: 'attention' }] },
  manual: { tone: 'done', points: [{ key: 'file', tone: 'done' }, { key: 'reminders', tone: 'done' }] },
  notAvailable: { tone: 'attention', points: [{ key: 'soon', tone: 'attention' }] },
};

const DISC: Record<Tone, { Icon: LucideIcon; className: string }> = {
  done: { Icon: CheckCircle2, className: 'bg-success-soft text-success-foreground' },
  attention: { Icon: AlertTriangle, className: 'bg-[color:var(--color-warning-soft,#fef4e2)] text-[color:var(--color-warning-foreground,#8a4b05)]' },
  problem: { Icon: XCircle, className: 'bg-[color:var(--color-danger-soft,#fdedee)] text-[color:var(--color-danger-foreground,#b4232a)]' },
};

const POINT_ICON: Record<Tone, { Icon: LucideIcon; className: string }> = {
  done: { Icon: Check, className: 'text-success-foreground' },
  attention: { Icon: AlertTriangle, className: 'text-[color:var(--color-warning-foreground,#8a4b05)]' },
  problem: { Icon: XCircle, className: 'text-[color:var(--color-danger-foreground,#b4232a)]' },
};

/**
 * The result of the wizard («Cosa succede ora»): what the sender is NOW, as the server says it (the state is read again here, so the screen never repeats an older answer), and the one
 * step that follows. Only a sender the server verified is «attivo»; the host's word is «dichiarato attivo»; what cannot be told, and what does not send, are told as they are. A state that
 * cannot be read is an error, never «tutto in ordine».
 */
export function SenderWizardDone({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const returnTo = propertySetupReturn(params, 'compliance');
  const sender = useSender(propertyId);
  const propertyName = useSenderPropertyName(propertyId, !!sender.data);
  // The green point about the ISTAT only where the table says the channel manager sends it for this property: otherwise it points to the notice and is never green.
  const istatClaim = useIstatClaim(propertyId, { channelManagerSends: true });
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const whatNextId = useId();
  const ready = !sender.isError && !!sender.data;

  // The focus goes to the result when it is on screen, so that a screen reader reads it.
  useEffect(() => {
    if (ready) titleRef.current?.focus();
  }, [ready]);

  if (sender.isError || !sender.data) {
    return sender.isError || sender.data === null ? (
      <ErrorState testId="sender-done-error" title={t('compliance.sender.done.readError')} error={sender.error} onRetry={() => void sender.refetch()} />
    ) : (
      <div role="status" aria-busy="true" data-testid="sender-done-loading" className="space-y-2">
        <span className="sr-only">{t('compliance.sender.done.loading')}</span>
        <Skeleton className="h-6 w-1/2 motion-reduce:animate-none" />
        <Skeleton className="h-6 w-2/3 motion-reduce:animate-none" />
      </div>
    );
  }

  const outcome = outcomeOfSender(sender.data);
  const { tone } = OUTCOMES[outcome];
  const points = OUTCOMES[outcome].points.map((point) => (outcome === 'active' && point.key === 'istat' && istatClaim === 'seeNotice' ? { key: 'istatSeeNotice', tone: 'attention' as const } : point));
  const { Icon, className } = DISC[tone];
  const settled = tone === 'done';
  const propertyPage = `${PROPERTIES_PATH}/${encodeURIComponent(propertyId)}`;
  const stateAddress = `${propertyPage}?${new URLSearchParams({ section: CONNECTION_HEALTH_SECTION }).toString()}`;
  const autoSend = sender.data.sender === 'ChannelManager' && typeof sender.data.autoSendGuestsToOctorate === 'boolean' ? (sender.data.autoSendGuestsToOctorate ? 'on' : 'off') : null;
  const AutoSendIcon = settled ? Check : Info;
  const primary = returnTo ? { label: t('propertySetup.returnToProperty'), to: returnTo } : settled
    ? { label: t('compliance.sender.done.toCompliance'), to: COMPLIANCE_PATH }
    : { label: t('compliance.sender.done.toState'), to: stateAddress };
  const secondary = settled
    ? { label: t('compliance.sender.done.toProperty'), to: propertyPage }
    : { label: t('compliance.sender.done.toCompliance'), to: COMPLIANCE_PATH };

  return (
    <section aria-labelledby={titleId} className="mx-auto w-full min-w-0 max-w-xl space-y-6" data-testid="sender-wizard-done" data-outcome={outcome}>
      <div className="flex min-w-0 flex-col items-center gap-3 text-center">
        <span className={cn('grid size-14 place-items-center rounded-full', className)}>
          <Icon aria-hidden="true" className="size-8" />
        </span>
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className="break-words text-2xl font-semibold tracking-tight outline-none" data-testid="sender-done-title">
          {t(`compliance.sender.done.${outcome}.title`)}
        </h2>
        {propertyName ? (
          <p className="break-words text-sm text-foreground/70" data-testid="sender-done-property">
            {t('compliance.sender.done.forProperty', { property: propertyName })}
          </p>
        ) : null}
        <p className="max-w-prose break-words text-base">{t(`compliance.sender.done.${outcome}.lead`)}</p>
      </div>

      <section aria-labelledby={whatNextId} className="space-y-3 rounded-lg bg-muted p-4">
        <h3 id={whatNextId} className="text-base font-semibold">
          {t('wizard.done.whatNext')}
        </h3>
        <ul className="space-y-2" role="list">
          {points.map((point) => {
            const { Icon: PointIcon, className: pointClass } = POINT_ICON[point.tone];
            return (
              <li key={point.key} className="flex min-w-0 items-start gap-2 text-sm" data-tone={point.tone} data-testid={`sender-done-point-${point.key}`}>
                <PointIcon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', pointClass)} />
                <span className="min-w-0 break-words">{t(`compliance.sender.done.${outcome}.points.${point.key}`)}</span>
              </li>
            );
          })}
          {autoSend ? (
            <li className="flex min-w-0 items-start gap-2 text-sm" data-tone={settled ? 'done' : 'info'} data-testid="sender-done-auto-send" data-state={autoSend}>
              <AutoSendIcon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', settled ? POINT_ICON.done.className : 'text-muted-foreground')} />
              <span className="min-w-0 break-words">{t(`compliance.sender.autoSend.consequence.${autoSend}`)}</span>
            </li>
          ) : null}
        </ul>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg" className={TOUCH_TARGET}>
          <Link to={primary.to} data-testid="sender-done-primary">
            {primary.label}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className={TOUCH_TARGET}>
          <Link to={secondary.to} data-testid="sender-done-secondary">
            {secondary.label}
          </Link>
        </Button>
      </div>
    </section>
  );
}
