import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Settings2 } from 'lucide-react';
import { marketingStudioApi, type MarketingSettings, type NewsletterSettings } from '@/api/marketing-studio.api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSegments } from '@/queries/campaigns';
import { useMarketingSettings, useSaveMarketingSettings } from '@/queries/marketing-settings';
import { useProperties } from '@/queries/use-properties';
import { LayerWizard } from './layer-wizard';
import { marketingErrorText } from './marketing-error';
import { propertyOption } from './property-options';
import { SegmentWizard } from './segment-wizard';
import { CADENCE_KEYS, addLine, cleanEntries, isPublicHttpsUrl } from './settings-rules';
import { HousesStep, NewsletterStep, ReviewStep, RulesStep, SettingsDone, VoiceStep, type ReviewRow, type VoiceHelp } from './settings-steps';

type StepId = 'voice' | 'houses' | 'rules' | 'newsletter' | 'review';

const STEP_IDS: readonly StepId[] = ['voice', 'houses', 'rules', 'newsletter', 'review'];
const base = 'marketingHub.settingsWizard';
const SUMMARY_LENGTH = 140;

export interface SettingsWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWriteCampaign?: () => void;
}

export function SettingsWizard(props: SettingsWizardProps) {
  return props.open ? <SettingsWizardGate {...props} /> : null;
}

function FooterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-8 sm:py-4">{children}</div>
  );
}

function SettingsWizardGate({ onOpenChange, onWriteCampaign }: SettingsWizardProps) {
  const { t } = useTranslation();
  const settings = useMarketingSettings();

  if (settings.data && settings.data.canEdit !== false) {
    return <SettingsEditor initial={settings.data} onOpenChange={onOpenChange} onWriteCampaign={onWriteCampaign} />;
  }

  const locked = settings.data !== undefined;
  const heading = locked ? t(`${base}.locked.title`) : settings.isError ? t(`${base}.gate.errorTitle`) : t(`${base}.gate.loading`);

  return (
    <LayerWizard
      open
      onOpenChange={onOpenChange}
      icon={Settings2}
      title={t(`${base}.title`)}
      steps={[]}
      stepIndex={0}
      showStepper={false}
      heading={heading}
      testId="settings-wizard"
      footer={
        <FooterBar>
          <Button type="button" onClick={() => onOpenChange(false)} data-testid="settings-wizard-close">
            {t('marketingHub.layer.close')}
          </Button>
        </FooterBar>
      }
    >
      {locked ? (
        <p className="max-w-prose text-foreground/85" data-testid="settings-locked">
          {t(`${base}.locked.text`)}
        </p>
      ) : settings.isError ? (
        <Alert
          variant="danger"
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => void settings.refetch()}>
              {t(`${base}.gate.retry`)}
            </Button>
          }
        >
          {marketingErrorText(settings.error, t)}
        </Alert>
      ) : (
        <Skeleton className="h-40 w-full rounded-2xl" />
      )}
    </LayerWizard>
  );
}

interface EditorProps {
  initial: MarketingSettings;
  onOpenChange: (open: boolean) => void;
  onWriteCampaign?: () => void;
}

