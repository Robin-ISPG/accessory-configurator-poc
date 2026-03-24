import axios from 'axios';
import type { ApiProvider, VehicleConfigureMode, Configuration } from '../types';
import {
  isCloudinaryConfigured,
  isDataUrl,
  uploadImageDataUrl,
} from './cloudinary';

export interface GenerateImageParams {
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  accessories: string[];
  customPrompt?: string;
  categoryReferenceImages?: Record<string, string>;
  /** Locked base vehicle photo (e.g. data URL) for image-to-image composition */
  baseVehicleImageUrl?: string | null;
  /** Accessory reference images in the same order as `accessories` */
  accessoryImageUrlsOrdered?: string[];
  vehicleConfigureMode?: VehicleConfigureMode;
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
      if (!isDataUrl(trimmed)) return trimmed;
      if (!isCloudinaryConfigured()) return trimmed;
      return uploadImageDataUrl(trimmed);
    })
  );
}

function buildPrompt(params: GenerateImageParams): string {
  const base = params.baseVehicleImageUrl?.trim();
  const meta = `${params.vehicleYear} ${params.vehicleMake} ${params.vehicleModel}`;

  if (base) {
    const ordered = params.accessoryImageUrlsOrdered || [];
    let accDetail = '';
    let refImageNum = 2;
    params.accessories.forEach((name, i) => {
      const ref = ordered[i];
      if (ref) {
        // accDetail += `Reference image ${refImageNum} is the product photo for "${name}" — keep its silhouette, materials, and aspect ratio; do not stretch or squash. `;
        // Prompt V2
        accDetail += `Ref ${refImageNum} is "${name}" — install at OEM position, preserve its silhouette and materials, exact proportions, no stretching. `;
        refImageNum += 1;
      } else {
        // accDetail += `Accessory "${name}" should be added to match the vehicle; use realistic scale and perspective. `;
        // Prompt V2
        accDetail += `"${name}" — physically fitted at correct OEM position, realistic scale and perspective matched to vehicle. `;
      }
    });

    const custom = params.customPrompt?.trim()
    ? ` (((${params.customPrompt.trim()}))). `
    : ' ';

    // return (
    //   `Photorealistic composite of ONE vehicle. CRITICAL: Reference image 1 is the locked base vehicle photograph — preserve the exact vehicle identity, body shape, paint, glass, wheels, stance, shadows, background, and output aspect ratio; do not swap the vehicle for a different model or re-draw the whole car from imagination. ` +
    //   (params.accessories.length > 0
    //     ? `Add or enhance these accessories on that same photo: ${params.accessories.join(', ')}. ${accDetail}`
    //     : '') +
    //   `${custom}` +
    //   `Match lighting and perspective of the base image; use contact shadows and occlusion so parts feel physically attached. Single full-frame output. Vehicle metadata (for context only): ${meta}.`
    // );
    // Prompt V2
    return (
      `Hyper-realistic automotive studio photograph. ` +
      `LOCKED BASE: Ref 1 is the base vehicle — preserve exact body shape, paint, glass, wheels, stance, background, and output aspect ratio without exception. Do not redraw or reimagine the vehicle. ` +
      (params.accessories.length > 0
        ? `ACCESSORIES: Install ${params.accessories.join(', ')} on the base vehicle. ${accDetail}`
        : '') +
      `Match base image lighting and perspective exactly. Contact shadows and surface occlusion on all fitted parts. ` +
      `${custom}` +
      `Single full-frame output. Vehicle context: ${meta}.`
    );
  }

  // let accPhrase = '';
  // if (params.accessories.length > 0) {
  //   const accList = params.accessories.join(' and ');
  //   accPhrase = `featuring highly detailed, perfectly fitted, factory-compatible ((${accList})). CLEAR FOCUS on the ${accList}. `;
  // }

  // Prompt V2
  let accPhrase = '';
  if (params.accessories.length > 0) {
    const accList = params.accessories.join(', ');
    accPhrase = `Fitted with ((${accList})) — OEM position, exact proportions, physically attached. `;
  }

  // const subject = params.customPrompt
  //   ? `(((${params.customPrompt.trim()}))) appearance, which is a pristine ${params.vehicleYear} ${params.vehicleMake} ${params.vehicleModel}`
  //   : `a pristine ${params.vehicleYear} ${params.vehicleMake} ${params.vehicleModel}`;
// Prompt V2

const subject = params.customPrompt?.trim()
  ? `pristine ${params.vehicleYear} ${params.vehicleMake} ${params.vehicleModel}, (((${params.customPrompt.trim()})))`
  : `pristine ${params.vehicleYear} ${params.vehicleMake} ${params.vehicleModel}`;

  // return `Hyper-realistic unedited automotive photography of a SINGLE vehicle, shot on medium format camera, razor-sharp focus. A flawless ${subject}. ${accPhrase}Authentic real-world lighting, physically accurate vehicle proportions, perfectly round wheels, flawless geometry, completely isolated on a pure, minimalist white cyclorama studio backdrop. Zero background distractions, absolute physical realism, exact custom appearance and colors, masterpiece. No fantasy, no CGI.`;
  // Prompt v2
  return `Hyper-realistic automotive studio photograph of a ${subject}. ${accPhrase}Shot on white cyclorama backdrop, neutral diffused lighting. Accessories mounted with exact fitment, correct proportions, and factory-accurate placement. Vehicle unaltered. Photorealistic, medium format quality.`;
}

const NEGATIVE_PROMPT = 'blueprint, collage, split screen, multiple views, broken wheels, missing wheels, bent wheels, collapsed tires, deformed car body, cambered tires, floating tires, crashed, weird geometry, asymmetrical, toy car, illustration, 3d render, painting, drawing, cartoon, anime, fantasy, imagination, unreal engine, octane render, CGI, digital art, video game, poorly drawn, warped, distorted, mutant, weird colors, fake, sketch, complex background, outdoors, scenery, environment, malformed accessories, extra parts, ugly, mismatched parts, out of frame, out of focus';

