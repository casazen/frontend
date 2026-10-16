import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { describeServiceError, formPathOfField, markServerFields } from '../service-errors';
import { emptyServiceForm, type ServiceFormValues } from '../service-form';

function problem(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

describe('describeServiceError', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('DescribeServiceError_InvalidFields_NamesThemAsTheFormDoesNotAsTheApiDoes', () => {
    const found = describeServiceError(
      problem(422, { code: 'supplier_service_invalid', detail: 'Alcuni dati non sono validi (campi: name, supplements[1].amountCents).', fields: ['name', 'supplements[1].amountCents', 'supplements[2].per'] }),
      i18n.t,
    );
    expect(found.kind).toBe('invalid');
    expect(found.status).toBe(422);
    expect(found.fields).toEqual(['name', 'supplements[1].amountCents', 'supplements[2].per']);
    // Each name once, and not a word of the JSON.
    expect(found.message).toBe('Controlla questi dati: Nome, Supplementi.');
    expect(found.message).not.toMatch(/amountCents|supplements\[/);
  });

  it('DescribeServiceError_NotPublishable_SaysWhatIsStillNeeded', () => {
    const found = describeServiceError(problem(422, { code: 'supplier_service_not_publishable', fields: ['durationMinutes', 'priceFromCents'] }), i18n.t);
    expect(found.kind).toBe('notPublishable');
    expect(found.message).toBe('Per pubblicare servono ancora: Durata, Prezzo.');
  });

  it('DescribeServiceError_FieldsTheFormHasNoNameFor_FallBackToTheGeneralSentence', () => {
    const found = describeServiceError(problem(422, { code: 'supplier_service_invalid', fields: ['sortOrder'] }), i18n.t);
    expect(found.message).toBe('Alcuni dati non sono validi. Controllali e riprova.');
    expect(describeServiceError(problem(422, { code: 'supplier_service_not_publishable' }), i18n.t).message).toBe('Per pubblicare mancano ancora dei dati.');
  });

  it('DescribeServiceError_InvalidCategory_IsTheCategoryField', () => {
    const found = describeServiceError(problem(422, { code: 'invalid_service_category', detail: 'Categoria non valida: Pulizie.' }), i18n.t);
    expect(found.kind).toBe('invalid');
    expect(found.fields).toEqual(['category']);
    expect(found.message).toBe('Controlla questi dati: Categoria.');
  });

  it('DescribeServiceError_ChangedElsewhere_SaysToReloadInWordsOfTheScreen', () => {
    const found = describeServiceError(problem(409, { code: 'supplier_service_changed', detail: 'Il servizio è stato modificato da un’altra scheda…' }), i18n.t);
    expect(found.kind).toBe('changed');
    expect(found.status).toBe(409);
    expect(found.message).toBe('Questo servizio è stato modificato altrove. Ricarica per vedere la versione salvata.');
  });

  it('DescribeServiceError_Limit_CarriesTheNumber', () => {
    const found = describeServiceError(problem(422, { code: 'supplier_service_limit_reached' }), i18n.t);
    expect(found.kind).toBe('limit');
    expect(found.message).toContain('30 servizi');
  });

  it.each([
    ['supplier_service_not_found', 404, 'notFound'],
    ['supplier_service_cannot_pause', 422, 'cannotPause'],
  ] as const)('DescribeServiceError_%s_Is%s', (code, status, kind) => {
    const found = describeServiceError(problem(status, { code }), i18n.t);
    expect(found.kind).toBe(kind);
    expect(found.message.length).toBeGreaterThan(10);
  });

  it('DescribeServiceError_Photo_UsesTheMessageOfTheApiWhichNamesTheFile', () => {
    const detail = 'Il file "gatto.gif" non è una foto valida: sono ammesse solo immagini JPEG, PNG o WebP.';
    const found = describeServiceError(problem(422, { code: 'supplier_service_photo_invalid_type', detail }), i18n.t);
    expect(found.kind).toBe('photo');
    expect(found.message).toBe(detail);
    expect(describeServiceError(problem(422, { code: 'supplier_service_photo_none' }), i18n.t).message).toBe('Non siamo riusciti a caricare le foto. Riprova tra poco.');
  });

  it('DescribeServiceError_AnythingElse_IsGenericOrTheMessageOfTheServer', () => {
    expect(describeServiceError(problem(500, { title: 'Internal Server Error' }), i18n.t)).toMatchObject({ kind: 'other', message: 'Non siamo riusciti a completare l’operazione. Riprova tra poco.' });
    expect(describeServiceError(new Error('boom'), i18n.t)).toMatchObject({ kind: 'other', status: undefined, fields: [] });
    expect(describeServiceError(problem(400, { detail: 'Il corpo della richiesta non è valido.' }), i18n.t).message).toBe('Il corpo della richiesta non è valido.');
  });

  it('DescribeServiceError_English_IsInEnglish', async () => {
    await i18n.changeLanguage('en');
    const found = describeServiceError(problem(422, { code: 'supplier_service_not_publishable', fields: ['name', 'priceFromCents'] }), i18n.t);
    expect(found.message).toBe('To publish you still need: Name, Price.');
  });
});

describe('formPathOfField', () => {
  it.each([
    ['name', 'name'],
    ['category', 'category'],
    ['summary', 'summary'],
    ['description', 'description'],
    ['priceFromCents', 'amount'],
    ['priceUnit', 'fixedUnit'],
    ['durationMinutes', 'durationMinutes'],
    ['minNoticeHours', 'minNoticeHours'],
    ['weekdays', 'weekdays'],
    ['included', 'included'],
    ['excluded', 'excluded'],
    ['supplements', 'supplements'],
    ['supplements[0].label', 'supplements.0.label'],
    ['supplements[1].amountCents', 'supplements.1.amount'],
    ['supplements[12].per', 'supplements.12.per'],
    ['supplements[2].max', 'supplements.2.max'],
    // The code comes from the label: a problem with it is a problem of the label.
    ['supplements[3].code', 'supplements.3.label'],
  ])('FormPathOfField_%s_Is%s', (field, path) => {
    expect(formPathOfField(field)).toBe(path);
  });

  it.each(['photoUrls', 'sortOrder', 'supplements[1].unknown', 'supplements[x].label', 'other'])('FormPathOfField_%s_HasNoPlaceInTheForm', (field) => {
    expect(formPathOfField(field)).toBeNull();
  });
});

describe('markServerFields', () => {
  function renderForm() {
    return renderHook(() => useForm<ServiceFormValues>({ defaultValues: { ...emptyServiceForm(), supplements: [{ code: '', label: '', amount: '', per: 'flat', max: '' }] } }));
  }

  it('MarkServerFields_Invalid_MarksTheFieldsWithTheGeneralMessage', () => {
    const { result } = renderForm();
    let marked: string[] = [];
    act(() => {
      marked = markServerFields(result.current, { kind: 'invalid', fields: ['name', 'priceFromCents', 'supplements[0].amountCents', 'photoUrls'] });
    });
    expect(marked).toEqual(['name', 'amount', 'supplements.0.amount']);
    expect(result.current.getFieldState('name').error?.message).toBe('supplier.services.errors.serverField');
    expect(result.current.getFieldState('amount').error?.type).toBe('server');
    expect(result.current.getFieldState('supplements.0.amount').error?.message).toBe('supplier.services.errors.serverField');
  });

  it('MarkServerFields_NotPublishable_SaysItIsNeededToPublish', () => {
    const { result } = renderForm();
    act(() => {
      markServerFields(result.current, { kind: 'notPublishable', fields: ['durationMinutes'] });
    });
    expect(result.current.getFieldState('durationMinutes').error?.message).toBe('supplier.services.errors.requiredToPublish');
  });

  it('MarkServerFields_OtherKinds_MarkNothing', () => {
    const { result } = renderForm();
    let marked: string[] = ['x'];
    act(() => {
      marked = markServerFields(result.current, { kind: 'changed', fields: ['name'] });
    });
    expect(marked).toEqual([]);
    expect(result.current.getFieldState('name').error).toBeUndefined();
  });
});
