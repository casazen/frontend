import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRliAdvisory } from '@/queries/use-leases';
import { formatCurrency } from '@/lib/utils';

interface Props {
  leaseId: string;
}

export function CedolareDecisionPanel({ leaseId }: Props) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useRliAdvisory(leaseId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('leases.rli.advisoryTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading && <p>{t('leases.rli.advisoryLoading')}</p>}
        {isError && <p className="text-destructive">{t('leases.rli.advisoryError')}</p>}
        {data && (
          <>
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
              {data.disclaimer}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">{t('leases.rli.cedolareRate')}</p>
                <p className="font-medium">{(data.cedolareRate * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('leases.rli.cedolareEstimate')}</p>
                <p className="font-medium">{formatCurrency(data.cedolareEstimateEur)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('leases.rli.registroEstimate')}</p>
                <p className="font-medium">{formatCurrency(data.registroEstimateEur)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('leases.rli.bollo')}</p>
                <p className="font-medium">{formatCurrency(data.bolloEur)}</p>
              </div>
            </div>
            <p className="text-muted-foreground">{data.ordinaryIrpefNote}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
