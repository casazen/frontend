import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserManagementTable } from './components/user-management-table';
import { useUsers } from '@/queries/use-users';

const PAGE_SIZE = 20;

export function AdminUsersPage() {
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
        title="Gestione Utenti"
        description="Visualizza e gestisci tutti gli utenti del sistema"
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtri</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input
            placeholder="Cerca per nome o email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="max-w-xs"
          />
          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1); }}
          >
            <option value="">Tutti i ruoli</option>
            <option value="Admin">Admin</option>
            <option value="PropertyOwner">PropertyOwner</option>
            <option value="PropertyManager">PropertyManager</option>
            <option value="Guest">Guest</option>
            <option value="Staff">Staff</option>
            <option value="LongTermLandlord">LongTermLandlord</option>
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
                Pagina {page} di {totalPages} ({data?.totalCount ?? 0} utenti)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Precedente
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Successiva
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
