import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Clock, RotateCcw } from 'lucide-react';

const PAYMENTS = [
  { id: 'PAY-1021', booking: 'BK-00421', guest: 'Marco Rossi', amount: 1500, status: 'completed', method: 'stripe', date: '2025-06-01' },
  { id: 'PAY-1022', booking: 'BK-00422', guest: 'Anna Bianchi', amount: 975, status: 'pending', method: 'stripe', date: '2025-06-10' },
  { id: 'PAY-1023', booking: 'BK-00423', guest: 'Luca Ferrari', amount: 480, status: 'completed', method: 'bank_transfer', date: '2025-06-05' },
  { id: 'PAY-1020', booking: 'BK-00420', guest: 'Sofia Greco', amount: 1500, status: 'refunded', method: 'stripe', date: '2025-05-25' },
  { id: 'PAY-1019', booking: 'BK-00419', guest: 'Paolo Conti', amount: 1280, status: 'completed', method: 'stripe', date: '2025-05-15' },
];

const PAY_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  completed: 'default',
  pending: 'secondary',
  failed: 'destructive',
  refunded: 'outline',
  processing: 'secondary',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PaymentsPage() {
  const totalRevenue = PAYMENTS.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
  const totalPending = PAYMENTS.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const totalRefunded = PAYMENTS.filter((p) => p.status === 'refunded').reduce((s, p) => s + p.amount, 0);

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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {['Payment ID', 'Booking', 'Guest', 'Amount', 'Method', 'Date', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PAYMENTS.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{p.id}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.booking}</td>
                      <td className="px-4 py-3 font-medium">{p.guest}</td>
                      <td className="px-4 py-3 font-medium">€{p.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{p.method.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(p.date)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={PAY_STATUS_VARIANT[p.status] ?? 'secondary'} className="capitalize">
                          {p.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
