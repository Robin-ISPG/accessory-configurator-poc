import { useState } from 'react';
import type { Configuration } from '../../types';
import { generateImage } from '../../services/imageService';
import LoadingOverlay from '../ui/LoadingOverlay';

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
      {isGenerating && <LoadingOverlay loadingMsg={loadingMsg} progress={progress} />}

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
