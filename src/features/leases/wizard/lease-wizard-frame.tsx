import { useEffect, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/store/ui-store';

// A name that does not fit goes to a second line instead of out of the screen (wide fonts, 360 px).
export const WIZARD_BUTTON = 'h-auto min-h-11 min-w-0 whitespace-normal py-2 text-center leading-tight';

// The buttons of a phone are a bar above the bottom one, last child of the column so that it can stay in view for its whole length
// (a sticky box never leaves its container); from `md` there is no bottom bar and they are the end of the form, as usual.
const FOOTER =
  'sticky bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] z-10 -mx-4 space-y-2 border-t bg-background px-4 py-3 md:static md:z-auto md:mx-0 md:border-t-0 md:bg-transparent md:p-0';

interface FrameProps {
  /** The steps: a list at the side from `lg`, a bar and a button that opens the list on a phone. */
  stepper: ReactNode;
  /** «Passo 2 di 7»: the place of this screen among the ones that apply to this contract. */
  position: { current: number; total: number };
  /** What the person does here, with a verb. */
  title: string;
  /** One sentence: what is done here and why it is needed. */
  summary: string;
  /** «Ti serve in mano:» the documents and the data to have at hand; none on a screen that only waits. */
  inHand?: string;
  /** The focus goes here when the step changes: a screen reader reads the heading of the new step. */
  titleRef?: Ref<HTMLHeadingElement>;
  /** The fields and what goes with them. */
  children: ReactNode;
  /** What the person can do: back, save for later, go on, and what is left to do. */
  footer: ReactNode;
}

/**
 * The frame of the wizard «Crea contratto» (LR-06a, LR-WIZ-1): the steps, the head of the screen, the step and the buttons. The head
 * says where the person is («Passo 2 di 7»), what they do (a title with a verb), why in one sentence, and what to have at hand before
 * starting. One focal point per step: the head, the fields and the one main button. On a phone the buttons are a fixed bar above the
 * bottom one.
 */
export function LeaseWizardFrame({ stepper, position, title, summary, inHand, titleRef, children, footer }: FrameProps) {
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
        <header className="min-w-0 space-y-2" data-testid="lease-wizard-header">
          <h2 ref={titleRef} tabIndex={-1} className="break-words text-xl font-semibold tracking-tight outline-none" data-testid="lease-wizard-title">
            <span className="block text-sm font-medium tracking-normal text-muted-foreground" data-testid="lease-wizard-position">
              {t('leaseWizardGuide.header.position', position)}
            </span>
            <span className="sr-only"> — </span>
            {title}
          </h2>
          <p className="break-words text-sm text-foreground/80">{summary}</p>
          {inHand ? (
            <p className="break-words rounded-lg bg-muted/50 px-3 py-2 text-sm" data-testid="lease-wizard-in-hand">
              <strong className="font-semibold">{t('leaseWizardGuide.header.inHand')}</strong> {inHand}
            </p>
          ) : null}
        </header>
        {children}
        <div className={FOOTER}>{footer}</div>
      </div>
    </div>
  );
}
