import { useState } from 'react';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { useTranslateMessage } from '@/queries/use-message-thread';
import type { MessageTranslationRequest } from '@/types';

/** What is translated: a message of the conversation (by its id, the server holds the text) or the text the host is writing. */
export type TranslateSource = { messageId: string } | { text: string };

interface TranslateButtonProps {
  threadKey: string;
  source: TranslateSource;
  /** One of the languages of the listing (`it`, `en`, …). */
  targetLanguage: string;
  /** What the button says: «Traduci». */
  label: string;
  /** For a draft: puts the translation in the place of the text. Without it the translation is only read. */
  onUse?: (text: string) => void;
  size?: 'sm' | 'default';
}

/**
 * Translates a message of the guest into the language of the host, or the draft of the host into the language of the guest (NF-63). It is
 * a machine translation and says so; it is for the screen only: the message keeps its original text and nothing is sent by it. The
 * translation of a draft is not put in the draft until the host chooses it («Usa la traduzione»), so a machine text is never sent unread.
 *
 * It renders the button and, once there is one, the translation under it, as a fragment: the place around it is the parent's. A message
 * translated once is kept for the page, and the button then shows or hides it; a draft is translated again each time, since it changes.
 * The interface says «traduzione automatica» and never who made it (NF-12).
 */
export function TranslateButton({ threadKey, source, targetLanguage, label, onUse, size = 'sm' }: TranslateButtonProps) {
  const { t } = useTranslation();
  const translate = useTranslateMessage();
  const [shown, setShown] = useState(false);
  const translated = translate.data;
  const kept = 'messageId' in source && translate.isSuccess;

  const run = () => {
    if (kept) {
      setShown((value) => !value);
      return;
    }
    const request: MessageTranslationRequest = { threadKey, targetLanguage, ...source };
    translate.mutate(request, { onSuccess: () => setShown(true) });
  };

  const problem = translate.isError
    ? getHttpStatus(translate.error) === 422
      ? t('messages.translate.unavailable')
      : (getProblemMessage(translate.error, t) ?? t('messages.translate.error'))
    : null;

  return (
    <>
      <Button type="button" variant="ghost" size={size} onClick={run} loading={translate.isPending} data-testid="translate-button">
        <Languages className="size-4" aria-hidden="true" />
        {kept && shown ? t('messages.translate.hide') : label}
      </Button>
      {shown && translated ? (
        <div className="basis-full space-y-1 rounded-lg border border-dashed bg-background px-3 py-2 text-sm" role="status" data-testid="message-translation">
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{translated.text}</p>
          <p className="text-xs text-muted-foreground">{t('messages.composer.machineTranslated')}</p>
          {onUse ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onUse(translated.text);
                setShown(false);
              }}
            >
              {t('messages.translate.use')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {problem ? (
        <p className="basis-full text-xs text-destructive" role="alert">
          {problem}
        </p>
      ) : null}
    </>
  );
}
