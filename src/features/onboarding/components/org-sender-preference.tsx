import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { orgComplianceSenderApi, type OrgComplianceSender } from '@/api/org-compliance-sender.api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Label } from '@/components/ui/label';
import { getProblemMessage } from '@/lib/api-errors';
import { invalidateOnboarding } from '@/queries/use-onboarding-plan';
import { PROPERTY_SENDER_KEY } from '@/queries/use-property-sender';
import { delegationTextKey } from '@/features/compliance/sender-wizard/sender-wizard-model';

const KEY = ['org-compliance-sender'];

/** An account preference is deliberately separate from the credentials and verification of each accommodation. */
export function OrgSenderPreference() {
  const { t } = useTranslation();
  const read = useQuery({ queryKey: KEY, queryFn: orgComplianceSenderApi.get, refetchOnMount: 'always' });
  if (read.isLoading) return <p role="status">{t('orgComplianceSender.loading')}</p>;
  if (read.isError || !read.data) return <Alert variant="warning" action={<Button variant="outline" onClick={() => void read.refetch()}>{t('orgComplianceSender.retry')}</Button>}>{t('orgComplianceSender.loadError')}</Alert>;
  return <PreferenceForm key={`${read.data.sender}-${read.data.lastChangedAt}`} read={read.data} />;
}

function PreferenceForm({ read }: { read: OrgComplianceSender }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [editing, setEditing] = useState(read.sender === null);
  const [sender, setSender] = useState(read.sender);
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [autoSend, setAutoSend] = useState(read.autoSendGuestsToOctorate);
  const textKey = delegationTextKey(read.delegationTextVersion);
  const needsConsent = sender === 'ChannelManager' && !read.delegationAccepted;
  const save = useMutation({
    mutationFn: orgComplianceSenderApi.set,
    gcTime: 0,
    onSuccess: (answer) => {
      client.setQueryData(KEY, answer);
      void client.invalidateQueries({ queryKey: [PROPERTY_SENDER_KEY] });
      void client.invalidateQueries({ queryKey: ['compliance'] });
      void client.invalidateQueries({ queryKey: ['compliance-health'] });
      invalidateOnboarding(client);
      setEditing(false);
    },
    onError: () => { void client.invalidateQueries({ queryKey: KEY }); },
  });
  const senderLabel = sender === 'ChannelManager' ? t('orgComplianceSender.channel') : t('orgComplianceSender.manual');

  return (
    <section className="min-w-0 space-y-4 rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="org-sender-title" data-testid="org-sender-preference">
      <div className="space-y-2">
        <p className="text-sm text-foreground/60">{t('orgComplianceSender.scope')}</p>
        <h2 id="org-sender-title" className="text-xl font-semibold">{t('orgComplianceSender.title')}</h2>
        <p className="max-w-prose text-sm text-foreground/70">{t('orgComplianceSender.description')}</p>
      </div>
      {!editing ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="font-medium" role="status">{t('orgComplianceSender.saved', { sender: senderLabel })}</p>
          <Button variant="outline" onClick={() => { setEditing(true); setReview(false); setConfirmed(false); }}>{t('orgComplianceSender.edit')}</Button>
        </div>
      ) : !review ? (
        <>
          <ChoiceGroup legend={t('orgComplianceSender.title')}>
            <ChoiceCard name="org-sender" value="ChannelManager" title={t('orgComplianceSender.channel')} description={t('orgComplianceSender.channelHint')} checked={sender === 'ChannelManager'} onChange={() => setSender('ChannelManager')} />
            <ChoiceCard name="org-sender" value="Manual" title={t('orgComplianceSender.manual')} description={t('orgComplianceSender.manualHint')} checked={sender === 'Manual'} onChange={() => setSender('Manual')} />
          </ChoiceGroup>
          {sender === 'ChannelManager' ? <div className="space-y-2"><Label htmlFor="org-sender-auto" className="flex min-h-11 items-center gap-3"><Switch id="org-sender-auto" checked={autoSend} onCheckedChange={setAutoSend} />{t('compliance.sender.autoSend.label')}</Label><p className="text-sm text-foreground/70">{t(`compliance.sender.autoSend.consequence.${autoSend ? 'on' : 'off'}`)}</p></div> : null}
          <Button disabled={sender === null} onClick={() => setReview(true)}>{t('orgComplianceSender.continue')}</Button>
        </>
      ) : (
        <div className="space-y-4" data-testid="org-sender-review">
          <h3 className="text-lg font-semibold">{t('orgComplianceSender.review')}</h3>
          <p className="font-medium">{senderLabel}</p>
          <p className="text-sm text-foreground/70">{t('orgComplianceSender.effect')}</p>
          {read.propertyOverrides > 0 ? <Alert variant="info">{t('orgComplianceSender.overrides', { count: read.propertyOverrides })}</Alert> : null}
          {needsConsent ? (
            <div className="space-y-3 rounded-lg bg-muted p-4">
              {textKey ? <>
                <details><summary className="min-h-11 cursor-pointer font-medium">{t('compliance.sender.delegation.title')}</summary><p className="whitespace-pre-line text-sm">{t(textKey)}</p></details>
                <div className="flex items-start gap-3"><Checkbox id="org-sender-consent" checked={consent} onCheckedChange={(value) => setConsent(value === true)} /><Label htmlFor="org-sender-consent" className="min-h-11 leading-snug">{t('compliance.sender.delegation.consent')}</Label></div>
              </> : <Alert variant="warning">{t('compliance.sender.delegation.unknownVersion')}</Alert>}
            </div>
          ) : null}
          <div className="flex items-start gap-3"><Checkbox id="org-sender-confirm" checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} /><Label htmlFor="org-sender-confirm" className="min-h-11 leading-snug">{t('orgComplianceSender.confirm')}</Label></div>
          {save.isError ? <Alert variant="danger">{getProblemMessage(save.error, t) ?? t('orgComplianceSender.saveError')}</Alert> : null}
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" disabled={save.isPending} onClick={() => { setReview(false); setConfirmed(false); }}>{t('orgComplianceSender.back')}</Button>
            <Button loading={save.isPending} disabled={!confirmed || sender === null || (needsConsent && (!consent || !textKey))} onClick={() => { if (sender) save.mutate({ sender, confirmed, expectedLastChangedAt: read.lastChangedAt, autoSendGuestsToOctorate: sender === 'ChannelManager' && autoSend !== read.autoSendGuestsToOctorate ? autoSend : undefined, delegationConsent: needsConsent && consent, delegationTextVersion: needsConsent ? read.delegationTextVersion : undefined }); }}>{t('orgComplianceSender.save')}</Button>
          </div>
        </div>
      )}
      <details className="border-t pt-4 text-sm">
        <summary className="min-h-11 cursor-pointer font-medium">{t('orgComplianceSender.accountsTitle')}</summary>
        <p className="max-w-prose text-foreground/70">{t('orgComplianceSender.accounts')}</p>
        <a className="mt-3 inline-block underline underline-offset-4" href="https://alloggiatiweb.poliziadistato.it/PortaleAlloggiati/Download/Manuali/manuale.pdf" target="_blank" rel="noreferrer">{t('orgComplianceSender.source')}</a>
      </details>
    </section>
  );
}
