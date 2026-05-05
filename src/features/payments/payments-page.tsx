import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Clock, RotateCcw, Loader2 } from 'lucide-react';
import { usePayments } from '@/queries/use-payments';

const PAY_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Completed: 'default',
  Pending: 'secondary',
  Processing: 'secondary',
  Failed: 'destructive',
  Refunded: 'outline',
  PartiallyRefunded: 'outline',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMethod(method: string): string {
  return method.replace(/([A-Z])/g, ' $1').trim();
}

export function PaymentsPage() {
  const { data: payments, isLoading, isError } = usePayments();

  const completed = (payments ?? []).filter((p) => p.status === 'Completed');
  const pending = (payments ?? []).filter((p) => p.status === 'Pending' || p.status === 'Processing');
  const refunded = (payments ?? []).filter((p) => p.status === 'Refunded' || p.status === 'PartiallyRefunded');

  const totalRevenue = completed.reduce((s, p) => s + p.amount, 0);
  const totalPending = pending.reduce((s, p) => s + p.amount, 0);
  const totalRefunded = refunded.reduce((s, p) => s + (p.refundedAmount ?? p.amount), 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="Payments" description="Track revenue, transactions and refunds" />

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€{totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Completed payments</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/10">
                <Clock className="h-4 w-4 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€{totalPending.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting settlement</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Refunded</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€{totalRefunded.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Total refunded</p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading payments...</span>
              </div>
            )}

            {isError && (
              <div className="py-8 text-center text-destructive px-4">
                Failed to load payments. Please try again.
              </div>
            )}

            {!isLoading && !isError && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      {['Payment ID', 'Booking ID', 'Amount', 'Method', 'Date', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(payments ?? []).map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs">{p.id.slice(0, 8)}…</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.bookingId.slice(0, 8)}…</td>
                        <td className="px-4 py-3 font-medium">
                          {p.currency ?? 'EUR'} {p.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatMethod(p.method)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(p.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={PAY_STATUS_VARIANT[p.status] ?? 'secondary'} className="capitalize">
                            {p.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {(payments ?? []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          No payments found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
