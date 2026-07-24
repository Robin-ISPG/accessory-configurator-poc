import axios from 'axios';
import type { ApiProvider, VehicleConfigureMode, Configuration, Accessory, Vehicle } from '../types';
import { apiProviderLabel } from '../utils/apiProvider';
import {
  isCloudinaryConfigured,
  isDataUrl,
  uploadImageDataUrl,
} from './cloudinary';

export interface GenerateImageParams {
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  /** Trim / variant label (catalog or user-selected in image flow) */
  vehicleVariant?: string;
  accessories: string[];
  customPrompt?: string;
  categoryReferenceImages?: Record<string, string>;
  /** Locked base vehicle photo (e.g. data URL) for image-to-image composition */
  baseVehicleImageUrl?: string | null;
  /** Accessory reference images in the same order as `accessories` */
  accessoryImageUrlsOrdered?: string[];
  /** Same length as `accessories` — drives interior vs exterior prompt behavior */
  accessoryCategoriesOrdered?: Accessory['category'][];
  vehicleConfigureMode?: VehicleConfigureMode;
  /**
   * "Generate angles" in the UI: same vehicle/accessories, new camera only.
   * Avoids conflicting with the default prompt that says to keep the base photo’s perspective.
   */
  reframeOnly?: boolean;
}

export interface GenerateImageResult {
  imageUrl: string;
  prompt: string;
  apiCallDetails: {
    providerName: string;
    modelName: string;
    endpoint: string;
    method: string;
    prompt: string;
    outputFormat: string;
    authType: string;
    timestamp: string;
  };
}

function collectReferenceUrls(params: GenerateImageParams): string[] {
  const out: string[] = [];
  const base = params.baseVehicleImageUrl?.trim();
  if (base) out.push(base);
  (params.accessoryImageUrlsOrdered || []).forEach((u) => {
    if (typeof u === 'string' && u.length > 0) out.push(u);
  });
  for (const v of Object.values(params.categoryReferenceImages || {})) {
    if (typeof v === 'string' && v.length > 0) out.push(v);
  }
  return out;
}

/**
 * For NanoBanana: keep https URLs as-is (e.g. Cloudinary URLs from the UI).
 * If any data: URLs remain and Cloudinary is configured, upload them before the API call.
 */
async function resolveReferenceUrlsForNanobanana(urls: string[]): Promise<string[]> {
  return Promise.all(
    urls.map(async (u) => {
      const trimmed = u.trim();
      if (!trimmed) return trimmed;

      const maybeConverted = maybeConvertCloudinaryImageUrlForNanobanana(trimmed);
      if (!isDataUrl(trimmed)) return maybeConverted;

      if (!isCloudinaryConfigured()) return trimmed;
      const uploaded = await uploadImageDataUrl(trimmed);
      return maybeConvertCloudinaryImageUrlForNanobanana(uploaded);
    })
  );
}

/** Year + make + model, plus optional variant when provided */
function vehicleMeta(params: GenerateImageParams): string {
  const base = `${params.vehicleYear} ${params.vehicleMake} ${params.vehicleModel}`;
  const v = params.vehicleVariant?.trim();
  return v ? `${base} ${v}` : base;
}

function accessoryCategoriesAligned(params: GenerateImageParams): Accessory['category'][] {
  const n = params.accessories.length;
  const c = params.accessoryCategoriesOrdered;
  if (!c || c.length !== n) {
    return Array.from({ length: n }, () => 'exterior' as Accessory['category']);
  }
  return c;
}

function hasInteriorAccessories(params: GenerateImageParams): boolean {
  return accessoryCategoriesAligned(params).some((cat) => cat === 'interior');
}

/** Image-to-image prompt when selection includes interior accessories — cabin viewpoint + tight ref fidelity */
function buildInteriorBaseCompositePrompt(params: GenerateImageParams, meta: string): string {
  const cats = accessoryCategoriesAligned(params);
  const ordered = params.accessoryImageUrlsOrdered || [];
  const interiorNames = params.accessories
    .filter((_, i) => cats[i] === 'interior')
    .join(', ');
  const nonInteriorNames = params.accessories
    .filter((_, i) => cats[i] !== 'interior')
    .join(', ');

  let refImageNum = 2;
  let accDetail = '';
  params.accessories.forEach((name, i) => {
    const ref = ordered[i];
    const isInterior = cats[i] === 'interior';
    if (ref) {
      if (isInterior) {
        accDetail +=
          `Reference image ${refImageNum} is the product photo for interior accessory "${name}" — show it prominently in frame; reproduce exact appearance from that reference (colors, textures, stitching, logos, proportions, silhouette). That reference is authoritative — do not substitute a generic item. `;
      } else {
        accDetail +=
          `Reference image ${refImageNum} is for "${name}" — integrate only if logically visible from this interior viewpoint (e.g. through windows); otherwise omit. Match materials when shown. `;
      }
      refImageNum += 1;
    } else if (isInterior) {
      accDetail += `Interior accessory "${name}": integrate realistically on appropriate cabin surfaces at believable scale for ${meta}. `;
    } else {
      accDetail += `Accessory "${name}": include only if visible from this cabin viewpoint. `;
    }
  });

  const custom = params.customPrompt?.trim()
    ? ` (((${params.customPrompt.trim()}))). `
    : ' ';

  const otherClause =
    nonInteriorNames.length > 0
      ? ` Non-interior accessories also listed (${nonInteriorNames}) — include only if naturally visible from this cabin shot (e.g. through glass); do not force an exterior composite. `
      : '';

  return (
    `Photorealistic INTERIOR photograph of ONE vehicle cabin. CRITICAL: Reference image 1 is the locked base vehicle photograph — use it for vehicle identity (${meta}). If reference 1 shows only the exterior, synthesize a plausible interior consistent with that exact vehicle (door shapes, seating layout, trim tier). Camera MUST be inside the cabin; foreground and sharp focus on these interior accessories: ${interiorNames}.${otherClause} ` +
    (params.accessories.length > 0 ? accDetail : '') +
    `${custom}` +
    `Natural cabin lighting; realistic materials, grain, and contact shadows; single full-frame output. Vehicle metadata (context only): ${meta}.`
  );
}

