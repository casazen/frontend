import { useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { isFeatureEnabled, type FeatureFlags } from '@/config/feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { romeDateOf, todayInRome } from '@/lib/stay-dates';
import { useDeclareDocumentSdi, useDocumentSdi, useDocumentsBusy, useSubmitDocumentSdi } from '@/queries/use-fiscal-documents';
import type { FiscalDocumentEntry, FiscalDocumentSdiState, SdiScope } from '@/types';
import {
  SDI_ERROR_CODE_MAX,
  SDI_ERROR_TEXT_MAX,
  SDI_REFERENCE_MAX,
  declarationOf,
  declareProblemsOf,
  declareRefusedFieldsOf,
  documentNameOf,
  documentsReadOf,
  formatDocumentDay,
  isGuestPurpose,
  isSdiDocument,
  sdiScopeOf,
  sdiStateOf,
  submitVerdictOf,
  type SdiDeclareField,
  type SdiDeclareForm,
  type SubmitVerdict,
} from './document-model';
import { StatePill } from './document-state-badge';

export type SdiPanelDocument = Pick<FiscalDocumentEntry, 'id' | 'source' | 'status' | 'sdiStatus' | 'purpose' | 'kind' | 'number' | 'issueDate'>;

interface DocumentSdiPanelProps {
  document: SdiPanelDocument;
  /** The flags of the backend: the panel exists only while the sending to the SDI is on. */
  flags: Partial<FeatureFlags>;
  canWrite: boolean;
  onCorrect: () => void;
}

/**
 * Where an Italian electronic invoice of CasaZen stands with the SDI (E17/F03/US01/T02, NF-116, NF-86): the state THE SERVER SAYS (read from `GET .../sdi`, never worked out from what the page did), when it is of,
 * the reason of a refusal in plain words, and what can be done now: «Invia» through the channel, «Dichiara inviato a mano» for a file the issuer uploaded to the portal of the tax agency, and the guided correction
 * of an invoice the SDI rejected. It exists only while the sending is on (`sdiSubmission`: off, nothing is drawn and nothing is asked) and for an electronic invoice CasaZen issued; a document of the channel manager
 * has none. An owner invoice goes through the endpoints of the owner invoices (its permission, its flag), and has no correction here: it is credited. Nothing says «sent» that the server did not say.
 */
export function DocumentSdiPanel({ document, flags, canWrite, onCorrect }: DocumentSdiPanelProps) {
  const { contexts } = useWorkspace();
  const scope = sdiScopeOf(document);
  if (!isFeatureEnabled(flags, 'sdiSubmission') || !isSdiDocument(document)) return null;
  const ownerInvoicing = isFeatureEnabled(flags, 'ownerInvoicing');
  if (scope === 'owner' && !(isOrgBillingAdmin(contexts) && ownerInvoicing)) return null;
  const canAct = scope === 'owner' ? isFeatureEnabled(flags, 'fiscalDocumentIssuance') : canWrite;
  return <SdiPanelBody document={document} scope={scope} canAct={canAct} onCorrect={onCorrect} />;
}

interface SdiPanelBodyProps {
  document: SdiPanelDocument;
  scope: SdiScope;
  canAct: boolean;
  onCorrect: () => void;
}

function SdiPanelBody({ document, scope, canAct, onCorrect }: SdiPanelBodyProps) {
  const { t, i18n } = useTranslation();
  const query = useDocumentSdi(document.id, scope);
  const submit = useSubmitDocumentSdi();
  const busy = useDocumentsBusy({ documentIds: [document.id] });
  const [declaring, setDeclaring] = useState(false);
  // What the last answer of «Invia» said, with the state the server said the document was in when it said it: the words of the answer are told only while the document is still in that state, so a banner never stays
  // under a state it no longer describes (the SDI answered while the panel was open, or the issuer declared the sending by hand).
  const [answered, setAnswered] = useState<{ verdict: SubmitVerdict; status: string } | null>(null);
  const read = documentsReadOf({ enabled: true, isError: query.isError, status: getHttpStatus(query.error), hasData: query.data !== undefined });
  const state = read === 'ok' ? query.data : undefined;
  const name = documentNameOf(t, document);

  const send = async () => {
    setAnswered(null);
    try {
      const result = await submit.mutateAsync({ documentId: document.id, scope });
      setAnswered({ verdict: submitVerdictOf(result), status: result.state.status });
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('fiscalDocuments.sdi.submit.failed'));
    }
  };

  let content;
  if (read === 'loading' || read === 'idle') {
    content = (
      <p role="status" className="text-sm text-foreground/70" data-testid="fiscal-document-sdi-loading">
        {t('fiscalDocuments.sdi.loading')}
      </p>
    );
  } else if (read === 'notFound') {
    content = (
      <p className="text-sm text-foreground/70" data-testid="fiscal-document-sdi-gone">
        {t('fiscalDocuments.sdi.gone')}
      </p>
    );
  } else if (read === 'forbidden') {
    content = (
      <p className="text-sm text-foreground/70" data-testid="fiscal-document-sdi-forbidden">
        {t('fiscalDocuments.sdi.forbidden')}
      </p>
    );
  } else if (read === 'failed' || state === undefined) {
    content = (
      <div className="space-y-2" data-testid="fiscal-document-sdi-failed">
        <p role="alert" className="text-sm text-destructive">
          {t('fiscalDocuments.sdi.loadError')}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
          {t('shared.errorState.retry')}
        </Button>
      </div>
    );
  } else {
    content = (
      <>
        <StateBlock state={state} language={i18n.language} />
        {answered !== null && answered.status === state.status ? <VerdictNote verdict={answered.verdict} reason={state.reason} /> : null}
        {canAct ? (
          <div className="flex flex-wrap items-center gap-2" data-testid="fiscal-document-sdi-actions">
            {state.canSubmit ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                loading={submit.isPending}
                onClick={() => void send()}
                aria-label={t('fiscalDocuments.sdi.submit.label', { document: name })}
                data-testid="fiscal-document-sdi-submit"
              >
                <Send className="size-4" aria-hidden="true" />
                {t('fiscalDocuments.sdi.submit.button')}
              </Button>
            ) : null}
            {state.canDeclare ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setDeclaring(true)}
                aria-label={t('fiscalDocuments.sdi.declare.label', { document: name })}
                data-testid="fiscal-document-sdi-declare"
              >
                {t('fiscalDocuments.sdi.declare.button')}
              </Button>
            ) : null}
            {state.canCorrect && isGuestPurpose(document.purpose) ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={onCorrect}
                aria-label={t('fiscalDocuments.sdi.correct.label', { document: name })}
                data-testid="fiscal-document-sdi-correct"
              >
                {t('fiscalDocuments.sdi.correct.button')}
              </Button>
            ) : null}
          </div>
        ) : null}
        <Hints state={state} scope={scope} canAct={canAct} />
      </>
    );
  }

  return (
    <section className="space-y-3" data-testid="fiscal-document-sdi" data-scope={scope}>
      <h3 className="text-sm font-semibold">{t('fiscalDocuments.sdi.title')}</h3>
      {content}
      {declaring ? <SdiDeclareDialog document={document} scope={scope} onClose={() => setDeclaring(false)} /> : null}
    </section>
  );
}

