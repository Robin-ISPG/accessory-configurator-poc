export type Step = 1 | 2;

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: string;
  variant: string;
  baseImageUrl: string;
}

export interface Accessory {
  id: string;
  name: string;
  category: 'exterior' | 'wheels' | 'interior' | 'performance';
  price: number;
  compatibleWith: string[]; // vehicle ids or 'all'
  imageUrl?: string;
}

export interface Configuration {
  vehicle: Vehicle | null;
  selectedAccessories: Accessory[];
  customPrompt: string;
  generatedImageUrl: string | null;
  generatedImages?: { url: string; view: string; prompt: string }[];
}

export type ApiProvider = 'stability' | 'huggingface';
