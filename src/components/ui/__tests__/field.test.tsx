import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import i18n from '@/i18n/config';
import { AA_TEXT_CONTRAST, contrastRatio } from '@/lib/public-site-colors';
import { fallbackColor, themeColor } from '@/test/colors';
import { Field } from '../field';
import { Input } from '../input';
import { Select } from '../select';

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(cleanup);

describe('Field wiring', () => {
  it('Field_Control_IsLabelledByItsLabel', () => {
    render(
      <Field label="Nome della struttura">
        <Input />
      </Field>,
    );

    const input = screen.getByLabelText('Nome della struttura');
    expect(input.tagName).toBe('INPUT');
    expect(input.id).not.toBe('');
  });

  it('Field_TwoFields_GetDifferentIds', () => {
    render(
      <>
        <Field label="Uno">
          <Input />
        </Field>
        <Field label="Due">
          <Input />
        </Field>
      </>,
    );

    expect(screen.getByLabelText('Uno').id).not.toBe(screen.getByLabelText('Due').id);
  });

  it('Field_IdOfTheChild_WinsOverTheIdProp', () => {
    render(
      <Field label="Importo" id="from-field">
        <Input id="amount" />
      </Field>,
    );

    expect(screen.getByLabelText('Importo')).toHaveAttribute('id', 'amount');
  });

  it('Field_IdProp_IsUsedWhenTheChildHasNone', () => {
    render(
      <Field label="Importo" id="amount" hint="In euro">
        <Input />
      </Field>,
    );

    const input = screen.getByLabelText('Importo');
    expect(input).toHaveAttribute('id', 'amount');
    expect(input).toHaveAttribute('aria-describedby', 'amount-hint');
  });

  it('Field_HintAndExample_AreDescribingTheControl', () => {
    render(
      <Field label="Codice" hint="Lo trovi nella email." example="AB-1234">
        <Input />
      </Field>,
    );

    const input = screen.getByLabelText('Codice');
    const hint = document.getElementById(input.getAttribute('aria-describedby') ?? '');
    expect(hint).toHaveTextContent('Lo trovi nella email.');
    expect(hint).toHaveTextContent('Esempio: AB-1234');
    expect(within(hint as HTMLElement).getByText('AB-1234').tagName).toBe('CODE');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('Field_ExistingAriaDescribedBy_IsKeptAndExtended', () => {
    render(
      <Field label="Codice" hint="Suggerimento" id="code">
        <Input aria-describedby="extra-help" />
      </Field>,
    );

    expect(screen.getByLabelText('Codice')).toHaveAttribute('aria-describedby', 'extra-help code-hint');
  });

  it('Field_RenderFunction_ReceivesThePropsToSpread', () => {
    render(
      <Field label="Città" id="city" error="Campo obbligatorio">
        {(control) => <input data-testid="custom" {...control} />}
      </Field>,
    );

    const input = screen.getByTestId('custom');
    expect(screen.getByLabelText('Città')).toBe(input);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'city-error');
  });

  it('Field_ChildThatIsNotAnElement_IsRenderedAsIs', () => {
    render(<Field label="Solo testo">{'testo semplice' as unknown as React.ReactElement}</Field>);

    expect(screen.getByText('testo semplice')).toBeInTheDocument();
  });
});

describe('Field messages', () => {
  it('Field_ErrorMessage_IsAnAlertWithAnIconAndMarksTheControlInvalid', () => {
    render(
      <Field label="Email" id="email" error="Inserisci un indirizzo valido">
        <Input />
      </Field>,
    );

    const input = screen.getByLabelText('Email');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Inserisci un indirizzo valido');
    expect(alert).toHaveAttribute('id', 'email-error');
    expect(alert.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
    expect(input).toHaveAccessibleDescription('Inserisci un indirizzo valido');
  });

  it('Field_ErrorAsReactHookFormFieldError_ShowsItsMessage', () => {
    render(
      <Field label="Importo" error={{ message: "L'importo deve essere maggiore di 0" }}>
        <Input />
      </Field>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent("L'importo deve essere maggiore di 0");
  });

  it('Field_ErrorThatIsAnI18nKey_IsTranslatedInTheCurrentLanguage', async () => {
    const key = 'payment.validation.bookingId.required';
    render(
      <Field label="Prenotazione" error={{ message: key }}>
        <Input />
      </Field>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(i18n.getFixedT('it')(key));
    expect(screen.queryByText(key)).not.toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage('en');
    });
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.getFixedT('en')(key));
  });

  it.each([undefined, null, '', { message: undefined }])('Field_NoError_%j_ShowsNoAlertAndNoInvalidFlag', (error) => {
    render(
      <Field label="Nome" error={error as undefined}>
        <Input />
      </Field>,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Nome')).not.toHaveAttribute('aria-describedby');
  });

  it('Field_Success_IsAStatusWithAnIconAndDescribesTheControl', () => {
    render(
      <Field label="Indirizzo" id="slug" success="Questo indirizzo è libero">
        <Input />
      </Field>,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Questo indirizzo è libero');
    expect(status.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByLabelText('Indirizzo')).toHaveAttribute('aria-describedby', 'slug-success');
    expect(screen.getByLabelText('Indirizzo')).not.toHaveAttribute('aria-invalid');
  });

  it('Field_HintErrorAndSuccess_AreAllReferencedInTheRightOrder', () => {
    render(
      <Field label="Campo" id="f" hint="Aiuto" error="Errore" success="Ok">
        <Input />
      </Field>,
    );

    expect(screen.getByLabelText('Campo')).toHaveAttribute('aria-describedby', 'f-hint f-error f-success');
  });

  it('Field_Optional_AddsTheMarkerInTheLanguageOfTheUser', async () => {
    render(
      <Field label="Note" optional>
        <Input />
      </Field>,
    );
    expect(screen.getByText('(facoltativo)')).toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage('en');
    });
    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });

  it('Field_NotOptional_HasNoMarker', () => {
    render(
      <Field label="Nome">
        <Input />
      </Field>,
    );

    expect(screen.queryByText('(facoltativo)')).not.toBeInTheDocument();
  });

  it('Field_Counter_SitsNextToTheLabel', () => {
    render(
      <Field label="Messaggio" counter="12/200">
        <Input />
      </Field>,
    );

    expect(screen.getByText('12/200')).toBeInTheDocument();
  });
});

describe('Field colors', () => {
  it('Field_ErrorAndSuccessText_MeetAaOnTheSurfaces', () => {
    const { container } = render(
      <Field label="Campo" error="Errore" success="Ok">
        <Input />
      </Field>,
    );

    const error = screen.getByRole('alert').className;
    const success = screen.getByRole('status').className;
    const surfaces = [themeColor('background'), themeColor('muted')];
    for (const surface of surfaces) {
      expect(contrastRatio(fallbackColor(error, 'danger-foreground'), surface)).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
      expect(contrastRatio(fallbackColor(success, 'success-foreground'), surface)).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
    }
    // The red outline of an invalid control is drawn by the field, whatever the control.
    expect((container.firstElementChild as HTMLElement).className).toContain('[&_[aria-invalid=true]]:outline-destructive');
  });
});

const schema = z.object({
  email: z.string().min(3, 'property.validation.name.minLength'),
  role: z.string().min(1, 'payment.validation.bookingId.required'),
});
type Values = z.infer<typeof schema>;

function RegisteredForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', role: '' } });
  return (
    <form onSubmit={handleSubmit(() => undefined)}>
      <Field label="Email" error={errors.email}>
        <Input {...register('email')} />
      </Field>
      <Field label="Ruolo" error={errors.role}>
        <Select {...register('role')}>
          <option value="">Scegli</option>
          <option value="host">Host</option>
        </Select>
      </Field>
      <button type="submit">Invia</button>
    </form>
  );
}

