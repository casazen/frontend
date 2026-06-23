import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { GuestListTable } from './components/guest-list-table';
import { guestsApi } from '@/api/guests.api';
import { Search, Loader2, RefreshCw, Users } from 'lucide-react';

export function GuestsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const {
    data: guests,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['guests', search],
    queryFn: () => guestsApi.getAll(search || undefined),
  });

  const filtered = guests ?? [];

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('guests.title')}
          description={t('guests.search')}
        />

        <Card>
          <CardContent className="pt-4 space-y-4">
            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('guests.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">{t('shared.loading.defaultMessage')}</span>
              </div>
            )}

            {/* Error State */}
            {isError && !isLoading && (
              <div className="py-12 text-center">
                <p className="text-destructive mb-4">Failed to load guests.</p>
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
                  Retry
                </Button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !isError && filtered.length === 0 && (
              <EmptyState
                icon={Users}
                title={t('guests.title')}
                description={t('guests.empty')}
              />
            )}

            {/* Table */}
            {!isLoading && !isError && filtered.length > 0 && (
              <GuestListTable guests={filtered} />
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
