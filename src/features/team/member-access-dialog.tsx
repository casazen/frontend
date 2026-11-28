import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { toastUndo } from '@/lib/toast-undo';
import { useOrgMemberProperties, useOrgTeamActions } from '@/queries/use-org-team';
import type { OrgPropertyScope } from '@/types/org-team.types';
import { AreaPropertyPicker } from './area-property-picker';
import type { PersonRow } from './people-rows';
import { areaName } from './team-labels';
import { usePickerProperties } from './team-properties';

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((value) => b.includes(value));

interface Before {
  areas: string[];
  scope: OrgPropertyScope;
  propertyIds: string[];
}

function AccessForm({ row, onClose }: { row: PersonRow; onClose: () => void }) {
  const { t } = useTranslation();
  const actions = useOrgTeamActions();
  const scopeSupported = row.role === 'Collaborator';
  const own = useOrgMemberProperties(row.id, scopeSupported, { fresh: true });
  const { properties, isError: propertiesFailed, refetch: retryProperties } = usePickerProperties();
  const grantedIds = useMemo(() => own.data?.properties.filter((property) => property.granted).map((property) => property.propertyId) ?? [], [own.data]);

  const [areas, setAreas] = useState<string[]>(row.areas);
  const [scope, setScope] = useState<OrgPropertyScope>(row.propertyScope);
  const [ticked, setTicked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const before = useRef<Before | null>(null);

  const chosen = ticked ?? grantedIds;
  const visible = new Set((properties ?? []).filter((property) => areas.includes(property.area)).map((property) => property.id));
  const toSend = [...new Set([...chosen.filter((id) => visible.has(id)), ...grantedIds.filter((id) => !visible.has(id))])];

  const areasChanged = !sameSet(areas, row.areas);
  const propertiesChanged = scopeSupported && (scope !== row.propertyScope || (scope === 'Selected' && !sameSet(toSend, grantedIds)));
  const loading = scopeSupported && own.isPending;

  const save = async () => {
    before.current ??= { areas: row.areas, scope: row.propertyScope, propertyIds: grantedIds };
    const original = before.current;
    setBusy(true);
    setError(null);
    let areasSaved = false;
    try {
      if (areasChanged) {
        await actions.setAreas(row.id, areas);
        areasSaved = true;
      }
      if (propertiesChanged) await actions.setProperties(row.id, scope, scope === 'Selected' ? toSend : []);
    } catch (failure) {
      const message = getProblemMessage(failure, t) ?? t('team.actions.failed');
      setError(areasSaved ? t('team.actions.access.partial', { message }) : message);
      setBusy(false);
      return;
    }
    onClose();
    const limited = scopeSupported && scope === 'Selected';
    toastUndo(t('team.actions.access.done', { name: row.name }), {
      description: limited
        ? t('team.actions.access.doneSome', { count: toSend.filter((id) => visible.has(id)).length })
        : t('team.actions.access.doneAreas', { areas: areas.map((area) => areaName(area, t)).join(', ') }),
      undo: async () => {
        if (areasChanged || !sameSet(areas, original.areas)) await actions.setAreas(row.id, original.areas);
        if (propertiesChanged) await actions.setProperties(row.id, original.scope, original.scope === 'Selected' ? original.propertyIds : []);
      },
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('team.actions.access.title', { name: row.name })}</DialogTitle>
        <DialogDescription>{t('team.actions.access.description')}</DialogDescription>
      </DialogHeader>

      {loading ? (
        <SkeletonLine lines={4} />
      ) : scopeSupported && own.isError ? (
        <Alert
          variant="danger"
          action={
            <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => void own.refetch()}>
              {t('team.retry')}
            </Button>
          }
        >
          {t('team.actions.access.loadError')}
        </Alert>
      ) : (
        <AreaPropertyPicker
          fullAccess={false}
          scopeSupported={scopeSupported}
          areas={areas}
          onAreasChange={setAreas}
          scope={scope}
          onScopeChange={setScope}
          propertyIds={chosen}
          onPropertyIdsChange={setTicked}
          properties={properties}
          propertiesFailed={propertiesFailed}
          onRetryProperties={retryProperties}
          disabled={busy}
        />
      )}

      {areas.length === 0 ? <p className="text-sm text-destructive">{t('team.invite.errors.areaRequired')}</p> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          {t('shared.cancel')}
        </Button>
        <Button
          type="button"
          onClick={() => void save()}
          loading={busy}
          disabled={loading || areas.length === 0 || (!areasChanged && !propertiesChanged)}
          data-testid="member-access-save"
        >
          {t('team.actions.access.save')}
        </Button>
      </DialogFooter>
    </>
  );
}

export function MemberAccessDialog({ row, open, onOpenChange }: { row: PersonRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">{open ? <AccessForm row={row} onClose={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}
