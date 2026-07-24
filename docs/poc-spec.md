# Vehicle Accessory Configurator — POC Spec for Cursor

## Overview

A 3-step React web app where users select a vehicle, pick accessories, and see an AI-generated preview image. This is a POC — mock data only, no real backend, no auth, no Redux.

---

## Tech Stack

```
Vite + React 18 + TypeScript
Tailwind CSS
Axios (for AI call only)
useState for all state — no Redux
React Router (optional, can use conditional rendering)
```

### Setup Commands

```bash
npm create vite@latest accessory-configurator-poc -- --template react-ts
cd accessory-configurator-poc
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install axios
```

### Tailwind Config

In `tailwind.config.js`:
```js
content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]
```

In `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## Folder Structure

```
src/
├── components/
│   ├── VehicleSelector/
│   │   └── VehicleSelector.tsx
│   ├── AccessoryGrid/
│   │   ├── AccessoryGrid.tsx
│   │   └── AccessoryCard.tsx
│   ├── PreviewCanvas/
│   │   ├── PreviewCanvas.tsx
│   │   └── PromptEditor.tsx
│   ├── ConfigPanel/
│   │   └── ConfigPanel.tsx
│   └── ui/
│       ├── StepBar.tsx
│       └── LoadingOverlay.tsx
├── data/
│   ├── vehicles.ts
│   └── accessories.ts
├── types/
│   └── index.ts
├── services/
│   └── imageService.ts
├── App.tsx
└── main.tsx
```

---

## Types — `src/types/index.ts`

```ts
export type Step = 1 | 2 | 3;

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
}
```

---

## Mock Data — `src/data/vehicles.ts`

```ts
import { Vehicle } from '../types';

export const vehicles: Vehicle[] = [
  { id: 'ford-f150-2024', make: 'Ford', model: 'F-150', year: '2024', variant: 'XL Base', baseImageUrl: '' },
  { id: 'ford-f150-2024-sport', make: 'Ford', model: 'F-150', year: '2024', variant: 'Sport Edition', baseImageUrl: '' },
  { id: 'ford-bronco-2024', make: 'Ford', model: 'Bronco', year: '2024', variant: 'Base', baseImageUrl: '' },
  { id: 'toyota-tundra-2024', make: 'Toyota', model: 'Tundra', year: '2024', variant: 'SR Base', baseImageUrl: '' },
  { id: 'toyota-tacoma-2024', make: 'Toyota', model: 'Tacoma', year: '2024', variant: 'SR', baseImageUrl: '' },
  { id: 'jeep-wrangler-2024', make: 'Jeep', model: 'Wrangler', year: '2024', variant: 'Sport', baseImageUrl: '' },
];

export const makes = ['Ford', 'Toyota', 'Jeep'];

export const modelsByMake: Record<string, string[]> = {
  Ford: ['F-150', 'Bronco', 'Ranger'],
  Toyota: ['Tundra', 'Tacoma', '4Runner'],
  Jeep: ['Wrangler', 'Gladiator', 'Cherokee'],
};

export const years = ['2026', '2025', '2024', '2023'];
```

---

## Mock Data — `src/data/accessories.ts`

```ts
import { Accessory } from '../types';

