import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import type { GuestThread } from '@/types/guest-message.types';

interface Labels {
  message: string;
  send: string;
  loading: string;
  failed: string;
  empty: string;
  closed: string;
}

export function GuestPortalChat({ path, labels }: { path: string; labels: Labels }) {
  const [input, setInput] = useState('');
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
      ApiClient.post(endpoint, { text }, { public: true, headers: { 'Idempotency-Key': id } }),
    onSuccess: () => {
      key.current = null;
      setInput('');
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
          <label htmlFor="stay-message">{labels.message}</label>
          <textarea id="stay-message" value={input} maxLength={2000} required disabled={send.isPending}
            onChange={(event) => {
              key.current = null;
              setInput(event.target.value);
              send.reset();
            }} />
          <button type="submit" disabled={!input.trim() || send.isPending}>{labels.send}</button>
        </form>
      )}
    </section>
  );
}
