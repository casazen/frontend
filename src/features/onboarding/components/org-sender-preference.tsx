import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { orgComplianceSenderApi, type OrgComplianceSender } from '@/api/org-compliance-sender.api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { delegationTextKey } from '@/features/compliance/sender-wizard/sender-wizard-model';
import { getProblemMessage } from '@/lib/api-errors';
import { invalidateOnboarding } from '@/queries/use-onboarding-plan';
import { ORG_COMPLIANCE_SENDER_KEY, useOrgComplianceSender } from '@/queries/use-org-compliance-sender';
import { PROPERTY_SENDER_KEY } from '@/queries/use-property-sender';

const methods = [
  { sender: 'ChannelManager', label: 'orgComplianceSender.channel', hint: 'orgComplianceSender.channelHint' },
  { sender: 'Manual', label: 'orgComplianceSender.manual', hint: 'orgComplianceSender.manualHint' },
] as const;

type Stage = 'saved' | 'choice' | 'review';

interface OrgSenderPreferenceProps {
  onFirstSaved?: () => void;
}

export function OrgSenderPreference({ onFirstSaved }: OrgSenderPreferenceProps) {
  const { t } = useTranslation();
  const read = useOrgComplianceSender();
  if (read.isLoading) return <p role="status">{t('orgComplianceSender.loading')}</p>;
  if (read.isError || !read.data) {
    return (
      <Alert variant="warning" action={
        <Button type="button" variant="outline" loading={read.isFetching} onClick={() => void read.refetch()}>
          {t('orgComplianceSender.retry')}
        </Button>
      }>
        {t('orgComplianceSender.loadError')}
      </Alert>
    );
  }
  return <PreferenceForm key={`${read.data.sender}-${read.data.lastChangedAt}-${read.data.delegationTextVersion}`} read={read.data} onFirstSaved={onFirstSaved} />;
}

