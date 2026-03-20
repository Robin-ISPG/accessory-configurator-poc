import axios from 'axios';

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
  const custom = params.customPrompt ? `${params.customPrompt.trim()}, ` : '';
  
  let accPhrase = '';
  if (params.accessories.length > 0) {
    const accList = params.accessories.join(' and ');
    accPhrase = `featuring highly detailed, perfectly fitted, factory-compatible ((${accList})). CLEAR FOCUS on the ${accList}. `;
  }

  return `${custom}A flawless, highly detailed professional automotive studio photograph of a single ${params.vehicleYear} ${params.vehicleMake} ${params.vehicleModel}. ${accPhrase}Isolated on a clean, minimalist white studio backdrop. Sharp focus on the vehicle and modifications, zero background distractions. Photorealistic, 8k resolution, masterpiece.`;
}

const imageCache = new Map<string, GenerateImageResult>();

export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  const prompt = buildPrompt(params);
  
  if (imageCache.has(prompt)) {
    // Return a clone/reference of the cached result to avoid API cost
    return imageCache.get(prompt)!;
  }

  const timestamp = new Date().toISOString();
  const customKey = localStorage.getItem('STABILITY_API_KEY');
  // Use from env only if API key is not added in the frontend UI
  const activeToken = customKey ? customKey : (import.meta.env.VITE_STABILITY_API_KEY || '');

  // For POC: if no API key in UI or env, return a placeholder after a fake delay
  if (!activeToken) {
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
        authType: 'None (API Key missing in UI and Env - using placeholder)',
        timestamp,
      },
    };
    imageCache.set(prompt, fakeResult);
    return fakeResult;
  }

  // Real Stability AI img2img call
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('negative_prompt', 'background details, complex background, outdoors, scenery, environment, malformed accessories, extra parts, mutated, distorted, poorly drawn, ugly, mismatched parts, out of frame');
  formData.append('output_format', 'jpeg');

  const response = await axios.post(
    'https://api.stability.ai/v2beta/stable-image/generate/core',
    formData,
    {
      headers: {
        Authorization: `Bearer ${activeToken}`,
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
