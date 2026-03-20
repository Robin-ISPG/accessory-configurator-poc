import axios from 'axios';

const STABILITY_API_KEY = import.meta.env.VITE_STABILITY_API_KEY;

export interface GenerateImageParams {
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  accessories: string[];
  customPrompt?: string;
}

export interface GenerateImageResult {
  imageUrl: string;
  prompt: string;
  apiCallDetails: {
    endpoint: string;
    method: string;
    prompt: string;
    outputFormat: string;
    authType: string;
    timestamp: string;
  };
}

function buildPrompt(params: GenerateImageParams): string {
  const accList = params.accessories.join(', ');
  const custom = params.customPrompt ? `. ${params.customPrompt}` : '';
  return `A professional automotive photograph of a ${params.vehicleYear} ${params.vehicleMake} ${params.vehicleModel} with ${accList} installed${custom}. Studio lighting, high quality, photorealistic, 4K resolution.`;
}

const imageCache = new Map<string, GenerateImageResult>();

export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  const prompt = buildPrompt(params);
  
  if (imageCache.has(prompt)) {
    // Return a clone/reference of the cached result to avoid API cost
    return imageCache.get(prompt)!;
  }

  const timestamp = new Date().toISOString();

  // For POC: if no API key, return a placeholder after a fake delay
  if (!STABILITY_API_KEY) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const text = encodeURIComponent(`${params.vehicleModel}${params.customPrompt ? ' - ' + params.customPrompt : ''}`);
    const fakeResult = {
      imageUrl: `https://placehold.co/800x500/1a1a1a/f0a500?text=${text}`,
      prompt,
      apiCallDetails: {
        endpoint: 'https://api.stability.ai/v2beta/stable-image/generate/core',
        method: 'POST',
        prompt,
        outputFormat: 'jpeg',
        authType: 'Bearer Token (VITE_STABILITY_API_KEY not set - using placeholder)',
        timestamp,
      },
    };
    imageCache.set(prompt, fakeResult);
    return fakeResult;
  }

  // Real Stability AI img2img call
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('output_format', 'jpeg');

  const response = await axios.post(
    'https://api.stability.ai/v2beta/stable-image/generate/core',
    formData,
    {
      headers: {
        Authorization: `Bearer ${STABILITY_API_KEY}`,
        Accept: 'image/*',
      },
      responseType: 'blob',
    }
  );

  const imageUrl = URL.createObjectURL(response.data);
  const result = {
    imageUrl,
    prompt,
    apiCallDetails: {
      endpoint: 'https://api.stability.ai/v2beta/stable-image/generate/core',
      method: 'POST',
      prompt,
      outputFormat: 'jpeg',
      authType: 'Bearer Token',
      timestamp,
    },
  };
  
  imageCache.set(prompt, result);
  return result;
}
