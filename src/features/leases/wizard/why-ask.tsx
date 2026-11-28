import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WhyAsk({ children, summary, className }: { children: ReactNode; summary?: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <details className={cn('group min-w-0 text-sm', className)} data-testid="lease-why-ask">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:min-h-8 [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        {summary ?? t('leaseWizardGuide.why.summary')}
      </summary>
      <div className="break-words pb-2 pl-[1.375rem] text-foreground/80">{children}</div>
    </details>
  );
}
