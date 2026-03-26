import axios from 'axios';

import type { ApiProvider } from '../types';

const NANO_BANANA_CREDITS_URL =
  'https://api.nanobananaapi.ai/api/v1/common/credit';

function resolveApiKey(provider: ApiProvider): string {
  if (provider === 'nanobanana') {
    const local = localStorage.getItem('NANOBANANA_API_KEY')?.trim() || '';
    if (local) return local;
    return (import.meta.env.VITE_NANOBANANA_API_KEY || '').trim();
  }

  return '';
}

/**
 * Fetch remaining NanoBanana credits.
 * Returns `null` when the API key isn't available.
 */
export async function fetchNanoBananaCredits(
  provider: ApiProvider
): Promise<number | null> {
  if (provider !== 'nanobanana') return null;

  const token = resolveApiKey(provider);
  if (!token) return null;

  const res = await axios.get(NANO_BANANA_CREDITS_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const code = res.data?.code;
  // Docs: data is integer, msg is string, code is numeric.
  if (code === 200) return res.data?.data ?? null;

  // If NanoBanana returns non-200 code, surface it as an error to caller.
  const msg = res.data?.msg ? String(res.data.msg) : 'Failed to fetch credits';
  throw new Error(msg);
}

