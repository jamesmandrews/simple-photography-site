export interface PhotoLocation {
  lat: number;
  lng: number;
  name: string;
}

export interface PhotoImages {
  display: string;
  featured: string;
  thumb: string;
}

export interface Photo {
  id: string;
  images: PhotoImages;
  alt: string;
  width: number;
  height: number;
  title?: string;
  description?: string;
  collectionId?: string;
  collectionName?: string;
  featured?: boolean;
  meta: Record<string, string>;
  forSale?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
