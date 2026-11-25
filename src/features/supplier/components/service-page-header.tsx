import type { ComponentProps } from 'react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';

type ServicePageHeaderProps = ComponentProps<typeof PageHeader> & { icon: LucideIcon };

export function ServicePageHeader(props: ServicePageHeaderProps) {
  return <PageHeader {...props} />;
}
