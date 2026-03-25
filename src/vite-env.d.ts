/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STABILITY_API_KEY?: string;
  readonly VITE_NANOBANANA_API_KEY?: string;
  /** When set with VITE_CLOUDINARY_UPLOAD_PRESET, data: URLs are uploaded before NanoBanana */
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
  readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string;
  /** Cloudinary Admin API key (needed for deleting by prefix in this POC). */
  readonly VITE_CLOUDINARY_API_KEY?: string;
  /** Cloudinary Admin API secret (needed for deleting by prefix in this POC). */
  readonly VITE_CLOUDINARY_API_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
