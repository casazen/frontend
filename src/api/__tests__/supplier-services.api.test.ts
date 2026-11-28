import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from '@/lib/axios';
import { uploadSupplierServicePhotos } from '../supplier-services.api';

vi.mock('@/lib/axios', () => ({ default: { post: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('uploadSupplierServicePhotos (SP-06)', () => {
  it('UploadSupplierServicePhotos_Files_GoAsTheMultipartFieldPhotosWithATimeoutForSlowConnections', async () => {
    const saved = { id: 'svc 1', version: 4 };
    vi.mocked(axios.post).mockResolvedValueOnce({ data: saved });
    const files = [new File(['a'], 'cucina.jpg', { type: 'image/jpeg' }), new File(['b'], 'bagno.png', { type: 'image/png' })];

    const result = await uploadSupplierServicePhotos('svc 1', files);

    expect(result).toBe(saved);
    const [url, body, config] = vi.mocked(axios.post).mock.calls[0]!;
    expect(url).toBe('/supplier/services/svc%201/photos');
    expect((body as FormData).getAll('photos').map((file) => (file as File).name)).toEqual(['cucina.jpg', 'bagno.png']);
    expect(config).toMatchObject({ timeout: 120_000, headers: { 'Content-Type': 'multipart/form-data' } });
  });
});
