import { useEffect, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/ui/help-tip';
import { useUiStore } from '@/store/ui-store';

// A name that does not fit goes to a second line instead of out of the screen (wide fonts, 360 px).
export const WIZARD_BUTTON = 'h-auto min-h-11 min-w-0 whitespace-normal py-2 text-center leading-tight';

// The buttons of a phone are a bar above the bottom one, last child of the column so that it can stay in view for its whole length
// (a sticky box never leaves its container); from `md` there is no bottom bar and they are the end of the form, as usual.
const FOOTER =
  'sticky bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] z-10 -mx-4 space-y-2 border-t bg-background px-4 py-3 md:static md:z-auto md:mx-0 md:border-t-0 md:bg-transparent md:p-0';

interface FrameProps {
  /** The steps: a list at the side from `lg`, one line that opens it on a phone. */
  stepper: ReactNode;
  title: string;
  /** What the step is for, in a line. */
  purpose: string;
  /** «Perché lo chiediamo»: the reason for the questions of the step, in a sentence. */
  why?: string;
  /** The focus goes here when the step changes: a screen reader reads the heading of the new step. */
  titleRef?: Ref<HTMLHeadingElement>;
  /** The fields and what goes with them. */
  children: ReactNode;
  /** What the person can do: back, save, go on, and what is left to do. */
  footer: ReactNode;
}

/**
 * The frame of the wizard «Crea contratto»: the steps, the title with its reason, the step, and the buttons (LR-06a). One focal point
 * per step: the heading, the fields and the one main button. On a phone the buttons are a fixed bar above the bottom one.
 */
export function LeaseWizardFrame({ stepper, title, purpose, why, titleRef, children, footer }: FrameProps) {
  const { t } = useTranslation();
  const setMobilePrimaryVisible = useUiStore((state) => state.setMobilePrimaryVisible);
  useEffect(() => {
    setMobilePrimaryVisible(true);
    return () => setMobilePrimaryVisible(false);
  }, [setMobilePrimaryVisible]);

  return (
    <div className="grid w-full min-w-0 gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start" data-testid="lease-wizard">
      {stepper}
      <div className="min-w-0 max-w-4xl space-y-6">
        <header className="min-w-0 space-y-1">
          <h2 ref={titleRef} tabIndex={-1} className="break-words text-xl font-semibold tracking-tight outline-none" data-testid="lease-wizard-title">
            {title}
          </h2>
          <p className="break-words text-sm text-muted-foreground">
            {purpose}
            {why ? (
              <>
                {' '}
                <HelpTip title={t('leaseWizard.why')}>{why}</HelpTip>
              </>
            ) : null}
          </p>
        </header>
        {children}
        <div className={FOOTER}>{footer}</div>
      </div>
    </div>
  );
}
