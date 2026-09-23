import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyPhotoCarousel } from '../property-photo-carousel';

const STORAGE = 'https://ref.supabase.co/storage/v1/object/public/casazen-prod-public/properties/p/photos';

describe('PropertyPhotoCarousel (FD-07)', () => {
  it('absoluteStorageUrl_rendersImage', () => {
    render(<PropertyPhotoCarousel photoUrls={[`${STORAGE}/a.jpg`]} name="Villa" />);

    expect(screen.getByRole('img', { name: 'Villa - foto 1' })).toHaveAttribute('src', `${STORAGE}/a.jpg`);
  });

  it('legacyRelativeUrl_isNotRequestedAndCountsOnlyDisplayablePhotos', () => {
    render(<PropertyPhotoCarousel photoUrls={['/uploads/properties/p/old.jpg', `${STORAGE}/a.jpg`]} name="Villa" />);

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('src', `${STORAGE}/a.jpg`);
    expect(screen.queryByRole('button', { name: 'Foto successiva' })).not.toBeInTheDocument();
  });

  it('onlyLegacyUrls_showsNoPhotoPlaceholder', () => {
    render(<PropertyPhotoCarousel photoUrls={['/uploads/properties/p/old.jpg']} name="Villa" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('imageLoadError_showsUnavailableMessage', () => {
    render(<PropertyPhotoCarousel photoUrls={[`${STORAGE}/gone.jpg`, `${STORAGE}/b.jpg`]} name="Villa" />);

    fireEvent.error(screen.getByRole('img', { name: 'Villa - foto 1' }));

    expect(screen.getByText('Foto non disponibile')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Foto successiva' }));
    expect(screen.getByRole('img', { name: 'Villa - foto 2' })).toHaveAttribute('src', `${STORAGE}/b.jpg`);
  });
});
