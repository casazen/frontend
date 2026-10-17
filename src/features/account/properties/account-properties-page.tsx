import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { useDetailDrawer } from '@/components/shared/detail-drawer/use-detail-drawer';
import { ListView } from '@/components/shared/list-view/list-view';
import { Button } from '@/components/ui/button';
import { useListViewsScope } from '@/hooks/use-list-views-scope';
import { useWorkspace } from '@/hooks/use-workspace';
import { ACCOUNT_BILLING_PATH } from '@/lib/billing-routes';
import { getPlanLimitMessage, getPlanTierLabel, getPlanUpgradeCta } from '@/lib/i18n-labels';
import { hasAccountBillingPage } from '@/lib/org-billing-admin';
import { useSetPropertyResponsible } from '@/queries/use-properties';
import { useCurrentUser, useEntitlement } from '@/queries/use-users';
import type { OrgMember } from '@/types/org-team.types';
import { readPlanUsage } from '../billing/account-billing-model';
import { AddPropertyDialog } from './add-property-dialog';
import type { AccountPropertyRow } from './account-properties-model';
import { useAccountPropertiesList } from './account-properties-list';
import { ACCOUNT_PROPERTY_DRAWER_KIND } from './account-property-drawer';
import { DeletePropertyDialog } from './delete-property-dialog';
import { ResponsiblePicker } from './responsible-picker';
import { useAccountPropertyRights, useAccountPropertyRows } from './use-account-property-rows';

const NO_MEMBERS: readonly OrgMember[] = [];

/**
 * The foot of the page: how many properties the plan counts (every property of the org, short and long) out of how many it allows.
 * It says nothing until the plan is known, and nothing of a count the answer does not carry (`readPlanUsage`): a note with holes in
 * it is no note, and it never takes the page down.
 */
function PlanFoot() {
  const { t } = useTranslation();
  const { contexts } = useWorkspace();
  const { data: entitlement } = useEntitlement();
  const meter = readPlanUsage(entitlement).properties;
  if (!entitlement || !meter) return null;

  const plan = getPlanTierLabel(entitlement.planTier, t);
  return (
    <p className="text-sm text-foreground/70" data-testid="account-properties-plan">
      {meter.max === null ? t('property.list.plan.usageUnlimited', { plan, used: meter.used }) : t('property.list.plan.usage', { plan, used: meter.used, max: meter.max })}
      {entitlement.canAddProperty === false ? (
        <>
          {' '}
          {getPlanLimitMessage()}.
          {hasAccountBillingPage(contexts) ? (
            <>
              {' '}
              <Link to={ACCOUNT_BILLING_PATH} className="font-medium text-primary underline underline-offset-4">
                {getPlanUpgradeCta()}
              </Link>
            </>
          ) : null}
        </>
      ) : null}
    </p>
  );
}

/**
 * Immobili, in the Amministrazione (AM-13): every property of the account, short-term and long-term, in the unified list. One row
 * each, with how it is let, its state, who is in charge and how many people can open it; the name opens a drawer that says who they
 * are and what waits for the property. What is done with a property is done in the pages that already exist (its page in its section,
 * its activation, the change of mode of PM-03, whose way back is this list); here the owner decides who looks after it, and deletes it.
 * Everything is read from the endpoints that are there (`GET /properties`, `/leases`, `/orgs/me/members`, `/entitlement`).
 */
export function AccountPropertiesPage() {
  const { t } = useTranslation();
  const { org } = useCurrentUser();
  const viewsScope = useListViewsScope();
  const rights = useAccountPropertyRights();
  const data = useAccountPropertyRows({ fresh: true });
  const { open: openDrawer } = useDetailDrawer();
  const { mutateAsync: setResponsible } = useSetPropertyResponsible();
  const [picker, setPicker] = useState<{ rows: AccountPropertyRow[]; onAllDone?: () => void } | null>(null);
  const [deleting, setDeleting] = useState<AccountPropertyRow | null>(null);
  const [adding, setAdding] = useState(false);

  const onWho = useCallback(
    (row: AccountPropertyRow) => {
      openDrawer(ACCOUNT_PROPERTY_DRAWER_KIND, row.property.id);
    },
    [openDrawer],
  );
  const onAssignOne = useCallback((row: AccountPropertyRow) => setPicker({ rows: [row] }), []);
  // The promise is the list's: it says "done" and offers "Annulla" when it resolves, so it resolves only when the dialog did it all.
  const onAssignMany = useCallback(
    (rows: AccountPropertyRow[]) =>
      rows.length === 0 ? Promise.reject(new Error('No property to put somebody in charge of')) : new Promise<void>((resolve) => setPicker({ rows, onAllDone: resolve })),
    [],
  );
  // What "Annulla" does: each property goes back to the person who was in charge before (or to nobody).
  const onRestore = useCallback(
    async (rows: AccountPropertyRow[]) => {
      for (const row of rows) await setResponsible({ id: row.property.id, userId: row.responsible?.userId ?? null });
    },
    [setResponsible],
  );
  const onAdd = useMemo(() => (rights.shortWrite || rights.longWrite ? () => setAdding(true) : undefined), [rights.shortWrite, rights.longWrite]);

  const list = useAccountPropertiesList({
    rights,
    membersKnown: data.membersKnown,
    peopleKnown: data.peopleKnown,
    onAssignOne,
    onAssignMany,
    onRestore,
    onDelete: setDeleting,
    onWho,
    onAdd,
  });

  // Some columns come from other reads than the properties: when one failed it is said, never filled with a guess.
  const unavailable = data.rows !== undefined && !data.othersLoading && !(data.membersKnown && data.peopleKnown && data.leasesKnown);

  return (
    <div className="min-w-0 space-y-6" data-testid="account-properties-page">
      <PageHeader
        title={t('nav.properties')}
        description={org?.name ? t('accountProperties.description', { org: org.name }) : t('accountProperties.descriptionNoOrg')}
        crumbs="auto"
        primary={onAdd ? { label: t('accountProperties.add.button'), icon: Plus, onClick: onAdd, testId: 'account-property-add' } : undefined}
      />

      {unavailable ? (
        <div role="status" className="flex flex-wrap items-center gap-3 text-sm text-foreground/70" data-testid="account-properties-unavailable">
          <p className="min-w-0 break-words">{t('accountProperties.unavailable')}</p>
          <Button type="button" variant="outline" size="sm" onClick={data.retryOthers}>
            {t('accountProperties.retry')}
          </Button>
        </div>
      ) : null}

      <ListView
        list={list}
        rows={data.rows ?? []}
        isLoading={data.isLoading}
        isError={data.isError}
        error={data.error}
        errorTitle={t('accountProperties.loadError')}
        onRetry={data.refetch}
        viewsScope={viewsScope}
        testId="account-properties-list"
      />

      <PlanFoot />

      <ResponsiblePicker rows={picker?.rows ?? null} members={data.members ?? NO_MEMBERS} onClose={() => setPicker(null)} onAllDone={picker?.onAllDone} />
      <DeletePropertyDialog row={deleting} onClose={() => setDeleting(null)} />
      <AddPropertyDialog open={adding} onOpenChange={setAdding} rights={rights} />
    </div>
  );
}
