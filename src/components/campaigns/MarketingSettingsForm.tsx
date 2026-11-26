import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { marketingStudioApi, type MarketingSettings } from '@/api/marketing-studio.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { AudiencePicker, MarketingError, PropertyPicker } from './MarketingInputs';

export function MarketingSetupEntry() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <section className="order-6 rounded-xl border bg-card p-4 lg:col-span-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">{t('marketingStudio.settings')}</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>{t('marketingStudio.settings')}</DialogTitle>
          <DialogDescription>{t('marketingStudio.setupIntro')}</DialogDescription>
          {open && <MarketingSettingsForm />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function MarketingSettingsForm() {
  const { t } = useTranslation();
  const settings = useQuery({ queryKey: ['marketing-settings'], queryFn: marketingStudioApi.settings });
  if (settings.isPending) return <LoadingScreen />;
  if (settings.isError) return <MarketingError error={settings.error} />;
  if (settings.data.canEdit === false) return <p>{t('marketingStudio.settingsOwner')}</p>;
  return <SettingsEditor initial={settings.data} title={t('marketingStudio.settings')} />;
}

function SettingsEditor({ initial, title }: { initial: MarketingSettings; title: string }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initial);
  const [property, setProperty] = useState('');
  const [step, setStep] = useState(0);
  const [examples, setExamples] = useState('');
  const [website, setWebsite] = useState('');
  const voice = useMutation({
    mutationFn: () =>
      ApiClient.post<{ voice: string }>(
        '/campaigns/studio/suggest-voice',
        { examples, website: website || undefined },
        { timeout: 120000 },
      ),
    onSuccess: (data) => edit('voice', data.voice),
  });
  const query = useQueryClient();
  const save = useMutation({
    mutationFn: marketingStudioApi.saveSettings,
    onSuccess: async () => {
      await query.invalidateQueries({ queryKey: ['marketing-settings'] });
      toast.success(t('marketingStudio.settingsSaved'));
      setStep((n) => Math.min(2, n + 1));
    },
  });
  function edit<K extends keyof MarketingSettings>(key: K, value: MarketingSettings[K]) {
    setDraft((old) => ({ ...old, [key]: value }));
  }
  function newsletter(change: Partial<MarketingSettings['newsletter']>) {
    setDraft((old) => ({ ...old, newsletter: { ...old.newsletter, ...change } }));
  }
  return (
    <form
      className="space-y-6 rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({
          ...draft,
          propertyUrls: Object.fromEntries(Object.entries(draft.propertyUrls).filter(([, url]) => url.trim())),
        });
      }}
    >
      <h2 className="text-xl font-semibold">{title}</h2>
      <nav className="flex flex-wrap gap-2" aria-label={title}>
        {['voice', 'audienceSettings', 'newsletter'].map((name, i) => (
          <Button type="button" variant={i === step ? 'default' : 'outline'} key={name} onClick={() => setStep(i)}>
            {t('marketingStudio.' + name)}
          </Button>
        ))}
      </nav>
      {step === 0 && (
        <>
          <details className="rounded border p-3">
            <summary>{t('marketingStudio.suggestVoice')}</summary>
            <label className="mt-3 block">
              {t('marketingStudio.examples')}
              <Textarea value={examples} maxLength={8000} onChange={(e) => setExamples(e.target.value)} />
            </label>
            <label className="block">
              {t('marketingStudio.website')}
              <Input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              disabled={voice.isPending || !(examples.trim() || website.trim())}
              onClick={() => voice.mutate()}
            >
              {t('marketingStudio.suggestVoice')}
            </Button>
            <MarketingError error={voice.error} />
          </details>
          <label className="block">
            {t('marketingStudio.voice')}
            <Textarea
              value={draft.voice ?? ''}
              onChange={(e) => edit('voice', e.target.value)}
              placeholder={t('marketingStudio.voiceHint')}
            />
          </label>
          <PropertyPicker value={property} onChange={setProperty} />
          {property && (
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                {t('marketingStudio.notes')}
                <Textarea
                  value={draft.propertyNotes[property] ?? ''}
                  onChange={(e) => edit('propertyNotes', { ...draft.propertyNotes, [property]: e.target.value })}
                />
              </label>
              <label>
                {t('marketingStudio.website')}
                <Input
                  type="url"
                  value={draft.propertyUrls[property] ?? ''}
                  onChange={(e) => edit('propertyUrls', { ...draft.propertyUrls, [property]: e.target.value })}
                />
              </label>
            </div>
          )}
        </>
      )}
      {step === 1 && (
        <fieldset className="grid gap-4 md:grid-cols-3">
          <legend className="mb-3 font-semibold">{t('marketingStudio.audienceSettings')}</legend>
          {(['monthlyEmailLimit', 'loyalStays', 'lostMonths'] as const).map((key) => (
            <label key={key}>
              {t('marketingStudio.' + key)}
              <Input
                type="number"
                min={key === 'monthlyEmailLimit' ? 0 : 1}
                max={key === 'monthlyEmailLimit' ? 2 : key === 'loyalStays' ? 100 : 240}
                required
                value={draft[key]}
                onChange={(e) => edit(key, Number(e.target.value))}
              />
            </label>
          ))}
        </fieldset>
      )}
      {step === 2 && (
        <fieldset className="space-y-3">
          <legend className="font-semibold">{t('marketingStudio.newsletter')}</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.newsletter.enabled}
              onChange={(e) => newsletter({ enabled: e.target.checked })}
            />
            {t('marketingStudio.enableNewsletter')}
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <PropertyPicker
              required={draft.newsletter.enabled}
              value={draft.newsletter.propertyId ?? ''}
              onChange={(id) => newsletter({ propertyId: id || null })}
            />
            <AudiencePicker
              required={draft.newsletter.enabled}
              value={draft.newsletter.segmentId ?? ''}
              onChange={(id) => newsletter({ segmentId: id || null })}
            />
          </div>
          <label className="block">
            {t('marketingStudio.cadence')}
            <Input
              type="number"
              min={1}
              max={365}
              required
              value={draft.newsletter.cadenceDays}
              onChange={(e) => newsletter({ cadenceDays: Number(e.target.value) })}
            />
          </label>
          <label className="block">
            {t('marketingStudio.newsletterInstructions')}
            <Textarea
              value={draft.newsletter.instructions ?? ''}
              onChange={(e) => newsletter({ instructions: e.target.value })}
            />
          </label>
        </fieldset>
      )}
      <MarketingError error={save.error} />
      <Button type="submit" disabled={save.isPending}>
        {t(step < 2 ? 'marketingStudio.saveNext' : 'shared.save')}
      </Button>
    </form>
  );
}
