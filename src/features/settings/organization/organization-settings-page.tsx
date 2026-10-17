import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Info, ShieldAlert } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SkeletonLine } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useWorkspace } from '@/hooks/use-workspace';
import { needsOrgSetup } from '@/lib/onboarding';
import { translateErrorCode } from '@/lib/api-errors';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { useCurrentUser } from '@/queries/use-users';
import type { OrgSettings } from '@/types';
import { ORG_NAME_FIELD_ID } from './org-profile';
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

interface SlugStatusProps {
  /** The typed address is not the saved one: only then it is worth checking. */
  slugChanged: boolean;
  typedSlug: string;
  /** The typed address once it stopped changing: the one the check is about. */
  debouncedSlug: string;
  availability: ReturnType<typeof useOrgSlugAvailability>;
}

/** Whether the address being typed is free: checking, free, taken (and why), or not checked (the save checks again). */
function SlugStatus({ slugChanged, typedSlug, debouncedSlug, availability }: SlugStatusProps) {
  const { t } = useTranslation();

  if (!slugChanged || !typedSlug) return null;

  if (debouncedSlug !== typedSlug || availability.isPending) {
    return (
      <p className="text-sm text-foreground/70" data-testid="org-slug-checking">
        {t('orgSettings.slugChecking')}
      </p>
    );
  }
  if (availability.isError) {
    return (
      <p className="text-sm text-foreground/70" data-testid="org-slug-check-failed">
        {t('orgSettings.slugCheckFailed')}
      </p>
    );
  }
  const result = availability.data;
  if (!result) return null;
  if (result.available) {
    return (
      <p className="break-words text-sm text-[color:var(--color-success-foreground,#166534)]" data-testid="org-slug-available">
        {t('orgSettings.slugAvailable', { path: `${PUBLIC_PATH_PREFIX}${result.slug}` })}
      </p>
    );
  }
  return (
    <p className="break-words text-sm text-[color:var(--color-danger-foreground,#b4232a)]" role="alert" data-testid="org-slug-unavailable">
      {translateErrorCode(result.code, t) ?? t('orgSettings.slugUnavailable')}
    </p>
  );
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

  return (
    <div className="space-y-6" data-testid="organization-settings-page">
      <PageHeader title={t('orgSettings.title')} description={t('orgSettings.description')} crumbs="auto" />
      <div className={FOCUS_COLUMN}>
        <OrganizationSettings showSiteAppearanceLink={showSiteAppearanceLink} />
      </div>
    </div>
  );
}

/**
 * What the org says about itself: its name, the address of its booking site and the email that receives the messages of CasaZen, with
 * the choice of showing the email on the site. One form, one save (`PUT /api/orgs/me/settings`, the same fields and rules as ever,
 * for the org billing administrator alone). It tells loading, a failed read and a person who may not use it; the page that holds it
 * gives it a title.
 */
export function OrganizationSettings({ showSiteAppearanceLink = false }: { showSiteAppearanceLink?: boolean }) {
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

  if (!isAdmin) {
    return (
      <Alert
        variant="info"
        role="alert"
        icon={ShieldAlert}
        title={t('orgSettings.adminRequired.title')}
        data-testid="org-settings-admin-required"
      >
        {t('orgSettings.adminRequired.description')}
      </Alert>
    );
  }

  if (settingsQuery.isPending) {
    return (
      <div data-testid="org-settings-loading">
        <SkeletonLine lines={4} lineClassName="h-10" />
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <Alert
        variant="danger"
        data-testid="org-settings-error"
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => void settingsQuery.refetch()}>
            {t('shared.errorFallback.tryAgain')}
          </Button>
        }
      >
        {t('orgSettings.loadError')}
      </Alert>
    );
  }

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(validate(form)).length > 0) return;
    updateSettings.mutate({
      name: form.name.trim(),
      slug: typedSlug,
      contactEmail: form.contactEmail.trim(),
      contactEmailPublic: form.contactEmailPublic,
    });
  };

  return (
    <form onSubmit={handleSave} noValidate className="min-w-0 space-y-5" data-testid="org-settings-form">
      <Field label={t('orgSettings.nameLabel')} error={fieldErrors.name}>
        <Input
          id={ORG_NAME_FIELD_ID}
          data-testid="org-name-input"
          value={form.name}
          maxLength={200}
          autoComplete="organization"
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
        />
      </Field>

      <div className="space-y-1.5">
        <Field id="org-slug" label={t('orgSettings.slugLabel')} hint={t('orgSettings.slugHelp')} error={fieldErrors.slug}>
          {(control) => (
            <div className="flex items-center gap-1">
              <span className="shrink-0 text-sm text-foreground/70" aria-hidden="true">
                {PUBLIC_PATH_PREFIX}
              </span>
              <Input
                {...control}
                data-testid="org-slug-input"
                value={form.slug}
                maxLength={100}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={control['aria-invalid'] ?? (slugUnavailable ? true : undefined)}
                className="min-w-0 flex-1"
                onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              />
            </div>
          )}
        </Field>
        {fieldErrors.slug ? null : (
          <SlugStatus slugChanged={slugChanged} typedSlug={typedSlug} debouncedSlug={debouncedSlug} availability={availabilityQuery} />
        )}
        {slugChanged && typedSlug ? (
          <p className="flex items-start gap-2 text-sm text-foreground/70" data-testid="org-slug-change-notice">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{t('orgSettings.slugChangeNotice', { previous: `${PUBLIC_PATH_PREFIX}${savedSlug}` })}</span>
          </p>
        ) : null}
      </div>

      <Field label={t('orgSettings.contactEmailLabel')} hint={t('orgSettings.contactEmailHelp')} error={fieldErrors.contactEmail}>
        <Input
          id="org-contact-email"
          data-testid="org-contact-email-input"
          type="email"
          autoComplete="email"
          value={form.contactEmail}
          maxLength={255}
          onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))}
        />
      </Field>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="org-contact-email-public">{t('orgSettings.contactEmailPublicLabel')}</Label>
          <p id="org-contact-email-public-help" className="break-words text-sm text-foreground/70">
            {t('orgSettings.contactEmailPublicHelp')}
          </p>
        </div>
        <Switch
          id="org-contact-email-public"
          aria-describedby="org-contact-email-public-help"
          data-testid="org-contact-email-public-switch"
          checked={form.contactEmailPublic}
          onCheckedChange={(checked) => setForm((current) => ({ ...current, contactEmailPublic: checked }))}
        />
      </div>

      <div>
        <Button type="submit" loading={updateSettings.isPending} disabled={slugUnavailable} className="w-full sm:w-auto" data-testid="save-org-settings">
          {t('orgSettings.save')}
        </Button>
      </div>

      {/* The public site's branding has its own page in the short-rent shell (BK-12). */}
      {showSiteAppearanceLink ? (
        <p className="text-sm text-foreground/70" data-testid="org-settings-site-appearance-hint">
          {t('orgSettings.siteAppearanceHint')}{' '}
          <Link to={SITE_APPEARANCE_PATH} className="underline">
            {t('orgSettings.siteAppearanceLink')}
          </Link>
        </p>
      ) : null}
    </form>
  );
}
