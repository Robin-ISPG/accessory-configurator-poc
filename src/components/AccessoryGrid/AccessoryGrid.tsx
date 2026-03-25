import { useState, useRef, useEffect } from 'react';
import type { Configuration, Accessory } from '../../types';
import { accessories } from '../../data/accessories';
import { isAccessoryCompatibleWithVehicle } from '../../utils/accessoryCompatibility';
import AccessoryCard from './AccessoryCard';
import { generateImage, paramsFromConfiguration } from '../../services/imageService';
import { isCloudinaryConfigured, uploadImageFile } from '../../services/cloudinary';
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
  const [uploadingCategoryRef, setUploadingCategoryRef] = useState(false);
  const [uploadingAccessoryId, setUploadingAccessoryId] = useState<string | null>(null);
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const selectedIdsKey = config.selectedAccessories.map(a => a.id).sort().join(',');

  useEffect(() => {
    const prev = configRef.current;
    if (!prev.vehicle) return;
    const incompatible = prev.selectedAccessories.filter(
      a => !isAccessoryCompatibleWithVehicle(a, prev.vehicle)
    );
    if (incompatible.length === 0) return;

    const nextRefs = { ...prev.accessoryReferenceImages };
    incompatible.forEach(a => delete nextRefs[a.id]);

    setConfig({
      ...prev,
      selectedAccessories: prev.selectedAccessories.filter(a =>
        isAccessoryCompatibleWithVehicle(a, prev.vehicle)
      ),
      accessoryReferenceImages: nextRefs,
    });
    addLog(
      'info',
      'Removed accessories not compatible with this vehicle',
      incompatible.map(a => a.name).join(', ')
    );
  }, [config.vehicle?.id, selectedIdsKey, setConfig, addLog]);

  const filtered = accessories.filter(
    a =>
      a.category === activeCategory && isAccessoryCompatibleWithVehicle(a, config.vehicle)
  );

  function toggleAccessory(acc: Accessory) {
    const exists = config.selectedAccessories.find(a => a.id === acc.id);
    if (exists) {
      const refs = { ...config.accessoryReferenceImages };
      delete refs[acc.id];
      setConfig({
        ...config,
        selectedAccessories: config.selectedAccessories.filter(a => a.id !== acc.id),
        accessoryReferenceImages: refs,
      });
      return;
    }
    setConfig({ ...config, selectedAccessories: [...config.selectedAccessories, acc] });
  }

  function setAccessoryReferenceImage(accessoryId: string, imageUrl: string | null) {
    const next = { ...config.accessoryReferenceImages };
    if (imageUrl) next[accessoryId] = imageUrl;
    else delete next[accessoryId];
    setConfig({ ...config, accessoryReferenceImages: next });
  }

  async function uploadRefFile(
    file: File,
    kind: 'category' | 'accessory',
    categoryOrAccessoryId: Category | string
  ) {
    if (kind === 'category') setUploadingCategoryRef(true);
    else setUploadingAccessoryId(categoryOrAccessoryId);

    const categoryKey = kind === 'category' ? categoryOrAccessoryId : null;
    const accessoryId = kind === 'accessory' ? categoryOrAccessoryId : null;

    if (isCloudinaryConfigured()) {
      try {
        const secureUrl = await uploadImageFile(file);
        const prev = configRef.current;
        if (kind === 'category' && categoryKey) {
          setConfig({
            ...prev,
            categoryReferenceImages: {
              ...prev.categoryReferenceImages,
              [categoryKey]: secureUrl,
            },
          });
          addLog('action', `${categoryKey} reference uploaded to Cloudinary`, secureUrl);
        } else if (accessoryId) {
          setConfig({
            ...prev,
            accessoryReferenceImages: {
              ...prev.accessoryReferenceImages,
              [accessoryId]: secureUrl,
            },
          });
          const name =
            prev.selectedAccessories.find(a => a.id === accessoryId)?.name ?? accessoryId;
          addLog('action', `Accessory image uploaded to Cloudinary: ${name}`, secureUrl);
        }
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : 'Cloudinary upload failed');
      } finally {
        setUploadingCategoryRef(false);
        setUploadingAccessoryId(null);
      }
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const prev = configRef.current;
      if (kind === 'category' && categoryKey) {
        setConfig({
          ...prev,
          categoryReferenceImages: {
            ...prev.categoryReferenceImages,
            [categoryKey]: dataUrl,
          },
        });
        addLog('action', `${categoryKey} reference stored locally`, file.name);
      } else if (accessoryId) {
        setConfig({
          ...prev,
          accessoryReferenceImages: {
            ...prev.accessoryReferenceImages,
            [accessoryId]: dataUrl,
          },
        });
        const name =
          prev.selectedAccessories.find(a => a.id === accessoryId)?.name ?? accessoryId;
        addLog('action', `Accessory image stored locally: ${name}`, file.name);
      }
      setUploadingCategoryRef(false);
      setUploadingAccessoryId(null);
    };
    reader.readAsDataURL(file);
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
      const genParams = paramsFromConfiguration(config);
      if (!genParams) return;
      const result = await generateImage(genParams);
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
      const providerKey = localStorage.getItem('API_PROVIDER');
      const activeProvider = providerKey === 'stability' ? 'Stability AI' : 'NanoBanana API';
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
          <div className="bg-slate-300 rounded-xl border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-155px)] sticky top-4">
            
            {/* Vehicle Header */}
            <div className="p-4 border-b border-gray-200 bg-slate-400 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {config.vehicleConfigureMode === 'images' && config.vehicle?.baseImageUrl ? (
                  <div className="h-14 w-20 rounded-lg overflow-hidden border border-slate-500 shrink-0 bg-slate-600">
                    <img
                      src={config.vehicle.baseImageUrl}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-900 truncate">
                    {config.vehicle?.model} {config.vehicle?.variant}
                  </div>
                  <div className="text-xs text-slate-200 font-bold">{config.vehicle?.year}</div>
                  {config.vehicleConfigureMode === 'images' && (
                    <div className="text-[10px] font-bold text-slate-800 mt-0.5">Image-based vehicle</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  addLog('action', 'Change Vehicle clicked');
                  onBack();
                }}
                className="btn btn-primary bg-slate-200 text-slate-700 p-2 font-bold uppercase rounded-lg cursor-pointer text-xs hover:text-gray-900"
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
                  {filtered.length === 0 ? (
                    <p className="col-span-2 text-xs text-gray-500 py-3">
                      No accessories in this category for your vehicle.
                    </p>
                  ) : (
                    filtered.map(acc => (
                      <AccessoryCard
                        key={acc.id}
                        accessory={acc}
                        selected={!!config.selectedAccessories.find(a => a.id === acc.id)}
                        referenceImageUrl={config.accessoryReferenceImages[acc.id]}
                        isUploading={uploadingAccessoryId === acc.id}
                        onUploadReference={(file) => {
                          void uploadRefFile(file, 'accessory', acc.id);
                        }}
                        onRemoveReference={() => {
                          setAccessoryReferenceImage(acc.id, null);
                          addLog('action', `Accessory image removed: ${acc.name}`);
                        }}
                        onToggle={() => toggleAccessory(acc)}
                      />
                    ))
                  )}
                </div>

                {/* Per-Category Reference Image Upload (data-driven flow only) */}
                {config.vehicleConfigureMode === 'data' && (
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{activeCategory} Reference Image (Optional)</div>
                    <div className="flex flex-col gap-2">
                      {uploadingCategoryRef ? (
                        <p className="text-[10px] text-slate-600 font-semibold">Uploading…</p>
                      ) : null}
                      <input 
                        type="file" 
                        accept="image/*" 
                        disabled={uploadingCategoryRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          void uploadRefFile(file, 'category', activeCategory);
                          e.target.value = '';
                        }}
                        className="text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-yellow-400 file:text-yellow-900 hover:file:bg-yellow-300 disabled:opacity-50"
                      />
                      {config.categoryReferenceImages?.[activeCategory] && (
                        <div className="relative w-24 h-24 mt-1 rounded-lg overflow-hidden border border-slate-400 shadow-sm transition-transform hover:scale-105">
                          <img src={config.categoryReferenceImages[activeCategory]} alt={`${activeCategory} Reference`} className="w-full h-full object-cover" />
                          <button 
                            onClick={() => {
                              const updated = { ...config.categoryReferenceImages };
                              delete updated[activeCategory];
                              setConfig({ ...config, categoryReferenceImages: updated });
                              addLog('action', `${activeCategory} Reference image removed`);
                            }}
                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold leading-none shadow shrink-0"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Accessories Summary */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Selected ({config.selectedAccessories.length})</div>
                {config.selectedAccessories.length === 0 ? (
                  <div className="text-sm text-gray-400 italic py-2">No accessories selected</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {config.selectedAccessories.map(a => (
                      <div key={a.id} className="rounded-lg border border-slate-200 bg-white/80 p-2">
                        <div className="flex justify-between items-center gap-2 text-sm mb-2">
                          <span className="text-gray-800 font-semibold truncate" title={a.name}>{a.name}</span>
                          <span className="text-gray-900 font-semibold text-xs shrink-0">${a.price}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Reference upload is available directly on the accessory card.
                        </div>
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
                className="w-full bg-yellow-400 text-gray-900 font-bold uppercase tracking-wide py-3 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-yellow-300 transition-colors shadow-sm cursor-pointer"
              >
                {isGenerating ? 'Generating...' : 'Generate Preview →'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Preview Area */}
        <div className="flex flex-col h-[calc(100vh-155px)] sticky top-4 overflow-hidden">
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
