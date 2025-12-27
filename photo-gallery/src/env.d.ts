interface ImportMetaEnv {
  readonly NG_APP_SITE_NAME: string;
  readonly NG_APP_COPYRIGHT_YEAR: string;
  readonly NG_APP_COPYRIGHT_HOLDER: string;
  readonly NG_APP_INSTAGRAM_URL: string;
  readonly NG_APP_CONTACT_EMAIL: string;
  readonly NG_APP_SHOW_LOCATION_LINK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
