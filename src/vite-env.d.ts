/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE: string;
  readonly VITE_API_URL: string;
  readonly VITE_ENABLE_COLLAB: string;
  readonly VITE_PREVIEW_VIDEO_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
