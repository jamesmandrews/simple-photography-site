import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cookie-consent.component.html',
  styleUrl: './cookie-consent.component.css'
})
export class CookieConsentComponent implements OnInit {
  showBanner = false;

  private readonly COOKIE_KEY = 'cookie_consent';
  private readonly isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.showBanner = !this.hasConsent();
    if (this.showBanner) {
      this.setBodyOverflow('hidden');
    }
  }

  accept(): void {
    this.setStorageItem(this.COOKIE_KEY, 'accepted');
    this.showBanner = false;
    this.setBodyOverflow('');
  }

  private hasConsent(): boolean {
    return this.getStorageItem(this.COOKIE_KEY) === 'accepted';
  }

  private setBodyOverflow(value: string): void {
    if (this.isBrowser) {
      this.document.body.style.overflow = value;
    }
  }

  private getStorageItem(key: string): string | null {
    if (!this.isBrowser) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      // Safari privacy mode or storage disabled
      return null;
    }
  }

  private setStorageItem(key: string, value: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Safari privacy mode or storage disabled - fail silently
    }
  }
}
