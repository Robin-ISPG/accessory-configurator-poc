import { useState } from 'react';
import type { Configuration, Accessory } from '../../types';
import { accessories } from '../../data/accessories';
import AccessoryCard from './AccessoryCard';
import { generateImage } from '../../services/imageService';
import LoadingOverlay from '../ui/LoadingOverlay';

type Category = 'exterior' | 'wheels' | 'interior' | 'performance';
const categories: Category[] = ['exterior', 'wheels', 'interior', 'performance'];

import PreviewCanvas from '../PreviewCanvas/PreviewCanvas';
import type { LogEntry } from '../LogBox/LogBox';

interface Props {
  config: Configuration;
  setConfig: (c: Configuration) => void;
  onBack: () => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  addLog: (type: LogEntry['type'], message: string, details?: string) => void;
}

export default function AccessoryGrid({ config, setConfig, onBack, isGenerating, setIsGenerating, addLog }: Props) {
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
      addLog('api', `${result.apiCallDetails.providerName} API Call - ${result.apiCallDetails.method}`, 
        `Model: ${result.apiCallDetails.modelName}\n` +
        `Endpoint: ${result.apiCallDetails.endpoint}\n` +
        `Prompt: "${result.apiCallDetails.prompt}"\n` +
        `Output Format: ${result.apiCallDetails.outputFormat}\n` +
        `Auth Type: ${result.apiCallDetails.authType}\n` +
        `Timestamp: ${result.apiCallDetails.timestamp}`);
      
      const timingLog = `Processing Time: ~3s\nOutput resolution: 1024x1024`;
      addLog('info', 'Generation complete', timingLog);
      
      setTimeout(() => { setIsGenerating(false); setProgress(0); }, 400);
    } catch (err: unknown) {
      console.error('Failed to generate preview:', err);
      clearInterval(interval);
      setProgress(0);
      setIsGenerating(false);
      const activeProvider = localStorage.getItem('API_PROVIDER') === 'stability' ? 'Stability AI' : 'Hugging Face';
      addLog('error', `${activeProvider} API Call Failed`, err instanceof Error ? err.message : 'Unknown error');
      alert('Image generation failed. Check your API key.');
    }
  }

  return (
    <div>
      {/* Loading Overlay */}
      {isGenerating && <LoadingOverlay loadingMsg={loadingMsg} progress={progress} />}

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Left: Accessory Grid & Configuration Summary */}
        <div className="flex flex-col min-h-[500px] h-full gap-6">
          <div className="bg-slate-300 rounded-xl border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-63px)] sticky top-4">
            
            {/* Vehicle Header */}
            <div className="p-4 border-b border-gray-200 bg-slate-400 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900 font-bold">{config.vehicle?.model} {config.vehicle?.variant}</div>
                  <div className="text-xs text-slate-200 font-bold">{config.vehicle?.year}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  addLog('action', 'Change Vehicle clicked');
                  onBack();
                }}
                className="btn btn-primary bg-slate-200 p-2 font-bold uppercase rounded-lg cursor-pointer text-xs hover:text-gray-500"
              >
                Change Vehicle / Variant
              </button>
            </div>

            {/* Configurator Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
              
              {/* Category Tabs */}
              <div>
                <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-3 pb-1 border-b border-gray-100">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => {
                        addLog('action', `Category tab clicked: ${cat}`);
                        setActiveCategory(cat);
                      }}
                      className={`px-3 py-1.5 text-xs font-bold capitalize rounded-full whitespace-nowrap transition-colors
                        ${activeCategory === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
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

              {/* Selected Accessories Summary */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Selected ({config.selectedAccessories.length})</div>
                {config.selectedAccessories.length === 0 ? (
                  <div className="text-sm text-gray-400 italic py-2">No accessories selected</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {config.selectedAccessories.map(a => (
                      <div key={a.id} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700 max-w-[200px] truncate" title={a.name}>{a.name}</span>
                        <span className="text-gray-900 font-semibold text-xs">${a.price}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Sticky Action Area */}
            <div className="p-4 border-t border-gray-200 bg-white shrink-0">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold text-gray-500">Total</span>
                <span className="text-lg font-bold text-yellow-500">${totalPrice.toLocaleString()}</span>
              </div>
              <button
                onClick={() => {
                  addLog('api', 'Generate Preview clicked', `Vehicle: ${config.vehicle?.make} ${config.vehicle?.model}, Accessories: ${config.selectedAccessories.map(a => a.name).join(', ')}`);
                  handleGenerate();
                }}
                disabled={config.selectedAccessories.length === 0 || isGenerating}
                className="w-full bg-yellow-400 text-gray-900 font-bold uppercase tracking-wide py-3 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-yellow-300 transition-colors shadow-sm"
              >
                {isGenerating ? 'Generating...' : 'Generate Preview →'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Preview Area */}
        <div className="flex flex-col min-h-[500px]">
           <PreviewCanvas 
             config={config}
             setConfig={setConfig}
             isGenerating={isGenerating}
             setIsGenerating={setIsGenerating}
             addLog={addLog}
           />
        </div>
      </div>
    </div>
  );
}
