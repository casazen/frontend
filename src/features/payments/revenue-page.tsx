import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RevenueDashboard } from './components/revenue-dashboard';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useRevenue } from '@/queries/use-payments';
import { ArrowLeft } from 'lucide-react';

export function RevenuePage() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month' | 'year'>('month');

  const { data: analytics, isLoading } = useRevenue({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    groupBy,
  });

  return (
    <div className="space-y-6">
        <PageHeader
          title="Revenue Analytics"
          description="Track and analyze your revenue performance"
          action={
            <Button variant="outline" onClick={() => navigate('/app/short-rent/payments')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Payments
            </Button>
          }
        />

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="groupBy">Group By</Label>
                <select
                  id="groupBy"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setGroupBy('month');
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dashboard */}
        {isLoading ? (
          <LoadingScreen message="Loading analytics..." />
        ) : analytics ? (
          <RevenueDashboard analytics={analytics} />
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No revenue data available</p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
