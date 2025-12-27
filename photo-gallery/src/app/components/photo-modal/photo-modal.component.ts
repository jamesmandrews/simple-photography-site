import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Photo } from '../../models/photo';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-photo-modal',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe],
  templateUrl: './photo-modal.component.html',
  styleUrl: './photo-modal.component.css'
})
export class PhotoModalComponent {
  @Input() photo: Photo | null = null;
  @Input() isOpen = false;
  @Input() apiUrl = '';
  @Output() close = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  // Fields to display in main section (full width)
  readonly mainFields = ['date', 'camera', 'lens'];

  // Fields to display in grid (2 columns)
  readonly gridFields = ['exposure', 'aperture', 'iso', 'focalLength'];

  // Human-readable labels
  readonly fieldLabels: Record<string, string> = {
    date: 'Date',
    camera: 'Camera',
    lens: 'Lens',
    exposure: 'Exposure',
    aperture: 'Aperture',
    iso: 'ISO',
    focalLength: 'Focal Length'
  };

  onClose(): void {
    this.close.emit();
  }

  onPrevious(): void {
    this.previous.emit();
  }

  onNext(): void {
    this.next.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal')) {
      this.onClose();
    }
  }

  getImageUrl(): string {
    if (!this.photo) return '';
    // For mock data (Featured), images might be full URLs
    const displayUrl = this.photo.images.display;
    if (displayUrl.startsWith('http')) {
      return displayUrl;
    }
    return this.apiUrl + displayUrl;
  }

  getTitle(): string {
    if (!this.photo) return '';
    // Try photo.title first, then fall back to meta.title
    return this.photo.title || this.photo.meta['title'] || '';
  }

  getDescription(): string {
    if (!this.photo) return '';
    // Try photo.description first, then fall back to meta.description
    return this.photo.description || this.photo.meta['description'] || '';
  }

  getFieldValue(key: string): string {
    if (!this.photo) return '';
    const value = this.photo.meta[key];
    if (!value) return '';

    if (key === 'date') {
      // Parse date parts directly to avoid timezone conversion issues
      // Input format: 'YYYY-MM-DD'
      const [year, month, day] = value.split('-').map(Number);
      if (year && month && day) {
        const date = new Date(year, month - 1, day); // month is 0-indexed
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    }

    return value;
  }

  hasLocation(): boolean {
    if (!environment.showLocationLink) return false;
    if (!this.photo) return false;
    return !!(this.photo.meta['location_name'] || this.photo.meta['location_lat']);
  }

  getLocationName(): string {
    if (!this.photo) return '';
    return this.photo.meta['location_name'] || '';
  }

  getMapUrl(): string {
    if (!this.photo) return '#';
    const lat = this.photo.meta['location_lat'];
    const lng = this.photo.meta['location_lng'];
    if (lat && lng) {
      return `https://www.google.com/maps?q=${lat},${lng}`;
    }
    return '#';
  }

  canPurchase(): boolean {
    if (!environment.purchasesEnabled) return false;
    if (!this.photo) return false;
    return this.photo.forSale !== false;
  }
}
