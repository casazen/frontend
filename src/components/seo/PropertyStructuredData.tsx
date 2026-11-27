import { useEffect } from 'react';
import type { PublicPropertyDetailDto, PublicOrgDto } from '@/types';

interface PropertyStructuredDataProps {
  property: PublicPropertyDetailDto;
  org: PublicOrgDto;
}

export function PropertyStructuredData({ property, org }: PropertyStructuredDataProps) {
  useEffect(() => {
    if (!property.canonicalUrl) {
      return;
    }

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'VacationRental',
      identifier: property.id,
      containsPlace: {
        '@type': 'Accommodation',
        ...(property.maxGuests > 0 ? { occupancy: { '@type': 'QuantitativeValue', value: property.maxGuests } } : {}),
      },
      name: property.name,
      ...(property.description ? { description: property.description } : {}),
      address: {
        '@type': 'PostalAddress',
        addressLocality: property.city,
        ...(property.postalCode ? { postalCode: property.postalCode } : {}),
        addressCountry: property.cinStatus === 'Valid' && property.cinCode ? 'IT' : undefined,
      },
      ...(property.canonicalUrl ? { url: property.canonicalUrl } : {}),
      ...(property.photoUrls && property.photoUrls.length > 0 ? { image: property.photoUrls } : {}),
      ...(property.amenities && property.amenities.length > 0
        ? {
            amenityFeature: property.amenities.map((amenity) => ({
              '@type': 'LocationFeatureSpecification',
              name: amenity,
            })),
          }
        : {}),
      ...(property.bedrooms > 0 ? { numberOfRooms: property.bedrooms } : {}),
      ...(property.maxGuests > 0
        ? {
            occupancy: {
              '@type': 'QuantitativeValue',
              maxValue: property.maxGuests,
            },
          }
        : {}),
      ...(property.nightlyRate > 0
        ? {
            priceRange: `${property.currency} ${property.nightlyRate}`,
          }
        : {}),
      ...(property.latitude && property.longitude && property.latitude !== 0 && property.longitude !== 0
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: property.latitude,
              longitude: property.longitude,
            },
          }
        : {}),
      ...(property.ratingSummary
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: property.ratingSummary.average,
              reviewCount: property.ratingSummary.count,
            },
          }
        : {}),
      ...(org.displayName
        ? {
            provider: {
              '@type': 'Organization',
              name: org.displayName,
            },
          }
        : {}),
    };

    const jsonForScript = JSON.stringify(structuredData).replace(/</g, '\\u003c');

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = jsonForScript;
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [property, org]);

  return null;
}
