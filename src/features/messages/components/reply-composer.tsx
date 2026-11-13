import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useMediaQuery } from '@/hooks/use-media-query';
import { GUEST_MESSAGE_MAX_LENGTH, LISTING_LANGUAGES } from '@/types';
import { TemplatePicker } from './template-picker';
import { TranslateButton } from './translate-button';

/** From this many characters the composer shows how many are left. */
const COUNTER_FROM = 1800;

/** The language a draft is translated into when the host has not chosen another: the guests of the channels mostly read English. */
const DEFAULT_GUEST_LANGUAGE = 'en';

interface ReplyComposerProps {
  threadKey: string;
  /** The conversation is one of a channel: the channel's own templates are offered too. */
  withChannelTemplates: boolean;
  value: string;
  onChange: (value: string) => void;
  /** Hands the text, trimmed, to the send; the caller empties the box. */
  onSend: (text: string) => void;
  /** A message is on its way: the button waits for it, so a second click cannot send it twice. */
  busy: boolean;
  /** Why nothing can be sent now (offline): the button is off and what was typed stays. */
  disabledReason?: string | null;
  /** False on a request before the booking: no link, address or number may be written. */
  contactDetailsAllowed: boolean;
}

/**
 * The box where the host answers a conversation (NF-63), the same for a conversation of a channel and a direct one: up to 2,000
 * characters, Enter sends and Shift+Enter starts a new line (on a touch screen Enter starts a new line and the button sends). The text is
 * emptied when it is handed to the send, which shows it as «sending» with its own retry and one `Idempotency-Key`; while a message is on its
 * way the button is off, so a second click never sends it twice. The templates and the translation of the draft sit beside the button; a
 * template is a draft the host edits, never a message that goes by itself. On a request before the booking, it says that contact details
 * and links cannot be sent (the refusal of the channel, if one comes, is shown on the message as that same sentence).
 */
export function ReplyComposer({ threadKey, withChannelTemplates, value, onChange, onSend, busy, disabledReason, contactDetailsAllowed }: ReplyComposerProps) {
  const { t } = useTranslation();
  const fieldId = useId();
  const hintId = useId();
  const touch = useMediaQuery('(pointer: coarse)');
  const [guestLanguage, setGuestLanguage] = useState(DEFAULT_GUEST_LANGUAGE);
  const [notice, setNotice] = useState<string | null>(null);
  const trimmed = value.trim();
  const blocked = Boolean(disabledReason);
  const canSend = trimmed.length > 0 && !blocked && !busy;

  const change = (next: string) => {
    setNotice(null);
    onChange(next);
  };

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
  };

  const insert = (text: string) => {
    const next = trimmed ? `${value.trimEnd()}\n\n${text}` : text;
    if (next.length > GUEST_MESSAGE_MAX_LENGTH) {
      setNotice(t('messages.template.tooLong', { max: GUEST_MESSAGE_MAX_LENGTH }));
      return;
    }
    change(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || touch || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-2"
      data-testid="reply-composer"
    >
      <label htmlFor={fieldId} className="sr-only">
        {t('messages.composer.label')}
      </label>
      <Textarea
        id={fieldId}
        value={value}
        onChange={(event) => change(event.target.value)}
        onKeyDown={onKeyDown}
        maxLength={GUEST_MESSAGE_MAX_LENGTH}
        rows={4}
        placeholder={t('messages.composer.placeholder')}
        aria-describedby={hintId}
        className="resize-y"
      />
      <div id={hintId} className="space-y-1 text-xs text-muted-foreground">
        {blocked ? (
          <p role="status">{disabledReason}</p>
        ) : value.length >= COUNTER_FROM ? (
          <p>{t('messageThread.counter', { count: value.length, max: GUEST_MESSAGE_MAX_LENGTH })}</p>
        ) : touch ? null : (
          <p>{t('messageThread.enterHint')}</p>
        )}
        {!contactDetailsAllowed ? <p data-testid="reply-no-contacts">{t('messages.request.noContacts')}</p> : null}
        {notice ? <p role="status">{notice}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TemplatePicker threadKey={threadKey} withChannelTemplates={withChannelTemplates} onInsert={insert} />
        <Select
          size="sm"
          wrapperClassName="w-40"
          aria-label={t('messages.composer.language')}
          value={guestLanguage}
          onChange={(event) => setGuestLanguage(event.target.value)}
          data-testid="translate-language"
        >
          {LISTING_LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {t(`propertyWizard.descriptions.languages.${language}`)}
            </option>
          ))}
        </Select>
        {trimmed ? (
          <TranslateButton threadKey={threadKey} source={{ text: trimmed }} targetLanguage={guestLanguage} label={t('messages.composer.translate')} onUse={change} />
        ) : null}
        <Button type="submit" className="ml-auto" disabled={!canSend} data-testid="reply-send">
          {t('messages.composer.send')}
        </Button>
      </div>
    </form>
  );
}
