import { useNavigate } from 'react-router-dom';
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Prezzi AI
        </CardTitle>
        <Badge variant={summary.isEnabled ? 'success' : 'secondary'}>
          {summary.isEnabled ? 'ON' : 'OFF'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ultimo adattamento</span>
            <span>{summary.lastAdaptedAt ? formatDateTime(summary.lastAdaptedAt) : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Prossima esecuzione</span>
            <span>{summary.nextScheduledRunAt ? formatDateTime(summary.nextScheduledRunAt) : '—'}</span>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate(`/properties/${propertyId}/pricing`)}
        >
          Gestisci prezzi AI
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
