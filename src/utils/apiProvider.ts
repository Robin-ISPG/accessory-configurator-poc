import type { ApiProvider } from '../types';

const LABELS: Record<ApiProvider, string> = {
  nanobanana: 'NanoBanana API',
  gemini: 'Gemini API (native image)',
  vertex: 'Vertex AI (Imagen)',
};

export function apiProviderLabel(providerKey: string | null | undefined): string {
  if (providerKey === 'vertex') return LABELS.vertex;
  if (providerKey === 'gemini') return LABELS.gemini;
  return LABELS.nanobanana;
}
