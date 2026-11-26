import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import type { GuestThread } from '@/types/guest-message.types';

const channelLabels = {
  it: { open: 'Apri {channel} per rispondere sul canale', local: 'Chat privata con l’host in CasaZen' },
  en: { open: 'Open {channel} to reply on the booking channel', local: 'Private chat with your host in CasaZen' },
  de: { open: '{channel} öffnen und über das Buchungsportal antworten', local: 'Privater Chat mit dem Gastgeber in CasaZen' },
  fr: { open: 'Ouvrir {channel} pour répondre sur la plateforme', local: 'Conversation privée avec votre hôte sur CasaZen' },
  es: { open: 'Abrir {channel} para responder en el canal de reserva', local: 'Chat privado con el anfitrión en CasaZen' },
} as const;

const chatLabels = {
  it: { handoff: 'Scrivi all’host', guest: 'Tu', host: 'Host', assistant: 'Assistente automatico', automation: 'Messaggio automatico' },
  en: { handoff: 'Write to the host', guest: 'You', host: 'Host', assistant: 'Automatic assistant', automation: 'Automatic message' },
  de: { handoff: 'Gastgeber kontaktieren', guest: 'Du', host: 'Gastgeber', assistant: 'Automatischer Assistent', automation: 'Automatische Nachricht' },
  fr: { handoff: 'Écrire à l’hôte', guest: 'Vous', host: 'Hôte', assistant: 'Assistant automatique', automation: 'Message automatique' },
  es: { handoff: 'Escribir al anfitrión', guest: 'Tú', host: 'Anfitrión', assistant: 'Asistente automático', automation: 'Mensaje automático' },
} as const;

interface Labels {
  message: string;
  send: string;
  loading: string;
  failed: string;
  empty: string;
  closed: string;
}

interface GuestPortalChatProps {
  path: string;
  language: keyof typeof chatLabels;
  labels: Labels;
  isOta: boolean;
  channel?: { name: string; url: string };
}

export function GuestPortalChat({ path, language, labels, isOta, channel }: GuestPortalChatProps) {
  const copy = chatLabels[language];
  const time = new Intl.DateTimeFormat(language, { hour: 'numeric', minute: 'numeric' });
  const [input, setInput] = useState('');
  const [requestHost, setRequestHost] = useState(false);
  const messageField = useRef<HTMLTextAreaElement>(null);
  const key = useRef<string | null>(null);
  const endpoint = `${path}/chat`;
  const thread = useQuery({
    queryKey: ['guest-portal-chat', endpoint],
    queryFn: ({ signal }) => ApiClient.get<GuestThread>(endpoint, undefined, { public: true, signal }),
    refetchInterval: 5_000,
    gcTime: 0,
    retry: false,
  });
  const send = useMutation({
    mutationFn: ({ text, id }: { text: string; id: string }) =>
      ApiClient.post(endpoint, { text, requestHost, language }, { public: true, headers: { 'Idempotency-Key': id } }),
    onSuccess: () => {
      key.current = null;
      setInput('');
      setRequestHost(false);
      void thread.refetch();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || send.isPending) return;
    key.current ??= crypto.randomUUID();
    send.mutate({ text: input.trim(), id: key.current });
  }

  return (
    <section className="stay-card stay-content">
      {isOta && channel && (
        <p><a href={channel.url} rel="noreferrer">{channelLabels[language].open.replace('{channel}', channel.name)}</a></p>
      )}
      {isOta && <h2>{channelLabels[language].local}</h2>}
      {thread.isPending && <p role="status">{labels.loading}</p>}
      {(thread.isError || send.isError) && <p role="alert">{labels.failed}</p>}
      {thread.data?.messages.length === 0 && <p>{labels.empty}</p>}
      <ul className="stay-chat" role="log">
        {thread.data?.messages.map((message) => (
          <li key={message.id} data-sender={message.sender}>
            <div className="stay-chat-meta">
              <strong>{message.sender === 'Guest' ? copy.guest
                : message.origin === 'Assistant' ? copy.assistant
                : message.origin === 'Automation' ? copy.automation : copy.host}</strong>
              <time dateTime={message.createdAt}>{time.format(new Date(message.createdAt))}</time>
            </div>
            {message.text}
          </li>
        ))}
      </ul>
      {thread.data?.state === 'Closed' && <p>{labels.closed}</p>}
      {thread.data?.state === 'Open' && (
        <form onSubmit={submit} className="stay-chat-form">
          <label htmlFor="stay-message">{requestHost ? copy.handoff : labels.message}</label>
          <textarea ref={messageField} id="stay-message" value={input} maxLength={2000} required disabled={send.isPending}
            onChange={(event) => {
              key.current = null;
              setInput(event.target.value);
              send.reset();
            }} />
          {!requestHost && (
            <button type="button" disabled={send.isPending} onClick={() => {
              key.current = null;
              setRequestHost(true);
              send.reset();
              messageField.current?.focus();
            }}>{copy.handoff}</button>
          )}
          <button type="submit" disabled={!input.trim() || send.isPending}>{labels.send}</button>
        </form>
      )}
    </section>
  );
}
