import { useState, useCallback, useEffect } from 'react';
import type { Step, Configuration, Accessory } from './types';
import './index.css';
import StepBar from './components/ui/StepBar';
import VehicleSelector from './components/VehicleSelector/VehicleSelector';
import AccessoryGrid from './components/AccessoryGrid/AccessoryGrid';
import PreviewCanvas from './components/PreviewCanvas/PreviewCanvas';
import LogBox, { type LogEntry } from './components/LogBox/LogBox';
import type { Vehicle } from './types';

const STORAGE_KEY = 'accessory-configurator-data';
const HISTORY_KEY = 'accessory-configurator-history';

const defaultConfig: Configuration = {
  vehicle: null,
  selectedAccessories: [],
  customPrompt: '',
  generatedImageUrl: null,
};

interface StoredData {
  step: Step;
  config: Configuration;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  vehicle: Vehicle;
  accessories: Accessory[];
  customPrompt: string;
  generatedImageUrl: string | null;
  totalPrice: number;
}

export default function App() {
  const [step, setStep] = useState<Step>(1);
  const [config, setConfig] = useState<Configuration>(defaultConfig);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data: StoredData = JSON.parse(stored);
        setStep(data.step);
        const restoredConfig = {
          ...data.config,
          generatedImageUrl: data.config.generatedImageUrl?.startsWith('blob:') ? null : data.config.generatedImageUrl,
        };
        setConfig(restoredConfig);
      } catch {
        console.error('Failed to load saved configuration');
      }
    }
    
    // Load history
    const storedHistory = localStorage.getItem(HISTORY_KEY);
    if (storedHistory) {
      try {
        const parsed = JSON.parse(storedHistory);
        setHistory(parsed);
      } catch {
        console.error('Failed to load history');
      }
    }
    
    setIsLoaded(true);
    addLog('info', 'Application loaded');
  }, []);

  // Save current state to localStorage
  useEffect(() => {
    if (isLoaded) {
      const data: StoredData = { step, config };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [step, config, isLoaded]);

  // Save history to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }
  }, [history, isLoaded]);

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

  const clearLogs = useCallback(() => {
    setLogs([]);
    addLog('info', 'Logs cleared');
  }, [addLog]);



  const addToHistory = useCallback(async (configToSave: Configuration): Promise<string | null> => {
    if (!configToSave.vehicle) return null;
    
    let imageUrl = configToSave.generatedImageUrl;
    
    // Convert blob URL to base64 data URL for persistence
    if (imageUrl?.startsWith('blob:')) {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        imageUrl = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch {
        imageUrl = null;
      }
    }
    
    const totalPrice = configToSave.selectedAccessories.reduce((sum, a) => sum + a.price, 0);
    const entry: HistoryEntry = {
      id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      vehicle: configToSave.vehicle,
      accessories: configToSave.selectedAccessories,
      customPrompt: configToSave.customPrompt,
      generatedImageUrl: imageUrl,
      totalPrice,
    };
    
    setHistory(prev => [entry, ...prev].slice(0, 50)); // Keep last 50
    addLog('action', 'Configuration saved to history', `${configToSave.vehicle.make} ${configToSave.vehicle.model} - $${totalPrice.toLocaleString()}`);
    return imageUrl;
  }, [addLog]);

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    const restoredConfig: Configuration = {
      vehicle: entry.vehicle,
      selectedAccessories: entry.accessories,
      customPrompt: entry.customPrompt,
      generatedImageUrl: entry.generatedImageUrl,
    };
    setConfig(restoredConfig);
    setStep(3);
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
    addLog('action', 'History cleared');
  }, [addLog]);

  const handleSetConfig = useCallback(async (newConfig: Configuration) => {
    if (newConfig.vehicle?.id !== config.vehicle?.id) {
      addLog('action', `Vehicle selected: ${newConfig.vehicle?.make} ${newConfig.vehicle?.model} ${newConfig.vehicle?.variant} (${newConfig.vehicle?.year})`);
    }
    if (newConfig.selectedAccessories.length !== config.selectedAccessories.length) {
      const added = newConfig.selectedAccessories.filter(a => !config.selectedAccessories.find(ca => ca.id === a.id));
      const removed = config.selectedAccessories.filter(a => !newConfig.selectedAccessories.find(ca => ca.id === a.id));
      added.forEach(a => addLog('action', `Accessory added: ${a.name} ($${a.price})`));
      removed.forEach(a => addLog('action', `Accessory removed: ${a.name}`));
    }
    // If image was generated, convert to base64 and add to history
    if (newConfig.generatedImageUrl && !config.generatedImageUrl) {
      const base64Url = await addToHistory(newConfig);
      if (base64Url) {
        newConfig = { ...newConfig, generatedImageUrl: base64Url };
      }
    }
    setConfig(newConfig);
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
        <div className="flex items-center gap-2">
          <span className="font-black text-xl tracking-wide text-white uppercase">
            Acc<span className="text-yellow-400">essorize</span>
          </span>by 
          <span className="text-2xl font-bold text-blue-400 font-mono">ISPG</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${showHistory ? 'bg-yellow-400 text-gray-900' : 'text-gray-400 hover:text-white'}`}
          >
            History ({history.length})
          </button>
          <span className="text-xs text-gray-400">POC Demo</span>
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
                    <div className="w-full h-32 bg-[#2a2a2a] flex items-center justify-center">
                      <span className="text-4xl">🛻</span>
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
              onNext={() => handleSetStep(3)}
              onBack={() => handleSetStep(1)}
              isGenerating={isGenerating}
              setIsGenerating={handleSetIsGenerating}
              addLog={addLog}
            />
          )}
          {step === 3 && (
            <PreviewCanvas
              config={config}
              setConfig={handleSetConfig}
              onBack={() => handleSetStep(2)}
              isGenerating={isGenerating}
              setIsGenerating={handleSetIsGenerating}
              addLog={addLog}
            />
          )}
        </div>
      )}

      <LogBox logs={logs} onClear={clearLogs} />
    </div>
  );
}
