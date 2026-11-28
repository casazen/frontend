import { useId, useState, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LifeBuoy, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TODO_LIST_PATH } from '@/features/todo/lib/todo-model';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { assistOutcomeOf, findDoneAssist, findOpenAssist } from '@/lib/onboarding-panel';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { useAssistRequests, useReopenAssistRequest, useRequestAssist } from '@/queries/use-onboarding-assist';
import type { AssistRequestContext, OnboardingPartKey } from '@/types/onboarding.types';
import { AssistReopenDialog } from './assist-reopen-dialog';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

const ALREADY_OPEN_CODE = 'assist_request_already_open';

interface AssistRequestButtonProps {
  part: OnboardingPartKey;
  context: AssistRequestContext;
  propertyId?: string | null;
  channelCode?: string | null;
  /**
   * `needHelp` is the same request under the words of the fallback of a result CasaZen cannot read («Mi serve aiuto»); `askSupport` is the same request under the words of a notice that
   * says something is not verified yet, such as the coverage of the ISTAT of a region («Chiedi al supporto»).
   */
  label?: 'doItForMe' | 'needHelp' | 'askSupport';
  showStatus?: boolean;
  primary?: boolean;
  stepDone?: boolean;
}

/**
 * «Fallo per me» (UX-15, NF-107, AC-NF107-5): asks CasaZen support to do the step, and is on screen for as long as the step is. It asks the server
 * with the part and the property; the request then shows where it stands (requested, in progress, done) with a link to «Da fare», where it has its
 * item. A second request while one is open is the one that exists: it is shown as such (409 `assist_request_already_open`), never as a failure.
 *
 * When support closes the request for a step that is done (E20/F03/US02/T01), the card tells how: «Verificato» when CasaZen read the connection on the panel, «Dichiarato dal
 * supporto» when it could not (the support's word, never shown as a check), and offers «Non funziona»: the host says what does not work, the request goes back to support
 * and is shown as open again with the note.
 *
 * An organization administrator's action, and only while the flag `octorateOnboarding` is on: the endpoints answer 403 (`OrgBillingAdmin`) to anyone
 * else, which on a read sends the person to the no-access page, and 404 while the flag is off. So the button is not there for anyone else, and
 * nothing is read or written for them: the screens that hold it (the guided step, the connect wizard that anyone with `ota.write` opens) stay as
 * they are without it.
 */
export function AssistRequestButton(props: AssistRequestButtonProps) {
  const { contexts } = useWorkspace();
  const { flags } = useFeatureFlags();

  return flags.octorateOnboarding && isOrgBillingAdmin(contexts) ? <AssistRequest {...props} /> : null;
}

function AssistRequest({ part, context, propertyId, channelCode, label = 'doItForMe', showStatus = true, primary = false, stepDone = false }: AssistRequestButtonProps) {
  const { t } = useTranslation();
  const noteId = useId();
  const requests = useAssistRequests();
  const request = useRequestAssist();
  const reopen = useReopenAssistRequest();
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const busy = request.isPending || reopen.isPending;

  const listed = findOpenAssist(requests.data, context, propertyId, channelCode);
  const made = request.data && (request.data.status === 'Requested' || request.data.status === 'InProgress') ? request.data : undefined;
  const open = listed ?? made;
  const closed = !open && stepDone ? findDoneAssist(requests.data, context, propertyId, channelCode) : undefined;
  const alreadyOpen = isAxiosError(request.error) && getProblemCode(request.error.response?.data) === ALREADY_OPEN_CODE;

  async function reopenWith(note: string) {
    if (reopeningId === null) return;
    try {
      await reopen.mutateAsync({ id: reopeningId, note });
    } finally {
      reopen.reset();
    }
    toast.success(t('onboardingPlan.panel.assist.notWorking.reopened'));
  }

  function ask() {
    request.mutate({ part, context, propertyId: propertyId ?? undefined, channelCode: channelCode ?? undefined });
  }

  const failure = request.isError && !alreadyOpen ? (getProblemMessage(request.error, t) ?? t('onboardingPlan.panel.assist.error')) : null;
  let body: ReactNode = null;

  if (open) {
    body = showStatus ? (
      <div className="min-w-0 space-y-1 rounded-md bg-muted p-3 text-sm" data-testid="assist-request-status" data-status={open.status} role="status">
        <p className="flex items-center gap-2 font-medium">
          <LifeBuoy aria-hidden="true" className="size-4 shrink-0" />
          {t(`onboardingPlan.panel.assist.status.${open.status}`)}
        </p>
        <p className="text-foreground/70">{t('onboardingPlan.panel.assist.note')}</p>
        {open.hostNote ? (
          <p className="break-words text-foreground/70" data-testid="assist-request-host-note">
            {t('onboardingPlan.panel.assist.hostNote', { note: open.hostNote })}
          </p>
        ) : null}
        <Link to={TODO_LIST_PATH} className="inline-block min-h-11 py-2.5 font-medium text-primary-text underline underline-offset-4" data-testid="assist-request-todo-link">
          {t('onboardingPlan.panel.assist.todoLink')}
        </Link>
      </div>
    ) : null;
  } else if (closed) {
    const outcome = assistOutcomeOf(closed);
    body = showStatus ? (
      <div className="min-w-0 space-y-2 rounded-md bg-muted p-3 text-sm" data-testid="assist-outcome" data-outcome={outcome} data-request-id={closed.id} role="status">
        <p className="flex items-center gap-2 font-medium">
          {outcome === 'verified' ? <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-success-foreground" /> : <LifeBuoy aria-hidden="true" className="size-4 shrink-0" />}
          {t(`onboardingPlan.panel.assist.outcome.${outcome}.title`)}
        </p>
        <p className="text-foreground/70">{t(`onboardingPlan.panel.assist.outcome.${outcome}.text`)}</p>
        {closed.staffNote ? (
          <p className="break-words text-foreground/70" data-testid="assist-outcome-staff-note">
            {t('onboardingPlan.panel.assist.staffNote', { note: closed.staffNote })}
          </p>
        ) : null}
        <Button type="button" variant="outline" className={TOUCH_TARGET} disabled={busy} onClick={() => setReopeningId(closed.id)} data-testid="assist-reopen">
          {t('onboardingPlan.panel.assist.notWorking.action')}
        </Button>
      </div>
    ) : null;
  } else {
    body = (
      <div className="min-w-0 space-y-2">
        <Button
          type="button"
          variant={primary ? 'default' : 'outline'}
          className={TOUCH_TARGET}
          onClick={ask}
          loading={request.isPending}
          disabled={reopen.isPending}
          aria-describedby={failure ? noteId : undefined}
          data-testid={label === 'needHelp' ? 'assist-request-help' : 'assist-request-button'}
        >
          <LifeBuoy aria-hidden="true" className="size-4 shrink-0" />
          {t(`onboardingPlan.panel.assist.action.${label}`)}
        </Button>
        {failure ? (
          <p id={noteId} role="alert" className="text-sm text-danger-foreground" data-testid="assist-request-error">
            {failure}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {body}
      {reopeningId !== null ? <AssistReopenDialog onClose={() => setReopeningId(null)} onReopen={reopenWith} /> : null}
    </>
  );
}
