import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import { PortalGuestMarketingSection } from '@/features/public-booking/guest-marketing-section';

type Kind = 'copy' | 'erasure';

interface PrivacyRequest {
  activityType: 'GuestDataCopyRequested' | 'GuestDataErasureRequested';
  createdAt: string;
  deadline: string | null;
  completedAt: string | null;
}

export function GuestPortalPrivacy({ path, language, labels }: {
  path: string;
  language: string;
  labels: Record<Kind | 'confirm' | 'back' | 'requested' | 'closed' | 'failed' | 'loading', string>;
}) {
  const [confirmation, setConfirmation] = useState<Kind>();
  const endpoint = `${path}/privacy/requests`;
  const requests = useQuery({
    queryKey: ['guest-portal-privacy-requests', endpoint],
    queryFn: ({ signal }) => ApiClient.get<PrivacyRequest[]>(endpoint, undefined, { public: true, signal }),
    gcTime: 0,
    retry: false,
  });
  const submit = useMutation({
    mutationFn: (kind: Kind) => ApiClient.post<void>(endpoint, { kind }, { public: true }),
    onSuccess: async () => {
      await requests.refetch();
      setConfirmation(undefined);
    },
  });
  const date = new Intl.DateTimeFormat(language, { dateStyle: 'medium' });
  const kindOf = (request: PrivacyRequest): Kind => request.activityType === 'GuestDataCopyRequested' ? 'copy' : 'erasure';
  return (
    <>
      <section className="stay-card stay-content">
        {requests.isPending && <p role="status">{labels.loading}</p>}
        {(requests.isError || submit.isError) && <p role="alert">{labels.failed}</p>}
        {submit.isSuccess && <p role="status">{labels.requested}</p>}
        {requests.data?.map((request) => (
          <div key={request.activityType + request.createdAt} className="stay-document">
            <span>{labels[kindOf(request)]}</span>
            <span>{request.completedAt ? labels.closed : request.deadline ? date.format(new Date(request.deadline)) : labels.requested}</span>
          </div>
        ))}
        {requests.isSuccess && !confirmation && (['copy', 'erasure'] as const).map((kind) => (
          <button type="button" key={kind} disabled={requests.data.some((request) => !request.completedAt && kindOf(request) === kind)}
            onClick={() => { submit.reset(); setConfirmation(kind); }}>
            {labels[kind]}
          </button>
        ))}
        {confirmation && (
          <>
            <p>{labels[confirmation]}</p>
            <button type="button" disabled={submit.isPending} onClick={() => submit.mutate(confirmation)}>{labels.confirm}</button>
            <button type="button" disabled={submit.isPending} onClick={() => setConfirmation(undefined)}>{labels.back}</button>
          </>
        )}
      </section>
    <PortalGuestMarketingSection path={path} />
    </>
  );
}
