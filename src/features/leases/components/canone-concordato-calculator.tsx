import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useCanoneConcordatoEligibility } from '@/queries/use-canone-concordato';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getProblemMessage } from '@/lib/api-errors';
import type { CanoneConcordatoEligibility } from '@/api/canone-concordato.api';
import type { ConcordatoCharacteristics } from '@/types';

/** Range returned by the backend for the current inputs; `indicative` when the agreement data are Partial (A7-23). */
export interface ConcordatoRange {
  minMonthly: number;
  maxMonthly: number;
  indicative: boolean;
}

interface Props {
  propertyId: string;
  /** Lease start date (`YYYY-MM-DD` or ISO): the backend derives the term from the dates (A7-12). */
  startDate?: string;
  /** Lease end date, inclusive. */
  endDate?: string;
  onRangeChange?: (range: ConcordatoRange | null) => void;
  onCharacteristicsChange?: (characteristics: ConcordatoCharacteristics) => void;
}

const REASON_CODES = [
  'data_unavailable',
  'zone_required',
  'zone_not_found',
  'invalid_surface',
  'surface_out_of_bands',
  'invalid_element_counts',
  'term_too_short',
];

const WARNING_CODES = ['subfascia3_max_needs_more_d', 'no_duration_uplift_over_6_years'];

function toNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateOnly(value: string | undefined): string {
  return value ? value.slice(0, 10) : '';
}

/**
 * Canone concordato range (LT-10). The backend computes it from the unit characteristics and the lease dates; the same
 * computation runs again when the lease is created. Any change of an input or of the dates discards the range shown (A7-12).
 */
