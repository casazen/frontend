import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PricingHistoryPagedResponse, PricingOtaSyncStatus } from '@/types';

const SYNC_STATUS_VARIANT: Record<PricingOtaSyncStatus, 'success' | 'warning' | 'destructive'> = {
  synced: 'success',
  partial: 'warning',
  failed: 'destructive',
};

interface PricingHistoryTableProps {
  data: PricingHistoryPagedResponse | undefined;
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function PricingHistoryTable({
  data,
  isLoading,
  page,
  pageSize,
  onPageChange,
}: PricingHistoryTableProps) {
  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  if (isLoading) {
    return (
      <div className="space-y-2" data-testid="history-loading">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground" data-testid="history-empty">
        No price adaptation history found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Prev Price</th>
              <th className="px-4 py-3 text-right font-medium">New Price</th>
              <th className="px-4 py-3 text-right font-medium">Δ%</th>
              <th className="px-4 py-3 text-left font-medium">Reason</th>
              <th className="px-4 py-3 text-right font-medium">Confidence</th>
              <th className="px-4 py-3 text-left font-medium">OTA Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((entry) => {
              const delta = entry.previousPrice > 0
                ? ((entry.newPrice - entry.previousPrice) / entry.previousPrice) * 100
                : 0;
              return (
                <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatDate(entry.adaptationDate)}
                  </td>
                  <td className="px-4 py-2 text-right">{formatCurrency(entry.previousPrice)}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(entry.newPrice)}</td>
                  <td
                    className={`px-4 py-2 text-right text-xs font-medium ${
                      delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-muted-foreground'
                    }`}
                  >
                    {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-muted-foreground max-w-xs truncate">
                    {entry.changeReason}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {(entry.aiConfidence * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={SYNC_STATUS_VARIANT[entry.syncStatus]} className="capitalize">
                      {entry.syncStatus}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} of {totalPages} ({data.total} entries)</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
