import { useState } from 'react';
import type { Configuration, Accessory } from '../../types';
import { accessories } from '../../data/accessories';
import AccessoryCard from './AccessoryCard';
import { generateImage } from '../../services/imageService';
import LoadingOverlay from '../ui/LoadingOverlay';

type Category = 'exterior' | 'wheels' | 'interior' | 'performance';
const categories: Category[] = ['exterior', 'wheels', 'interior', 'performance'];

import type { LogEntry } from '../LogBox/LogBox';

interface Props {
  config: Configuration;
  setConfig: (c: Configuration) => void;
  onNext: () => void;
  onBack: () => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  addLog: (type: LogEntry['type'], message: string, details?: string) => void;
}

export default function AccessoryGrid({ config, setConfig, onNext, onBack, isGenerating, setIsGenerating, addLog }: Props) {
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
      
      // Log API call details
      addLog('api', `Stability AI API Call - ${result.apiCallDetails.method}`, 
        `Endpoint: ${result.apiCallDetails.endpoint}\n` +
        `Prompt: "${result.apiCallDetails.prompt}"\n` +
        `Output Format: ${result.apiCallDetails.outputFormat}\n` +
        `Auth: ${result.apiCallDetails.authType}\n` +
        `Time: ${result.apiCallDetails.timestamp}`
      );
      
      setTimeout(() => { setIsGenerating(false); setProgress(0); onNext(); }, 400);
    } catch (err) {
      clearInterval(interval);
      setIsGenerating(false);
      setProgress(0);
      addLog('error', 'Stability AI API Call Failed', err instanceof Error ? err.message : 'Unknown error');
      alert('Image generation failed. Check your API key.');
    }
  }

  return (
    <div>
      {/* Loading Overlay */}
      {isGenerating && <LoadingOverlay loadingMsg={loadingMsg} progress={progress} />}

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
                onClick={() => {
                  addLog('action', `Category tab clicked: ${cat}`);
                  setActiveCategory(cat);
                }}
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
            onClick={() => {
              addLog('api', 'Generate Preview clicked', `Vehicle: ${config.vehicle?.make} ${config.vehicle?.model}, Accessories: ${config.selectedAccessories.map(a => a.name).join(', ')}`);
              handleGenerate();
            }}
            disabled={config.selectedAccessories.length === 0 || isGenerating}
            className="w-full bg-yellow-400 text-gray-900 font-bold uppercase tracking-wide py-3 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-yellow-300 transition-colors mb-2"
          >
            Generate Preview →
          </button>
          <button
            onClick={() => {
              addLog('action', 'Change Vehicle clicked');
              onBack();
            }}
            className="w-full border border-gray-200 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            ← Change Vehicle
          </button>
        </div>
      </div>
    </div>
  );
}
