export type Step = 1 | 2;

/** Step 1: pick from catalog data vs. upload a fixed base vehicle photo */
export type VehicleConfigureMode = 'data' | 'images';

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
  /** Active vehicle step tab; switching tabs clears vehicle-related state in the UI */
  vehicleConfigureMode: VehicleConfigureMode;
  selectedAccessories: Accessory[];
  customPrompt: string;
  generatedImageUrl: string | null;
  generatedImages?: { url: string; view: string; prompt: string }[];
  categoryReferenceImages: Record<string, string>;
  /** Selected accessory id → data URL for optional per-accessory reference photos */
  accessoryReferenceImages: Record<string, string>;
}

export type ApiProvider = 'stability' | 'nanobanana';
