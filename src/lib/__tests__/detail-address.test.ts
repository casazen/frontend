import { describe, expect, it } from 'vitest';
import {
  DETAIL_PARAM,
  hasDetailParam,
  isValidDetailId,
  isValidDetailKind,
  parseDetailValue,
  readDetail,
  searchWithDetail,
} from '../detail-address';

describe('address of the detail drawer (UI-15)', () => {
  describe('kind', () => {
    it.each(['booking', 'service-request', 'a', 'dev-booking', 'k2'])('isValidDetailKind_%s_IsAccepted', (kind) => {
      expect(isValidDetailKind(kind)).toBe(true);
    });

    it.each(['', 'Booking', '2booking', 'book ing', 'book_ing', 'booking:x', '-booking', 'a'.repeat(33), 'prenotazione!'])(
      'isValidDetailKind_%j_IsRefused',
      (kind) => {
        expect(isValidDetailKind(kind)).toBe(false);
      },
    );
  });

  describe('id', () => {
    it.each(['3f2a9c1e-7b1d-4c55-9a3e-0d1f2a3b4c5d', 'bk-2041', '42', '2026-10-16', 'casa_bianca', 'a:b', 'ev.1', '_x'])(
      'isValidDetailId_%s_IsAccepted',
      (id) => {
        expect(isValidDetailId(id)).toBe(true);
      },
    );

    it.each(['', '..', '.', '../../admin', 'a/b', 'a b', 'a?b=c', 'a#b', 'a&b', 'a%2e', '-a', '.a', '<x>', 'a'.repeat(129), 'a\\b'])(
      'isValidDetailId_%j_IsRefused_BecauseItGoesIntoARequest',
      (id) => {
        expect(isValidDetailId(id)).toBe(false);
      },
    );
  });

  describe('reading the address', () => {
    it('parseDetailValue_KindAndId_AreSplitAtTheFirstColon', () => {
      expect(parseDetailValue('booking:abc-1')).toEqual({ kind: 'booking', id: 'abc-1' });
      expect(parseDetailValue('slot:2026-10-16:10:30')).toEqual({ kind: 'slot', id: '2026-10-16:10:30' });
    });

    it.each([null, undefined, '', 'booking', ':abc', 'booking:', 'Booking:abc', 'booking:../x', 'booking:a b'])(
      'parseDetailValue_%j_IsNotADrawer',
      (value) => {
        expect(parseDetailValue(value)).toBeNull();
      },
    );

    it('readDetail_AddressWithTheParameter_GivesTheDrawer', () => {
      expect(readDetail('?chip=pending&detail=booking:abc-1&page=2')).toEqual({ kind: 'booking', id: 'abc-1' });
    });

    it('readDetail_ColonWrittenAsPercent3A_IsTheSameDrawer', () => {
      expect(readDetail('?detail=booking%3Aabc-1')).toEqual({ kind: 'booking', id: 'abc-1' });
    });

    it('readDetail_NoParameterOrANotValidOne_IsNull', () => {
      expect(readDetail('')).toBeNull();
      expect(readDetail('?chip=pending')).toBeNull();
      expect(readDetail('?detail=nonsense')).toBeNull();
      expect(readDetail(new URLSearchParams('detail=booking:../../x'))).toBeNull();
    });

    it('hasDetailParam_ValidOrNot_SaysTheAddressCarriesIt', () => {
      expect(hasDetailParam('?detail=booking:1')).toBe(true);
      expect(hasDetailParam('?detail=garbage')).toBe(true);
      expect(hasDetailParam('?chip=pending')).toBe(false);
      expect(hasDetailParam('')).toBe(false);
    });
  });

  describe('writing the address', () => {
    it('searchWithDetail_OpenOnAPageWithAList_KeepsEveryOtherParameter', () => {
      const search = searchWithDetail('?q=rossi&chip=pending&f_channel=airbnb,direct&sort=total:desc', { kind: 'booking', id: 'abc-1' });

      const params = new URLSearchParams(search);
      expect(params.get('detail')).toBe('booking:abc-1');
      expect(params.get('q')).toBe('rossi');
      expect(params.get('chip')).toBe('pending');
      expect(params.get('f_channel')).toBe('airbnb,direct');
      expect(params.get('sort')).toBe('total:desc');
    });

    it('searchWithDetail_TheColon_IsWrittenAsItIsForPeopleToRead', () => {
      expect(searchWithDetail('', { kind: 'booking', id: 'abc-1' })).toBe('?detail=booking:abc-1');
      expect(searchWithDetail('?q=a', { kind: 'booking', id: 'x:y' })).toBe('?q=a&detail=booking:x:y');
    });

    it('searchWithDetail_ADrawerAlreadyThere_IsReplacedInPlace', () => {
      expect(searchWithDetail('?detail=booking:a&q=x', { kind: 'property', id: 'b' })).toBe('?detail=property:b&q=x');
    });

    it('searchWithDetail_Null_TakesTheDrawerAwayAndNothingElse', () => {
      expect(searchWithDetail('?q=x&detail=booking:a&page=2', null)).toBe('?q=x&page=2');
      expect(searchWithDetail('?detail=booking:a', null)).toBe('');
      expect(searchWithDetail('', null)).toBe('');
    });

    it('searchWithDetail_AParameterThatEndsInDetail_IsNotTheDrawer', () => {
      const search = searchWithDetail('?f_detail=1&xdetail=2', { kind: 'booking', id: 'a' });

      expect(new URLSearchParams(search).get('f_detail')).toBe('1');
      expect(new URLSearchParams(search).get('xdetail')).toBe('2');
      expect(new URLSearchParams(search).get('detail')).toBe('booking:a');
    });

    it('searchWithDetail_AnotherParameterWithAColon_KeepsItsValue', () => {
      const search = searchWithDetail('?sort=total:desc&f_arrival=2026-10-01..2026-10-31', { kind: 'booking', id: 'a' });

      const params = new URLSearchParams(search);
      expect(params.get('sort')).toBe('total:desc');
      expect(params.get('f_arrival')).toBe('2026-10-01..2026-10-31');
      expect(params.get('detail')).toBe('booking:a');
    });

    it('searchWithDetail_ResultCanBeReadBack', () => {
      const ref = { kind: 'service-request', id: '3f2a9c1e-7b1d' };

      expect(readDetail(searchWithDetail('?tab=ical', ref))).toEqual(ref);
    });

    it('DETAIL_PARAM_IsDetail_ThatNoListOrTabUses', () => {
      expect(DETAIL_PARAM).toBe('detail');
    });
  });
});