function StateBlock({ state, language }: { state: FiscalDocumentSdiState; language: string }) {
  const { t } = useTranslation();
  const day = romeDateOf(state.statusUpdatedAt);
  const words = sdiStateOf({ sdiStatus: state.status, sdiErrorCode: state.errorCode });
  const refused = state.status === 'rejected';
  const showReason = refused || (state.status === 'to_send' && state.errorCode !== null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatePill state={words} testId="fiscal-document-sdi-state" />
        {day !== '' ? (
          <span className="text-xs text-foreground/70" data-testid="fiscal-document-sdi-day">
            {t('fiscalDocuments.sdi.updatedOn', { date: formatDocumentDay(day, language) })}
          </span>
        ) : null}
      </div>
      {showReason ? (
        <Alert variant={refused ? 'danger' : 'warning'} title={t(refused ? 'fiscalDocuments.sdi.reason.rejectedTitle' : 'fiscalDocuments.sdi.reason.refusedTitle')} data-testid="fiscal-document-sdi-reason">
          <span className="block break-words">{state.reason ?? t('fiscalDocuments.sdi.reason.unknown')}</span>
          {state.errorCode ? <span className="mt-1 block text-xs text-foreground/70">{t('fiscalDocuments.list.state.sdiCode', { code: state.errorCode })}</span> : null}
        </Alert>
      ) : null}
    </div>
  );
}

