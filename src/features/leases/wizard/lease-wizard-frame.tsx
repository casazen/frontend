import { useEffect, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/store/ui-store';
import { useWizardOpenFlag } from '@/store/use-wizard-open-flag';

// A name that does not fit goes to a second line instead of out of the screen (wide fonts, 360 px).
export const WIZARD_BUTTON = 'h-auto min-h-11 min-w-0 whitespace-normal py-2 text-center leading-tight';

// The buttons of a phone are a bar above the bottom one, last child of the column so that it can stay in view for its whole length
// (a sticky box never leaves its container); from `md` there is no bottom bar and they are the end of the form, as usual.
const FOOTER =
  'sticky bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] z-10 space-y-2 rounded-b-2xl border-t bg-card px-4 py-3 sm:px-6 md:static md:z-auto';

interface FrameProps {
  stepper: ReactNode;
  position: { current: number; total: number };
  title: string;
  summary: string;
  inHand?: string;
  titleRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
  footer: ReactNode;
}

export function LeaseWizardFrame({ stepper, position, title, summary, inHand, titleRef, children, footer }: FrameProps) {
  const { t } = useTranslation();
  const setMobilePrimaryVisible = useUiStore((state) => state.setMobilePrimaryVisible);
  useEffect(() => {
    setMobilePrimaryVisible(true);
    return () => setMobilePrimaryVisible(false);
  }, [setMobilePrimaryVisible]);
  useWizardOpenFlag();

  return (
    <div className="grid w-full min-w-0 gap-4 lg:gap-6 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)] lg:items-start" data-testid="lease-wizard">
      <div className="min-w-0 lg:sticky lg:top-5">{stepper}</div>
      <div className="min-w-0 rounded-2xl border bg-card shadow-sm max-sm:[&_select]:min-h-11 max-sm:[&_input:not([type=radio],[type=checkbox],[type=file])]:min-h-11">
        <header className="min-w-0 space-y-3 rounded-t-2xl border-b bg-muted/40 p-4 sm:p-6" data-testid="lease-wizard-header">
          <h2 ref={titleRef} tabIndex={-1} className="break-words text-2xl font-semibold tracking-tight outline-none" data-testid="lease-wizard-title">
            <span className="mb-2 block text-xs font-semibold tracking-wide text-primary" data-testid="lease-wizard-position">
              {t('leaseWizardGuide.header.position', position)}
            </span>
            <span className="sr-only"> — </span>
            {title}
          </h2>
          <p className="break-words text-sm text-foreground/80">{summary}</p>
          {inHand ? (
            <p className="break-words rounded-lg border-l-2 border-primary/50 bg-card px-3 py-2 text-sm" data-testid="lease-wizard-in-hand">
              <strong className="font-semibold">{t('leaseWizardGuide.header.inHand')}</strong> {inHand}
            </p>
          ) : null}
        </header>
        <div className="min-w-0 space-y-5 p-4 sm:p-6">{children}</div>
        <div className={FOOTER}>{footer}</div>
      </div>
    </div>
  );
}
