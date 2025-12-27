import { Component, OnInit, OnDestroy, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { PhotoService } from '../../services/photo.service';
import { Photo } from '../../models/photo';
import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { PhotoModalComponent } from '../../components/photo-modal/photo-modal.component';
import { environment } from '../../../environments/environment';

interface PhotoWithIndex extends Photo {
  originalIndex: number;
  calculatedWidth: number;
}

interface PhotoRow {
  photos: PhotoWithIndex[];
  totalWidth: number;
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, HeaderComponent, FooterComponent, PhotoModalComponent],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.css'
})
export class GalleryComponent implements OnInit, OnDestroy {
  photos: Photo[] = [];
  collections: string[] = [];
  activeCollection = 'All';
  rows: PhotoRow[] = [];
  loading = true;
  apiUrl = environment.apiUrl;

  // Modal - now tracks filtered list
  modalOpen = false;
  modalPhoto: Photo | null = null;
  private filteredPhotos: Photo[] = [];
  private modalFilteredIndex: number | null = null;

  private readonly gap = 3;
  private rowHeight = 0;
  private subscription: Subscription | null = null;
  private readonly isBrowser: boolean;

  // Default dimensions for SSR (will be recalculated on client)
  private readonly DEFAULT_WIDTH = 1200;
  private readonly DEFAULT_HEIGHT = 800;

  constructor(
    private photoService: PhotoService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  private getViewportWidth(): number {
    return this.isBrowser ? window.innerWidth : this.DEFAULT_WIDTH;
  }

  private getViewportHeight(): number {
    return this.isBrowser ? window.innerHeight : this.DEFAULT_HEIGHT;
  }

  ngOnInit(): void {
    this.loadPhotos();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private loadPhotos(): void {
    this.loading = true;
    this.subscription = this.photoService.getGalleryPhotos().subscribe({
      next: (photos) => {
        this.photos = photos;
        this.collections = this.photoService.getCollections(photos);
        this.buildRows();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load photos:', err);
        this.loading = false;
      }
    });
  }

  setCollection(collection: string): void {
    if (this.activeCollection === collection) return;
    this.activeCollection = collection;
    this.buildRows();
  }

  private getFilteredPhotos(): PhotoWithIndex[] {
    let filtered = this.photoService.filterByCollection(this.photos, this.activeCollection);
    return filtered.map((photo, index) => ({
      ...photo,
      originalIndex: this.photos.indexOf(photo),
      calculatedWidth: this.calculateWidth(photo)
    }));
  }

  private calculateWidth(photo: Photo): number {
    // Guard against zero/undefined dimensions (API defaults to 0 before processing)
    const height = photo.height || 1;
    const width = photo.width || 1;
    const aspectRatio = width / height;
    return this.rowHeight * aspectRatio;
  }

  private buildRows(): void {
    this.rowHeight = this.getViewportHeight() * 0.3;
    const viewportWidth = this.getViewportWidth();
    const filteredPhotos = this.getFilteredPhotos();
    const rows: PhotoRow[] = [];
    let currentRow: PhotoWithIndex[] = [];
    let currentRowWidth = 0;

    filteredPhotos.forEach(photo => {
      const photoWidth = photo.calculatedWidth;

      if (currentRowWidth + photoWidth + (currentRow.length > 0 ? this.gap : 0) > viewportWidth && currentRow.length > 0) {
        rows.push({ photos: currentRow, totalWidth: currentRowWidth });
        currentRow = [];
        currentRowWidth = 0;
      }

      currentRow.push(photo);
      currentRowWidth += photoWidth + (currentRow.length > 1 ? this.gap : 0);
    });

    if (currentRow.length > 0) {
      rows.push({ photos: currentRow, totalWidth: currentRowWidth });
    }

    this.rows = rows;
  }

  getScaledDimensions(photo: PhotoWithIndex, rowIndex: number): { width: number; height: number } {
    const row = this.rows[rowIndex];
    const viewportWidth = this.getViewportWidth();
    const totalGapWidth = (row.photos.length - 1) * this.gap;
    const availableWidth = viewportWidth - totalGapWidth;
    const photosWidth = row.totalWidth - totalGapWidth;
    const scale = availableWidth / photosWidth;

    const isLastRow = rowIndex === this.rows.length - 1;
    const finalScale = (isLastRow && scale > 1) ? 1 : scale;

    return {
      width: photo.calculatedWidth * finalScale,
      height: this.rowHeight * finalScale
    };
  }

  // Modal methods - now scoped to filtered photos
  openModal(originalIndex: number): void {
    // Build filtered list for modal navigation
    this.filteredPhotos = this.photoService.filterByCollection(this.photos, this.activeCollection);

    const photo = this.photos[originalIndex];
    this.modalFilteredIndex = this.filteredPhotos.indexOf(photo);
    this.modalPhoto = photo;
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
    this.modalPhoto = null;
    this.modalFilteredIndex = null;
    this.filteredPhotos = [];
  }

  prevModalPhoto(): void {
    if (this.modalFilteredIndex === null || this.filteredPhotos.length === 0) return;
    const newIndex = this.modalFilteredIndex === 0 ? this.filteredPhotos.length - 1 : this.modalFilteredIndex - 1;
    this.modalFilteredIndex = newIndex;
    this.modalPhoto = this.filteredPhotos[newIndex];
  }

  nextModalPhoto(): void {
    if (this.modalFilteredIndex === null || this.filteredPhotos.length === 0) return;
    const newIndex = this.modalFilteredIndex === this.filteredPhotos.length - 1 ? 0 : this.modalFilteredIndex + 1;
    this.modalFilteredIndex = newIndex;
    this.modalPhoto = this.filteredPhotos[newIndex];
  }

  @HostListener('window:resize')
  onResize(): void {
    this.buildRows();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.modalOpen) return;

    if (event.key === 'Escape') this.closeModal();
    if (event.key === 'ArrowLeft') this.prevModalPhoto();
    if (event.key === 'ArrowRight') this.nextModalPhoto();
  }
}
