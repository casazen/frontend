import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/shared/form-field-error';
import { getProblemMessage } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import { useMunicipalityRate, useSaveMunicipalityRate } from '@/queries/use-checkin-wizard';
import type { SaveMunicipalityRateRequest } from '@/types/checkin-wizard.types';
import { rateEffectiveFrom } from '../lib/checkin-wizard-model';

/** What the API accepts of a declared rate: 0.01 to 50 per person per night, an exemption age of 0 to 18, a source of at most 500 characters. */
const MIN_RATE = 0.01;
const MAX_RATE = 50;
const MAX_EXEMPTION_AGE = 18;
const MAX_SOURCE_LENGTH = 500;
const SEASON_DAY = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** A number typed with a comma or a point, or null when it is not one. */
function parseNumber(value: string): number | null {
  const text = value.trim().replace(',', '.');
  if (text === '') return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

/** The fields of the form as typed. The messages are i18n keys, shown by `FormFieldError`. */
const rateFormSchema = z
  .object({
    rate: z.string(),
    minimumAge: z.string(),
    maxNights: z.string(),
    seasonStart: z.string(),
    seasonEnd: z.string(),
    sourceNote: z.string(),
  })
  .superRefine((values, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });

    const rate = parseNumber(values.rate);
    if (rate === null || rate < MIN_RATE || rate > MAX_RATE) issue('rate', 'checkin.wizard.tax.rateForm.rateInvalid');

    const age = parseNumber(values.minimumAge);
    if (age === null || !Number.isInteger(age) || age < 0 || age > MAX_EXEMPTION_AGE) issue('minimumAge', 'checkin.wizard.tax.rateForm.ageInvalid');

    if (values.maxNights.trim() !== '') {
      const nights = parseNumber(values.maxNights);
      if (nights === null || !Number.isInteger(nights) || nights < 1) issue('maxNights', 'checkin.wizard.tax.rateForm.nightsInvalid');
    }

    const start = values.seasonStart.trim();
    const end = values.seasonEnd.trim();
    if ((start === '') !== (end === '')) {
      issue(start === '' ? 'seasonStart' : 'seasonEnd', 'checkin.wizard.tax.rateForm.seasonBoth');
    } else if (start !== '') {
      if (!SEASON_DAY.test(start)) issue('seasonStart', 'checkin.wizard.tax.rateForm.seasonInvalid');
      if (!SEASON_DAY.test(end)) issue('seasonEnd', 'checkin.wizard.tax.rateForm.seasonInvalid');
    }

    const source = values.sourceNote.trim();
    if (source === '') issue('sourceNote', 'checkin.wizard.tax.rateForm.sourceRequired');
    else if (source.length > MAX_SOURCE_LENGTH) issue('sourceNote', 'checkin.wizard.tax.rateForm.sourceTooLong');
  });

type RateFormValues = z.infer<typeof rateFormSchema>;
type RateFormErrors = Partial<Record<keyof RateFormValues, string>>;

function requestOf(values: RateFormValues, effectiveFrom: string): SaveMunicipalityRateRequest {
  const maxNights = parseNumber(values.maxNights);
  const seasonStart = values.seasonStart.trim();
  const seasonEnd = values.seasonEnd.trim();
  return {
    ratePerPersonPerNight: parseNumber(values.rate) ?? 0,
    minimumAge: parseNumber(values.minimumAge) ?? 0,
    maxNights: maxNights === null ? null : Math.trunc(maxNights),
    seasonStart: seasonStart === '' ? null : seasonStart,
    seasonEnd: seasonEnd === '' ? null : seasonEnd,
    effectiveFrom,
    sourceNote: values.sourceNote.trim(),
  };
}

interface TaxRateSubstepProps {
  bookingId: string;
  propertyId: string;
  /** The check-in day of the stay (`YYYY-MM-DD`): the rate must apply from it, or the stay in front of the host would still lack one. */
  checkIn: string;
  /** Called when the rate is saved or the host gives up: the tax step shows again. */
  onClose: () => void;
}

/**
 * "Enter your municipality tax" (NF-46, ADR-037-R5): the rate the host declares for a comune that has no official one in CasaZen, private to the
 * organization: the amount per person per night, the season, the age under which guests are exempt, the night cap and where the amount comes
 * from. It sits inside the form of the wizard, so it is not a form of its own: its fields are plain controls, its buttons do not submit, and
 * saving it returns to the same step, where the tax is worked out again with it.
 */
