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

function buildPrompt(params: GenerateImageParams): string {
  let accPhrase = '';
  if (params.accessories.length > 0) {
    const accList = params.accessories.join(' and ');
    accPhrase = `featuring highly detailed, perfectly fitted, factory-compatible ((${accList})). CLEAR FOCUS on the ${accList}. `;
  }

  // Inject the custom prompt as the highly emphasized primary subject of the photo
  const subject = params.customPrompt 
    ? `(((${params.customPrompt.trim()}))) appearance, which is a pristine ${params.vehicleYear} ${params.vehicleMake} ${params.vehicleModel}`
    : `a pristine ${params.vehicleYear} ${params.vehicleMake} ${params.vehicleModel}`;

  return `Hyper-realistic unedited automotive photography of a SINGLE vehicle, shot on medium format camera, razor-sharp focus. A flawless ${subject}. ${accPhrase}Authentic real-world lighting, physically accurate vehicle proportions, perfectly round wheels, flawless geometry, completely isolated on a pure, minimalist white cyclorama studio backdrop. Zero background distractions, absolute physical realism, exact custom appearance and colors, masterpiece. No fantasy, no CGI.`;
}

const NEGATIVE_PROMPT = 'blueprint, collage, split screen, multiple views, broken wheels, missing wheels, bent wheels, collapsed tires, deformed car body, cambered tires, floating tires, crashed, weird geometry, asymmetrical, toy car, illustration, 3d render, painting, drawing, cartoon, anime, fantasy, imagination, unreal engine, octane render, CGI, digital art, video game, poorly drawn, warped, distorted, mutant, weird colors, fake, sketch, complex background, outdoors, scenery, environment, malformed accessories, extra parts, ugly, mismatched parts, out of frame, out of focus';

import type { ApiProvider } from '../types';

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

const huggingFaceProvider: ImageProvider = {
  async generate(_params, { token, prompt, timestamp }) {
    const response = await axios.post(
      'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0',
      { 
        inputs: prompt,
        parameters: { negative_prompt: NEGATIVE_PROMPT }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'image/jpeg',
        },
        responseType: 'blob',
      }
    );

    return {
      imageUrl: URL.createObjectURL(response.data),
      prompt,
      apiCallDetails: {
        providerName: 'Hugging Face',
        modelName: 'stable-diffusion-xl-base-1.0',
        endpoint: 'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0',
        method: 'POST',
        prompt,
        outputFormat: 'jpeg',
        authType: 'Bearer Token',
        timestamp,
      },
    };
  }
};

const providers: Record<ApiProvider, ImageProvider> = {
  stability: stabilityProvider,
  huggingface: huggingFaceProvider
};

const imageCache = new Map<string, GenerateImageResult>();

export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  const prompt = buildPrompt(params);
  
  if (imageCache.has(prompt)) {
    // Return a clone/reference of the cached result to avoid API cost
    return imageCache.get(prompt)!;
  }

  const timestamp = new Date().toISOString();
  
  const providerKey = (localStorage.getItem('API_PROVIDER') as ApiProvider) || 'huggingface';
  const customKey = providerKey === 'stability' 
    ? localStorage.getItem('STABILITY_API_KEY') 
    : localStorage.getItem('HUGGINGFACE_API_KEY');
    
  let activeToken = customKey || '';
  if (!activeToken) {
    activeToken = providerKey === 'stability'
      ? import.meta.env.VITE_STABILITY_API_KEY || ''
      : import.meta.env.VITE_HUGGINGFACE_API_KEY || '';
  }

  // For POC: if no API key in UI or env, return a placeholder after a fake delay
  if (!activeToken) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const text = encodeURIComponent(`${params.vehicleModel}${params.customPrompt ? ' - ' + params.customPrompt : ''}`);
    const fakeResult = {
      imageUrl: `https://placehold.co/800x500/1a1a1a/f0a500?text=${text}`,
      prompt,
      apiCallDetails: {
        providerName: providerKey === 'stability' ? 'Stability AI' : 'Hugging Face',
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
  
  imageCache.set(prompt, result);
  return result;
}
