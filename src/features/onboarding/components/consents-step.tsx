import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useLegalDocuments } from '@/queries/use-legal';
import { LEGAL_DOCUMENT_PATHS, LEGAL_SUBPROCESSORS_PATH } from '@/features/legal/legal-paths';
import { SubprocessorPurpose } from '@/features/legal/subprocessor-purpose';
import type { LegalDocumentMeta, OnboardingConsentsPayload } from '@/types/onboarding.types';

interface ConsentsStepProps {
  onBack: () => void;
  onContinue: (consents: OnboardingConsentsPayload) => void;
  isLoading?: boolean;
}

export function ConsentsStep({ onBack, onContinue, isLoading }: ConsentsStepProps) {
  const { t } = useTranslation();
  const {
    tos,
    privacy,
    dpa,
    subprocessors,
    isLoading: docsLoading,
    isError,
    isRetrying,
    retry,
  } = useLegalDocuments();
  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [dpaAccepted, setDpaAccepted] = useState(false);
  const [subprocessorsAcknowledged, setSubprocessorsAcknowledged] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  if (docsLoading) {
    return <LoadingScreen message={t('onboarding.loadingLegalDocs')} />;
  }

  if (isError || !tos || !privacy || !dpa || !subprocessors) {
    // A1-39: never a dead end, the documents can be loaded again or the user can go back.
    return (
      <Card data-testid="onboarding-consents-error">
        <CardContent className="space-y-4 py-8 text-center">
          <p role="alert" className="text-muted-foreground">
            {t('onboarding.cannotLoadLegalDocs')}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button type="button" variant="outline" onClick={onBack} disabled={isLoading}>
              {t('onboarding.back')}
            </Button>
            <Button type="button" data-testid="onboarding-consents-retry" onClick={retry} disabled={isRetrying}>
              {isRetrying ? t('onboarding.loadingLegalDocs') : t('onboarding.retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const allRequired =
    tosAccepted && privacyAccepted && dpaAccepted && subprocessorsAcknowledged;

  const handleContinue = () => {
    if (!allRequired) return;
    onContinue({
      tosAccepted: true,
      tosVersion: tos.version,
      privacyAccepted: true,
      privacyVersion: privacy.version,
      dpaAccepted: true,
      dpaVersion: dpa.version,
      subprocessorsAcknowledged: true,
      subprocessorsVersion: subprocessors.version,
      marketingOptIn: marketingOptIn || undefined,
    });
  };

  return (
    <div className="space-y-6 text-left" data-testid="onboarding-consents-step">
      <Card>
        <CardHeader>
          <CardTitle>{t('onboarding.legalDocuments')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ConsentRow
            id="tos"
            checked={tosAccepted}
            onCheckedChange={setTosAccepted}
            label={t('onboarding.acceptTos', { title: t('legal.documents.tos.title'), version: tos.version })}
            summary={t('legal.documents.tos.summary')}
            document={tos}
            href={LEGAL_DOCUMENT_PATHS.tos}
          />
          <ConsentRow
            id="privacy"
            checked={privacyAccepted}
            onCheckedChange={setPrivacyAccepted}
            label={t('onboarding.acceptPrivacy', { title: t('legal.documents.privacy.title'), version: privacy.version })}
            summary={t('legal.documents.privacy.summary')}
            document={privacy}
            href={LEGAL_DOCUMENT_PATHS.privacy}
          />
          <ConsentRow
            id="dpa"
            checked={dpaAccepted}
            onCheckedChange={setDpaAccepted}
            label={t('onboarding.acceptDpa', { title: t('legal.documents.dpa.title'), version: dpa.version })}
            summary={t('legal.documents.dpa.summary')}
            document={dpa}
            href={LEGAL_DOCUMENT_PATHS.dpa}
          />
          <div className="rounded-md border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="subprocessors"
                checked={subprocessorsAcknowledged}
                onCheckedChange={(value) => setSubprocessorsAcknowledged(value === true)}
              />
              <Label htmlFor="subprocessors" className="leading-relaxed cursor-pointer">
                {t('onboarding.subprocessorsAcknowledged', { version: subprocessors.version })}
              </Label>
            </div>
            <ul className="ml-8 list-disc text-sm text-muted-foreground space-y-1">
              {subprocessors.items.map((item) => (
                <li key={item.name} data-testid={`subprocessor-${item.name}`}>
                  {item.name} — <SubprocessorPurpose item={item} />
                  {item.region ? ` (${item.region})` : ''}
                  {item.transferMechanism
                    ? ` — ${t('onboarding.subprocessorTransfer', { mechanism: item.transferMechanism })}`
                    : ''}
                  {item.detailsPending ? ` — ${t('onboarding.subprocessorDetailsPending')}` : ''}
                </li>
              ))}
            </ul>
            <a
              href={LEGAL_SUBPROCESSORS_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-8 text-sm underline"
              data-testid="consent-subprocessors-read"
            >
              {t('onboarding.readSubprocessors')}
            </a>
          </div>
          <ConsentRow
            id="marketing"
            checked={marketingOptIn}
            onCheckedChange={setMarketingOptIn}
            label={t('onboarding.marketingOptIn')}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={isLoading}>
          {t('onboarding.back')}
        </Button>
        <Button
          type="button"
          data-testid="onboarding-consents-continue"
          disabled={!allRequired || isLoading}
          onClick={handleContinue}
        >
          {t('onboarding.continue')}
        </Button>
      </div>
    </div>
  );
}

function ConsentRow({
  id,
  checked,
  onCheckedChange,
  label,
  summary,
  document,
  href,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: string;
  summary?: string;
  /** PL-14: the document the checkbox accepts, readable on its public page (new tab, the onboarding stays open). */
  document?: LegalDocumentMeta;
  href?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-3 rounded-md border p-4">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <div className="space-y-1">
        <Label htmlFor={id} className="leading-relaxed cursor-pointer">
          {label}
        </Label>
        {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : null}
        {href ? (
          <p className="text-sm">
            <a href={href} target="_blank" rel="noopener noreferrer" className="underline" data-testid={`consent-${id}-read`}>
              {t('onboarding.readDocument')}
            </a>
            {document && document.available === false ? (
              <span className="text-muted-foreground" data-testid={`consent-${id}-in-preparation`}>
                {' — '}
                {t('onboarding.documentInPreparation')}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
