import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingStudioApi, marketingChannels, type MarketingChannel } from '@/api/marketing-studio.api';
import { useCreateDraft, usePreviewCount } from '@/queries/campaigns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AudiencePicker, MarketingError, PropertyPicker } from './MarketingInputs';
import { CampaignAssets, assetQueryKey, saveAssetDraft } from './CampaignAssets';

export function CampaignEditor({ onSaved }: { onSaved: () => void }) {
  const { t } = useTranslation();
  const [propertyId, setProperty] = useState('');
  const [segmentId, setSegment] = useState('');
  const [channel, setChannel] = useState<MarketingChannel>('email');
  const [brief, setBrief] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [eventName, setEvent] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [generated, setGenerated] = useState(false);
  const client = useQueryClient();
  const assetDraft = useMutation({
    mutationFn: saveAssetDraft,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['campaigns'] });
      onSaved();
    },
  });
  const preview = usePreviewCount(segmentId);
  const events = useMutation({ mutationFn: () => marketingStudioApi.events(propertyId, from, to) });
  const generate = useMutation({
    mutationFn: () =>
      marketingStudioApi.generate({ propertyId, segmentId, channel, brief: brief.trim() || eventName, eventName: eventName || undefined, sourceEvent: events.data?.find(e=>e.name===eventName) }),
    onSuccess: (result) => {
      setSubject(result.subject);
      setBody(result.body);
      setGenerated(true);
      void client.invalidateQueries({ queryKey: assetQueryKey });
    },
  });
  const save = useCreateDraft();
  const email = channel === 'email' || channel === 'newsletter';
  const busy = generate.isPending || events.isPending || save.isPending || assetDraft.isPending;
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="text-xl font-semibold">{t('campaigns.create')}</h2>
      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <PropertyPicker
            required
            value={propertyId}
            onChange={(v) => {
              setProperty(v);
              generate.reset();
              setGenerated(false);
              events.reset();
              setEvent('');
            }}
          />
          <AudiencePicker
            required
            value={segmentId}
            onChange={(v) => {
              setSegment(v);
              generate.reset();
              setGenerated(false);
            }}
          />
        </div>
        {preview.data && <p className="text-sm">{t('campaigns.editor.recipients', { count: preview.data.count })}</p>}
        <MarketingError error={preview.error} />
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer font-medium">{t('marketingStudio.findEvents')}</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              {t('marketingStudio.from')}
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              {t('marketingStudio.to')}
              <Input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <Button
            className="mt-3"
            variant="outline"
            disabled={!propertyId || !from || to < from || busy}
            onClick={() => {
              setEvent('');
              events.mutate();
            }}
          >
            {t('marketingStudio.findEvents')}
          </Button>
          <MarketingError error={events.error} />
          {events.data?.length === 0 && <p role="status">{t('marketingStudio.noEvents')}</p>}
          {events.data?.map((event, i) => (
            <div key={i} className="mt-3 rounded border p-3">
              <label className="flex gap-2">
                <input
                  type="radio"
                  name="event"
                  checked={event.name === eventName}
                  onChange={() => setEvent(event.name)}
                />
                <span>
                  {event.name} · {event.date}
                </span>
              </label>
              <p className="text-sm">{event.description}</p>
              {/^https?:\/\//i.test(event.source) && (
                <a href={event.source} target="_blank" rel="noreferrer" className="text-primary underline">
                  {t('marketingStudio.eventSource')}
                </a>
              )}
            </div>
          ))}
        </details>
        <label className="block">
          {t('marketingStudio.channel')}
          <Select
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value as MarketingChannel);
              generate.reset();
              setBody('');
              setSubject('');
              setGenerated(false);
            }}
          >
            {marketingChannels.map((c) => (
              <option key={c} value={c}>
                {t('marketingStudio.channels.' + c)}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          {t('marketingStudio.brief')}
          <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} />
        </label>
        <Button
          variant="outline"
          disabled={!propertyId || !segmentId || (!brief.trim() && !eventName) || busy}
          onClick={() => generate.mutate()}
        >
          {t(generate.isPending ? 'campaigns.editor.generating' : 'campaigns.editor.generate')}
        </Button>
        <MarketingError error={generate.error ?? assetDraft.error ?? save.error} />
        {email && (
          <>
            <label className="block">
              {t('campaigns.editor.subject')}
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>
            <label className="block">
              {t('campaigns.editor.body')}
              <Textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
            <Button
              disabled={!propertyId || !segmentId || !subject.trim() || !body.trim() || busy}
              onClick={() =>
                generated && generate.data
                  ? assetDraft.mutate({ id: generate.data.id, subject, body })
                  : save.mutate({ propertyId, segmentId, subject, body }, { onSuccess: onSaved })
              }
            >
              {t('campaigns.editor.saveDraft')}
            </Button>
          </>
        )}
      </fieldset>
      {!email && <CampaignAssets />}
    </div>
  );
}
