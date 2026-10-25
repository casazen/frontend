import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * «Perché lo chiediamo?» (LR-WIZ-1): the reason for a question, shut by default and opened by the person, only where the question makes
 * people hesitate (the fiscal code, the deposit). A native `details`: it opens with a tap, Enter or Space, and does not send the form
 * it sits in.
 */
export function WhyAsk({ children, className }: { children: ReactNode; className?: string }) {
  const { t } = useTranslation();
  return (
    <details className={cn('group min-w-0 text-sm', className)} data-testid="lease-why-ask">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:min-h-8 [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        {t('leaseWizardGuide.why.summary')}
      </summary>
      <p className="break-words pb-2 pl-[1.375rem] text-foreground/80">{children}</p>
    </details>
  );
}
