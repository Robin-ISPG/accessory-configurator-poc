import { useState } from 'react';
import type { Configuration, Vehicle } from '../../types';
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
