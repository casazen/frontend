import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, Copy, LogOut, Mail, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { AiContentNotice } from '@/components/shared/ai-content-notice';
import { Button } from '@/components/ui/button';
import type { AutopilotOutcome, AutopilotRunResult } from '@/types/compliance-autopilot.types';
import { AutopilotLine, AutopilotSection } from './autopilot-plan';
import { failureText, groupOutcomes, namesOf, resultSentence } from './autopilot-model';

/** The reasons the AI was asked and did not answer: worth a line, because the messages are plain texts this time. */
const AI_NOT_ANSWERED = ['ai_unavailable', 'ai_budget_exhausted', 'ai_invalid_answer'];

interface ChatDraftRowProps {
  outcome: AutopilotOutcome;
  /** The e-mail is on its way: the message is only for the host who wants to remind the guest another way. */
  optional: boolean;
}

/** A message ready for a guest: one tap opens WhatsApp or the messages app with the text written, and the text can be read and copied. */
function ChatDraftRow({ outcome, optional }: ChatDraftRowProps) {
  const { t } = useTranslation();
  const chat = outcome.chat;
  if (!chat) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(chat.text);
      toast.success(t('compliance.autopilot.result.chat.copied'));
    } catch {
      toast.error(t('compliance.autopilot.result.chat.copyFailed'));
    }
  };
  const label = (action: string) => t('compliance.autopilot.result.chat.forGuest', { action, name: outcome.guestName });

  return (
    <li className="space-y-2 py-3" data-testid="autopilot-chat-draft" data-optional={optional ? 'true' : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="break-words font-semibold">{outcome.guestName}</p>
          <p className="break-words text-sm text-foreground/70">{outcome.propertyName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {chat.whatsAppUrl ? (
            <Button asChild size="sm">
              <a href={chat.whatsAppUrl} target="_blank" rel="noopener noreferrer" aria-label={label(t('compliance.autopilot.result.chat.whatsapp'))} data-testid="autopilot-chat-whatsapp">
                {t('compliance.autopilot.result.chat.whatsapp')}
              </a>
            </Button>
          ) : null}
          {chat.smsUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={chat.smsUrl} aria-label={label(t('compliance.autopilot.result.chat.sms'))} data-testid="autopilot-chat-sms">
                {t('compliance.autopilot.result.chat.sms')}
              </a>
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" onClick={() => void copy()} aria-label={label(t('compliance.autopilot.result.chat.copy'))} data-testid="autopilot-chat-copy">
            <Copy aria-hidden="true" className="size-4" />
            {t('compliance.autopilot.result.chat.copy')}
          </Button>
        </div>
      </div>
      {!chat.whatsAppUrl ? <p className="text-sm text-foreground/70">{t('compliance.autopilot.result.chat.noPhone')}</p> : null}
      <details className="text-sm">
        <summary className="min-h-8 cursor-pointer py-1 font-medium text-primary-text">{t('compliance.autopilot.result.chat.show')}</summary>
        <p className="mt-1 whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-foreground/90" data-testid="autopilot-chat-text">
          {chat.text}
        </p>
      </details>
    </li>
  );
}

interface AutopilotResultViewProps {
  result: AutopilotRunResult;
  /** When the run ended, already written (HH:mm). */
  at: string;
}

/**
 * What the assistant did, in one sentence and then by part: the messages the host sends (with the buttons that open WhatsApp and the messages
 * app), what was done, what did not work and why. It says only what happened: a message not yet sent by the host is a message "ready", never
 * "sent".
 */
export function AutopilotResultView({ result, at }: AutopilotResultViewProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const groups = groupOutcomes(result.outcomes);
  const exists = (key: string) => i18n.exists(key);
  const hasChat = groups.chatNeeded.length > 0 || groups.chatOptional.length > 0;

  return (
    <div className="space-y-5" data-testid="autopilot-result" aria-live="polite">
      <div className="flex items-start gap-3">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success-foreground" />
        <div className="min-w-0">
          <p className="font-semibold">
            {t('compliance.autopilot.result.title')} <span className="font-normal text-foreground/70">· {t('compliance.autopilot.result.at', { time: at })}</span>
          </p>
          <p className="break-words text-sm text-foreground/80" data-testid="autopilot-result-sentence">
            {resultSentence(groups, t, locale)}
          </p>
        </div>
      </div>

      {hasChat ? (
        <section className="space-y-1" data-testid="autopilot-result-chat" aria-label={t('compliance.autopilot.result.chat.title')}>
          <h3 className="text-sm font-semibold text-foreground/70">{t('compliance.autopilot.result.chat.title')}</h3>
          {groups.chatNeeded.length > 0 ? <p className="text-sm text-foreground/80">{t('compliance.autopilot.result.chat.needed')}</p> : null}
          <ul role="list" className="divide-y divide-border">
            {groups.chatNeeded.map((outcome) => (
              <ChatDraftRow key={outcome.key} outcome={outcome} optional={false} />
            ))}
          </ul>
          {groups.chatOptional.length > 0 ? <p className="pt-2 text-sm text-foreground/80">{t('compliance.autopilot.result.chat.optional')}</p> : null}
          <ul role="list" className="divide-y divide-border">
            {groups.chatOptional.map((outcome) => (
              <ChatDraftRow key={outcome.key} outcome={outcome} optional />
            ))}
          </ul>
          <AiContentNotice visible={groups.aiWritten} />
          {!result.aiUsed && result.aiReason && AI_NOT_ANSWERED.includes(result.aiReason) ? (
            <p className="text-xs text-foreground/70" data-testid="autopilot-ai-fallback">
              {t('compliance.autopilot.result.aiFallback')}
            </p>
          ) : null}
        </section>
      ) : null}

      {groups.emailed.length > 0 || groups.closed.length > 0 ? (
        <AutopilotSection title={t('compliance.autopilot.plan.do')} testId="autopilot-result-done">
          {groups.emailed.length > 0 ? (
            <AutopilotLine icon={Mail} title={t('compliance.autopilot.result.emailed', { names: namesOf(groups.emailed, t, locale) })} testId="autopilot-result-emailed" />
          ) : null}
          {groups.closed.length > 0 ? (
            <AutopilotLine icon={LogOut} title={t('compliance.autopilot.result.closed', { names: namesOf(groups.closed, t, locale) })} testId="autopilot-result-closed" />
          ) : null}
        </AutopilotSection>
      ) : null}

      {groups.failed.length > 0 ? (
        <section className="space-y-1" data-testid="autopilot-result-failed" aria-label={t('compliance.autopilot.result.failed.title')}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-danger-foreground">
            <TriangleAlert aria-hidden="true" className="size-4" />
            {t('compliance.autopilot.result.failed.title')}
          </h3>
          <ul role="list" className="space-y-1 text-sm">
            {groups.failed.map((outcome) => (
              <li key={outcome.key} className="break-words" data-testid="autopilot-result-failed-line">
                {t('compliance.autopilot.result.failed.line', { name: outcome.guestName, reason: failureText(outcome, t, exists) })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {groups.skipped.length > 0 ? (
        <AutopilotSection title={t('compliance.autopilot.result.skipped.title')} testId="autopilot-result-skipped">
          <AutopilotLine icon={Clock} title={t('compliance.autopilot.result.skipped.body', { names: namesOf(groups.skipped, t, locale) })} />
        </AutopilotSection>
      ) : null}

      {result.beyondLimit > 0 ? (
        <p className="text-sm text-foreground/80" data-testid="autopilot-result-beyond">
          {t('compliance.autopilot.result.beyond', { count: result.beyondLimit })}
        </p>
      ) : null}
    </div>
  );
}
