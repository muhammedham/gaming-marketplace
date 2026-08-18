/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_LISTINGS_SOURCE?: "mock" | "api";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
