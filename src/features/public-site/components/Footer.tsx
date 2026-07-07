import { useTranslation } from 'react-i18next';

interface FooterProps {
  displayName?: string;
  contactEmail?: string;
  showPoweredBy?: boolean;
}

export function Footer({ displayName, contactEmail, showPoweredBy = false }: FooterProps) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-black/10 py-8 text-sm text-[var(--cz-public-muted)]">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-4 text-center">
        <div className="flex flex-wrap justify-center gap-4">
          <a href="https://casazen.app/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--cz-public-primary)]">
            {t('publicSite.privacy')}
          </a>
          <a href="https://casazen.app/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--cz-public-primary)]">
            {t('publicSite.terms')}
          </a>
          {contactEmail ? (
            <a href={`mailto:${contactEmail}`} className="underline hover:text-[var(--cz-public-primary)]">
              {contactEmail}
            </a>
          ) : null}
        </div>
        {displayName ? <p>© {year} {displayName}</p> : null}
        {showPoweredBy ? (
          <p className="text-xs">{t('publicSite.poweredBy')}</p>
        ) : null}
      </div>
    </footer>
  );
}
