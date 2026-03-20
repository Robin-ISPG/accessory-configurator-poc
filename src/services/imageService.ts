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
}

function buildPrompt(params: GenerateImageParams): string {
  const accList = params.accessories.join(', ');
  const custom = params.customPrompt ? `. ${params.customPrompt}` : '';
  return `A professional automotive photograph of a ${params.vehicleYear} ${params.vehicleMake} ${params.vehicleModel} with ${accList} installed${custom}. Studio lighting, high quality, photorealistic, 4K resolution.`;
}

export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  const prompt = buildPrompt(params);

  // For POC: if no API key, return a placeholder after a fake delay
  if (!STABILITY_API_KEY) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    return {
      imageUrl: `https://placehold.co/800x500/1a1a1a/f0a500?text=${encodeURIComponent(params.vehicleModel)}`,
      prompt,
    };
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
  return { imageUrl, prompt };
}
