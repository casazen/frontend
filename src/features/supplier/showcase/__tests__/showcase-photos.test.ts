import { describe, expect, it } from 'vitest';
import type { SupplierService } from '@/types/supplier-services';
import { buildPhotoPool, worksWithPhoto } from '../showcase-photos';

const service = (name: string, photoUrls: string[]) => ({ name, photoUrls }) as SupplierService;

describe('buildPhotoPool: the photos the supplier can choose from', () => {
  it('lists the photos of the profile first and then the ones of each service, each place counted in its own list', () => {
    const pool = buildPhotoPool(['https://cdn.example/p1.jpg', 'https://cdn.example/p2.jpg'], [
      service('Pulizie', ['https://cdn.example/s1.jpg']),
      service('Giardino', ['https://cdn.example/g1.jpg', 'https://cdn.example/g2.jpg']),
    ]);
    expect(pool.map((photo) => [photo.url.split('/').pop(), photo.from.kind, photo.number])).toEqual([
      ['p1.jpg', 'profile', 1],
      ['p2.jpg', 'profile', 2],
      ['s1.jpg', 'service', 1],
      ['g1.jpg', 'service', 1],
      ['g2.jpg', 'service', 2],
    ]);
    expect(pool[2].from).toEqual({ kind: 'service', name: 'Pulizie' });
  });

  it('takes a photo once, and leaves out what cannot be shown (a path of the old disk is not a photo)', () => {
    const pool = buildPhotoPool(['https://cdn.example/p1.jpg', '/uploads/vecchia.jpg'], [service('Pulizie', ['https://cdn.example/p1.jpg', 'https://cdn.example/s1.jpg'])]);
    expect(pool.map((photo) => photo.url)).toEqual(['https://cdn.example/p1.jpg', 'https://cdn.example/s1.jpg']);
  });

  it('is empty before the profile and the services are known', () => {
    expect(buildPhotoPool(undefined, undefined)).toEqual([]);
  });
});

describe('worksWithPhoto', () => {
  it('counts the jobs that have a photo, not the ones with a caption only', () => {
    expect(worksWithPhoto([{ photoUrl: 'https://cdn.example/a.jpg' }, { photoUrl: '  ', caption: 'x' }, { caption: 'y' }, { photoUrl: 'https://cdn.example/b.jpg' }])).toBe(2);
    expect(worksWithPhoto(undefined)).toBe(0);
  });
});
