/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NANOBANANA_API_KEY?: string;
  readonly VITE_VERTEX_PROJECT_ID?: string;
  readonly VITE_VERTEX_LOCATION?: string;
  readonly VITE_VERTEX_ACCESS_TOKEN?: string;
  readonly VITE_VERTEX_API_KEY?: string;
  readonly VITE_VERTEX_TEXT_MODEL?: string;
  readonly VITE_VERTEX_EDIT_MODEL?: string;
  /** Google AI Studio key; same product as gemini.google.com image generation */
  readonly VITE_GEMINI_API_KEY?: string;
  /** e.g. gemini-3.1-flash-image-preview (default), gemini-3-pro-image-preview, gemini-2.5-flash-image */
  readonly VITE_GEMINI_IMAGE_MODEL?: string;
  /** Override API host (default: prod uses googleapis; dev uses Vite proxy path) */
  readonly VITE_GEMINI_API_BASE?: string;
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
