import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download } from 'lucide-react';
import { usePricingHistory } from '@/queries/use-pricing-adapter';
import { pricingAdapterApi } from '@/api/pricing-adapter.api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { PricingHistoryTable } from './components/pricing-history-table';
import type { PricingHistoryEntry } from '@/types';

const PAGE_SIZE = 20;

function buildCsv(items: PricingHistoryEntry[]): string {
  const headers = ['Date', 'Previous Price', 'New Price', 'Delta%', 'Reason', 'AI Confidence', 'OTA Status'];
  const rows = items.map((e) => {
    const delta = e.previousPrice > 0
      ? ((e.newPrice - e.previousPrice) / e.previousPrice) * 100
      : 0;
    return [
      e.adaptationDate,
      e.previousPrice,
      e.newPrice,
      delta.toFixed(1),
      `"${e.changeReason.replace(/"/g, '""')}"`,
      (e.aiConfidence * 100).toFixed(0) + '%',
      e.syncStatus,
    ].join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

function triggerCsvDownload(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PricingHistoryPage() {
  const { id: propertyId } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const queryParams = {
    page,
    pageSize: PAGE_SIZE,
    ...(from && { from }),
    ...(to && { to }),
  };

  const { data, isLoading } = usePricingHistory(propertyId!, queryParams);

  function handleFromChange(value: string) {
    setFrom(value);
    setPage(1);
  }

  function handleToChange(value: string) {
    setTo(value);
    setPage(1);
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const result = await pricingAdapterApi.getHistory(propertyId!, {
        page: 1,
        pageSize: 1000,
        ...(from && { from }),
        ...(to && { to }),
      });
      if (!result) {
        toast.error('Failed to export pricing history');
        return;
      }
      const csv = buildCsv(result.items);
      const date = formatDate(new Date().toISOString(), 'yyyy-MM-dd');
      triggerCsvDownload(csv, `pricing-history-${date}.csv`);
    } catch {
      toast.error('Failed to export pricing history');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/properties/${propertyId}/pricing`} aria-label="Back to pricing">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <PageHeader
            title="Pricing Audit Trail"
            description="Full history of AI-driven price adaptations for compliance and review."
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Price Adaptation History</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isExporting}
                data-testid="export-btn"
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-from">From</Label>
                <Input
                  id="filter-from"
                  type="date"
                  value={from}
                  onChange={(e) => handleFromChange(e.target.value)}
                  className="w-40"
                  data-testid="filter-from"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-to">To</Label>
                <Input
                  id="filter-to"
                  type="date"
                  value={to}
                  onChange={(e) => handleToChange(e.target.value)}
                  className="w-40"
                  data-testid="filter-to"
                />
              </div>
            </div>

            <PricingHistoryTable
              data={data}
              isLoading={isLoading}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
