import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useCanoneConcordatoEligibility, useCanoneConcordatoZones } from '@/queries/use-canone-concordato';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getProblemMessage } from '@/lib/api-errors';
import type { CanoneConcordatoEligibility } from '@/api/canone-concordato.api';
import type { ConcordatoCharacteristics } from '@/types';
import { Disclosure } from '../guide/disclosure';
import { rentPlace } from '../guide/guide-answers';

interface Props {
  propertyId: string;
  /** Lease start date (`YYYY-MM-DD` or ISO): the backend derives the term from the dates (A7-12). */
  startDate?: string;
  /** Lease end date, inclusive. */
  endDate?: string;
  /** What the lease already says about the unit (the characteristics it was created with): the form starts from them. */
  initial?: ConcordatoCharacteristics | null;
  /** The monthly rent of the contract: with it the result is a sentence («il canone rientra nei limiti»). */
  rent?: number;
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

const WARNING_CODES = ['subfascia3_max_needs_more_d', 'no_duration_uplift_over_6_years', 'agreement_expired'];

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50';

function toNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateOnly(value: string | undefined): string {
  return value ? value.slice(0, 10) : '';
}

/** A measure the lease already knows, as the text of its field; the starting value of the field when it knows none. */
function startingValue(value: number | undefined, fallback: string): string {
  return value !== undefined && value > 0 ? String(value) : fallback;
}

/**
 * Canone concordato range (LT-10), asked in LR-GUIDE-1 as «Il canone rientra nei limiti dell'accordo?». The backend computes it from the
 * unit characteristics and the lease dates (the same computation runs again when the lease is created); any change of an input or of the
 * dates discards the range shown (A7-12). The form starts from what the lease already says about the unit, and the result is a sentence
 * about the rent of the contract; the range, the reasons and the warnings are one click away.
 */
export function CanoneConcordatoCalculator({ propertyId, startDate, endDate, initial, rent }: Props) {
  const { t } = useTranslation();
  const eligibility = useCanoneConcordatoEligibility();
  const zones = useCanoneConcordatoZones(propertyId);
  // Without a unit described by the lease nothing is pre-filled (A7-24): surface empty, every count at 0, until the landlord describes it.
  const [sqm, setSqm] = useState(() => startingValue(initial?.sqm, ''));
  const [garageSqm, setGarageSqm] = useState(() => startingValue(initial?.garageSqm, '0'));
  const [balconySqm, setBalconySqm] = useState(() => startingValue(initial?.balconySqm, '0'));
  const [otherSqm, setOtherSqm] = useState(() => startingValue(initial?.otherAppurtenanceSqm, '0'));
  const [greenSqm, setGreenSqm] = useState(() => startingValue(initial?.privateGreenSqm, '0'));
  const [zone, setZone] = useState(() => initial?.zoneName ?? '');
  const [foglio, setFoglio] = useState(() => initial?.cadastralSheet ?? '');
  const [typeACount, setTypeACount] = useState(() => String(initial?.typeAElementCount ?? 0));
  const [typeBCount, setTypeBCount] = useState(() => String(initial?.typeBElementCount ?? 0));
  const [typeCCount, setTypeCCount] = useState(() => String(initial?.typeCElementCount ?? 0));
  const [typeDCount, setTypeDCount] = useState(() => String(initial?.typeDElementCount ?? 0));
  const [qualifyingDCount, setQualifyingDCount] = useState(() => String(initial?.qualifyingTypeDElementCount ?? 0));
  const [furnished, setFurnished] = useState(initial?.isFurnished ?? false);
  const [airConditioning, setAirConditioning] = useState(initial?.airConditioning ?? false);
  const [stoveHeating, setStoveHeating] = useState(initial?.stoveHeating ?? false);

  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  const datesReady = start.length === 10 && end.length === 10;
  const surfaceReady = toNumber(sqm) > 0;
  const zoneOptions = zones.data?.zones ?? [];
  // A comune with a single zone (Seveso: the whole territory) needs no choice.
  const selectedZone = zoneOptions.length === 1 ? zoneOptions[0].name : zone;

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
      zoneName: selectedZone.trim() || null,
      cadastralSheet: foglio.trim() || null,
    }),
    [sqm, garageSqm, balconySqm, otherSqm, greenSqm, typeACount, typeBCount, typeCCount, typeDCount,
      qualifyingDCount, stoveHeating, furnished, airConditioning, selectedZone, foglio],
  );

  // A range belongs to the exact inputs and dates it was computed with (A7-12): it is shown only while they are unchanged.
  const inputKey = useMemo(
    () => JSON.stringify([characteristics, start, end, propertyId]),
    [characteristics, start, end, propertyId],
  );
  const [computed, setComputed] = useState<{ key: string; data: CanoneConcordatoEligibility } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const result = computed?.key === inputKey ? computed.data : null;

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
      return;
    }
    setComputed({ key, data });
    setFailedKey(null);
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
    <div className="space-y-4 text-sm" data-testid="canone-calculator">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id('sqm')} label={t('leases.canoneConcordato.sqm')}>
          <Input id={id('sqm')} type="number" min={1} step="0.01" value={sqm} onChange={(e) => setSqm(e.target.value)} required />
        </Field>
        <Field id={id('zone')} label={t('leases.canoneConcordato.zone')}>
          <ZoneSelect id={id('zone')} zones={zones} value={selectedZone} onChange={setZone} />
        </Field>
        <Field id={id('foglio')} label={t('leases.canoneConcordato.foglio')}>
          <Input id={id('foglio')} value={foglio} onChange={(e) => setFoglio(e.target.value)} />
        </Field>
      </div>

      <Disclosure summary={t('leaseGuide.rent.more')} testId="canone-more">
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
      </Disclosure>

      <div className="space-y-2">
        {!datesReady && (
          <p className="text-foreground/70" data-testid="concordato-dates-required">
            {t('leases.canoneConcordato.datesRequired')}
          </p>
        )}
        {!surfaceReady && (
          <p className="text-foreground/70" data-testid="concordato-sqm-required">
            {t('leases.canoneConcordato.sqmRequired')}
          </p>
        )}
        <Button
          type="button"
          className="min-h-11"
          onClick={() => void handleCalculate()}
          disabled={eligibility.isPending || !datesReady || !surfaceReady}
        >
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

      {eligibility.isError && failedKey === inputKey && (
        <p className="text-destructive" role="alert">
          {getProblemMessage(eligibility.error, t) ?? t('leases.canoneConcordato.error')}
        </p>
      )}

      {result && !result.available && (
        <p className="rounded-md border p-3" data-testid="concordato-unavailable">
          {reasonText(result)}
        </p>
      )}

      {result?.available && (
        <div className="space-y-3" data-testid="concordato-range">
          <Answer result={result} rent={rent} />
          <Disclosure summary={t('leaseGuide.rent.how')} testId="concordato-how">
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
                    <p className="text-foreground/70">
                      {t('leases.canoneConcordato.lastVerified', { date: formatDate(result.lastVerifiedAt) })}
                    </p>
                  )}
                  {result.agreementExpiresAt && (
                    <p className="text-foreground/70" data-testid="concordato-agreement-expiry">
                      {t(
                        result.agreementRemainsInForceUntilReplaced
                          ? 'leases.canoneConcordato.agreementExpiryUntilReplaced'
                          : 'leases.canoneConcordato.agreementExpiry',
                        { date: formatDate(result.agreementExpiresAt) },
                      )}
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
              {t('leases.canoneConcordato.rangeMonth')}: {formatCurrency(result.canoneMinMensile ?? 0)} –{' '}
              {formatCurrency(result.canoneMaxMensile ?? 0)}
            </p>
            <p>
              {t('leases.canoneConcordato.subFascia')}: {result.subFascia} · {t('leases.canoneConcordato.zone')}: {result.zone}
              {band(result) && <> · {band(result)}</>}
            </p>
            {result.usableSqm != null && result.contractYears != null && (
              <p className="text-foreground/70">
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
                body={result.imuAppliesTheoretical ? t('leases.canoneConcordato.imuTheoretical') : t('leases.canoneConcordato.imuNo')}
              />
              <Benefit
                title={t('leases.canoneConcordato.ataTitle')}
                body={result.ataApplies ? t('leases.canoneConcordato.ataYes') : t('leases.canoneConcordato.ataPending')}
              />
            </div>
            {result.attestationRequired && <p>{t('leases.canoneConcordato.attestationRequired')}</p>}
            <p className="text-foreground/70">{result.disclaimer}</p>
          </Disclosure>
        </div>
      )}
    </div>
  );
}

