import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Info, ShieldAlert } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FIELD_COLUMNS, FOCUS_COLUMN } from '@/components/layout/page-columns';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonLine } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useWorkspace } from '@/hooks/use-workspace';
import { needsOrgSetup } from '@/lib/onboarding';
import { translateErrorCode } from '@/lib/api-errors';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { useCurrentUser } from '@/queries/use-users';
import type { OrgLanguage, OrgSettings } from '@/types';
import { ORG_NAME_FIELD_ID } from './org-profile';
import { BiometricSettingsCard } from '../components/biometric-settings-card';
import { ServiceRequestBackupsSetting } from './service-request-backups-setting';
import { Badge } from '@/components/ui/badge';
import {
  SLUG_CHECK_DEBOUNCE_MS,
  useOrgSettings,
  useOrgSlugAvailability,
  useUpdateOrgSettings,
} from './use-org-settings';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

type OrgSettingsForm = Pick<OrgSettings, 'name' | 'slug' | 'contactEmail' | 'contactEmailPublic'> & {
  legalName: string;
  registeredOffice: string;
  contactPhone: string;
  defaultLanguage: OrgLanguage;
};
type FieldErrors = Partial<Record<'name' | 'slug' | 'contactEmail', string>>;

const SITE_APPEARANCE_PATH = '/app/short-rent/settings/site-appearance';

const PUBLIC_PATH_PREFIX = '/book/';

const LEGAL_NAME_MAX_LENGTH = 200;
const REGISTERED_OFFICE_MAX_LENGTH = 300;

const CONTACT_PHONE_MAX_LENGTH = 40;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

function validate(form: OrgSettingsForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = 'orgSettings.errors.nameRequired';
  if (!form.slug.trim()) errors.slug = 'orgSettings.errors.slugRequired';
  if (!form.contactEmail.trim()) errors.contactEmail = 'orgSettings.errors.contactEmailRequired';
  else if (!EMAIL_PATTERN.test(form.contactEmail.trim())) errors.contactEmail = 'orgSettings.errors.contactEmailInvalid';
  return errors;
}

interface SlugStatusProps {
  slugChanged: boolean;
  typedSlug: string;
  debouncedSlug: string;
  availability: ReturnType<typeof useOrgSlugAvailability>;
}

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

export function OrganizationSettingsPage() {
  return (
    <AppShell>
      <OrganizationSettingsContent showSiteAppearanceLink />
    </AppShell>
  );
}