interface ImageProvider {
  generate(params: GenerateImageParams, options: { token: string, prompt: string, timestamp: string }): Promise<GenerateImageResult>;
}

const stabilityProvider: ImageProvider = {
  async generate(_params, { token, prompt, timestamp }) {
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('negative_prompt', NEGATIVE_PROMPT);
    formData.append('output_format', 'jpeg');

    const response = await axios.post(
      'https://api.stability.ai/v2beta/stable-image/generate/core',
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'image/*',
        },
        responseType: 'blob',
      }
    );

    return {
      imageUrl: URL.createObjectURL(response.data),
      prompt,
      apiCallDetails: {
        providerName: 'Stability AI',
        modelName: 'stable-image-core',
        endpoint: 'https://api.stability.ai/v2beta/stable-image/generate/core',
        method: 'POST',
        prompt,
        outputFormat: 'jpeg',
        authType: 'Bearer Token',
        timestamp,
      },
    };
  }
};

const nanobananaProvider: ImageProvider = {
  async generate(params, { token, prompt, timestamp }) {
    // 1. Send the task generation request
    const payload: any = {
      prompt,
      numImages: 1,
      type: "TEXTTOIAMGE",
      image_size: "4:3"
    };

    const collected = collectReferenceUrls(params);
    const references =
      collected.length > 0 ? await resolveReferenceUrlsForNanobanana(collected) : [];
    if (references.length > 0) {
      payload.type = "IMAGETOIAMGE";
      payload.imageUrls = references;
    }

    const generateResponse = await axios.post(
      `https://api.nanobananaapi.ai/api/v1/nanobanana/generate`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );

    const taskId = generateResponse.data?.data?.taskId;
    if (!taskId) {
      throw new Error('Failed to get taskId from NanoBanana API: ' + JSON.stringify(generateResponse.data));
    }

    // 2. Poll for the task status
    let resultImageUrl = null;
    let attempts = 0;
    while (attempts < 30) {
      // Wait ~2 seconds before each check
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResponse = await axios.get(
        `https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?taskId=${taskId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const successFlag = statusResponse.data?.data?.successFlag;
      if (successFlag === 1) {
        // SUCCESS
        resultImageUrl = statusResponse.data?.data?.response?.resultImageUrl || statusResponse.data?.data?.response?.originImageUrl;
        break;
      } else if (successFlag === 2 || successFlag === 3) {
        // FAILED
        throw new Error(statusResponse.data?.data?.errorMessage || 'NanoBanana generation failed');
      }
      // status 0 means GENERATING, so just continue the loop
      attempts++;
    }

    if (!resultImageUrl) {
      throw new Error('NanoBanana API timed out waiting for image generation.');
    }

    // 3. Fetch the actual remote image into a local blob object URL
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
  }
};

const providers: Record<ApiProvider, ImageProvider> = {
  stability: stabilityProvider,
  nanobanana: nanobananaProvider,
};

const imageCache = new Map<string, GenerateImageResult>();

/** Maps UI config to API params (shared by preview + regenerate). */
export function paramsFromConfiguration(
  config: Configuration,
  customPromptOverride?: string
): GenerateImageParams | null {
  if (!config.vehicle) return null;
  const accessoryImageUrlsOrdered = config.selectedAccessories.map(
    (a) => config.accessoryReferenceImages[a.id] || ''
  );
  return {
    vehicleMake: config.vehicle.make,
    vehicleModel: config.vehicle.model,
    vehicleYear: config.vehicle.year,
    accessories: config.selectedAccessories.map((a) => a.name),
    customPrompt: customPromptOverride ?? config.customPrompt,
    categoryReferenceImages:
      config.vehicleConfigureMode === 'images' ? {} : config.categoryReferenceImages,
    baseVehicleImageUrl: config.vehicle.baseImageUrl || null,
    accessoryImageUrlsOrdered,
    vehicleConfigureMode: config.vehicleConfigureMode,
  };
}

export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  const prompt = buildPrompt(params);
  const hasReferencePayload = collectReferenceUrls(params).length > 0;

  if (!hasReferencePayload && imageCache.has(prompt)) {
    return imageCache.get(prompt)!;
  }

  const timestamp = new Date().toISOString();
  
  const providerKey = (localStorage.getItem('API_PROVIDER') as ApiProvider) || 'nanobanana';
  const customKey = providerKey === 'stability'
    ? localStorage.getItem('STABILITY_API_KEY')
    : localStorage.getItem('NANOBANANA_API_KEY');
    
  let activeToken = (customKey || '').trim();
  if (!activeToken) {
    activeToken = providerKey === 'stability'
      ? import.meta.env.VITE_STABILITY_API_KEY || ''
      : import.meta.env.VITE_NANOBANANA_API_KEY || '';
  }

  // For POC: if no API key in UI or env, return a placeholder after a fake delay
  if (!activeToken) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const text = encodeURIComponent(`${params.vehicleModel}${params.customPrompt ? ' - ' + params.customPrompt : ''}`);
    const fakeResult = {
      imageUrl: `https://placehold.co/800x500/1a1a1a/f0a500?text=${text}`,
      prompt,
      apiCallDetails: {
        providerName: providerKey === 'stability' ? 'Stability AI' : 'NanoBanana API',
        modelName: 'Mock Placeholder',
        endpoint: 'Placeholder fallback',
        method: 'POST',
        prompt,
        outputFormat: 'jpeg',
        authType: `None (${providerKey} API Key missing - using placeholder)`,
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
