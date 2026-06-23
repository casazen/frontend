import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useLegalDocuments } from '@/queries/use-legal';
import type { OnboardingConsentsPayload } from '@/types/onboarding.types';

interface ConsentsStepProps {
  onBack: () => void;
  onContinue: (consents: OnboardingConsentsPayload) => void;
  isLoading?: boolean;
}

export function ConsentsStep({ onBack, onContinue, isLoading }: ConsentsStepProps) {
  const { tos, privacy, dpa, subprocessors, isLoading: docsLoading, isError } = useLegalDocuments();
  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [dpaAccepted, setDpaAccepted] = useState(false);
  const [subprocessorsAcknowledged, setSubprocessorsAcknowledged] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  if (docsLoading) {
    return <LoadingScreen message="Caricamento documenti legali..." />;
  }

  if (isError || !tos || !privacy || !dpa || !subprocessors) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Impossibile caricare i documenti legali. Riprova tra qualche istante.
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
          <CardTitle>Documenti legali</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ConsentRow
            id="tos"
            checked={tosAccepted}
            onCheckedChange={setTosAccepted}
            label={`Accetto i ${tos.title} (v${tos.version})`}
            summary={tos.summary}
          />
          <ConsentRow
            id="privacy"
            checked={privacyAccepted}
            onCheckedChange={setPrivacyAccepted}
            label={`Accetto l'${privacy.title} (v${privacy.version})`}
            summary={privacy.summary}
          />
          <ConsentRow
            id="dpa"
            checked={dpaAccepted}
            onCheckedChange={setDpaAccepted}
            label={`Accetto il ${dpa.title} (v${dpa.version})`}
            summary={dpa.summary}
          />
          <div className="rounded-md border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="subprocessors"
                checked={subprocessorsAcknowledged}
                onCheckedChange={(value) => setSubprocessorsAcknowledged(value === true)}
              />
              <Label htmlFor="subprocessors" className="leading-relaxed cursor-pointer">
                Ho preso visione dell&apos;elenco dei responsabili del trattamento (v
                {subprocessors.version})
              </Label>
            </div>
            <ul className="ml-8 list-disc text-sm text-muted-foreground space-y-1">
              {subprocessors.items.map((item) => (
                <li key={item.name}>
                  {item.name} — {item.purpose} ({item.region})
                </li>
              ))}
            </ul>
          </div>
          <ConsentRow
            id="marketing"
            checked={marketingOptIn}
            onCheckedChange={setMarketingOptIn}
            label="Desidero ricevere aggiornamenti e novità (opzionale)"
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={isLoading}>
          Indietro
        </Button>
        <Button
          type="button"
          data-testid="onboarding-consents-continue"
          disabled={!allRequired || isLoading}
          onClick={handleContinue}
        >
          Continua
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
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: string;
  summary?: string;
}) {
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
      </div>
    </div>
  );
}
