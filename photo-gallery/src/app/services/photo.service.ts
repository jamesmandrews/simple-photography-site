import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Photo } from '../models/photo';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  private readonly FEATURED_COLLECTION = 'Featured';

  /**
   * Get featured photos from API (photos in "Featured" collection)
   */
  getFeaturedPhotos(): Observable<Photo[]> {
    return this.http.get<Photo[]>(`${this.apiUrl}/photos`).pipe(
      map(photos => photos.filter(p => p.collectionName === this.FEATURED_COLLECTION))
    );
  }

  /**
   * Get gallery photos from API (excludes "Featured" collection)
   */
  getGalleryPhotos(): Observable<Photo[]> {
    return this.http.get<Photo[]>(`${this.apiUrl}/photos`).pipe(
      map(photos => photos.filter(p => p.collectionName !== this.FEATURED_COLLECTION))
    );
  }

  /**
   * Get collection names from photos (excludes "Featured")
   */
  getCollections(photos: Photo[]): string[] {
    const collections = new Set<string>();
    photos.forEach(photo => {
      if (photo.collectionName && photo.collectionName !== this.FEATURED_COLLECTION) {
        collections.add(photo.collectionName);
      }
    });
    return ['All', ...Array.from(collections).sort()];
  }

  filterByCollection(photos: Photo[], collection: string): Photo[] {
    if (collection === 'All') {
      return photos;
    }
    return photos.filter(photo => photo.collectionName === collection);
  }
}
