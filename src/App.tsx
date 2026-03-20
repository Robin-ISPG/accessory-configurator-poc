import { useState } from 'react';
import type { Step, Configuration } from './types';
import './index.css';
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
