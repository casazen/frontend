import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { UserManagementTable } from './components/user-management-table';
import { useUsers } from '@/queries/use-users';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

type ActiveFilter = '' | 'true' | 'false';

export function AdminUsersPage() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [isActive, setIsActive] = useState<ActiveFilter>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const { data, isLoading, isError, refetch } = useUsers({
    search: search || undefined,
    role: role || undefined,
    isActive: isActive === '' ? undefined : isActive === 'true',
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = data ? Math.ceil(data.totalCount / PAGE_SIZE) : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.users.title')}
        description={t('admin.users.description')}
        action={<Button asChild><Link to="/app/admin/suppliers/invite?type=host">{t('admin.staffInvite.inviteUser')}</Link></Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.users.filters')}</CardTitle>
        </CardHeader>
        <CardContent className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,2fr)_1fr_1fr]">
          <Field label={t('admin.users.searchPlaceholder')}>
            <Input
              placeholder={t('admin.users.searchPlaceholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              type="search"
            />
          </Field>
          <Field label={t('admin.users.table.role')}>
            <Select
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
              <option value="Supplier">{t('roles.Supplier')}</option>
              <option value="None">{t('roles.None')}</option>
            </Select>
          </Field>
          <Field label={t('admin.users.table.status')}>
            <Select
              value={isActive}
              onChange={(e) => { setIsActive(e.target.value as ActiveFilter); setPage(1); }}
            >
              <option value="">{t('admin.users.filter.allStatuses')}</option>
              <option value="true">{t('admin.users.filter.active')}</option>
              <option value="false">{t('admin.users.filter.inactive')}</option>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isError ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-destructive">{t('admin.users.loadError')}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                {t('admin.users.retry')}
              </Button>
            </div>
          ) : (
            <>
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