export const accessories: Accessory[] = [
  { id: 'acc-1', name: 'Chrome Side Skirts', category: 'exterior', price: 299, compatibleWith: ['all'] },
  { id: 'acc-2', name: 'Sport Front Bumper', category: 'exterior', price: 499, compatibleWith: ['all'] },
  { id: 'acc-3', name: 'Fender Flares', category: 'exterior', price: 349, compatibleWith: ['all'] },
  { id: 'acc-4', name: 'Running Boards', category: 'exterior', price: 279, compatibleWith: ['all'] },
  { id: 'acc-5', name: 'Alloy Wheels 18"', category: 'wheels', price: 899, compatibleWith: ['all'] },
  { id: 'acc-6', name: 'Off-Road Tires', category: 'wheels', price: 649, compatibleWith: ['all'] },
  { id: 'acc-7', name: 'Lift Kit 3"', category: 'wheels', price: 799, compatibleWith: ['all'] },
  { id: 'acc-8', name: 'Wheel Covers', category: 'wheels', price: 149, compatibleWith: ['all'] },
  { id: 'acc-9', name: 'Seat Covers', category: 'interior', price: 199, compatibleWith: ['all'] },
  { id: 'acc-10', name: 'Floor Mats', category: 'interior', price: 89, compatibleWith: ['all'] },
  { id: 'acc-11', name: 'LED Interior Kit', category: 'interior', price: 129, compatibleWith: ['all'] },
  { id: 'acc-12', name: 'Dash Camera', category: 'interior', price: 249, compatibleWith: ['all'] },
  { id: 'acc-13', name: 'Cold Air Intake', category: 'performance', price: 379, compatibleWith: ['all'] },
  { id: 'acc-14', name: 'Exhaust Upgrade', category: 'performance', price: 599, compatibleWith: ['all'] },
  { id: 'acc-15', name: 'Suspension Kit', category: 'performance', price: 849, compatibleWith: ['all'] },
  { id: 'acc-16', name: 'Tow Package', category: 'performance', price: 449, compatibleWith: ['all'] },
];
```

---

## Image Service — `src/services/imageService.ts`

Providers (user-selectable via **API Key** in the nav):

1. **NanoBanana API** (`nanobananaapi.ai`) — async generate + poll; supports multiple reference images (base vehicle + accessories) when configured.
2. **Vertex AI (Imagen)** — REST `predict` to regional `aiplatform.googleapis.com`: text-to-image uses `imagen-3.0-fast-generate-001` by default (override `VITE_VERTEX_TEXT_MODEL`); when a **base vehicle image** is present, uses `imagen-3.0-capability-001` inpaint insertion with an automatic foreground mask. Requires GCP project ID, region, and a short-lived OAuth access token (`gcloud auth print-access-token`). One image per request (`sampleCount: 1`) to keep usage lean.

If no credentials are set for the active provider, `generateImage` waits ~3s and returns a placeholder image so the UI still works.

Optional env: `VITE_NANOBANANA_API_KEY`, `VITE_VERTEX_PROJECT_ID`, `VITE_VERTEX_LOCATION`, `VITE_VERTEX_ACCESS_TOKEN`, `VITE_VERTEX_TEXT_MODEL`, `VITE_VERTEX_EDIT_MODEL` (see `.env.example`).

---

## App State — `src/App.tsx`

```tsx
import { useState } from 'react';
import { Step, Configuration } from './types';
import StepBar from './components/ui/StepBar';
import VehicleSelector from './components/VehicleSelector/VehicleSelector';
import AccessoryGrid from './components/AccessoryGrid/AccessoryGrid';
import PreviewCanvas from './components/PreviewCanvas/PreviewCanvas';

const defaultConfig: Configuration = {
  vehicle: null,
  selectedAccessories: [],
  customPrompt: '',
  generatedImageUrl: null,
};

export default function App() {
  const [step, setStep] = useState<Step>(1);
  const [config, setConfig] = useState<Configuration>(defaultConfig);
  const [isGenerating, setIsGenerating] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <div className="bg-gray-900 px-6 py-3 flex items-center justify-between">
        <span className="font-black text-xl tracking-wide text-white uppercase">
          Acc<span className="text-yellow-400">essorize</span>
        </span>
        <span className="text-xs text-gray-400">POC Demo</span>
      </div>

      <StepBar currentStep={step} />

      <div className="p-6">
        {step === 1 && (
          <VehicleSelector
            config={config}
            setConfig={setConfig}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <AccessoryGrid
            config={config}
            setConfig={setConfig}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
            isGenerating={isGenerating}
            setIsGenerating={setIsGenerating}
          />
        )}
        {step === 3 && (
          <PreviewCanvas
            config={config}
            setConfig={setConfig}
            onBack={() => setStep(2)}
            isGenerating={isGenerating}
            setIsGenerating={setIsGenerating}
          />
        )}
      </div>
    </div>
  );
}
```

---

## Component — `StepBar.tsx`

```tsx
interface Props { currentStep: number; }

