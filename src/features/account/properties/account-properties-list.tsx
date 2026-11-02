import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, Building2, CircleCheck, Expand, Home, Sun, Trash2, UserCheck, Users } from 'lucide-react';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListCardContent, ListEmpty, ListMenuEntry, ListRowAction, ListSwipeAction } from '@/components/shared/list-view/list-types';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { statusLabel } from '@/components/shared/status/status-view';
import { PropertyThumb } from '@/features/properties/components/property-thumb';
import { propertyModePath, propertyDetailPath } from '@/features/properties/mode/paths';
import { propertyActivationPath } from '@/features/properties/properties-paths';
import { formatPropertyLocation } from '@/features/properties/property-location';
import type { LongRentPropertyStatus, PropertyStatus } from '@/lib/status-dictionary';
import { areaKeyOf, missingText, type AccountPropertyRights, type AccountPropertyRow, type AccountPropertyState } from './account-properties-model';
import { ModeTag, PeopleButton, ScheduledChange, StateCell, Unknown } from './account-property-cells';
// The drawer registers its kind when its module is loaded: the list is what opens it.
import { ACCOUNT_PROPERTY_DRAWER_KIND } from './account-property-drawer';

export interface AccountPropertiesListOptions {
  rights: AccountPropertyRights;
  /** The members were read: only then is anybody named as in charge, filtered by, or offered. */
  membersKnown: boolean;
  /** The number of people who reach each property was read. */
  peopleKnown: boolean;
  /** Puts somebody in charge of one property (the dialog). */
  onAssignOne: (row: AccountPropertyRow) => void;
  /** Puts somebody in charge of the selected properties. It resolves when it is done, never when the person gives up. */
  onAssignMany: (rows: AccountPropertyRow[]) => Promise<void>;
  /** Takes the persons in charge back to what they were before `onAssignMany`. */
  onRestore: (rows: AccountPropertyRow[]) => Promise<void>;
  onDelete: (row: AccountPropertyRow) => void;
  /** The drawer of a property, which says who can open it. */
  onWho: (row: AccountPropertyRow) => void;
  /** Add a property: the dialog that asks in which section. `undefined` for who may add none. */
  onAdd: (() => void) | undefined;
}

/** The states in the order the owner has to look at them: what is blocked first, what is let last. */
const STATE_RANK: Record<AccountPropertyState['kind'], Record<string, number>> = {
  property: { Suspended: 0, Pending: 1, Paused: 2, Active: 3 } satisfies Record<PropertyStatus, number>,
  longRentProperty: { Free: 4, Rented: 5 } satisfies Record<LongRentPropertyStatus, number>,
};

const rankOf = (state: AccountPropertyState | null) => (state ? (STATE_RANK[state.kind][state.status] ?? 9) : null);

const stateKey = (state: AccountPropertyState) => `${state.kind}:${state.status}`;

/** The value of the filter «Responsabile» that stands for the properties nobody is in charge of. */
const NOBODY_FILTER = '-';

/**
 * The list of the properties of the account, in the words of the owner: the unified list (UI-14) with one row for each property
 * of every section, how it is let, its state, who is in charge and how many people can open it. The name opens its drawer; the
 * pages of a property are the ones of its section. All the rows are in the page (`GET /properties`), so the list searches,
 * filters and sorts them itself.
 *
 * The design also has what the long-term properties lack (APE, cadastral data, rent) and "passes to long-term from 15 November"
 * on the row. The property records do not carry them (a document, a field that is not in the model, a change that is read one
 * property at a time), so they are not here and not made up: the scheduled change is in the drawer.
 */
