import { useFormContext, useWatch, type FieldError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/shared/form-field-error';
import { getDocumentTypeLabel, getGenderLabel } from '@/lib/i18n-labels';
import type { StayGuestType } from '@/types/public-checkin.types';
import {
  ALLOGGIATI_GENDERS,
  DOCUMENT_KINDS,
  LEADER_TYPES,
  MAX_DOCUMENT_NUMBER_LENGTH,
  isMinorOn,
  type StayGuestFormValues,
} from '../schemas/checkin.schema';
import { CodeTableInput } from './code-table-input';
import { isListAvailable, type CodeTableSource, type CodeTableValue } from './code-table';

export const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/** Shape shared by the guest portal and the host form: the guests of the stay at `guests`. */
export interface StayGuestsFormShape {
  guests: StayGuestFormValues[];
}

type GuestField = keyof StayGuestFormValues;

/** Field names used for ids and errors (kept out of the JSX). */
const FIELD = {
  type: 'type',
  firstName: 'firstName',
  lastName: 'lastName',
  gender: 'gender',
  dateOfBirth: 'dateOfBirth',
  bornInItaly: 'bornInItaly',
  birthProvince: 'birthProvince',
  documentType: 'documentType',
  documentNumber: 'documentNumber',
} as const satisfies Partial<Record<GuestField, GuestField>>;
type CodedNameField = 'birthComuneName' | 'birthCountryName' | 'citizenshipName' | 'documentTypeLabel' | 'documentIssuePlaceName';
type CodedCodeField = 'birthComuneCode' | 'birthCountryCode' | 'citizenshipCode' | 'documentTypeCode' | 'documentIssuePlaceCode';

function useGuestField(index: number) {
  const { register, setValue, formState } = useFormContext<StayGuestsFormShape>();
  const guestErrors = formState.errors.guests?.[index] as Partial<Record<GuestField, FieldError>> | undefined;
  const id = (field: GuestField) => `guest-${index}-${field}`;
  const errorOf = (field: GuestField) => guestErrors?.[field];
  const a11y = (field: GuestField) => ({
    id: id(field),
    'aria-invalid': !!errorOf(field),
    'aria-describedby': `${id(field)}-error`,
  });
  const setCoded = (nameField: CodedNameField, codeField: CodedCodeField, value: CodeTableValue) => {
    setValue(`guests.${index}.${nameField}`, value.name, { shouldDirty: true });
    setValue(`guests.${index}.${codeField}`, value.code, { shouldDirty: true });
  };
  return { register, setValue, id, errorOf, a11y, setCoded };
}

interface StayGuestPersonalFieldsProps {
  index: number;
  arrivalDate?: string;
  source: CodeTableSource;
  /** First guest only: the kind of the whole stay changed (single, family, group). */
  onLeaderTypeChange?: (type: StayGuestType) => void;
  onRemove?: () => void;
}

/**
 * Personal data of one guest (all kinds): the kind of stay on the first guest, names, sex, date of birth (minors
 * flagged), place of birth (comune and province in Italy, state abroad) and citizenship.
 */
export function StayGuestPersonalFields({ index, arrivalDate, source, onLeaderTypeChange, onRemove }: StayGuestPersonalFieldsProps) {
  const { t } = useTranslation();
  const { register, setValue, id, errorOf, a11y, setCoded } = useGuestField(index);
  const guest = useWatch<StayGuestsFormShape, `guests.${number}`>({ name: `guests.${index}` });
  if (!guest) return null;

  const minor = isMinorOn(guest.dateOfBirth, arrivalDate);
  const typeRegistration = register(`guests.${index}.type`);

  return (
    <fieldset className="space-y-4 rounded-md border p-4" data-testid={`stay-guest-${index}`}>
      <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
        {t('checkin.guestHeading', { index: index + 1 })}
        <Badge variant="secondary" data-testid={`stay-guest-${index}-type`}>
          {t(`alloggiati.guestKind.${guest.type}`)}
        </Badge>
        {minor && (
          <Badge variant="outline" data-testid={`stay-guest-${index}-minor`}>
            {t('checkin.minor')}
          </Badge>
        )}
      </legend>

      {index === 0 && (
        <div className="space-y-2">
          <Label htmlFor={id('type')}>{t('checkin.stayKindLabel')}</Label>
          <select
            {...typeRegistration}
            {...a11y(FIELD.type)}
            className={selectClassName}
            onChange={(event) => {
              void typeRegistration.onChange(event);
              onLeaderTypeChange?.(event.target.value as StayGuestType);
            }}
          >
            {LEADER_TYPES.map((value) => (
              <option key={value} value={value}>{t(`checkin.stayKind.${value}`)}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t('checkin.stayKindHint')}</p>
          <FormFieldError id={`${id('type')}-error`} error={errorOf('type')} />
        </div>
      )}
      {index > 0 && <FormFieldError id={`${id('type')}-error`} error={errorOf('type')} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={id('firstName')}>{t('checkin.firstName')}</Label>
          <Input {...register(`guests.${index}.firstName`)} {...a11y(FIELD.firstName)} />
          <FormFieldError id={`${id('firstName')}-error`} error={errorOf('firstName')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id('lastName')}>{t('checkin.lastName')}</Label>
          <Input {...register(`guests.${index}.lastName`)} {...a11y(FIELD.lastName)} />
          <FormFieldError id={`${id('lastName')}-error`} error={errorOf('lastName')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id('gender')}>{t('checkin.genderLabel')}</Label>
          <select {...register(`guests.${index}.gender`)} {...a11y(FIELD.gender)} className={selectClassName}>
            <option value="">{t('checkin.selectGender')}</option>
            {ALLOGGIATI_GENDERS.map((value) => (
              <option key={value} value={value}>{getGenderLabel(value, t)}</option>
            ))}
          </select>
          <FormFieldError id={`${id('gender')}-error`} error={errorOf('gender')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id('dateOfBirth')}>{t('checkin.birthDate')}</Label>
          <Input type="date" {...register(`guests.${index}.dateOfBirth`)} {...a11y(FIELD.dateOfBirth)} />
          <FormFieldError id={`${id('dateOfBirth')}-error`} error={errorOf('dateOfBirth')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id('bornInItaly')}>{t('checkin.bornInLabel')}</Label>
          <select {...register(`guests.${index}.bornInItaly`)} {...a11y(FIELD.bornInItaly)} className={selectClassName}>
            <option value="">{t('checkin.selectBornIn')}</option>
            <option value="yes">{t('checkin.bornIn.yes')}</option>
            <option value="no">{t('checkin.bornIn.no')}</option>
          </select>
          <FormFieldError id={`${id('bornInItaly')}-error`} error={errorOf('bornInItaly')} />
        </div>

        {guest.bornInItaly === 'yes' && (
          <>
            <div className="space-y-2">
              <Label htmlFor={id('birthComuneName')}>{t('checkin.birthComune')}</Label>
              <CodeTableInput
                id={id('birthComuneName')}
                list="comuni"
                source={source}
                name={guest.birthComuneName}
                code={guest.birthComuneCode}
                aria-invalid={!!errorOf('birthComuneName')}
                aria-describedby={`${id('birthComuneName')}-error`}
                onValueChange={(value) => {
                  setCoded('birthComuneName', 'birthComuneCode', value);
                  if (value.province) setValue(`guests.${index}.birthProvince`, value.province, { shouldDirty: true });
                }}
              />
              <FormFieldError id={`${id('birthComuneName')}-error`} error={errorOf('birthComuneName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id('birthProvince')}>{t('checkin.birthProvince')}</Label>
              <Input maxLength={2} className="uppercase" {...register(`guests.${index}.birthProvince`)} {...a11y(FIELD.birthProvince)} />
              <FormFieldError id={`${id('birthProvince')}-error`} error={errorOf('birthProvince')} />
            </div>
          </>
        )}
        {guest.bornInItaly === 'no' && (
          <div className="space-y-2">
            <Label htmlFor={id('birthCountryName')}>{t('checkin.birthCountry')}</Label>
            <CodeTableInput
              id={id('birthCountryName')}
              list="stati"
              source={source}
              name={guest.birthCountryName}
              code={guest.birthCountryCode}
              aria-invalid={!!errorOf('birthCountryName')}
              aria-describedby={`${id('birthCountryName')}-error`}
              onValueChange={(value) => setCoded('birthCountryName', 'birthCountryCode', value)}
            />
            <FormFieldError id={`${id('birthCountryName')}-error`} error={errorOf('birthCountryName')} />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={id('citizenshipName')}>{t('checkin.citizenship')}</Label>
          <CodeTableInput
            id={id('citizenshipName')}
            list="stati"
            source={source}
            name={guest.citizenshipName}
            code={guest.citizenshipCode}
            aria-invalid={!!errorOf('citizenshipName')}
            aria-describedby={`${id('citizenshipName')}-error`}
            onValueChange={(value) => setCoded('citizenshipName', 'citizenshipCode', value)}
          />
          <FormFieldError id={`${id('citizenshipName')}-error`} error={errorOf('citizenshipName')} />
        </div>
      </div>

      {onRemove && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} data-testid={`stay-guest-${index}-remove`}>
            <Trash2 className="mr-1 h-4 w-4" />
            {t('checkin.removeGuest')}
          </Button>
        </div>
      )}
    </fieldset>
  );
}

interface StayGuestDocumentFieldsProps {
  index: number;
  source: CodeTableSource;
}

/** Identity document of a single guest or of a head of family or group: kind (or official type), number, place of issue. */
export function StayGuestDocumentFields({ index, source }: StayGuestDocumentFieldsProps) {
  const { t } = useTranslation();
  const { register, setValue, id, errorOf, a11y, setCoded } = useGuestField(index);
  const guest = useWatch<StayGuestsFormShape, `guests.${number}`>({ name: `guests.${index}` });
  if (!guest) return null;

  const documentTable = isListAvailable(source, 'documenti');
  // Masked number on file (CO-02): a hint only, the guest types the full number again.
  const maskedDocumentNumber = guest.documentNumberOnFile;

  return (
    <fieldset className="space-y-4 rounded-md border p-4" data-testid={`stay-guest-${index}-document`}>
      <legend className="px-1 text-sm font-semibold">
        {t('checkin.documentOf', { name: `${guest.firstName} ${guest.lastName}`.trim() || t('checkin.guestHeading', { index: index + 1 }) })}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={id('documentType')}>{t('checkin.documentTypeLabel')}</Label>
          {documentTable ? (
            <CodeTableInput
              id={id('documentType')}
              list="documenti"
              source={source}
              name={guest.documentTypeLabel}
              code={guest.documentTypeCode}
              aria-invalid={!!errorOf('documentType')}
              aria-describedby={`${id('documentType')}-error`}
              onValueChange={(value) => {
                setCoded('documentTypeLabel', 'documentTypeCode', value);
                setValue(`guests.${index}.documentType`, '', { shouldDirty: true });
              }}
            />
          ) : (
            <select {...register(`guests.${index}.documentType`)} {...a11y(FIELD.documentType)} className={selectClassName}>
              <option value="">{t('checkin.selectDocumentType')}</option>
              {DOCUMENT_KINDS.map((value) => (
                <option key={value} value={value}>{getDocumentTypeLabel(value, t)}</option>
              ))}
            </select>
          )}
          <FormFieldError id={`${id('documentType')}-error`} error={errorOf('documentType')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id('documentNumber')}>{t('checkin.documentNumber')}</Label>
          <Input
            autoComplete="off"
            maxLength={MAX_DOCUMENT_NUMBER_LENGTH + 10}
            {...register(`guests.${index}.documentNumber`)}
            {...a11y(FIELD.documentNumber)}
          />
          {maskedDocumentNumber && (
            <p className="text-xs text-muted-foreground" data-testid={`stay-guest-${index}-document-on-file`}>
              {t('checkin.documentNumberOnFile', { masked: maskedDocumentNumber })}
            </p>
          )}
          <FormFieldError id={`${id('documentNumber')}-error`} error={errorOf('documentNumber')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id('documentIssuePlaceName')}>{t('checkin.documentIssuePlace')}</Label>
          <CodeTableInput
            id={id('documentIssuePlaceName')}
            list="luoghi"
            source={source}
            name={guest.documentIssuePlaceName}
            code={guest.documentIssuePlaceCode}
            aria-invalid={!!errorOf('documentIssuePlaceName')}
            aria-describedby={`${id('documentIssuePlaceName')}-error`}
            onValueChange={(value) => setCoded('documentIssuePlaceName', 'documentIssuePlaceCode', value)}
          />
          <p className="text-xs text-muted-foreground">{t('checkin.documentIssuePlaceHint')}</p>
          <FormFieldError id={`${id('documentIssuePlaceName')}-error`} error={errorOf('documentIssuePlaceName')} />
        </div>
      </div>
    </fieldset>
  );
}
