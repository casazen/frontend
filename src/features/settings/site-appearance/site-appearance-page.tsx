import { useRef, useState, type CSSProperties } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, ImageIcon, Loader2, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Hero } from '@/features/public-site/components/Hero';
import { useWorkspace } from '@/hooks/use-workspace';
import { needsOrgSetup } from '@/lib/onboarding';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { analyzePrimaryColor, publicSiteColorStyle } from '@/lib/public-site-colors';
import {
  PUBLIC_SITE_THEMES,
  PUBLIC_SITE_THEME_PALETTES,
  normalizeHexColor,
  resolvePublicSiteTheme,
  type PublicSiteThemeId,
} from '@/lib/public-site-themes';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/queries/use-users';
import type { BrandingImageKind, OrgBranding } from '@/types';
import '@/styles/public-tokens.css';
import {
  BRANDING_IMAGE_ACCEPT,
  TAGLINE_MAX_LENGTH,
  checkBrandingImageFile,
  imageLimitParams,
} from './branding-rules';
import {
  useOrgBranding,
  useRemoveBrandingImage,
  useUpdateOrgBranding,
  useUploadBrandingImage,
} from './use-org-branding';

/** Path of the org settings page, where name and public address are edited (PL-04). */
const ORG_SETTINGS_PATH = '/app/short-rent/settings/organization';

/** Route prefix of an org's public booking site (a path, not text to translate). */
const PUBLIC_PATH_PREFIX = '/book/';

/** Glyph sample of a font or color (not a word: it is the same in every language). */
const FONT_SAMPLE = 'Aa';