export function TaxRateSubstep({ bookingId, propertyId, checkIn, onClose }: TaxRateSubstepProps) {
  const { t } = useTranslation();
  const rate = useMunicipalityRate(propertyId);
  const save = useSaveMunicipalityRate(bookingId, propertyId);
  const declared = rate.data?.rate;
  const [edits, setEdits] = useState<Partial<RateFormValues>>({});
  const [errors, setErrors] = useState<RateFormErrors>({});
  const [problem, setProblem] = useState<string | null>(null);

  // What the organization declared before is the starting point; what the host types replaces it.
  const values: RateFormValues = {
    rate: edits.rate ?? (declared ? String(declared.ratePerPersonPerNight) : ''),
    minimumAge: edits.minimumAge ?? (declared ? String(declared.minimumAge) : ''),
    maxNights: edits.maxNights ?? (declared?.maxNights ? String(declared.maxNights) : ''),
    seasonStart: edits.seasonStart ?? declared?.seasonStart ?? '',
    seasonEnd: edits.seasonEnd ?? declared?.seasonEnd ?? '',
    sourceNote: edits.sourceNote ?? declared?.sourceNote ?? '',
  };
  const change = (name: keyof RateFormValues, value: string) => setEdits((previous) => ({ ...previous, [name]: value }));

  const submit = async () => {
    setProblem(null);
    const parsed = rateFormSchema.safeParse(values);
    if (!parsed.success) {
      const found: RateFormErrors = {};
      for (const issue of parsed.error.issues) {
        const name = issue.path[0] as keyof RateFormValues;
        found[name] ??= issue.message;
      }
      setErrors(found);
      // The first field in error takes the focus (NF-11).
      const first = (['rate', 'minimumAge', 'maxNights', 'seasonStart', 'seasonEnd', 'sourceNote'] as const).find((name) => found[name]);
      if (first) document.getElementById(`tax-rate-${first}`)?.focus();
      return;
    }
    setErrors({});
    try {
      await save.mutateAsync(requestOf(values, rateEffectiveFrom(declared?.effectiveFrom, checkIn, todayInRome())));
      onClose();
    } catch (error) {
      setProblem(getProblemMessage(error, t) ?? t('checkin.wizard.tax.rateForm.saveFailed'));
    }
  };

  const idOf = (name: keyof RateFormValues) => `tax-rate-${name}`;
  const a11yOf = (name: keyof RateFormValues) => ({
    id: idOf(name),
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': `${idOf(name)}-error`,
  });
  // The attributes of each field, ready for the markup: its id, whether it is in error, and where the error is read.
  const a11y = {
    rate: a11yOf('rate'),
    minimumAge: a11yOf('minimumAge'),
    maxNights: a11yOf('maxNights'),
    seasonStart: a11yOf('seasonStart'),
    seasonEnd: a11yOf('seasonEnd'),
    sourceNote: a11yOf('sourceNote'),
  };

  return (
    <section className="space-y-4 rounded-md border p-4" aria-labelledby="tax-rate-title" data-testid="checkin-wizard-tax-rate">
      <div className="space-y-1">
        <h3 id="tax-rate-title" className="text-base font-semibold">
          {t('checkin.wizard.tax.rateForm.title')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {rate.data?.city ? t('checkin.wizard.tax.rateForm.introCity', { city: rate.data.city }) : t('checkin.wizard.tax.rateForm.intro')}
        </p>
      </div>

      {rate.data?.officialRateInForce && (
        <p role="status" className="text-sm text-orange-700" data-testid="tax-rate-official">
          {t('checkin.wizard.tax.rateForm.officialExists')}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={idOf('rate')}>{t('checkin.wizard.tax.rateForm.rate')}</Label>
          <Input
            inputMode="decimal"
            className="h-11"
            value={values.rate}
            onChange={(event) => change('rate', event.target.value)}
            {...a11y.rate}
          />
          <FormFieldError id={`${idOf('rate')}-error`} message={errors.rate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={idOf('minimumAge')}>{t('checkin.wizard.tax.rateForm.age')}</Label>
          <Input
            inputMode="numeric"
            className="h-11"
            value={values.minimumAge}
            onChange={(event) => change('minimumAge', event.target.value)}
            {...a11y.minimumAge}
          />
          <p className="text-xs text-muted-foreground">{t('checkin.wizard.tax.rateForm.ageHint')}</p>
          <FormFieldError id={`${idOf('minimumAge')}-error`} message={errors.minimumAge} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={idOf('maxNights')}>{t('checkin.wizard.tax.rateForm.nights')}</Label>
          <Input
            inputMode="numeric"
            className="h-11"
            value={values.maxNights}
            onChange={(event) => change('maxNights', event.target.value)}
            {...a11y.maxNights}
          />
          <p className="text-xs text-muted-foreground">{t('checkin.wizard.tax.rateForm.nightsHint')}</p>
          <FormFieldError id={`${idOf('maxNights')}-error`} message={errors.maxNights} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={idOf('seasonStart')}>{t('checkin.wizard.tax.rateForm.seasonStart')}</Label>
          <Input
            className="h-11"
            maxLength={5}
            placeholder={t('checkin.wizard.tax.rateForm.seasonPlaceholder')}
            value={values.seasonStart}
            onChange={(event) => change('seasonStart', event.target.value)}
            {...a11y.seasonStart}
          />
          <FormFieldError id={`${idOf('seasonStart')}-error`} message={errors.seasonStart} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={idOf('seasonEnd')}>{t('checkin.wizard.tax.rateForm.seasonEnd')}</Label>
          <Input
            className="h-11"
            maxLength={5}
            placeholder={t('checkin.wizard.tax.rateForm.seasonPlaceholder')}
            value={values.seasonEnd}
            onChange={(event) => change('seasonEnd', event.target.value)}
            {...a11y.seasonEnd}
          />
          <p className="text-xs text-muted-foreground">{t('checkin.wizard.tax.rateForm.seasonHint')}</p>
          <FormFieldError id={`${idOf('seasonEnd')}-error`} message={errors.seasonEnd} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={idOf('sourceNote')}>{t('checkin.wizard.tax.rateForm.source')}</Label>
          <Input
            className="h-11"
            maxLength={MAX_SOURCE_LENGTH}
            value={values.sourceNote}
            onChange={(event) => change('sourceNote', event.target.value)}
            {...a11y.sourceNote}
          />
          <p className="text-xs text-muted-foreground">{t('checkin.wizard.tax.rateForm.sourceHint')}</p>
          <FormFieldError id={`${idOf('sourceNote')}-error`} message={errors.sourceNote} />
        </div>
      </div>

      {problem && (
        <p role="alert" className="text-sm text-destructive" data-testid="tax-rate-problem">
          {problem}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={save.isPending || rate.isLoading} onClick={() => void submit()} data-testid="tax-rate-save">
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('checkin.wizard.tax.rateForm.save')}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending} data-testid="tax-rate-cancel">
          {t('checkin.wizard.tax.rateForm.cancel')}
        </Button>
      </div>
    </section>
  );
}
