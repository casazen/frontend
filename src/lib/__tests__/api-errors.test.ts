import { describe, it, expect, beforeAll } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import {
  AuthTokenUnavailableError,
  getProblemCode,
  getProblemMessage,
  isTransientRequestError,
} from '../api-errors';
import { retryTransientErrors } from '../query-client';

const t = (key: string) => i18n.t(key);

function httpError(status: number, data?: unknown, config: Partial<InternalAxiosRequestConfig> = {}): AxiosError {
  const fullConfig = { headers: new AxiosHeaders(), ...config } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, fullConfig, {}, {
    status,
    data,
    statusText: '',
    headers: {},
    config: fullConfig,
  });
}

function noResponseError(code: string): AxiosError {
  return new AxiosError('Network Error', code, { headers: new AxiosHeaders() } as InternalAxiosRequestConfig, {});
}

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

describe('getProblemMessage (A9-09 FE)', () => {
  it('getProblemMessage_problemDetailsDetail_returnsDetail', () => {
    const error = httpError(409, {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.10',
      title: 'Conflict',
      status: 409,
      detail: 'Le date selezionate non sono disponibili.',
    });

    expect(getProblemMessage(error, t)).toBe('Le date selezionate non sono disponibili.');
  });

  it('getProblemMessage_validationErrors_joinsFieldMessages', () => {
    const error = httpError(400, {
      title: 'One or more validation errors occurred.',
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
      errors: { Email: ["L'email non è valida."], Name: ['Il nome è obbligatorio.', "L'email non è valida."] },
    });

    expect(getProblemMessage(error, t)).toBe("L'email non è valida.\nIl nome è obbligatorio.");
  });

  it('getProblemMessage_knownCode_prefersTranslatedCode', () => {
    const error = httpError(409, { error: 'Il piano è gestito da Stripe.', code: 'managed_by_stripe' });

    expect(getProblemMessage(error, t)).toBe(i18n.t('apiErrors.codes.managedByStripe'));
  });

  it('getProblemMessage_unknownCode_fallsBackToServerText', () => {
    const error = httpError(409, { error: 'Richiesta già presa in carico da un altro fornitore', code: 'x_unknown' });

    expect(getProblemMessage(error, t)).toBe('Richiesta già presa in carico da un altro fornitore');
  });

  it('getProblemMessage_legacyErrorAndMessage_readsBoth', () => {
    expect(getProblemMessage(httpError(400, { error: 'Indirizzo già usato da un immobile attivo' }), t)).toBe(
      'Indirizzo già usato da un immobile attivo',
    );
    expect(
      getProblemMessage(httpError(400, { error: 'too_many_guests', message: 'Too many guests for this property' }), t),
    ).toBe('Too many guests for this property');
  });

  it('getProblemMessage_plainStringBody_returnsIt', () => {
    expect(getProblemMessage(httpError(400, 'Data di check-out non valida'), t)).toBe('Data di check-out non valida');
  });

  it('getProblemMessage_customProblemTitle_isUsedButRfcReasonPhraseIsNot', () => {
    expect(
      getProblemMessage(httpError(422, { type: 'https://casazen.app/errors/cin', title: 'CIN non valido per il comune' }), t),
    ).toBe('CIN non valido per il comune');
    expect(
      getProblemMessage(httpError(404, { type: 'https://tools.ietf.org/html/rfc9110#section-15.5.5', title: 'Not Found' }), t),
    ).toBeUndefined();
  });

  it('getProblemMessage_nothingUseful_returnsUndefinedForCallerFallback', () => {
    expect(getProblemMessage(httpError(400), t)).toBeUndefined();
    expect(getProblemMessage(httpError(404, { error: 'NotFound' }), t)).toBeUndefined();
    expect(getProblemMessage(httpError(400, '<!doctype html><html></html>'), t)).toBeUndefined();
    expect(getProblemMessage(new Error('boom'), t)).toBeUndefined();

    const fallback = getProblemMessage(httpError(400), t) ?? i18n.t('toast.bookingCreateFailed');
    expect(fallback).toBe('Impossibile creare la prenotazione');
  });

  it('getProblemMessage_serverError_ignoresFreeTextButKeepsCodes', () => {
    expect(getProblemMessage(httpError(503, { detail: 'Npgsql.PostgresException: 23505 duplicate key' }), t)).toBeUndefined();
    expect(getProblemMessage(httpError(502, { error: 'smtp down', code: 'invite_email_failed' }), t)).toBe(
      i18n.t('apiErrors.codes.inviteEmailFailed'),
    );
  });

  it('getProblemMessage_authAndPermissionStatuses_useLocalisedMessages', () => {
    expect(getProblemMessage(httpError(401, { detail: 'UnauthorizedDetail' }), t)).toBe(i18n.t('apiErrors.sessionExpired'));
    expect(getProblemMessage(httpError(403, { error: 'Access denied for this organization' }), t)).toBe(
      i18n.t('apiErrors.forbidden'),
    );
    expect(getProblemMessage(httpError(429), t)).toBe(i18n.t('apiErrors.tooManyRequests'));
    expect(getProblemMessage(new AuthTokenUnavailableError('login_required'), t)).toBe(i18n.t('apiErrors.sessionExpired'));
  });

  it('getProblemMessage_networkFailureOrCancel_distinguishesThem', () => {
    expect(getProblemMessage(noResponseError(AxiosError.ERR_NETWORK), t)).toBe(i18n.t('apiErrors.network'));
    expect(getProblemMessage(noResponseError(AxiosError.ECONNABORTED), t)).toBe(i18n.t('apiErrors.network'));
    expect(getProblemMessage(noResponseError(AxiosError.ERR_CANCELED), t)).toBeUndefined();
  });

  it('getProblemMessage_englishLocale_translatesCodes', async () => {
    await i18n.changeLanguage('en');
    try {
      expect(getProblemMessage(httpError(403, { code: 'plan_required' }), t)).toBe('This feature requires a higher plan.');
    } finally {
      await i18n.changeLanguage('it');
    }
  });
});

