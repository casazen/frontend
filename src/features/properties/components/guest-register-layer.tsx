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

/** The name of the layer: the property it is about, so that a host with two properties knows which one is on screen. Until the property arrives, the plain name. */
export function GuestRegisterLayerTitle({ id }: DetailTitleProps) {
  const { t } = useTranslation();
  const property = useProperty(parseGuestRegisterLayerId(id) ?? '');
  const name = property.data?.name?.trim();
  return <>{name ? t('guestRegister.layer.titleFor', { property: name }) : t('guestRegister.layer.title')}</>;
}

/** What the server says is wrong with the read: the page (not found, not in Switzerland, no permission) or the period (the end before the start, too long). Any other failure has no words of its own: `null`. */
type Refusal = { page: string } | { period: GuestRegisterPeriodProblem };

function refusalOf(error: unknown): Refusal | null {
  const status = getHttpStatus(error);
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  if (status === 404) return { page: code === 'guest_register_not_available' ? 'guestRegister.layer.notAvailable' : 'guestRegister.layer.notFound' };
  if (status === 403) return { page: 'guestRegister.layer.forbidden' };
  if (status === 400) return { period: code === 'swiss_period_too_long' ? 'tooLong' : code === 'swiss_period_invalid' ? 'order' : 'missing' };
  return null;
}

/** A line the layer says in place of the register, with nothing asked of the server. */
function RegisterNotice({ textKey, testId }: { textKey: string; testId: string }) {
  const { t } = useTranslation();
  return (
    <p role="alert" className="text-sm text-foreground/70" data-testid={testId}>
      {t(textKey)}
    </p>
  );
}

/** What the count of the period says: how many guests, how long the regime asks the host to keep the register, or that nobody arrived. */
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

/** The sheet being printed: the table as the file holds it, for the property and the period it was made for. */
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
  // The last 30 days, ending today: the register is for the arrivals in progress too.
  const [period, setPeriod] = useState<GuestRegisterPeriod>(() => defaultRegisterPeriod());
  const problem = periodProblemOf(period);
  const info = useGuestRegisterInfo(propertyId, problem === null ? period : null);
  const download = useDownloadGuestRegister(propertyId);

  // The sheet to print holds the guests: it is in the page while the browser prints and not a moment longer.
  const [sheet, setSheet] = useState<PrintedSheet | null>(null);
  // A request is not cancelled when the layer is closed: if the file arrives after that there is no sheet to draw, and the browser must not print the page behind it.
  const isOpen = useRef(true);
  useEffect(() => {
    isOpen.current = true;
    return () => {
      isOpen.current = false;
    };
  }, []);
  const print = usePrintGuestRegister(propertyId, (table, printed) => {
    if (!isOpen.current) return;
    // The count was not up to date and nobody arrived in the period after all: there is nothing to sign, so nothing is printed. The layer says so and reads the count again.
    if (table.rows.length === 0) {
      toast.warning(t('guestRegister.preview.empty'));
      void info.refetch();
      return;
    }
    // The sheet has to be in the page when the browser draws it: it is drawn now, then printed, and taken away when the printing is over (or the layer is closed).
    flushSync(() => setSheet({ table, period: printed }));
    window.addEventListener('afterprint', () => setSheet(null), { once: true });
    window.print();
  });
  // Every button of the layer waits while any request of it is on its way.
  const busy = download.isPending || print.isPending;

  // A refusal comes first: a read that failed still holds the answer before it, and a 404 or a 403 must not show the count of a moment ago.
  const refusal = info.isError ? refusalOf(info.error) : null;
  if (refusal && 'page' in refusal) return <RegisterNotice textKey={refusal.page} testId="guest-register-problem" />;

  // A day that is still being typed is not a mistake: nothing is said (the buttons wait) until the period is a period that is wrong (the end before the start, a year and a day).
  const periodProblem = problem === 'missing' ? null : (problem ?? (refusal && 'period' in refusal ? refusal.period : null));
  const data = info.data;
  // There is something to keep or to print only when somebody arrived in the period (an empty period has the header alone: the line says so, and there is nothing to sign).
  const hasGuests = problem === null && data !== undefined && data.rowCount > 0;
  const loading = problem === null && data === undefined && !info.isError;
  // The printed sheet carries the name of the property in its header: «Stampa» waits for it (the register of nobody in particular is not a record to keep).
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

      {/* A read that failed for a reason that says nothing about the register (the line, a 5xx) while the count is on screen: the count stays, with a way to read it again. */}
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

  if (propertyId === null) return <RegisterNotice textKey="guestRegister.layer.notFound" testId="guest-register-problem" />;
  if (isLoading) return <SkeletonLine lines={3} />;
  if (!flags.guestRegistrationRegimes) return <RegisterNotice textKey="guestRegister.layer.unavailable" testId="guest-register-unavailable" />;
  if (!hasPermission('short-rent', 'guest.read') || !hasPermission('short-rent', 'booking.read')) {
    return <RegisterNotice textKey="guestRegister.layer.forbidden" testId="guest-register-problem" />;
  }
  return <GuestRegisterLayer key={propertyId} propertyId={propertyId} close={close} />;
}