export function CanoneConcordatoCalculator({ propertyId, startDate, endDate, onRangeChange, onCharacteristicsChange }: Props) {
  const { t } = useTranslation();
  const eligibility = useCanoneConcordatoEligibility();
  const [sqm, setSqm] = useState('65');
  const [garageSqm, setGarageSqm] = useState('0');
  const [balconySqm, setBalconySqm] = useState('0');
  const [otherSqm, setOtherSqm] = useState('0');
  const [greenSqm, setGreenSqm] = useState('0');
  const [zone, setZone] = useState('');
  const [foglio, setFoglio] = useState('');
  const [typeACount, setTypeACount] = useState('2');
  const [typeBCount, setTypeBCount] = useState('3');
  const [typeCCount, setTypeCCount] = useState('0');
  const [typeDCount, setTypeDCount] = useState('0');
  const [qualifyingDCount, setQualifyingDCount] = useState('0');
  const [furnished, setFurnished] = useState(false);
  const [airConditioning, setAirConditioning] = useState(false);
  const [stoveHeating, setStoveHeating] = useState(false);

  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  const datesReady = start.length === 10 && end.length === 10;

  const characteristics = useMemo<ConcordatoCharacteristics>(
    () => ({
      sqm: toNumber(sqm),
      garageSqm: toNumber(garageSqm),
      balconySqm: toNumber(balconySqm),
      otherAppurtenanceSqm: toNumber(otherSqm),
      privateGreenSqm: toNumber(greenSqm),
      typeAElementCount: toNumber(typeACount),
      typeBElementCount: toNumber(typeBCount),
      typeCElementCount: toNumber(typeCCount),
      typeDElementCount: toNumber(typeDCount),
      qualifyingTypeDElementCount: toNumber(qualifyingDCount),
      stoveHeating,
      isFurnished: furnished,
      airConditioning,
      zoneName: zone.trim() || null,
      cadastralSheet: foglio.trim() || null,
    }),
    [sqm, garageSqm, balconySqm, otherSqm, greenSqm, typeACount, typeBCount, typeCCount, typeDCount,
      qualifyingDCount, stoveHeating, furnished, airConditioning, zone, foglio],
  );

  // A range belongs to the exact inputs and dates it was computed with (A7-12): it is shown, and reported to the form,
  // only while they are unchanged.
  const inputKey = useMemo(
    () => JSON.stringify([characteristics, start, end, propertyId]),
    [characteristics, start, end, propertyId],
  );
  const [computed, setComputed] = useState<{ key: string; data: CanoneConcordatoEligibility } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const result = computed?.key === inputKey ? computed.data : null;

  const latest = useRef({ inputKey, onRangeChange, onCharacteristicsChange });
  useEffect(() => {
    latest.current = { inputKey, onRangeChange, onCharacteristicsChange };
  });

  // Every change of the inputs or of the dates discards the range the form holds.
  useEffect(() => {
    latest.current.onRangeChange?.(null);
    latest.current.onCharacteristicsChange?.(characteristics);
  }, [inputKey, characteristics]);

  const handleCalculate = async () => {
    const key = inputKey;
    let data: CanoneConcordatoEligibility;
    try {
      data = await eligibility.mutateAsync({
        propertyId,
        query: {
          sqm: characteristics.sqm,
          garageSqm: characteristics.garageSqm,
          balconySqm: characteristics.balconySqm,
          otherAppurtenanceSqm: characteristics.otherAppurtenanceSqm,
          privateGreenSqm: characteristics.privateGreenSqm,
          typeACount: characteristics.typeAElementCount,
          typeBCount: characteristics.typeBElementCount,
          typeCCount: characteristics.typeCElementCount,
          typeDCount: characteristics.typeDElementCount,
          qualifyingTypeDCount: characteristics.qualifyingTypeDElementCount,
          furnished,
          airConditioning,
          stoveHeating,
          zone: characteristics.zoneName ?? undefined,
          foglio: characteristics.cadastralSheet ?? undefined,
          startDate: start,
          endDate: end,
        },
      });
    } catch {
      // Shown below from eligibility.error; the previous band no longer applies.
      setComputed(null);
      setFailedKey(key);
      if (latest.current.inputKey === key) latest.current.onRangeChange?.(null);
      return;
    }
    setComputed({ key, data });
    setFailedKey(null);
    // The inputs changed while the request was running: this range is for the old ones.
    if (latest.current.inputKey !== key) return;
    if (data.available && data.canoneMinMensile != null && data.canoneMaxMensile != null) {
      latest.current.onRangeChange?.({
        minMonthly: data.canoneMinMensile,
        maxMonthly: data.canoneMaxMensile,
        indicative: data.indicative !== false,
      });
    } else {
      latest.current.onRangeChange?.(null);
    }
  };

  const reasonText = (value: CanoneConcordatoEligibility) =>
    value.reasonCode && REASON_CODES.includes(value.reasonCode)
      ? t(`leases.canoneConcordato.reason.${value.reasonCode}`)
      : t('leases.canoneConcordato.unavailable');

  const band = (value: CanoneConcordatoEligibility) =>
    value.bandMinSqm == null
      ? null
      : value.bandMaxSqm == null
        ? t('leases.canoneConcordato.bandOver', { min: value.bandMinSqm })
        : t('leases.canoneConcordato.bandBetween', { min: value.bandMinSqm, max: value.bandMaxSqm });

  const id = (name: string) => `concordato-${name}-${propertyId}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('leases.canoneConcordato.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={id('sqm')} label={t('leases.canoneConcordato.sqm')}>
            <Input id={id('sqm')} type="number" min={1} step="0.01" value={sqm} onChange={(e) => setSqm(e.target.value)} required />
          </Field>
          <Field id={id('zone')} label={t('leases.canoneConcordato.zone')}>
            <Input
              id={id('zone')}
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              placeholder={t('leases.canoneConcordato.zonePlaceholder')}
            />
          </Field>
          <Field id={id('foglio')} label={t('leases.canoneConcordato.foglio')}>
            <Input id={id('foglio')} value={foglio} onChange={(e) => setFoglio(e.target.value)} />
          </Field>
          <Field id={id('garage')} label={t('leases.canoneConcordato.garageSqm')}>
            <Input id={id('garage')} type="number" min={0} step="0.01" value={garageSqm} onChange={(e) => setGarageSqm(e.target.value)} />
          </Field>
          <Field id={id('balcony')} label={t('leases.canoneConcordato.balconySqm')}>
            <Input id={id('balcony')} type="number" min={0} step="0.01" value={balconySqm} onChange={(e) => setBalconySqm(e.target.value)} />
          </Field>
          <Field id={id('other')} label={t('leases.canoneConcordato.otherAppurtenanceSqm')}>
            <Input id={id('other')} type="number" min={0} step="0.01" value={otherSqm} onChange={(e) => setOtherSqm(e.target.value)} />
          </Field>
          <Field id={id('green')} label={t('leases.canoneConcordato.privateGreenSqm')}>
            <Input id={id('green')} type="number" min={0} step="0.01" value={greenSqm} onChange={(e) => setGreenSqm(e.target.value)} />
          </Field>
          <Field id={id('typeA')} label={t('leases.canoneConcordato.typeA')}>
            <Input id={id('typeA')} type="number" min={0} value={typeACount} onChange={(e) => setTypeACount(e.target.value)} required />
          </Field>
          <Field id={id('typeB')} label={t('leases.canoneConcordato.typeB')}>
            <Input id={id('typeB')} type="number" min={0} value={typeBCount} onChange={(e) => setTypeBCount(e.target.value)} required />
          </Field>
          <Field id={id('typeC')} label={t('leases.canoneConcordato.typeC')}>
            <Input id={id('typeC')} type="number" min={0} value={typeCCount} onChange={(e) => setTypeCCount(e.target.value)} required />
          </Field>
          <Field id={id('typeD')} label={t('leases.canoneConcordato.typeD')}>
            <Input id={id('typeD')} type="number" min={0} value={typeDCount} onChange={(e) => setTypeDCount(e.target.value)} required />
          </Field>
          <Field id={id('qualifyingD')} label={t('leases.canoneConcordato.qualifyingTypeD')}>
            <Input
              id={id('qualifyingD')}
              type="number"
              min={0}
              value={qualifyingDCount}
              onChange={(e) => setQualifyingDCount(e.target.value)}
            />
          </Field>
          <CheckboxField id={id('furnished')} label={t('leases.canoneConcordato.furnished')} checked={furnished} onChange={setFurnished} />
          <CheckboxField
            id={id('airConditioning')}
            label={t('leases.canoneConcordato.airConditioning')}
            checked={airConditioning}
            onChange={setAirConditioning}
          />
          <CheckboxField
            id={id('stoveHeating')}
            label={t('leases.canoneConcordato.stoveHeating')}
            checked={stoveHeating}
            onChange={setStoveHeating}
          />
          <div className="space-y-2 sm:col-span-2">
            {!datesReady && (
              <p className="text-sm text-muted-foreground" data-testid="concordato-dates-required">
                {t('leases.canoneConcordato.datesRequired')}
              </p>
            )}
            <Button type="button" onClick={() => void handleCalculate()} disabled={eligibility.isPending || !datesReady}>
              {eligibility.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('leases.canoneConcordato.calculating')}
                </>
              ) : (
                t('leases.canoneConcordato.calculate')
              )}
            </Button>
          </div>
        </div>

        {eligibility.isError && failedKey === inputKey && (
          <p className="text-sm text-destructive" role="alert">
            {getProblemMessage(eligibility.error, t) ?? t('leases.canoneConcordato.error')}
          </p>
        )}

        {result && !result.available && (
          <p className="rounded-md border p-3 text-sm" data-testid="concordato-unavailable">
            {reasonText(result)}
          </p>
        )}

        {result?.available && (
          <div className="space-y-3 rounded-md border p-4 text-sm" data-testid="concordato-range">
            {result.indicative !== false && (
              <div
                role="status"
                data-testid="concordato-indicative"
                className="flex gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div className="space-y-1">
                  <p className="font-medium">{t('leases.canoneConcordato.indicativeTitle')}</p>
                  <p>{t('leases.canoneConcordato.indicativeWarning')}</p>
                  {result.lastVerifiedAt && (
                    <p className="text-muted-foreground">
                      {t('leases.canoneConcordato.lastVerified', { date: formatDate(result.lastVerifiedAt) })}
                    </p>
                  )}
                  {result.sourceUrl && (
                    <a className="underline" href={result.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {t('leases.canoneConcordato.source')}
                    </a>
                  )}
                </div>
              </div>
            )}
            <p>
              {t('leases.canoneConcordato.rangeYear')}:{' '}
              <strong>
                {formatCurrency(result.canoneMinAnnuo ?? 0)} – {formatCurrency(result.canoneMaxAnnuo ?? 0)}
              </strong>
            </p>
            <p>
              {t('leases.canoneConcordato.rangeMonth')}:{' '}
              {formatCurrency(result.canoneMinMensile ?? 0)} – {formatCurrency(result.canoneMaxMensile ?? 0)}
            </p>
            <p>
              {t('leases.canoneConcordato.subFascia')}: {result.subFascia} · {t('leases.canoneConcordato.zone')}: {result.zone}
              {band(result) && <> · {band(result)}</>}
            </p>
            {result.usableSqm != null && result.contractYears != null && (
              <p className="text-muted-foreground">
                {t('leases.canoneConcordato.computedWith', { sqm: result.usableSqm, years: result.contractYears })}
              </p>
            )}
            {(result.warnings ?? [])
              .filter((code) => WARNING_CODES.includes(code))
              .map((code) => (
                <p key={code} className="text-amber-700" data-testid={`concordato-warning-${code}`}>
                  {t(`leases.canoneConcordato.warning.${code}`)}
                </p>
              ))}
            <div className="grid gap-2 sm:grid-cols-2">
              <Benefit
                title={t('leases.canoneConcordato.imuTitle')}
                body={
                  result.imuAppliesTheoretical
                    ? t('leases.canoneConcordato.imuTheoretical')
                    : t('leases.canoneConcordato.imuNo')
                }
              />
              <Benefit
                title={t('leases.canoneConcordato.ataTitle')}
                body={
                  result.ataApplies
                    ? t('leases.canoneConcordato.ataYes')
                    : t('leases.canoneConcordato.ataPending')
                }
              />
            </div>
            {result.attestationRequired && (
              <p>{t('leases.canoneConcordato.attestationRequired')}</p>
            )}
            <p className="text-muted-foreground">{result.disclaimer}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function CheckboxField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

function Benefit({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground">{body}</p>
    </div>
  );
}
