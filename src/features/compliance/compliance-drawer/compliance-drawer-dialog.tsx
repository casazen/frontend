import { useTranslation } from 'react-i18next';
import { FileSearch, Info } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SkeletonLine } from '@/components/ui/skeleton';
import { formatStayDate } from '@/lib/stay-dates';
import type { ComplianceHandoff, ComplianceHandoffTopic } from '@/types/compliance-handoff.types';
import { describeFailure } from './compliance-drawer-model';

/** Where the handoff stands: being prepared by the server, ready to be followed, or not possible (and then the guide is ours, never an invented one). */
export type ComplianceDrawerState =
  | { status: 'loading' }
  | { status: 'ready'; handoff: ComplianceHandoff }
  | { status: 'error'; error: unknown };

interface ComplianceDrawerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the host asked to check; the only thing the dialog knows before the server answers. */
  topic: ComplianceHandoffTopic;
  state: ComplianceDrawerState;
  /** «Continua la verifica» was pressed: the tab is on its way to the address of the handoff. */
  leaving: boolean;
  /** Saves where to come back to and opens the address of `handoff` in this same tab. */
  onContinue: (handoff: ComplianceHandoff) => void;
  onRetry: () => void;
}

/** A month (`yyyy-MM`) as «ottobre 2026», a day (`yyyy-MM-dd`) as a date; what is not one is shown as it came. */
function periodLabel(period: string, locale: string): string {
  const month = period.length === 7;
  return formatStayDate(month ? `${period}-01` : period, locale, month ? { month: 'long', year: 'numeric' } : undefined) || period;
}

function Fact({ label, testId, children }: { label: string; testId: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-foreground/70">{label}</dt>
      <dd className="min-w-0 break-words font-medium" data-testid={testId}>
        {children}
      </dd>
    </>
  );
}

function ReadyBody({ handoff }: { handoff: ComplianceHandoff }) {
  const { t, i18n } = useTranslation();
  const { context, guide } = handoff;

  return (
    <div className="space-y-4" data-testid="compliance-drawer-ready">
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm" data-testid="compliance-drawer-target">
        <Fact label={t('compliance.drawer.target.topic')} testId="compliance-drawer-topic">
          {t(`compliance.drawer.topic.${handoff.topic}`)}
        </Fact>
        <Fact label={t('compliance.drawer.target.property')} testId="compliance-drawer-property">
          {context.propertyName}
        </Fact>
        {context.octorateListingName ? (
          <Fact label={t('compliance.drawer.target.listing')} testId="compliance-drawer-listing">
            {context.octorateListingName}
          </Fact>
        ) : null}
        {context.bookingCode ? (
          <Fact label={t('compliance.drawer.target.booking')} testId="compliance-drawer-booking">
            {context.bookingCode}
          </Fact>
        ) : null}
        {context.period ? (
          <Fact label={t('compliance.drawer.target.period')} testId="compliance-drawer-period">
            {periodLabel(context.period, i18n.language)}
          </Fact>
        ) : null}
      </dl>

      <section className="space-y-1" data-testid="compliance-drawer-menu">
        <h3 className="text-sm font-semibold">{t('compliance.drawer.guide.menuTitle')}</h3>
        <p className="break-words text-sm">{guide.menuPath}</p>
      </section>

      <section className="space-y-1" data-testid="compliance-drawer-check">
        <h3 className="text-sm font-semibold">{t('compliance.drawer.guide.checkTitle')}</h3>
        <p className="break-words text-sm">{guide.check}</p>
      </section>

      <p className="text-sm text-foreground/70" data-testid="compliance-drawer-destination">
        {t(handoff.destinationKind === 'DeepLink' ? 'compliance.drawer.destination.deepLink' : 'compliance.drawer.destination.home')}
      </p>

      {/* What it is and what it is not, as a secondary line: the result stays where it is, CasaZen does not read it and keeps nothing of it. */}
      <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm" data-testid="compliance-drawer-disclosure">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-foreground/70" />
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium">{t('compliance.drawer.disclosure.title')}</p>
          <p className="break-words text-foreground/70">{t('compliance.drawer.disclosure.body')}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * «Cassetto Compliance»: the layer, in CasaZen's own words, that precedes the passage to the connected area where an Alloggiati or ISTAT
 * outcome can be read (CHK-15). It says what is being checked (the property, the stay or the period, the topic), where to go in the connected
 * area and what to look at, and in a secondary line that the data are consulted there, stay there, and are not imported. «Continua la verifica»
 * is the one way out, in the same tab; if the handoff is not possible the user stays in CasaZen with the guide of the topic and, when asking
 * again can help, a retry. It shows no result and asks for none: nothing here can turn a light green or mark anything done.
 */
export function ComplianceDrawerDialog({ open, onOpenChange, topic, state, leaving, onContinue, onRetry }: ComplianceDrawerDialogProps) {
  const { t } = useTranslation();
  const loading = state.status === 'loading';
  const failure = state.status === 'error' ? describeFailure(state.error, t) : null;

  // The tab is leaving: the layer stays as it is until the browser has gone.
  const changeOpen = (next: boolean) => {
    if (!next && leaving) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" data-testid="compliance-drawer-dialog" aria-busy={loading || leaving}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch aria-hidden="true" className="size-5 text-primary-text" />
            {t('compliance.drawer.title')}
          </DialogTitle>
          <DialogDescription>{t('compliance.drawer.intro')}</DialogDescription>
        </DialogHeader>

        {state.status === 'ready' ? (
          <ReadyBody handoff={state.handoff} />
        ) : state.status === 'error' && failure ? (
          <div className="space-y-4" data-testid="compliance-drawer-failed">
            <Alert variant="danger" data-testid="compliance-drawer-error">
              {failure.message}
            </Alert>
            {/* The guide of the topic, so the host can still do the check on their own: what to look at, never where (that is the server's to say). */}
            <section className="space-y-1" data-testid="compliance-drawer-fallback">
              <h3 className="text-sm font-semibold">{t('compliance.drawer.guide.checkTitle')}</h3>
              <p className="break-words text-sm">{t(`compliance.drawer.fallback.${topic}`)}</p>
            </section>
          </div>
        ) : (
          <div aria-live="polite" data-testid="compliance-drawer-loading">
            <p className="sr-only">{t('compliance.drawer.loading')}</p>
            <SkeletonLine lines={4} />
          </div>
        )}

        <DialogFooter>
          {state.status === 'error' ? (
            <>
              <Button type="button" variant={failure?.retryable ? 'outline' : 'default'} onClick={() => onOpenChange(false)} data-testid="compliance-drawer-close">
                {t('compliance.drawer.close')}
              </Button>
              {failure?.retryable ? (
                <Button type="button" onClick={onRetry} data-testid="compliance-drawer-retry">
                  {t('compliance.drawer.retry')}
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={leaving} data-testid="compliance-drawer-cancel">
                {t('compliance.drawer.cancel')}
              </Button>
              <Button
                type="button"
                disabled={state.status !== 'ready' || leaving}
                onClick={() => {
                  if (state.status === 'ready') onContinue(state.handoff);
                }}
                data-testid="compliance-drawer-continue"
              >
                {leaving ? t('compliance.drawer.continuing') : t('compliance.drawer.continue')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
