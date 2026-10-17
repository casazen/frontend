import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Check, Clock, Copy, Eye, Pause, Pencil, Tag, Trash2 } from 'lucide-react';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListCardContent, ListMenuEntry, ListRowAction } from '@/components/shared/list-view/list-types';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import type { SupplierService } from '@/types/supplier-services';
import { ServiceThumb } from './components/service-thumb';
import { formatDuration, formatPrice } from './lib/service-labels';
import { NEW_SERVICE_PATH, bookingPreviewPath, draftPath, duplicatePath, servicePath } from './lib/service-paths';

const T = 'supplier.services';

export interface ServicesListOptions {
  /** The supplier has the most services it can have: a copy would be one more. */
  atLimit: boolean;
  /** A publication, a pause or a deletion is on its way: the buttons that start one wait. */
  busy: boolean;
  onPublish: (service: SupplierService) => unknown;
  onPause: (service: SupplierService) => unknown;
  onDelete: (service: SupplierService) => void;
}

/** What a draft still needs before it can be on offer, in words ("Da completare: Durata, Prezzo."). Nothing for a service that is not a draft. */
function missingText(service: SupplierService, t: TFunction): string | null {
  if (service.status !== 'Draft') return null;
  const names = service.missingForPublication.map((field) => t(`${T}.fields.${field === 'priceFromCents' ? 'price' : field === 'durationMinutes' ? 'duration' : field}`));
  return names.length > 0 ? t(`${T}.list.missing`, { fields: names.join(', ') }) : null;
}

/**
 * The list of the services of the supplier (SP-SERV, the unified list of UI-14): a row for each service with its state, price and
 * duration, the one thing to do about it by state (go on with a draft, put a paused one back on offer) and the rest in "⋯": edit,
 * see how customers see it, duplicate, pause or publish, delete. All the services are in the page (30 at most, one request), so the
 * list filters them itself. A row opens the page of the service. There is no search, no order to choose and no column to add: thirty
 * rows are read, not searched, so the only bar over them is the quick filters by state.
 */
export function useServicesList({ atLimit, busy, onPublish, onPause, onDelete }: ServicesListOptions) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  return useMemo(() => {
    const priceOf = (service: SupplierService) => formatPrice(service, t, language);

    /** The one action of a row, by state. A published service has none: its name is the way in. */
    const primaryAction = (service: SupplierService): ListRowAction | null => {
      if (service.status === 'Draft') {
        return { id: 'continue', label: t(`${T}.actions.continue`), icon: Pencil, href: draftPath(service.id), variant: 'secondary', testId: 'service-continue' };
      }
      if (service.status === 'Paused') {
        return { id: 'reactivate', label: t(`${T}.actions.reactivate`), icon: Check, onSelect: () => void onPublish(service), disabled: busy, variant: 'secondary', testId: 'service-reactivate' };
      }
      return null;
    };

    return defineList<SupplierService>({
      key: 'supplier-services',
      title: t(`${T}.title`),
      rowKey: (service) => service.id,
      rowLabel: (service) => service.name,
      columns: [
        {
          id: 'service',
          label: t(`${T}.table.service`),
          always: true,
          rowHeader: true,
          render: (service, cell) => {
            const missing = missingText(service, t);
            return (
              <div className="flex min-w-0 items-center gap-3">
                <ServiceThumb service={service} />
                <div className="min-w-0">
                  {cell.open(service.name)}
                  <span className="block break-words text-sm font-normal text-foreground/70">{getServiceCategoryLabel(service.category, t)}</span>
                  {missing ? <span className="block break-words text-sm font-normal text-foreground/70">{missing}</span> : null}
                </div>
              </div>
            );
          },
        },
        {
          id: 'price',
          label: t(`${T}.table.price`),
          always: true,
          align: 'end',
          render: (service) => <span className="font-medium text-foreground">{priceOf(service)}</span>,
        },
        {
          id: 'duration',
          label: t(`${T}.table.duration`),
          always: true,
          align: 'end',
          render: (service) => formatDuration(service.durationMinutes, t),
        },
        {
          id: 'status',
          label: t(`${T}.table.status`),
          always: true,
          render: (service) => <StatusBadge kind="serviceListing" status={service.status} />,
        },
      ],
      chips: [
        { id: 'all', label: t(`${T}.filters.all`), test: () => true },
        { id: 'active', label: t(`${T}.filters.Active`), test: (service) => service.status === 'Active' },
        { id: 'paused', label: t(`${T}.filters.Paused`), test: (service) => service.status === 'Paused' },
        { id: 'draft', label: t(`${T}.filters.Draft`), test: (service) => service.status === 'Draft' },
      ],
      primaryAction,
      menu: (service): ListMenuEntry[] => {
        const toggle: ListRowAction | null =
          service.status === 'Active'
            ? { id: 'pause', label: t(`${T}.actions.pause`), icon: Pause, onSelect: () => void onPause(service), disabled: busy, testId: 'service-pause' }
            : service.status === 'Draft' && service.publishable
              ? { id: 'publish', label: t(`${T}.actions.publish`), icon: Check, onSelect: () => void onPublish(service), disabled: busy, testId: 'service-publish' }
              : null;
        return [
          { id: 'edit', label: t(`${T}.actions.edit`), icon: Pencil, href: servicePath(service.id), testId: 'service-edit' },
          { id: 'preview', label: t(`${T}.actions.preview`), icon: Eye, href: bookingPreviewPath(service.id), testId: 'service-preview' },
          { id: 'duplicate', label: t(`${T}.actions.duplicate`), icon: Copy, href: atLimit ? undefined : duplicatePath(service.id), disabled: atLimit, testId: 'service-duplicate' },
          'separator',
          ...(toggle ? [toggle] : []),
          { id: 'delete', label: t(`${T}.actions.delete`), icon: Trash2, danger: true, onSelect: () => onDelete(service), disabled: busy, testId: 'service-delete' },
        ];
      },
      card: (service): ListCardContent => {
        const missing = missingText(service, t);
        return {
          lead: <ServiceThumb service={service} className="size-14" />,
          // The name is the way into the service: a line of text is 21 px, a finger needs 44.
          title: <span className="inline-flex min-h-11 items-center">{service.name}</span>,
          sub: getServiceCategoryLabel(service.category, t),
          status: <StatusBadge kind="serviceListing" status={service.status} />,
          meta: [
            { icon: Tag, text: priceOf(service), label: t(`${T}.table.price`) },
            { icon: Clock, text: formatDuration(service.durationMinutes, t), label: t(`${T}.table.duration`) },
          ],
          foot: missing ? <p className="break-words text-sm text-foreground/70">{missing}</p> : undefined,
        };
      },
      rowHref: (service) => servicePath(service.id),
      // With the sidebar open (from `lg`) four columns and an action do not fit under 1280 px: cards until then.
      cardsUntil: 'xl',
      csv: false,
      empty: {
        icon: Tag,
        title: t(`${T}.empty.title`),
        description: t(`${T}.empty.description`),
        action: { label: t(`${T}.actions.add`), href: NEW_SERVICE_PATH },
      },
      noResults: { title: t(`${T}.filters.emptyTitle`), description: t(`${T}.filters.emptyDescription`) },
      countLabel: (count) => t(`${T}.list.count`, { count }),
    });
  }, [t, language, atLimit, busy, onPublish, onPause, onDelete]);
}