function VerdictNote({ verdict, reason }: { verdict: SubmitVerdict; reason: string | null }) {
  const { t } = useTranslation();
  const variant = verdict === 'submitted' ? 'success' : verdict === 'alreadySubmitted' || verdict === 'notConfigured' ? 'info' : 'warning';
  return (
    <Alert variant={variant} role="status" data-testid="fiscal-document-sdi-verdict" data-verdict={verdict}>
      {t(`fiscalDocuments.sdi.verdict.${verdict}`)}
      {verdict === 'refused' && reason ? <span className="mt-1 block break-words">{reason}</span> : null}
    </Alert>
  );
}

function Hints({ state, scope, canAct }: { state: FiscalDocumentSdiState; scope: SdiScope; canAct: boolean }) {
  const { t } = useTranslation();
  const hints: string[] = [];
  if (state.canSubmit && !state.providerConfigured) hints.push('fiscalDocuments.sdi.hint.noChannel');
  if (state.status === 'delivered') hints.push('fiscalDocuments.sdi.hint.delivered');
  if (state.status === 'rejected' && scope === 'owner') hints.push('fiscalDocuments.sdi.hint.ownerRejected');
  if (state.status === 'manual_declared') hints.push('fiscalDocuments.sdi.hint.declared');
  if (!canAct) hints.push('fiscalDocuments.sdi.hint.readOnly');
  if (hints.length === 0) return null;
  return (
    <ul role="list" className="space-y-1 text-sm text-foreground/70" data-testid="fiscal-document-sdi-hints">
      {hints.map((key) => (
        <li key={key} className="break-words">
          {t(key)}
        </li>
      ))}
    </ul>
  );
}

const NO_FORM = (today: string): SdiDeclareForm => ({ kind: 'Sent', date: today, reference: '', errorCode: '', errorText: '' });
const DECLARE_KINDS = ['Sent', 'Rejected'] as const;

interface SdiDeclareDialogProps {
  document: SdiPanelDocument;
  scope: SdiScope;
  onClose: () => void;
}

/**
 * «Dichiara inviato a mano» (E17/F03/US01/T02): the issuer uploaded the file to the portal of the tax agency («Fatture e Corrispettivi») by itself. It says the day and the reference of the sending, or, if the SDI sent a
 * notification of rejection, its code and its text. It works with no channel connected. What is typed is checked before it is asked (the day is not in the future and not before the day of the document, the
 * reference and the code are required), the fields the server refuses are shown on them, and the dialog stays open on a failure. The state that comes back is the server's: a declared sending is «dichiarata», never
 * «inviata dal canale». The form belongs to a dialog drawn outside the page but inside it for React: its submit never reaches a form around it.
 */
