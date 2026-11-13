import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Paperclip, X } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { ownerPortalApi } from '@/api/ownerPortal.api';
import { getProblemMessage } from '@/lib/api-errors';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { usePostOwnerMessage } from '@/queries/ownerPortal';
import type { OwnerMessage } from '@/types';
import { attachmentProblem, formatBytes, safeDownloadName } from './owner-portal-model';
import { useOwnerDownload } from './use-owner-download';
import { TOUCH } from './portal-parts';

const WHEN: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };

interface MessageListProps {
  conversationId: string;
  messages: readonly OwnerMessage[];
}

/**
 * The messages of a conversation, oldest first: who wrote (the agency, or the person of the portal by name), when, the words exactly as written and the file, which is
 * downloaded under a name made safe. The words are shown as text (never as markup) and kept in the page only.
 */
export function MessageList({ conversationId, messages }: MessageListProps) {
  const { t, i18n } = useTranslation();
  const { download, busyKey, failure } = useOwnerDownload();

  return (
    <div className="space-y-3">
      <ol className="space-y-3" aria-label={t('ownerPortal.inbox.thread.messagesLabel')} data-testid="owner-messages">
        {messages.map((message) => {
          const fromAgency = message.sender === 'Agency';
          const attachment = message.attachment;
          return (
            <li
              key={message.id}
              data-sender={message.sender}
              className={`min-w-0 rounded-md border p-3 ${fromAgency ? 'bg-card' : 'bg-primary/5'}`}
            >
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="min-w-0 break-words font-semibold">{fromAgency ? t('ownerPortal.inbox.thread.agency') : message.authorName}</span>
                <span className="text-muted-foreground">{formatRomeDateTime(message.createdAt, i18n.language, WHEN)}</span>
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.body}</p>
              {attachment ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 max-w-full"
                    disabled={busyKey !== null}
                    loading={busyKey === message.id}
                    onClick={() =>
                      void download(
                        message.id,
                        () => ownerPortalApi.downloadAttachment(conversationId, message.id),
                        safeDownloadName(attachment.fileName, attachment.contentType, t('ownerPortal.inbox.thread.attachmentFallbackName')),
                      )
                    }
                    aria-label={t('ownerPortal.inbox.thread.downloadAria', { name: attachment.fileName })}
                    data-testid="owner-attachment-download"
                  >
                    <Download aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate">{attachment.fileName}</span>
                  </Button>
                  <span className="text-sm text-muted-foreground">{formatBytes(attachment.sizeBytes, i18n.language)}</span>
                </div>
              ) : null}
              {failure?.key === message.id ? (
                <Alert variant="danger" className="mt-3" data-testid="owner-attachment-failed">
                  {failure.message}
                </Alert>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * The reply: the words and, when the person wants, one file (PDF, JPEG or PNG, at most 10 MB). The browser only spares an upload the server would refuse; the server scans
 * the file and has the last word, and its refusal is shown in words with the text kept. While the message is on its way the form cannot be sent again. The words are state of
 * this form: nothing is stored.
 */
export function ReplyForm({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation();
  const post = usePostOwnerMessage(conversationId);
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);

  const refusal = post.error ? (getProblemMessage(post.error, t) ?? t('ownerPortal.inbox.thread.sendFailed')) : null;

  const pick = (picked: File | undefined) => {
    setProblem(null);
    post.reset();
    if (!picked) {
      setFile(null);
      return;
    }
    const issue = attachmentProblem(picked);
    if (issue) {
      setFile(null);
      setFileKey((key) => key + 1);
      setProblem(t(`ownerPortal.inbox.thread.attachment.${issue}`));
      return;
    }
    setFile(picked);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (post.isPending) return;
    if (!body.trim()) {
      setProblem(t('ownerPortal.inbox.thread.bodyRequired'));
      return;
    }
    setProblem(null);
    post.mutate(
      { body: body.trim(), file: file ?? undefined },
      {
        onSuccess: () => {
          setBody('');
          setFile(null);
          setFileKey((key) => key + 1);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-md border bg-card p-4" data-testid="owner-reply" aria-labelledby="owner-reply-title">
      <h2 id="owner-reply-title" className="text-base font-semibold">
        {t('ownerPortal.inbox.thread.replyTitle')}
      </h2>
      <Field label={t('ownerPortal.inbox.thread.body')}>
        <Textarea className="min-h-28" value={body} onChange={(event) => setBody(event.target.value)} data-testid="owner-reply-body" />
      </Field>

      <div className="space-y-2">
        <label
          htmlFor={`owner-reply-file-${fileKey}`}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
        >
          <Paperclip aria-hidden="true" className="h-4 w-4" />
          {t('ownerPortal.inbox.thread.attach')}
          <input
            key={fileKey}
            id={`owner-reply-file-${fileKey}`}
            type="file"
            className="sr-only"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(event) => pick(event.target.files?.[0])}
            data-testid="owner-reply-file"
          />
        </label>
        <p className="text-sm text-muted-foreground">{t('ownerPortal.inbox.thread.attachHint')}</p>
        {file ? (
          <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm" data-testid="owner-reply-file-name">
            <span className="min-w-0 break-words">{file.name}</span>
            <Button
              type="button"
              variant="ghost"
              className={TOUCH}
              onClick={() => {
                setFile(null);
                setFileKey((key) => key + 1);
              }}
              aria-label={t('ownerPortal.inbox.thread.removeFile', { name: file.name })}
            >
              <X aria-hidden="true" className="h-4 w-4" />
              {t('ownerPortal.inbox.thread.remove')}
            </Button>
          </p>
        ) : null}
      </div>

      {problem ? (
        <Alert variant="danger" data-testid="owner-reply-problem">
          {problem}
        </Alert>
      ) : null}
      {refusal ? (
        <Alert variant="danger" data-testid="owner-reply-refused">
          {refusal}
        </Alert>
      ) : null}
      <Button type="submit" className={`${TOUCH} w-full sm:w-auto`} loading={post.isPending} data-testid="owner-reply-send">
        {post.isPending ? t('ownerPortal.inbox.thread.sending') : t('ownerPortal.inbox.thread.send')}
      </Button>
    </form>
  );
}
