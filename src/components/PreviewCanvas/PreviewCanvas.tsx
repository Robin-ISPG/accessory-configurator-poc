import { useState, useRef, useCallback } from 'react';
import type { Configuration } from '../../types';
import { generateImage } from '../../services/imageService';
import LoadingOverlay from '../ui/LoadingOverlay';

import type { LogEntry } from '../LogBox/LogBox';

interface Props {
  config: Configuration;
  setConfig: (c: Configuration) => void;
  onBack: () => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  addLog: (type: LogEntry['type'], message: string, details?: string) => void;
}

export default function PreviewCanvas({ config, setConfig, onBack, isGenerating, setIsGenerating, addLog }: Props) {
  const [prompt, setPrompt] = useState(config.customPrompt);
  const [loadingMsg, setLoadingMsg] = useState('Preparing your vehicle...');
  const [progress, setProgress] = useState(0);
  
  // Zoom and pan state
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const total = config.selectedAccessories.reduce((sum, a) => sum + a.price, 0);
  
  const handleZoomIn = () => setScale(prev => Math.min(prev * 1.25, 4));
  const handleZoomOut = () => setScale(prev => Math.max(prev / 1.25, 0.5));
  const handleReset = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - translateX, y: e.clientY - translateY };
    }
  }, [scale, translateX, translateY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setTranslateX(e.clientX - dragStart.current.x);
      setTranslateY(e.clientY - dragStart.current.y);
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  async function handleRegenerate(overrideViewPrompt?: string) {
    if (!config.vehicle) return;
    if (overrideViewPrompt) {
      addLog('action', `Generate view clicked: ${overrideViewPrompt}`);
    } else {
      addLog('action', 'Regenerate clicked');
    }
    setIsGenerating(true);
    const msgs = ['Preparing your vehicle...', 'Adding accessories...', 'Applying lighting...', 'Finalising preview...'];
    let p = 0; let mi = 0;
    const interval = setInterval(() => {
      p += 2; setProgress(p);
      if (p % 25 === 0 && mi < msgs.length - 1) { mi++; setLoadingMsg(msgs[mi]); }
      if (p >= 98) clearInterval(interval);
    }, 100);

    const finalPrompt = overrideViewPrompt ? (prompt ? `${prompt}, ${overrideViewPrompt}` : overrideViewPrompt) : prompt;

    try {
      const result = await generateImage({
        vehicleMake: config.vehicle.make,
        vehicleModel: config.vehicle.model,
        vehicleYear: config.vehicle.year,
        accessories: config.selectedAccessories.map(a => a.name),
        customPrompt: finalPrompt,
      });
      clearInterval(interval);
      setProgress(100);
      
      const newImages = [...(config.generatedImages || [])];
      if (newImages.length === 0 && config.generatedImageUrl) {
         newImages.push({ url: config.generatedImageUrl, view: 'Initial', prompt: config.customPrompt });
      }
      newImages.push({ url: result.imageUrl, view: overrideViewPrompt || 'Custom', prompt: finalPrompt });

      setConfig({ 
        ...config, 
        generatedImageUrl: result.imageUrl, 
        customPrompt: prompt, 
        generatedImages: newImages 
      });
      // Reset zoom on new image
      handleReset();
      setTimeout(() => { setIsGenerating(false); setProgress(0); }, 400);
    } catch (error) {
      console.error(error);
      addLog('error', 'Image generation failed', error instanceof Error ? error.message : 'Unknown error occurred');
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
      <h2 className="text-md font-bold">Preview</h2>
      <p className="text-sm text-gray-500 mb-6">AI-generated visualization of your configured vehicle</p>

      <div className="grid grid-cols-[1fr_280px] gap-6">
        {/* Preview Image */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-400">AI Generated Preview</span>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
            <div className="flex h-96">
              {/* Left Side: Main Preview */}
              <div 
                ref={containerRef}
                className="bg-gray-900 flex-1 relative overflow-hidden cursor-move"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {config.generatedImageUrl ? (
                  <img 
                    src={config.generatedImageUrl} 
                    alt="Preview" 
                    className="absolute top-1/2 left-1/2 w-full h-full object-contain transition-transform duration-100"
                    style={{ 
                      transform: `translate(-50%, -50%) translate(${translateX}px, ${translateY}px) scale(${scale})`,
                      cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'default'
                    }}
                    draggable={false}
                  />
                ) : (
                  <span className="text-7xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">🛻</span>
                )}
                <div className="absolute bottom-3 left-3 flex gap-2 flex-wrap max-w-[70%]">
                  {config.selectedAccessories.slice(0, 3).map(a => (
                    <span key={a.id} className="bg-yellow-400/90 text-gray-900 text-xs font-semibold px-2 py-1 rounded">
                      {a.name}
                    </span>
                  ))}
                </div>
                
                {/* Zoom Controls */}
                <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/70 rounded-lg p-1">
                  {config.generatedImageUrl && (
                    <a
                      href={config.generatedImageUrl}
                      download={`${config.vehicle?.make}-${config.vehicle?.model}-accessories.png`}
                      className="p-1.5 text-white hover:bg-white/20 rounded transition-colors mr-1 border-r border-white/30"
                      title="Download image"
                      onClick={() => addLog('action', 'Image downloaded', `${config.vehicle?.make} ${config.vehicle?.model}`)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  )}
                  <button
                    onClick={handleZoomOut}
                    className="p-1.5 text-white hover:bg-white/20 rounded transition-colors"
                    title="Zoom out"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="text-xs text-white px-2 min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
                  <button
                    onClick={handleZoomIn}
                    className="p-1.5 text-white hover:bg-white/20 rounded transition-colors"
                    title="Zoom in"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    onClick={handleReset}
                    className="p-1.5 text-white hover:bg-white/20 rounded transition-colors ml-1 border-l border-white/30"
                    title="Reset view"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Right Side: Thumbnails */}
              {config.generatedImages && config.generatedImages.length > 0 && (
                <div className="w-32 bg-gray-800 border-l border-gray-700 p-2 flex flex-col gap-2 overflow-y-auto shrink-0">
                  <div className="text-[10px] uppercase font-bold text-gray-500 mb-1 px-1">Angles</div>
                  {config.generatedImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setConfig({ ...config, generatedImageUrl: img.url })}
                      className={`relative w-full h-20 rounded-lg overflow-hidden border-2 transition-colors ${config.generatedImageUrl === img.url ? 'border-yellow-400' : 'border-transparent hover:border-gray-500'}`}
                    >
                      <img src={img.url} className="w-full h-full object-cover" alt={img.view} />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 text-[10px] text-white text-center py-0.5 truncate px-1">
                        {img.view}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-gray-200">
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
                    onClick={() => handleRegenerate()}
                    className="bg-yellow-400 text-gray-900 font-bold px-4 py-2 rounded-lg text-sm hover:bg-yellow-300 whitespace-nowrap"
                  >
                    Regenerate
                  </button>
                </div>
                
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Generate angles</div>
                <div className="flex flex-wrap gap-2">
                  {['Front View', 'Side View', 'Rear View', 'Top View'].map(view => (
                    <button
                      key={view}
                      onClick={() => handleRegenerate(view)}
                      className="border border-gray-300 text-gray-700 font-semibold px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 bg-white"
                    >
                      + {view}
                    </button>
                  ))}
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
                onClick={() => {
                  addLog('action', 'Save Configuration clicked', `Total: $${total.toLocaleString()}`);
                  alert('Save — Phase 2');
                }}
                className="w-full bg-yellow-400 text-gray-900 font-bold py-2.5 rounded-lg text-sm hover:bg-yellow-300"
              >
                Save Configuration
              </button>
              <button
                onClick={() => {
                  addLog('action', 'Share Link clicked');
                  alert('Share — Phase 2');
                }}
                className="w-full border border-gray-200 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Share Link
              </button>
              <button
                onClick={() => {
                  addLog('action', 'Change Accessories clicked');
                  onBack();
                }}
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
