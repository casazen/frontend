import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BookOpen, LockKeyhole, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { autoReplyTopics, guideFields, type GuideAutoReplies, type HouseGuide } from '@/features/guest-portal/house-guide-fields';

const orgSettingsPath = '/guest-portal/auto-reply-settings';

const replyOptions = ['enabled', ...autoReplyTopics] as const;
const chatGuideFields = ['checkInHours', 'checkOutHours', 'parking', 'wifi'] as const;

const guideGroups = [
  { label: 'arrivalGroup', fields: ['arrival', 'checkInHours', 'parking'] },
  { label: 'stayGroup', fields: ['house', 'contacts', 'localTips'] },
  { label: 'departureGroup', fields: ['departure', 'checkOutHours'] },
  { label: 'privateGroup', fields: ['access', 'wifi'] },
] as const satisfies ReadonlyArray<{ label: string; fields: ReadonlyArray<typeof guideFields[number]> }>;

const defaultReplies: GuideAutoReplies = { enabled: false, checkIn: false, checkOut: false, parking: false, wifi: false };

export function GuestHouseGuideEditor({ propertyId, suggestion, section, withAi = false, onSaved }: {
  propertyId: string;
  suggestion?: HouseGuide;
  section?: 'guide' | 'chat';
  withAi?: boolean;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const endpoint = `/properties/${propertyId}/guest-house-guide`;
  const query = useQuery({
    queryKey: ['guest-house-guide', propertyId],
    queryFn: () => ApiClient.get<HouseGuide>(endpoint),
    gcTime: 0,
  });
  const orgSettings = useQuery({
    queryKey: ['guest-portal', 'auto-reply-settings', propertyId],
    queryFn: () => ApiClient.get<{ enabled: boolean; canManage: boolean }>(orgSettingsPath),
    enabled: section !== 'guide',
    retry: false,
    gcTime: 0,
  });
  const saveOrgSettings = useMutation({
    mutationFn: (enabled: boolean) => ApiClient.put(orgSettingsPath, { enabled }),
    onSuccess: async () => { await orgSettings.refetch(); },
  });
  const [draft, setDraft] = useState<HouseGuide>({});
  const guide = { ...query.data, ...suggestion, ...draft };
  const save = useMutation({
    mutationFn: () => ApiClient.put(endpoint, guide),
    onSuccess: onSaved,
  });
  const generate = useMutation({
    mutationFn: async () => {
      if (guideFields.every((field) => guide[field]?.trim())) return null;

      return ApiClient.post<{ guide?: HouseGuide; guideSource?: 'ai' | 'property' } | undefined>(
        `/properties/${propertyId}/guest-portal-setup/suggestions/guide`,
      );
    },
    onSuccess: (result) => {
      const generated = result?.guide;
      if (!generated) return;

      setDraft((current) => {
        const next = { ...current };
        const existing = { ...query.data, ...suggestion, ...current };
        for (const field of guideFields) {
          const value = generated[field];
          if (!existing[field]?.trim() && typeof value === 'string' && value.trim()) next[field] = value;
        }
        return next;
      });
      save.reset();
    },
  });
  const hasGeneratedFields = guideFields.some((field) => {
    const value = generate.data?.guide?.[field];
    return typeof value === 'string' && value.trim();
  });
  const generatedStatus = generate.data === null ? 'aiNoEmptyFields'
    : generate.data?.guideSource === 'property' ? 'aiPropertyReady' : 'aiReady';

  function renderField(field: typeof guideFields[number]) {
    return (
      <label key={field} className="grid min-w-0 gap-2 text-sm font-medium">
        {t(`guestPortal.guide.${field}`)}
        <textarea className="min-h-24 rounded-lg border bg-background p-3 text-sm font-normal leading-relaxed"
          disabled={save.isPending}
          maxLength={chatGuideFields.some((brief) => brief === field) ? 1000 : 2000} value={guide[field] ?? ''}
          onChange={(event) => {
            save.reset();
            setDraft((current) => ({ ...current, [field]: event.target.value }));
          }} />
      </label>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!generate.isPending) save.mutate();
  }

  return (
    <form onSubmit={submit} className="grid gap-6 rounded-xl border bg-card p-5 sm:p-7">
      {section !== 'chat' && (
        <header className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted"><BookOpen className="size-5" aria-hidden="true" /></span>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">{t('guestPortal.guide.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('guestPortal.guide.editorDescription')}</p>
          </div>
        </header>
      )}
      {query.isPending && <p role="status">{t('guestPortal.host.loading')}</p>}
      {query.isError && <p role="alert">{t('guestPortal.host.unavailable')}</p>}
      {query.isSuccess && (
        <>
          {withAi && (
            <section className="grid gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Sparkles aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div className="space-y-1">
                    <h3 className="font-semibold">{t('guestPortal.guide.aiTitle')}</h3>
                    <p className="text-sm text-muted-foreground">{t('guestPortal.guide.aiDescription')}</p>
                  </div>
                </div>
                <Button type="button" className="min-h-11" loading={generate.isPending} disabled={save.isPending}
                  onClick={() => generate.mutate()}>{t('guestPortal.guide.aiGenerate')}</Button>
              </div>
              {generate.isPending && (
                <p role="status" className="text-sm text-muted-foreground">{t('guestPortal.guide.aiGenerating')}</p>
              )}
              {(generate.isError || (generate.isSuccess && generate.data !== null && !hasGeneratedFields)) && (
                <p role="alert" className="text-sm text-muted-foreground">{t('guestPortal.guide.aiUnavailable')}</p>
              )}
              {generate.isSuccess && (generate.data === null || hasGeneratedFields) && (
                <p role="status" className="text-sm text-muted-foreground">
                  {t(`guestPortal.guide.${generatedStatus}`)}
                </p>
              )}
            </section>
          )}
          <p className="text-sm text-muted-foreground">{t('guestPortal.guide.visibility')}</p>
          {section === 'chat' ? (
            <div className="grid gap-4 sm:grid-cols-2">{chatGuideFields.map(renderField)}</div>
          ) : guideGroups.map(({ label, fields }) => (
            <fieldset key={label} className="min-w-0 rounded-xl border px-4 pb-4 sm:px-5">
              <legend className="px-2 text-sm font-semibold">
                <span className="flex items-center gap-2">
                  {label === 'privateGroup' && <LockKeyhole aria-hidden="true" className="size-4" />}
                  {t(`guestPortal.guide.${label}`)}
                </span>
              </legend>
              <div className="grid gap-4 pt-2 sm:grid-cols-2">{fields.map(renderField)}</div>
            </fieldset>
          ))}
          {section !== 'guide' && <fieldset className="grid gap-3 rounded-xl border px-5 pb-5" disabled={save.isPending}>
            <legend className="px-2 font-semibold">{t('guestPortal.guide.autoReplyTitle')}</legend>
            <p className="text-sm text-muted-foreground">{t('guestPortal.guide.autoReplyHelp')}</p>
            {orgSettings.data && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={orgSettings.data.enabled}
                  disabled={!orgSettings.data.canManage || saveOrgSettings.isPending}
                  onChange={(event) => saveOrgSettings.mutate(event.currentTarget.checked)} />
                {t('guestPortal.guide.autoReplyOrganization')}
              </label>
            )}
            {saveOrgSettings.isError && <p role="alert">{t('guestPortal.host.changeError')}</p>}
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
          <Button type="submit" className="min-h-11 justify-self-start" disabled={save.isPending || generate.isPending}>{t('guestPortal.guide.save')}</Button>
          {save.isSuccess && <p role="status">{t('guestPortal.guide.saved')}</p>}
          {save.isError && <p role="alert">{t('guestPortal.host.changeError')}</p>}
        </>
      )}
    </form>
  );
}