describe('getProblemCode', () => {
  it('getProblemCode_codeExtension_returnsIt', () => {
    expect(getProblemCode({ code: 'plan_limit_reached' })).toBe('plan_limit_reached');
    expect(getProblemCode({ code: 'not a code' })).toBeUndefined();
    expect(getProblemCode('plan_limit_reached')).toBeUndefined();
  });
});

describe('retry policy (A9-22)', () => {
  it('isTransientRequestError_classifiesStatuses', () => {
    expect(isTransientRequestError(httpError(500))).toBe(true);
    expect(isTransientRequestError(httpError(503))).toBe(true);
    expect(isTransientRequestError(httpError(501))).toBe(false);
    expect(isTransientRequestError(httpError(400))).toBe(false);
    expect(isTransientRequestError(httpError(404))).toBe(false);
    expect(isTransientRequestError(httpError(429))).toBe(false);
    expect(isTransientRequestError(noResponseError(AxiosError.ERR_NETWORK))).toBe(true);
    expect(isTransientRequestError(noResponseError(AxiosError.ETIMEDOUT))).toBe(true);
    expect(isTransientRequestError(noResponseError(AxiosError.ERR_CANCELED))).toBe(false);
    expect(isTransientRequestError(new AuthTokenUnavailableError('login_required'))).toBe(false);
  });

  it('retryTransientErrors_default_retriesServerErrorsAtMostTwice', () => {
    const retry = retryTransientErrors();
    expect(retry(0, httpError(500))).toBe(true);
    expect(retry(1, httpError(500))).toBe(true);
    expect(retry(2, httpError(500))).toBe(false);
  });

  it('retryTransientErrors_clientError_neverRetries', () => {
    const retry = retryTransientErrors();
    expect(retry(0, httpError(404))).toBe(false);
    expect(retry(0, httpError(401))).toBe(false);
    expect(retry(0, httpError(403))).toBe(false);
  });

  it('retryTransientErrors_customLimit_isRespected', () => {
    const retry = retryTransientErrors(1);
    expect(retry(0, noResponseError(AxiosError.ERR_NETWORK))).toBe(true);
    expect(retry(1, noResponseError(AxiosError.ERR_NETWORK))).toBe(false);
  });
});
