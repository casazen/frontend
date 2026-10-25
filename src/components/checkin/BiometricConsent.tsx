import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface BiometricConsentProps {
  onConsent: () => void;
  onDecline: () => void;
  isLoading?: boolean;
}

/**
 * Biometric consent screen, separate from privacy notice and marketing consent per ADR-013-R9.
 * Decline option escalates to operator (non-blocking) per ADR-013-R9.
 */
export function BiometricConsent({ onConsent, onDecline, isLoading = false }: BiometricConsentProps) {
  const { t } = useTranslation();
  const consentVersion = '1.0';

  const handleConsent = () => {
    onConsent();
  };

  const handleDecline = () => {
    onDecline();
  };

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>{t('checkin.biometric.consent.title')}</CardTitle>
        <CardDescription>
          {t('checkin.biometric.consent.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-lg bg-muted p-4">
          <h3 className="mb-2 font-medium">{t('checkin.biometric.consent.purposeTitle')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('checkin.biometric.consent.purpose')}
          </p>
        </div>

        <div className="rounded-lg bg-muted p-4">
          <h3 className="mb-2 font-medium">{t('checkin.biometric.consent.optionalTitle')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('checkin.biometric.consent.optional')}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
          <Button
            onClick={handleConsent}
            disabled={isLoading}
            className="sm:min-w-[160px]"
          >
            {t('checkin.biometric.consent.accept')}
          </Button>
          <Button
            variant="outline"
            onClick={handleDecline}
            disabled={isLoading}
            className="sm:min-w-[160px]"
          >
            {t('checkin.biometric.consent.decline')}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('checkin.biometric.consent.version', { version: consentVersion })}
        </p>
      </CardContent>
    </Card>
  );
}