function PreferenceForm({ read, onFirstSaved }: { read: OrgComplianceSender } & OrgSenderPreferenceProps) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [stage, setStage] = useState<Stage>(read.sender ? 'saved' : 'choice');
  const [sender, setSender] = useState(read.sender);
  const [confirmed, setConfirmed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [autoSend, setAutoSend] = useState(read.autoSendGuestsToOctorate);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStage = useRef(stage);
  useEffect(() => {
    if (previousStage.current !== stage) heading.current?.focus();
    previousStage.current = stage;
  }, [stage]);
  const textKey = delegationTextKey(read.delegationTextVersion);
  const needsConsent = sender === 'ChannelManager' && !read.delegationAccepted;
  const save = useMutation({
    mutationFn: orgComplianceSenderApi.set,
    gcTime: 0,
    onSuccess: (answer) => {
      if (read.sender === null && answer.sender !== null) onFirstSaved?.();
      client.setQueryData(ORG_COMPLIANCE_SENDER_KEY, answer);
      void client.invalidateQueries({ queryKey: [PROPERTY_SENDER_KEY] });
      void client.invalidateQueries({ queryKey: ['compliance'] });
      void client.invalidateQueries({ queryKey: ['compliance-health'] });
      invalidateOnboarding(client);
      setStage('saved');
    },
    onError: () => { void client.invalidateQueries({ queryKey: ORG_COMPLIANCE_SENDER_KEY }); },
  });
  const method = methods.find((option) => option.sender === sender);
  const autoHint = t(autoSend ? 'orgComplianceSender.autoOn' : 'orgComplianceSender.autoOff');

  function openChoice() {
    setConfirmed(false);
    setConsent(false);
    save.reset();
    setStage('choice');
  }

  function saveChoice() {
    if (!sender || !confirmed || (needsConsent && (!consent || !textKey)) || save.isPending) return;
    save.mutate({
      sender,
      confirmed,
      expectedLastChangedAt: read.lastChangedAt,
      autoSendGuestsToOctorate: sender === 'ChannelManager' && autoSend !== read.autoSendGuestsToOctorate ? autoSend : undefined,
      delegationConsent: needsConsent && consent,
      delegationTextVersion: needsConsent ? read.delegationTextVersion : undefined,
    });
  }

  if (stage === 'saved' && method) {
    return (
      <section aria-labelledby="org-sender-title" data-testid="org-sender-preference" className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 id="org-sender-title" ref={heading} tabIndex={-1} className="text-sm font-medium">{t('orgComplianceSender.savedTitle')}</h2>
          <p role="status" className="text-sm text-foreground/75">{t(method.label)}</p>
        </div>
        <Button type="button" variant="link" className="min-h-11 px-0" onClick={openChoice}>{t('orgComplianceSender.edit')}</Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="org-sender-title" data-testid="org-sender-preference" className="min-w-0 space-y-4">
      <div className="space-y-1">
        <h2 id="org-sender-title" ref={heading} tabIndex={-1} className="text-balance text-xl font-semibold tracking-tight">
          {t(stage === 'review' ? 'orgComplianceSender.review' : 'orgComplianceSender.title')}
        </h2>
        {stage === 'choice' && <p className="max-w-prose text-sm leading-relaxed text-foreground/75">{t('orgComplianceSender.description')}</p>}
      </div>

      {stage === 'choice' ? (
        <>
          <fieldset className="@container min-w-0">
            <legend className="sr-only">{t('orgComplianceSender.title')}</legend>
            <div className="grid divide-y overflow-hidden rounded-lg border bg-background @md:grid-cols-2 @md:divide-x @md:divide-y-0">
              {methods.map((option) => {
                const id = `org-sender-${option.sender}`;
                return (
                  <label key={option.sender} className="flex cursor-pointer items-start gap-3 px-4 py-3 has-checked:bg-primary/5 has-focus-visible:inset-ring-2 has-focus-visible:inset-ring-ring">
                    <input className="mt-1 size-4 shrink-0 accent-primary" type="radio" name="org-sender" value={option.sender}
                      aria-labelledby={id} aria-describedby={`${id}-hint`} checked={sender === option.sender} onChange={() => setSender(option.sender)} />
                    <span className="min-w-0">
                      <span id={id} className="block font-semibold">{t(option.label)}</span>
                      <span id={`${id}-hint`} className="mt-1 block text-sm leading-relaxed text-foreground/75">{t(option.hint)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {sender === 'ChannelManager' && (
            <div className="min-w-0 border-l-2 pl-4">
              <Label htmlFor="org-sender-auto" className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
                {t('orgComplianceSender.autoLabel')}
                <Switch id="org-sender-auto" checked={autoSend} aria-describedby="org-sender-auto-hint" onCheckedChange={setAutoSend} />
              </Label>
              <p id="org-sender-auto-hint" className="text-sm leading-relaxed text-foreground/75">{autoHint}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button type="button" className="min-h-11" disabled={!sender} onClick={() => setStage('review')} iconRight={<ArrowRight />}>
              {t('orgComplianceSender.continue')}
            </Button>
            {read.sender && <Button type="button" variant="ghost" onClick={() => {
              setSender(read.sender);
              setAutoSend(read.autoSendGuestsToOctorate);
              setStage('saved');
            }}>{t('orgComplianceSender.cancel')}</Button>}
          </div>
        </>
      ) : (
        <div className="space-y-4" data-testid="org-sender-review">
          <dl className="space-y-2 border-l-2 border-primary pl-4 text-sm">
            <div>
              <dt className="text-foreground/75">{t('orgComplianceSender.savedTitle')}</dt>
              <dd className="font-semibold">{method && t(method.label)}</dd>
            </div>
            <div>
              <dt className="sr-only">{t('orgComplianceSender.effectLabel')}</dt>
              <dd>{method && t(method.hint)}</dd>
              {sender === 'ChannelManager' && <dd className="mt-1">{autoHint}</dd>}
            </div>
          </dl>
          <p className="max-w-prose text-sm leading-relaxed text-foreground/75">{t('orgComplianceSender.effect')}</p>
          {read.propertyOverrides > 0 && <p className="text-sm">{t('orgComplianceSender.overrides', { count: read.propertyOverrides })}</p>}
          {needsConsent && (textKey ? (
            <div className="space-y-1">
              <details className="text-sm">
                <summary className="min-h-11 cursor-pointer content-center font-medium">{t('compliance.sender.delegation.title')}</summary>
                <p className="max-w-prose whitespace-pre-line py-2 leading-relaxed">{t(textKey)}</p>
              </details>
              <Label htmlFor="org-sender-consent" className="flex min-h-11 cursor-pointer items-start gap-3 py-2 leading-relaxed">
                <Checkbox id="org-sender-consent" className="mt-0.5" checked={consent} disabled={save.isPending} onCheckedChange={(value) => setConsent(value === true)} />
                {t('compliance.sender.delegation.consent')}
              </Label>
            </div>
          ) : <Alert variant="warning">{t('compliance.sender.delegation.unknownVersion')}</Alert>)}
          <Label htmlFor="org-sender-confirm" className="flex min-h-11 cursor-pointer items-start gap-3 py-2 leading-relaxed">
            <Checkbox id="org-sender-confirm" className="mt-0.5" checked={confirmed} disabled={save.isPending} onCheckedChange={(value) => setConfirmed(value === true)} />
            {t('orgComplianceSender.confirm')}
          </Label>
          {save.isError && <Alert variant="danger">{getProblemMessage(save.error, t) ?? t('orgComplianceSender.saveError')}</Alert>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button type="button" className="min-h-11" loading={save.isPending} disabled={!confirmed || (needsConsent && (!consent || !textKey))}
              onClick={saveChoice} data-testid="org-sender-save">{t('orgComplianceSender.save')}</Button>
            <Button type="button" variant="ghost" disabled={save.isPending} onClick={openChoice}>{t('orgComplianceSender.back')}</Button>
          </div>
        </div>
      )}
      <details className="group border-t text-sm">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180" />
          {t('orgComplianceSender.accountsTitle')}
        </summary>
        <p className="max-w-prose leading-relaxed text-foreground/75">{t('orgComplianceSender.accounts')}</p>
        <a className="inline-flex min-h-11 items-center underline underline-offset-4" href="https://alloggiatiweb.poliziadistato.it/PortaleAlloggiati/Download/Manuali/manuale.pdf" target="_blank" rel="noreferrer">
          {t('orgComplianceSender.source')}
        </a>
      </details>
    </section>
  );
}
