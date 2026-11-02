import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { AiContentNotice } from '@/components/shared/ai-content-notice';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { HelpTip } from '@/components/ui/help-tip';
import { Textarea } from '@/components/ui/textarea';
import { getProblemMessage } from '@/lib/api-errors';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { useRequestAssist, useRequestAssistAvailability } from '@/queries/use-service-request-assist';
import { useServiceCategories } from '@/queries/use-service-categories';
import type { ServiceRequestAssist, ServiceRequestAssistReason } from '@/types/service-request-assist';
import { assign, NO_SUPPLIER } from './request-form';
import { ASSIST_MAX_TEXT, ASSIST_MIN_TEXT, assistOutcome, type AssistOutcome, type RequestValues } from './request-model';

interface RequestAssistCardProps {
  /** The host took the proposal: the wizard goes on from where the channel says (the proposals or the partners). */
  onUse: (channel: AssistOutcome['channel'], step: AssistOutcome['step']) => void;
}

/** The reasons a new try may overcome: a platform with no AI, or whose budget of the month is gone, does not. */
const RETRYABLE: readonly ServiceRequestAssistReason[] = ['ai_unavailable', 'ai_invalid_answer'];

/** A description this short is asked for a little more (where, for when) before the AI reads it. */
const SHORT_TEXT = 30;

/**
 * «Preferisci raccontarcelo?» under the choices of the step «Chi» (WIZ-AI-REQUEST): the host describes the job in a few words and the AI
 * proposes the service, the urgency, a sentence for the supplier and who to ask (CasaZen suppliers whenever one covers the property:
 * the rule is the server's, not the AI's). Nothing is decided without the host: the proposal is read, and «Vedi i fornitori» (or «Vedi i
 * partner») puts it in the answers of the wizard, which go on being the host's to change. The card exists only where an AI is in effect;
 * when the AI is not behind an answer it says why, and the wizard is the one it always was.
 */
