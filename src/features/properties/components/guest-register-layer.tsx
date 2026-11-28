import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { isAxiosError } from 'axios';
import { Download, Loader2, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { DetailContentProps, DetailTitleProps } from '@/components/shared/detail-drawer/detail-registry';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus, getProblemCode } from '@/lib/api-errors';
import { useDownloadGuestRegister, useGuestRegisterInfo, usePrintGuestRegister } from '@/queries/guestRegister';
import { useProperty } from '@/queries/use-properties';
import type { GuestRegisterInfo, GuestRegisterPeriod } from '@/types/guest-register.types';
import { defaultRegisterPeriod, periodProblemOf, type GuestRegisterPeriodProblem, type GuestRegisterTable } from '../lib/guest-register-model';
import { parseGuestRegisterLayerId } from '../lib/guest-register-address';
import { GuestRegisterSheet } from './guest-register-sheet';
import { LayerNotice } from '@/features/compliance/components/layer-notice';

/** The name of the layer: the property it is about, so that a host with two properties knows which one is on screen. Until the property arrives, the plain name. */
export function GuestRegisterLayerTitle({ id }: DetailTitleProps) {
  const { t } = useTranslation();
  const property = useProperty(parseGuestRegisterLayerId(id) ?? '');
  const name = property.data?.name?.trim();
  return <>{name ? t('guestRegister.layer.titleFor', { property: name }) : t('guestRegister.layer.title')}</>;
}

type Refusal = { page: string } | { period: GuestRegisterPeriodProblem };

function refusalOf(error: unknown): Refusal | null {
  const status = getHttpStatus(error);
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  if (status === 404) return { page: code === 'guest_register_not_available' ? 'guestRegister.layer.notAvailable' : 'guestRegister.layer.notFound' };
  if (status === 403) return { page: 'guestRegister.layer.forbidden' };
  if (status === 400) return { period: code === 'swiss_period_too_long' ? 'tooLong' : code === 'swiss_period_invalid' ? 'order' : 'missing' };
  return null;
}

function RegisterPreview({ info }: { info: GuestRegisterInfo }) {
  const { t } = useTranslation();
  const years = info.retentionYears;
  const retention =
    info.regimeCode === 'CH-UNKNOWN'
      ? t('guestRegister.preview.unknownPlace')
      : typeof years === 'number' && Number.isFinite(years) && years > 0
        ? t('guestRegister.preview.retention', { count: Math.floor(years) })
        : t('guestRegister.preview.unknownRetention');

  return (
    <div className="space-y-1" role="status" data-testid="guest-register-preview">
      <p className="text-sm font-medium" data-testid="guest-register-count">
        {info.rowCount > 0 ? t('guestRegister.preview.count', { count: info.rowCount }) : t('guestRegister.preview.empty')}
      </p>
      <p className="text-sm text-foreground/70" data-testid="guest-register-retention">
        {retention}
      </p>
    </div>
  );
}

interface PrintedSheet {
  table: GuestRegisterTable;
  period: GuestRegisterPeriod;
}

interface GuestRegisterLayerProps {
  propertyId: string;
  close: () => void;
}

