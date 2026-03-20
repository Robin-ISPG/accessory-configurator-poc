import { useState } from 'react';
import type { Configuration, Vehicle } from '../../types';
import { makes, modelsByMake, years, vehicles } from '../../data/vehicles';

import type { LogEntry } from '../LogBox/LogBox';

interface Props {
  config: Configuration;
  setConfig: (c: Configuration) => void;
  onNext: () => void;
  addLog: (type: LogEntry['type'], message: string, details?: string) => void;
}

export default function VehicleSelector({ config, setConfig, onNext, addLog }: Props) {
  const [make, setMake] = useState(config.vehicle?.make || '');
  const [model, setModel] = useState(config.vehicle?.model || '');
  const [year, setYear] = useState(config.vehicle?.year || '');

  const filteredVehicles = vehicles.filter(v =>
    (!make || v.make === make) &&
    (!model || v.model === model) &&
    (!year || v.year === year)
  );

  function selectVehicle(vehicle: Vehicle) {
    setConfig({ ...config, vehicle });
  }

  return (
    <div className="max-w-4xl">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Step 1 of 3</p>
      <h1 className="text-3xl font-bold text-white mb-1">Select Your Vehicle</h1>
      <p className="text-sm text-gray-400 mb-8">Choose your make, model and year to see compatible accessories</p>

      <div className="grid grid-cols-3 gap-4 mb-8 max-w-3xl">
        {/* Make */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Make</label>
          <select
            className="w-full border border-[#3a3a3a] rounded-lg px-4 py-3 text-sm bg-[#2a2a2a] text-white appearance-none cursor-pointer hover:border-[#4a4a4a] transition-colors"
            value={make}
            onChange={e => { 
              const newMake = e.target.value;
              setMake(newMake); 
              setModel(''); 
              setYear(''); 
              if (newMake) addLog('action', `Filter changed: Make = ${newMake}`);
            }}
          >
            <option value="">Select Make</option>
            {makes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Model */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Model</label>
          <select
            className="w-full border border-[#3a3a3a] rounded-lg px-4 py-3 text-sm bg-[#2a2a2a] text-white appearance-none cursor-pointer hover:border-[#4a4a4a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            value={model}
            disabled={!make}
            onChange={e => { 
              const newModel = e.target.value;
              setModel(newModel); 
              setYear(''); 
              if (newModel) addLog('action', `Filter changed: Model = ${newModel}`);
            }}
          >
            <option value="">Select Model</option>
            {(modelsByMake[make] || []).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Year */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Year</label>
          <select
            className="w-full border border-[#3a3a3a] rounded-lg px-4 py-3 text-sm bg-[#2a2a2a] text-white appearance-none cursor-pointer hover:border-[#4a4a4a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            value={year}
            disabled={!model}
            onChange={e => {
              const newYear = e.target.value;
              setYear(newYear);
              if (newYear) addLog('action', `Filter changed: Year = ${newYear}`, `Make: ${make}, Model: ${model}`);
            }}
          >
            <option value="">Select Year</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Vehicle Cards */}
      {year && make && model && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Select Variant</p>
          <div className="grid grid-cols-3 gap-4 max-w-3xl mb-8">
            {filteredVehicles.map(v => (
              <div
                key={v.id}
                onClick={() => selectVehicle(v)}
                className={`bg-[#2a2a2a] rounded-xl p-4 cursor-pointer border transition-all
                  ${config.vehicle?.id === v.id ? 'border-yellow-500 border-2' : 'border-[#3a3a3a] hover:border-[#4a4a4a]'}`}
              >
                <div className="text-3xl mb-2">🛻</div>
                <div className="font-semibold text-sm text-white">{v.model} {v.variant}</div>
                <div className="text-xs text-gray-400">{v.year} · {v.make}</div>
                {config.vehicle?.id === v.id && (
                  <div className="text-yellow-500 text-xs font-bold mt-1">✓ Selected</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => {
          addLog('action', 'Continue to Accessories clicked', `Selected: ${config.vehicle?.make} ${config.vehicle?.model} ${config.vehicle?.variant}`);
          onNext();
        }}
        disabled={!config.vehicle}
        className="bg-[#2a2a2a] border border-[#3a3a3a] text-gray-400 font-bold uppercase tracking-wide px-6 py-3 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3a3a3a] hover:text-white transition-colors"
      >
        Continue to Accessories →
      </button>
    </div>
  );
}
