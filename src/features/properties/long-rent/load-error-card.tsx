import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getProblemMessage } from '@/lib/api-errors';

interface LoadErrorCardProps {
  error: unknown;
  fallbackKey: string;
  onRetry: () => void;
  retrying?: boolean;
  testId?: string;
}

/** A failed load, with the server's reason and a retry: never shown as an empty list (A7-06). */
export function LoadErrorCard({ error, fallbackKey, onRetry, retrying, testId }: LoadErrorCardProps) {
  const { t } = useTranslation();
  return (
    <Card role="alert" data-testid={testId}>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{getProblemMessage(error, t) ?? t(fallbackKey)}</p>
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          {t('longRentProperties.retry')}
        </Button>
      </CardContent>
    </Card>
  );
}
