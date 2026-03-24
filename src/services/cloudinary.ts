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
