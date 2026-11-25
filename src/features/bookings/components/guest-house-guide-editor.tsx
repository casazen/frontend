import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { guideFields, type HouseGuide } from '@/features/guest-portal/house-guide-fields';

export function GuestHouseGuideEditor({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const endpoint = `/properties/${propertyId}/guest-house-guide`;
  const query = useQuery({
    queryKey: ['guest-house-guide', propertyId],
    queryFn: () => ApiClient.get<HouseGuide>(endpoint),
    gcTime: 0,
  });
  const [draft, setDraft] = useState<HouseGuide>({});
  const guide = { ...query.data, ...draft };
  const save = useMutation({ mutationFn: () => ApiClient.put(endpoint, guide) });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-lg border bg-card p-4">
      <h2 className="font-medium">{t('guestPortal.guide.title')}</h2>
      {query.isPending && <p role="status">{t('guestPortal.host.loading')}</p>}
      {query.isError && <p role="alert">{t('guestPortal.host.unavailable')}</p>}
      {query.isSuccess && (
        <>
          <p className="text-sm text-muted-foreground">{t('guestPortal.guide.visibility')}</p>
          {guideFields.map((field) => (
            <label key={field} className="grid gap-1 text-sm font-medium">
              {t(`guestPortal.guide.${field}`)}
              <textarea className="min-h-20 rounded-md border bg-background p-2" disabled={save.isPending}
                maxLength={field === 'wifi' ? 1000 : 2000} value={guide[field] ?? ''}
                onChange={(event) => {
                  save.reset();
                  setDraft((current) => ({ ...current, [field]: event.target.value }));
                }} />
            </label>
          ))}
          <Button type="submit" disabled={save.isPending}>{t('guestPortal.guide.save')}</Button>
          {save.isSuccess && <p role="status">{t('guestPortal.guide.saved')}</p>}
          {save.isError && <p role="alert">{t('guestPortal.host.changeError')}</p>}
        </>
      )}
    </form>
  );
}