function maybeConvertCloudinaryImageUrlForNanobanana(url: string): string {
  try {
    if (!/res\.cloudinary\.com/i.test(url)) return url;

    const extMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
    const ext = (extMatch?.[1] || '').toLowerCase();
    if (ext !== 'avif' && ext !== 'webp') return url;

    const parsed = new URL(url);
    const parts = parsed.pathname.split('/');
    const uploadIndex = parts.findIndex((p) => p === 'upload');
    if (uploadIndex === -1) return url;

    if (parts[uploadIndex + 1] !== 'f_jpg') {
      parts.splice(uploadIndex + 1, 0, 'f_jpg');
    }

    const lastIdx = parts.length - 1;
    const last = parts[lastIdx] || '';
    const convertedLast = last.replace(/\.(avif|webp)$/i, '.jpg');
    parts[lastIdx] = convertedLast;

    parsed.pathname = parts.join('/');
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Vertex Imagen inpaint: Google recommends describing what goes *in the masked region*
 * (short, concrete). NanoBanana uses a different contract (multi reference URLs).
 */
function buildVertexInpaintPrompt(params: GenerateImageParams): string {
  const meta = vehicleMeta(params);
  const acc = params.accessories.length > 0 ? params.accessories.join(', ') : 'the requested accessory';
  const custom = params.customPrompt?.trim();
  const customLine = custom ? `Additional detail: ${custom}. ` : '';

  if (hasInteriorAccessories(params)) {
    return (
      `In the masked region only: add ${acc} — photorealistic interior parts for a ${meta}, ` +
      `correct scale and perspective on dash, seats, consoles, pillars, floor, or headliner as appropriate; ` +
      `match attached product references exactly where provided (colors, texture, seams). ` +
      `${customLine}` +
      `Outside the mask: preserve cabin surfaces unchanged — upholstery grain, stitching, plastics, glass, and lighting continuity. ` +
      `Leave all pixels outside the mask unchanged.`
    );
  }

  return (
    `In the masked region only: add ${acc} — photorealistic, correct scale and perspective for a ${meta}, ` +
    `physically attached to the front bumper and lower grille area, tubular or plate steel matching OEM black trim, ` +
    `clean mounting, subtle contact shadows, no cartoon look. ` +
    `${customLine}` +
    `Outside the mask: preserve the vehicle unchanged — especially wheels and tires (perfect circles, crisp rims, realistic rubber tread), body panels, glass, and background. ` +
    `Leave all pixels outside the mask unchanged.`
  );
}

/** Prompt for +Front / +Side / +Rear / +Top — must NOT ask to preserve the base image’s camera angle. */
function buildCameraAnglePrompt(params: GenerateImageParams): string {
  const meta = vehicleMeta(params);
  const angle =
    params.customPrompt?.trim() ||
    (hasInteriorAccessories(params)
      ? 'Wide-angle interior from slightly behind front seats: full dash, steering wheel, both front seats and center console in frame; daylight through windshield; hero focus on installed interior accessories.'
      : 'Catalog-style automotive angle.');

  if (hasInteriorAccessories(params)) {
    return (
      `CAMERA REFRAME — INTERIOR VIEW, same vehicle, NEW viewpoint only.\n\n` +
      `Reference image 1 establishes identity for ${meta}. If it shows only the exterior, infer a plausible cabin consistent with that vehicle and trim.\n\n` +
      `OUTPUT must be a brand-new photograph taken FROM INSIDE the passenger cabin at the viewpoint below. IGNORE exterior-only framing — do not merely crop the original exterior shot.\n\n` +
      `VIEWPOINT (follow literally):\n${angle}\n\n` +
      `Single full-frame photorealistic interior result. No collage, no watermark text.`
    );
  }

  return (
    `CAMERA REFRAME — same vehicle, NEW viewpoint only.\n\n` +
    `Reference image 1 is for identity only: exact same ${meta}, same paint, glass, wheels, tires, and any installed accessories already visible. Do not swap for a different vehicle.\n\n` +
    `OUTPUT must be a brand-new photograph from the viewpoint below. IGNORE the original photo’s camera height, horizon, lens, and framing — do not reproduce the same 3/4, side, or eye-level shot unless the viewpoint text explicitly requires it.\n\n` +
    `VIEWPOINT (follow literally):\n${angle}\n\n` +
    `Single full-frame photorealistic result. No collage, no watermark text.`
  );
}

function buildPrompt(params: GenerateImageParams): string {
  const base = params.baseVehicleImageUrl?.trim();
  const meta = vehicleMeta(params);

  if (base && params.reframeOnly) {
    return buildCameraAnglePrompt(params);
  }

  if (base) {
    if (hasInteriorAccessories(params)) {
      return buildInteriorBaseCompositePrompt(params, meta);
    }

    const ordered = params.accessoryImageUrlsOrdered || [];
    let accDetail = '';
    let refImageNum = 2;
    params.accessories.forEach((name, i) => {
      const ref = ordered[i];
      if (ref) {
        accDetail += `Reference image ${refImageNum} is the product photo for "${name}" — keep its silhouette, materials, and aspect ratio; do not stretch or squash. `;
        refImageNum += 1;
      } else {
        accDetail += `Accessory "${name}" should be added to match the vehicle; use realistic scale and perspective. `;
      }
    });

    const custom = params.customPrompt?.trim()
      ? ` (((${params.customPrompt.trim()}))). `
      : ' ';

    return (
      `Photorealistic composite of ONE vehicle. CRITICAL: Reference image 1 is the locked base vehicle photograph — preserve the exact vehicle identity, body shape, paint, glass, wheels, stance, shadows, background, and output aspect ratio; do not swap the vehicle for a different model or re-draw the whole car from imagination. ` +
      (params.accessories.length > 0
        ? `Add or enhance these accessories on that same photo: ${params.accessories.join(', ')}. ${accDetail}`
        : '') +
      `${custom}` +
      `Match lighting and perspective of the base image; use contact shadows and occlusion so parts feel physically attached. Single full-frame output. Vehicle metadata (for context only): ${meta}.`
    );
  }

  let accPhrase = '';
  if (params.accessories.length > 0) {
    const cats = accessoryCategoriesAligned(params);
    const accList = params.accessories.join(' and ');
    if (cats.some((c) => c === 'interior')) {
      const intOnly = params.accessories
        .filter((_, i) => cats[i] === 'interior')
        .join(' and ');
      accPhrase = `Interior cabin shot featuring highly detailed, perfectly fitted ((${intOnly})). CLEAR FOCUS on ${intOnly} — frame the cabin to showcase those parts. `;
    } else {
      accPhrase = `featuring highly detailed, perfectly fitted, factory-compatible ((${accList})). CLEAR FOCUS on the ${accList}. `;
    }
  }

  const subject = params.customPrompt
    ? `(((${params.customPrompt.trim()}))) appearance, which is a pristine ${vehicleMeta(params)}`
    : `a pristine ${vehicleMeta(params)}`;

  const backdrop =
    hasInteriorAccessories(params) && params.accessories.length > 0
      ? `Framed inside the passenger cabin with controlled studio-style light; realistic upholstery and surfaces, `
      : `completely isolated on a pure, minimalist white cyclorama studio backdrop. Zero background distractions, `;

  return `Hyper-realistic unedited automotive photography of a SINGLE vehicle, shot on medium format camera, razor-sharp focus. A flawless ${subject}. ${accPhrase}Authentic real-world lighting, physically accurate vehicle proportions, perfectly round wheels, flawless geometry, ${backdrop}absolute physical realism, exact custom appearance and colors, masterpiece. No fantasy, no CGI.`;
}

interface ImageProvider {
  generate(
    params: GenerateImageParams,
    options: { token: string; prompt: string; timestamp: string }
  ): Promise<GenerateImageResult>;
}

/** Pickable in the API panel; stored as `GEMINI_IMAGE_MODEL` in localStorage. */
export const GEMINI_SELECTABLE_IMAGE_MODELS = [
  {
    id: 'gemini-3-pro-image-preview',
    label: 'Max fidelity',
    description: 'Hardest edits; typically slowest / highest cost.',
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Balanced (default)',
    description: 'Strong composition; stronger than 2.5 Flash image.',
  },
  {
    id: 'gemini-2.5-flash-image',
    label: 'Fast & economical',
    description: 'Lower latency and cost for simpler edits.',
  },
] as const;

export type GeminiSelectableImageModelId = (typeof GEMINI_SELECTABLE_IMAGE_MODELS)[number]['id'];

const GEMINI_SELECTABLE_MODEL_ID_SET = new Set<string>(
  GEMINI_SELECTABLE_IMAGE_MODELS.map((m) => m.id)
);

export function getInitialGeminiSelectableModel(): GeminiSelectableImageModelId {
  try {
    const ls = localStorage.getItem('GEMINI_IMAGE_MODEL')?.trim();
    if (ls && GEMINI_SELECTABLE_MODEL_ID_SET.has(ls)) return ls as GeminiSelectableImageModelId;
  } catch {
    // ignore (e.g. SSR)
  }
  const env = (import.meta.env.VITE_GEMINI_IMAGE_MODEL as string | undefined)?.trim();
  if (env && GEMINI_SELECTABLE_MODEL_ID_SET.has(env)) return env as GeminiSelectableImageModelId;
  return 'gemini-3.1-flash-image-preview';
}

/**
 * Resolved on each Gemini request (not cached): panel choice in `GEMINI_IMAGE_MODEL` wins when it is
 * one of {@link GEMINI_SELECTABLE_IMAGE_MODELS}; else `VITE_GEMINI_IMAGE_MODEL`; else balanced default.
 */
export function getGeminiImageModel(): string {
  try {
    const ls = localStorage.getItem('GEMINI_IMAGE_MODEL')?.trim();
    if (ls && GEMINI_SELECTABLE_MODEL_ID_SET.has(ls)) return ls;
  } catch {
    // ignore
  }
  const env = (import.meta.env.VITE_GEMINI_IMAGE_MODEL as string | undefined)?.trim();
  if (env) return env;
  return 'gemini-3.1-flash-image-preview';
}

/**
 * Extra instructions when Gemini receives 2+ inline images (vehicle + one or more product/category refs).
 * Wording scales so N>2 accessories (each with a reference) are explicitly covered.
 */
function buildGeminiIntegrationSuffix(inlineImageCount: number, interiorFocus: boolean): string {
  if (inlineImageCount < 2) return '';
  const cabin =
    interiorFocus && inlineImageCount >= 2
      ? ' For interior accessories: place products on realistic dash, seat, floor, console, or pillar surfaces at correct interior perspective and scale (not floating cutouts). '
      : '';
  if (inlineImageCount === 2) {
    return (
      '\n\nINTEGRATION (required): Reference image 1 is the full vehicle scene — preserve vehicle identity, wheels, glass, and background. ' +
      'Reference image 2 is a product reference: integrate it as a real bolt-on part (no flat sticker). Remove, replace, or fully occlude overlapping OEM pieces where the new part replaces factory equipment; match perspective, scale, shadows, and materials.' +
      cabin +
      ' Single photorealistic full-frame output.'
    );
  }
  return (
    '\n\nINTEGRATION (required): Reference image 1 is the full vehicle scene — preserve vehicle identity, wheels, glass, and background. ' +
    `Reference images 2 through ${inlineImageCount} are additional product references in request order — align them with the accessory names and order implied in the prompt (each image after the vehicle corresponds to the next described add-on that has a reference photo). ` +
    'Integrate every referenced part convincingly on the vehicle at once; respect occlusions between multiple add-ons; no flat sticker overlays. Remove, replace, or fully occlude overlapping OEM hardware per part where needed. Match perspective, scale, shadows, and materials across all additions.' +
    cabin +
    ' Single photorealistic full-frame output.'
  );
}

function geminiGenerateContentUrl(model: string): string {
  const override = (import.meta.env.VITE_GEMINI_API_BASE as string | undefined)?.trim();
  const root = override
    ? override.replace(/\/$/, '')
    : import.meta.env.DEV
      ? '/google-gemini-api'
      : 'https://generativelanguage.googleapis.com';
  return `${root}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

/** Read image bytes from a content part (REST may use camelCase or snake_case). */
function extractGeminiInlineImage(part: unknown): { b64: string; mimeType: string } | null {
  if (!part || typeof part !== 'object') return null;
  const o = part as Record<string, unknown>;
  const inline = (o.inlineData ?? o.inline_data) as Record<string, unknown> | undefined;
  if (!inline || typeof inline.data !== 'string' || !inline.data.length) return null;
  const mime =
    (typeof inline.mimeType === 'string' && inline.mimeType) ||
    (typeof inline.mime_type === 'string' && inline.mime_type) ||
    'image/png';
  return { b64: inline.data, mimeType: mime };
}

function collectGeminiPartText(parts: unknown[] | undefined): string {
  if (!parts?.length) return '';
  const chunks: string[] = [];
  for (const p of parts) {
    if (!p || typeof p !== 'object') continue;
    const t = (p as { text?: string }).text;
    if (typeof t === 'string' && t.trim()) chunks.push(t.trim());
  }
  return chunks.join(' ').slice(0, 400);
}

function parseGeminiImageFromResponse(data: unknown): { b64: string; mimeType: string } {
  const root = data as {
    error?: { message?: string };
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: unknown[] };
    }>;
  };
  if (root.error?.message) {
    throw new Error(`Gemini API: ${root.error.message}`);
  }
  if (root.promptFeedback?.blockReason) {
    throw new Error(`Gemini API: blocked (${root.promptFeedback.blockReason})`);
  }
  const candidates = root.candidates;
  if (!candidates?.length) {
    throw new Error('Gemini API: no candidates in response. ' + JSON.stringify(data).slice(0, 500));
  }

  for (const cand of candidates) {
    const parts = cand.content?.parts;
    if (!parts?.length) continue;
    for (const p of parts) {
      const img = extractGeminiInlineImage(p);
      if (img) return img;
    }
  }

  const first = candidates[0];
  const fr = first?.finishReason ?? 'unknown';
  const textHint = collectGeminiPartText(first?.content?.parts);
  const suffix = textHint ? ` Text returned: ${textHint}` : '';
  throw new Error(
    `Gemini API: no image in response (finishReason=${fr}).${suffix} If this persists, try another image model in the API panel or simplify the prompt.`
  );
}

const geminiProvider: ImageProvider = {
  async generate(params, { token, prompt, timestamp }) {
    if (params.reframeOnly && !params.baseVehicleImageUrl?.trim()) {
      throw new Error(
        'Gemini: camera-angle generation needs a base vehicle photo. Generate or upload a main vehicle image first.'
      );
    }

    const apiKey =
      token.trim() ||
      (localStorage.getItem('GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('Gemini API: set API key in the panel (or VITE_GEMINI_API_KEY).');
    }

    const model = getGeminiImageModel();
    const url = geminiGenerateContentUrl(model);

    const refSource = params.reframeOnly
      ? [params.baseVehicleImageUrl || ''].filter(Boolean)
      : collectReferenceUrls(params);
    const refUrls = await resolveReferenceUrlsForNanobanana(refSource);
    /** Every non-empty URL becomes one `inlineData` image part (base + any number of accessory/category refs). */
    const resolvedUrls = refUrls.map((u) => u.trim()).filter(Boolean);
    const inlineImageCount = resolvedUrls.length;
    const hasMultipleInlineImages = inlineImageCount >= 2 && !params.reframeOnly;
    const textPrompt = hasMultipleInlineImages
      ? prompt + buildGeminiIntegrationSuffix(inlineImageCount, hasInteriorAccessories(params))
      : prompt;

    const parts: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }> = [];
    for (const u of resolvedUrls) {
      const payload = await urlToBase64Payload(u);
      parts.push({
        inlineData: {
          mimeType: payload.mimeType,
          data: payload.bytesBase64Encoded,
        },
      });
    }
    parts.push({ text: textPrompt });

    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    };

    let response;
    try {
      response = await axios.post(url, body, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-goog-api-key': apiKey,
        },
      });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const raw = err.response?.data;
        let msg = err.message;
        if (raw && typeof raw === 'object') {
          const o = raw as { error?: { message?: string; code?: number }; message?: string };
          msg = o.error?.message ?? (typeof o.message === 'string' ? o.message : msg);
        }
        const http = status != null ? ` [HTTP ${status}]` : '';
        const code =
          raw && typeof raw === 'object' && (raw as { error?: { code?: number } }).error?.code != null
            ? ` (code ${(raw as { error: { code: number } }).error.code})`
            : '';
        throw new Error(`Gemini API request failed: ${msg}${http}${code}`);
      }
      throw err;
    }

    const { b64, mimeType } = parseGeminiImageFromResponse(response.data);
    const imageUrl = base64ToObjectUrl(b64, mimeType);

    return {
      imageUrl,
      prompt: textPrompt,
      apiCallDetails: {
        providerName: 'Gemini API (native image)',
        modelName: `${model} (generateContent)`,
        endpoint: url,
        method: 'POST',
        prompt: textPrompt,
        outputFormat: mimeType,
        authType: 'Google AI API key (x-goog-api-key)',
        timestamp,
      },
    };
  },
};

const nanobananaProvider: ImageProvider = {
  async generate(params, { token, prompt, timestamp }) {
    const payload: {
      prompt: string;
      numImages: number;
      type: string;
      image_size: string;
      imageUrls?: string[];
    } = {
      prompt,
      numImages: 1,
      type: 'TEXTTOIAMGE',
      image_size: '4:3',
    };

    const collected = params.reframeOnly
      ? [params.baseVehicleImageUrl || ''].filter(Boolean)
      : collectReferenceUrls(params);
    const references =
      collected.length > 0 ? await resolveReferenceUrlsForNanobanana(collected) : [];
    if (references.length > 0) {
      payload.type = 'IMAGETOIAMGE';
      payload.imageUrls = references;
    }

    const generateResponse = await axios.post(
      `https://api.nanobananaapi.ai/api/v1/nanobanana/generate`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const taskId = generateResponse.data?.data?.taskId;
    if (!taskId) {
      throw new Error(
        'Failed to get taskId from NanoBanana API: ' + JSON.stringify(generateResponse.data)
      );
    }

    let resultImageUrl = null;
    let attempts = 0;
    while (attempts < 30) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const statusResponse = await axios.get(
        `https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?taskId=${taskId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const successFlag = statusResponse.data?.data?.successFlag;
      if (successFlag === 1) {
        resultImageUrl =
          statusResponse.data?.data?.response?.resultImageUrl ||
          statusResponse.data?.data?.response?.originImageUrl;
        break;
      } else if (successFlag === 2 || successFlag === 3) {
        throw new Error(statusResponse.data?.data?.errorMessage || 'NanoBanana generation failed');
      }
      attempts++;
    }

    if (!resultImageUrl) {
      throw new Error('NanoBanana API timed out waiting for image generation.');
    }

    const imageResponse = await axios.get(resultImageUrl, { responseType: 'blob' });
    const localUrl = URL.createObjectURL(imageResponse.data);

    return {
      imageUrl: localUrl,
      prompt,
      apiCallDetails: {
        providerName: 'NanoBanana API',
        modelName: 'nanobanana',
        endpoint: 'api.nanobananaapi.ai (Async)',
        method: 'POST/GET Polling',
        prompt,
        outputFormat: 'blob',
        authType: 'Bearer Token',
        timestamp,
      },
    };
  },
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function urlToBase64Payload(
  url: string
): Promise<{ bytesBase64Encoded: string; mimeType: string }> {
  const trimmed = url.trim();
  if (trimmed.startsWith('data:')) {
    const match = /^data:([^;,]+);base64,(.+)$/.exec(trimmed);
    if (match) {
      return { mimeType: match[1], bytesBase64Encoded: match[2] };
    }
    throw new Error('Unsupported data URL format for Vertex AI (expected base64).');
  }

  const res = await fetch(trimmed);
  if (!res.ok) {
    throw new Error(`Failed to load image for Vertex AI: HTTP ${res.status}`);
  }
  const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
  const buf = await res.arrayBuffer();
  return { bytesBase64Encoded: arrayBufferToBase64(buf), mimeType };
}

async function loadImageForDimensions(url: string): Promise<HTMLImageElement> {
  const trimmed = url.trim();
  let objectUrl: string | null = null;
  const src =
    trimmed.startsWith('data:') || trimmed.startsWith('blob:')
      ? trimmed
      : (objectUrl = URL.createObjectURL(
          await fetch(trimmed).then(async (r) => {
            if (!r.ok) throw new Error(`Failed to load image: HTTP ${r.status}`);
            return r.blob();
          })
        ));

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to decode image for inpaint mask sizing.'));
      img.src = src;
    });
    return img;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/** One fetch / decode path for Vertex inpaint (raw bytes + pixel size for mask). */
async function loadBaseImageBytesAndSizeForVertex(
  url: string
): Promise<{ bytesBase64Encoded: string; mimeType: string; width: number; height: number }> {
  const trimmed = url.trim();
  if (trimmed.startsWith('data:')) {
    const parsed = await urlToBase64Payload(trimmed);
    const img = await loadImageForDimensions(trimmed);
    return {
      bytesBase64Encoded: parsed.bytesBase64Encoded,
      mimeType: parsed.mimeType,
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  }

  const res = await fetch(trimmed);
  if (!res.ok) {
    throw new Error(`Failed to load image for Vertex AI: HTTP ${res.status}`);
  }
  const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
  const buf = await res.arrayBuffer();
  const bytesBase64Encoded = arrayBufferToBase64(buf);
  let objectUrl: string | null = null;
  try {
    objectUrl = URL.createObjectURL(new Blob([buf], { type: mimeType }));
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to decode image for inpaint mask sizing.'));
      img.src = objectUrl!;
    });
    return {
      bytesBase64Encoded,
      mimeType,
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Default insert mask: lower-center band (typical front bumper / bullbar region).
 * `MASK_MODE_FOREGROUND` masks the whole subject (entire vehicle), which causes full-car re-generation.
 */
function buildPngMaskBase64ForFrontAccessoryRegion(
  width: number,
  height: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable for inpaint mask.');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  const x0 = Math.round(width * 0.1);
  const x1 = Math.round(width * 0.9);
  const y0 = Math.round(height * 0.58);
  const y1 = Math.round(height * 0.99);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  const dataUrl = canvas.toDataURL('image/png');
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('Failed to encode inpaint mask as PNG.');
  return match[1];
}

/** Full-frame white mask = inpaint entire image (used for camera-angle reframes on Vertex). */
function buildPngMaskBase64FullFrame(width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable for inpaint mask.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/png');
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('Failed to encode full-frame inpaint mask as PNG.');
  return match[1];
}

function vertexPredictUrl(projectId: string, location: string, model: string): string {
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;
}

/** GCP API keys (Credentials → API key, often bound to a service account) use `?key=`. */
function vertexPredictUrlWithKey(
  projectId: string,
  location: string,
  model: string,
  apiKey: string | undefined
): string {
  const base = vertexPredictUrl(projectId, location, model);
  if (!apiKey?.trim()) return base;
  const u = new URL(base);
  u.searchParams.set('key', apiKey.trim());
  return u.toString();
}

function getVertexAuthMode(): 'oauth' | 'api_key' {
  const m = localStorage.getItem('VERTEX_AUTH_MODE');
  return m === 'api_key' ? 'api_key' : 'oauth';
}

function parseVertexPredictions(data: unknown): { b64: string; mimeType: string } {
  const pred = (data as { predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }> })
    ?.predictions?.[0];
  const b64 = pred?.bytesBase64Encoded;
  if (!b64) {
    throw new Error(
      'Vertex AI: missing image in response. ' + JSON.stringify(data).slice(0, 500)
    );
  }
  return { b64, mimeType: pred?.mimeType || 'image/png' };
}

function base64ToObjectUrl(b64: string, mimeType: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

function getVertexTextModel(): string {
  return (
    (import.meta.env.VITE_VERTEX_TEXT_MODEL as string | undefined)?.trim() ||
    'imagen-4.0-fast-generate-001'
  );
}

function getVertexEditModel(): string {
  return (
    (import.meta.env.VITE_VERTEX_EDIT_MODEL as string | undefined)?.trim() ||
    'imagen-3.0-capability-001'
  );
}

/**
 * Vertex AI Imagen: text-to-image when no base photo; inpaint insertion with a
 * user-provided lower-center mask when a base vehicle image is present (foreground auto-mask
 * would cover the whole vehicle and heavily re-draw the car). One image per request.
 */
const vertexProvider: ImageProvider = {
  async generate(params, { token, prompt, timestamp }) {
    const projectId =
      (localStorage.getItem('VERTEX_PROJECT_ID') || import.meta.env.VITE_VERTEX_PROJECT_ID || '')
        .trim();
    const location = (
      localStorage.getItem('VERTEX_LOCATION') ||
      import.meta.env.VITE_VERTEX_LOCATION ||
      'us-central1'
    ).trim();

    if (!projectId) {
      throw new Error('Vertex AI: set Project ID in the API Key panel (or VITE_VERTEX_PROJECT_ID).');
    }

    const base = params.baseVehicleImageUrl?.trim();
    const textModel = getVertexTextModel();
    const editModel = getVertexEditModel();
    const authMode = getVertexAuthMode();
    const gcpApiKey = (
      localStorage.getItem('VERTEX_API_KEY') ||
      import.meta.env.VITE_VERTEX_API_KEY ||
      ''
    ).trim();

    let endpoint: string;
    let body: object;

    if (base) {
      const baseForRequest = maybeConvertCloudinaryImageUrlForNanobanana(base);
      const { bytesBase64Encoded, width, height } =
        await loadBaseImageBytesAndSizeForVertex(baseForRequest);
      const reframe = !!params.reframeOnly;
      const maskB64 = reframe
        ? buildPngMaskBase64FullFrame(width, height)
        : buildPngMaskBase64ForFrontAccessoryRegion(width, height);

      endpoint =
        authMode === 'api_key' && gcpApiKey
          ? vertexPredictUrlWithKey(projectId, location, editModel, gcpApiKey)
          : vertexPredictUrl(projectId, location, editModel);
      body = {
        instances: [
          {
            prompt,
            referenceImages: [
              {
                referenceType: 'REFERENCE_TYPE_RAW',
                referenceId: 1,
                referenceImage: { bytesBase64Encoded },
              },
              {
                referenceType: 'REFERENCE_TYPE_MASK',
                referenceId: 2,
                referenceImage: { bytesBase64Encoded: maskB64 },
                maskImageConfig: {
                  maskMode: 'MASK_MODE_USER_PROVIDED',
                  dilation: reframe ? 0.01 : 0.02,
                },
              },
            ],
          },
        ],
        parameters: {
          editConfig: {
            baseSteps: reframe ? 55 : 50,
          },
          editMode: 'EDIT_MODE_INPAINT_INSERTION',
          sampleCount: 1,
        },
      };
    } else {
      endpoint =
        authMode === 'api_key' && gcpApiKey
          ? vertexPredictUrlWithKey(projectId, location, textModel, gcpApiKey)
          : vertexPredictUrl(projectId, location, textModel);
      body = {
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '4:3',
          enhancePrompt: false,
          addWatermark: true,
        },
      };
    }

    const useApiKeyAuth = authMode === 'api_key' && gcpApiKey;
    if (!useApiKeyAuth && !token.trim()) {
      throw new Error(
        'Vertex AI: paste an OAuth 2 access token (e.g. from gcloud auth print-access-token), or switch auth to Google Cloud API key.'
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=utf-8',
    };
    if (!useApiKeyAuth) {
      headers.Authorization = `Bearer ${token.trim()}`;
    }

    let response;
    try {
      response = await axios.post(endpoint, body, { headers });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as {
          error?: { message?: string; status?: string };
          message?: string;
        } | undefined;
        const msg =
          data?.error?.message ||
          (typeof data?.message === 'string' ? data.message : null) ||
          err.message;
        const status = data?.error?.status;
        const iamHint =
          /Permission.*denied|aiplatform\.endpoints\.predict/i.test(msg)
            ? ' In Google Cloud Console → IAM: grant the service account bound to your API key the role Vertex AI User (roles/aiplatform.user) on this project.'
            : '';
        const apiKeyHint =
          useApiKeyAuth &&
          (/API keys are not supported|Expected OAuth2|UNAUTHENTICATED|CREDENTIALS_MISSING/i.test(
            msg
          ) ||
            status === 'UNAUTHENTICATED')
            ? ' Vertex predict does not accept a normal browser/API key alone. Use Google Cloud Console → Credentials → Create API key → “Authenticate API through a service account” (bound key), or switch to OAuth and paste a token from `gcloud auth print-access-token`.'
            : '';
        throw new Error(`Vertex AI request failed: ${msg}${iamHint}${apiKeyHint}`);
      }
      throw err;
    }

    const { b64, mimeType } = parseVertexPredictions(response.data);
    const imageUrl = base64ToObjectUrl(b64, mimeType);

    return {
      imageUrl,
      prompt,
      apiCallDetails: {
        providerName: 'Vertex AI (Imagen)',
        modelName: base ? `${editModel} (inpaint)` : textModel,
        endpoint,
        method: 'POST',
        prompt,
        outputFormat: mimeType,
        authType: useApiKeyAuth
          ? 'Google Cloud API key (?key=)'
          : 'OAuth2 Bearer (access token)',
        timestamp,
      },
    };
  },
};

const providers: Record<ApiProvider, ImageProvider> = {
  nanobanana: nanobananaProvider,
  gemini: geminiProvider,
  vertex: vertexProvider,
};

const imageCache = new Map<string, GenerateImageResult>();

function resolveApiProvider(): ApiProvider {
  const raw = localStorage.getItem('API_PROVIDER');
  if (raw === 'stability') {
    localStorage.setItem('API_PROVIDER', 'nanobanana');
    return 'nanobanana';
  }
  if (raw === 'vertex') return 'vertex';
  if (raw === 'gemini') return 'gemini';
  return 'nanobanana';
}

function vertexCredentialPresent(): boolean {
  if (getVertexAuthMode() === 'api_key') {
    return !!(
      localStorage.getItem('VERTEX_API_KEY')?.trim() || import.meta.env.VITE_VERTEX_API_KEY?.trim()
    );
  }
  return !!(
    localStorage.getItem('VERTEX_ACCESS_TOKEN')?.trim() || import.meta.env.VITE_VERTEX_ACCESS_TOKEN?.trim()
  );
}

/** Text-to-image params for a catalog vehicle with no base photo yet (data mode). */
export function paramsForCatalogVehicleBaseImage(vehicle: Vehicle): GenerateImageParams {
  return {
    vehicleMake: vehicle.make,
    vehicleModel: vehicle.model,
    vehicleYear: vehicle.year,
    vehicleVariant: vehicle.variant?.trim() || undefined,
    accessories: [],
    accessoryCategoriesOrdered: [],
    customPrompt: '',
    categoryReferenceImages: {},
    baseVehicleImageUrl: null,
    accessoryImageUrlsOrdered: [],
    vehicleConfigureMode: 'data',
  };
}

/** Prepends exterior body color (when chosen) before user custom prompt text. */
function mergeCustomPromptWithExteriorBodyColor(
  config: Configuration,
  customPromptOverride?: string
): string {
  const user = (customPromptOverride ?? config.customPrompt ?? '').trim();
  let color = '';
  if (config.exteriorBodyColor === 'firecracker-red') {
    color =
      'Vehicle exterior body paint: Firecracker Red (vivid deep red, OEM-style). Apply this color consistently to all visible painted body panels; realistic gloss, specular highlights, and clean panel gaps.';
  } else if (config.exteriorBodyColor === 'black') {
    color =
      'Vehicle exterior body paint: solid black. Apply consistently to all visible painted body panels; realistic depth, reflections, and clean panel gaps.';
  }
  if (!color && !user) return '';
  if (!color) return user;
  if (!user) return color;
  return `${color} ${user}`;
}

/** Maps UI config to API params (shared by preview + regenerate). */
export function paramsFromConfiguration(
  config: Configuration,
  customPromptOverride?: string,
  options?: { reframeOnly?: boolean }
): GenerateImageParams | null {
  if (!config.vehicle) return null;
  const accessoryImageUrlsOrdered = config.selectedAccessories.map(
    (a) => config.accessoryReferenceImages[a.id]?.trim() || a.imageUrl?.trim() || ''
  );
  return {
    vehicleMake: config.vehicle.make,
    vehicleModel: config.vehicle.model,
    vehicleYear: config.vehicle.year,
    vehicleVariant: config.vehicle.variant?.trim() || undefined,
    accessories: config.selectedAccessories.map((a) => a.name),
    accessoryCategoriesOrdered: config.selectedAccessories.map((a) => a.category),
    customPrompt: mergeCustomPromptWithExteriorBodyColor(config, customPromptOverride),
    categoryReferenceImages:
      config.vehicleConfigureMode === 'images' ? {} : config.categoryReferenceImages,
    baseVehicleImageUrl: config.vehicle.baseImageUrl || null,
    accessoryImageUrlsOrdered,
    vehicleConfigureMode: config.vehicleConfigureMode,
    reframeOnly: options?.reframeOnly,
  };
}

export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  const providerKey = resolveApiProvider();
  const prompt =
    providerKey === 'vertex' && params.baseVehicleImageUrl?.trim() && !params.reframeOnly
      ? buildVertexInpaintPrompt(params)
      : buildPrompt(params);
  const hasReferencePayload = collectReferenceUrls(params).length > 0;

  if (!hasReferencePayload && imageCache.has(prompt)) {
    return imageCache.get(prompt)!;
  }

  const timestamp = new Date().toISOString();

  let activeToken = '';
  switch (providerKey) {
    case 'vertex':
      if (!vertexCredentialPresent()) {
        activeToken = '';
      } else if (getVertexAuthMode() === 'api_key') {
        activeToken = ' ';
      } else {
        activeToken = (
          localStorage.getItem('VERTEX_ACCESS_TOKEN') ||
          import.meta.env.VITE_VERTEX_ACCESS_TOKEN ||
          ''
        ).trim();
      }
      break;
    case 'gemini':
      activeToken = (localStorage.getItem('GEMINI_API_KEY') || '').trim();
      if (!activeToken) {
        activeToken = import.meta.env.VITE_GEMINI_API_KEY || '';
      }
      break;
    case 'nanobanana':
      activeToken = (localStorage.getItem('NANOBANANA_API_KEY') || '').trim();
      if (!activeToken) {
        activeToken = import.meta.env.VITE_NANOBANANA_API_KEY || '';
      }
      break;
  }

  if (!activeToken) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const text = encodeURIComponent(
      `${params.vehicleModel}${params.customPrompt ? ' - ' + params.customPrompt : ''}`
    );
    const providerName = apiProviderLabel(providerKey);
    const fakeResult = {
      imageUrl: `https://placehold.co/800x500/1a1a1a/f0a500?text=${text}`,
      prompt,
      apiCallDetails: {
        providerName,
        modelName: 'Mock Placeholder',
        endpoint: 'Placeholder fallback',
        method: 'POST',
        prompt,
        outputFormat: 'jpeg',
        authType: `None (${providerKey} credentials missing - using placeholder)`,
        timestamp,
      },
    };
    imageCache.set(prompt, fakeResult);
    return fakeResult;
  }

  const provider = providers[providerKey];
  const result = await provider.generate(params, { token: activeToken, prompt, timestamp });

  if (!hasReferencePayload) {
    imageCache.set(prompt, result);
  }
  return result;
}
