import { Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useExportRli, useRliChecklist } from '@/queries/use-leases';
import { getProblemMessage } from '@/lib/api-errors';
import { getRliChecklistItemLabel } from '@/lib/i18n-labels';
import { RLI_REGISTRATION_PANEL_ID } from '@/lib/rli-registration-state';
import { QUESTURA_PANEL_ID } from '@/lib/questura-communication';
import type { RliChecklist as RliChecklistData, RliChecklistItem } from '@/types';

interface Props {
  leaseId: string;
}

type ChecklistItemState = 'done' | 'failed' | 'todo';

/** Marks of the checklist (symbols, not text): ✓ only for a step that happened. */
const CHECKLIST_MARKS: Record<ChecklistItemState, string> = { done: '✓', failed: '✗', todo: '○' };

function checklistItemState(item: RliChecklistItem): ChecklistItemState {
  if (item.done) return 'done';
  return item.failed ? 'failed' : 'todo';
}

/**
 * Countdown to the RLI deadline computed by the API (LT-04): days left, "today" on the deadline day, days since it
 * passed from the day after, or the rule when the deadline is still to be determined.
 */
function deadlineCountdown(data: RliChecklistData, t: TFunction): string {
  const days = data.daysRemaining;
  if (data.registrationDeadline === null || days === null) return t('leases.rli.deadlineRule');
  if (days < 0) return t('leases.rli.countdownOverdue', { count: -days });
  if (days === 0) return t('leases.rli.countdownToday');
  return t('leases.rli.countdown', { days });
}

export function RliChecklist({ leaseId }: Props) {
  const { t } = useTranslation();
  const { data, isLoading, isError, error } = useRliChecklist(leaseId);
  const exportRli = useExportRli();

  const handleExport = async () => {
    try {
      const blob = await exportRli.mutateAsync(leaseId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `rli-prefill-${leaseId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(t('leases.rli.exportOk'));
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('leases.rli.exportError'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('leases.rli.checklistTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {isLoading && <p>{t('leases.rli.checklistLoading')}</p>}
        {isError && (
          <p className="text-destructive" role="alert">
            {getProblemMessage(error, t) ?? t('leases.rli.checklistError')}
          </p>
        )}
        {data && (
          <>
            {/* Once registered the deadline no longer matters. */}
            {!data.items.some((item) => item.key === 'rli_registered' && item.done) && (
              <p
                data-testid="rli-deadline-countdown"
                className={data.daysRemaining !== null && data.daysRemaining < 0 ? 'text-destructive' : undefined}
              >
                {deadlineCountdown(data, t)}
              </p>
            )}
            {data.items.length === 0 ? (
              <p className="text-muted-foreground">{t('leases.rli.checklistEmpty')}</p>
            ) : (
              <ul className="space-y-2">
                {data.items.map((item) => {
                  const state = checklistItemState(item);
                  return (
                    <li
                      key={item.key}
                      className="flex gap-2"
                      data-testid={`rli-checklist-item-${item.key}`}
                      data-state={state}
                    >
                      {/* The tick only for a step that really happened (LT-01): a failed attempt is never ticked. */}
                      <span aria-hidden className={state === 'failed' ? 'text-destructive' : undefined}>
                        {CHECKLIST_MARKS[state]}
                      </span>
                      <span>
                        {getRliChecklistItemLabel(item, t)}
                        {/* LT-07: ticked only once the landlord declares it in the Questura panel. */}
                        {item.key === 'questura_extra_eu' && state === 'todo' && (
                          <>
                            {' '}
                            <a
                              href={`#${QUESTURA_PANEL_ID}`}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {t('leases.rli.checklistGoToQuestura')}
                            </a>
                          </>
                        )}
                        {state === 'failed' && (
                          <>
                            {' '}
                            <span className="text-destructive">({t('leases.rli.checklistFailed')})</span>{' '}
                            <a
                              href={`#${RLI_REGISTRATION_PANEL_ID}`}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {t('leases.rli.checklistGoToRegistration')}
                            </a>
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <Button type="button" variant="outline" disabled={exportRli.isPending} onClick={handleExport}>
              {exportRli.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('leases.rli.exporting')}
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {t('leases.rli.export')}
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
