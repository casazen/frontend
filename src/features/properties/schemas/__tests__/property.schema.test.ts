import { describe, it, expect } from 'vitest';
import i18n from '@/i18n/config';
import { propertyFormSchema } from '../property.schema';

describe('propertyFormSchema cinCode', () => {
  const cinSchema = propertyFormSchema.shape.cinCode;

  it.each(['IT058091C27G5FFZDZ', 'IT015146A12HOLV2MZ', 'IT-048017-B4-2742QNBZ', 'it 058091 c2 7g5ffzdz', '', undefined])(
    'cinCode_RealCinOrEmpty_IsAccepted (%s)',
    (value) => {
      expect(cinSchema.safeParse(value).success).toBe(true);
    },
  );

  it.each(['IT-12345-1234567890', '015146-CNI-01894', 'IT058091C27G5FFZDZX'])(
    'cinCode_OldFormatOrNotACin_IsRejectedWithI18nKey (%s)',
    (value) => {
      const result = cinSchema.safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe('property.validation.cin.format');
    },
  );

  it('cinCode_FormatMessage_IsTranslatedInItalianAndEnglish', () => {
    expect(i18n.getFixedT('it')('property.validation.cin.format')).toContain('IT015146C2ABCDEFGH');
    expect(i18n.getFixedT('en')('property.validation.cin.format')).toContain('IT015146C2ABCDEFGH');
    expect(i18n.getFixedT('it')('property.validation.cin.format')).not.toContain('IT-XXXXX');
  });
});