function ControlledForm() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: 'a@b.it', role: '' } });
  return (
    <form onSubmit={handleSubmit(() => undefined)}>
      <Controller
        name="role"
        control={control}
        render={({ field, fieldState }) => (
          <Field label="Ruolo" error={fieldState.error ?? errors.role}>
            <Select {...field}>
              <option value="">Scegli</option>
              <option value="host">Host</option>
            </Select>
          </Field>
        )}
      />
      <button type="submit">Invia</button>
    </form>
  );
}

describe('Field with react-hook-form', () => {
  it('Field_RegisteredControls_ShowTranslatedErrorsAfterSubmitAndClearThemWhenFixed', async () => {
    render(<RegisteredForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Invia' }));

    const email = screen.getByLabelText('Email');
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getByLabelText('Ruolo')).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription(i18n.getFixedT('it')('property.validation.name.minLength'));

    fireEvent.change(email, { target: { value: 'giulia@example.com' } });
    fireEvent.change(screen.getByLabelText('Ruolo'), { target: { value: 'host' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invia' }));

    await waitFor(() => expect(screen.queryAllByRole('alert')).toHaveLength(0));
    expect(email).not.toHaveAttribute('aria-invalid');
  });

  it('Field_ControllerRender_WiresTheSelectAndItsError', async () => {
    render(<ControlledForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Invia' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    const select = screen.getByLabelText('Ruolo');
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(select, { target: { value: 'host' } });
    expect(select).toHaveValue('host');
  });
});
