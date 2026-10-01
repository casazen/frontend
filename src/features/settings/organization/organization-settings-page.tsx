import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Info, ShieldAlert } from 'lucide-react';
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
import { translateErrorCode } from '@/lib/api-errors';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { useCurrentUser } from '@/queries/use-users';
import type { OrgSettings } from '@/types';
import {
  SLUG_CHECK_DEBOUNCE_MS,
  useDebouncedValue,
  useOrgSettings,
  useOrgSlugAvailability,
  useUpdateOrgSettings,
} from './use-org-settings';

type OrgSettingsForm = Pick<OrgSettings, 'name' | 'slug' | 'contactEmail' | 'contactEmailPublic'>;
type FieldErrors = Partial<Record<'name' | 'slug' | 'contactEmail', string>>;

/** Page of the public site's branding: logo, hero, color, tagline, theme (BK-12). */
const SITE_APPEARANCE_PATH = '/app/short-rent/settings/site-appearance';

/** Route prefix of an org's public booking site (a path, not text to translate). */
const PUBLIC_PATH_PREFIX = '/book/';

/** Same shape the backend accepts ([EmailAddress]): one `@` with text on both sides; the server validates again. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

/** Translation keys of the client-side checks; the server validates again and answers with its own message. */
function validate(form: OrgSettingsForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = 'orgSettings.errors.nameRequired';
  if (!form.slug.trim()) errors.slug = 'orgSettings.errors.slugRequired';
  if (!form.contactEmail.trim()) errors.contactEmail = 'orgSettings.errors.contactEmailRequired';
  else if (!EMAIL_PATTERN.test(form.contactEmail.trim())) errors.contactEmail = 'orgSettings.errors.contactEmailInvalid';
  return errors;
}

/** Org identity settings (US-004 extension, A1-22, A1-23) in the short-rent shell. */
export function OrganizationSettingsPage() {
  return (
    <AppShell>
      <OrganizationSettingsContent showSiteAppearanceLink />
    </AppShell>
  );
}

/**
 * Content of the org settings page, without a shell: the short-rent route wraps it in its shell
 * ({@link OrganizationSettingsPage}), the long-rent route gets the long-rent shell from the context layout.
 */
