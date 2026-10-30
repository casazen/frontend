import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, PauseCircle, TriangleAlert, WifiOff } from 'lucide-react';
import { CasaZenMark } from '@/components/brand/casazen-mark';
import type { SiteModel } from '@/lib/supplier-site/site-model';
import { siteThemeProps } from '@/lib/supplier-site/style-config';
import { cn } from '@/lib/utils';

/**
 * The look of a site that has no supplier to take it from (loading, not found, error): the style and the typeface a trade with
 * no style of its own gets. A plain header with the mark of CasaZen, which is who is speaking.
 */
export function StateFrame({ children }: { children: ReactNode }) {
  const theme = siteThemeProps('fresco', 'editoriale', null);
  return (
    <div className="vz" {...theme}>
      <header className="vz-header vz-header--solid">
        <div className="vz-container vz-header__in">
          <a className="vz-brand" href="/" aria-label="CasaZen">
            <CasaZenMark size={36} />
            <span className="vz-brand__name">CasaZen</span>
          </a>
        </div>
      </header>
      <main className="vz-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

/** The proportions of the home (cover, three cards), so nothing jumps when the page arrives. */
export function SiteSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="vz-container vz-loading" role="status" aria-busy="true" data-testid="supplier-showcase-loading">
      <span className="sr-only">{t('supplierShowcase.loading')}</span>
      <div aria-hidden="true">
        <span className="vz-skel vz-skel-hero" />
        <div className="vz-grid">
          {[0, 1, 2].map((key) => (
            <div key={key} className="vz-skel-card">
              <span className="vz-skel vz-skel-card__media" />
              <span className="vz-skel vz-skel-card__line" />
              <span className="vz-skel vz-skel-card__line vz-skel-card__line--short" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface StateProps {
  icon: ReactNode;
  title: string;
  text?: string;
  tone?: 'error';
  actions?: ReactNode;
  testId: string;
  /** The title is the `h1` of the page. */
  role?: 'alert';
}

function State({ icon, title, text, tone, actions, testId, role }: StateProps) {
  return (
    <div className="vz-container" role={role} data-testid={testId}>
      <section className={cn('vz-state', tone && `vz-state--${tone}`)}>
        <span className="vz-state__icon" aria-hidden="true">
          {icon}
        </span>
        <h1 tabIndex={-1}>{title}</h1>
        {text ? <p>{text}</p> : null}
        {actions ? <div className="vz-state__actions">{actions}</div> : null}
      </section>
    </div>
  );
}

/** A slug nobody knows, a supplier that is not active and one that is suspended: the same words for all three. */
export function SiteNotFound() {
  const { t } = useTranslation();
  return (
    <State
      testId="supplier-showcase-not-found"
      icon={<Compass />}
      title={t('supplierShowcase.notFound')}
      text={t('supplierShowcase.notFoundDescription')}
      actions={
        <a className="vz-btn vz-btn--secondary vz-btn--lg" href="/">
          {t('supplierSite.states.discover')}
        </a>
      }
    />
  );
}

export function SiteLoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <State
      testId="supplier-showcase-error"
      role="alert"
      tone="error"
      icon={<TriangleAlert />}
      title={t('supplierShowcase.loadError')}
      text={t('supplierSite.states.errorText')}
      actions={
        <button type="button" className="vz-btn vz-btn--primary vz-btn--lg" onClick={onRetry}>
          {t('shared.errorState.retry')}
        </button>
      }
    />
  );
}

/** The supplier paused the showcase: nothing to book, said plainly (and what there is to do instead). */
export function SitePaused({ model }: { model: SiteModel }) {
  const { t } = useTranslation();
  return (
    <State
      testId="supplier-showcase-paused"
      icon={<PauseCircle />}
      title={t('supplierSite.paused.title', { name: model.name })}
      text={t('supplierSite.paused.text')}
      actions={
        <a className="vz-btn vz-btn--secondary vz-btn--lg" href="/">
          {t('supplierSite.states.discover')}
        </a>
      }
    />
  );
}

export function OfflineBar() {
  const { t } = useTranslation();
  return (
    <div className="vz-offline" role="status" data-testid="supplier-site-offline">
      <WifiOff aria-hidden="true" />
      <span>{t('supplierSite.offline')}</span>
    </div>
  );
}