const steps = ['Vehicle', 'Accessories', 'Preview'];

export default function StepBar({ currentStep }: Props) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-2">
      {steps.map((label, i) => {
        const num = i + 1;
        const done = num < currentStep;
        const active = num === currentStep;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${done ? 'bg-yellow-400 text-gray-900' : active ? 'border-2 border-gray-900 text-gray-900' : 'border border-gray-300 text-gray-400'}`}>
              {done ? '✓' : num}
            </div>
            <span className={`text-xs font-medium ${active ? 'text-gray-900' : done ? 'text-yellow-500' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="text-gray-300 mx-1">›</span>}
          </div>
        );
      })}
    </div>
  );
}
```

---

## Component — `VehicleSelector.tsx`

```tsx
import { useState } from 'react';
import { Configuration, Vehicle } from '../../types';
import { makes, modelsByMake, years, vehicles } from '../../data/vehicles';

interface Props {
  config: Configuration;
  setConfig: (c: Configuration) => void;
  onNext: () => void;
}

export default function VehicleSelector({ config, setConfig, onNext }: Props) {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');

  const filteredVehicles = vehicles.filter(v =>
    (!make || v.make === make) &&
    (!model || v.model === model) &&
    (!year || v.year === year)
  );

  function selectVehicle(vehicle: Vehicle) {
    setConfig({ ...config, vehicle });
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Step 1 of 3</p>
      <h1 className="text-2xl font-bold mb-1">Select Your Vehicle</h1>
      <p className="text-sm text-gray-500 mb-6">Choose your make, model and year</p>

      <div className="grid grid-cols-3 gap-4 mb-6 max-w-2xl">
        {/* Make */}
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Make</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            value={make}
            onChange={e => { setMake(e.target.value); setModel(''); setYear(''); }}
          >
            <option value="">Select Make</option>
            {makes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Model */}
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Model</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-40"
            value={model}
            disabled={!make}
            onChange={e => { setModel(e.target.value); setYear(''); }}
          >
            <option value="">Select Model</option>
            {(modelsByMake[make] || []).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Year */}
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Year</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-40"
            value={year}
            disabled={!model}
            onChange={e => setYear(e.target.value)}
          >
            <option value="">Select Year</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Vehicle Cards */}
      {year && make && model && (
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">Select Variant</p>
          <div className="grid grid-cols-3 gap-4 max-w-2xl mb-6">
            {filteredVehicles.map(v => (
              <div
                key={v.id}
                onClick={() => selectVehicle(v)}
                className={`bg-white rounded-xl p-4 cursor-pointer border transition-all
                  ${config.vehicle?.id === v.id ? 'border-yellow-400 border-2' : 'border-gray-200 hover:border-gray-400'}`}
              >
                <div className="text-3xl mb-2">🛻</div>
                <div className="font-semibold text-sm">{v.model} {v.variant}</div>
                <div className="text-xs text-gray-400">{v.year} · {v.make}</div>
                {config.vehicle?.id === v.id && (
                  <div className="text-yellow-400 text-xs font-bold mt-1">✓ Selected</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!config.vehicle}
        className="bg-yellow-400 text-gray-900 font-bold uppercase tracking-wide px-6 py-3 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-yellow-300 transition-colors"
      >
        Continue to Accessories →
      </button>
    </div>
  );
}
```

---

## Component — `AccessoryGrid.tsx`

```tsx
import { useState } from 'react';
import { Configuration, Accessory } from '../../types';
import { accessories } from '../../data/accessories';
import AccessoryCard from './AccessoryCard';
import { generateImage } from '../../services/imageService';

type Category = 'exterior' | 'wheels' | 'interior' | 'performance';
const categories: Category[] = ['exterior', 'wheels', 'interior', 'performance'];

interface Props {
  config: Configuration;
  setConfig: (c: Configuration) => void;
  onNext: () => void;
  onBack: () => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
}

export default function AccessoryGrid({ config, setConfig, onNext, onBack, isGenerating, setIsGenerating }: Props) {
  const [activeCategory, setActiveCategory] = useState<Category>('exterior');
  const [loadingMsg, setLoadingMsg] = useState('Preparing your vehicle...');
  const [progress, setProgress] = useState(0);

  const filtered = accessories.filter(a => a.category === activeCategory);

  function toggleAccessory(acc: Accessory) {
    const exists = config.selectedAccessories.find(a => a.id === acc.id);
    const updated = exists
      ? config.selectedAccessories.filter(a => a.id !== acc.id)
      : [...config.selectedAccessories, acc];
    setConfig({ ...config, selectedAccessories: updated });
  }

  const totalPrice = config.selectedAccessories.reduce((sum, a) => sum + a.price, 0);

  async function handleGenerate() {
    if (!config.vehicle || config.selectedAccessories.length === 0) return;
    setIsGenerating(true);

    // Progress simulation
    const msgs = ['Preparing your vehicle...', 'Adding accessories...', 'Applying lighting...', 'Finalising preview...'];
    let p = 0; let mi = 0;
    const interval = setInterval(() => {
      p += 2;
      setProgress(p);
      if (p % 25 === 0 && mi < msgs.length - 1) { mi++; setLoadingMsg(msgs[mi]); }
      if (p >= 98) clearInterval(interval);
    }, 100);

    try {
      const result = await generateImage({
        vehicleMake: config.vehicle.make,
        vehicleModel: config.vehicle.model,
        vehicleYear: config.vehicle.year,
        accessories: config.selectedAccessories.map(a => a.name),
        customPrompt: config.customPrompt,
      });
      clearInterval(interval);
      setProgress(100);
      setConfig({ ...config, generatedImageUrl: result.imageUrl });
      setTimeout(() => { setIsGenerating(false); setProgress(0); onNext(); }, 400);
    } catch (err) {
      clearInterval(interval);
      setIsGenerating(false);
      setProgress(0);
      alert('Image generation failed. Check your API key.');
    }
  }

  return (
    <div>
      {/* Loading Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 text-center w-72">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-yellow-400 rounded-full animate-spin mx-auto mb-4" />
            <div className="font-bold text-lg mb-1">Generating Preview</div>
            <div className="text-sm text-gray-500 mb-4">{loadingMsg}</div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}

      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Step 2 of 3</p>
      <h1 className="text-2xl font-bold mb-1">Choose Accessories</h1>
      <p className="text-sm text-gray-500 mb-6">Select one or more accessories for your {config.vehicle?.model}</p>

      <div className="grid grid-cols-[1fr_300px] gap-6">
        {/* Left: Accessory Grid */}
        <div>
          {/* Category Tabs */}
          <div className="flex border-b border-gray-200 mb-4">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors
                  ${activeCategory === cat ? 'border-yellow-400 text-yellow-500' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {filtered.map(acc => (
              <AccessoryCard
                key={acc.id}
                accessory={acc}
                selected={!!config.selectedAccessories.find(a => a.id === acc.id)}
                onToggle={() => toggleAccessory(acc)}
              />
            ))}
          </div>
        </div>

        {/* Right: Summary Panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 h-fit sticky top-4">
          <div className="text-xs uppercase tracking-widest text-gray-400 mb-3">Your Configuration</div>

          {/* Vehicle Summary */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 mb-4">
            <span className="text-2xl">🛻</span>
            <div>
              <div className="text-sm font-semibold">{config.vehicle?.model} {config.vehicle?.variant}</div>
              <div className="text-xs text-gray-400">{config.vehicle?.year}</div>
            </div>
          </div>

          {/* Selected Accessories */}
          {config.selectedAccessories.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-4">No accessories selected</div>
          ) : (
            <div className="mb-3">
              {config.selectedAccessories.map(a => (
                <div key={a.id} className="flex justify-between items-center py-1.5 border-b border-gray-100 text-sm">
                  <span className="text-gray-700">{a.name}</span>
                  <span className="text-yellow-500 font-semibold text-xs">${a.price}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 font-semibold text-sm">
                <span>Total</span>
                <span className="text-yellow-500">${totalPrice.toLocaleString()}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={config.selectedAccessories.length === 0 || isGenerating}
            className="w-full bg-yellow-400 text-gray-900 font-bold uppercase tracking-wide py-3 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-yellow-300 transition-colors mb-2"
          >
            Generate Preview →
          </button>
          <button
            onClick={onBack}
            className="w-full border border-gray-200 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            ← Change Vehicle
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Component — `AccessoryCard.tsx`

```tsx
import { Accessory } from '../../types';

interface Props {
  accessory: Accessory;
  selected: boolean;
  onToggle: () => void;
}

export default function AccessoryCard({ accessory, selected, onToggle }: Props) {
  return (
    <div
      onClick={onToggle}
      className={`bg-white rounded-xl p-3 border cursor-pointer transition-all flex gap-3 items-start
        ${selected ? 'border-yellow-400 border-2 bg-yellow-50' : 'border-gray-200 hover:border-gray-400'}`}
    >
      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
        🔧
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800">{accessory.name}</div>
        <div className="text-xs text-yellow-500 font-semibold">${accessory.price}</div>
      </div>
      <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs flex-shrink-0 mt-0.5
        ${selected ? 'bg-yellow-400 border-yellow-400 text-white' : 'border-gray-300'}`}>
        {selected ? '✓' : ''}
      </div>
    </div>
  );
}
```

---

## Component — `PreviewCanvas.tsx`

```tsx
import { useState } from 'react';
import { Configuration } from '../../types';
import { generateImage } from '../../services/imageService';

interface Props {
  config: Configuration;
  setConfig: (c: Configuration) => void;
  onBack: () => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
}

export default function PreviewCanvas({ config, setConfig, onBack, isGenerating, setIsGenerating }: Props) {
  const [prompt, setPrompt] = useState(config.customPrompt);
  const [loadingMsg, setLoadingMsg] = useState('Preparing your vehicle...');
  const [progress, setProgress] = useState(0);

  const total = config.selectedAccessories.reduce((sum, a) => sum + a.price, 0);

  async function handleRegenerate() {
    if (!config.vehicle) return;
    setIsGenerating(true);
    const msgs = ['Preparing your vehicle...', 'Adding accessories...', 'Applying lighting...', 'Finalising preview...'];
    let p = 0; let mi = 0;
    const interval = setInterval(() => {
      p += 2; setProgress(p);
      if (p % 25 === 0 && mi < msgs.length - 1) { mi++; setLoadingMsg(msgs[mi]); }
      if (p >= 98) clearInterval(interval);
    }, 100);

    try {
      const result = await generateImage({
        vehicleMake: config.vehicle.make,
        vehicleModel: config.vehicle.model,
        vehicleYear: config.vehicle.year,
        accessories: config.selectedAccessories.map(a => a.name),
        customPrompt: prompt,
      });
      clearInterval(interval);
      setProgress(100);
      setConfig({ ...config, generatedImageUrl: result.imageUrl, customPrompt: prompt });
      setTimeout(() => { setIsGenerating(false); setProgress(0); }, 400);
    } catch {
      clearInterval(interval);
      setIsGenerating(false);
      setProgress(0);
    }
  }

  return (
    <div>
      {/* Loading Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 text-center w-72">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-yellow-400 rounded-full animate-spin mx-auto mb-4" />
            <div className="font-bold text-lg mb-1">Generating Preview</div>
            <div className="text-sm text-gray-500 mb-4">{loadingMsg}</div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}

      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Step 3 of 3</p>
      <h1 className="text-2xl font-bold mb-1">Your Preview</h1>
      <p className="text-sm text-gray-500 mb-6">AI-generated visualization of your configured vehicle</p>

      <div className="grid grid-cols-[1fr_280px] gap-6">
        {/* Preview Image */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-400">AI Generated Preview</span>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
            <div className="bg-gray-900 h-72 flex items-center justify-center relative">
              {config.generatedImageUrl ? (
                <img src={config.generatedImageUrl} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-7xl">🛻</span>
              )}
              <div className="absolute bottom-3 left-3 flex gap-2 flex-wrap">
                {config.selectedAccessories.slice(0, 3).map(a => (
                  <span key={a.id} className="bg-yellow-400/90 text-gray-900 text-xs font-semibold px-2 py-1 rounded">
                    {a.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-4">
              <div className="font-bold text-base mb-1">
                {config.vehicle?.year} {config.vehicle?.make} {config.vehicle?.model} {config.vehicle?.variant}
              </div>
              <div className="text-sm text-gray-500">
                {config.selectedAccessories.map(a => a.name).join(' · ')}
              </div>

              {/* Prompt Editor */}
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Refine with custom prompt</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="e.g. matte black finish, night scene..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    onClick={handleRegenerate}
                    className="bg-yellow-400 text-gray-900 font-bold px-4 py-2 rounded-lg text-sm hover:bg-yellow-300 whitespace-nowrap"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Config Side Panel */}
        <div className="flex flex-col gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs uppercase tracking-widest text-gray-400 mb-3">Vehicle</div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🛻</span>
              <div>
                <div className="font-semibold text-sm">{config.vehicle?.model} {config.vehicle?.variant}</div>
                <div className="text-xs text-gray-400">{config.vehicle?.year} · {config.vehicle?.make}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs uppercase tracking-widest text-gray-400 mb-3">Accessories</div>
            {config.selectedAccessories.map(a => (
              <div key={a.id} className="flex justify-between py-1.5 border-b border-gray-100 text-sm">
                <span className="text-gray-700">{a.name}</span>
                <span className="text-yellow-500 font-semibold text-xs">${a.price}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-semibold text-sm">
              <span>Total</span>
              <span className="text-yellow-500">${total.toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs uppercase tracking-widest text-gray-400 mb-3">Actions</div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => alert('Save — Phase 2')}
                className="w-full bg-yellow-400 text-gray-900 font-bold py-2.5 rounded-lg text-sm hover:bg-yellow-300"
              >
                Save Configuration
              </button>
              <button
                onClick={() => alert('Share — Phase 2')}
                className="w-full border border-gray-200 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Share Link
              </button>
              <button
                onClick={onBack}
                className="w-full border border-gray-200 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                ← Change Accessories
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Environment Setup

Create `.env` or `.env.local` in project root (see `.env.example`). Keys can also be stored only in the browser via the **API Key** panel.

---

## Running the App

```bash
npm run dev
```

---

## What's Mocked vs Real

| Thing | Status |
|---|---|
| Vehicle data | Mock JSON — no API |
| Accessory data | Mock JSON — no API |
| Image generation | NanoBanana API and/or Vertex AI Imagen (falls back to placeholder if no credentials) |
| Save configuration | Alert only — Phase 2 |
| Share link | Alert only — Phase 2 |
| Authentication | Not implemented — Phase 2 |
| State management | useState only — no Redux |

---

## Notes for Cursor

- All components use TypeScript with explicit prop interfaces
- No any types
- Tailwind only for styling — no CSS files needed beyond index.css
- The loading overlay is duplicated in AccessoryGrid and PreviewCanvas — extract to `LoadingOverlay.tsx` component if preferred
- The `generateImage` function falls back to a placeholder image automatically if the active provider has no credentials — so the app works without API keys
- Save and Share buttons show alerts — wire to real APIs in Phase 2
