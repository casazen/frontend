import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { autoReplyTopics, guideFields, type GuideAutoReplies, type HouseGuide } from '@/features/guest-portal/house-guide-fields';

const replyOptions = ['enabled', ...autoReplyTopics] as const;
const chatGuideFields = ['checkInHours', 'checkOutHours', 'parking', 'wifi'] as const;

const defaultReplies: GuideAutoReplies = { enabled: false, checkIn: false, checkOut: false, parking: false, wifi: false };

export function GuestHouseGuideEditor({ propertyId, suggestion, section, onSaved }: {
  propertyId: string;
  suggestion?: HouseGuide;
  section?: 'guide' | 'chat';
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const endpoint = `/properties/${propertyId}/guest-house-guide`;
  const query = useQuery({
    queryKey: ['guest-house-guide', propertyId],
    queryFn: () => ApiClient.get<HouseGuide>(endpoint),
    gcTime: 0,
  });
  const [draft, setDraft] = useState<HouseGuide>({});
  const guide = { ...query.data, ...suggestion, ...draft };
  const save = useMutation({
    mutationFn: () => ApiClient.put(endpoint, guide),
    onSuccess: onSaved,
  });
  const fields = section === 'chat' ? chatGuideFields : guideFields;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-lg border bg-card p-4">
      {section !== 'chat' && <h2 className="font-medium">{t('guestPortal.guide.title')}</h2>}
      {query.isPending && <p role="status">{t('guestPortal.host.loading')}</p>}
      {query.isError && <p role="alert">{t('guestPortal.host.unavailable')}</p>}
      {query.isSuccess && (
        <>
          <p className="text-sm text-muted-foreground">{t('guestPortal.guide.visibility')}</p>
          {fields.map((field) => (
            <label key={field} className="grid gap-1 text-sm font-medium">
              {t(`guestPortal.guide.${field}`)}
              <textarea className="min-h-20 rounded-md border bg-background p-2" disabled={save.isPending}
                maxLength={chatGuideFields.some((brief) => brief === field) ? 1000 : 2000} value={guide[field] ?? ''}
                onChange={(event) => {
                  save.reset();
                  setDraft((current) => ({ ...current, [field]: event.target.value }));
                }} />
            </label>
          ))}
          {section !== 'guide' && <fieldset className="grid gap-2" disabled={save.isPending}>
            <legend className="font-medium">{t('guestPortal.guide.autoReplyTitle')}</legend>
            <p className="text-sm text-muted-foreground">{t('guestPortal.guide.autoReplyHelp')}</p>
            {replyOptions.map((topic) => (
              <label key={topic} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={guide.autoReplies?.[topic] ?? false} onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  save.reset();
                  setDraft((current) => ({
                    ...current,
                    autoReplies: { ...(guide.autoReplies ?? defaultReplies), [topic]: checked },
                  }));
                }} />
                {t(`guestPortal.guide.autoReplyTopics.${topic}`)}
              </label>
            ))}
          </fieldset>}
          <Button type="submit" disabled={save.isPending}>{t('guestPortal.guide.save')}</Button>
          {save.isSuccess && <p role="status">{t('guestPortal.guide.saved')}</p>}
          {save.isError && <p role="alert">{t('guestPortal.host.changeError')}</p>}
        </>
      )}
    </form>
  );
}
