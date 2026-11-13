import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Ban, CheckCircle2, CircleHelp, Copy, Hourglass, Wrench, type LucideIcon } from 'lucide-react';
import { StatePill } from '@/features/onboarding/components/state-pill';
import { formatRelative } from '@/components/shared/timeline/timeline-time';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getProblemMessage } from '@/lib/api-errors';
import { isOnboardingPartKey, partTitleKey } from '@/lib/onboarding-parts';
import type { StatusTone } from '@/lib/status-dictionary';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { AdminAssistRequest, AssistUpdateStatus } from '@/types/onboarding.types';

/** The longest note the API accepts (`assist_note_invalid` above it). */
const NOTE_MAX_LENGTH = 500;

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/** The contexts of a request this version has words for (backend `OnboardingAssistContexts`); anything else reads as a neutral word. */
const CONTEXTS: ReadonlySet<string> = new Set(['panelPolice', 'panelIstat', 'panelChannelAccess', 'part']);

/** How each status looks: a tone, an icon and (in the translations) its words, so that it is never told by color alone (UX-09). */
const STATUS_VIEW: Record<string, { tone: StatusTone; Icon: LucideIcon; key: string }> = {
  Requested: { tone: 'warning', Icon: Hourglass, key: 'requested' },
  InProgress: { tone: 'info', Icon: Wrench, key: 'inProgress' },
  Done: { tone: 'success', Icon: CheckCircle2, key: 'done' },
  Cancelled: { tone: 'neutral', Icon: Ban, key: 'cancelled' },
};
/** A status this version does not know (the server is newer) is never read as done or open: it is shown as not understood and has no action. */
const UNKNOWN_STATUS = { tone: 'warning', Icon: CircleHelp, key: 'unknown' } as const;

/** What a staff action asks, with the status it moves the request to and the words of its dialog. */
const ACTIONS: ReadonlyArray<{ status: AssistUpdateStatus; key: 'take' | 'done' | 'cancel'; from: readonly string[] }> = [
  { status: 'inProgress', key: 'take', from: ['Requested'] },
  { status: 'done', key: 'done', from: ['Requested', 'InProgress'] },
  { status: 'cancelled', key: 'cancel', from: ['Requested', 'InProgress'] },
];

/** The first characters of an identifier: enough to tell two apart in a list and to quote on the phone; the whole id is one press away (the copy button). */
function shortId(id: string): string {
  return id.slice(0, 8);
}

interface IdLineProps {
  label: string;
  id: string;
  testId: string;
}

/** An identifier of the request, short, with a button that copies it whole. */
function IdLine({ label, id, testId }: IdLineProps) {
  const { t } = useTranslation();

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      toast.success(t('onboardingPlan.assist.copied'));
    } catch {
      // No clipboard (an insecure page, a refused permission): the short id is still there to read.
      toast.error(t('onboardingPlan.assist.copyError'));
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2" data-testid={testId}>
      <span className="text-foreground/70">{label}</span>
      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{shortId(id)}</code>
      <Button type="button" variant="ghost" size="sm" className="h-auto min-h-11 px-2" onClick={() => void copy()} aria-label={t('onboardingPlan.assist.copyLabel', { what: label })} iconRight={<Copy />}>
        {t('onboardingPlan.assist.copy')}
      </Button>
    </div>
  );
}

interface ActionDialogProps {
  action: (typeof ACTIONS)[number];
  request: AdminAssistRequest;
  onClose: () => void;
  /** Sends the change and settles when the server answered: a rejection is the refusal, said under the note. */
  onUpdate: (id: string, status: AssistUpdateStatus, note?: string) => Promise<unknown>;
}

/**
 * The small dialog of one staff action: an optional note of at most 500 characters (a counter, and «Non scrivere indirizzi email»: the note goes to the host
 * and the server refuses an e-mail address, 422 `assist_note_invalid`, which is said under the field). The dialog stays open on a refusal so the note can be
 * fixed, and closes when the server accepted the change. It cannot be closed, nor pressed twice, while the call is on its way.
 */
