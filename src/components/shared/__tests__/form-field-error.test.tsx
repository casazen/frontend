import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import i18n from '@/i18n/config';
import { FormFieldError } from '../form-field-error';
import { propertyFormSchema, type PropertyFormValues } from '@/features/properties/schemas/property.schema';

const KEY = 'property.validation.name.minLength';

describe('FormFieldError', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('FormFieldError_I18nKeyMessage_RendersTranslationNotKey', () => {
    render(<FormFieldError error={{ message: KEY }} />);

    expect(screen.getByText(i18n.getFixedT('it')(KEY))).toBeInTheDocument();
    expect(screen.queryByText(KEY)).not.toBeInTheDocument();
  });

  it('FormFieldError_LanguageChanged_RendersNewLanguage', async () => {
    render(<FormFieldError error={{ message: KEY }} />);
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    expect(screen.getByText(i18n.getFixedT('en')(KEY))).toBeInTheDocument();
  });

  it('FormFieldError_PlainTextMessage_RendersItUnchanged', () => {
    render(<FormFieldError message="Il server ha rifiutato il valore: riprova" />);

    expect(screen.getByText('Il server ha rifiutato il valore: riprova')).toBeInTheDocument();
  });

  it('FormFieldError_NoError_RendersNothing', () => {
    const { container } = render(<FormFieldError error={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });
});

function PropertyNameField() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: { name: 'ab' },
  });
  return (
    <form onSubmit={handleSubmit(() => undefined)}>
      <input aria-label="name" {...register('name')} />
      <FormFieldError error={errors.name} />
      <button type="submit">submit</button>
    </form>
  );
}

describe('FormFieldError with zodResolver', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('zodResolver_SchemaKeyMessage_ShowsTranslatedTextUnderField', async () => {
    render(<PropertyNameField />);

    await act(async () => {
      screen.getByText('submit').click();
    });

    expect(await screen.findByText(i18n.getFixedT('it')(KEY))).toBeInTheDocument();
    expect(screen.queryByText(KEY)).not.toBeInTheDocument();
  });
});
