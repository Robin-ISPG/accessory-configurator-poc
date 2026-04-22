import { useState, useCallback, useEffect, useRef } from 'react';
import { Car } from 'lucide-react';
import type { Step, Configuration, Accessory, ApiProvider, VehicleConfigureMode } from './types';
import './index.css';
import StepBar from './components/ui/StepBar';
import VehicleSelector from './components/VehicleSelector/VehicleSelector';
import AccessoryGrid from './components/AccessoryGrid/AccessoryGrid';
import LogBox, { type LogEntry } from './components/LogBox/LogBox';
import type { Vehicle } from './types';
import {
  getPersistedItem,
  setPersistedItem,
  removePersistedItem,
  getStorageEstimate,
} from './services/persistenceService';
import {
  GEMINI_SELECTABLE_IMAGE_MODELS,
  getInitialGeminiSelectableModel,
  type GeminiSelectableImageModelId,
} from './services/imageService';

const STORAGE_KEY = 'accessory-configurator-data';
const HISTORY_KEY = 'accessory-configurator-history';
const MAX_HISTORY_BYTES = 12 * 1024 * 1024;
const TARGET_HISTORY_BYTES = 8 * 1024 * 1024;

const defaultConfig: Configuration = {
  vehicle: null,
  vehicleConfigureMode: 'data',
  selectedAccessories: [],
  customPrompt: '',
  generatedImageUrl: null,
  categoryReferenceImages: {},
  accessoryReferenceImages: {},
  exteriorBodyColor: null,
};

interface StoredData {
  step: Step;
  config: Configuration;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  vehicle: Vehicle;
  vehicleConfigureMode?: VehicleConfigureMode;
  accessories: Accessory[];
  customPrompt: string;
  categoryReferenceImages: Record<string, string>;
  accessoryReferenceImages?: Record<string, string>;
  generatedImageUrl: string | null;
  totalPrice: number;
  exteriorBodyColor?: Configuration['exteriorBodyColor'];
}

async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  // Blob URLs (e.g. `blob:` from `URL.createObjectURL`) are not stable across reloads,
  // so we convert them to a `data:` URL before persisting.
  const res = await fetch(blobUrl);
  const blob = await res.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob as data URL.'));
    reader.readAsDataURL(blob);
  });
}

async function resolveImageUrlForStorage(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:')) return trimmed;

  if (trimmed.startsWith('blob:')) {
    try {
      const dataUrl = await blobUrlToDataUrl(trimmed);
      // Free the blob once we have the data URL (safe because the UI will use the returned data URL).
      try {
        URL.revokeObjectURL(trimmed);
      } catch {
        // Ignore revoke failures.
      }
      return dataUrl;
    } catch (e) {
      console.error('Failed to convert blob URL for storage', e);
      return null;
    }
  }

  // Allow http(s) URLs (e.g. Cloudinary) to be stored directly.
  return trimmed;
}

function pruneHistoryEntries(entries: HistoryEntry[]): HistoryEntry[] {
  // Keep history bounded to avoid IndexedDB quota errors.
  // Note: we prune by JSON size, not byte size of images individually.
  const encoder = new TextEncoder();
  let trimmed = entries;
  let bytes = encoder.encode(JSON.stringify(trimmed)).length;

  if (bytes <= MAX_HISTORY_BYTES) return trimmed;

  while (trimmed.length > 5 && bytes > TARGET_HISTORY_BYTES) {
    trimmed = trimmed.slice(0, trimmed.length - 1);
    bytes = encoder.encode(JSON.stringify(trimmed)).length;
  }

  return trimmed;
}