function AssistActionDialog({ action, request, onClose, onUpdate }: ActionDialogProps) {
  const { t } = useTranslation();
  const ids = useId();
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function confirm() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await onUpdate(request.id, action.status, note.trim() === '' ? undefined : note.trim());
      onClose();
    } catch (failure) {
      setError(failure);
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !sending && onClose()}>
      <DialogContent data-testid={`assist-dialog-${action.key}`}>
        <DialogHeader>
          <DialogTitle>{t(`onboardingPlan.assist.actions.${action.key}.title`)}</DialogTitle>
          <DialogDescription>{t(`onboardingPlan.assist.actions.${action.key}.description`)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`${ids}-note`}>{t('onboardingPlan.assist.note.label')}</Label>
          <Textarea
            id={`${ids}-note`}
            value={note}
            maxLength={NOTE_MAX_LENGTH}
            disabled={sending}
            aria-invalid={error !== null || undefined}
            aria-describedby={`${ids}-hint${error !== null ? ` ${ids}-error` : ''}`}
            onChange={(event) => setNote(event.target.value)}
            data-testid="assist-note"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/70">
            <p id={`${ids}-hint`}>{t('onboardingPlan.assist.note.hint')}</p>
            <p aria-live="off" data-testid="assist-note-counter">
              {t('onboardingPlan.assist.note.counter', { count: note.length, max: NOTE_MAX_LENGTH })}
            </p>
          </div>
          {error !== null ? (
            <p id={`${ids}-error`} role="alert" className="text-sm text-danger-foreground" data-testid="assist-note-error">
              {getProblemMessage(error, t) ?? t('onboardingPlan.assist.note.error')}
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" className={TOUCH_TARGET} disabled={sending} onClick={onClose} data-testid="assist-dialog-cancel">
            {t('onboardingPlan.assist.dialogCancel')}
          </Button>
          <Button type="button" className={TOUCH_TARGET} loading={sending} onClick={() => void confirm()} data-testid="assist-dialog-confirm">
            {t(`onboardingPlan.assist.actions.${action.key}.confirm`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AssistRequestRowProps {
  request: AdminAssistRequest;
  /** The time now, for «da 3 ore». */
  now: number;
  /** Any update of the page is on its way: every action of every row is off until it answered (one at a time). */
  busy: boolean;
  onUpdate: (id: string, status: AssistUpdateStatus, note?: string) => Promise<unknown>;
}

/**
 * One «Do it for me» request in the staff queue (E10/F03/US03/T03, NF-107, NF-15, UX-15): what help is asked with, in words («Collegamento Questura: struttura X,
 * comune Y»), when it was asked and how long ago, where it stands (words, colour and icon), the identifiers as short ids with a copy button and the actions
 * «Prendi in carico», «Segna come fatta» and «Annulla», each with a small dialog and an optional note. Nothing is shown that the backend does not send: no draft, no
 * credential, no person who asked. A request that is done or cancelled has no action (the server answers 409), and a status this version does not know has none
 * either.
 */
export function AssistRequestRow({ request, now, busy, onUpdate }: AssistRequestRowProps) {
  const { t, i18n } = useTranslation();
  const [action, setAction] = useState<(typeof ACTIONS)[number] | null>(null);
  const view = STATUS_VIEW[request.status] ?? UNKNOWN_STATUS;
  const context = CONTEXTS.has(request.context) ? request.context : 'unknown';
  const contextWords = t(`onboardingPlan.assist.contexts.${context}`);
  const title = request.propertyName
    ? request.comune
      ? t('onboardingPlan.assist.row.propertyComune', { context: contextWords, property: request.propertyName, comune: request.comune })
      : t('onboardingPlan.assist.row.property', { context: contextWords, property: request.propertyName })
    : t('onboardingPlan.assist.row.org', { context: contextWords });
  const requestedAt = new Date(request.requestedAt);
  const valid = !Number.isNaN(requestedAt.getTime());
  const ago = valid ? formatRelative(requestedAt, new Date(now), i18n.language) : null;
  const when = valid ? formatRomeDateTime(request.requestedAt, i18n.language, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const actions = ACTIONS.filter((candidate) => candidate.from.includes(request.status));

  return (
    <li className="min-w-0 space-y-3 rounded-lg border bg-card p-4" data-testid={`assist-row-${request.id}`} data-status={request.status}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 space-y-1">
          <p className="break-words font-medium" data-testid="assist-row-title">
            {title}
          </p>
          <p className="break-words text-sm text-foreground/70" data-testid="assist-row-part">
            {isOnboardingPartKey(request.part) ? t('onboardingPlan.assist.row.part', { part: t(partTitleKey(request.part)) }) : t('onboardingPlan.assist.row.partUnknown')}
          </p>
        </div>
        <StatePill tone={view.tone} icon={view.Icon} label={t(`onboardingPlan.assist.status.${view.key}`)} data-testid="assist-row-status" data-state={view.key} />
      </div>

      <p className="text-sm" data-testid="assist-row-when">
        {when ? t('onboardingPlan.assist.row.requested', { date: when }) : ''}
        {ago ? ` · ${ago}` : ''}
      </p>

      <div className="space-y-0.5 text-sm" data-testid="assist-row-ids">
        <IdLine label={t('onboardingPlan.assist.ids.request')} id={request.id} testId="assist-row-id-request" />
        <IdLine label={t('onboardingPlan.assist.ids.org')} id={request.orgId} testId="assist-row-id-org" />
        {request.assignedToUserId ? <IdLine label={t('onboardingPlan.assist.ids.assigned')} id={request.assignedToUserId} testId="assist-row-id-assigned" /> : null}
        {request.draftEntityId ? (
          <IdLine
            label={request.draftWizardType ? t('onboardingPlan.assist.ids.draftOf', { type: request.draftWizardType }) : t('onboardingPlan.assist.ids.draft')}
            id={request.draftEntityId}
            testId="assist-row-id-draft"
          />
        ) : null}
      </div>

      {request.staffNote ? (
        <p className="break-words rounded-md bg-muted p-2 text-sm" data-testid="assist-row-note">
          <span className="font-medium">{t('onboardingPlan.assist.row.note')}</span> {request.staffNote}
        </p>
      ) : null}

      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('onboardingPlan.assist.row.actions')}>
          {actions.map((candidate) => (
            <Button
              key={candidate.status}
              type="button"
              variant={candidate.key === 'take' ? 'default' : 'outline'}
              className={TOUCH_TARGET}
              disabled={busy}
              onClick={() => setAction(candidate)}
              data-testid={`assist-row-${candidate.key}`}
            >
              {t(`onboardingPlan.assist.actions.${candidate.key}.label`)}
            </Button>
          ))}
        </div>
      ) : null}

      {action ? <AssistActionDialog action={action} request={request} onClose={() => setAction(null)} onUpdate={onUpdate} /> : null}
    </li>
  );
}
