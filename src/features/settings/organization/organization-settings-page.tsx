import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useWorkspace } from '@/hooks/use-workspace';
import { needsOrgSetup } from '@/lib/onboarding';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { useCurrentUser } from '@/queries/use-users';
import type { OrgSettings } from '@/types';
import { useOrgSettings, useUpdateOrgSettings } from './use-org-settings';

/** Org identity settings (US-004 extension, A1-22, A1-23) in the short-rent shell. */
export function OrganizationSettingsPage() {
  return (
    <AppShell>
      <OrganizationSettingsContent />
    </AppShell>
  );
}

/**
 * Content of the org settings page, without a shell: the short-rent route wraps it in its shell
 * ({@link OrganizationSettingsPage}), the long-rent route gets the long-rent shell from the context layout.
 */
export function OrganizationSettingsContent() {
  const { t } = useTranslation();
  const { contexts } = useWorkspace();
  const isAdmin = isOrgBillingAdmin(contexts);
  const { user } = useCurrentUser();
  const settingsQuery = useOrgSettings(isAdmin);
  const updateSettings = useUpdateOrgSettings();

  const [form, setForm] = useState<{ name: string; slug: string; contactEmail: string; contactEmailPublic: boolean }>({
    name: '',
    slug: '',
    contactEmail: '',
    contactEmailPublic: false,
  });
  // Sync the form from the server settings whenever they (re)load (adjusting state during render).
  const [synced, setSynced] = useState<OrgSettings | undefined>(undefined);
  if (settingsQuery.data !== synced) {
    setSynced(settingsQuery.data);
    if (settingsQuery.data) {
      const { name, slug, contactEmail, contactEmailPublic } = settingsQuery.data;
      setForm({ name, slug, contactEmail, contactEmailPublic });
    }
  }

  if (user && needsOrgSetup(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  const handleSave = async () => {
    await updateSettings.mutateAsync(form);
  };

  const renderContent = () => {
    if (!isAdmin) {
      return (
        <div
          role="alert"
          data-testid="org-settings-admin-required"
          className="flex items-start gap-3 rounded-lg border bg-muted/40 p-6 text-sm"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">{t('orgSettings.adminRequired.title')}</p>
            <p className="text-muted-foreground">{t('orgSettings.adminRequired.description')}</p>
          </div>
        </div>
      );
    }

    if (settingsQuery.isPending) {
      return (
        <div className="space-y-4" data-testid="org-settings-loading">
          <Skeleton className="h-56 w-full" />
        </div>
      );
    }

    if (settingsQuery.isError) {
      return (
        <div
          role="alert"
          data-testid="org-settings-error"
          className="space-y-3 rounded-md border border-destructive/40 p-4 text-sm"
        >
          <p className="text-destructive">{t('orgSettings.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void settingsQuery.refetch()}>
            {t('shared.errorFallback.tryAgain')}
          </Button>
        </div>
      );
    }

    return (
      <Card data-testid="org-settings-form">
        <CardHeader>
          <CardTitle>{t('orgSettings.formTitle')}</CardTitle>
          <CardDescription>{t('orgSettings.formDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="org-name">{t('orgSettings.nameLabel')}</Label>
            <Input
              id="org-name"
              data-testid="org-name-input"
              value={form.name}
              maxLength={200}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-slug">{t('orgSettings.slugLabel')}</Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground" aria-hidden>/book/</span>
              <Input
                id="org-slug"
                data-testid="org-slug-input"
                value={form.slug}
                maxLength={100}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <p className="text-sm text-muted-foreground">{t('orgSettings.slugHelp')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-contact-email">{t('orgSettings.contactEmailLabel')}</Label>
            <Input
              id="org-contact-email"
              data-testid="org-contact-email-input"
              type="email"
              value={form.contactEmail}
              maxLength={255}
              onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-md border p-4">
            <div className="space-y-1">
              <Label htmlFor="org-contact-email-public">{t('orgSettings.contactEmailPublicLabel')}</Label>
              <p className="text-sm text-muted-foreground">{t('orgSettings.contactEmailPublicHelp')}</p>
            </div>
            <Switch
              id="org-contact-email-public"
              data-testid="org-contact-email-public-switch"
              checked={form.contactEmailPublic}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, contactEmailPublic: checked }))}
            />
          </div>

          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={updateSettings.isPending}
            data-testid="save-org-settings"
          >
            {t('orgSettings.save')}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="organization-settings-page">
      <PageHeader title={t('orgSettings.title')} description={t('orgSettings.description')} />
      {renderContent()}
    </div>
  );
}