/** Contrast ratio as shown to the host: truncated, never rounded up (4.46 is not "4.5"), with the locale's separator. */
function formatRatio(ratio: number, language: string): string {
  return (Math.floor(ratio * 10) / 10).toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

interface BrandingForm {
  themeId: PublicSiteThemeId;
  /** Text as typed; empty = theme color. */
  primaryColor: string;
  tagline: string;
}

function toForm(branding: OrgBranding): BrandingForm {
  return {
    themeId: resolvePublicSiteTheme(branding.publicThemeId),
    primaryColor: branding.primaryColor ?? '',
    tagline: branding.tagline ?? '',
  };
}

/** Translation keys of the client-side checks; the server validates again. */
function validate(form: BrandingForm): Partial<Record<'primaryColor' | 'tagline', string>> {
  const errors: Partial<Record<'primaryColor' | 'tagline', string>> = {};
  if (form.primaryColor.trim() && !normalizeHexColor(form.primaryColor)) {
    errors.primaryColor = 'siteAppearance.errors.colorInvalid';
  }
  if (form.tagline.trim().replace(/\s+/g, ' ').length > TAGLINE_MAX_LENGTH) {
    errors.tagline = 'siteAppearance.errors.taglineTooLong';
  }
  return errors;
}

/** "Aspetto sito" (BK-12, A3-17): logo, hero, color, tagline and theme of the public booking site. */
export function SiteAppearancePage() {
  return (
    <AppShell>
      <SiteAppearanceContent />
    </AppShell>
  );
}

export function SiteAppearanceContent() {
  const { t, i18n } = useTranslation();
  const { contexts } = useWorkspace();
  const isAdmin = isOrgBillingAdmin(contexts);
  const { user } = useCurrentUser();
  const brandingQuery = useOrgBranding(isAdmin);
  const updateBranding = useUpdateOrgBranding();

  const [form, setForm] = useState<BrandingForm>({ themeId: 'mare', primaryColor: '', tagline: '' });
  const [submitted, setSubmitted] = useState(false);
  // Sync the form from the server branding whenever it (re)loads (adjusting state during render).
  const [synced, setSynced] = useState<OrgBranding | undefined>(undefined);
  if (brandingQuery.data !== synced) {
    setSynced(brandingQuery.data);
    if (brandingQuery.data) {
      setForm(toForm(brandingQuery.data));
      setSubmitted(false);
    }
  }

  if (user && needsOrgSetup(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  const fieldErrors = submitted ? validate(form) : {};

  const handleSave = () => {
    setSubmitted(true);
    if (Object.keys(validate(form)).length > 0) return;
    const tagline = form.tagline.trim().replace(/\s+/g, ' ');
    updateBranding.mutate({
      primaryColor: normalizeHexColor(form.primaryColor),
      publicThemeId: form.themeId,
      tagline: tagline || null,
    });
  };

  const renderContent = () => {
    if (!isAdmin) {
      return (
        <div
          role="alert"
          data-testid="site-appearance-admin-required"
          className="flex items-start gap-3 rounded-lg border bg-muted/40 p-6 text-sm"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">{t('orgSettings.adminRequired.title')}</p>
            <p className="text-muted-foreground">{t('siteAppearance.adminRequired')}</p>
          </div>
        </div>
      );
    }

    if (brandingQuery.isPending) {
      return (
        <div className="grid gap-6 lg:grid-cols-2" data-testid="site-appearance-loading">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      );
    }

    if (brandingQuery.isError) {
      return (
        <div
          role="alert"
          data-testid="site-appearance-error"
          className="space-y-3 rounded-md border border-destructive/40 p-4 text-sm"
        >
          <p className="text-destructive">{t('siteAppearance.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void brandingQuery.refetch()}>
            {t('shared.errorFallback.tryAgain')}
          </Button>
        </div>
      );
    }

    const branding = brandingQuery.data;
    const previewColor = normalizeHexColor(form.primaryColor);
    // The picker needs a color: while the org uses the theme's own color it shows that theme's primary.
    const colorPickerValue = previewColor ?? PUBLIC_SITE_THEME_PALETTES[form.themeId].primary;
    const colorStyle = publicSiteColorStyle(previewColor, form.themeId);
    const colorAnalysis = previewColor ? analyzePrimaryColor(previewColor, form.themeId) : null;

    return (
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card data-testid="site-appearance-images">
            <CardHeader>
              <CardTitle>{t('siteAppearance.images.title')}</CardTitle>
              <CardDescription>{t('siteAppearance.images.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <BrandingImageField kind="logo" url={branding.logoUrl} />
              <BrandingImageField kind="hero" url={branding.heroImageUrl} />
            </CardContent>
          </Card>

          <Card data-testid="site-appearance-form">
            <CardHeader>
              <CardTitle>{t('siteAppearance.style.title')}</CardTitle>
              <CardDescription>{t('siteAppearance.style.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{t('siteAppearance.theme.label')}</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {PUBLIC_SITE_THEMES.map((themeId) => (
                    <label
                      key={themeId}
                      className={cn(
                        'flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm',
                        form.themeId === themeId && 'border-primary ring-1 ring-primary',
                      )}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <input
                          type="radio"
                          name="public-theme"
                          value={themeId}
                          checked={form.themeId === themeId}
                          onChange={() => setForm((f) => ({ ...f, themeId }))}
                          data-testid={`site-theme-${themeId}`}
                        />
                        {t(`siteAppearance.theme.options.${themeId}.name`)}
                      </span>
                      <ThemeSample themeId={themeId} style={colorStyle} />
                      <span className="text-muted-foreground">
                        {t(`siteAppearance.theme.options.${themeId}.description`)}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="site-primary-color">{t('siteAppearance.color.label')}</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="color"
                    aria-label={t('siteAppearance.color.picker')}
                    className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
                    value={colorPickerValue}
                    onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                    data-testid="site-primary-color-picker"
                  />
                  <Input
                    id="site-primary-color"
                    className="w-36 font-mono"
                    value={form.primaryColor}
                    placeholder={t('siteAppearance.color.placeholder')}
                    maxLength={7}
                    aria-invalid={fieldErrors.primaryColor ? true : undefined}
                    onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                    data-testid="site-primary-color-input"
                  />
                  {form.primaryColor ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, primaryColor: '' }))}
                      data-testid="site-primary-color-reset"
                    >
                      {t('siteAppearance.color.useTheme')}
                    </Button>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {form.primaryColor ? t('siteAppearance.color.help') : t('siteAppearance.color.usingTheme')}
                </p>
                {fieldErrors.primaryColor ? (
                  <p className="text-sm text-destructive" data-testid="site-primary-color-error">
                    {t(fieldErrors.primaryColor)}
                  </p>
                ) : null}
                {colorAnalysis ? (
                  <div
                    className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm"
                    data-testid="site-color-contrast"
                  >
                    <p className="flex items-center gap-2 font-medium">
                      <span
                        className="inline-flex h-6 min-w-12 items-center justify-center rounded px-2 text-xs font-semibold"
                        style={{ background: colorAnalysis.primary, color: colorAnalysis.onPrimary }}
                        aria-hidden
                      >
                        {FONT_SAMPLE}
                      </span>
                      {t('siteAppearance.color.contrast.title')}
                    </p>
                    <p data-testid="site-color-contrast-button">
                      {t(
                        colorAnalysis.onPrimary === '#ffffff'
                          ? 'siteAppearance.color.contrast.buttonLight'
                          : 'siteAppearance.color.contrast.buttonDark',
                        { ratio: formatRatio(colorAnalysis.onPrimaryRatio, i18n.language) },
                      )}
                    </p>
                    {colorAnalysis.primaryTextAdjusted ? (
                      <p className="text-muted-foreground" data-testid="site-color-contrast-adjusted">
                        {t('siteAppearance.color.contrast.textAdjusted', { color: colorAnalysis.primaryText })}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="site-tagline">{t('siteAppearance.tagline.label')}</Label>
                <Textarea
                  id="site-tagline"
                  rows={2}
                  value={form.tagline}
                  placeholder={t('siteAppearance.tagline.placeholder')}
                  aria-invalid={fieldErrors.tagline ? true : undefined}
                  onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                  data-testid="site-tagline-input"
                />
                <p className="text-sm text-muted-foreground">
                  {t('siteAppearance.tagline.counter', {
                    length: form.tagline.trim().replace(/\s+/g, ' ').length,
                    max: TAGLINE_MAX_LENGTH,
                  })}
                </p>
                {fieldErrors.tagline ? (
                  <p className="text-sm text-destructive" data-testid="site-tagline-error">
                    {t(fieldErrors.tagline, { maxLength: TAGLINE_MAX_LENGTH })}
                  </p>
                ) : null}
              </div>

              <Button
                type="button"
                onClick={handleSave}
                disabled={updateBranding.isPending}
                data-testid="save-site-appearance"
              >
                {updateBranding.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                {t('siteAppearance.save')}
              </Button>
            </CardContent>
          </Card>
        </div>

        <SitePreview
          branding={branding}
          themeId={form.themeId}
          colorStyle={colorStyle}
          tagline={form.tagline.trim() || null}
        />
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6" data-testid="site-appearance-page">
      <PageHeader title={t('siteAppearance.title')} description={t('siteAppearance.description')} />
      {renderContent()}
    </div>
  );
}

function BrandingImageField({ kind, url }: { kind: BrandingImageKind; url: string | null }) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadBrandingImage(kind);
  const remove = useRemoveBrandingImage(kind);
  const [fileError, setFileError] = useState<string | null>(null);
  const busy = upload.isPending || remove.isPending;
  const limits = imageLimitParams(kind);

  const handleFile = (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    const error = checkBrandingImageFile(kind, file);
    setFileError(error);
    if (!error) upload.mutate(file);
  };

  return (
    <div className="space-y-2" data-testid={`branding-image-${kind}`}>
      <Label htmlFor={`branding-${kind}-file`}>{t(`siteAppearance.images.${kind}.label`)}</Label>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className={cn(
            'flex items-center justify-center overflow-hidden rounded-md border bg-muted/40',
            kind === 'logo' ? 'h-16 w-40' : 'h-24 w-48',
          )}
        >
          {url ? (
            <img
              src={url}
              alt={t(`siteAppearance.images.${kind}.currentAlt`)}
              className={cn('h-full w-full', kind === 'logo' ? 'object-contain p-1' : 'object-cover')}
              data-testid={`branding-image-${kind}-current`}
            />
          ) : (
            <span className="flex flex-col items-center gap-1 px-2 text-center text-xs text-muted-foreground">
              <ImageIcon className="h-5 w-5" aria-hidden />
              {t(`siteAppearance.images.${kind}.empty`)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id={`branding-${kind}-file`}
            type="file"
            accept={BRANDING_IMAGE_ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={(e) => handleFile(e.target.files?.[0])}
            data-testid={`branding-image-${kind}-input`}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            data-testid={`branding-image-${kind}-upload`}
          >
            {upload.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="mr-2 h-4 w-4" aria-hidden />
            )}
            {url ? t('siteAppearance.images.replace') : t('siteAppearance.images.upload')}
          </Button>
          {url ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => remove.mutate()}
              data-testid={`branding-image-${kind}-remove`}
            >
              {remove.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
              )}
              {t('siteAppearance.images.remove')}
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t(`siteAppearance.images.${kind}.hint`, limits)}</p>
      {fileError ? (
        <p className="text-sm text-destructive" role="alert" data-testid={`branding-image-${kind}-error`}>
          {t(fileError, limits)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Miniature of a theme: its page background, display font, text color and primary color (the host's own color when one
 * is being edited, since that is what the site will look like with this theme). Decorative: the theme name and
 * description next to it carry the meaning.
 */
function ThemeSample({ themeId, style }: { themeId: PublicSiteThemeId; style: CSSProperties | undefined }) {
  return (
    <span
      className="public-site-root pointer-events-none flex items-center justify-between gap-2 rounded border px-3 py-2"
      data-theme={themeId}
      style={style}
      aria-hidden
      data-testid={`site-theme-sample-${themeId}`}
    >
      <span className="public-display text-xl leading-none">{FONT_SAMPLE}</span>
      <span className="public-site-cta h-5 w-10" />
    </span>
  );
}

interface SitePreviewProps {
  branding: OrgBranding;
  themeId: PublicSiteThemeId;
  /** Inline color variables of the host's primary color (`publicSiteColorStyle`), undefined for the theme's own. */
  colorStyle: CSSProperties | undefined;
  tagline: string | null;
}

/**
 * Live preview of the public site's header and hero with the values being edited (not yet saved): same tokens
 * (`public-tokens.css`) and same `Hero` component as `/book/{slug}`. Without a hero image the real site shows the first
 * property photo; the preview shows the theme's gradient instead.
 */
function SitePreview({ branding, themeId, colorStyle, tagline }: SitePreviewProps) {
  const { t } = useTranslation();
  const publicPath = `${PUBLIC_PATH_PREFIX}${encodeURIComponent(branding.slug)}`;

  return (
    <Card className="lg:sticky lg:top-4" data-testid="site-appearance-preview">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>{t('siteAppearance.preview.title')}</CardTitle>
          <CardDescription>{t('siteAppearance.preview.description')}</CardDescription>
        </div>
        <a
          href={publicPath}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          data-testid="site-appearance-open-site"
        >
          {t('siteAppearance.preview.openSite')}
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className="public-site-root min-h-0 overflow-hidden rounded-md border"
          data-theme={themeId}
          style={colorStyle}
          data-testid="site-preview-root"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--cz-public-border)] bg-[var(--cz-public-surface)] px-4 py-3">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.displayName}
                className="h-9 w-auto max-w-[160px] object-contain"
                data-testid="site-preview-logo"
              />
            ) : (
              <span className="public-display truncate text-base font-semibold">{branding.displayName}</span>
            )}
            <span className="public-site-cta px-3 py-1.5 text-xs">
              {t('publicSite.mobileBookingCta')}
            </span>
          </div>
          <div className="px-4 pt-4 [&_section]:mx-0 [&_section]:mb-4">
            <Hero
              imageUrl={branding.heroImageUrl}
              title={branding.displayName}
              tagline={tagline}
              ctaLabel={t('publicSite.viewProperties')}
              onCta={() => undefined}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('siteAppearance.preview.identityHint')}{' '}
          <Link to={ORG_SETTINGS_PATH} className="underline" data-testid="site-appearance-org-settings-link">
            {t('siteAppearance.preview.identityLink')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
