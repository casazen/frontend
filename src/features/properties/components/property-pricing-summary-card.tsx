import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PricingAdapterSummaryDto } from '@/types';
import { formatDateTime } from '@/lib/utils';
import { ArrowRight, Sparkles } from 'lucide-react';

interface PropertyPricingSummaryCardProps {
  propertyId: string;
  summary: PricingAdapterSummaryDto;
}

export function PropertyPricingSummaryCard({ propertyId, summary }: PropertyPricingSummaryCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          {t('property.pricing.title')}
        </CardTitle>
        <Badge variant={summary.isEnabled ? 'success' : 'secondary'}>
          {summary.isEnabled ? t('property.pricing.on') : t('property.pricing.off')}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('property.pricing.lastAdaptation')}</span>
            <span>{summary.lastAdaptedAt ? formatDateTime(summary.lastAdaptedAt) : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('property.pricing.nextRun')}</span>
            <span>{summary.nextScheduledRunAt ? formatDateTime(summary.nextScheduledRunAt) : '—'}</span>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate(`/properties/${propertyId}/pricing`)}
        >
          {t('property.pricing.manage')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
