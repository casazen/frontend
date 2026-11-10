import type { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { TenantAreaShell } from '@/features/tenant-area/tenant-area-shell';
import { TenantContractPage, TenantContractsPage } from '@/features/tenant-area/tenant-contract-page';
import { TenantDocumentsPage } from '@/features/tenant-area/tenant-documents-page';
import { TenantDuesPage } from '@/features/tenant-area/tenant-dues-page';
import { TenantMaintenanceRequestPage } from '@/features/maintenance-requests/tenant-wizard';
import {
  TenantMaintenanceDetailPage,
  TenantMaintenanceFormPage,
  TenantMaintenanceListPage,
} from '@/features/tenant-area/tenant-maintenance-pages';

/**
 * Tenant area (CondoLedger phase 1B). Authenticated, and limited by the API to the contracts of the signed-in tenant.
 * It is not a context of the landlord console.
 */
export const tenantAreaRoutes: RouteObject[] = [
  {
    path: '/portale-conduttore',
    element: (
      <ProtectedRoute>
        <TenantAreaShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <TenantContractsPage /> },
      { path: 'contratti/:leaseId', element: <TenantContractPage /> },
      { path: 'contratti/:leaseId/scadenze/:dueId?', element: <TenantDuesPage /> },
      { path: 'contratti/:leaseId/documenti', element: <TenantDocumentsPage /> },
      { path: 'contratti/:leaseId/manutenzione', element: <TenantMaintenanceListPage /> },
      { path: 'contratti/:leaseId/manutenzione/nuova', element: <TenantMaintenanceFormPage /> },
      { path: 'contratti/:leaseId/manutenzione/:requestId', element: <TenantMaintenanceDetailPage /> },
    ],
  },
  {
    path: '/portale-conduttore/contratti/:leaseId/richiesta-manutenzione',
    element: (
      <ProtectedRoute>
        <TenantMaintenanceRequestPage />
      </ProtectedRoute>
    ),
  },
];