function GuestRegisterLayer({ propertyId, close }: GuestRegisterLayerProps) {
  const { t } = useTranslation();
  const property = useProperty(propertyId);
  const [period, setPeriod] = useState<GuestRegisterPeriod>(() => defaultRegisterPeriod());
  const problem = periodProblemOf(period);
  const info = useGuestRegisterInfo(propertyId, problem === null ? period : null);
  const download = useDownloadGuestRegister(propertyId);

  const [sheet, setSheet] = useState<PrintedSheet | null>(null);
  const isOpen = useRef(true);
  useEffect(() => {
    isOpen.current = true;
    return () => {
      isOpen.current = false;
    };
  }, []);
  const print = usePrintGuestRegister(propertyId, (table, printed) => {
    if (!isOpen.current) return;
    if (table.rows.length === 0) {
      toast.warning(t('guestRegister.preview.empty'));
      void info.refetch();
      return;
    }
    flushSync(() => setSheet({ table, period: printed }));
    window.addEventListener('afterprint', () => setSheet(null), { once: true });
    window.print();
  });
  const busy = download.isPending || print.isPending;

  const refusal = info.isError ? refusalOf(info.error) : null;
  if (refusal && 'page' in refusal) return <LayerNotice textKey={refusal.page} testId="guest-register-problem" />;

  const periodProblem = problem === 'missing' ? null : (problem ?? (refusal && 'period' in refusal ? refusal.period : null));
  const data = info.data;
  const hasGuests = problem === null && data !== undefined && data.rowCount > 0;
  const loading = problem === null && data === undefined && !info.isError;
  const propertyName = property.data?.name?.trim() ?? '';

  return (
    <div className="space-y-5 pb-2" data-testid="guest-register-layer" aria-busy={busy || undefined}>
      <p className="text-sm text-foreground/70">{t('guestRegister.layer.intro')}</p>

      <fieldset className="space-y-3" data-testid="guest-register-period">
        <legend className="mb-2 text-sm font-semibold">{t('guestRegister.period.title')}</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('guestRegister.period.from')}>
            <Input type="date" value={period.from} onChange={(event) => setPeriod((current) => ({ ...current, from: event.target.value }))} data-testid="guest-register-from" />
          </Field>
          <Field label={t('guestRegister.period.to')} error={periodProblem ? t(`guestRegister.period.${periodProblem}`) : undefined}>
            <Input type="date" value={period.to} onChange={(event) => setPeriod((current) => ({ ...current, to: event.target.value }))} data-testid="guest-register-to" />
          </Field>
        </div>
        <p className="text-sm text-foreground/70">{t('guestRegister.period.hint')}</p>
      </fieldset>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-foreground/70" role="status" data-testid="guest-register-loading">
          <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          {t('guestRegister.preview.loading')}
        </p>
      ) : null}

      {info.isError && !refusal && !data ? (
        <div className="space-y-2" role="alert" data-testid="guest-register-error">
          <p className="text-sm text-destructive">{t('guestRegister.preview.failed')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void info.refetch()}>
            {t('shared.errorState.retry')}
          </Button>
        </div>
      ) : null}

      {info.isError && !refusal && data ? (
        <Alert
          variant="warning"
          data-testid="guest-register-stale"
          action={
            <Button type="button" variant="outline" size="sm" disabled={info.isFetching} onClick={() => void info.refetch()}>
              {t('shared.errorState.retry')}
            </Button>
          }
        >
          {t('guestRegister.preview.refreshFailed')}
        </Alert>
      ) : null}

      {data && problem === null ? <RegisterPreview info={data} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={!hasGuests || busy}
          loading={download.isPending}
          onClick={() => download.mutate(period)}
          iconRight={<Download />}
          data-testid="guest-register-download"
        >
          {t('guestRegister.actions.download')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!hasGuests || busy || propertyName === ''}
          loading={print.isPending}
          onClick={() => print.mutate(period)}
          iconRight={<Printer />}
          data-testid="guest-register-print"
        >
          {t('guestRegister.actions.print')}
        </Button>
      </div>

      <p className="text-sm text-foreground/70" data-testid="guest-register-responsibility">
        {t('guestRegister.layer.responsibility')}
      </p>

      <div className="flex justify-end">
        <Button type="button" variant="ghost" onClick={close} data-testid="guest-register-close">
          {t('guestRegister.layer.close')}
        </Button>
      </div>

      {sheet ? <GuestRegisterSheet table={sheet.table} propertyName={propertyName} period={sheet.period} /> : null}
    </div>
  );
}

/**
 * The guest register of a property in Switzerland (E31/F02/US02/T01, NF-130, decision D12b, casazen/backend#979), a kind of the detail drawer (`?detail=guest-register:<property>`):
 * the host picks a period (the last 30 days by default, at most 366), sees how many guests it holds and how long the canton asks to keep it, downloads the CSV or prints the table with
 * an empty column for the signature. The register is the host's own responsibility: CasaZen prepares it from the check-in, never stores it, sends it to nobody and gives no legal advice.
 *
 * It is hidden while `Features:GuestRegistrationRegimes` is off (the module is off: nothing is asked of the server), for who may not read the guests (`guest.read` and `booking.read`, what
 * the endpoints ask: nothing is asked for them either) and, by the answer of the server, for a property that is not in Switzerland.
 */
export function GuestRegisterLayerContent({ id, close }: DetailContentProps) {
  const { flags, isLoading } = useFeatureFlags();
  const { hasPermission } = useWorkspace();
  const propertyId = parseGuestRegisterLayerId(id);

  if (propertyId === null) return <LayerNotice textKey="guestRegister.layer.notFound" testId="guest-register-problem" />;
  if (isLoading) return <SkeletonLine lines={3} />;
  if (!flags.guestRegistrationRegimes) return <LayerNotice textKey="guestRegister.layer.unavailable" testId="guest-register-unavailable" />;
  if (!hasPermission('short-rent', 'guest.read') || !hasPermission('short-rent', 'booking.read')) {
    return <LayerNotice textKey="guestRegister.layer.forbidden" testId="guest-register-problem" />;
  }
  return <GuestRegisterLayer key={propertyId} propertyId={propertyId} close={close} />;
}
