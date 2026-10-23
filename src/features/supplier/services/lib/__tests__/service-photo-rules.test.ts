import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import { refuseFiles } from '../service-photo-rules';

const photo = (name: string, type = 'image/jpeg', size = 1024) => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('refuseFiles', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('RefuseFiles_PhotosThatFit_AreNotRefused', () => {
    expect(refuseFiles([photo('a.jpg'), photo('b.png', 'image/png'), photo('c.webp', 'image/webp')], 3, i18n.t)).toBeNull();
    expect(refuseFiles([photo('a.jpg', 'image/jpeg', 10 * 1024 * 1024)], 5, i18n.t)).toBeNull();
  });

  it('RefuseFiles_NoRoomLeft_SaysTheLimit', () => {
    expect(refuseFiles([photo('a.jpg')], 6, i18n.t)).toBe('Hai già 6 foto: toglierne una prima di aggiungerne altre.');
  });

  it('RefuseFiles_MoreThanTheRoom_SaysHowManyCanStillGoUp', () => {
    expect(refuseFiles([photo('a.jpg'), photo('b.jpg'), photo('c.jpg')], 4, i18n.t)).toBe('Puoi aggiungere ancora 2 foto: ne hai scelte 3.');
    expect(refuseFiles([photo('a.jpg'), photo('b.jpg')], 5, i18n.t)).toBe('Puoi aggiungere ancora 1 foto: ne hai scelte 2.');
  });

  it('RefuseFiles_NotAPhoto_NamesTheFile', () => {
    expect(refuseFiles([photo('a.jpg'), photo('gatto.gif', 'image/gif')], 0, i18n.t)).toBe('«gatto.gif» non è una foto valida: usa immagini JPEG, PNG o WebP.');
    expect(refuseFiles([photo('scheda.pdf', 'application/pdf')], 0, i18n.t)).toContain('scheda.pdf');
  });

  it('RefuseFiles_TypeUnknownToTheBrowser_IsJudgedByTheExtension', () => {
    expect(refuseFiles([photo('IMG_0001.JPEG', '')], 0, i18n.t)).toBeNull();
    expect(refuseFiles([photo('IMG_0002.heic', '')], 0, i18n.t)).toContain('IMG_0002.heic');
  });

  it('RefuseFiles_EmptyOrTooLarge_NamesTheFileAndTheLimit', () => {
    expect(refuseFiles([photo('vuota.jpg', 'image/jpeg', 0)], 0, i18n.t)).toBe('«vuota.jpg» è vuota o troppo grande: al massimo 10 MB.');
    expect(refuseFiles([photo('enorme.jpg', 'image/jpeg', 10 * 1024 * 1024 + 1)], 0, i18n.t)).toContain('enorme.jpg');
  });

  it('RefuseFiles_English_IsInEnglish', async () => {
    await i18n.changeLanguage('en');
    expect(refuseFiles([photo('a.jpg'), photo('b.jpg')], 5, i18n.t)).toBe('You can add 1 more photo: you chose 2.');
    expect(refuseFiles([photo('a.jpg'), photo('b.jpg'), photo('c.jpg')], 4, i18n.t)).toBe('You can add 2 more photos: you chose 3.');
  });
});
