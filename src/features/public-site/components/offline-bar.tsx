import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '@/features/public-site/hooks/use-online';

/**
 * The band that says the guest is offline (DB-02b): what is on the screen is the last version that was saved, and checking the
 * dates and booking need the connection. It sits under the header, in the text color of the theme turned over (the text on the
 * background of the theme: any theme reads). The status element is always in the page and only its content comes and goes, so a
 * screen reader says the sentence when the connection is lost, and nothing while it is there.
 */
export function OfflineBar() {
  const { t } = useTranslation();
  const online = useOnline();

  return (
    <div role="status" data-testid="public-site-offline">
      {online ? null : (
        <div className="bg-[var(--cz-public-text)] text-[var(--cz-public-bg)]">
          <div className="mx-auto flex max-w-[1200px] items-start gap-2.5 px-3 py-2.5 text-sm md:px-4">
            <WifiOff className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
            <span>{t('publicSite.offline')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
