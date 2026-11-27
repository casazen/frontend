import { useId, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePortalRootProps } from '@/features/public-site/site-appearance-context';
import { getHttpStatus } from '@/lib/api-errors';
import { cn } from '@/lib/utils';

interface ChatLine {
  id: string;
  fromHost: boolean;
  text: string;
  sentAt: string;
}

function readAccess(key: string) {
  try {
    const value = localStorage.getItem(key);
    return value && /^[0-9a-f]{64}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

function newAccess() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function Conversation({ site, propertyId }: { site: string; propertyId: string }) {
  const { t, i18n } = useTranslation();
  const storageKey = `casazen:storefront-chat:${propertyId}`;
  const [access, setAccess] = useState(() => readAccess(storageKey));
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const pending = useRef<{ body: string; id: string } | null>(null);
  const accessRef = useRef(access);
  const consentId = useId();
  const url = `/public/orgs/${encodeURIComponent(site)}/properties/${encodeURIComponent(propertyId)}/chat`;
  const query = useQuery({
    queryKey: ['storefront-chat', site, propertyId, consentId],
    gcTime: 0,
    queryFn: ({ signal }) => ApiClient.get<ChatLine[]>(url, undefined, {
      public: true, signal, headers: { 'X-Storefront-Chat': accessRef.current ?? '' },
    }),
    enabled: !!access,
    retry: false,
    refetchInterval: (state) => getHttpStatus(state.state.error) === 404 ? false : 12_000,
  });
  // Without a saved key (or after an interrupted first send), collect the identity needed to open the conversation.
  const startsChat = !access || (!query.data && getHttpStatus(query.error) === 404);
  const loadFailed = !startsChat && !query.data && query.isError;
  const loading = !startsChat && !query.data && !loadFailed;

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || !text.trim()) return;

    const form = new FormData(event.currentTarget);
    const payload = {
      text: text.trim(),
      ...(startsChat ? { name: form.get('name'), email: form.get('email'), consent: form.has('consent') } : {}),
    };
    const body = JSON.stringify(payload);
    setSending(true);
    setSendFailed(false);
    try {
      const token = accessRef.current ?? newAccess();
      accessRef.current = token;
      try {
        localStorage.setItem(storageKey, token);
      } catch {
        // The current dialog can still continue when the browser blocks storage.
      }
      if (pending.current?.body !== body)
        pending.current = { body, id: newAccess() };
      await ApiClient.post<void>(url, payload, {
        public: true,
        headers: { 'X-Storefront-Chat': token, 'Idempotency-Key': pending.current.id },
      });
      pending.current = null;
      setText('');
      setAccess(token);
      await query.refetch();
    } catch {
      setSendFailed(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      {loading ? <p role="status">{t('storefrontChat.loading')}</p> : null}
      {loadFailed ? (
        <div className="grid gap-2" role="alert">
          <span>{t('storefrontChat.loadFailed')}</span>
          <Button type="button" variant="outline" onClick={() => void query.refetch()}>{t('storefrontChat.retry')}</Button>
        </div>
      ) : null}
      {query.data ? (
        <ol
          aria-label={t('storefrontChat.transcript')}
          aria-live="polite"
          className="grid max-h-[35dvh] gap-2 overflow-y-auto rounded-lg border p-3"
        >
          {query.data.map((line) => (
            <li key={line.id} className={cn('min-w-0 max-w-[90%] rounded-lg border p-2', !line.fromHost && 'justify-self-end bg-muted')}>
              <div className="text-xs text-muted-foreground">
                {t(line.fromHost ? 'storefrontChat.host' : 'storefrontChat.you')}
                {' · '}
                <time dateTime={line.sentAt}>{new Date(line.sentAt).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })}</time>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">{line.text}</p>
            </li>
          ))}
        </ol>
      ) : null}
      {startsChat || query.data ? (
        <form onSubmit={(event) => void send(event)} className="grid gap-3">
          {startsChat ? (
            <>
              <Field label={t('hostContact.nameLabel')}>
                <Input name="name" required maxLength={100} autoComplete="name" disabled={sending} />
              </Field>
              <Field label={t('hostContact.emailLabel')}>
                <Input name="email" type="email" required maxLength={254} autoComplete="email" disabled={sending} />
              </Field>
            </>
          ) : null}
          <Field label={t('hostContact.messageLabel')}>
            <Textarea name="text" required rows={3} maxLength={2000} value={text} onChange={(event) => setText(event.target.value)} disabled={sending} />
          </Field>
          {startsChat ? (
            <label htmlFor={consentId} className="flex items-start gap-2 text-sm">
              <input id={consentId} name="consent" type="checkbox" required disabled={sending} className="mt-1" />
              {t('storefrontChat.consent')}
            </label>
          ) : null}
          {sendFailed ? <p role="alert" className="text-sm text-destructive">{t('storefrontChat.sendFailed')}</p> : null}
          <Button type="submit" className="public-site-cta border-0" disabled={sending || !text.trim()}>
            {t(sending ? 'hostContact.sending' : 'hostContact.send')}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function StorefrontChatDialog({ site, propertyId, trigger }: { site: string; propertyId: string; trigger: ReactElement }) {
  const { t } = useTranslation();
  const portal = usePortalRootProps();

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent {...portal} className={cn(portal.className, 'max-h-[90dvh] overflow-y-auto sm:max-w-lg')}>
        <DialogHeader>
          <DialogTitle>{t('storefrontChat.title')}</DialogTitle>
          <DialogDescription>{t('storefrontChat.description')}</DialogDescription>
        </DialogHeader>
        <Conversation key={propertyId} site={site} propertyId={propertyId} />
      </DialogContent>
    </Dialog>
  );
}
