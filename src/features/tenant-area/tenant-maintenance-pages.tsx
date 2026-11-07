import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/shared/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { formatDate } from '@/lib/utils';
import { useCreateTenantMaintenance, useTenantMaintenance, useTenantMaintenanceRequest } from '@/queries/use-tenant-area';
import type { TenantMaintenanceUrgency } from '@/types';
import { TenantGate } from './tenant-gate';
import { tenantMaintenancePath } from './paths';
import { useLeaseId, useTenantContractPage } from './use-tenant-contract';

const URGENCIES: TenantMaintenanceUrgency[] = ['Normal', 'High', 'Emergency'];
const FALLBACK_CATEGORIES = ['maintenance', 'plumbing', 'electrical', 'cleaning'];

export function TenantMaintenanceListPage() {
  const { t } = useTranslation();
  const leaseId = useLeaseId();
  const list = useTenantMaintenance(leaseId);

  if (list.isLoading) return <p data-testid="tenant-loading">{t('tenantArea.loading')}</p>;
  if (list.isError) {
    return <ErrorState title={t('tenantArea.loadError')} error={list.error} onRetry={() => void list.refetch()} testId="tenant-error" />;
  }

  const items = list.data ?? [];
  return (
    <div className="space-y-4" data-testid="tenant-maintenance">
      <Button asChild>
        <Link to={tenantMaintenancePath(leaseId, 'nuova')}>{t('tenantArea.maintenance.new')}</Link>
      </Button>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">{t('tenantArea.maintenance.empty')}</p> : null}
      <ul className="space-y-2">
        {items.map((request) => (
          <li key={request.id}>
            <Link to={tenantMaintenancePath(leaseId, request.id)} className="block rounded-md border border-border p-3" data-testid={`tenant-request-${request.id}`}>
              <span className="font-medium">{getServiceCategoryLabel(request.category, t)}</span>
              <span className="ml-2 text-sm" data-testid="tenant-request-status">
                {t(`tenantArea.maintenance.status.${request.status}`)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TenantMaintenanceFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const page = useTenantContractPage();
  const create = useCreateTenantMaintenance(page.leaseId);
  const [category, setCategory] = useState('');
  const [urgency, setUrgency] = useState<TenantMaintenanceUrgency>('Normal');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  if (page.status !== 'ready') return <TenantGate status={page.status} error={page.error} refetch={page.refetch} />;
  const area = page.area;
  const categories = area.maintenanceCategories.length > 0 ? area.maintenanceCategories : FALLBACK_CATEGORIES;
  const selected = categories.includes(category) ? category : categories[0];
  const emergency = urgency === 'Emergency';

  return (
    <form
      className="space-y-4"
      data-testid="tenant-maintenance-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!selected || description.trim() === '' || create.isPending) return;
        create.mutate(
          { category: selected, urgency, description: description.trim(), attachments: files },
          { onSuccess: (request) => navigate(tenantMaintenancePath(area.contract.id, request.id)) },
        );
      }}
    >
      <p className="text-sm text-muted-foreground">{t('tenantArea.maintenance.sentToManager')}</p>
      <div className="space-y-1">
        <Label htmlFor="tenant-maintenance-category">{t('tenantArea.maintenance.category')}</Label>
        <select
          id="tenant-maintenance-category"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={selected}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categories.map((code) => (
            <option key={code} value={code}>
              {getServiceCategoryLabel(code, t)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="tenant-maintenance-urgency">{t('tenantArea.maintenance.urgency')}</Label>
        <select
          id="tenant-maintenance-urgency"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={urgency}
          onChange={(event) => setUrgency(event.target.value as TenantMaintenanceUrgency)}
        >
          {URGENCIES.map((value) => (
            <option key={value} value={value}>
              {t(`tenantArea.maintenance.urgencyLevel.${value}`)}
            </option>
          ))}
        </select>
      </div>
      {emergency ? (
        <div className="space-y-2 rounded-md border border-border p-3 text-sm" data-testid="tenant-emergency">
          <p>{t('tenantArea.maintenance.emergencyNotImmediate')}</p>
          {area.emergency?.instructions ? <p>{area.emergency.instructions}</p> : null}
          {area.emergency?.contacts.map((contact) => (
            <p key={`${contact.name}-${contact.phone}`}>
              {contact.name}: {contact.phone}
            </p>
          ))}
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="tenant-maintenance-description">{t('tenantArea.maintenance.description')}</Label>
        <Textarea id="tenant-maintenance-description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tenant-maintenance-files">{t('tenantArea.maintenance.attachments')}</Label>
        <Input id="tenant-maintenance-files" type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
      </div>
      <Button type="submit" disabled={description.trim() === '' || create.isPending} data-testid="tenant-maintenance-submit">
        {t('tenantArea.maintenance.submit')}
      </Button>
    </form>
  );
}

export function TenantMaintenanceDetailPage() {
  const { t } = useTranslation();
  const leaseId = useLeaseId();
  const { requestId = '' } = useParams();
  const request = useTenantMaintenanceRequest(leaseId, requestId);

  if (request.isLoading) return <p data-testid="tenant-loading">{t('tenantArea.loading')}</p>;
  if (request.isError || !request.data) {
    return <ErrorState title={t('tenantArea.loadError')} error={request.error} onRetry={() => void request.refetch()} testId="tenant-error" />;
  }

  const item = request.data;
  return (
    <Card data-testid="tenant-maintenance-detail">
      <CardHeader>
        <CardTitle className="text-base">{getServiceCategoryLabel(item.category, t)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p data-testid="tenant-request-status">{t(`tenantArea.maintenance.status.${item.status}`)}</p>
        <p>{t(`tenantArea.maintenance.urgencyLevel.${item.urgency in { Normal: 1, High: 1, Emergency: 1 } ? item.urgency : 'Normal'}`)}</p>
        <p>{item.description}</p>
        {item.submittedAt ? <p>{t('tenantArea.maintenance.submittedAt', { date: formatDate(item.submittedAt) })}</p> : null}
        <p className="text-muted-foreground">{t('tenantArea.maintenance.sentToManager')}</p>
        {item.urgency === 'Emergency' ? <p>{t('tenantArea.maintenance.emergencyNotImmediate')}</p> : null}
        {item.attachments.length > 0 ? (
          <ul>
            {item.attachments.map((file) => (
              <li key={file.id}>{file.name}</li>
            ))}
          </ul>
        ) : null}
        {item.updates.length > 0 ? (
          <ul className="space-y-2" data-testid="tenant-request-updates">
            {item.updates.map((update) => (
              <li key={update.id} className="rounded-md bg-muted p-2">
                {update.text}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