export function RequestAssistCard({ onUse }: RequestAssistCardProps) {
  const { t } = useTranslation();
  const { control, setValue, getValues, register, formState } = useFormContext<RequestValues>();
  const categories = useServiceCategories();
  const availability = useRequestAssistAvailability();
  const assist = useRequestAssist();
  const propertyId = useWatch({ control, name: 'propertyId' });
  const text = useWatch({ control, name: 'assistText' });
  // Open again with the words when the host comes back to the step.
  const [open, setOpen] = useState(() => getValues('assistText').trim() !== '');
  const [answer, setAnswer] = useState<ServiceRequestAssist | null>(null);

  // No AI on the platform (or the read failed): the step is the one it always was.
  if (availability.data?.available !== true) return null;

  const trimmed = text.trim();
  const ready = trimmed.length >= ASSIST_MIN_TEXT && propertyId !== '';

  const ask = () => {
    if (!ready) return;
    assist.mutate({ propertyId, text: trimmed }, { onSuccess: (result) => setAnswer(result) });
  };

  const close = () => {
    assist.reset();
    setAnswer(null);
    setOpen(false);
  };

  const edit = () => {
    assist.reset();
    setAnswer(null);
  };

  const use = (proposal: ServiceRequestAssist) => {
    const outcome = assistOutcome(proposal, getValues(), categories.data ?? []);
    if (!outcome) return;
    // The suppliers and their services depend on the kind of work: another one starts them again.
    if (getValues('category') !== outcome.values.category) assign(setValue, NO_SUPPLIER);
    assign(setValue, outcome.values);
    onUse(outcome.channel, outcome.step);
  };

  const proposal = answer ? assistOutcome(answer, getValues(), categories.data ?? []) : null;

  return (
    <section className="min-w-0 space-y-3 rounded-lg bg-muted p-4" aria-labelledby="request-assist-title" data-testid="request-assist">
      <div className="flex min-w-0 items-start gap-3">
        <Sparkles aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-foreground/70" />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 id="request-assist-title" className="text-base font-semibold">
            {t('requestWizard.assist.title')}{' '}
            <HelpTip title={t('requestWizard.assist.help.title')} label={t('requestWizard.assist.help.label')}>
              {t('requestWizard.assist.help.body')}
            </HelpTip>
          </h3>
          {!open ? <p className="text-sm text-foreground/70">{t('requestWizard.assist.text')}</p> : null}
        </div>
      </div>

      <div aria-live="polite" aria-busy={assist.isPending} className="min-w-0 space-y-3">
        {!open ? (
          <Button type="button" variant="outline" onClick={() => setOpen(true)} data-testid="request-assist-open">
            {t('requestWizard.assist.open')}
          </Button>
        ) : answer ? (
          proposal ? (
            <Proposal answer={answer} onUse={() => use(answer)} onEdit={edit} onSkip={close} />
          ) : (
            <NoProposal reason={answer.reason ?? 'ai_not_understood'} onRetry={ask} onEdit={edit} onSkip={close} retrying={assist.isPending} />
          )
        ) : (
          <>
            <Field
              label={t('requestWizard.assist.write.label')}
              hint={
                trimmed.length >= ASSIST_MIN_TEXT && trimmed.length < SHORT_TEXT
                  ? t('requestWizard.assist.write.tip')
                  : t('requestWizard.assist.write.hint')
              }
              counter={`${text.length}/${ASSIST_MAX_TEXT}`}
              error={formState.errors.assistText}
            >
              <Textarea
                rows={3}
                maxLength={ASSIST_MAX_TEXT}
                placeholder={t('requestWizard.assist.write.placeholder')}
                data-testid="request-assist-text"
                {...register('assistText')}
              />
            </Field>

            {assist.isError ? (
              <Alert variant="danger" action={<RetryButton onClick={ask} />} data-testid="request-assist-error">
                {getProblemMessage(assist.error, t) ?? t('requestWizard.assist.error')}
              </Alert>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={ask} disabled={!ready} loading={assist.isPending} data-testid="request-assist-submit">
                {assist.isPending ? t('requestWizard.assist.write.loading') : t('requestWizard.assist.write.submit')}
              </Button>
              <Button type="button" variant="ghost" onClick={close} disabled={assist.isPending} data-testid="request-assist-close">
                {t('requestWizard.assist.write.close')}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * «L'AI ha scelto: Idraulico. Cambia» at the top of the step the proposal of the AI leads to: it says what was chosen for the host, while it
 * is still the service chosen, and «Cambia» goes to the step where the host picks another one.
 */
export function AssistChoiceLine({ goTo }: { goTo: (stepId: string) => void }) {
  const { t } = useTranslation();
  const { control } = useFormContext<RequestValues>();
  const [category, aiCategory] = useWatch({ control, name: ['category', 'aiCategory'] });

  if (aiCategory === '' || aiCategory !== category) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-testid="request-ai-choice">
      <Sparkles aria-hidden="true" className="size-4 shrink-0 text-foreground/70" />
      <span>{t('requestWizard.assist.chosen', { service: getServiceCategoryLabel(aiCategory, t) })}</span>
      <Button type="button" variant="link" className="h-auto p-0" onClick={() => goTo('service')} data-testid="request-ai-choice-change">
        {t('requestWizard.assist.change')}
      </Button>
    </p>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick} data-testid="request-assist-retry">
      {t('requestWizard.assist.none.retry')}
    </Button>
  );
}

interface ProposalProps {
  answer: ServiceRequestAssist;
  onUse: () => void;
  onEdit: () => void;
  onSkip: () => void;
}

/** What the AI proposes, said plainly: the service, the urgency, who, why, and the sentence the supplier will read; then the ways on. */
function Proposal({ answer, onUse, onEdit, onSkip }: ProposalProps) {
  const { t } = useTranslation();
  const casazen = answer.channel === 'casazen';

  return (
    <div className="space-y-3" data-testid="request-assist-result" data-channel={answer.channel ?? undefined}>
      <p className="text-base font-semibold">{t('requestWizard.assist.result.title')}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-foreground/70">{t('requestWizard.assist.result.service')}</dt>
        <dd className="font-medium" data-testid="request-assist-category">
          {getServiceCategoryLabel(answer.category ?? '', t)}
        </dd>
        <dt className="text-foreground/70">{t('requestWizard.assist.result.urgency')}</dt>
        <dd className="font-medium" data-testid="request-assist-urgency">
          {t(`requestWizard.what.urgencies.${answer.urgency ?? 'Normal'}.title`)}
        </dd>
        <dt className="text-foreground/70">{t('requestWizard.assist.result.who')}</dt>
        <dd className="font-medium" data-testid="request-assist-who">
          {casazen
            ? t('requestWizard.assist.result.casazen', { count: Math.max(answer.casazenSuppliers, 1) })
            : t('requestWizard.assist.result.external')}
        </dd>
      </dl>

      {answer.explanation ? <p className="text-sm">{answer.explanation}</p> : null}

      {answer.summary ? (
        <div className="space-y-1 rounded-md bg-background p-3 text-sm" data-testid="request-assist-note">
          <p className="text-xs font-medium text-foreground/70">{t('requestWizard.assist.result.note')}</p>
          <p>{answer.summary}</p>
        </div>
      ) : null}

      <AiContentNotice visible />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onUse} data-testid="request-assist-use">
          {casazen ? t('requestWizard.assist.result.useCasazen') : t('requestWizard.assist.result.usePartners')}
        </Button>
        <Button type="button" variant="outline" onClick={onEdit} data-testid="request-assist-edit">
          {t('requestWizard.assist.result.edit')}
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip} data-testid="request-assist-skip">
          {t('requestWizard.assist.result.skip')}
        </Button>
      </div>
    </div>
  );
}

interface NoProposalProps {
  reason: ServiceRequestAssistReason;
  retrying: boolean;
  onRetry: () => void;
  onEdit: () => void;
  onSkip: () => void;
}

/** No proposal: the AI could not tell the job, or could not answer. It says which, and the host goes on by writing again or choosing. */
function NoProposal({ reason, retrying, onRetry, onEdit, onSkip }: NoProposalProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3" data-testid="request-assist-none" data-reason={reason}>
      <Alert variant="info" action={RETRYABLE.includes(reason) ? <RetryButton onClick={onRetry} /> : undefined}>
        {t(`requestWizard.assist.none.${reason}`)}
      </Alert>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={onEdit} disabled={retrying} data-testid="request-assist-edit">
          {t('requestWizard.assist.result.edit')}
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip} data-testid="request-assist-skip">
          {t('requestWizard.assist.result.skip')}
        </Button>
      </div>
    </div>
  );
}
