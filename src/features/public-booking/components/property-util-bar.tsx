import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Share2 } from 'lucide-react';
import { useBooking } from '@/features/public-booking/booking/booking-context';

type ShareState = 'idle' | 'copied' | 'failed';

/** The action look of the bar: a quiet pill of 44 px that wears the text color of the theme. */
const BAR_ACTION_CLASS =
  'inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-[0.95rem] font-semibold text-[var(--cz-public-text)] hover:bg-[color-mix(in_srgb,var(--cz-public-text)_7%,transparent)]';

/** Copies the link; false when the browser refuses (no permission, an insecure page). */
async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * «Condividi»: the share sheet of the phone when there is one, else the link copied with a word that says so. It shares the address of
 * the page with nothing after it (no dates, no guests): a link is a place, not a search.
 */
function ShareButton({ title, url }: { title: string; url: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<ShareState>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), 3500);
    return () => window.clearTimeout(timer);
  }, [state]);

  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // The person closed the sheet: that is an answer, not an error.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    setState((await copyLink(url)) ? 'copied' : 'failed');
  };

  return (
    <>
      <button type="button" className={BAR_ACTION_CLASS} onClick={() => void share()} data-testid="property-share">
        {state === 'copied' ? <Check className="h-5 w-5" aria-hidden /> : <Share2 className="h-5 w-5" aria-hidden />}
        <span>{state === 'copied' ? t('publicProperty.share.copied') : t('publicProperty.share.action')}</span>
      </button>
      <span role="status" className="sr-only">
        {state === 'copied' ? t('publicProperty.share.copiedStatus') : state === 'failed' ? t('publicProperty.share.failed') : ''}
      </span>
    </>
  );
}

interface PropertyUtilBarProps {
  /** `/book/{slug}`: where «Tutte le case» goes, with the stay carried along. */
  basePath: string;
  /** The site has more than one home: only then there is a «Tutte le case» to go back to. */
  hasOtherHomes: boolean;
  shareTitle: string;
  shareUrl: string;
}

/** The row above the gallery (DB-04a): the way back to the homes of the site, and «Condividi». */
export function PropertyUtilBar({ basePath, hasOtherHomes, shareTitle, shareUrl }: PropertyUtilBarProps) {
  const { t } = useTranslation();
  const { linkTo } = useBooking();
  const backTo = hasOtherHomes ? linkTo(basePath) : null;

  return (
    <div className="flex min-h-11 items-center justify-between gap-3" data-testid="property-util-bar">
      {backTo ? (
        <Link to={backTo} className={`${BAR_ACTION_CLASS} -ml-2.5`} data-testid="property-back">
          <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden />
          <span>{t('publicProperty.back')}</span>
        </Link>
      ) : (
        <span />
      )}
      <div className="-mr-3 flex items-center gap-1">
        <ShareButton title={shareTitle} url={shareUrl} />
      </div>
    </div>
  );
}
