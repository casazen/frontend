import { useId } from 'react';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TODO_LIST_PATH } from '@/features/todo/lib/todo-model';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { findOpenAssist } from '@/lib/onboarding-panel';
import { useAssistRequests, useRequestAssist } from '@/queries/use-onboarding-assist';
import type { AssistRequestContext, OnboardingPartKey } from '@/types/onboarding.types';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/** The 409 that says a request of the same step is already open: the request that is open is the answer. */
const ALREADY_OPEN_CODE = 'assist_request_already_open';

interface AssistRequestButtonProps {
  /** The part of the plan the step belongs to (`compliance`, `channels`). */
  part: OnboardingPartKey;
  /** What help is asked with: `panelPolice`, `panelIstat`, `panelChannelAccess` or `part`. */
  context: AssistRequestContext;
  /** The property the step is about; none for the whole org. */
  propertyId?: string | null;
  /** The channel of a channel access. */
  channelCode?: string | null;
  /** `needHelp` is the same request under the words of the fallback of a result CasaZen cannot read («Mi serve aiuto»). */
  label?: 'doItForMe' | 'needHelp';
  /** The line that says where the request stands and the link to «Da fare»: one on a page is enough. */
  showStatus?: boolean;
}

/**
 * «Fallo per me» (UX-15, NF-107, AC-NF107-5): asks CasaZen support to do the step, and is on screen for as long as the step is. It asks the server
 * with the part and the property; the request then shows where it stands (requested, in progress, done) with a link to «Da fare», where it has its
 * item. A second request while one is open is the one that exists: it is shown as such (409 `assist_request_already_open`), never as a failure.
 * An organization administrator's action: the page offers it to nobody else.
 */
export function AssistRequestButton({ part, context, propertyId, channelCode, label = 'doItForMe', showStatus = true }: AssistRequestButtonProps) {
  const { t } = useTranslation();
  const noteId = useId();
  const requests = useAssistRequests();
  const request = useRequestAssist();

  // What support has open for this step: from the list the server gave, or from the answer of the request made a moment ago.
  const listed = findOpenAssist(requests.data, context, propertyId);
  const made = request.data && (request.data.status === 'Requested' || request.data.status === 'InProgress') ? request.data : undefined;
  const open = listed ?? made;
  const alreadyOpen = isAxiosError(request.error) && getProblemCode(request.error.response?.data) === ALREADY_OPEN_CODE;

  if (open) {
    if (!showStatus) return null;
    return (
      <div className="min-w-0 space-y-1 rounded-md bg-muted p-3 text-sm" data-testid="assist-request-status" data-status={open.status} role="status">
        <p className="flex items-center gap-2 font-medium">
          <LifeBuoy aria-hidden="true" className="size-4 shrink-0" />
          {t(`onboardingPlan.panel.assist.status.${open.status}`)}
        </p>
        <p className="text-foreground/70">{t('onboardingPlan.panel.assist.note')}</p>
        <Link to={TODO_LIST_PATH} className="inline-block min-h-11 py-2.5 font-medium text-primary-text underline underline-offset-4" data-testid="assist-request-todo-link">
          {t('onboardingPlan.panel.assist.todoLink')}
        </Link>
      </div>
    );
  }

  function ask() {
    request.mutate({ part, context, propertyId: propertyId ?? undefined, channelCode: channelCode ?? undefined });
  }

  const failure = request.isError && !alreadyOpen ? (getProblemMessage(request.error, t) ?? t('onboardingPlan.panel.assist.error')) : null;

  return (
    <div className="min-w-0 space-y-2">
      <Button
        type="button"
        variant="outline"
        className={TOUCH_TARGET}
        onClick={ask}
        loading={request.isPending}
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
