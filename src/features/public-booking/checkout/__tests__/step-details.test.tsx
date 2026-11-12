import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import { EMPTY_DETAILS, type DetailsValues } from '../checkout-model';
import { StepDetails } from '../step-details';

// The step reads the check-in window of the property only to offer arrival hours: none here.
vi.mock('@/features/public-booking/booking/booking-context', () => ({
  useBooking: () => ({ property: { checkInFrom: null, checkInTo: null } }),
}));

/**
 * The second step of the checkout and the consents it collects (NF-90, AC-NF90-4, AC-NF90-6): the two boxes exist only when the site has the
 * version of the consent text, they start unticked, WhatsApp waits for a phone number and is refused without one, and the soft opt-in notice
 * is a paragraph that asks nothing and blocks nothing.
 */
const FILLED: DetailsValues = { ...EMPTY_DETAILS, firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com', country: 'IT' };

interface Props {
  offersVersion?: string | null;
  softOptInNoticeVersion?: string | null;
  values?: DetailsValues;
}

function renderStep({ offersVersion = '2026-11-v1', softOptInNoticeVersion = null, values = FILLED }: Props = {}) {
  const onChange = vi.fn();
  const onNext = vi.fn();
  render(
    <StepDetails
      values={values}
      onChange={onChange}
      offersVersion={offersVersion}
      softOptInNoticeVersion={softOptInNoticeVersion}
      siteName="Demo Stays"
      onBack={vi.fn()}
      onNext={onNext}
    />,
  );
  return { onChange, onNext };
}

const emailBox = () => screen.getByTestId('checkout-offers-email');
const whatsappBox = () => screen.getByTestId('checkout-offers-whatsapp');
const lastDetails = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.calls.at(-1)?.[0] as DetailsValues;

describe('StepDetails consents (NF-90)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('StepDetails_SiteWithTheConsentVersion_ShowsTheEmailAndWhatsAppBoxesUnticked', () => {
    renderStep();

    expect(screen.getByTestId('checkout-offers')).toBeInTheDocument();
    expect(emailBox()).toHaveAttribute('aria-checked', 'false');
    expect(whatsappBox()).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByLabelText('E-mail')).toBe(emailBox());
    // The hint of the box stays: the guest can unsubscribe whenever they want.
    expect(screen.getByTestId('checkout-offers')).toHaveTextContent('Puoi cancellarti quando vuoi.');
  });

  it('StepDetails_SiteWithoutTheConsentVersion_ShowsNoBoxAndCollectsNoConsent', () => {
    const { onChange } = renderStep({ offersVersion: null });

    expect(screen.queryByTestId('checkout-offers')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(lastDetails(onChange)).toMatchObject({ offersEmail: false, offersWhatsApp: false });
  });

  it('StepDetails_WhatsAppBox_IsDisabledWithItsHintUntilAPhoneIsTyped', () => {
    renderStep();

    expect(whatsappBox()).toBeDisabled();
    expect(screen.getByTestId('checkout-offers-whatsapp-hint')).toHaveTextContent('Scrivi prima il tuo numero di telefono');
    fireEvent.change(screen.getByLabelText(/Telefono/), { target: { value: '+39 333 1234567' } });

    expect(whatsappBox()).toBeEnabled();
    expect(screen.queryByTestId('checkout-offers-whatsapp-hint')).not.toBeInTheDocument();
    expect(whatsappBox()).toHaveAttribute('aria-checked', 'false');
  });

  it('StepDetails_WhatsAppTickedThenThePhoneCleared_IsRefusedOnTheBoxAndNothingMovesOn', async () => {
    const { onChange, onNext } = renderStep();
    const phone = screen.getByLabelText(/Telefono/);

    fireEvent.change(phone, { target: { value: '+39 333 1234567' } });
    fireEvent.click(whatsappBox());
    expect(whatsappBox()).toHaveAttribute('aria-checked', 'true');
    fireEvent.change(phone, { target: { value: '' } });

    // A box already ticked stays free, so the guest can untick it; the form will not go on while it is ticked with no number.
    expect(whatsappBox()).toBeEnabled();
    expect(await screen.findByTestId('checkout-offers-whatsapp-error')).toHaveTextContent('scrivi il tuo numero di telefono');
    fireEvent.click(screen.getByTestId('checkout-next'));
    await waitFor(() => expect(screen.getByTestId('checkout-offers-whatsapp-error')).toBeInTheDocument());
    expect(onNext).not.toHaveBeenCalled();

    fireEvent.click(whatsappBox());
    await waitFor(() => expect(screen.queryByTestId('checkout-offers-whatsapp-error')).not.toBeInTheDocument());
    fireEvent.click(screen.getByTestId('checkout-next'));
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    expect(lastDetails(onChange)).toMatchObject({ offersEmail: false, offersWhatsApp: false, phone: '' });
  });

  it('StepDetails_TickedBoxes_AreKeptInTheDraftAsTheGuestTicksThem', () => {
    const { onChange } = renderStep();

    fireEvent.change(screen.getByLabelText(/Telefono/), { target: { value: '+39 333 1234567' } });
    fireEvent.click(emailBox());
    fireEvent.click(whatsappBox());

    expect(lastDetails(onChange)).toMatchObject({ offersEmail: true, offersWhatsApp: true, phone: '+39 333 1234567' });
  });

  it('StepDetails_SoftOptInNotice_IsAParagraphNotABoxAndBlocksNothing', async () => {
    const { onNext } = renderStep({ offersVersion: null, softOptInNoticeVersion: '2026-11-v1' });

    expect(screen.getByTestId('checkout-soft-opt-in-notice')).toHaveTextContent('Demo Stays userà questo indirizzo e-mail');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('checkout-next'));
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
  });

  it('StepDetails_NoSoftOptInVersion_ShowsNoNotice', () => {
    renderStep({ softOptInNoticeVersion: null });

    expect(screen.queryByTestId('checkout-soft-opt-in-notice')).not.toBeInTheDocument();
  });
});
