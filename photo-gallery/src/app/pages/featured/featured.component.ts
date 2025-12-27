import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PhotoService } from '../../services/photo.service';
import { Photo } from '../../models/photo';
import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { PhotoModalComponent } from '../../components/photo-modal/photo-modal.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-featured',
  standalone: true,
  imports: [CommonModule, HeaderComponent, FooterComponent, PhotoModalComponent],
  templateUrl: './featured.component.html',
  styleUrl: './featured.component.css'
})
export class FeaturedComponent implements OnInit, OnDestroy {
  @ViewChild('photoStrip') photoStrip!: ElementRef;

  photos: Photo[] = [];
  currentIndex = 0;
  displayOrder: number[] = [];
  calculatedWidths: number[] = [];
  isLoaded = false;
  loading = true;
  apiUrl = environment.apiUrl;

  // Modal
  modalOpen = false;
  modalPhoto: Photo | null = null;
  modalPhotoIndex: number | null = null;

  // Autoslide
  private readonly AUTOSLIDE_DELAY = 5000;
  private autoslideInterval: ReturnType<typeof setInterval> | null = null;
  isPlaying = false;

  private readonly gap = 3;
  private imageHeight = 0;
  private subscription: Subscription | null = null;

  constructor(private photoService: PhotoService) {}

  ngOnInit(): void {
    this.loadPhotos();
  }

  ngOnDestroy(): void {
    this.stopAutoslide();
    this.subscription?.unsubscribe();
  }

  private loadPhotos(): void {
    this.loading = true;
    this.subscription = this.photoService.getFeaturedPhotos().subscribe({
      next: (photos) => {
        this.photos = photos;
        this.displayOrder = this.photos.map((_, i) => i);
        this.calculateDimensions();
        this.loading = false;
        if (this.photos.length > 0) {
          this.startAutoslide();
        }
      },
      error: (err) => {
        console.error('Failed to load featured photos:', err);
        this.loading = false;
      }
    });
  }

  private calculateDimensions(): void {
    this.imageHeight = window.innerHeight * 0.6;
    this.calculatedWidths = this.photos.map(photo => {
      const aspectRatio = photo.width / photo.height;
      return this.imageHeight * aspectRatio;
    });
  }

  getImageWidth(index: number): number {
    return this.calculatedWidths[index] || 0;
  }

  getImageHeight(): number {
    return this.imageHeight;
  }

  getTransform(): string {
    const offset = this.calculateOffset(this.currentIndex);
    return `translateX(${offset}px)`;
  }

  private calculateOffset(displayIndex: number): number {
    let offset = 0;
    for (let i = 0; i < displayIndex; i++) {
      const originalIndex = this.displayOrder[i];
      offset += this.calculatedWidths[originalIndex] + this.gap;
    }
    const currentOriginalIndex = this.displayOrder[displayIndex];
    offset += this.calculatedWidths[currentOriginalIndex] / 2;
    return -offset;
  }

  isActive(index: number): boolean {
    return index === this.currentIndex;
  }

  onImageLoad(): void {
    this.isLoaded = true;
  }

  goToIndex(displayIndex: number): void {
    this.currentIndex = displayIndex;
  }

  goNext(): void {
    if (this.currentIndex < this.displayOrder.length - 1) {
      this.currentIndex++;
    }
    this.stopAutoslide();
  }

  goPrev(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    }
    this.stopAutoslide();
  }

  onPhotoClick(displayIndex: number): void {
    if (displayIndex === this.currentIndex) {
      this.openModal(this.displayOrder[displayIndex]);
    } else {
      this.goToIndex(displayIndex);
    }
  }

  onIndicatorClick(originalIndex: number): void {
    const displayIndex = this.displayOrder.indexOf(originalIndex);
    if (displayIndex !== -1) {
      this.goToIndex(displayIndex);
    }
  }

  // Modal methods
  openModal(originalIndex: number): void {
    this.modalPhotoIndex = originalIndex;
    this.modalPhoto = this.photos[originalIndex];
    this.modalOpen = true;
    this.stopAutoslide();
  }

  closeModal(): void {
    this.modalOpen = false;
    this.modalPhoto = null;
    this.modalPhotoIndex = null;
  }

  prevModalPhoto(): void {
    if (this.modalPhotoIndex === null) return;
    const newIndex = this.modalPhotoIndex === 0 ? this.photos.length - 1 : this.modalPhotoIndex - 1;
    this.modalPhotoIndex = newIndex;
    this.modalPhoto = this.photos[newIndex];
  }

  nextModalPhoto(): void {
    if (this.modalPhotoIndex === null) return;
    const newIndex = this.modalPhotoIndex === this.photos.length - 1 ? 0 : this.modalPhotoIndex + 1;
    this.modalPhotoIndex = newIndex;
    this.modalPhoto = this.photos[newIndex];
  }

  // Autoslide methods
  startAutoslide(): void {
    if (this.autoslideInterval) return;

    const currentOriginalIndex = this.displayOrder[this.currentIndex];
    if (currentOriginalIndex === this.photos.length - 1) {
      this.isPlaying = false;
      return;
    }

    this.autoslideInterval = setInterval(() => {
      const currentOriginalIndex = this.displayOrder[this.currentIndex];
      if (currentOriginalIndex === this.photos.length - 1) {
        this.stopAutoslide();
        return;
      }
      this.currentIndex++;
    }, this.AUTOSLIDE_DELAY);

    this.isPlaying = true;
  }

  stopAutoslide(): void {
    if (this.autoslideInterval) {
      clearInterval(this.autoslideInterval);
      this.autoslideInterval = null;
    }
    this.isPlaying = false;
  }

  togglePlayback(): void {
    if (this.isPlaying) {
      this.stopAutoslide();
    } else {
      this.startAutoslide();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.calculateDimensions();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (this.modalOpen) {
      if (event.key === 'Escape') this.closeModal();
      if (event.key === 'ArrowLeft') this.prevModalPhoto();
      if (event.key === 'ArrowRight') this.nextModalPhoto();
      return;
    }

    if (event.key === 'ArrowLeft') this.goPrev();
    if (event.key === 'ArrowRight') this.goNext();
  }
}
