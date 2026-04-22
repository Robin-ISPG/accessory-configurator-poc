export type Step = 1 | 2;

/** Step 1: pick from catalog data vs. upload a fixed base vehicle photo */
export type VehicleConfigureMode = 'data' | 'images';

/** Exterior paint choice; merged into image-generation prompts */
export type ExteriorBodyColor = 'firecracker-red' | 'black';

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
  /** OR rules: `all`, a catalog `vehicle.id`, `make:Name`, or `model:Name` (see `isAccessoryCompatibleWithVehicle`) */
  compatibleWith: string[];
  /** Default product photo (e.g. `/accessories/...`); grid thumbnail and API reference until the user uploads a replacement */
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
  /** After "+ Front/Rear/…", Regenerate keeps this viewpoint until a new angle or a fresh preview. */
  lastReframeViewName?: string | null;
  lastReframeViewPrompt?: string | null;
  categoryReferenceImages: Record<string, string>;
  /** Selected accessory id → data URL for optional per-accessory reference photos */
  accessoryReferenceImages: Record<string, string>;
  /** When set, prepended to generation prompts (Exterior section) */
  exteriorBodyColor: ExteriorBodyColor | null;
}

export type ApiProvider = 'nanobanana' | 'gemini' | 'vertex';