function SdiDeclareDialog({ document, scope, onClose }: SdiDeclareDialogProps) {
  const { t } = useTranslation();
  const declare = useDeclareDocumentSdi();
  const [today] = useState(() => todayInRome());
  const [form, setForm] = useState<SdiDeclareForm>(() => NO_FORM(today));
  const [asked, setAsked] = useState(false);
  const [refused, setRefused] = useState<readonly SdiDeclareField[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const found = asked ? declareProblemsOf(form, { today, issueDate: document.issueDate }) : [];
  const wrong = (field: SdiDeclareField) => found.includes(field) || refused.includes(field);
  const set = (patch: Partial<SdiDeclareForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setRefused([]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setAsked(true);
    if (declare.isPending || declareProblemsOf(form, { today, issueDate: document.issueDate }).length > 0) return;
    setProblem(null);
    setRefused([]);
    try {
      await declare.mutateAsync({ documentId: document.id, scope, declaration: declarationOf(form) });
    } catch (error) {
      setRefused(declareRefusedFieldsOf(error));
      setProblem(getProblemMessage(error, t) ?? t('fiscalDocuments.sdi.declare.failed'));
      return;
    }
    toast.success(t(form.kind === 'Sent' ? 'fiscalDocuments.sdi.declare.doneSent' : 'fiscalDocuments.sdi.declare.doneRejected'));
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // While the call is on its way the dialog stays, so that a failure is told in it.
        if (!open && !declare.isPending) onClose();
      }}
    >
      <DialogContent data-testid="fiscal-sdi-declare-dialog">
        <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t('fiscalDocuments.sdi.declare.title')}</DialogTitle>
            <DialogDescription>{t('fiscalDocuments.sdi.declare.description', { document: documentNameOf(t, document) })}</DialogDescription>
          </DialogHeader>

          <fieldset className="grid gap-1">
            <legend className="mb-1 text-sm font-medium">{t('fiscalDocuments.sdi.declare.kind.legend')}</legend>
            {DECLARE_KINDS.map((kind) => (
              <label key={kind} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name="sdi-declare-kind" className="size-4 accent-primary" checked={form.kind === kind} onChange={() => set({ kind })} data-testid={`fiscal-sdi-declare-${kind}`} />
                <span>{t(`fiscalDocuments.sdi.declare.kind.${kind}`)}</span>
              </label>
            ))}
          </fieldset>

          {form.kind === 'Sent' ? (
            <>
              <Field label={t('fiscalDocuments.sdi.declare.date.label')} hint={t('fiscalDocuments.sdi.declare.date.hint')} error={wrong('date') ? t('fiscalDocuments.sdi.declare.date.error') : undefined}>
                <Input type="date" value={form.date} max={today} min={document.issueDate ?? undefined} onChange={(event) => set({ date: event.target.value })} data-testid="fiscal-sdi-declare-date" />
              </Field>
              <Field label={t('fiscalDocuments.sdi.declare.reference.label')} hint={t('fiscalDocuments.sdi.declare.reference.hint')} error={wrong('reference') ? t('fiscalDocuments.sdi.declare.reference.error') : undefined}>
                <Input value={form.reference} maxLength={SDI_REFERENCE_MAX} autoComplete="off" onChange={(event) => set({ reference: event.target.value })} data-testid="fiscal-sdi-declare-reference" />
              </Field>
            </>
          ) : (
            <>
              <Field label={t('fiscalDocuments.sdi.declare.errorCode.label')} hint={t('fiscalDocuments.sdi.declare.errorCode.hint')} error={wrong('errorCode') ? t('fiscalDocuments.sdi.declare.errorCode.error') : undefined}>
                <Input value={form.errorCode} maxLength={SDI_ERROR_CODE_MAX} autoComplete="off" onChange={(event) => set({ errorCode: event.target.value })} data-testid="fiscal-sdi-declare-code" />
              </Field>
              <Field label={t('fiscalDocuments.sdi.declare.errorText.label')} optional counter={`${form.errorText.length}/${SDI_ERROR_TEXT_MAX}`}>
                <Textarea rows={3} maxLength={SDI_ERROR_TEXT_MAX} value={form.errorText} onChange={(event) => set({ errorText: event.target.value })} data-testid="fiscal-sdi-declare-text" />
              </Field>
            </>
          )}

          {problem ? (
            <Alert variant="danger" data-testid="fiscal-sdi-declare-problem">
              {problem}
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={declare.isPending}>
              {t('shared.cancel')}
            </Button>
            <Button type="submit" loading={declare.isPending} data-testid="fiscal-sdi-declare-submit">
              {t('fiscalDocuments.sdi.declare.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
