import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserManagementTable } from './components/user-management-table';
import { useUsers } from '@/queries/use-users';

const PAGE_SIZE = 20;

export function AdminUsersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useUsers({
    search: search || undefined,
    role: role || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = data ? Math.ceil(data.totalCount / PAGE_SIZE) : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.users.title')}
        description={t('admin.users.description')}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.users.filters')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input
            placeholder={t('admin.users.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="max-w-xs"
          />
          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1); }}
          >
            <option value="">{t('admin.users.filter.allRoles')}</option>
            <option value="Admin">{t('roles.Admin')}</option>
            <option value="PropertyOwner">{t('roles.PropertyOwner')}</option>
            <option value="PropertyManager">{t('roles.PropertyManager')}</option>
            <option value="Guest">{t('roles.Guest')}</option>
            <option value="Staff">{t('roles.Staff')}</option>
            <option value="LongTermLandlord">{t('roles.LongTermLandlord')}</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <UserManagementTable
            users={data?.items ?? []}
            isLoading={isLoading}
          />
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {t('admin.users.pagination', { page, totalPages, totalCount: data?.totalCount ?? 0 })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t('admin.users.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('admin.users.next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