export default function App() {
  const getStoredProvider = (): ApiProvider => {
    const stored = localStorage.getItem('API_PROVIDER');
    if (stored === 'stability') {
      localStorage.setItem('API_PROVIDER', 'nanobanana');
      localStorage.removeItem('STABILITY_API_KEY');
      return 'nanobanana';
    }
    return stored === 'vertex' || stored === 'nanobanana' || stored === 'gemini' ? stored : 'nanobanana';
  };

  const [step, setStep] = useState<Step>(1);
  const [config, setConfig] = useState<Configuration>(defaultConfig);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showApiKeyValue, setShowApiKeyValue] = useState(false);
  const [apiProvider, setApiProvider] = useState<ApiProvider>(() => getStoredProvider());
  const [apiKeys, setApiKeys] = useState({
    nanobanana: localStorage.getItem('NANOBANANA_API_KEY') || '',
    gemini: localStorage.getItem('GEMINI_API_KEY') || '',
  });
  const [geminiImageModel, setGeminiImageModel] = useState<GeminiSelectableImageModelId>(() =>
    getInitialGeminiSelectableModel()
  );
  const [vertexConfig, setVertexConfig] = useState({
    projectId: localStorage.getItem('VERTEX_PROJECT_ID') || '',
    location: localStorage.getItem('VERTEX_LOCATION') || 'us-central1',
    authMode:
      localStorage.getItem('VERTEX_AUTH_MODE') === 'api_key' ? ('api_key' as const) : ('oauth' as const),
    accessToken: localStorage.getItem('VERTEX_ACCESS_TOKEN') || '',
    apiKey: localStorage.getItem('VERTEX_API_KEY') || '',
  });
  const apiPanelRef = useRef<HTMLDivElement | null>(null);
  const apiButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleProviderChange = (provider: ApiProvider) => {
    setApiProvider(provider);
    localStorage.setItem('API_PROVIDER', provider);
  };

  const handleGeminiImageModelChange = (id: GeminiSelectableImageModelId) => {
    setGeminiImageModel(id);
    localStorage.setItem('GEMINI_IMAGE_MODEL', id);
    setShowApiKeyInput(false);
  };

  const handleApiKeyChange = (provider: ApiProvider, val: string) => {
    if (provider === 'nanobanana') {
      setApiKeys((prev) => ({ ...prev, nanobanana: val }));
      if (val) localStorage.setItem('NANOBANANA_API_KEY', val);
      else localStorage.removeItem('NANOBANANA_API_KEY');
    }
    if (provider === 'gemini') {
      setApiKeys((prev) => ({ ...prev, gemini: val }));
      if (val) localStorage.setItem('GEMINI_API_KEY', val);
      else localStorage.removeItem('GEMINI_API_KEY');
    }
  };

  const handleVertexField = (field: keyof typeof vertexConfig, val: string) => {
    setVertexConfig((prev) => ({ ...prev, [field]: val }));
    if (field === 'authMode') {
      localStorage.setItem('VERTEX_AUTH_MODE', val === 'api_key' ? 'api_key' : 'oauth');
      return;
    }
    const keyMap = {
      projectId: 'VERTEX_PROJECT_ID',
      location: 'VERTEX_LOCATION',
      accessToken: 'VERTEX_ACCESS_TOKEN',
      apiKey: 'VERTEX_API_KEY',
    } as const;
    const storageKey = keyMap[field as keyof typeof keyMap];
    if (storageKey) {
      if (val) localStorage.setItem(storageKey, val);
      else localStorage.removeItem(storageKey);
    }
  };

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 2200);
  }, []);

  const addLog = useCallback((type: LogEntry['type'], message: string, details?: string) => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type,
      message,
      details,
    };
    setLogs(prev => [...prev, entry]);
  }, []);

  // Load persisted state on mount (IndexedDB, with one-time localStorage migration).
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      try {
        const persistedData = await getPersistedItem<StoredData>(STORAGE_KEY);
        if (!cancelled && persistedData) {
          setStep(persistedData.step);
          const mode: VehicleConfigureMode =
            persistedData.config.vehicleConfigureMode === 'images' ? 'images' : 'data';
          const restoredConfig: Configuration = {
            ...persistedData.config,
            vehicleConfigureMode: mode,
            accessoryReferenceImages: persistedData.config.accessoryReferenceImages || {},
            exteriorBodyColor: persistedData.config.exteriorBodyColor ?? null,
            generatedImageUrl: persistedData.config.generatedImageUrl?.startsWith('blob:')
              ? null
              : persistedData.config.generatedImageUrl,
          };
          setConfig(restoredConfig);
        } else {
          const legacyData = localStorage.getItem(STORAGE_KEY);
          if (!cancelled && legacyData) {
            const parsedData: StoredData = JSON.parse(legacyData);
            setStep(parsedData.step);
            const mode: VehicleConfigureMode =
              parsedData.config.vehicleConfigureMode === 'images' ? 'images' : 'data';
            const restoredConfig: Configuration = {
              ...parsedData.config,
              vehicleConfigureMode: mode,
              accessoryReferenceImages: parsedData.config.accessoryReferenceImages || {},
              exteriorBodyColor: parsedData.config.exteriorBodyColor ?? null,
              generatedImageUrl: parsedData.config.generatedImageUrl?.startsWith('blob:')
                ? null
                : parsedData.config.generatedImageUrl,
            };
            setConfig(restoredConfig);
            void setPersistedItem(STORAGE_KEY, parsedData);
          }
        }
      } catch {
        console.error('Failed to load saved configuration');
      }

      try {
        const persistedHistory = await getPersistedItem<HistoryEntry[]>(HISTORY_KEY);
        if (!cancelled && persistedHistory) {
          setHistory(pruneHistoryEntries(persistedHistory));
        } else {
          const legacyHistory = localStorage.getItem(HISTORY_KEY);
          if (!cancelled && legacyHistory) {
            const parsedHistory: HistoryEntry[] = JSON.parse(legacyHistory);
            setHistory(pruneHistoryEntries(parsedHistory));
            void setPersistedItem(HISTORY_KEY, parsedHistory);
          }
        }
      } catch {
        console.error('Failed to load history');
      }

      if (!cancelled) {
        setIsLoaded(true);
        addLog('info', 'Application loaded');
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  // Save current state to IndexedDB.
  useEffect(() => {
    if (!isLoaded) return;
    const data: StoredData = { step, config };
    void setPersistedItem(STORAGE_KEY, data).catch(() => {
      console.error('Failed to persist current state');
    });
  }, [step, config, isLoaded]);

  // Save history to IndexedDB.
  useEffect(() => {
    if (!isLoaded) return;
    void setPersistedItem(HISTORY_KEY, history).catch(() => {
      console.error('Failed to persist history');
    });
  }, [history, isLoaded]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!showApiKeyInput) return;
      const target = event.target as Node;
      if (apiPanelRef.current?.contains(target) || apiButtonRef.current?.contains(target)) {
        return;
      }
      setShowApiKeyInput(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showApiKeyInput]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    addLog('info', 'Logs cleared');
  }, [addLog]);

  // Surface storage pressure. History pruning happens when loading/saving history.
  useEffect(() => {
    if (!isLoaded || history.length === 0) return;

    void getStorageEstimate().then((estimate) => {
      if (!estimate || !estimate.quota) return;
      const usageRatio = estimate.usage / estimate.quota;
      if (usageRatio >= 0.8) {
        addLog(
          'info',
          'Browser storage usage is high',
          `${Math.round(usageRatio * 100)}% of quota used`
        );
      }
    });
  }, [history, isLoaded, addLog]);

  const handleApiKeyCommit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      handleApiKeyChange('nanobanana', trimmed);

      if (!trimmed) return;

      setShowApiKeyInput(false);
      addLog('action', 'NanoBanana API key saved');
      showToast('Saved');
    },
    [addLog, showToast]
  );

  const handleGeminiKeyCommit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      handleApiKeyChange('gemini', trimmed);

      if (!trimmed) return;

      setShowApiKeyInput(false);
      addLog('action', 'Gemini API key saved');
      showToast('Saved');
    },
    [addLog, showToast]
  );

  const handleVertexCommit = useCallback(() => {
    const { projectId, location, accessToken, apiKey } = vertexConfig;
    const p = projectId.trim();
    const l = location.trim() || 'us-central1';
    const t = accessToken.trim();
    const k = apiKey.trim();
    const authMode =
      localStorage.getItem('VERTEX_AUTH_MODE') === 'api_key' ? 'api_key' : 'oauth';
    if (p) localStorage.setItem('VERTEX_PROJECT_ID', p);
    else localStorage.removeItem('VERTEX_PROJECT_ID');
    if (l) localStorage.setItem('VERTEX_LOCATION', l);
    else localStorage.removeItem('VERTEX_LOCATION');
    localStorage.setItem('VERTEX_AUTH_MODE', authMode === 'api_key' ? 'api_key' : 'oauth');
    if (t) localStorage.setItem('VERTEX_ACCESS_TOKEN', t);
    else localStorage.removeItem('VERTEX_ACCESS_TOKEN');
    if (k) localStorage.setItem('VERTEX_API_KEY', k);
    else localStorage.removeItem('VERTEX_API_KEY');
    setVertexConfig((prev) => ({
      ...prev,
      projectId: p,
      location: l,
      accessToken: t,
      apiKey: k,
      authMode,
    }));
    const credOk = p && (authMode === 'api_key' ? k.length > 0 : t.length > 0);
    if (credOk) {
      setShowApiKeyInput(false);
      addLog('action', 'Vertex AI credentials saved');
      showToast('Saved');
    }
  }, [vertexConfig, addLog, showToast]);



  const addToHistory = useCallback(async (configToSave: Configuration): Promise<string | null> => {
    if (!configToSave.vehicle) return null;

    const imageUrl = await resolveImageUrlForStorage(configToSave.generatedImageUrl);
    
    const totalPrice = configToSave.selectedAccessories.reduce((sum, a) => sum + a.price, 0);
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      vehicle: configToSave.vehicle,
      vehicleConfigureMode: configToSave.vehicleConfigureMode,
      accessories: configToSave.selectedAccessories,
      customPrompt: configToSave.customPrompt,
      categoryReferenceImages: configToSave.categoryReferenceImages || {},
      accessoryReferenceImages: configToSave.accessoryReferenceImages || {},
      exteriorBodyColor: configToSave.exteriorBodyColor ?? null,
      generatedImageUrl: imageUrl,
      totalPrice,
    };
    
    setHistory(prev => pruneHistoryEntries([entry, ...prev].slice(0, 20))); // Keep last 20 and prune by JSON size
    addLog('action', 'Configuration saved to history', `${configToSave.vehicle.make} ${configToSave.vehicle.model} - $${totalPrice.toLocaleString()}`);
    return imageUrl;
  }, [addLog]);

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    const restoredConfig: Configuration = {
      vehicle: entry.vehicle,
      vehicleConfigureMode: entry.vehicleConfigureMode === 'images' ? 'images' : 'data',
      selectedAccessories: entry.accessories,
      customPrompt: entry.customPrompt,
      categoryReferenceImages: entry.categoryReferenceImages || {},
      accessoryReferenceImages: entry.accessoryReferenceImages || {},
      exteriorBodyColor: entry.exteriorBodyColor ?? null,
      generatedImageUrl: entry.generatedImageUrl,
    };
    setConfig(restoredConfig);
    setStep(2);
    setShowHistory(false);
    addLog('action', 'Configuration loaded from history', `${entry.vehicle.make} ${entry.vehicle.model}`);
  }, [addLog]);

  const deleteHistoryEntry = useCallback((id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
    addLog('action', 'History entry deleted');
  }, [addLog]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
    void removePersistedItem(HISTORY_KEY).catch(() => {
      console.error('Failed to clear persisted history');
    });
    addLog('action', 'History cleared');
  }, [addLog]);

  const handleSetConfig = useCallback(async (newConfig: Configuration) => {
    let nextConfig = { ...newConfig };

    if (newConfig.vehicle?.id !== config.vehicle?.id) {
      addLog('action', `Vehicle selected: ${newConfig.vehicle?.make} ${newConfig.vehicle?.model} ${newConfig.vehicle?.variant} (${newConfig.vehicle?.year})`);
      
      // If a vehicle was already selected and we are changing to a different one, clear previous configuration
      if (config.vehicle) {
        nextConfig.selectedAccessories = [];
        nextConfig.generatedImageUrl = null;
        nextConfig.generatedImages = [];
        nextConfig.customPrompt = '';
        nextConfig.lastReframeViewName = null;
        nextConfig.lastReframeViewPrompt = null;
        nextConfig.categoryReferenceImages = {};
        nextConfig.accessoryReferenceImages = {};
        nextConfig.exteriorBodyColor = null;
      }
    }

    if (nextConfig.selectedAccessories.length !== config.selectedAccessories.length) {
      const added = nextConfig.selectedAccessories.filter(a => !config.selectedAccessories.find(ca => ca.id === a.id));
      const removed = config.selectedAccessories.filter(a => !nextConfig.selectedAccessories.find(ca => ca.id === a.id));
      added.forEach(a => addLog('action', `Accessory added: ${a.name} ($${a.price})`));
      removed.forEach(a => addLog('action', `Accessory removed: ${a.name}`));
    }

    // If image was generated, convert to base64 and add to history
    if (nextConfig.generatedImageUrl && !config.generatedImageUrl) {
      const base64Url = await addToHistory(nextConfig);
      if (base64Url) {
        nextConfig = { ...nextConfig, generatedImageUrl: base64Url };
      }
    }
    setConfig(nextConfig);
  }, [config, addLog, addToHistory]);

  const handleSetStep = useCallback((newStep: Step) => {
    addLog('action', `Step changed: ${step} → ${newStep}`);
    setStep(newStep);
  }, [step, addLog]);

  const handleSetIsGenerating = useCallback((generating: boolean) => {
    if (generating) {
      addLog('api', 'Image generation started', `Vehicle: ${config.vehicle?.make} ${config.vehicle?.model}, Accessories: ${config.selectedAccessories.map(a => a.name).join(', ')}`);
    } else if (isGenerating && !generating) {
      addLog('api', 'Image generation completed');
    }
    setIsGenerating(generating);
  }, [isGenerating, config, addLog]);

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen bg-[#121212]">
      {/* Navbar */}
      <div className="bg-gray-900 px-6 py-3 flex items-center justify-between">
        <a 
          href="/" 
          onClick={(e) => {
            e.preventDefault();
            handleSetStep(1);
            if (showHistory) setShowHistory(false);
          }}
          className="flex items-center gap-2"
        >
          <span className="font-black text-xl tracking-wide text-white uppercase">
            Acc<span className="text-yellow-400">essorize</span>
          </span>by 
          <span className="text-2xl font-bold text-blue-400 font-mono">ISPG</span>
        </a>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              ref={apiButtonRef}
              onClick={() => {
                setShowApiKeyInput(!showApiKeyInput);
                if (showHistory) setShowHistory(false);
              }}
              className={`text-xs cursor-pointer px-3 py-1.5 rounded-lg transition-colors ${showApiKeyInput ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              API SETTINGS
            </button>
            {showApiKeyInput && (
              <div ref={apiPanelRef} className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl z-50">
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-300 mb-2">API Provider</label>
                  <div className="grid grid-cols-3 bg-gray-900 rounded-lg p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => handleProviderChange('nanobanana')}
                      className={`text-[10px] py-1.5 rounded-md transition-all font-semibold flex items-center justify-center gap-1 ${apiProvider === 'nanobanana' ? 'bg-blue-500 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                      {apiProvider === 'nanobanana' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                      )}
                      NanoBanana
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProviderChange('gemini')}
                      className={`text-[10px] py-1.5 rounded-md transition-all font-semibold flex items-center justify-center gap-1 ${apiProvider === 'gemini' ? 'bg-blue-500 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                      {apiProvider === 'gemini' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                      )}
                      Gemini
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProviderChange('vertex')}
                      className={`text-[10px] py-1.5 rounded-md transition-all font-semibold flex items-center justify-center gap-1 ${apiProvider === 'vertex' ? 'bg-blue-500 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                      {apiProvider === 'vertex' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                      )}
                      Vertex
                    </button>
                  </div>
                </div>

                {apiProvider === 'nanobanana' ? (
                  <>
                    <label className="block text-xs font-bold text-gray-300 mb-2">
                      NanoBanana API key
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKeyValue ? 'text' : 'password'}
                        value={apiKeys.nanobanana}
                        onChange={(e) => handleApiKeyChange('nanobanana', e.target.value)}
                        onBlur={(e) => handleApiKeyCommit(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleApiKeyCommit((e.target as HTMLInputElement).value);
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasted = e.clipboardData.getData('text');
                          handleApiKeyCommit(pasted);
                        }}
                        placeholder="Bearer token from nanobananaapi.ai"
                        className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-yellow-400 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKeyValue((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors"
                        title={showApiKeyValue ? 'Hide API key' : 'Show API key'}
                        aria-label={showApiKeyValue ? 'Hide API key' : 'Show API key'}
                      >
                        {showApiKeyValue ? (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 3l18 18" />
                            <path d="M10.58 10.58a2 2 0 002.83 2.83" />
                            <path d="M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7-1.02 2.29-2.78 4.22-5 5.41" />
                            <path d="M6.61 6.61C4.62 7.95 3.06 9.83 2 12c1.22 2.75 3.44 4.98 6.19 6.19" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 leading-tight">
                      Async image generation via nanobananaapi.ai (multi-image when references are used).
                      <br />
                      Stored only in your browser.
                    </p>
                  </>
                ) : apiProvider === 'gemini' ? (
                  <>
                    <label className="block text-xs font-bold text-gray-300 mb-2">
                      Gemini API key (Google AI Studio)
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKeyValue ? 'text' : 'password'}
                        value={apiKeys.gemini}
                        onChange={(e) => handleApiKeyChange('gemini', e.target.value)}
                        onBlur={(e) => handleGeminiKeyCommit(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleGeminiKeyCommit((e.target as HTMLInputElement).value);
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasted = e.clipboardData.getData('text');
                          handleGeminiKeyCommit(pasted);
                        }}
                        placeholder="From aistudio.google.com / ai.google.dev"
                        className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-yellow-400 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKeyValue((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors"
                        title={showApiKeyValue ? 'Hide API key' : 'Show API key'}
                        aria-label={showApiKeyValue ? 'Hide API key' : 'Show API key'}
                      >
                        {showApiKeyValue ? (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 3l18 18" />
                            <path d="M10.58 10.58a2 2 0 002.83 2.83" />
                            <path d="M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7-1.02 2.29-2.78 4.22-5 5.41" />
                            <path d="M6.61 6.61C4.62 7.95 3.06 9.83 2 12c1.22 2.75 3.44 4.98 6.19 6.19" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <fieldset className="mt-3 border-0 p-0 m-0">
                      <legend className="text-[10px] font-bold text-gray-300 mb-1.5">Image model</legend>
                      <div className="space-y-1.5">
                        {GEMINI_SELECTABLE_IMAGE_MODELS.map((opt) => (
                          <label
                            key={opt.id}
                            className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 text-[10px] transition-colors ${
                              geminiImageModel === opt.id
                                ? 'border-yellow-500/70 bg-gray-900/90'
                                : 'border-gray-600 hover:border-gray-500'
                            }`}
                          >
                            <input
                              type="radio"
                              name="gemini-image-model"
                              value={opt.id}
                              checked={geminiImageModel === opt.id}
                              onChange={() => handleGeminiImageModelChange(opt.id)}
                              className="mt-0.5 shrink-0"
                            />
                            <span className="min-w-0">
                              <span className="font-semibold text-gray-200">{opt.label}</span>
                              <span className="block font-mono text-[9px] text-gray-500 truncate" title={opt.id}>
                                {opt.id}
                              </span>
                              <span className="block text-gray-400 leading-snug">{opt.description}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <p className="text-[10px] text-gray-400 mt-2 leading-snug">
                      Multimodal request like gemini.google.com: reference images first, then your prompt; the model
                      returns image output. In dev, requests go through the Vite proxy to avoid CORS. API key and model
                      choice are stored only in this browser. Optional: set{' '}
                      <span className="font-mono">VITE_GEMINI_IMAGE_MODEL</span> in <span className="font-mono">.env</span>{' '}
                      when no radio selection is saved (same three IDs).
                    </p>
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-bold text-gray-300 mb-1">GCP project ID</label>
                    <input
                      type="text"
                      value={vertexConfig.projectId}
                      onChange={(e) => handleVertexField('projectId', e.target.value)}
                      onBlur={handleVertexCommit}
                      placeholder="my-gcp-project"
                      className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400 transition-colors mb-2"
                    />
                    <label className="block text-xs font-bold text-gray-300 mb-1">Region (Vertex location)</label>
                    <input
                      type="text"
                      value={vertexConfig.location}
                      onChange={(e) => handleVertexField('location', e.target.value)}
                      onBlur={handleVertexCommit}
                      placeholder="us-central1"
                      className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400 transition-colors mb-3"
                    />
                    <label className="block text-xs font-bold text-gray-300 mb-1">Authentication</label>
                    <div className="flex bg-gray-900 rounded-lg p-1 gap-1 mb-2">
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.setItem('VERTEX_AUTH_MODE', 'oauth');
                          setVertexConfig((prev) => ({ ...prev, authMode: 'oauth' }));
                        }}
                        className={`flex-1 text-[10px] py-1.5 rounded-md font-semibold ${
                          vertexConfig.authMode === 'oauth'
                            ? 'bg-blue-500 text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        OAuth token
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.setItem('VERTEX_AUTH_MODE', 'api_key');
                          setVertexConfig((prev) => ({ ...prev, authMode: 'api_key' }));
                        }}
                        className={`flex-1 text-[10px] py-1.5 rounded-md font-semibold ${
                          vertexConfig.authMode === 'api_key'
                            ? 'bg-blue-500 text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        GCP API key
                      </button>
                    </div>
                    {vertexConfig.authMode === 'oauth' ? (
                      <>
                        <label className="block text-xs font-bold text-gray-300 mb-1">
                          OAuth 2 access token (not the API key)
                        </label>
                        <div className="relative">
                          <input
                            type={showApiKeyValue ? 'text' : 'password'}
                            value={vertexConfig.accessToken}
                            onChange={(e) => handleVertexField('accessToken', e.target.value)}
                            onBlur={handleVertexCommit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleVertexCommit();
                            }}
                            placeholder="Output of: gcloud auth print-access-token"
                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-yellow-400 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKeyValue((prev) => !prev)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors"
                            title={showApiKeyValue ? 'Hide token' : 'Show token'}
                            aria-label={showApiKeyValue ? 'Hide token' : 'Show token'}
                          >
                            {showApiKeyValue ? (
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 3l18 18" />
                                <path d="M10.58 10.58a2 2 0 002.83 2.83" />
                                <path d="M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7-1.02 2.29-2.78 4.22-5 5.41" />
                                <path d="M6.61 6.61C4.62 7.95 3.06 9.83 2 12c1.22 2.75 3.44 4.98 6.19 6.19" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <label className="block text-xs font-bold text-gray-300 mb-1">
                          Google Cloud API key (Credentials → copy)
                        </label>
                        <div className="relative">
                          <input
                            type={showApiKeyValue ? 'text' : 'password'}
                            value={vertexConfig.apiKey}
                            onChange={(e) => handleVertexField('apiKey', e.target.value)}
                            onBlur={handleVertexCommit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleVertexCommit();
                            }}
                            placeholder="Bound to Vertex/Gemini + service account per Google Console"
                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-yellow-400 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKeyValue((prev) => !prev)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors"
                            title={showApiKeyValue ? 'Hide key' : 'Show key'}
                            aria-label={showApiKeyValue ? 'Hide key' : 'Show key'}
                          >
                            {showApiKeyValue ? (
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 3l18 18" />
                                <path d="M10.58 10.58a2 2 0 002.83 2.83" />
                                <path d="M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7-1.02 2.29-2.78 4.22-5 5.41" />
                                <path d="M6.61 6.61C4.62 7.95 3.06 9.83 2 12c1.22 2.75 3.44 4.98 6.19 6.19" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                    <p className="text-[10px] text-amber-200/90 mt-2 mb-2 leading-tight border border-amber-500/30 rounded px-2 py-1.5 bg-amber-500/10">
                      Client / external POC: anything typed here lives in the browser and can be copied from DevTools or
                      the network tab — including API keys and OAuth tokens. That does not stop misuse by visitors. For a
                      public demo, prefer NanoBanana in this panel, use placeholder mode with no key, or put Vertex
                      behind a small backend that holds credentials (Cloud Run / Functions) and optionally rate-limit or
                      password-gate.
                    </p>
                    <p className="text-[10px] text-gray-400 mt-2 leading-tight">
                      OAuth mode is for developers (<span className="font-mono">gcloud auth print-access-token</span>).
                      API key mode must use a key created with “Authenticate API calls through a service account” — a
                      normal unrestricted key gets “API keys are not supported” from Vertex. Restrict the key to Vertex AI;
                      grant Vertex AI User (<span className="font-mono">roles/aiplatform.user</span>) on that service
                      account.                       Optional env: <span className="font-mono">VITE_VERTEX_TEXT_MODEL</span> (default Imagen 4 fast),{' '}
                      <span className="font-mono">VITE_VERTEX_EDIT_MODEL</span> (inpaint stays Imagen 3 capability). Stored
                      only in this browser.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setShowHistory(!showHistory);
              if (showApiKeyInput) setShowApiKeyInput(false);
            }}
            className={`text-xs px-3 cursor-pointer  py-1.5 rounded-lg transition-colors ${showHistory ? 'bg-yellow-400 text-gray-900' : 'text-gray-400 hover:text-white'}`}
          >
            History ({history.length})
          </button>
          <span className="text-xs text-gray-400 cursor-default">POC Demo</span>
        </div>
      </div>

      <StepBar currentStep={step} />

      {showHistory ? (
        <div className="p-6 max-w-6xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Configuration History</h2>
            <div className="flex gap-2">
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 border border-red-400/30 rounded-lg transition-colors"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setShowHistory(false)}
                className="text-xs text-gray-400 hover:text-white px-3 py-1.5 border border-gray-600 rounded-lg transition-colors"
              >
                Back to Configurator
              </button>
            </div>
          </div>
          
          {history.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-2">No history yet</p>
              <p className="text-sm">Generate some images to save them here</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {history.map((entry) => (
                <div 
                  key={entry.id} 
                  className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden hover:border-yellow-400/50 transition-colors group"
                >
                  {entry.generatedImageUrl ? (
                    <img 
                      src={entry.generatedImageUrl} 
                      alt="Preview" 
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 bg-[#2a2a2a] flex items-center justify-center text-gray-500">
                      <Car className="h-10 w-10" strokeWidth={1.5} aria-hidden />
                    </div>
                  )}
                  <div className="p-3">
                    <div className="text-sm font-semibold text-white mb-1">
                      {entry.vehicle.year} {entry.vehicle.make} {entry.vehicle.model}
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      {entry.vehicle.variant}
                    </div>
                    <div className="text-xs text-yellow-400 mb-2">
                      {entry.accessories.length} accessories · ${entry.totalPrice.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mb-3">
                      {formatDate(entry.timestamp)}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadFromHistory(entry)}
                        className="flex-1 text-xs bg-yellow-400 text-gray-900 font-semibold py-1.5 rounded hover:bg-yellow-300 transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteHistoryEntry(entry.id)}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1.5 border border-red-400/30 rounded hover:bg-red-400/10 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-6">
          {step === 1 && (
            <VehicleSelector
              config={config}
              setConfig={handleSetConfig}
              onNext={() => handleSetStep(2)}
              addLog={addLog}
            />
          )}
          {step === 2 && (
            <AccessoryGrid
              config={config}
              setConfig={handleSetConfig}
              onBack={() => handleSetStep(1)}
              isGenerating={isGenerating}
              setIsGenerating={handleSetIsGenerating}
              addLog={addLog}
            />
          )}
        </div>
      )}

      <LogBox logs={logs} onClear={clearLogs} />
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-60 rounded-lg border border-green-400/30 bg-green-500/90 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
