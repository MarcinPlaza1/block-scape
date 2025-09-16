export interface SkinRecord {
  id: string;
  name: string;
  data: string;
  thumbnail: string | null;
  published: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkinListingRecord {
  id: string;
  skinId: string;
  price: number;
  currency: string;
  active: boolean;
  buyerId: string | null;
  soldAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkinWithListings extends SkinRecord {
  listings: SkinListingRecord[];
}

export interface SkinListingWithSkin extends SkinListingRecord {
  skin: SkinRecord;
}

export type SkinVisibilityFilter = 'all' | 'draft' | 'published';

export const formatPrice = (price: number, currency = 'PLN'): string => {
  const major = price / 100;
  try {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
};
