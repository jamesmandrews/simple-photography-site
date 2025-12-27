import { Routes } from '@angular/router';
import { FeaturedComponent } from './pages/featured/featured.component';
import { GalleryComponent } from './pages/gallery/gallery.component';
import { PrivacyComponent } from './pages/privacy/privacy.component';

export const routes: Routes = [
  { path: '', component: FeaturedComponent },
  { path: 'gallery', component: GalleryComponent },
  { path: 'privacy', component: PrivacyComponent },
  { path: '**', redirectTo: '' }
];
