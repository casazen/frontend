import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { comuneLabel } from '@/lib/comune-label';
import { useSupplierProfile } from '@/queries/use-supplier';
import type { SupplierProfile } from '@/types/supplier';
import { ZONE_PATH } from '../lib/service-paths';

const T = 'supplier.services.zone';
/** More than this and the list says "and N more": the page is about the service, not the map. */
const SHOWN = 6;

/** The comuni the supplier works in, as names: the ones chosen from the official list, then the ones written as text. */
function zoneNames(profile: SupplierProfile, codeOnly: (code: string) => string): string[] {
  const codes = profile.comuneIstatCodes ?? [];
  const described = new Map((profile.operatingComuni ?? []).map((comune) => [comune.istatCode, comune]));
  return [
    ...codes.map((code) => {
      const comune = described.get(code);
      return comune ? comuneLabel(comune) : codeOnly(code);
    }),
    ...(profile.comuni ?? []).filter((entry) => !codes.includes(entry)),
  ];
}

/**
 * Where the service is offered. The zone is not a choice of the service: it is the supplier's, the same for every service
 * (D10, zones are comuni), so this only shows it and says where to change it.
 */
export function ServiceZone() {
  const { t } = useTranslation();
  const { data: profile, isLoading, isError } = useSupplierProfile();

  if (isLoading) return <p className="text-sm text-foreground/70">{t(`${T}.loading`)}</p>;
  const names = profile && !isError ? zoneNames(profile, (code) => t('supplier.comuni.codeOnly', { code })) : [];

  return (
    <div className="min-w-0 space-y-3" data-testid="service-zone">
      {isError ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {t(`${T}.loadError`)}
        </p>
      ) : names.length === 0 ? (
        <p className="break-words text-sm text-foreground/70">{t(`${T}.none`)}</p>
      ) : (
        <>
          <p className="break-words text-sm">{t(`${T}.count`, { count: names.length })}</p>
          <ul role="list" className="flex flex-wrap gap-1.5">
            {names.slice(0, SHOWN).map((name) => (
              <li key={name} className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                <MapPin aria-hidden="true" className="size-3 shrink-0" />
                <span className="min-w-0 break-words">{name}</span>
              </li>
            ))}
            {names.length > SHOWN ? <li className="px-1 py-0.5 text-xs text-foreground/70">{t(`${T}.more`, { count: names.length - SHOWN })}</li> : null}
          </ul>
        </>
      )}
      <p className="break-words text-sm text-foreground/70">{t(`${T}.hint`)}</p>
      <Button asChild variant="outline" size="sm" className="min-h-11">
        <Link to={ZONE_PATH}>{t(`${T}.change`)}</Link>
      </Button>
    </div>
  );
}
