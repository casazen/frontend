import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { messageHubApi } from '@/api/message-hub.api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { messagesOfBookingPath } from '@/lib/message-hub-routes';
import { getProblemMessage } from '@/lib/api-errors';

export function BookingDraft({
  bookingId,
  scope,
  onNavigate,
}: {
  bookingId: string;
  scope: string;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [selected, setSelected] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const draftField = useRef<HTMLTextAreaElement>(null);
  const [copyFeedback, setCopyFeedback] = useState('');
  const rendering = useRef<AbortController | null>(null);
  useEffect(() => () => rendering.current?.abort(), []);
  const read = useQuery({
    queryKey: ['ask', 'booking.prepareMessage', scope, bookingId],
    queryFn: async ({ signal }) => {
      const contact = await messageHubApi.getContactOptions(bookingId, signal);
      const threadKey = contact.channel === 'Direct' || contact.channel === 'Ota' ? contact.threadKey : null;
      if (!threadKey) return { threadKey: null, templates: [] };
      const templates = await messageHubApi.listTemplates(signal);
      return { threadKey, templates: templates.map(({ id, name, language }) => ({ id, name, language })) };
    },
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const prepare = async () => {
    if (!read.data?.threadKey || !selected || busy) return;
    const controller = new AbortController();
    rendering.current = controller;
    setBusy(true);
    setError('');
    try {
      const rendered = await messageHubApi.renderTemplate(selected, read.data.threadKey, controller.signal);
      if (controller.signal.aborted) return;
      if (!rendered.text?.trim()) throw new Error();
      setText(rendered.text);
    } catch (failure) {
      if (!controller.signal.aborted) setError(getProblemMessage(failure, t) ?? t('ask.draftProblem'));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const copyDraft = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(t('ask.copied'));
    } catch {
      draftField.current?.focus();
      draftField.current?.select();
      setCopyFeedback(t('ask.selectCopy'));
    }
  };

  return (
    <section className="space-y-3 text-sm" aria-label={t('ask.draftShortcut')}>
      <h3 className="font-semibold">{t('ask.draftShortcut')}</h3>
      {read.isPending ? (
        <p role="status">{t('ask.draftLoading')}</p>
      ) : read.isError ? (
        <>
          <p role="alert">{t('ask.draftProblem')}</p>
          <Button size="sm" variant="outline" onClick={() => void read.refetch()}>
            {t('ask.retry')}
          </Button>
        </>
      ) : !read.data.threadKey ? (
        <p>{t('ask.noThread')}</p>
      ) : !read.data.templates.length ? (
        <p>{t('ask.noTemplates')}</p>
      ) : (
        <>
          <label htmlFor={id} className="block">
            {t('ask.chooseTemplate')}
          </label>
          <select
            id={id}
            disabled={busy}
            value={selected}
            className="min-h-11 w-full rounded-md border bg-background px-3"
            onChange={(event) => {
              setSelected(event.target.value);
              setText(null);
              setError('');
              setCopyFeedback('');
            }}
          >
            <option value="">{t('ask.choose')}</option>
            {read.data.templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} · {template.language}
              </option>
            ))}
          </select>
          {text === null && (
            <Button variant="outline" loading={busy} disabled={!selected || busy} onClick={() => void prepare()}>
              {t('ask.render')}
            </Button>
          )}
          {error && <p role="alert">{error}</p>}
          {text !== null && (
            <>
              <label htmlFor={id + '-draft'} className="block font-medium">
                {t('ask.draftLabel')}
              </label>
              <Textarea
                ref={draftField}
                id={id + '-draft'}
                rows={5}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setCopyFeedback('');
                }}
              />
              <Button variant="outline" disabled={!text.trim()} onClick={() => void copyDraft()}>
                {t('ask.copy')}
              </Button>
              {copyFeedback && <p role="status">{copyFeedback}</p>}
              <p>{t('ask.draftHint')}</p>
            </>
          )}
        </>
      )}
      <Button asChild variant="link" className="h-auto min-h-11 whitespace-normal px-0 text-primary-text">
        <Link to={messagesOfBookingPath(bookingId)} onClick={onNavigate}>
          {t('ask.bookingMessages')}
        </Link>
      </Button>
    </section>
  );
}