function SettingsEditor({ initial, onOpenChange, onWriteCampaign }: EditorProps) {
  const { t } = useTranslation();
  const properties = useProperties({ mode: 'short' });
  const segments = useSegments();
  const save = useSaveMarketingSettings();
  const propertyOptions = useMemo(() => (properties.data ?? []).map(propertyOption), [properties.data]);

  const [step, setStep] = useState<StepId>('voice');
  const [draft, setDraft] = useState<MarketingSettings>(initial);
  const [help, setHelp] = useState<VoiceHelp>({ examples: '', website: '' });
  const [fromAi, setFromAi] = useState(false);
  const [previousVoice, setPreviousVoice] = useState<string | null>(null);
  const [groupWizardOpen, setGroupWizardOpen] = useState(false);

  const replaceVoice = (value: string, ai: boolean) => {
    if (draft.voice.trim() !== '' && draft.voice !== value) setPreviousVoice(draft.voice);
    setDraft((current) => ({ ...current, voice: value }));
    setFromAi(ai);
  };

  const propose = useMutation({
    mutationFn: () => marketingStudioApi.suggestVoice(help.examples.trim(), help.website.trim() || undefined),
    onSuccess: (result) => replaceVoice(result.voice, true),
  });

  const patchNewsletter = (patch: Partial<NewsletterSettings>) => setDraft((current) => ({ ...current, newsletter: { ...current.newsletter, ...patch } }));
  const patchEntry = (key: 'propertyNotes' | 'propertyUrls', id: string, value: string) =>
    setDraft((current) => ({ ...current, [key]: { ...current[key], [id]: value } }));

  const singleProperty = propertyOptions.length === 1 ? propertyOptions[0].id : '';
  const newsletterProperty = draft.newsletter.propertyId ?? singleProperty;
  const urlProblem = Object.values(draft.propertyUrls).some((url) => url.trim() !== '' && !isPublicHttpsUrl(url));
  const newsletterIncomplete = draft.newsletter.enabled && (!newsletterProperty || !draft.newsletter.segmentId);

  const payload: MarketingSettings = {
    voice: draft.voice,
    propertyNotes: cleanEntries(draft.propertyNotes),
    propertyUrls: cleanEntries(draft.propertyUrls),
    monthlyEmailLimit: draft.monthlyEmailLimit,
    loyalStays: draft.loyalStays,
    lostMonths: draft.lostMonths,
    newsletter: { ...draft.newsletter, propertyId: draft.newsletter.enabled ? newsletterProperty || null : draft.newsletter.propertyId },
  };

  const stepList = STEP_IDS.map((id) => ({ id, label: t(`${base}.steps.${id}`) }));
  const stepIndex = STEP_IDS.indexOf(step);
  const title = t(`${base}.title`);

  if (save.isSuccess) {
    return (
      <LayerWizard
        open
        onOpenChange={onOpenChange}
        icon={Settings2}
        title={title}
        steps={stepList}
        stepIndex={STEP_IDS.length - 1}
        showStepper={false}
        heading={t(`${base}.done.title`)}
        testId="settings-wizard"
        footer={
          <FooterBar>
            <Button type="button" variant={onWriteCampaign ? 'outline' : 'default'} onClick={() => onOpenChange(false)} data-testid="settings-wizard-close">
              {t('marketingHub.layer.close')}
            </Button>
            {onWriteCampaign ? (
              <Button type="button" onClick={onWriteCampaign} data-testid="settings-wizard-write">
                {t(`${base}.done.write`)}
              </Button>
            ) : null}
          </FooterBar>
        }
      >
        <SettingsDone />
      </LayerWizard>
    );
  }

  const cadenceText = (days: number) =>
    days in CADENCE_KEYS ? t(`${base}.newsletter.cadenceOptions.${CADENCE_KEYS[days as keyof typeof CADENCE_KEYS]}`) : t(`${base}.newsletter.cadenceCustom`, { count: days });
  const voiceText = draft.voice.trim();
  const detailed = propertyOptions.filter((item) => (draft.propertyUrls[item.id] ?? '').trim() !== '' || (draft.propertyNotes[item.id] ?? '').trim() !== '').length;
  const group = segments.data?.find((item) => item.id === draft.newsletter.segmentId);
  const house = propertyOptions.find((item) => item.id === newsletterProperty);

  const rows: ReviewRow[] = [
    {
      id: 'voice',
      label: t(`${base}.steps.voice`),
      value: voiceText === '' ? t(`${base}.review.voiceEmpty`) : voiceText.length > SUMMARY_LENGTH ? `${voiceText.slice(0, SUMMARY_LENGTH).trimEnd()}…` : voiceText,
      onChange: () => setStep('voice'),
    },
    {
      id: 'houses',
      label: t(`${base}.steps.houses`),
      value: detailed > 0 ? t(`${base}.review.housesValue`, { count: detailed }) : t(`${base}.review.housesNone`),
      onChange: () => setStep('houses'),
    },
    {
      id: 'rules',
      label: t(`${base}.steps.rules`),
      value: [
        t(`${base}.rules.limit.summary.${draft.monthlyEmailLimit}`),
        t(`${base}.review.loyalLine`, { count: draft.loyalStays }),
        t(`${base}.review.lostLine`, { count: draft.lostMonths }),
      ].join('\n'),
      onChange: () => setStep('rules'),
    },
    {
      id: 'newsletter',
      label: t(`${base}.steps.newsletter`),
      value: draft.newsletter.enabled
        ? `${cadenceText(draft.newsletter.cadenceDays)}\n${t(`${base}.review.newsletterTo`, { house: house?.name ?? '—', group: group?.name ?? '—' })}`
        : t(`${base}.review.newsletterOff`),
      onChange: () => setStep('newsletter'),
    },
  ];

  const next =
    step === 'review'
      ? { label: t(`${base}.save`), onClick: () => save.mutate(payload), loading: save.isPending, icon: <CheckCircle2 /> }
      : {
          label: t('marketingHub.layer.continue'),
          onClick: () => setStep(STEP_IDS[stepIndex + 1]),
          disabled: (step === 'houses' && urlProblem) || (step === 'newsletter' && newsletterIncomplete),
        };

  return (
    <>
      <LayerWizard
        open
        onOpenChange={onOpenChange}
        icon={Settings2}
        title={title}
        steps={stepList}
        stepIndex={stepIndex}
        heading={t(`${base}.${step}.title`)}
        purpose={t(`${base}.${step}.purpose`)}
        busy={propose.isPending || save.isPending}
        onBack={step === 'voice' ? undefined : () => setStep(STEP_IDS[stepIndex - 1])}
        onStepSelect={(index) => setStep(STEP_IDS[index])}
        next={next}
        testId="settings-wizard"
      >
        {step === 'voice' ? (
          <VoiceStep
            voice={draft.voice}
            fromAi={fromAi}
            canUndo={previousVoice !== null}
            help={help}
            onHelp={setHelp}
            proposing={propose.isPending}
            error={propose.isError ? marketingErrorText(propose.error, t) : null}
            onVoice={(value) => {
              setDraft((current) => ({ ...current, voice: value }));
              setFromAi(false);
            }}
            onPreset={(text) => replaceVoice(text, false)}
            onPropose={() => propose.mutate()}
            onUndo={() => {
              if (previousVoice === null) return;
              setDraft((current) => ({ ...current, voice: previousVoice }));
              setPreviousVoice(null);
              setFromAi(false);
            }}
          />
        ) : null}

        {step === 'houses' ? (
          <HousesStep
            properties={propertyOptions}
            loading={properties.isPending}
            error={properties.isError ? marketingErrorText(properties.error, t) : null}
            notes={draft.propertyNotes}
            urls={draft.propertyUrls}
            onNote={(id, value) => patchEntry('propertyNotes', id, value)}
            onUrl={(id, value) => patchEntry('propertyUrls', id, value)}
          />
        ) : null}

        {step === 'rules' ? (
          <RulesStep
            limit={draft.monthlyEmailLimit}
            loyalStays={draft.loyalStays}
            lostMonths={draft.lostMonths}
            onLimit={(value) => setDraft((current) => ({ ...current, monthlyEmailLimit: value }))}
            onLoyalStays={(value) => setDraft((current) => ({ ...current, loyalStays: value }))}
            onLostMonths={(value) => setDraft((current) => ({ ...current, lostMonths: value }))}
          />
        ) : null}

        {step === 'newsletter' ? (
          <NewsletterStep
            plan={draft.newsletter}
            properties={propertyOptions}
            propertyId={newsletterProperty}
            segments={segments.data ?? []}
            loadingSegments={segments.isPending}
            onChange={patchNewsletter}
            onTopic={(line) => patchNewsletter({ instructions: addLine(draft.newsletter.instructions ?? '', line) })}
            onCreateGroup={() => setGroupWizardOpen(true)}
          />
        ) : null}

        {step === 'review' ? <ReviewStep rows={rows} error={save.isError ? marketingErrorText(save.error, t, t('marketingHub.errors.settingsSave')) : null} /> : null}
      </LayerWizard>
      <SegmentWizard open={groupWizardOpen} onOpenChange={setGroupWizardOpen} onCreated={(segment) => patchNewsletter({ segmentId: segment.id })} />
    </>
  );
}
