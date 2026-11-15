import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getProblemMessage } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import { useSaveIstatRegion } from '@/queries/use-istat-regions';
import { ISTAT_COVERAGES, ISTAT_DEADLINE_KINDS, ISTAT_GUEST_FIELDS, type IstatCoverage, type IstatDeadlineKind, type IstatRegionRule } from '@/types/istat.types';
import {
  ISTAT_REGION_LIMITS,
  formOf,
  requestOf,
  territoryName,
  validateRegionForm,
  type FieldsMode,
  type RegionFormErrors,
  type RegionFormValues,
} from './istat-region-form';

const FIELDS_MODES: readonly FieldsMode[] = ['toVerify', 'none', 'some'];

interface IstatRegionDialogProps {
  rule: IstatRegionRule;
  onClose: () => void;
}

/**
 * The form of one row of the ISTAT region table (E21/F01/US02/T01): the system and the portal of the region, its deadline, the statistical fields it requires, whether the channel manager
 * sends it, the source the values were read from and the day they were checked. A save REPLACES the row, so the form holds every value of it and sends them all: nothing is left out to be
 * erased. The source is required and has to be an https address (the server refuses anything else); the day of the check starts as today and is never in the future. A refusal of the server is
 * told in words and the form stays open with what was typed. Mount it with a `key` per row so the fields start from that row.
 */
export function IstatRegionDialog({ rule, onClose }: IstatRegionDialogProps) {
  const { t } = useTranslation();
  const today = todayInRome();
  const save = useSaveIstatRegion();
  const [values, setValues] = useState<RegionFormValues>(() => formOf(rule, today));
  const [errors, setErrors] = useState<RegionFormErrors>({});
  // The request is in flight: nothing of the form can be pressed again meanwhile, and the dialog does not close under it.
  const busy = save.isPending;
  const name = territoryName(rule);

  const change = <K extends keyof RegionFormValues>(field: K, value: RegionFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }) as RegionFormErrors);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found = validateRegionForm(values, today);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      await save.mutateAsync(requestOf(rule, values));
    } catch (error) {
      // The reason of the server in words (the source or the portal it refused, a territory it does not know); the form stays as it is.
      toast.error(getProblemMessage(error, t) ?? t('istatRegions.toast.saveFailed'));
      return;
    }
    toast.success(t('istatRegions.toast.saved', { region: name }));
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl" data-testid="istat-region-dialog">
        <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('istatRegions.dialog.title', { region: name })}</DialogTitle>
            <DialogDescription>{t('istatRegions.dialog.description')}</DialogDescription>
          </DialogHeader>

          <Field label={t('istatRegions.form.system')} optional>
            <Input value={values.system} maxLength={ISTAT_REGION_LIMITS.system} disabled={busy} onChange={(event) => change('system', event.target.value)} data-testid="istat-region-system" />
          </Field>

          <Field label={t('istatRegions.form.portalUrl')} hint={t('istatRegions.form.portalUrlHint')} error={errors.portalUrl} optional>
            <Input
              type="url"
              inputMode="url"
              autoComplete="off"
              value={values.portalUrl}
              maxLength={ISTAT_REGION_LIMITS.url}
              disabled={busy}
              onChange={(event) => change('portalUrl', event.target.value)}
              data-testid="istat-region-portal"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('istatRegions.form.deadlineKind')}>
              <Select
                value={values.deadlineKind}
                disabled={busy}
                onChange={(event) => change('deadlineKind', event.target.value as IstatDeadlineKind)}
                data-testid="istat-region-deadline-kind"
              >
                {ISTAT_DEADLINE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`istatRegions.deadlineKinds.${kind}`)}
                  </option>
                ))}
              </Select>
            </Field>
            {values.deadlineKind === 'Monthly' ? (
              <Field label={t('istatRegions.form.deadlineDay')} hint={t('istatRegions.form.deadlineDayHint')} error={errors.deadlineDay}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={values.deadlineDay}
                  disabled={busy}
                  onChange={(event) => change('deadlineDay', event.target.value)}
                  data-testid="istat-region-deadline-day"
                />
              </Field>
            ) : null}
          </div>

          <Field label={t('istatRegions.form.fieldsMode')} hint={t(`istatRegions.fieldsModeHints.${values.fieldsMode}`)}>
            <Select value={values.fieldsMode} disabled={busy} onChange={(event) => change('fieldsMode', event.target.value as FieldsMode)} data-testid="istat-region-fields-mode">
              {FIELDS_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {t(`istatRegions.fieldsModes.${mode}`)}
                </option>
              ))}
            </Select>
          </Field>
          {values.fieldsMode === 'some' ? (
            <fieldset className="space-y-1" disabled={busy} data-testid="istat-region-fields">
              <legend className="text-sm font-medium">{t('istatRegions.form.fields')}</legend>
              {ISTAT_GUEST_FIELDS.map((field) => (
                <div key={field} className="flex items-center gap-3">
                  <Checkbox
                    id={`istat-region-field-${field}`}
                    checked={values.fields.includes(field)}
                    onCheckedChange={(checked) => change('fields', checked === true ? [...values.fields, field] : values.fields.filter((name) => name !== field))}
                    data-testid={`istat-region-field-${field}`}
                  />
                  <Label htmlFor={`istat-region-field-${field}`} className="flex min-h-11 flex-1 cursor-pointer items-center text-sm leading-snug">
                    {t(`istatRegions.guestFields.${field}`)}
                  </Label>
                </div>
              ))}
              {errors.fields ? (
                <p role="alert" className="text-sm text-danger-foreground" data-testid="istat-region-fields-error">
                  {t(errors.fields)}
                </p>
              ) : null}
            </fieldset>
          ) : null}

          <Field label={t('istatRegions.form.coverage')} hint={t('istatRegions.form.coverageHint')}>
            <Select value={values.coverage} disabled={busy} onChange={(event) => change('coverage', event.target.value as IstatCoverage)} data-testid="istat-region-coverage">
              {ISTAT_COVERAGES.map((coverage) => (
                <option key={coverage} value={coverage}>
                  {t(`istatRegions.coverage.${coverage}`)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('istatRegions.form.sourceUrl')} hint={t('istatRegions.form.sourceUrlHint')} error={errors.sourceUrl}>
            <Input
              type="url"
              inputMode="url"
              autoComplete="off"
              value={values.sourceUrl}
              maxLength={ISTAT_REGION_LIMITS.url}
              disabled={busy}
              onChange={(event) => change('sourceUrl', event.target.value)}
              data-testid="istat-region-source"
            />
          </Field>

          <Field label={t('istatRegions.form.verifiedAt')} hint={t('istatRegions.form.verifiedAtHint')} error={errors.verifiedAt}>
            <Input type="date" max={today} value={values.verifiedAt} disabled={busy} onChange={(event) => change('verifiedAt', event.target.value)} data-testid="istat-region-verified-at" />
          </Field>

          <Field label={t('istatRegions.form.notes')} optional>
            <Textarea value={values.notes} maxLength={ISTAT_REGION_LIMITS.notes} disabled={busy} onChange={(event) => change('notes', event.target.value)} data-testid="istat-region-notes" />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose} data-testid="istat-region-cancel">
              {t('istatRegions.cancel')}
            </Button>
            <Button type="submit" loading={busy} disabled={busy} data-testid="istat-region-save">
              {t('istatRegions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