export function OrganizationSettingsContent({
  showSiteAppearanceLink = false,
}: {
  /** Short-rent shell only: the public booking site (and its branding page) belongs to short-term rentals. */
  showSiteAppearanceLink?: boolean;
}) {
  const { t } = useTranslation();
  const { contexts } = useWorkspace();
  const isAdmin = isOrgBillingAdmin(contexts);
  const { user } = useCurrentUser();
  const settingsQuery = useOrgSettings(isAdmin);
  const updateSettings = useUpdateOrgSettings();

  const [form, setForm] = useState<OrgSettingsForm>({
    name: '',
    slug: '',
    contactEmail: '',
    contactEmailPublic: false,
  });
  const [submitted, setSubmitted] = useState(false);
  // Sync the form from the server settings whenever they (re)load (adjusting state during render).
  const [synced, setSynced] = useState<OrgSettings | undefined>(undefined);
  if (settingsQuery.data !== synced) {
    setSynced(settingsQuery.data);
    if (settingsQuery.data) {
      const { name, slug, contactEmail, contactEmailPublic } = settingsQuery.data;
      setForm({ name, slug, contactEmail, contactEmailPublic });
      setSubmitted(false);
    }
  }

  const savedSlug = settingsQuery.data?.slug;
  const typedSlug = form.slug.trim();
  const slugChanged = savedSlug !== undefined && typedSlug !== savedSlug;
  const debouncedSlug = useDebouncedValue(typedSlug, SLUG_CHECK_DEBOUNCE_MS);
  const availabilityQuery = useOrgSlugAvailability(debouncedSlug, isAdmin && slugChanged && debouncedSlug === typedSlug);
  const slugUnavailable = slugChanged && availabilityQuery.data?.available === false;

  const fieldErrors = submitted ? validate(form) : {};

  if (user && needsOrgSetup(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  const handleSave = () => {
    setSubmitted(true);
    if (Object.keys(validate(form)).length > 0) return;
    updateSettings.mutate({
      name: form.name.trim(),
      slug: typedSlug,
      contactEmail: form.contactEmail.trim(),
      contactEmailPublic: form.contactEmailPublic,
    });
  };

  const renderSlugStatus = () => {
    if (!slugChanged || !typedSlug) return null;
    if (debouncedSlug !== typedSlug || availabilityQuery.isPending) {
      return (
        <p className="text-sm text-muted-foreground" data-testid="org-slug-checking">
          {t('orgSettings.slugChecking')}
        </p>
      );
    }
    if (availabilityQuery.isError) {
      return (
        <p className="text-sm text-muted-foreground" data-testid="org-slug-check-failed">
          {t('orgSettings.slugCheckFailed')}
        </p>
      );
    }
    const availability = availabilityQuery.data;
    if (!availability) return null;
    if (availability.available) {
      return (
        <p className="text-sm text-emerald-700" data-testid="org-slug-available">
          {t('orgSettings.slugAvailable', { path: `${PUBLIC_PATH_PREFIX}${availability.slug}` })}
        </p>
      );
    }
    return (
      <p className="text-sm text-destructive" role="alert" data-testid="org-slug-unavailable">
        {translateErrorCode(availability.code, t) ?? t('orgSettings.slugUnavailable')}
      </p>
    );
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
              aria-invalid={fieldErrors.name ? true : undefined}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            {fieldErrors.name ? (
              <p className="text-sm text-destructive" data-testid="org-name-error">
                {t(fieldErrors.name)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-slug">{t('orgSettings.slugLabel')}</Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground" aria-hidden>
                {PUBLIC_PATH_PREFIX}
              </span>
              <Input
                id="org-slug"
                data-testid="org-slug-input"
                value={form.slug}
                maxLength={100}
                aria-invalid={fieldErrors.slug || slugUnavailable ? true : undefined}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <p className="text-sm text-muted-foreground">{t('orgSettings.slugHelp')}</p>
            {fieldErrors.slug ? (
              <p className="text-sm text-destructive" data-testid="org-slug-error">
                {t(fieldErrors.slug)}
              </p>
            ) : (
              renderSlugStatus()
            )}
            {slugChanged && typedSlug ? (
              <div
                className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm"
                data-testid="org-slug-change-notice"
              >
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <p>{t('orgSettings.slugChangeNotice', { previous: `${PUBLIC_PATH_PREFIX}${savedSlug}` })}</p>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-contact-email">{t('orgSettings.contactEmailLabel')}</Label>
            <Input
              id="org-contact-email"
              data-testid="org-contact-email-input"
              type="email"
              value={form.contactEmail}
              maxLength={255}
              aria-invalid={fieldErrors.contactEmail ? true : undefined}
              onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
            />
            <p className="text-sm text-muted-foreground">{t('orgSettings.contactEmailHelp')}</p>
            {fieldErrors.contactEmail ? (
              <p className="text-sm text-destructive" data-testid="org-contact-email-error">
                {t(fieldErrors.contactEmail)}
              </p>
            ) : null}
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
            onClick={handleSave}
            disabled={updateSettings.isPending || slugUnavailable}
            data-testid="save-org-settings"
          >
            {t('orgSettings.save')}
          </Button>

          {/* The public site's branding has its own page in the short-rent shell (BK-12). */}
          {showSiteAppearanceLink ? (
            <p className="border-t pt-4 text-sm text-muted-foreground" data-testid="org-settings-site-appearance-hint">
              {t('orgSettings.siteAppearanceHint')}{' '}
              <Link to={SITE_APPEARANCE_PATH} className="underline">
                {t('orgSettings.siteAppearanceLink')}
              </Link>
            </p>
          ) : null}
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