export function OrganizationSettingsContent({
  showSiteAppearanceLink = false,
}: {
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

export function OrganizationSettings({ showSiteAppearanceLink = false }: { showSiteAppearanceLink?: boolean }) {
  const { t } = useTranslation();
  const { contexts, activeContext } = useWorkspace();
  const isAdmin = isOrgBillingAdmin(contexts);
  const { user, org } = useCurrentUser();
  const settingsQuery = useOrgSettings(isAdmin);
  const updateSettings = useUpdateOrgSettings();

  const [form, setForm] = useState<OrgSettingsForm>({
    name: '',
    slug: '',
    contactEmail: '',
    contactEmailPublic: false,
    legalName: '',
    registeredOffice: '',
    contactPhone: '',
    defaultLanguage: 'it',
  });
  const [submitted, setSubmitted] = useState(false);
  const [synced, setSynced] = useState<OrgSettings | undefined>(undefined);
  if (settingsQuery.data !== synced) {
    setSynced(settingsQuery.data);
    if (settingsQuery.data) {
      const { name, slug, contactEmail, contactEmailPublic, legalName, registeredOffice, contactPhone, defaultLanguage } = settingsQuery.data;
      setForm({
        name,
        slug,
        contactEmail,
        contactEmailPublic,
        legalName: legalName ?? '',
        registeredOffice: registeredOffice ?? '',
        contactPhone: contactPhone ?? '',
        defaultLanguage: defaultLanguage ?? 'it',
      });
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
      legalName: form.legalName.trim(),
      registeredOffice: form.registeredOffice.trim(),
      contactPhone: form.contactPhone.trim(),
      defaultLanguage: form.defaultLanguage,
    });
  };

  return (
    <div className="@container min-w-0">
      <form onSubmit={handleSave} noValidate className="min-w-0 space-y-5" data-testid="org-settings-form">
        {org?.planTier ? (
          <div className="flex items-center gap-2" data-testid="org-tier-badge">
            <span className="text-sm text-foreground/70">{t('org.tier.badge')}:</span>
            <Badge variant="secondary">{org.planTier}</Badge>
          </div>
        ) : null}
        <div className={FIELD_COLUMNS}>
          <div className="min-w-0 space-y-5 rounded-xl border bg-card p-4 sm:p-6">
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

            {/* The phone of the account (AM-08b-b): to be reached by CasaZen and the team; unlike the email it has no switch because it is never published. */}
            <Field label={t('orgSettings.contactPhoneLabel')} hint={t('orgSettings.contactPhoneHelp')}>
              <Input
                id="org-contact-phone"
                data-testid="org-contact-phone-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.contactPhone}
                maxLength={CONTACT_PHONE_MAX_LENGTH}
                onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))}
              />
            </Field>
          </div>

          <div className="min-w-0 space-y-5 rounded-xl border bg-card p-4 sm:p-6">
            {/* Who runs the site (DB-03b-a): shown in the footer of the booking site with the VAT number of the fiscal profile. */}
            <div className="space-y-4" data-testid="org-operator-section">
              <p id="org-operator-help" className="break-words text-sm text-foreground/70" data-testid="org-operator-help">
                {t('orgSettings.operatorHelp')}
              </p>
              <Field label={t('orgSettings.legalNameLabel')}>
                <Input
                  id="org-legal-name"
                  data-testid="org-legal-name-input"
                  aria-describedby="org-operator-help"
                  value={form.legalName}
                  maxLength={LEGAL_NAME_MAX_LENGTH}
                  autoComplete="organization"
                  onChange={(event) => setForm((current) => ({ ...current, legalName: event.target.value }))}
                />
              </Field>
              <Field label={t('orgSettings.registeredOfficeLabel')} example={t('orgSettings.registeredOfficeExample')}>
                <Input
                  id="org-registered-office"
                  data-testid="org-registered-office-input"
                  aria-describedby="org-operator-help"
                  value={form.registeredOffice}
                  maxLength={REGISTERED_OFFICE_MAX_LENGTH}
                  autoComplete="street-address"
                  onChange={(event) => setForm((current) => ({ ...current, registeredOffice: event.target.value }))}
                />
              </Field>
            </div>

            <div className="space-y-3" data-testid="org-language-section">
              <div className="space-y-1.5">
                <p className="text-sm font-medium leading-snug">{t('orgSettings.languageLabel')}</p>
                <Segmented<OrgLanguage>
                  label={t('orgSettings.languageLabel')}
                  value={form.defaultLanguage}
                  onValueChange={(language) => setForm((current) => ({ ...current, defaultLanguage: language }))}
                  options={[
                    { value: 'it', label: t('orgSettings.languageIt'), testId: 'org-language-it' },
                    { value: 'en', label: t('orgSettings.languageEn'), testId: 'org-language-en' },
                  ]}
                />
                <p className="break-words text-sm text-foreground/70">{t('orgSettings.languageHelp')}</p>
              </div>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-lg bg-muted p-3 text-sm" data-testid="org-regional-info">
                <dt className="text-foreground/70">{t('orgSettings.currencyLabel')}</dt>
                <dd>{t('orgSettings.currencyValue')}</dd>
                <dt className="text-foreground/70">{t('orgSettings.timezoneLabel')}</dt>
                <dd>{t('orgSettings.timezoneValue')}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div>
          <Button type="submit" loading={updateSettings.isPending} disabled={slugUnavailable} className="w-full sm:w-auto" data-testid="save-org-settings">
            {t('orgSettings.save')}
          </Button>
        </div>

        {showSiteAppearanceLink ? (
          <p className="text-sm text-foreground/70" data-testid="org-settings-site-appearance-hint">
            {t('orgSettings.siteAppearanceHint')}{' '}
            <Link to={SITE_APPEARANCE_PATH} className="underline">
              {t('orgSettings.siteAppearanceLink')}
            </Link>
          </p>
        ) : null}
      </form>
      <div className={FIELD_COLUMNS}>
        <ServiceRequestBackupsSetting />
      </div>
      <div className={FIELD_COLUMNS}>
        {activeContext === 'long-rent' && <BiometricSettingsCard />}
      </div>
    </div>
  );
}