export function useAccountPropertiesList({
  rights,
  membersKnown,
  peopleKnown,
  onAssignOne,
  onAssignMany,
  onRestore,
  onDelete,
  onWho,
  onAdd,
}: AccountPropertiesListOptions) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { shortRead, shortWrite, longRead, longWrite } = rights;

  return useMemo(() => {
    const canRead = (row: AccountPropertyRow) => (row.mode === 'Long' ? longRead : shortRead);
    const canWrite = (row: AccountPropertyRow) => (row.mode === 'Long' ? longWrite : shortWrite);

    const primaryAction = (row: AccountPropertyRow): ListRowAction | null =>
      row.needsCompleting && shortWrite
        ? { id: 'complete', label: t('accountProperties.list.actions.complete'), icon: CircleCheck, href: propertyActivationPath(row.property.id), variant: 'default', testId: 'account-property-complete' }
        : null;

    const toSwipe = (action: ListRowAction | null, tone: ListSwipeAction['tone']): ListSwipeAction | null =>
      action ? { id: action.id, label: action.label, icon: action.icon, tone, href: action.href, onSelect: action.onSelect } : null;

    const personInCharge = (row: AccountPropertyRow) => (row.responsible ? row.responsible.name : t('accountProperties.list.nobody'));

    const empty: ListEmpty = {
      icon: Building2,
      title: t('accountProperties.list.emptyTitle'),
      description: t('accountProperties.list.emptyDescription'),
      action: onAdd ? { label: t('accountProperties.add.button'), onClick: onAdd } : undefined,
    };

    return defineList<AccountPropertyRow>({
      key: 'account-properties',
      title: t('accountProperties.list.title'),
      rowKey: (row) => row.property.id,
      rowLabel: (row) => row.property.name,
      columns: [
        {
          id: 'property',
          label: t('accountProperties.list.columns.property'),
          always: true,
          default: true,
          rowHeader: true,
          sort: (row) => row.property.name,
          render: (row, cell) => (
            <div className="flex min-w-0 items-center gap-3">
              <PropertyThumb photoUrls={row.property.photoUrls} />
              <div className="min-w-0">
                {cell.open(row.property.name)}
                <span className="block break-words text-sm font-normal text-foreground/70">{formatPropertyLocation(row.property)}</span>
              </div>
            </div>
          ),
        },
        {
          id: 'mode',
          label: t('accountProperties.list.columns.mode'),
          default: true,
          sort: (row) => row.mode,
          render: (row) => <ModeTag row={row} />,
        },
        {
          id: 'state',
          label: t('accountProperties.list.columns.state'),
          default: true,
          sort: (row) => rankOf(row.state),
          render: (row) => <StateCell row={row} />,
        },
        {
          id: 'responsible',
          label: t('accountProperties.list.columns.responsible'),
          default: true,
          sort: (row) => row.responsible?.name ?? null,
          render: (row) => (membersKnown ? <span className="break-words">{personInCharge(row)}</span> : <Unknown />),
        },
        {
          id: 'people',
          label: t('accountProperties.list.columns.people'),
          default: true,
          sort: (row) => row.people,
          render: (row) => <PeopleButton row={row} onWho={onWho} />,
        },
      ],
      search: {
        label: t('accountProperties.list.search'),
        placeholder: t('accountProperties.list.searchPlaceholder'),
        text: (row) => [row.property.name, row.property.city, row.property.address, row.property.postalCode, row.property.unit, row.responsible?.name].filter(Boolean).join(' '),
      },
      chips: [
        { id: 'all', label: t('accountProperties.list.chips.all'), test: () => true },
        { id: 'short', label: t('accountProperties.list.chips.short'), icon: Sun, test: (row) => row.mode === 'Short' },
        { id: 'long', label: t('accountProperties.list.chips.long'), icon: Home, test: (row) => row.mode === 'Long' },
        { id: 'todo', label: t('accountProperties.list.chips.todo'), hint: t('accountProperties.list.chips.todoHint'), urgent: true, test: (row) => row.needsCompleting },
      ],
      filters: [
        ...(membersKnown
          ? [
              {
                id: 'responsible',
                type: 'select' as const,
                label: t('accountProperties.list.filters.responsible'),
                allLabel: t('accountProperties.list.filters.allResponsibles'),
                // The person is the account id (a name can hold a comma, which the address uses to separate values); `-` is nobody.
                options: (rows: readonly AccountPropertyRow[]) => [
                  ...[...new Map(rows.flatMap((row) => (row.responsible ? [[row.responsible.userId, row.responsible.name] as const] : []))).entries()]
                    .sort(([, a], [, b]) => a.localeCompare(b, language))
                    .map(([userId, name]) => ({ value: userId, label: name })),
                  ...(rows.some((row) => !row.responsible) ? [{ value: NOBODY_FILTER, label: t('accountProperties.list.nobody') }] : []),
                ],
                test: (row: AccountPropertyRow, value: string) => (value === NOBODY_FILTER ? !row.responsible : row.responsible?.userId === value),
              },
            ]
          : []),
        {
          id: 'state',
          type: 'select' as const,
          label: t('accountProperties.list.filters.state'),
          allLabel: t('accountProperties.list.filters.allStates'),
          options: (rows: readonly AccountPropertyRow[]) => {
            const states = new Map<string, AccountPropertyState>();
            for (const row of rows) if (row.state) states.set(stateKey(row.state), row.state);
            return [...states.values()]
              .sort((a, b) => (rankOf(a) ?? 9) - (rankOf(b) ?? 9))
              .map((state) => ({ value: stateKey(state), label: statusLabel(state.kind, state.status, 'host', t, i18n) }));
          },
          test: (row: AccountPropertyRow, value: string) => (row.state ? stateKey(row.state) === value : false),
        },
      ],
      defaultSort: 'property:asc',
      primaryAction,
      menu: (row): ListMenuEntry[] => {
        const area = areaKeyOf(row.mode);
        const entries: (ListMenuEntry | null)[] = [
          canRead(row)
            ? { id: 'page', label: t('accountProperties.list.actions.page'), icon: Expand, href: propertyDetailPath(area, row.property.id), testId: 'account-property-page' }
            : null,
          { id: 'who', label: t('accountProperties.list.actions.who'), icon: Users, onSelect: () => onWho(row), testId: 'account-property-who' },
          canWrite(row)
            ? {
                id: 'mode',
                label: t(row.mode === 'Long' ? 'accountProperties.list.actions.toShort' : 'accountProperties.list.actions.toLong'),
                icon: ArrowRightLeft,
                href: propertyModePath(area, row.property.id, 'account'),
                testId: 'account-property-mode',
              }
            : null,
          membersKnown && canWrite(row)
            ? { id: 'assign', label: t('accountProperties.list.actions.assign'), icon: UserCheck, onSelect: () => onAssignOne(row), testId: 'account-property-assign' }
            : null,
          // The endpoint is the one of the short-term section (`PropertyWrite`), for a property of either mode.
          shortWrite && canWrite(row) ? 'separator' : null,
          shortWrite && canWrite(row)
            ? { id: 'delete', label: t('accountProperties.list.actions.delete'), icon: Trash2, danger: true, onSelect: () => onDelete(row), testId: 'account-property-delete' }
            : null,
        ];
        return entries.filter((entry): entry is ListMenuEntry => entry !== null);
      },
      bulk:
        membersKnown && (shortWrite || longWrite)
          ? [
              {
                id: 'assign',
                label: t('accountProperties.list.bulk.assign'),
                icon: UserCheck,
                run: (rows) => onAssignMany(rows.filter(canWrite)),
                undo: (rows) => onRestore(rows.filter(canWrite)),
                doneMessage: (count) => t('accountProperties.responsible.done', { count }),
              },
            ]
          : undefined,
      swipe: (row) => ({ left: toSwipe(primaryAction(row), 'accent') }),
      card: (row): ListCardContent => ({
        lead: <PropertyThumb photoUrls={row.property.photoUrls} className="size-14" />,
        title: row.property.name,
        sub: `${t(row.mode === 'Long' ? 'accountProperties.mode.long' : 'accountProperties.mode.short')} · ${row.property.city || formatPropertyLocation(row.property)}`,
        status:
          row.state?.kind === 'property' ? (
            <StatusBadge kind="property" status={row.state.status} />
          ) : row.state?.kind === 'longRentProperty' ? (
            <StatusBadge kind="longRentProperty" status={row.state.status} />
          ) : undefined,
        meta: [
          ...(membersKnown ? [{ icon: UserCheck, text: personInCharge(row), label: t('accountProperties.list.columns.responsible') }] : []),
          ...(peopleKnown && row.people !== null ? [{ icon: Users, text: t('accountProperties.list.people', { count: row.people }), label: t('accountProperties.list.columns.people') }] : []),
        ],
        foot:
          row.missing.length > 0 || row.property.scheduledModeChange ? (
            <div className="space-y-0.5">
              {row.missing.length > 0 ? <p className="text-sm text-foreground/70">{missingText(row.missing, t)}</p> : null}
              <ScheduledChange row={row} className="block break-words text-sm text-foreground/70" />
            </div>
          ) : undefined,
      }),
      // The name of the property opens its drawer; its page is the first entry of "⋯" and the button of the drawer.
      detail: { drawerKind: ACCOUNT_PROPERTY_DRAWER_KIND },
      rowHref: (row) => (canRead(row) ? propertyDetailPath(areaKeyOf(row.mode), row.property.id) : undefined),
      cardsUntil: 'xl',
      csv: false,
      empty,
      noResults: { title: t('accountProperties.list.noResults.title'), description: t('accountProperties.list.noResults.description') },
      countLabel: (count) => t('accountProperties.list.count', { count }),
    });
  }, [t, i18n, language, shortRead, shortWrite, longRead, longWrite, membersKnown, peopleKnown, onAssignOne, onAssignMany, onRestore, onDelete, onWho, onAdd]);
}
