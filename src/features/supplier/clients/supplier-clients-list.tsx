import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { defineList } from '@/components/shared/list-view/define-list';
import type { SupplierClient } from '@/types/supplier-clients';
import { formatMoney } from '../services/lib/service-money';
import { ClientDetail } from './client-detail';
import { ClientTags } from './client-cells';
import { clientDay, clientName, clientRequestsPath } from './clients-model';

/**
 * The list of the customers of the supplier (UI-14, `client` mode): the server sends up to 200, the one with the latest activity first,
 * and the list searches the name, picks the type and sorts on what it holds (the names of the private customers are encrypted: the server
 * cannot search them, SP-D23). Four columns, a drawer with the detail and the way to the customer's requests. Nothing is exported
 * (SP-D25): the contacts of the private customers never leave the screen.
 */
export function useSupplierClientsList() {
  const { t, i18n } = useTranslation();

  return useMemo(
    () =>
      defineList<SupplierClient>({
        key: 'supplier-clients',
        title: t('supplier.clients.title'),
        rowKey: (client) => client.id,
        rowLabel: (client) => clientName(client, t),
        columns: [
          {
            id: 'client',
            label: t('supplier.clients.columns.client'),
            always: true,
            rowHeader: true,
            priority: 1,
            sort: (client) => clientName(client, t).toLowerCase(),
            render: (client, cell) => (
              <>
                {cell.open(clientName(client, t))}
                <ClientTags client={client} />
              </>
            ),
          },
          {
            id: 'jobs',
            label: t('supplier.clients.columns.jobs'),
            default: true,
            priority: 2,
            sort: (client) => client.jobsAccepted,
            render: (client) => t('supplier.clients.jobs', { count: client.jobsAccepted }),
          },
          {
            id: 'last',
            label: t('supplier.clients.columns.last'),
            default: true,
            priority: 3,
            sort: (client) => client.lastJobAt ?? null,
            render: (client) => (
              <>
                <span>{clientDay(client.lastJobAt, i18n.language) || t('supplier.clients.none')}</span>
                {client.nextJobAt ? (
                  <span className="block text-sm text-foreground/70">{t('supplier.clients.next', { day: clientDay(client.nextJobAt, i18n.language) })}</span>
                ) : null}
              </>
            ),
          },
          {
            id: 'paid',
            label: t('supplier.clients.columns.paid'),
            default: true,
            align: 'end',
            priority: 4,
            sort: (client) => client.grossPaidCents,
            render: (client) => formatMoney(client.grossPaidCents, i18n.language),
          },
        ],
        search: {
          label: t('supplier.clients.search'),
          placeholder: t('supplier.clients.searchPlaceholder'),
          text: (client) => clientName(client, t),
        },
        chips: [
          { id: 'tutti', label: t('supplier.clients.chips.all') },
          { id: 'host', label: t('supplier.clients.chips.host'), test: (client) => client.kind !== 'private' },
          { id: 'privati', label: t('supplier.clients.chips.private'), test: (client) => client.kind === 'private' },
          { id: 'abituali', label: t('supplier.clients.chips.regular'), hint: t('supplier.clients.chips.regularHint'), test: (client) => client.regular },
          { id: 'nuovi', label: t('supplier.clients.chips.new'), hint: t('supplier.clients.chips.newHint'), test: (client) => client.jobsAccepted === 0 },
        ],
        primaryAction: (client) => ({ id: 'requests', label: t('supplier.clients.requests'), href: clientRequestsPath(client.id), testId: `supplier-client-requests-${client.id}` }),
        detail: {
          title: (client) => clientName(client, t),
          render: (client) => <ClientDetail client={client} />,
        },
        csv: false,
        cardsUntil: 'xl',
        empty: {
          icon: Users,
          title: t('supplier.clients.empty.title'),
          description: t('supplier.clients.empty.description'),
        },
        noResults: { title: t('supplier.clients.noResults.title'), description: t('supplier.clients.noResults.description') },
        countLabel: (count) => t('supplier.clients.count', { count }),
      }),
    [t, i18n.language],
  );
}
