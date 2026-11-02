import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Key } from 'lucide-react';

interface AccessCodeDisplayProps {
  code: string;
  propertyName?: string;
}

/**
 * Access code display component (NF-13, E06/F03/US01/T02).
 * Shows the property access code only after verification has passed (AC-NF13-4).
 * Includes disclosure that the code is not unique per stay (AC-NF13-10).
 */
export function AccessCodeDisplay({ code, propertyName }: AccessCodeDisplayProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Key className="size-8 text-primary" aria-hidden="true" />
          </div>
          <CardTitle>{t('checkin.access.code_title')}</CardTitle>
          {propertyName && (
            <CardDescription>{propertyName}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="rounded-lg bg-muted p-6 text-center"
            data-testid="access-code-display"
          >
            <p className="text-4xl font-bold tracking-wider font-mono">
              {code}
            </p>
          </div>

          <Alert variant="info" className="text-left">
            <p>{t('checkin.access.code_disclosure')}</p>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
