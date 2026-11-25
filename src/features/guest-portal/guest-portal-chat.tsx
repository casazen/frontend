import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import type { GuestThread } from '@/types/guest-message.types';

const hostLabels = {
  it: 'Scrivi all’host',
  en: 'Write to the host',
  de: 'Gastgeber kontaktieren',
  fr: 'Écrire à l’hôte',
  es: 'Escribir al anfitrión',
} as const;

interface Labels {
  message: string;
  send: string;
  loading: string;
  failed: string;
  empty: string;
  closed: string;
}

export function GuestPortalChat({ path, language, labels }: { path: string; language: keyof typeof hostLabels; labels: Labels }) {
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
      {thread.isPending && <p role="status">{labels.loading}</p>}
      {(thread.isError || send.isError) && <p role="alert">{labels.failed}</p>}
      {thread.data?.messages.length === 0 && <p>{labels.empty}</p>}
      <ul className="stay-chat">
        {thread.data?.messages.map((message) => (
          <li key={message.id} data-sender={message.sender}>{message.text}</li>
        ))}
      </ul>
      {thread.data?.state === 'Closed' && <p>{labels.closed}</p>}
      {thread.data?.state === 'Open' && (
        <form onSubmit={submit} className="stay-chat-form">
          <label htmlFor="stay-message">{requestHost ? hostLabels[language] : labels.message}</label>
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
            }}>{hostLabels[language]}</button>
          )}
          <button type="submit" disabled={!input.trim() || send.isPending}>{labels.send}</button>
        </form>
      )}
    </section>
  );
}
