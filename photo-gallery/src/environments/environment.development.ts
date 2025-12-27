export const environment = {
  apiUrl: '',  // Uses proxy in development
  siteName: import.meta.env.NG_APP_SITE_NAME || 'Photography',
  purchasesEnabled: false,
  showLocationLink: import.meta.env.NG_APP_SHOW_LOCATION_LINK !== 'false',
  nav: {
    featured: 'Featured',
    gallery: 'Gallery'
  },
  footer: {
    copyright: {
      year: parseInt(import.meta.env.NG_APP_COPYRIGHT_YEAR || '2024', 10),
      holder: import.meta.env.NG_APP_COPYRIGHT_HOLDER || 'Your Name'
    },
    links: [
      { label: 'Instagram', url: import.meta.env.NG_APP_INSTAGRAM_URL || '', external: true },
      { label: 'Contact', url: `mailto:${import.meta.env.NG_APP_CONTACT_EMAIL || ''}`, external: true },
      { label: 'Privacy', url: '/privacy', external: false }
    ]
  }
};
