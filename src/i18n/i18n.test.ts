import { describe, expect, it, beforeEach } from 'vitest';
import i18n from '@/i18n/config';
import {
  getBookingStatusLabel,
  getOtaConnectionStatusLabel,
  persistLocale,
  readPersistedLocale,
} from '@/lib/i18n-labels';

describe('i18n helpers', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('it');
  });

  it('returns Italian booking status labels', () => {
    const t = i18n.getFixedT('it');
    expect(getBookingStatusLabel('Confirmed', t)).toBe('Confermata');
    expect(getBookingStatusLabel('Pending', t)).toBe('In attesa');
  });

  it('returns English booking status labels', () => {
    const t = i18n.getFixedT('en');
    expect(getBookingStatusLabel('Confirmed', t)).toBe('Confirmed');
    expect(getOtaConnectionStatusLabel('connected', t)).toBe('Connected');
  });

  it('persists and reads locale from localStorage', () => {
    expect(readPersistedLocale()).toBeNull();

    persistLocale('en');
    expect(readPersistedLocale()).toBe('en');

    persistLocale('it');
    expect(readPersistedLocale()).toBe('it');
  });
});
