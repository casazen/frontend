import type { ComponentProps } from 'react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';

type ServicePageHeaderProps = ComponentProps<typeof PageHeader> & { icon: LucideIcon };

/** The same task marker follows the service from the host's catalog to the supplier's workspace. */
export function ServicePageHeader({ icon: Icon, ...props }: ServicePageHeaderProps) {
  return (
    <div className="grid min-w-0 gap-3 border-b border-border pb-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-4 sm:pb-5">
      <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary-text sm:size-14 sm:rounded-2xl">
        <Icon className="size-5 sm:size-7" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 self-center">
        <PageHeader {...props} />
      </div>
    </div>
  );
}
