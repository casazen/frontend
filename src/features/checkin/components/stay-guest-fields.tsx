import { useFormContext, useWatch, type FieldError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/shared/form-field-error';
import { getDocumentTypeLabel, getGenderLabel } from '@/lib/i18n-labels';
import { todayInRome } from '@/lib/stay-dates';
import type { StayGuestType } from '@/types/public-checkin.types';
import {
  ALLOGGIATI_GENDERS,
  DOCUMENT_KINDS,
  LEADER_TYPES,
  MAX_DOCUMENT_NUMBER_LENGTH,
  MAX_RESIDENCE_CITY_LENGTH,
  MAX_RESIDENCE_POSTAL_CODE_LENGTH,
  MAX_RESIDENCE_STREET_LENGTH,
  MAX_VEHICLE_PLATE_LENGTH,
  NO_SWISS_RULES,
  STATISTICAL_FIELD_OPTIONS,
  asksSwissDocument,
  asksSwissResidence,
  isMinorOn,
  type DocumentLevel,
  type StatisticalGuestField,
  type StayGuestFormValues,
  type SwissStayRules,
} from '../schemas/checkin.schema';
import { CodeTableInput } from './code-table-input';
import { isListAvailable, type CodeTableSource, type CodeTableValue } from './code-table';

export const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/** The controls added for NF-40 are at least 44 px high (touch target, WCAG 2.2 AA). */
const touchSelectClassName = selectClassName.replace('h-10', 'h-11');
const TOUCH_INPUT = 'h-11';

/** Shape shared by the guest portal and the host form: the guests of the stay at `guests`. */
export interface StayGuestsFormShape {
  guests: StayGuestFormValues[];
}

/** The plate of the car, a field of the stay: the key of the forms that ask it (the guest portal, the wizard of the host, the editor of the guests). */
export interface StayVehiclePlateFormShape {
  vehiclePlate?: string;
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
  residenceInItaly: 'residenceInItaly',
  residenceProvince: 'residenceProvince',
  residenceStreet: 'residenceStreet',
  residencePostalCode: 'residencePostalCode',
  residenceCityName: 'residenceCityName',
  documentType: 'documentType',
  documentNumber: 'documentNumber',
  documentIssuedOn: 'documentIssuedOn',
  documentExpiresOn: 'documentExpiresOn',
} as const satisfies Partial<Record<GuestField, GuestField>>;
type CodedNameField =
  | 'birthComuneName'
  | 'birthCountryName'
  | 'citizenshipName'
  | 'residenceComuneName'
  | 'residenceCountryName'
  | 'documentTypeLabel'
  | 'documentIssuePlaceName';
type CodedCodeField =
  | 'birthComuneCode'
  | 'birthCountryCode'
  | 'citizenshipCode'
  | 'residenceComuneCode'
  | 'residenceCountryCode'
  | 'documentTypeCode'
  | 'documentIssuePlaceCode';

/** The label of each statistical field (an i18n key, written out for the i18n test). */
const STATISTICAL_LABEL_KEYS: Record<StatisticalGuestField, string> = {
  tourismType: 'checkin.tourismType.label',
  travelWay: 'checkin.travelWay.label',
  educationLevel: 'checkin.educationLevel.label',
};

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
  /**
   * The statistical fields the region requires (`requiredGuestFields` of the public view or of the wizard): only these are asked, and
   * they have to be chosen. None by default, as the host form of the guests of the Alloggiati tab has none.
   */
  requiredFields?: readonly StatisticalGuestField[];
  /**
   * What a property in Switzerland asks on top of the record (NF-132): the home (street, postal code, town and the state of residence, all optional)
   * replaces the Italian residence, which is never asked of a Swiss stay. Nothing by default: the form of an Italian stay does not change.
   */
  swiss?: SwissStayRules;
  /** First guest only: the kind of the whole stay changed (single, family, group). */
  onLeaderTypeChange?: (type: StayGuestType) => void;
  bookedName?: { firstName?: string | null; lastName?: string | null };
  onRemove?: () => void;
}

/**
 * Personal data of one guest (all kinds): the kind of stay on the first guest, names, sex, date of birth (minors
 * flagged), place of birth (comune and province in Italy, state abroad), citizenship, the residence (optional) and the
 * statistical fields the region requires. In Switzerland the residence is the home: street, postal code, town and state.
 */
