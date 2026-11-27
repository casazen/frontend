import * as React from 'react';
import { ArrowLeft, ArrowRight, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Stepper, type StepperStep } from '@/components/ui/stepper';
import { useWizardOpenFlag } from '@/store/use-wizard-open-flag';
import { cn } from '@/lib/utils';

export interface LayerWizardNext {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

interface LayerWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  title: string;
  steps: readonly StepperStep[];
  stepIndex: number;
  heading: string;
  purpose?: string;
  busy?: boolean;
  onBack?: () => void;
  onStepSelect?: (index: number) => void;
  next?: LayerWizardNext;
  footerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  showStepper?: boolean;
  testId: string;
  children: React.ReactNode;
}

function OpenFlag() {
  useWizardOpenFlag();
  return null;
}

export function LayerWizard({
  open,
  onOpenChange,
  icon: Icon,
  title,
  steps,
  stepIndex,
  heading,
  purpose,
  busy = false,
  onBack,
  onStepSelect,
  next,
  footerExtra,
  footer,
  showStepper = true,
  testId,
  children,
}: LayerWizardProps) {
  const { t } = useTranslation();
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const stepId = steps[stepIndex]?.id ?? 'done';
  const firstRender = React.useRef(true);

  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [stepId]);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && busy) return;
        onOpenChange(value);
      }}
    >
      <DialogContent
        sheetOnPhone={false}
        data-testid={testId}
        aria-busy={busy || undefined}
        onInteractOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          headingRef.current?.focus();
        }}
        {...(purpose ? {} : { 'aria-describedby': undefined })}
        className={cn(
          'flex max-h-[min(92dvh,52rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl',
          'max-sm:left-0 max-sm:top-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none',
        )}
      >
        <OpenFlag />
        <div className="border-b px-4 pb-4 pt-5 sm:px-8 sm:pt-6">
          <div className="flex items-center gap-3 pr-10">
            <span
              aria-hidden="true"
              className="cz-icon-tile bg-primary-soft text-primary-text [--cz-icon-size:1.125rem] [--cz-icon-tile-size:2.25rem]"
            >
              <Icon strokeWidth={1.75} />
            </span>
            <DialogTitle className="text-base font-semibold leading-tight sm:text-lg">{title}</DialogTitle>
          </div>
          {showStepper && steps.length > 1 ? (
            <Stepper className="mt-4" steps={[...steps]} current={stepIndex} onStepSelect={onStepSelect} />
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
          <div key={stepId} className="cz-enter space-y-5">
            <div className="space-y-1.5">
              <h3
                ref={headingRef}
                tabIndex={-1}
                className="break-words text-xl font-semibold leading-tight tracking-tight outline-none sm:text-2xl"
              >
                {heading}
              </h3>
              {purpose ? (
                <DialogDescription className="max-w-prose text-base leading-relaxed text-muted-foreground">{purpose}</DialogDescription>
              ) : null}
            </div>
            {children}
          </div>
        </div>

        {footer ?? (
          <div className="flex flex-wrap items-center gap-2 border-t bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-8 sm:py-4">
            {onBack ? (
              <Button type="button" variant="outline" onClick={onBack} disabled={busy}>
                <ArrowLeft aria-hidden="true" className="size-4" />
                {t('marketingHub.layer.back')}
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                {t('marketingHub.layer.cancel')}
              </Button>
            )}
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
              {footerExtra}
              {next ? (
                <Button
                  type="button"
                  onClick={next.onClick}
                  disabled={next.disabled}
                  loading={next.loading}
                  iconRight={next.icon ?? <ArrowRight />}
                  data-testid={`${testId}-next`}
                >
                  {next.label}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