/** The answer to the question the tool is asked with: where the rent of the contract stands against the range, in one sentence. */
function Answer({ result, rent }: { result: CanoneConcordatoEligibility; rent: number | undefined }) {
  const { t } = useTranslation();
  const min = result.canoneMinMensile;
  const max = result.canoneMaxMensile;
  if (min == null || max == null) return null;

  const sentence =
    rent !== undefined && rent > 0
      ? t(`leaseGuide.rent.answer.${rentPlace(rent, min, max)}`, {
          rent: formatCurrency(rent),
          min: formatCurrency(min),
          max: formatCurrency(max),
        })
      : t('leaseGuide.rent.answer.noRent', { min: formatCurrency(min), max: formatCurrency(max) });

  return (
    <div className="space-y-1" data-testid="concordato-answer">
      <p className="text-base font-semibold leading-snug">{sentence}</p>
      {result.indicative !== false && <p className="text-foreground/70">{t('leaseGuide.rent.indicative')}</p>}
    </div>
  );
}

/**
 * Zones of the agreement from the API (A7-24): never free text, so the value always matches the agreement. Loading,
 * error and "no zones" are distinct states; with no agreement data the calculator still answers "data unavailable".
 */
function ZoneSelect({
  id,
  zones,
  value,
  onChange,
}: {
  id: string;
  zones: ReturnType<typeof useCanoneConcordatoZones>;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const options = zones.data?.zones ?? [];

  if (zones.isError) {
    return (
      <div className="space-y-1" role="alert" data-testid="concordato-zones-error">
        <p className="text-destructive">{getProblemMessage(zones.error, t) ?? t('leases.canoneConcordato.zonesError')}</p>
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void zones.refetch()}>
          {t('leases.canoneConcordato.retry')}
        </Button>
      </div>
    );
  }

  return (
    <>
      <select
        id={id}
        className={SELECT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={zones.isLoading || options.length <= 1}
      >
        {options.length !== 1 && (
          <option value="">
            {zones.isLoading ? t('leases.canoneConcordato.zonesLoading') : t('leases.canoneConcordato.zoneSelect')}
          </option>
        )}
        {options.map((zone) => (
          <option key={zone.name} value={zone.name}>
            {zone.cadastralSheets.length > 0
              ? t('leases.canoneConcordato.zoneWithSheets', { zone: zone.name, sheets: zone.cadastralSheets.join(', ') })
              : zone.name}
          </option>
        ))}
      </select>
      {zones.data && options.length === 0 && (
        <p className="text-foreground/70" data-testid="concordato-zones-empty">
          {t('leases.canoneConcordato.zonesEmpty')}
        </p>
      )}
    </>
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
      <p className="text-foreground/70">{body}</p>
    </div>
  );
}