export function StayGuestPersonalFields({
  index,
  arrivalDate,
  source,
  requiredFields = [],
  swiss = NO_SWISS_RULES,
  onLeaderTypeChange,
  bookedName,
  onRemove,
}: StayGuestPersonalFieldsProps) {
  const { t } = useTranslation();
  const { register, setValue, id, errorOf, a11y, setCoded } = useGuestField(index);
  const guest = useWatch<StayGuestsFormShape, `guests.${number}`>({ name: `guests.${index}` });
  if (!guest) return null;

  const minor = isMinorOn(guest.dateOfBirth, arrivalDate);
  const typeRegistration = register(`guests.${index}.type`);
  const swissResidence = asksSwissResidence(swiss);
  // Each box of the home is there only where the regime names it.
  const asksStreet = swiss.asked.has('residenceStreet');
  const asksPostalCode = swiss.asked.has('residencePostalCode');
  const asksCity = swiss.asked.has('residenceCityName');
  const asksCountry = swiss.asked.has('residenceCountryName');
  // The state of residence says whether the guest lives abroad: the Swiss form never asks «in Italy or abroad». A state typed means abroad;
  // when the field is emptied the answer goes back to «not said», unless it was something else (a residence on file in Italy stays as it is).
  const setResidenceCountry = (value: CodeTableValue) => {
    setCoded('residenceCountryName', 'residenceCountryCode', value);
    if (value.name.trim()) setValue(`guests.${index}.residenceInItaly`, 'no', { shouldDirty: true });
    else if (guest.residenceInItaly === 'no') setValue(`guests.${index}.residenceInItaly`, '', { shouldDirty: true });
  };

  return (
    <fieldset className="space-y-4 rounded-md border p-4" data-testid={`stay-guest-${index}`}>
      <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
        {t('checkin.guestHeading', { index: index + 1 })}
        <Badge variant="secondary" data-testid={`stay-guest-${index}-type`}>
          {t(`checkin.guestKind.${guest.type}`)}
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
          <p className="text-xs text-muted-foreground">
            {asksSwissDocument(swiss) ? t('checkin.swiss.stayKindHint') : t('checkin.stayKindHint')}
          </p>
          <FormFieldError id={`${id('type')}-error`} error={errorOf('type')} />
        </div>
      )}
      {index > 0 && <FormFieldError id={`${id('type')}-error`} error={errorOf('type')} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={id('firstName')}>{t('checkin.firstName')}</Label>
          <Input readOnly={!!bookedName?.firstName?.trim()} {...register(`guests.${index}.firstName`)} {...a11y(FIELD.firstName)} />
          <FormFieldError id={`${id('firstName')}-error`} error={errorOf('firstName')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id('lastName')}>{t('checkin.lastName')}</Label>
          <Input readOnly={!!bookedName?.lastName?.trim()} {...register(`guests.${index}.lastName`)} {...a11y(FIELD.lastName)} />
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
          <Label htmlFor={`guest-${index}-citizenship`}>{t('checkin.citizenship')}</Label>
          <CodeTableInput
            id={`guest-${index}-citizenship`}
            purpose="citizenship"
            list="stati"
            source={source}
            name={guest.citizenshipName}
            code={guest.citizenshipCode}
            aria-invalid={!!errorOf('citizenshipName')}
            aria-describedby={`guest-${index}-citizenship-error`}
            onValueChange={(value) => setCoded('citizenshipName', 'citizenshipCode', value)}
          />
          <FormFieldError id={`guest-${index}-citizenship-error`} error={errorOf('citizenshipName')} />
        </div>

        {swissResidence && (
          <>
            <p className="text-xs text-muted-foreground sm:col-span-2" data-testid={`stay-guest-${index}-home-hint`}>
              {t('checkin.residence.homeHint')}
            </p>
            {asksStreet && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={id('residenceStreet')}>{t('checkin.residence.street')}</Label>
                <Input
                  autoComplete="street-address"
                  maxLength={MAX_RESIDENCE_STREET_LENGTH}
                  className={TOUCH_INPUT}
                  {...register(`guests.${index}.residenceStreet`)}
                  {...a11y(FIELD.residenceStreet)}
                />
                <FormFieldError id={`${id('residenceStreet')}-error`} error={errorOf('residenceStreet')} />
              </div>
            )}
            {asksPostalCode && (
              <div className="space-y-2">
                <Label htmlFor={id('residencePostalCode')}>{t('checkin.residence.postalCode')}</Label>
                <Input
                  autoComplete="postal-code"
                  maxLength={MAX_RESIDENCE_POSTAL_CODE_LENGTH}
                  className={TOUCH_INPUT}
                  {...register(`guests.${index}.residencePostalCode`)}
                  {...a11y(FIELD.residencePostalCode)}
                />
                <FormFieldError id={`${id('residencePostalCode')}-error`} error={errorOf('residencePostalCode')} />
              </div>
            )}
            {asksCity && (
              <div className="space-y-2">
                <Label htmlFor={id('residenceCityName')}>{t('checkin.residence.city')}</Label>
                <Input
                  autoComplete="address-level2"
                  maxLength={MAX_RESIDENCE_CITY_LENGTH}
                  className={TOUCH_INPUT}
                  {...register(`guests.${index}.residenceCityName`)}
                  {...a11y(FIELD.residenceCityName)}
                />
                <FormFieldError id={`${id('residenceCityName')}-error`} error={errorOf('residenceCityName')} />
              </div>
            )}
            {asksCountry && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={id('residenceCountryName')}>{t('checkin.residence.country')}</Label>
                <CodeTableInput
                  id={id('residenceCountryName')}
                  list="stati"
                  source={source}
                  name={guest.residenceCountryName}
                  code={guest.residenceCountryCode}
                  autoComplete="country"
                  className={TOUCH_INPUT}
                  aria-invalid={!!errorOf('residenceCountryName')}
                  aria-describedby={`${id('residenceCountryName')}-error`}
                  onValueChange={setResidenceCountry}
                />
                <FormFieldError id={`${id('residenceCountryName')}-error`} error={errorOf('residenceCountryName')} />
              </div>
            )}
          </>
        )}

        {!swissResidence && (
          <div className="space-y-2">
            <Label htmlFor={id('residenceInItaly')}>{t('checkin.residence.label')}</Label>
            <select
              {...register(`guests.${index}.residenceInItaly`)}
              {...a11y(FIELD.residenceInItaly)}
              className={touchSelectClassName}
              aria-describedby={`${id('residenceInItaly')}-hint ${id('residenceInItaly')}-error`}
            >
              <option value="">{t('checkin.choose')}</option>
              <option value="yes">{t('checkin.residence.inItaly')}</option>
              <option value="no">{t('checkin.residence.abroad')}</option>
            </select>
            <p id={`${id('residenceInItaly')}-hint`} className="text-xs text-muted-foreground">
              {t('checkin.residence.hint')}
            </p>
            <FormFieldError id={`${id('residenceInItaly')}-error`} error={errorOf('residenceInItaly')} />
          </div>
        )}

        {!swissResidence && guest.residenceInItaly === 'yes' && (
          <>
            <div className="space-y-2">
              <Label htmlFor={id('residenceComuneName')}>{t('checkin.residence.comune')}</Label>
              <CodeTableInput
                id={id('residenceComuneName')}
                list="comuni"
                source={source}
                name={guest.residenceComuneName}
                code={guest.residenceComuneCode}
                className={TOUCH_INPUT}
                aria-invalid={!!errorOf('residenceComuneName')}
                aria-describedby={`${id('residenceComuneName')}-error`}
                onValueChange={(value) => {
                  setCoded('residenceComuneName', 'residenceComuneCode', value);
                  if (value.province) setValue(`guests.${index}.residenceProvince`, value.province, { shouldDirty: true });
                }}
              />
              <FormFieldError id={`${id('residenceComuneName')}-error`} error={errorOf('residenceComuneName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id('residenceProvince')}>{t('checkin.residence.province')}</Label>
              <Input
                maxLength={2}
                className={`${TOUCH_INPUT} uppercase`}
                {...register(`guests.${index}.residenceProvince`)}
                {...a11y(FIELD.residenceProvince)}
              />
              <FormFieldError id={`${id('residenceProvince')}-error`} error={errorOf('residenceProvince')} />
            </div>
          </>
        )}
        {!swissResidence && guest.residenceInItaly === 'no' && (
          <div className="space-y-2">
            <Label htmlFor={id('residenceCountryName')}>{t('checkin.residence.country')}</Label>
            <CodeTableInput
              id={id('residenceCountryName')}
              list="stati"
              source={source}
              name={guest.residenceCountryName}
              code={guest.residenceCountryCode}
              className={TOUCH_INPUT}
              aria-invalid={!!errorOf('residenceCountryName')}
              aria-describedby={`${id('residenceCountryName')}-error`}
              onValueChange={(value) => setCoded('residenceCountryName', 'residenceCountryCode', value)}
            />
            <FormFieldError id={`${id('residenceCountryName')}-error`} error={errorOf('residenceCountryName')} />
          </div>
        )}

        {requiredFields.map((field) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={id(field)}>{t(STATISTICAL_LABEL_KEYS[field])}</Label>
            <select {...register(`guests.${index}.${field}`)} {...a11y(field)} className={touchSelectClassName}>
              <option value="">{t('checkin.choose')}</option>
              {STATISTICAL_FIELD_OPTIONS[field].map((option) => (
                <option key={option.code} value={option.code}>{t(option.labelKey)}</option>
              ))}
            </select>
            <FormFieldError id={`${id(field)}-error`} error={errorOf(field)} />
          </div>
        ))}
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
  /**
   * How much of the document this guest gives: `full` (the default, as ever) for a single guest or a head of family or group; `basic` for the other
   * guests a Swiss police file notifies (NF-132): only the type and the number are asked, not the place of issue nor the days.
   */
  level?: DocumentLevel;
}

