import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import type { AutopilotRunResult } from '@/types/compliance-autopilot.types';
import { AUTOPILOT_ALLOGGIATI_PATH, groupPlan } from './autopilot-model';
import { AutopilotPlanView, type AutopilotHostOnly } from './autopilot-plan';
import { AutopilotResultView } from './autopilot-result';
import { useAutopilotPlan, useRunAutopilot } from './use-autopilot';

interface AutopilotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the cockpit says only the host can do besides the stays: said in «Resta a te». */
  hostOnly: AutopilotHostOnly;
}

/** The last run, kept while the page is open: the messages for the host to send are not lost if the layer is closed. */
interface LastRun {
  result: AutopilotRunResult;
  /** When it ended, already written (HH:mm in Rome). */
  at: string;
}

function timeOf(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(date);
}

/**
 * «Gestisci con AI» (the layer above the page of the adempimenti): the assistant reads the cockpit, says what it will do and what stays with
 * the host, and does it when the host confirms. Three moments in one place and the host never leaves it: the plan (read from the server
 * every time the layer opens), the run (one request, the button busy), and the result (what was done, the messages ready for WhatsApp and SMS,
 * what did not work). Closing it never loses the result of the last run while the page is open, and it cannot be closed in the middle of a run.
 */
export function AutopilotDialog({ open, onOpenChange, hostOnly }: AutopilotDialogProps) {
  const { t, i18n } = useTranslation();
  const [last, setLast] = useState<LastRun | null>(null);
  const plan = useAutopilotPlan(open && last === null);
  const run = useRunAutopilot();
  const groups = useMemo(() => (plan.data ? groupPlan(plan.data) : null), [plan.data]);
  const canStart = groups !== null && groups.readyKeys.length > 0;

  const start = () => {
    if (!groups || groups.readyKeys.length === 0) return;
    run.mutate(
      { keys: groups.readyKeys },
      { onSuccess: (result) => setLast({ result, at: timeOf(new Date(), i18n.language) }) },
    );
  };

  const again = () => {
    run.reset();
    setLast(null);
  };

  // Not in the middle of a run: the host asked for it, and the layer is where it ends.
  const changeOpen = (next: boolean) => {
    if (!next && run.isPending) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl" data-testid="autopilot-dialog" aria-busy={run.isPending}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className="size-5 text-primary-text" />
            {t('compliance.autopilot.title')}
          </DialogTitle>
          <DialogDescription>{t('compliance.autopilot.intro')}</DialogDescription>
        </DialogHeader>

        {last ? (
          <AutopilotResultView result={last.result} at={last.at} />
        ) : plan.isError ? (
          <Alert
            variant="danger"
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => void plan.refetch()} data-testid="autopilot-retry">
                {t('compliance.autopilot.retry')}
              </Button>
            }
            data-testid="autopilot-error"
          >
            {getProblemMessage(plan.error, t) ?? t('compliance.autopilot.error')}
          </Alert>
        ) : plan.data && groups ? (
          <>
            <AutopilotPlanView plan={plan.data} groups={groups} hostOnly={hostOnly} />
            {run.isError ? (
              <Alert variant="danger" data-testid="autopilot-run-error">
                {getProblemMessage(run.error, t) ?? t('compliance.autopilot.error')}
              </Alert>
            ) : null}
          </>
        ) : (
          <div data-testid="autopilot-loading" aria-live="polite">
            <p className="sr-only">{t('compliance.autopilot.loading')}</p>
            <SkeletonLine lines={4} />
          </div>
        )}

        <DialogFooter>
          {last ? (
            <>
              <Button type="button" variant="outline" onClick={again} data-testid="autopilot-again">
                {t('compliance.autopilot.result.again')}
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)} data-testid="autopilot-close">
                {t('compliance.autopilot.close')}
              </Button>
            </>
          ) : canStart ? (
            <>
              <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={run.isPending} data-testid="autopilot-later">
                {t('compliance.autopilot.later')}
              </Button>
              <Button type="button" onClick={start} loading={run.isPending} data-testid="autopilot-start">
                {run.isPending ? t('compliance.autopilot.working') : t('compliance.autopilot.plan.start')}
              </Button>
            </>
          ) : (
            <>
              {plan.data && plan.data.items.some((item) => item.topic === 'Alloggiati') ? (
                <Button asChild variant="outline">
                  <Link to={AUTOPILOT_ALLOGGIATI_PATH} onClick={() => onOpenChange(false)} data-testid="autopilot-open-alloggiati">
                    {t('compliance.autopilot.plan.openAlloggiati')}
                  </Link>
                </Button>
              ) : null}
              <Button type="button" onClick={() => onOpenChange(false)} data-testid="autopilot-close">
                {t('compliance.autopilot.close')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
