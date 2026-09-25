import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getProblemMessage } from '@/lib/api-errors';
import { getBookingSourceLabel } from '@/lib/i18n-labels';
import { useCreateOtaStay } from '@/queries/use-bookings';
import { OTA_STAY_SOURCES, type Booking, type CreateOtaStayDto, type OtaStaySource } from '@/types';

interface OtaStayFormProps {
  blockId: string;
  /** Channel of the block's feed: the source of the stay, chosen here only for a feed of channel "Other". */
  channel?: string | null;
  onCreated: (booking: Booking) => void;
  onCancel: () => void;
}

type Field = 'firstName' | 'lastName' | 'email' | 'numberOfGuests' | 'totalPrice' | 'source';
type FieldErrors = Partial<Record<Field, string>>;

const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 255;
const MAX_GUESTS = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "150,50" or "150.50" → 150.5; undefined when empty; NaN when not a number. */
function parseAmount(value: string): number | undefined {
  const text = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!text) return undefined;
  return /^\d+(\.\d{1,2})?$/.test(text) ? Number(text) : Number.NaN;
}

/**
 * "Crea soggiorno OTA" (CO-21, decision D7): the guest of the reservation an iCal block stands for. Name and email are
 * required (the check-in link goes to that address); guests and amount are optional, CasaZen never computes a price for
 * an OTA stay. The source comes from the channel of the feed; for a feed of another channel the host chooses the OTA.
 * API errors (block already a stay, dates of another booking, too many guests) stay in the form.
 */
export function OtaStayForm({ blockId, channel, onCreated, onCancel }: OtaStayFormProps) {
  const { t } = useTranslation();
  const createStay = useCreateOtaStay();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [guests, setGuests] = useState('');
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState<OtaStaySource | ''>('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const chooseSource = channel !== 'Airbnb' && channel !== 'BookingCom';

  // A new attempt hides the error of the previous one.
  const edit = (field: Field, update: () => void) => {
    if (createStay.isError) createStay.reset();
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    update();
  };

  const validate = (): { data?: CreateOtaStayDto; errors: FieldErrors } => {
    const found: FieldErrors = {};
    const first = firstName.trim();
    const last = lastName.trim();
    const address = email.trim();
    if (!first) found.firstName = t('booking.otaStay.validation.firstNameRequired');
    else if (first.length > NAME_MAX_LENGTH) found.firstName = t('booking.otaStay.validation.nameTooLong');
    if (!last) found.lastName = t('booking.otaStay.validation.lastNameRequired');
    else if (last.length > NAME_MAX_LENGTH) found.lastName = t('booking.otaStay.validation.nameTooLong');
    if (!address) found.email = t('booking.otaStay.validation.emailRequired');
    else if (address.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(address))
      found.email = t('booking.otaStay.validation.emailInvalid');

    let numberOfGuests: number | undefined;
    if (guests.trim()) {
      numberOfGuests = Number(guests.trim());
      if (!Number.isInteger(numberOfGuests) || numberOfGuests < 1 || numberOfGuests > MAX_GUESTS)
        found.numberOfGuests = t('booking.otaStay.validation.guestsInvalid', { max: MAX_GUESTS });
    }

    const totalPrice = parseAmount(amount);
    if (totalPrice !== undefined && Number.isNaN(totalPrice)) found.totalPrice = t('booking.otaStay.validation.amountInvalid');
    if (chooseSource && !source) found.source = t('booking.otaStay.validation.sourceRequired');

    if (Object.keys(found).length > 0) return { errors: found };
    return {
      errors: found,
      data: {
        firstName: first,
        lastName: last,
        email: address,
        ...(numberOfGuests !== undefined ? { numberOfGuests } : {}),
        ...(totalPrice !== undefined ? { totalPrice } : {}),
        ...(chooseSource && source ? { source } : {}),
      },
    };
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate();
    setErrors(result.errors);
    if (!result.data) return;
    createStay.mutate({ blockId, data: result.data }, { onSuccess: (booking) => onCreated(booking) });
  };

  // Error text of a field and the attributes that tie it to its input.
  const fieldState = (field: Field) => {
    const message = errors[field];
    const id = `ota-stay-${field}-error`;
    return {
      aria: message ? { 'aria-invalid': true as const, 'aria-describedby': id } : {},
      error: message ? (
        <p id={id} className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null,
    };
  };
  const firstNameField = fieldState('firstName');
  const lastNameField = fieldState('lastName');
  const emailField = fieldState('email');
  const guestsField = fieldState('numberOfGuests');
  const amountField = fieldState('totalPrice');
  const sourceField = fieldState('source');

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate data-testid="ota-stay-form">
      <p className="text-sm text-muted-foreground">{t('booking.otaStay.formHint')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ota-stay-first-name">{t('booking.otaStay.firstName')}</Label>
          <Input
            id="ota-stay-first-name"
            autoComplete="off"
            value={firstName}
            onChange={(e) => edit('firstName', () => setFirstName(e.target.value))}
            {...firstNameField.aria}
          />
          {firstNameField.error}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ota-stay-last-name">{t('booking.otaStay.lastName')}</Label>
          <Input
            id="ota-stay-last-name"
            autoComplete="off"
            value={lastName}
            onChange={(e) => edit('lastName', () => setLastName(e.target.value))}
            {...lastNameField.aria}
          />
          {lastNameField.error}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ota-stay-email">{t('booking.otaStay.email')}</Label>
        <Input
          id="ota-stay-email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => edit('email', () => setEmail(e.target.value))}
          {...emailField.aria}
        />
        <p className="text-xs text-muted-foreground">{t('booking.otaStay.emailHint')}</p>
        {emailField.error}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ota-stay-guests">{t('booking.otaStay.numberOfGuests')}</Label>
          <Input
            id="ota-stay-guests"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_GUESTS}
            value={guests}
            onChange={(e) => edit('numberOfGuests', () => setGuests(e.target.value))}
            {...guestsField.aria}
          />
          {guestsField.error}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ota-stay-amount">{t('booking.otaStay.totalPrice')}</Label>
          <Input
            id="ota-stay-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => edit('totalPrice', () => setAmount(e.target.value))}
            {...amountField.aria}
          />
          <p className="text-xs text-muted-foreground">{t('booking.otaStay.totalPriceHint')}</p>
          {amountField.error}
        </div>
      </div>
      {chooseSource && (
        <div className="space-y-2">
          <Label htmlFor="ota-stay-source">{t('booking.otaStay.source')}</Label>
          <select
            id="ota-stay-source"
            value={source}
            onChange={(e) => edit('source', () => setSource(e.target.value as OtaStaySource | ''))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            {...sourceField.aria}
          >
            <option value="">{t('booking.otaStay.sourcePlaceholder')}</option>
            {OTA_STAY_SOURCES.map((value) => (
              <option key={value} value={value}>
                {getBookingSourceLabel(value, t)}
              </option>
            ))}
          </select>
          {sourceField.error}
        </div>
      )}

      {createStay.isError && (
        <p className="text-sm text-destructive" role="alert" data-testid="ota-stay-error">
          {getProblemMessage(createStay.error, t) ?? t('booking.otaStay.failed')}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={createStay.isPending}>
          {t('booking.otaStay.cancel')}
        </Button>
        <Button type="submit" disabled={createStay.isPending}>
          {createStay.isPending ? t('booking.otaStay.submitting') : t('booking.otaStay.submit')}
        </Button>
      </div>
    </form>
  );
}
