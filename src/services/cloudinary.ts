import axios from 'axios';

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim() &&
      (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim()
  );
}

function requireConfig(): { cloud: string; preset: string } {
  const cloud = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
  const preset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim();
  if (!cloud || !preset) {
    throw new Error(
      'Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env.local'
    );
  }
  return { cloud, preset };
}

/** Browser file pick → unsigned upload → `secure_url` (HTTPS). */
export async function uploadImageFile(file: File): Promise<string> {
  const { cloud, preset } = requireConfig();
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', preset);
  const res = await axios.post<{ secure_url?: string }>(
    `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
    form
  );
  const url = res.data?.secure_url;
  if (!url) throw new Error('Cloudinary upload did not return secure_url');
  return url;
}

/** Used when config still holds a data URL (e.g. legacy or fallback). */
export async function uploadImageDataUrl(dataUrl: string): Promise<string> {
  const { cloud, preset } = requireConfig();
  const form = new FormData();
  form.append('file', dataUrl);
  form.append('upload_preset', preset);
  const res = await axios.post<{ secure_url?: string }>(
    `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
    form
  );
  const url = res.data?.secure_url;
  if (!url) throw new Error('Cloudinary upload did not return secure_url');
  return url;
}

export function isDataUrl(s: string): boolean {
  return /^data:image\//i.test(s.trim());
}

/** Read a `blob:` object URL into a base64 data URL (e.g. before Cloudinary upload). */
export async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl);
  if (!res.ok) throw new Error(`Failed to read generated image (${res.status})`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const out = reader.result;
      if (typeof out === 'string') resolve(out);
      else reject(new Error('FileReader did not return a data URL'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

function requireAdminConfig(): { cloud: string; apiKey: string; apiSecret: string } {
  const cloud = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (import.meta.env.VITE_CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (import.meta.env.VITE_CLOUDINARY_API_SECRET || '').trim();

  if (!cloud || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary admin credentials are not set. Provide VITE_CLOUDINARY_API_KEY and VITE_CLOUDINARY_API_SECRET in .env.local'
    );
  }

  return { cloud, apiKey, apiSecret };
}

/**
 * Cloudinary Admin API: delete uploaded images by public_id prefix.
 * Used to clear out the whole folder (for fixed folder mode), e.g. `Vehicles/`.
 *
 * Docs: DELETE https://api.cloudinary.com/v1_1/<cloud_name>/resources/image/upload
 * with body `prefix=<prefix>`
 */
export async function deleteUploadedImagesByPrefix(prefix: string): Promise<void> {
  const { cloud, apiKey, apiSecret } = requireAdminConfig();
  const withSlash = prefix.endsWith('/') ? prefix : `${prefix}/`;

  const body = new URLSearchParams({ prefix: withSlash });

  await axios.request({
    method: 'DELETE',
    url: `https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload`,
    auth: { username: apiKey, password: apiSecret },
    data: body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

/** Clears images inside the Cloudinary `Vehicles/` folder (public_id prefix). */
export async function cleanupVehiclesFolderImages(): Promise<void> {
  await deleteUploadedImagesByPrefix('Vehicles');
}