/**
 * Identity document of a single guest or of a head of family or group: kind (or official type), number, place of issue, and the
 * issue and expiry days (optional). The `basic` level, for a guest of a Swiss stay the police file notifies, has the kind and the number only.
 */
export function StayGuestDocumentFields({ index, source, level = 'full' }: StayGuestDocumentFieldsProps) {
  const { t } = useTranslation();
  const { register, setValue, id, errorOf, a11y, setCoded } = useGuestField(index);
  const guest = useWatch<StayGuestsFormShape, `guests.${number}`>({ name: `guests.${index}` });
  if (!guest) return null;

  const documentTable = isListAvailable(source, 'documenti');
  const full = level === 'full';
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
        <div className={full ? 'space-y-2' : 'space-y-2 sm:col-span-2'}>
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
        {full && (
          <>
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
            <div className="space-y-2">
              <Label htmlFor={id('documentIssuedOn')}>{t('checkin.documentIssuedOn.label')}</Label>
              <Input
                type="date"
                min="1900-01-01"
                max={todayInRome()}
                className={TOUCH_INPUT}
                {...register(`guests.${index}.documentIssuedOn`)}
                {...a11y(FIELD.documentIssuedOn)}
              />
              <FormFieldError id={`${id('documentIssuedOn')}-error`} error={errorOf('documentIssuedOn')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id('documentExpiresOn')}>{t('checkin.documentExpiresOn.label')}</Label>
              <Input
                type="date"
                className={TOUCH_INPUT}
                {...register(`guests.${index}.documentExpiresOn`)}
                {...a11y(FIELD.documentExpiresOn)}
              />
              <FormFieldError id={`${id('documentExpiresOn')}-error`} error={errorOf('documentExpiresOn')} />
            </div>
          </>
        )}
      </div>
    </fieldset>
  );
}

/**
 * The plate of the car of the stay (NF-132): one optional field for the whole stay, asked only where the regime says so (`askVehiclePlate`). It is a
 * key of the form of whoever mounts it (`vehiclePlate`), next to the guests. Spaces and case are the API's to normalize: the text is kept as typed.
 */
export function VehiclePlateField() {
  const { t } = useTranslation();
  const { register, formState } = useFormContext<StayVehiclePlateFormShape>();
  const error = formState.errors.vehiclePlate;

  return (
    <div className="space-y-2" data-testid="stay-vehicle-plate">
      <Label htmlFor="stay-vehicle-plate-input">{t('checkin.vehiclePlate.label')}</Label>
      <Input
        id="stay-vehicle-plate-input"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={MAX_VEHICLE_PLATE_LENGTH + 12}
        className={`${TOUCH_INPUT} uppercase`}
        aria-invalid={!!error}
        aria-describedby="stay-vehicle-plate-hint stay-vehicle-plate-error"
        {...register('vehiclePlate')}
      />
      <p id="stay-vehicle-plate-hint" className="text-xs text-muted-foreground">
        {t('checkin.vehiclePlate.hint')}
      </p>
      <FormFieldError id="stay-vehicle-plate-error" error={error} />
    </div>
  );
}
